# Friendly Financial Sentiment Analysis Mini Program

## Project Overview

Leveraging cloud computing technology, this project develops a cloud-based mini program for individual stock sentiment analysis, built on the cloud functions and cloud storage capabilities of the **WeChat Cloud Development Platform**. Focused on solving the core pain points of ordinary investors in public opinion analysis—low efficiency, complex operations, and high costs—the mini program provides an end-to-end service covering **public opinion collection, sentiment analysis with visualization, and research report downloading**, enabling non-professional users to easily access high-quality sentiment analysis support.

## Feature Introduction
![alt text](../asset/roadmap.png)
### 1. Real-time Crawling of Stock Reviews & News

For specified stock codes and names, it crawls posts from stock forums and news information from the East Money website, then stores the collected data in the cloud database.

### 2. Public Opinion Analysis

Based on the stock code and optional time range parameters passed from the frontend, it performs multi-dimensional sentiment analysis on stock reviews and news data, and returns structured results including key indicators such as high-frequency word cloud, sentiment tendency distribution, and comprehensive sentiment score.

### 3. Research Report & Financial Report Download

According to the stock code or name passed from the frontend, it crawls PDF versions of research reports, stores them in cloud storage, and provides temporary direct download links for users.

## Directory Structure

```Plain Text
    miniprogram-2/
    ├── cloudfunctions/       # Cloud function directory
    │   ├── advancedAnalysis/ # Advanced sentiment analysis cloud function
    │   ├── crawlReports/     # Research report crawling cloud function
    │   └── crawlStockData/   # Stock review & news crawling cloud function
    ├── miniprogram/          # Mini program frontend directory
    │   ├── components/       # Reusable public components
    │   ├── images/           # Image resource directory
    │   ├── pages/            # Page directory
    │   │   ├── analysis/     # Public opinion analysis page
    │   │   ├── download/     # Research report download page
    │   │   ├── index/        # Homepage
    │   │   └── crawler/      # Data collection page
    │   ├── app.js            # Mini program entry file
    │   ├── app.json          # Global configuration file
    │   └── app.wxss          # Global style sheet
    ├── project.config.json   # Project configuration file
    └── project.private.config.json # Project private configuration file
```

## Usage Guide

### 1. Development Environment Configuration

- Install WeChat Developer Tools and log in with your WeChat developer account

    - Download link: [https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) (Stable version is recommended)

- Import the project code into the developer tools

- Configure the Cloud Development Environment ID

    - In WeChat Developer Tools, click the **Cloud Development** icon on the left sidebar

    - Create a new environment or select an existing one, then record the Environment ID

    - Set the `envId` field in `project.config.json` to your recorded Environment ID

- Create the required database collections in the Cloud Development Console

### 2. Project Launch

- Click the **Preview** button in WeChat Developer Tools

- Or launch via the command line:

    ```Bash
    npm run dev
    ```

### 3. Deployment Instructions

- Frontend code is packaged automatically during the deployment process

- Cloud functions need to be deployed separately: Right-click the target cloud function directory in the Cloud Development Console and select **Upload and Deploy to Cloud**

## Demo Effects

<table border="0" style="border-collapse: collapse;">
  <tr>
    <td style="padding: 0; text-align: center;"><img src="../asset/image.png" alt="alt text" style="max-width: 100%; height: auto;"></td>
    <td style="padding: 0; text-align: center;"><img src="../asset/image-1.png" alt="alt text" style="max-width: 100%; height: auto;"></td>
  </tr>
  <tr>
    <td style="padding: 0; text-align: center;"><img src="../asset/image-2.png" alt="alt text" style="max-width: 100%; height: auto;"></td>
    <td style="padding: 0; text-align: center;"><img src="../asset/image-3.png" alt="alt text" style="max-width: 100%; height: auto;"></td>
  </tr>
</table>

## Reference Documents

- [WeChat Cloud Development Official Documentation](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)