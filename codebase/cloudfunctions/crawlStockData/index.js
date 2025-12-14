// 爬虫云函数,用于爬取股吧发帖和新闻资讯
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const axios = require('axios')
const cheerio = require('cheerio')

// URL模板
const URL_TEMPLATES = {
  guba: 'https://guba.eastmoney.com/list,{stock_code}.html',
  news: 'http://so.eastmoney.com/News/s?keyword={stock_name}&pageindex={page}'
}

// 全局配置（可根据需求调整）
const CONFIG = {
  MAX_PAGES: 10, // 最大允许爬取页数，防止恶意请求
  PAGE_SIZE: 10, // 单页默认爬取条数
  DB_BATCH_LIMIT: 5, // 数据库单次写入条数
  REQUEST_TIMEOUT: 10000, // 请求超时时间
  MAX_RETRIES: 2, // 请求最大重试次数
  REQUEST_DELAY: 2000, // 请求重试延迟
  PAGE_DELAY: 3000 // 分页爬取间隔
}

exports.main = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
  
  console.log('开始执行爬虫云函数，参数:', JSON.stringify(event))
  
  // 解构参数并设置默认值
  const { 
    stock_code, 
    stock_name, 
    data_types = ['posts'], 
    pages = 1, // 默认爬取1页
    page_size = CONFIG.PAGE_SIZE // 单页爬取条数
  } = event
  
  try {
    // 1. 核心参数验证
    if (!stock_code || !/^\d{6}$/.test(stock_code)) {
      return { status: 'error', message: '股票代码必须为6位数字' }
    }
    
    // 2. 页数合法性校验（限制最大页数，避免过度爬取）
    const targetPages = Math.max(1, Math.min(Number(pages), CONFIG.MAX_PAGES))
    if (isNaN(targetPages)) {
      return { status: 'error', message: '页数必须为有效数字' }
    }
    
    const results = {
      stock_code: stock_code,
      stock_name: stock_name || stock_code,
      posts: { count: 0, data: [], pages: 0 },
      news: { count: 0, data: [], pages: 0 }
    }

    // 3. 爬取股吧发帖（支持指定页数）
    if (data_types.includes('posts')) {
      try {
        const postResult = await crawlPostsSafely(stock_code, targetPages, page_size)
        results.posts = { ...results.posts, ...postResult }
      } catch (error) {
        console.error('发帖爬取失败:', error.message)
        results.posts = { count: 0, data: [], pages: 0, error: error.message }
      }
    }

    // 4. 爬取新闻资讯（支持指定页数）
    if (data_types.includes('news') && stock_name) {
      try {
        const newsResult = await crawlNewsSafely(stock_code, stock_name, targetPages, page_size)
        results.news = { ...results.news, ...newsResult }
      } catch (error) {
        console.error('新闻爬取失败:', error.message)
        results.news = { count: 0, data: [], pages: 0, error: error.message }
      }
    }

    return {
      status: 'success',
      message: `数据爬取完成（股吧：${results.posts.pages}页/${results.posts.count}条；新闻：${results.news.pages}页/${results.news.count}条）`,
      data: results
    }

  } catch (error) {
    console.error('云函数执行失败:', error)
    return {
      status: 'error',
      message: `执行失败: ${error.message}`,
      stock_code: stock_code
    }
  }
}

// 安全的股吧爬取函数（支持指定页数）
async function crawlPostsSafely(stock_code, targetPages, page_size) {
  const crawledPosts = []
  let successPages = 0 // 成功爬取的页数
  
  for (let page = 1; page <= targetPages; page++) {
    try {
      console.log(`[股吧] 开始爬取 ${stock_code} 第 ${page}/${targetPages} 页...`)
      const pageData = await crawlGubaSinglePage(stock_code, page, page_size)
      crawledPosts.push(...pageData)
      successPages++
      
      // 分页间隔（最后一页无需延迟）
      if (page < targetPages) {
        await delay(CONFIG.PAGE_DELAY)
      }
    } catch (pageError) {
      console.error(`[股吧] 第 ${page} 页爬取失败:`, pageError.message)
      // 单页失败继续下一页，不中断整体流程
    }
  }
  
  // 去重+限制返回条数（避免数据量过大）
  const uniquePosts = deduplicateByTitle(crawledPosts, 'post_title')
  const resultData = uniquePosts.slice(0, targetPages * page_size)
  
  // 批量写入数据库（优化性能）
  if (resultData.length > 0) {
    await batchSaveToDB(`post`, resultData, CONFIG.DB_BATCH_LIMIT)
  }
  
  return { 
    count: resultData.length, 
    data: resultData, 
    pages: successPages 
  }
}

// 股吧单页爬取函数
async function crawlGubaSinglePage(stock_code, page, page_size) {
  const url = `${URL_TEMPLATES.guba.replace('{stock_code}', stock_code)}?page=${page}`
  const posts = []
  
  try {
    // 带重试的请求
    const response = await axiosWithRetry(url)
    const $ = cheerio.load(response.data)
    
    // 解析帖子列表（适配东财股吧两种DOM结构）
    $('.articleh, .normal_post').slice(0, page_size).each((index, element) => {
      try {
        const $el = $(element)
        const title = $el.find('.l3 a, .title a').text().trim()
        const readCount = $el.find('.l1').text().trim() || '0'
        const commentCount = $el.find('.l2').text().trim() || '0'
        const author = $el.find('.l4 a').text().trim() || '未知'
        const postTime = $el.find('.l5').text().trim() || new Date().toLocaleString('zh-CN')
        
        if (title) {
          posts.push({
            post_title: title,
            read_count: parseInt(readCount) || 0,
            comment_count: parseInt(commentCount) || 0,
            author: author,
            post_time: postTime,
            post_date: new Date().toISOString().split('T')[0],
            stock_code: stock_code,
            crawl_time: new Date() // 记录爬取时间
          })
        }
      } catch (e) {
        console.error(`[股吧] 解析第 ${index + 1} 条帖子失败:`, e)
      }
    })
    
    console.log(`[股吧] 第 ${page} 页解析出 ${posts.length} 条有效帖子`)
    return posts
    
  } catch (error) {
    console.error(`[股吧] 第 ${page} 页请求失败:`, error.message)
    throw error // 抛出错误让上层处理
  }
}

// 安全的新闻爬取（支持指定页数）
async function crawlNewsSafely(stock_code, stock_name, targetPages, page_size) {
  const crawledNews = []
  let successPages = 0
  
  for (let page = 1; page <= targetPages; page++) {
    try {
      console.log(`[新闻] 开始爬取 ${stock_name} 第 ${page}/${targetPages} 页...`)
      const pageData = await crawlNewsSinglePage(stock_name, page, page_size)
      crawledNews.push(...pageData)
      successPages++
      
      if (page < targetPages) {
        await delay(CONFIG.PAGE_DELAY)
      }
    } catch (pageError) {
      console.error(`[新闻] 第 ${page} 页爬取失败:`, pageError.message)
    }
  }
  
  // 去重+限制返回条数
  const uniqueNews = deduplicateByTitle(crawledNews, 'news_title')
  const resultData = uniqueNews.slice(0, targetPages * page_size)
  
  // 批量写入数据库
  if (resultData.length > 0) {
    await batchSaveToDB(`news`, resultData, CONFIG.DB_BATCH_LIMIT)
  }
  
  return {
    count: resultData.length,
    data: resultData,
    pages: successPages
  }
}

// 新闻单页爬取函数
async function crawlNewsSinglePage(stock_name, page, page_size) {
  const url = URL_TEMPLATES.news.replace('{stock_name}', encodeURIComponent(stock_name)).replace('{page}', page)
  const newsList = []
  
  try {
    const response = await axiosWithRetry(url)
    const $ = cheerio.load(response.data)
    
    // 解析东方财富新闻列表（适配实际DOM结构）
    $('.news-item, .article-item').slice(0, page_size).each((index, element) => {
      try {
        const $el = $(element)
        const title = $el.find('h3 a, .title a').text().trim()
        const source = $el.find('.source').text().trim() || '未知来源'
        const publishTime = $el.find('.time').text().trim() || new Date().toLocaleString('zh-CN')
        const link = $el.find('h3 a, .title a').attr('href') || ''
        
        if (title) {
          newsList.push({
            news_title: title,
            news_source: source,
            publish_time: publishTime,
            news_url: link.startsWith('http') ? link : `http:${link}`,
            stock_name: stock_name,
            crawl_time: new Date()
          })
        }
      } catch (e) {
        console.error(`[新闻] 解析第 ${index + 1} 条新闻失败:`, e)
      }
    })
    
    console.log(`[新闻] 第 ${page} 页解析出 ${newsList.length} 条有效新闻`)
    return newsList
    
  } catch (error) {
    console.error(`[新闻] 第 ${page} 页请求失败:`, error.message)
    throw error
  }
}

// 带重试的axios请求（通用）
async function axiosWithRetry(url) {
  let lastError
  
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES + 1; attempt++) {
    try {
      return await axios.get(url, {
        headers: getHeaders(),
        timeout: CONFIG.REQUEST_TIMEOUT
      })
    } catch (error) {
      lastError = error
      if (attempt <= CONFIG.MAX_RETRIES) {
        console.log(`请求失败，第 ${attempt} 次重试（${url}）...`)
        await delay(CONFIG.REQUEST_DELAY)
      }
    }
  }
  
  throw lastError
}

// 工具函数：请求头生成
function getHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.eastmoney.com/',
    'Cache-Control': 'no-cache'
  }
}

// 工具函数：延迟
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 工具函数：按标题去重
function deduplicateByTitle(data, titleKey) {
  const titleSet = new Set()
  return data.filter(item => {
    if (titleSet.has(item[titleKey])) return false
    titleSet.add(item[titleKey])
    return true
  })
}

// 工具函数：批量写入数据库
async function batchSaveToDB(collectionName, data, batchLimit) {
  const batch = db.batch()
  let count = 0
  
  for (const item of data) {
    batch.add({ data: item })
    count++
    
    // 达到批次限制或最后一条时执行
    if (count % batchLimit === 0 || count === data.length) {
      try {
        await batch.commit()
        console.log(`批量写入 ${collectionName} 成功，条数：${count}`)
      } catch (dbError) {
        console.error(`批量写入 ${collectionName} 失败:`, dbError.message)
      }
      // 重置批次
      batch = db.batch()
    }
  }
}