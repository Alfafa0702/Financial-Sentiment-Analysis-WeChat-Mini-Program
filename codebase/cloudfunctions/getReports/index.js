// 云函数: getReports
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database() // 初始化数据库

/**
 * 处理文件名/目录名特殊字符（防止路径错误）
 * @param {string} name 原始名称/代码
 * @returns {string} 安全名称
 */
function getSafeName(name) {
  if (!name) return ''
  // 过滤云存储不支持的特殊字符
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

/**
 * 生成云存储文件的可下载临时链接
 *  
 * @param {string} fileID 云存储文件ID
 * @returns {string} 临时下载链接
 */
async function getDownloadLink(fileID) {
  if (!fileID) return '#'
  try {
    const res = await cloud.getTempFileURL({
      fileList: [fileID],
      refresh: true // 强制刷新，避免缓存过期链接
    })
    return res.fileList[0]?.tempFileURL || '#'
  } catch (err) {
    console.error(`生成下载链接失败 ${fileID}:`, err.message)
    return '#'
  }
}

/**
 * 从云存储查询指定目录下的所有PDF研报
 * @param {string} targetName 用户输入的股票代码/名称
 * @returns {Array} 研报列表
 */
async function getReportsFromCloud(targetName) {
  const safeName = getSafeName(targetName)
  if (!safeName) return []

  // 兼容两种目录场景：
  // 1. 按用户输入的原始值（代码/名称）命名的目录
  // 2. 特殊字符处理后的目录
  const targetDirs = [
    `研报PDF/${safeName}/`,          // 优先匹配处理后的目录
    `研报PDF/${targetName.trim()}/`   // 兼容未处理特殊字符的目录
  ]

  try {
    // 构建多目录匹配的正则
    const dirRegex = targetDirs.map(dir => dir.replace(/\//g, '\\/')).join('|')
    const fileRes = await db.collection('cloudfiles').where({
      cloudPath: db.RegExp({
        regexp: `^(${dirRegex}).*\\.pdf$`, // 匹配PDF文件
        options: 'i' // 忽略大小写
      })
    }).field({
      fileID: true,
      cloudPath: true,
      createTime: true
    }).get()

    if (!fileRes.data.length) return []

    // 批量处理文件信息，组装研报列表
    const reportList = []
    for (const file of fileRes.data) {
      const downloadUrl = await getDownloadLink(file.fileID)
      // 提取文件名（去掉目录前缀）
      const fullName = file.cloudPath.split('/').pop() || '未知研报.pdf'
      // 格式化文件上传时间为指定格式
      const formatTime = file.createTime 
        ? new Date(file.createTime).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          }).replace(/\//g, '-')
        : new Date().toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          }).replace(/\//g, '-')

      reportList.push({
        report_title: fullName,          // 研报标题（PDF文件名）
        report_url: downloadUrl,         // 可下载的临时链接
        download_time: formatTime,       // 下载/上传时间
        cloud_file_id: file.fileID       // 云存储文件ID（备用）
      })
    }

    // 按上传时间倒序排列（最新的研报在前）
    return reportList.sort((a, b) => new Date(b.download_time) - new Date(a.download_time))
  } catch (err) {
    console.error(`查询云存储研报失败:`, err.message)
    return []
  }
}

// 云函数主入口
exports.main = async (event, context) => {
  // 接收前端传入的股票代码/名称（兼容两种字段名）
  const stockCode = (event.stockCode || '').toString().trim()
  const stockName = (event.stockName || '').toString().trim()
  // 优先使用名称，无名称则用代码（前端保证至少传一个）
  const target = stockName || stockCode

  console.log('getReports 调用参数:', { stockCode, stockName, target })

  try {
    // 校验：必须传入代码或名称
    if (!target) {
      return {
        status: 'error',
        message: '请传入股票代码或股票名称'
      }
    }

    // 从云存储获取研报列表
    const reportData = await getReportsFromCloud(target)

    return {
      status: 'ok',
      message: `找到 ${reportData.length} 份研报`,
      data: reportData
    }
  } catch (e) {
    console.error('getReports 执行异常:', e)
    return {
      status: 'error',
      message: '获取研报失败: ' + (e.message || String(e))
    }
  }
}