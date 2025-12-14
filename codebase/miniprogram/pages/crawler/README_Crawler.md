# 数据采集功能部署指南

## 📋 功能概述
本功能提供了完整的股票数据爬取能力，包括：
- 📊 股吧发帖数据爬取
- 📰 新闻资讯数据爬取  
- 🔄 批量自动化采集
- 💾 云数据库存储

## 🚀 快速开始

### 1. 安装依赖
```bash
# 进入云函数目录部署依赖
cd miniprogram-2/cloudfunctions

# 部署爬虫云函数
npm install --prefix crawlStockData
```

### 2. 上传云函数
在微信开发者工具中：
1. 右键点击 `cloudfunctions/crawlStockData` 目录
2. 选择「上传并部署：云端安装依赖」

### 3. 使用数据采集
1. 打开小程序
2. 点击「数据采集」进入采集页面
3. 选择爬取类型（发帖/新闻）
4. 设置爬取页数（1-5页）
5. 点击「开始爬取」

## 📊 数据存储结构

### 发帖数据集合：`post_{stock_code}`
```javascript
{
  comment: "帖子标题",
  read_count: 123,       // 阅读数
  comment_count: 45,     // 评论数
  author: "作者名",
  publish_time: "2025/01-01 12:00", // 发布时间
  date: "2025-01-01", // 发帖日期
  crawl_time: "ISO时间戳",
  stock_code: "600036"，
  stock_name: "招商银行"
}
```

### 新闻数据集合：`news_{stock_code}`
```javascript
{
  news_title: "新闻标题",
  news_date: "2025-01-01",
  stock_code: "600036",
  stock_name: "招商银行"
}
```

## 🎯 使用场景

### 单次数据采集
```javascript
// 调用单个爬虫函数
wx.cloud.callFunction({
  name: 'crawlPosts',
  data: { stock_code: '600036', pages: 3 }
})
```

### 批量数据采集  
```javascript
// 批量爬取所有配置股票
wx.cloud.callFunction({
  name: 'crawlAll',
  data: { 
    types: ['posts', 'news'],
    pages: 2
  }
})
```