// index.js
Page({
  data: {
    showTip: false,
    title: "情绪知多少",
    subtitle: "舆情与研报智能分析",
    buttons: [
      { page: 'crawler', title: '数据采集', icon: '../../images/scf-enter.png' },
      { page: 'analysis', title: '舆情分析', icon: '../../images/ai_example1.png' },
      { page: 'download', title: '报告下载', icon: '../../images/create_cbr.png' },
    ],
    pressedIndex: null,
    content: ""
  },


  jumpPage(e) {
    const app = getApp()
    if(!app.globalData.env) {
      wx.showModal({
        title: '提示',
        content: '请在 `miniprogram/app.js` 中正确配置 `env` 参数（打开微信开发者工具 → 云开发 → 环境列表，复制 Environment ID 填入）'
      })
      return
    }
    const { page } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/${page}/index?envId=${app.globalData.env}`,
    });
  },

  onPressStart(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ pressedIndex: idx })
  },

  onPressEnd() {
    this.setData({ pressedIndex: null })
  },

  onPressCancel() {
    this.setData({ pressedIndex: null })
  },

});
