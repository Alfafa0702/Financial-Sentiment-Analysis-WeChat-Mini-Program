import requests
import random
import time
import os
from fake_useragent import UserAgent
from bs4 import BeautifulSoup
import pandas as pd
from config import PROXIES_POOL, SELENIUM_TIMEOUT
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# 初始化User-Agent池
ua = UserAgent()
HEADERS_POOL = [
    {"User-Agent": ua.chrome},
    {"User-Agent": ua.firefox},
    {"User-Agent": ua.safari}
]


def get_random_header():
    """随机获取请求头"""
    return random.choice(HEADERS_POOL)


def get_random_proxy():
    """随机获取代理（无代理则返回None）"""
    if PROXIES_POOL:
        return random.choice(PROXIES_POOL)
    return None


def request_with_retry(url, method="get", max_retries=3, **kwargs):
    """带重试机制的请求函数，处理反爬和网络异常"""
    kwargs.setdefault("headers", get_random_header())
    kwargs.setdefault("proxies", get_random_proxy())
    kwargs.setdefault("timeout", 10)

    for i in range(max_retries):
        try:
            response = requests.request(method, url, **kwargs)
            if response.status_code == 200:
                response.encoding = response.apparent_encoding  # 自动识别编码
                return response
            print(f"请求失败 [状态码: {response.status_code}]，重试第{i+1}次...")
        except Exception as e:
            print(f"请求异常 [{str(e)}]，重试第{i+1}次...")
        time.sleep(random.uniform(1, 3))  # 随机间隔，降低反爬风险
    return None


def create_dir(path):
    """创建目录（不存在则自动创建）"""
    if not os.path.exists(path):
        os.makedirs(path)
    return path


def save_to_csv(data_list, csv_path, columns):
    """通用CSV保存函数"""
    if not data_list:
        print(f"无数据可保存到 {csv_path}")
        return
    df = pd.DataFrame(data_list, columns=columns)
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"数据已保存到: {csv_path}")


def parse_html(response):
    """解析HTML为BeautifulSoup对象"""
    return BeautifulSoup(response.text, "lxml")


def get_chrome_browser(headless=False):
    """获取Chrome浏览器实例"""
    chrome_options = Options()
    if headless:
        chrome_options.add_argument("--headless")  # 无头模式
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument(f"user-agent={get_random_header()['User-Agent']}")

    service = Service(ChromeDriverManager().install())
    browser = webdriver.Chrome(service=service, options=chrome_options)
    browser.set_page_load_timeout(SELENIUM_TIMEOUT)
    return browser


def close_browser(browser):
    """安全关闭浏览器"""
    try:
        browser.quit()
    except Exception as e:
        print(f"关闭浏览器失败: {str(e)}")
