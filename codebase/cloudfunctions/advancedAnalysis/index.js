// 高级舆情分析云函数 - 实现词云和SKEP情感分析（含数据库写入）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 引入并初始化PaddleHub SKEP模型（中文情感分析）
let hub;
let skepModel;
try {
  hub = require('@paddlehub/nodejs');
  // 加载SKEP情感分析模型（senta_skept为中文情感分类模型）
  skepModel = new hub.Module({ name: 'senta_skept' });
} catch (e) {
  console.error('PaddleHub/SKEP模型加载失败（需确保云函数已安装依赖）:', e.message);
}

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {string|Date} date 原始日期
 * @returns {string} 格式化后的日期字符串，无效则返回空
 */
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

/**
 * SKEP情感分析核心方法：给文本打0-1分（0.5为中性）
 * @param {string} text 待分析文本（标题）
 * @returns {number} 情感得分（0-1，越接近1越积极，越接近0越消极）
 */
async function getSkepSentimentScore(text) {
  // 空文本直接返回中性分
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return 0.5;
  }
  // 模型未加载成功返回中性分
  if (!skepModel) {
    console.warn('SKEP模型未加载，文本返回中性分:', text);
    return 0.5;
  }
  try {
    // 调用SKEP模型预测，返回积极/消极概率
    const result = await skepModel.predict([text.trim()], {
      batchSize: 1,
      use_gpu: false, // 云函数无GPU，强制使用CPU
      return_prob: true // 返回概率值，用于转换0-1得分
    });
    // 解析积极概率作为最终得分（0-1），保留3位小数
    if (result?.length > 0 && result[0].positive) {
      const score = Number(result[0].positive.toFixed(3));
      // 确保得分在0-1区间内
      return Math.max(0, Math.min(1, score));
    } else {
      console.warn('SKEP模型返回格式异常，文本返回中性分:', text);
      return 0.5;
    }
  } catch (e) {
    console.error('SKEP情感分析失败，文本返回中性分:', text, '错误:', e.message);
    return 0.5;
  }
}

/**
 * 批量为数据添加情感得分，并写入数据库
 * @param {Array} dataList 数据列表（股评/新闻）
 * @param {string} collectionName 数据库集合名（post/news）
 */
async function batchUpdateSentimentScore(dataList, collectionName) {
  if (!dataList.length) return;
  
  // 批量更新数据库（每10条一组，避免单次更新过多）
  const batchSize = 10;
  for (let i = 0; i < dataList.length; i += batchSize) {
    const batch = db.batch();
    const batchData = dataList.slice(i, i + batchSize);
    
    for (const item of batchData) {
      // 跳过无_id的数据（数据库必须有主键）
      if (!item._id) continue;
      // 生成情感得分（股评取post_title，新闻取news_title）
      const title = collectionName === 'post' ? item.post_title : item.news_title;
      const sentimentScore = await getSkepSentimentScore(title);
      
      // 构建更新指令，写入sentiment_score字段
      batch.update(
        db.collection(collectionName).doc(item._id),
        { sentiment_score: sentimentScore }
      );
      // 同步更新内存中数据的得分（用于后续分析）
      item.sentiment_score = sentimentScore;
    }
    
    // 执行批量更新
    await batch.commit();
    console.log(`已为${collectionName}集合${i}-${i+batchSize}条数据写入情感得分`);
  }
}

exports.main = async (event) => {
  // 兼容多种前端参数命名
  const stock_code = event.stock_code || event.stock || event.stockCode
  const start_date = event.start_date || event.start || event.startDate
  const end_date = event.end_date || event.end || event.endDate
  console.log('advancedAnalysis 收到参数:', { stock_code, start_date, end_date, rawEvent: event })
  
  try {
    console.log('开始高级舆情分析:', { stock_code, start_date, end_date })
    
    // 1. 校验股票代码必填
    if (!stock_code) {
      return {
        status: 'error',
        message: '股票代码不能为空'
      }
    }

    // 2. 校验开始日期必填 + 处理结束日期默认值
    const formattedStartDate = formatDate(start_date)
    if (!formattedStartDate) {
      return {
        status: 'error',
        message: '开始日期不能为空且格式需为有效日期（如：2025-12-01）'
      }
    }
    const formattedEndDate = formatDate(end_date) || formatDate(new Date())
    console.log('最终日期范围:', { start: formattedStartDate, end: formattedEndDate })
    
    // 3. 构建查询条件
    const postsQuery = {
      stock_code: stock_code,
      post_date: { 
        $gte: formattedStartDate,
        $lte: formattedEndDate 
      }
    }
    const newsQuery = {
      stock_code: stock_code,
      news_date: { 
        $gte: formattedStartDate,
        $lte: formattedEndDate 
      }
    }
    
    console.log('构建的查询条件:')
    console.log('股评查询:', postsQuery)
    console.log('新闻查询:', newsQuery)
    
    // 从云数据库获取数据
    const postsCollection = db.collection(`post`)
    const newsCollection = db.collection(`news`)
    const [postsRes, newsRes] = await Promise.all([
      postsCollection.where(postsQuery).limit(100).get(),
      newsCollection.where(newsQuery).limit(50).get()
    ])
    
    let posts = postsRes.data
    let news = newsRes.data
    console.log(`获取到数据: ${posts.length}条股评, ${news.length}条新闻`)

    // 4. 核心新增：批量生成情感得分并写入数据库
    if (posts.length > 0) {
      await batchUpdateSentimentScore(posts, 'post');
    }
    if (news.length > 0) {
      await batchUpdateSentimentScore(news, 'news');
    }
    console.log('SKEP情感得分已全部写入数据库sentiment_score字段')
    
    // 5. 原有词频统计逻辑（基于带得分的数据）
    const wordFreq = {}
    const allTexts = [
      ...posts.map(p => p.post_title || ''),
      ...news.map(n => n.news_title || '')
    ].filter(text => text && text.trim())
    
    const stopWords = ['的', '了', '和', '是', '在', '我', '有', '你', '这', '就', '要', '也', '会', '不', '人', '都', '一个', '上', '中', '到', '说', '可以', '等', '吧', '啊', '呀', '呢', '吗']
    allTexts.forEach(text => {
      const words = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
                       .split(/\s+/)
                       .filter(word => word.length > 1 && !stopWords.includes(word))
      words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1
      })
    })

    const maxCount = Math.max(...Object.values(wordFreq), 1)
    const wordCloudData = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ 
        word: word, 
        count: count,
        x: Math.random() * 0.8 + 0.1,
        y: Math.random() * 0.8 + 0.1,
        fontSize: 12 + (count / maxCount) * 12,
        rotate: Math.floor(Math.random() * 3) * (-15 + Math.random() * 30)
      }))
    
    // 6. 基于数据库写入的得分计算情感分布
    const sentimentData = generateSentimentDistribution(posts, news)
    const allScores = [
      ...posts.map(p => parseFloat(p.sentiment_score) || 0.5),
      ...news.map(n => parseFloat(n.sentiment_score) || 0.5)
    ]
    const avgSentiment = allScores.length ? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : 0.5
    
    return {
      status: 'success',
      message: '舆情分析完成（含SKEP情感得分写入）',
      data: {
        stock_code,
        date_range: {
          start: formattedStartDate,
          end: formattedEndDate
        },
        summary: {
          total_posts: posts.length,
          total_news: news.length,
          avg_sentiment: avgSentiment.toFixed(3),
          positive_percent: sentimentData.positivePercent || '0.0'
        },
        word_cloud: wordCloudData,
        sentiment_distribution: sentimentData,
        sample_data: {
          posts: posts.slice(0, 5),
          news: news.slice(0, 3)
        }
      }
    }
    
  } catch (error) {
    console.error('舆情分析失败:', error)
    return {
      status: 'error',
      message: '分析失败: ' + error.message
    }
  }
}

// 生成情感分布数据（基于SKEP得分）
function generateSentimentDistribution(posts, news) {
  const allScores = [
    ...posts.map(p => parseFloat(p.sentiment_score) || 0.5),
    ...news.map(n => parseFloat(n.sentiment_score) || 0.5)
  ]

  if (!allScores.length) {
    return { positive: 0, negative: 0, neutral: 0, total: 0, positivePercent: '0.0' }
  }

  // 0.5为中性，>0.6积极，<0.4消极
  const positive = allScores.filter(score => score > 0.6).length
  const negative = allScores.filter(score => score < 0.4).length
  const neutral = allScores.length - positive - negative

  return {
    positive,
    negative, 
    neutral,
    total: allScores.length,
    positivePercent: ((positive / allScores.length) * 100).toFixed(1)
  }
}