from dataclasses import dataclass
import os
from pathlib import Path
from dotenv import load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SERVICE_DIR.parent

# Load project-level .env first, then allow service-level .env to override.
for env_file in (PROJECT_DIR / ".env", SERVICE_DIR / ".env"):
    if env_file.exists():
        load_dotenv(env_file, override=True)

@dataclass
class Settings:
    db_host: str = os.getenv("DB_HOST", "")
    db_port: int = int(os.getenv("DB_PORT", "3306"))
    db_user: str = os.getenv("DB_USER", "")
    db_password: str = os.getenv("DB_PASSWORD", "")
    db_name: str = os.getenv("DB_NAME", os.getenv("DB_DATABASE", "portfolio"))
    db_connect_timeout: int = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))
    db_read_timeout: int = int(os.getenv("DB_READ_TIMEOUT", "10"))
    db_write_timeout: int = int(os.getenv("DB_WRITE_TIMEOUT", "10"))
    db_max_retries: int = int(os.getenv("DB_MAX_RETRIES", "2"))
    db_retry_backoff_ms: int = int(os.getenv("DB_RETRY_BACKOFF_MS", "200"))

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
