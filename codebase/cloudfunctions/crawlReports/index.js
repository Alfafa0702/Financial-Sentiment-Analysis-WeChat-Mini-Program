const cloud = require('wx-server-sdk')
let axios, cheerio, PDFDocument
try {
  axios = require('axios')
} catch (e) {
  console.error('require axios failed', e && e.stack ? e.stack : e)
}
try {
  cheerio = require('cheerio')
} catch (e) {
  console.error('require cheerio failed', e && e.stack ? e.stack : e)
}
try {
  PDFDocument = require('pdfkit')
} catch (e) {
  console.warn('pdfkit not available, PDF generation will be skipped', e && e.stack ? e.stack : e)
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')

// 配置项
const CONFIG = {
  PDF_DOWNLOAD_TIMEOUT: 30000, // PDF下载超时时间（30秒）
  MAX_PDF_SIZE: 10 * 1024 * 1024, // 最大PDF文件大小（10MB）
  TEMP_DIR: os.tmpdir() // 临时文件目录
}

/**
 * 下载PDF文件到临时目录
 * @param {string} pdfUrl PDF文件链接
 * @param {string} filename 保存的文件名
 * @returns {string} 临时文件路径
 */
async function downloadPDF(pdfUrl, filename) {
  if (!pdfUrl || pdfUrl === '#') return null
  
  // 处理文件名特殊字符
  const safeFilename = filename.replace(/[\\/:*?"<>|]/g, '_')
  const tempPath = path.join(CONFIG.TEMP_DIR, safeFilename)
  
  try {
    const response = await axios({
      method: 'GET',
      url: pdfUrl,
      responseType: 'stream',
      timeout: CONFIG.PDF_DOWNLOAD_TIMEOUT,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    // 检查文件大小
    const contentLength = response.headers['content-length']
    if (contentLength && parseInt(contentLength) > CONFIG.MAX_PDF_SIZE) {
      console.error(`PDF文件过大：${filename}，大小：${contentLength}字节`)
      return null
    }

    // 写入临时文件
    const writer = fs.createWriteStream(tempPath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      let receivedSize = 0
      
      response.data.on('data', (chunk) => {
        receivedSize += chunk.length
        if (receivedSize > CONFIG.MAX_PDF_SIZE) {
          writer.destroy()
          reject(new Error(`PDF文件超过大小限制：${CONFIG.MAX_PDF_SIZE}字节`))
        }
      })
      
      writer.on('finish', () => resolve(tempPath))
      writer.on('error', (err) => {
        fs.unlink(tempPath, () => {}) // 删除损坏的临时文件
        reject(err)
      })
    })
  } catch (error) {
    console.error(`下载PDF失败：${filename}`, error.message)
    // 清理临时文件
    if (fs.existsSync(tempPath)) {
      fs.unlink(tempPath, () => {})
    }
    return null
  }
}

/**
 * 上传PDF文件到微信云存储
 * @param {string} stockName 股票名称
 * @param {string} localPath 本地文件路径
 * @param {string} filename 云存储文件名
 * @returns {string} 云存储文件ID
 */
async function uploadPDFToCloud(stockName, localPath, filename) {
  if (!localPath || !fs.existsSync(localPath)) return null
  
  // 处理股票名称特殊字符
  const safeStockName = stockName.replace(/[\\/:*?"<>|]/g, '_')
  const cloudPath = `研报PDF/${safeStockName}/${filename}`
  
  try {
    // 上传文件到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: fs.createReadStream(localPath)
    })
    
    console.log(`PDF上传成功：${cloudPath}，fileID：${uploadResult.fileID}`)
    return uploadResult.fileID
  } catch (error) {
    console.error(`上传PDF到云存储失败：${cloudPath}`, error.message)
    return null
  } finally {
    // 删除临时文件
    fs.unlink(localPath, (err) => {
      if (err) console.warn(`删除临时文件失败：${localPath}`, err.message)
    })
  }
}

async function fetchUrl(url) {
  if (!axios) {
    console.error('axios is not available, cannot fetch url')
    return ''
  }
  
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    return response.data
  } catch (error) {
    console.error(`fetchUrl failed: ${url}`, error.message)
    return ''
  }
}

function extractListLinks(html) {
  if (cheerio) {
    const $ = cheerio.load(html)
    const items = $('.notice_item, .notice_item_t')
    const arr = []
    items.each((i, el) => {
      if (arr.length >= 10) return
      const a = $(el).find('a').first()
      let href = a.attr('href') || ''
      href = href.trim()
      if (href && !href.startsWith('http')) href = 'http:' + href
      if (href) arr.push(href)
    })
    if (arr.length) return arr
  }
  // regex fallback
  const re = /<div class="notice_item_t"[\s\S]*?<a href="(.*?)"/g
  const arr = []
  let m
  while ((m = re.exec(html)) && arr.length < 10) {
    let href = m[1]
    if (href && !href.startsWith('http')) href = 'http:' + href
    arr.push(href)
  }
  return arr
}

function extractDetailInfo(html, url) {
  if (cheerio) {
    const $ = cheerio.load(html)
    const title = $('h1#zw-title').text().trim() || $('title').text().trim() || url
    let pdf = $('a.pdf-link').attr('href') || $('a[class*=pdf]').attr('href') || ''
    if (!pdf) {
      const pdfRe = /href="(.*?\.pdf(\?[^"]*)?)"/i
      const m = pdfRe.exec(html)
      if (m) pdf = m[1]
    }
    if (pdf && pdf.indexOf('http') !== 0) pdf = pdf.startsWith('//') ? ('http:' + pdf) : ('http:' + pdf)
    return { title, pdf }
  }
  // regex fallback
  const tRe = /<h1[^>]*id="zw-title"[^>]*>([^<]*)<\//i
  const titleMatch = tRe.exec(html)
  const title = (titleMatch && titleMatch[1].trim()) || ( /<title>(.*?)<\/title>/.exec(html) || [null, url])[1]
  const pdfRe = /href="(.*?\.pdf(\?[^"]*)?)"/i
  const m = pdfRe.exec(html)
  const pdf = m ? (m[1].startsWith('http') ? m[1] : ('http:' + m[1])) : ''
  return { title, pdf }
}

// 爬取东方财富研报
// 输入: { stock: '600036', name: '招商银行', pages: 1 }
// 输出: { status: 'ok', data: [ { report_title, report_url, download_time, cloud_file_id } ] }
exports.main = async (event, context) => {
  const ev = event || {};
  const stock = (ev.stock || '').toString().trim();
  const name = (ev.name || '').toString().trim();
  const pages = Number(ev.pages) || 1;

  console.log('crawlReports invoked with', { stock, name, pages });

  if (!name) {
    console.error('crawlReports missing name');
    return { status: 'error', message: '缺少股票名称 (name)' };
  }

  if (!axios || !cheerio) {
    console.warn('Required modules missing, will use native fallbacks', { axios: !!axios, cheerio: !!cheerio });
  }

  const results = [];
  try {
    // 第一步：遍历分页，收集研报详情页链接
    for (let p = 1; p <= pages; p++) {
      const url = `http://so.eastmoney.com/Yanbao/s?keyword=${encodeURIComponent(name)}&pageindex=${p}`;
      const html = await fetchUrl(url);
      const links = extractListLinks(html);
      for (const href of links) {
        if (results.length >= 10) break; // 最多收集10个链接
        if (href) results.push({ detail_url: href });
      }
      if (results.length >= 10) break;
    }

    // 第二步：遍历详情页，提取标题和PDF链接，并上传到云存储
    const out = [];
    for (let i = 0; i < results.length && out.length < 10; i++) {
      const durl = results[i].detail_url;
      try {
        const r = await axios.get(durl, { 
          timeout: 15000, 
          headers: { 'User-Agent': 'Mozilla/5.0' } 
        });
        const $ = cheerio.load(r.data);
        // 提取标题
        let title = $('h1#zw-title').text().trim() || $('title').text().trim();
        // 提取PDF链接
        let pdf = $('a.pdf-link').attr('href') || $('a[class*=pdf]').attr('href') || '';
        if (!pdf) {
          // 正则匹配页面中隐藏的PDF链接
          const pdfRe = /href="(.*?\.pdf(\?[^\"]*)?)"/i;
          const m = pdfRe.exec(r.data);
          if (m) pdf = m[1];
        }
        // 补全PDF链接的协议头
        if (pdf) {
          if (pdf.indexOf('http') !== 0) {
            pdf = pdf.startsWith('//') ? `http:${pdf}` : `http://${pdf}`;
          }
        }

        // 组装基础数据
        const reportTitle = `${title}.pdf`;
        const downloadTime = new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).replace(/\//g, '-');

        // 下载PDF并上传到云存储
        let cloudFileID = null;
        if (pdf && pdf !== '#') {
          const tempFilePath = await downloadPDF(pdf, reportTitle);
          if (tempFilePath) {
            cloudFileID = await uploadPDFToCloud(name, tempFilePath, reportTitle);
          }
        }

        // 推送最终数据（包含云存储文件ID）
        if (title) {
          out.push({
            report_title: reportTitle,
            report_url: pdf || '#',
            download_time: downloadTime,
            cloud_file_id: cloudFileID || '' // 云存储文件ID，无则为空
          });
        }
      } catch (innerErr) {
        // 内层错误：单个详情页爬取/上传失败，不中断整体流程
        console.error(`爬取/上传详情页失败 ${durl}`, innerErr.message);
        continue; // 跳过当前错误的链接，继续下一个
      }
    }

    console.log('crawlReports finished, found', out.length);
    return { status: 'ok', data: out };

  } catch (outerErr) {
    // 外层错误：分页爬取的核心逻辑失败
    console.error('crawlReports core error', outerErr.stack || outerErr);
    return { status: 'error', message: outerErr.message || String(outerErr) };
  }
};