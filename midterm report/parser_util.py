from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import re


class PostParser:
    """股吧发帖解析器"""
    
    @staticmethod
    def parse_post(element):
        """解析单条发帖信息"""
        try:
            post_info = {
                'post_title': element.find_element(By.CSS_SELECTOR, '.l3 a').text,
                'post_author': element.find_element(By.CSS_SELECTOR, '.l4 a').text,
                'post_date': element.find_element(By.CSS_SELECTOR, '.l5').text,
                'post_time': element.find_element(By.CSS_SELECTOR, '.l6').text,
                'post_reply': element.find_element(By.CSS_SELECTOR, '.l7 span').text,
                'post_like': element.find_element(By.CSS_SELECTOR, '.l8 span').text,
            }
            return post_info
        except NoSuchElementException:
            return None


class CommentParser:
    """股吧评论解析器"""
    
    @staticmethod
    def parse_comment(element):
        """解析单条评论信息"""
        try:
            comment_info = {
                'comment_author': element.find_element(By.CSS_SELECTOR, '.user_name a').text,
                'comment_content': element.find_element(By.CSS_SELECTOR, '.t_content').text,
                'comment_time': element.find_element(By.CSS_SELECTOR, '.pub_time').text,
                'comment_like': element.find_element(By.CSS_SELECTOR, '.zan b').text,
            }
            return comment_info
        except NoSuchElementException:
            return None


class ReportParser:
    """研报PDF解析器"""
    
    @staticmethod
    def parse_report(element):
        """解析研报页面元素（用于提取PDF下载链接）"""
        try:
            report_info = {
                'report_title': element.find_element(By.CSS_SELECTOR, '.title a').text,
                'report_author': element.find_element(By.CSS_SELECTOR, '.author').text,
                'report_date': element.find_element(By.CSS_SELECTOR, '.time').text,
                'report_url': element.find_element(By.CSS_SELECTOR, '.download a').get_attribute('href')
            }
            return report_info
        except NoSuchElementException:
            return None
    
    @staticmethod
    def extract_pdf_url(html_text):
        """从HTML中使用正则表达式提取PDF下载链接"""
        pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+\.pdf'
        urls = re.findall(pattern, html_text)
        return urls if urls else []


class NewsParser:
    """新闻资讯解析器"""
    
    @staticmethod
    def parse_news_from_html(html_text):
        """解析新闻列表HTML"""
        news_list = []
        try:
            # 使用正则表达式提取新闻项
            pattern = r'<li>(.*?)</li>'
            items = re.findall(pattern, html_text, re.DOTALL)
            
            for item in items:
                title_match = re.search(r'>([^<]+)</a>', item)
                time_match = re.search(r'(\d{4}-\d{2}-\d{2})', item)
                
                if title_match and time_match:
                    news_info = {
                        'news_title': title_match.group(1),
                        'news_date': time_match.group(1)
                    }
                    news_list.append(news_info)
        except Exception as e:
            print(f"解析新闻异常: {str(e)}")
        
        return news_list
