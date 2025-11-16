import time
import os
from datetime import datetime, timedelta
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import requests
import re

from utils import get_chrome_browser, request_with_retry, create_dir, get_random_header
from config import SELENIUM_TIMEOUT, URL_TEMPLATES, REPORT_PDF_DIR
from parser_util import PostParser, CommentParser, ReportParser, NewsParser
from mongodb import MongoAPI


class PostCrawler:
    """股吧发帖爬虫"""
    
    def __init__(self, stock_code):
        self.stock_code = stock_code
        self.browser = get_chrome_browser(headless=False)
        self.wait = WebDriverWait(self.browser, SELENIUM_TIMEOUT)
        self.mongo = MongoAPI('stock_sentiment', f'post_{stock_code}')
    
    def crawl_post_info(self, pages=1):
        """爬取发帖信息，返回爬取的日期范围"""
        url = URL_TEMPLATES['bar'].format(stock_code=self.stock_code)
        start_date = None
        end_date = None
        
        try:
            for page in range(1, pages + 1):
                page_url = f"{url}?page={page}"
                print(f"[PostCrawler] 爬取第{page}页: {page_url}")
                
                try:
                    self.browser.get(page_url)
                    time.sleep(2)
                    
                    # 等待发帖列表加载
                    self.wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "table tbody tr")))
                    
                    elements = self.browser.find_elements(By.CSS_SELECTOR, "table tbody tr")
                    print(f"[PostCrawler] 找到 {len(elements)} 条发帖")
                    
                    for element in elements:
                        try:
                            post_info = PostParser.parse_post(element)
                            if post_info:
                                # 记录日期范围
                                if start_date is None:
                                    start_date = post_info['post_date']
                                end_date = post_info['post_date']
                                
                                self.mongo.insert_one(post_info)
                                print(f"  [保存] {post_info['post_title'][:30]} - {post_info['post_date']}")
                        except Exception as e:
                            print(f"  [错误] 解析单条发帖失败: {str(e)}")
                            continue
                    
                except TimeoutException:
                    print(f"[PostCrawler] 第{page}页加载超时，跳过")
                    continue
                
                time.sleep(1)
            
            return (start_date, end_date)
        
        except Exception as e:
            print(f"[PostCrawler] 爬取异常: {str(e)}")
            return (None, None)
    
    def cleanup(self):
        """清理资源"""
        try:
            self.browser.quit()
            print("[PostCrawler] 浏览器已关闭")
        except Exception as e:
            print(f"[PostCrawler] 关闭浏览器失败: {str(e)}")


class CommentCrawler:
    """股吧评论爬虫"""
    
    def __init__(self, stock_code):
        self.stock_code = stock_code
        self.browser = get_chrome_browser(headless=False)
        self.wait = WebDriverWait(self.browser, SELENIUM_TIMEOUT)
        self.post_mongo = MongoAPI('stock_sentiment', f'post_{stock_code}')
        self.comment_mongo = MongoAPI('stock_sentiment', f'comment_{stock_code}')
    
    def find_by_date(self, start_date, end_date):
        """根据日期范围查询发帖"""
        try:
            posts = list(self.post_mongo.find(
                {'post_date': {'$gte': start_date, '$lte': end_date}},
                {'_id': 1, 'post_title': 1, 'post_date': 1}
            ))
            print(f"[CommentCrawler] 找到 {len(posts)} 条在{start_date}-{end_date}范围内的发帖")
            return posts
        except Exception as e:
            print(f"[CommentCrawler] 查询发帖异常: {str(e)}")
            return []
    
    def crawl_comment_info(self, post_url, post_id):
        """爬取单个帖子的评论"""
        try:
            self.browser.get(post_url)
            time.sleep(1)
            
            # 等待评论区加载
            self.wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".article-item")))
            
            comments = self.browser.find_elements(By.CSS_SELECTOR, ".article-item")
            print(f"[CommentCrawler] 找到 {len(comments)} 条评论")
            
            for comment_element in comments:
                try:
                    comment_info = CommentParser.parse_comment(comment_element)
                    if comment_info:
                        comment_info['post_id'] = post_id
                        self.comment_mongo.insert_one(comment_info)
                except Exception as e:
                    print(f"  [错误] 解析评论失败: {str(e)}")
                    continue
        
        except TimeoutException:
            print(f"[CommentCrawler] 评论加载超时")
        except Exception as e:
            print(f"[CommentCrawler] 爬取评论异常: {str(e)}")
    
    def cleanup(self):
        """清理资源"""
        try:
            self.browser.quit()
            print("[CommentCrawler] 浏览器已关闭")
        except Exception as e:
            print(f"[CommentCrawler] 关闭浏览器失败: {str(e)}")


class ReportCrawler:
    """研报下载爬虫"""
    
    def __init__(self, stock_code, stock_name):
        self.stock_code = stock_code
        self.stock_name = stock_name
        self.browser = get_chrome_browser(headless=False)
        self.wait = WebDriverWait(self.browser, SELENIUM_TIMEOUT)
        self.report_mongo = MongoAPI('stock_sentiment', f'report_{stock_code}')
        self.save_dir = os.path.join(REPORT_PDF_DIR, stock_code)
        create_dir(self.save_dir)
    
    def crawl_stock_reports(self, pages=1):
        """爬取并下载研报PDF"""
        search_url = URL_TEMPLATES['report'].format(stock_name=self.stock_name)
        
        try:
            for page in range(1, pages + 1):
                page_url = f"{search_url}&pageindex={page}"
                print(f"[ReportCrawler] 爬取第{page}页: {page_url}")
                
                try:
                    self.browser.get(page_url)
                    time.sleep(2)
                    
                    # 等待研报列表加载
                    self.wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".yb_list li")))
                    
                    elements = self.browser.find_elements(By.CSS_SELECTOR, ".yb_list li")
                    print(f"[ReportCrawler] 找到 {len(elements)} 个研报")
                    
                    for element in elements:
                        try:
                            # 提取研报信息
                            title = element.find_element(By.CSS_SELECTOR, ".title").text
                            pdf_link = element.find_element(By.CSS_SELECTOR, "a").get_attribute("href")
                            
                            if pdf_link and '.pdf' in pdf_link.lower():
                                # 下载PDF
                                self._download_pdf(pdf_link, title)
                                
                                # 存储到MongoDB
                                report_info = {
                                    'report_title': title,
                                    'report_url': pdf_link,
                                    'download_time': datetime.now().isoformat()
                                }
                                self.report_mongo.insert_one(report_info)
                                print(f"  [保存] {title}")
                        
                        except Exception as e:
                            print(f"  [错误] 下载研报失败: {str(e)}")
                            continue
                    
                except TimeoutException:
                    print(f"[ReportCrawler] 第{page}页加载超时，跳过")
                    continue
                
                time.sleep(1)
        
        except Exception as e:
            print(f"[ReportCrawler] 爬取异常: {str(e)}")
    
    def _download_pdf(self, url, title, max_retries=3):
        """下载PDF文件"""
        filename = f"{title}.pdf"
        filepath = os.path.join(self.save_dir, filename)
        
        # 避免重复下载
        if os.path.exists(filepath):
            print(f"  [跳过] {filename} 已存在")
            return
        
        for attempt in range(max_retries):
            try:
                response = request_with_retry(url, method='get')
                if response and response.status_code == 200:
                    with open(filepath, 'wb') as f:
                        f.write(response.content)
                    print(f"  [下载] {filename} -> {filepath}")
                    return
            except Exception as e:
                print(f"  [重试] {attempt + 1}/{max_retries}: {str(e)}")
                time.sleep(2)
    
    def cleanup(self):
        """清理资源"""
        try:
            self.browser.quit()
            print("[ReportCrawler] 浏览器已关闭")
        except Exception as e:
            print(f"[ReportCrawler] 关闭浏览器失败: {str(e)}")


class NewsCrawler:
    """资讯爬虫（使用请求+解析，非Selenium）"""

    def __init__(self, stock_code, stock_name):
        self.stock_code = stock_code
        self.stock_name = stock_name
        self.mongo = MongoAPI('stock_sentiment', f'news_{stock_code}')

    def crawl_news(self, pages=1):
        """爬取资讯列表并存入MongoDB"""
        base_url = URL_TEMPLATES.get('news', '').format(stock_name=self.stock_name)
        if not base_url:
            print(f"[NewsCrawler] 未配置news URL模板，跳过")
            return

        try:
            for page in range(1, pages + 1):
                page_url = f"{base_url}&pageindex={page}"
                print(f"[NewsCrawler] 爬取第{page}页: {page_url}")
                response = request_with_retry(page_url)
                if not response:
                    print(f"[NewsCrawler] 请求失败: {page_url}")
                    continue

                # 解析新闻列表
                news_list = NewsParser.parse_news_from_html(response.text)
                print(f"[NewsCrawler] 解析到 {len(news_list)} 条资讯")
                for news in news_list:
                    try:
                        self.mongo.insert_one(news)
                    except Exception as e:
                        print(f"  [NewsCrawler] 存储单条资讯失败: {str(e)}")
                
                time.sleep(1)

        except Exception as e:
            print(f"[NewsCrawler] 爬取异常: {str(e)}")
