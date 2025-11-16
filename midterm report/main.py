"""
sentiment_crawler 主程序
股吧爬虫(股评和资讯)和研报下载功能
"""

import threading
import time
from datetime import datetime
from config import STOCK_LIST, CRAWL_PAGES, USE_MULTITHREAD
from crawlers import PostCrawler, CommentCrawler, ReportCrawler, NewsCrawler
from utils import create_dir


def post_thread(stock_code, stock_name, pages=CRAWL_PAGES):
    """
    发帖爬取线程
    返回(开始日期, 结束日期)用于评论爬取
    """
    print(f"\n[POST] 开始爬取{stock_name}({stock_code})的发帖...")
    start_time = time.time()
    
    crawler = PostCrawler(stock_code)
    try:
        date_range = crawler.crawl_post_info(pages=pages)
        elapsed = time.time() - start_time
        print(f"[POST] 完成 - 用时{elapsed:.2f}秒, 日期范围: {date_range}")
        return date_range
    except Exception as e:
        print(f"[POST] 异常: {str(e)}")
        return (None, None)
    finally:
        crawler.cleanup()


def comment_thread_date(stock_code, stock_name, start_date, end_date):
    """
    按日期范围爬取评论的线程
    """
    if start_date is None or end_date is None:
        print(f"[COMMENT] 跳过 - 日期范围无效: {start_date} ~ {end_date}")
        return
    
    print(f"\n[COMMENT] 开始爬取{stock_name}({stock_code})的评论 ({start_date} ~ {end_date})...")
    start_time = time.time()
    
    crawler = CommentCrawler(stock_code)
    try:
        posts = crawler.find_by_date(start_date, end_date)
        if not posts:
            print(f"[COMMENT] 未找到目标日期范围内的发帖")
            return
        
        # 可选：爬取各帖子的评论
        # for post in posts[:5]:  # 限制为前5条避免过长
        #     post_url = f"https://guba.eastmoney.com/news,{post['_id']}.html"
        #     crawler.crawl_comment_info(post_url, post['_id'])
        
        elapsed = time.time() - start_time
        print(f"[COMMENT] 完成 - 用时{elapsed:.2f}秒")
    
    except Exception as e:
        print(f"[COMMENT] 异常: {str(e)}")
    finally:
        crawler.cleanup()


def report_thread(stock_code, stock_name, pages=CRAWL_PAGES):
    """
    研报下载线程
    """
    print(f"\n[REPORT] 开始下载{stock_name}({stock_code})的研报...")
    start_time = time.time()
    
    crawler = ReportCrawler(stock_code, stock_name)
    try:
        crawler.crawl_stock_reports(pages=pages)
        elapsed = time.time() - start_time
        print(f"[REPORT] 完成 - 用时{elapsed:.2f}秒")
    except Exception as e:
        print(f"[REPORT] 异常: {str(e)}")
    finally:
        crawler.cleanup()


def news_thread(stock_code, stock_name, pages=CRAWL_PAGES):
    """
    资讯抓取线程（使用HTTP请求解析）
    """
    print(f"\n[NEWS] 开始抓取{stock_name}({stock_code})的资讯...")
    start_time = time.time()

    crawler = NewsCrawler(stock_code, stock_name)
    try:
        crawler.crawl_news(pages=pages)
        elapsed = time.time() - start_time
        print(f"[NEWS] 完成 - 用时{elapsed:.2f}秒")
    except Exception as e:
        print(f"[NEWS] 异常: {str(e)}")


def sentiment_pipeline_thread(stock_code, stock_name, crawl_comment=False, crawl_report=True, crawl_news=True, pages=CRAWL_PAGES):
    """
    主管道：协调发帖、评论、研报的爬取
    
    参数:
        stock_code: 股票代码
        stock_name: 股票名称
        crawl_comment: 是否爬取评论（默认False）
        crawl_report: 是否下载研报（默认True）
        pages: 每个模块爬取的页数
    """
    print(f"\n{'='*60}")
    print(f"[PIPELINE] 开始处理 {stock_name}({stock_code})")
    print(f"  - 爬取评论: {crawl_comment}")
    print(f"  - 下载研报: {crawl_report}")
    print(f"  - 页数: {pages}")
    print(f"{'='*60}")
    
    try:
        # 1. 爬取发帖（获取日期范围）
        start_date, end_date = post_thread(stock_code, stock_name, pages=pages)
        
        # 2. 爬取评论（如果启用）
        if crawl_comment:
            comment_thread_date(stock_code, stock_name, start_date, end_date)
        
        # 3. 下载研报（如果启用）
        if crawl_report:
            report_thread(stock_code, stock_name, pages=pages)

        # 4. 获取资讯（如果启用）
        if crawl_news:
            news_thread(stock_code, stock_name, pages=pages)
    
    except Exception as e:
        print(f"[PIPELINE] 异常: {str(e)}")


def run_all_stocks_sequential(crawl_comment=False, crawl_report=True, pages=CRAWL_PAGES):
    """顺序处理所有股票"""
    print(f"\n[MAIN] 开始顺序爬取所有股票 ({len(STOCK_LIST)} 只)")
    start_time = time.time()
    
    try:
        for stock_code, stock_name in STOCK_LIST:
            sentiment_pipeline_thread(stock_code, stock_name, 
                                     crawl_comment=crawl_comment, 
                                     crawl_report=crawl_report, 
                                     crawl_news=True,
                                     pages=pages)
            time.sleep(2)  # 请求间隔
    
    except Exception as e:
        print(f"[MAIN] 异常: {str(e)}")
    
    finally:
        elapsed = time.time() - start_time
        print(f"\n[MAIN] 全部完成 - 总用时{elapsed:.2f}秒")


def run_all_stocks_multithread(crawl_comment=False, crawl_report=True, pages=CRAWL_PAGES):
    """多线程处理所有股票"""
    print(f"\n[MAIN] 开始多线程爬取所有股票 ({len(STOCK_LIST)} 只)")
    start_time = time.time()
    
    threads = []
    try:
        for stock_code, stock_name in STOCK_LIST:
            t = threading.Thread(
                target=sentiment_pipeline_thread,
                args=(stock_code, stock_name),
                kwargs={'crawl_comment': crawl_comment, 'crawl_report': crawl_report, 'crawl_news': True, 'pages': pages}
            )
            threads.append(t)
            t.start()
        
        # 等待所有线程完成
        for t in threads:
            t.join()
    
    except Exception as e:
        print(f"[MAIN] 异常: {str(e)}")
    
    finally:
        elapsed = time.time() - start_time
        print(f"\n[MAIN] 全部完成 - 总用时{elapsed:.2f}秒")


if __name__ == "__main__":
    # 创建必要的目录
    create_dir("data")
    
    # 配置参数
    ENABLE_MULTITHREAD = False  # 是否使用多线程
    CRAWL_COMMENTS = False      # 是否爬取评论
    CRAWL_REPORTS = True        # 是否下载研报
    CRAWL_NEWS = True           # 是否抓取资讯
    PAGES = 2                    # 每个模块的爬取页数
    
    print(f"\n[CONFIG]")
    print(f"  - 多线程: {ENABLE_MULTITHREAD}")
    print(f"  - 爬取评论: {CRAWL_COMMENTS}")
    print(f"  - 下载研报: {CRAWL_REPORTS}")
    print(f"  - 页数: {PAGES}")
    print(f"\n启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 执行爬虫
    if ENABLE_MULTITHREAD:
        run_all_stocks_multithread(crawl_comment=CRAWL_COMMENTS, crawl_report=CRAWL_REPORTS, pages=PAGES)
    else:
        run_all_stocks_sequential(crawl_comment=CRAWL_COMMENTS, crawl_report=CRAWL_REPORTS, pages=PAGES)
    
    print(f"\n结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n爬虫执行完毕！")
