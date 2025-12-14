// pages/crawler/index.js
Page({
  data: {
    loading: false,
    progress: 0,
    status: '',
    results: [],
    showDetail: false,
    crawlTypes: ['posts', 'news'],
    pages: 2,
    stockCode: '',
    stockName: ''
  },

  onLoad() {
    // 页面加载时初始化
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type
    const index = this.data.crawlTypes.indexOf(type)
    let newTypes = [...this.data.crawlTypes]
    
    if (index > -1) {
      newTypes.splice(index, 1)
    } else {
      newTypes.push(type)
    }
    
    this.setData({ crawlTypes: newTypes })
  },

  onPagesChange(e) {
    this.setData({ pages: parseInt(e.detail.value) || 2 })
  },


  onStockCodeInput(e) {
    this.setData({ stockCode: e.detail.value })
  },

  onStockNameInput(e) {
    this.setData({ stockName: e.detail.value })
  },

  startCrawling() {
    if (this.data.loading) return
    
    const { stockCode, stockName, crawlTypes, pages } = this.data
    
    if (!stockCode) {
      wx.showToast({
        title: '请输入股票代码',
        icon: 'none'
      })
      return
    }

    if (crawlTypes.includes('news') && !stockName) {
      wx.showToast({
        title: '新闻爬取需要股票名称',
        icon: 'none'
      })
      return
    }
    
    this.setData({ 
      loading: true, 
      progress: 0,
      status: `开始爬取股票 ${stockCode} 数据...`,
      results: []
    })

    wx.cloud.callFunction({
      name: 'crawlStockData',
      data: {
        stock_code: stockCode,
        stock_name: stockName,
        data_types: crawlTypes,
        pages: pages
      },
      success: (res) => {
        const result = res.result
        if (result && result.status === 'success') {
          this.setData({
            status: `股票 ${stockCode} 爬取完成！`,
            results: [result.data]
          })
          
          wx.showToast({
            title: '爬取成功',
            icon: 'success'
          })
        } else {
          this.setData({
            status: result?.message || '爬取失败',
            results: []
          })
          
          wx.showToast({
            title: result?.message || '爬取失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('爬取失败:', err)
        const errorMsg = err.errMsg || '网络请求失败'
        this.setData({
          status: `爬取失败: ${errorMsg}`,
          results: []
        })
        
        wx.showToast({
          title: '爬取失败，请重试',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({ loading: false, progress: 100 })
      }
    })

    // 模拟进度更新
    this.simulateProgress()
  },

  simulateProgress() {
    let progress = 0
    const interval = setInterval(() => {
      if (progress >= 90 || !this.data.loading) {
        clearInterval(interval)
        return
      }
      progress += 5
      this.setData({ progress })
    }, 500)
  },

  toggleDetail() {
    this.setData({ showDetail: !this.data.showDetail })
  },

  viewDataStats() {
    if (this.data.results.length > 0) {
      wx.navigateTo({
        url: '/pages/analysis/index'
      })
    } else {
      wx.showToast({
        title: '请先爬取数据',
        icon: 'none'
      })
    }
  }
})