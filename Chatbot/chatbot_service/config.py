from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Settings:
    db_host: str = os.getenv("DB_HOST", "")
    db_port: int = int(os.getenv("DB_PORT", "3306"))
    db_user: str = os.getenv("DB_USER", "")
    db_password: str = os.getenv("DB_PASSWORD", "")
    db_name: str = os.getenv("DB_NAME", "portfolio")

    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    gemini_transport: str = os.getenv("GEMINI_TRANSPORT", "rest")
    proxy_url: str = os.getenv("PROXY_URL", "")
    http_proxy: str = os.getenv("HTTP_PROXY", "")
    https_proxy: str = os.getenv("HTTPS_PROXY", "")

    serpapi_key: str = os.getenv("SERPAPI_KEY", "")
    twelvedata_api_key: str = os.getenv("TWELVEDATA_API_KEY", "")

    chat_history_table: str = os.getenv("CHAT_HISTORY_TABLE", "")

settings = Settings()

resolved_proxy = settings.proxy_url or settings.https_proxy or settings.http_proxy
if resolved_proxy:
    os.environ["HTTP_PROXY"] = settings.http_proxy or resolved_proxy
    os.environ["HTTPS_PROXY"] = settings.https_proxy or resolved_proxy
