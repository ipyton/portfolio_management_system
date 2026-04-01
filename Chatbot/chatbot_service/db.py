import time
import pymysql
from pymysql.cursors import DictCursor
from pymysql.err import OperationalError, InterfaceError
from .config import settings


_RETRYABLE_MYSQL_ERROR_CODES = {
    2006,  # MySQL server has gone away
    2013,  # Lost connection to MySQL server during query
    2014,  # Commands out of sync
    2045,  # Can't open shared memory; often transient in some envs
    2055,  # Lost connection to MySQL server at '%s', system error
}


def get_connection():
    return pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        cursorclass=DictCursor,
        autocommit=True,
        connect_timeout=settings.db_connect_timeout,
        read_timeout=settings.db_read_timeout,
        write_timeout=settings.db_write_timeout,
    )


def _is_retryable_db_error(exc: Exception) -> bool:
    if isinstance(exc, InterfaceError):
        return True
    if isinstance(exc, OperationalError):
        code = exc.args[0] if exc.args else None
        return code in _RETRYABLE_MYSQL_ERROR_CODES
    return False


def _run_with_retry(operation):
    max_retries = max(0, int(settings.db_max_retries))
    base_delay = max(0, int(settings.db_retry_backoff_ms)) / 1000
    total_attempts = 1 + max_retries

    for attempt in range(1, total_attempts + 1):
        try:
            return operation()
        except Exception as exc:
            is_retryable = _is_retryable_db_error(exc)
            if (not is_retryable) or (attempt >= total_attempts):
                raise
            # Simple exponential backoff for transient network/database disconnects.
            time.sleep(base_delay * (2 ** (attempt - 1)))


def fetch_all(query: str, params: tuple = ()):
    def _op():
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchall()

    return _run_with_retry(_op)


def fetch_one(query: str, params: tuple = ()):
    def _op():
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchone()

    return _run_with_retry(_op)


def execute(query: str, params: tuple = ()):
    def _op():
        with get_connection() as conn:
            with conn.cursor() as cursor:
                affected_rows = cursor.execute(query, params)
                return affected_rows

    return _run_with_retry(_op)
