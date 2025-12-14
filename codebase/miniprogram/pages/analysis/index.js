// pages/analysis/index.js
// 引入 wordCloud 模块
import wordCloud from "../../echarts-wordcloud/wordCloud";

// 配置 wordCloud
wordCloud({
  createCanvas: function () {
    return wx.createOffscreenCanvas({
      type: "2d",
    });
  },
});

Page({
  data: {
    stock: '',
    startDate: '',
    endDate: '',
    loading: false,
    error: false,
    errorMsg: '',
    detailedError: '',
    showDetailedError: false,
    hasResults: false,
    wordList: [],
    skep: { pos_avg: 0, neg_avg: 0 },
    post_count: 0,
    news_count: 0,
    positivePercent: '0.0',
    sentimentData: { positive: 0, negative: 0, neutral: 0 }
  },

  onStockInput(e) {
    this.setData({ stock: e.detail.value })
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
  },

  runAnalysis() {
    let { stock, startDate, endDate } = this.data
    const msInDay = 1000 * 60 * 60 * 24
    
    // 验证输入
    if (!stock) {
      this.setData({ error: true, errorMsg: '请输入股票代码' })
      return
    }
    if (!/^\d{6}$/.test(stock)) {
      this.setData({ error: true, errorMsg: '请输入6位股票代码' })
      return
    }
    if (!startDate) {
      this.setData({ error: true, errorMsg: '请填写开始日期' })
      return
    }

    // If endDate missing, default to today
    const pad = (n) => n < 10 ? '0' + n : String(n)
    const today = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    })()
    if (!endDate) {
      endDate = today
      this.setData({ endDate })
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate)) {
      this.setData({ error: true, errorMsg: '开始日期格式无效，示例: 2025-01-01' })
      return
    }
    if (!dateRegex.test(endDate)) {
      this.setData({ error: true, errorMsg: '结束日期格式无效，示例: 2025-01-07' })
      return
    }
    if (startDate > endDate) {
      this.setData({ error: true, errorMsg: '开始日期不能晚于结束日期' })
      return
    }

    // Enforce max 30-day interval
    function parseYMD(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
    const a = parseYMD(startDate)
    const b = parseYMD(endDate)
    const diffDays = Math.floor((b - a) / msInDay)
    if (diffDays > 30) {
      this.setData({ error: true, errorMsg: '选择的日期区间不能超过 30 天' })
      return
    }

    this.setData({ loading: true, error: false, errorMsg: '', hasResults: false })

    wx.cloud.callFunction({
      name: 'advancedAnalysis',
      data: { 
        stock_code: stock,
        // 兼容后端可能使用的不同参数名
        start_date: startDate,
        end_date: endDate,
        start: startDate,
        end: endDate
      },
      success: (res) => {
        const r = res.result
        if (r && r.status === 'success') {
          // 确保数据正确性
          const totalPosts = r.data.summary?.total_posts || 0
          const totalNews = r.data.summary?.total_news || 0
          const positivePercent = r.data.summary?.positive_percent || '0.0'
          
          // 验证并修复可能的NaN值
          const safePositivePercent = isNaN(positivePercent) ? '0.0' : positivePercent
          
          console.log('分析结果:', {
            wordCloud: r.data.word_cloud,
            sentiment: r.data.sentiment_distribution,
            summary: r.data.summary,
            counts: { posts: totalPosts, news: totalNews },
            positivePercent: safePositivePercent
          })

          this.setData({
            wordList: r.data.word_cloud || [],
            sentimentData: r.data.sentiment_distribution || { positive: 0, negative: 0, neutral: 0 },
            post_count: totalPosts,  // 使用云函数返回的确切数量
            news_count: totalNews,  // 使用云函数返回的确切数量
            positivePercent: safePositivePercent,
            hasResults: true
          })
          
          // 添加调试信息（避免在微信环境使用未定义的 process）
          if (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV === 'development') {
            console.log('详细数据:', {
              rawData: r.data,
              posts: r.data.sample_data?.posts,
              news: r.data.sample_data?.news
            })
          }
          
          // 延迟绘制确保数据已设置
          setTimeout(() => {
            this.drawCharts(r.data)
          }, 100)
        } else if (r && r.status === 'no_data') {
          console.log('无数据:', r.message)
          this.setData({ 
            error: true, 
            errorMsg: r.message || '无数据', 
            detailedError: r.message || '' 
          })
        } else {
          console.error('分析失败:', r)
          this.setData({ 
            error: true, 
            errorMsg: r && r.message ? '分析失败' : '未知错误', 
            detailedError: r && r.message ? r.message : '' 
          })
        }
      },
      fail: (err) => {
        console.error('云函数调用失败:', err)
        this.setData({ 
          error: true, 
          errorMsg: '云函数调用失败', 
          detailedError: err.errMsg || '' 
        })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  // 绘制图表
  drawCharts(data) {
    console.log('开始绘制图表，词云数据:', data.word_cloud)
    console.log('开始绘制图表，情感数据:', data.sentiment_distribution)
    this.drawWordCloud(data.word_cloud)
    this.drawHistogram(data.sentiment_distribution)
  },

  // 绘制词云（用 Canvas 绘制）
    drawWordCloud(wordList) {
    console.log('绘制词云（降级 Canvas 实现）:', wordList)

    const ctx = wx.createCanvasContext('wordcloudCanvas')
    const width = 300
    const height = 200
    // 清空画布
    ctx.clearRect(0, 0, width, height)

    const list = (wordList || [])
      .filter(w => (w.word || w.name) && ((w.count || w.value || 0) > 0))
      .map(w => ({
        word: w.word || w.name,
        count: w.count || w.value || 1,
        x: typeof w.x === 'number' ? w.x : Math.random() * 0.8 + 0.1,
        y: typeof w.y === 'number' ? w.y : Math.random() * 0.8 + 0.1,
        fontSize: w.fontSize || (12 + (w.count || w.value || 1)),
        rotate: typeof w.rotate === 'number' ? w.rotate : 0
      }))

    if (list.length === 0) {
      ctx.setFontSize(14)
      ctx.setFillStyle('#666')
      ctx.fillText('无词云数据', 100, 100)
      ctx.draw()
      return
    }

    // 计算字体大小范围并绘制
    const maxFs = Math.max(...list.map(i => i.fontSize))
    const minFs = Math.min(...list.map(i => i.fontSize))

    list.forEach(item => {
      const fs = item.fontSize
      // 基于归一化字体大小做微调
      const norm = (fs - minFs) / (maxFs - minFs || 1)
      const drawFs = 12 + norm * 24

      ctx.save()
      ctx.setFontSize(drawFs)
      // 确保生成合法的 6 位 hex 颜色
      const rand = Math.floor(Math.random() * 16777215)
      const colorHex = ('000000' + rand.toString(16)).slice(-6)
      ctx.setFillStyle('#' + colorHex)
      const tx = Math.round(item.x * width)
      const ty = Math.round(item.y * height)
      // 旋转（角度为度数）
      if (item.rotate) {
        const rad = (item.rotate * Math.PI) / 180
        ctx.translate(tx, ty)
        ctx.rotate(rad)
        ctx.fillText(item.word, 0, 0)
      } else {
        ctx.fillText(item.word, tx, ty)
      }
      ctx.restore()
    })

    ctx.draw()
  },

  // 绘制直方图
    drawHistogram(sentimentData) {
    console.log('绘制直方图:', sentimentData)
    const ctx = wx.createCanvasContext('histogramCanvas')
    // 先清空画布
    ctx.clearRect(0, 0, 300, 200)
    ctx.draw(true, () => {
        // 原有直方图逻辑全部放到这里面
        if (!sentimentData || 
            typeof sentimentData.positive !== 'number' || 
            typeof sentimentData.neutral !== 'number' || 
            typeof sentimentData.negative !== 'number') {
        ctx.setFontSize(14)
        ctx.setFillStyle('#666')
        ctx.fillText('无情感分布数据', 100, 100)
        ctx.draw()
        return
        }
        
        const categories = ['积极', '中性', '消极']
        const values = [sentimentData.positive, sentimentData.neutral, sentimentData.negative]
        const colors = ['#1AAD19', '#F0AD4E', '#D9534F']
        
        const validValues = values.map(v => {
        const num = Number(v)
        return isNaN(num) ? 0 : num
        })
        
        const maxValue = Math.max(...validValues)
        const barWidth = 60
        
        if (maxValue === 0) {
        ctx.setFontSize(14)
        ctx.setFillStyle('#666')
        ctx.fillText('无有效情感数据', 100, 100)
        ctx.draw()
        return
        }
        
        validValues.forEach((value, index) => {
        const barHeight = (value / maxValue) * 120
        const x = index * 80 + 30
        const y = 180 - barHeight
        
        ctx.setFillStyle(colors[index])
        ctx.fillRect(x, y, barWidth, barHeight)
        
        ctx.setFontSize(12)
        ctx.setFillStyle('#333')
        ctx.fillText(categories[index], x + 15, 195)
        ctx.fillText(value.toString(), x + 25, y - 5)
        })
        
        ctx.draw()
    })
    },
  
  toggleDetailedError() {
    this.setData({ showDetailedError: !this.data.showDetailedError })
  },
  
  copyDetailedError() {
    const data = this.data.detailedError || ''
    if (!data) return
    wx.setClipboardData({ data, success: () => { wx.showToast({ title: '已复制', icon: 'success' }) } })
  }
})