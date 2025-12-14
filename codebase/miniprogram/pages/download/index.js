// 小程序页面js
Page({
  // 获取研报列表
  getReportList(stockCode) {
    wx.cloud.callFunction({
      name: 'getReports',
      data: { stock: stockCode },
      success: res => {
        if (res.result.status === 'ok' && res.result.data.length) {
          this.setData({ reportList: res.result.data })
        }
      },
      fail: err => {
        wx.showToast({ title: '获取研报失败', icon: 'none' })
      }
    })
  },

  // 下载研报（核心方法）
  downloadReport(e) {
    const { url, title } = e.currentTarget.dataset
    if (url === '#') {
      wx.showToast({ title: '下载链接失效', icon: 'none' })
      return
    }

    wx.showLoading({ title: '准备下载...' })

    // 方案1：小程序直接下载（推荐，兼容所有端）
    wx.downloadFile({
      url: url, // 云函数返回的带签名链接
      header: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 保存文件到手机
          wx.saveFile({
            tempFilePath: res.tempFilePath,
            success: (saveRes) => {
              wx.hideLoading()
              wx.showToast({
                title: '下载成功',
                icon: 'success'
              })
              // 打开文件
              wx.openDocument({
                filePath: saveRes.savedFilePath,
                fileType: 'pdf',
                success: () => {},
                fail: (err) => {
                  wx.showToast({ title: '打开文件失败', icon: 'none' })
                }
              })
            },
            fail: (err) => {
              wx.hideLoading()
              wx.showToast({ title: '保存文件失败', icon: 'none' })
            }
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        // 兼容iOS/Android不同的失败场景
        if (err.errMsg.includes('timeout')) {
          wx.showToast({ title: '下载超时，请重试', icon: 'none' })
        } else {
          wx.showToast({ title: '下载失败', icon: 'none' })
        }
      }
    })
  }
})// 小程序页面js
Page({
  // 获取研报列表
  getReportList(stockCode) {
    wx.cloud.callFunction({
      name: 'getReports',
      data: { stock: stockCode },
      success: res => {
        if (res.result.status === 'ok' && res.result.data.length) {
          this.setData({ reportList: res.result.data })
        }
      },
      fail: err => {
        wx.showToast({ title: '获取研报失败', icon: 'none' })
      }
    })
  },

  // 下载研报（核心方法）
  downloadReport(e) {
    const { url, title } = e.currentTarget.dataset
    if (url === '#') {
      wx.showToast({ title: '下载链接失效', icon: 'none' })
      return
    }

    wx.showLoading({ title: '准备下载...' })

    // 方案1：小程序直接下载（推荐，兼容所有端）
    wx.downloadFile({
      url: url, // 云函数返回的带签名链接
      header: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 保存文件到手机
          wx.saveFile({
            tempFilePath: res.tempFilePath,
            success: (saveRes) => {
              wx.hideLoading()
              wx.showToast({
                title: '下载成功',
                icon: 'success'
              })
              // 打开文件
              wx.openDocument({
                filePath: saveRes.savedFilePath,
                fileType: 'pdf',
                success: () => {},
                fail: (err) => {
                  wx.showToast({ title: '打开文件失败', icon: 'none' })
                }
              })
            },
            fail: (err) => {
              wx.hideLoading()
              wx.showToast({ title: '保存文件失败', icon: 'none' })
            }
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        // 兼容iOS/Android不同的失败场景
        if (err.errMsg.includes('timeout')) {
          wx.showToast({ title: '下载超时，请重试', icon: 'none' })
        } else {
          wx.showToast({ title: '下载失败', icon: 'none' })
        }
      }
    })
  }
})