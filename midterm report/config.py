# 需爬取的股票列表（股票代码, 股票名称）
STOCK_LIST = [
    ("600036", "招商银行"),
    ("000858", "五粮液"),
    #("300750", "宁德时代"),
    #("601899", "紫金矿业"),
]

# 爬取参数
CRAWL_PAGES = 2  # 每个股票爬取的页数（发帖和评论）
USE_MULTITHREAD = False  # 是否启用多线程
MAX_THREADS = 5  # 最大线程数（避免请求过于密集）
SELENIUM_TIMEOUT = 10  # 页面加载超时时间（秒）
REPORT_KEYWORD_TEMPLATE = "http://so.eastmoney.com/Yanbao/s?keyword={stock_name}&pageindex={page}"  # 研报搜索URL模板

# 存储路径配置
DATA_DIR = "data"  # 数据根目录
REPORT_PDF_DIR = f"{DATA_DIR}/研报PDF"  # 研报PDF保存目录
COMMENT_RECORD_CSV = f"{DATA_DIR}/评论爬取记录.csv"

# 反爬配置（代理池可选，需替换为有效代理）
PROXIES_POOL = [
    # {"http": "http://127.0.0.1:7890", "https": "https://127.0.0.1:7890"},
]

# 目标网站URL模板
URL_TEMPLATES = {
    "bar": "https://guba.eastmoney.com/list,{stock_code}.html",  # 股吧
    "report": "http://so.eastmoney.com/Yanbao/s?keyword={stock_name}",  # 研报
    "news": "http://so.eastmoney.com/News/s?keyword={stock_name}"  # 资讯检索
}
