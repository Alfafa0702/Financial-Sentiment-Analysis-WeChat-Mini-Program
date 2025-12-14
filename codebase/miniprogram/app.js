// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      //   env 参数决定小程序发起的云调用（wx.cloud.xxx）默认使用哪个云环境
      //   在「微信开发者工具」-> 云开发 -> 环境列表 中可查看环境 ID
      //   将以下字符串替换为你的环境 ID，例：'prod-123abc'
      //   如果你希望不配置（使用默认环境），将 env 设为空字符串即可，但某些示例会提示配置 env
      env: "cloud1-7gk1o9yh7b4b8474"
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
