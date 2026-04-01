import requests
from .config import settings
from .db import fetch_all, execute


def _request_kwargs() -> dict:
    proxy_url = settings.proxy_url or settings.https_proxy or settings.http_proxy
    if not proxy_url:
        return {}
    return {
        "proxies": {
            "http": settings.http_proxy or proxy_url,
            "https": settings.https_proxy or proxy_url,
        }
    }


def serpapi_search(query: str):
    if not settings.serpapi_key:
        return {"source": "web_search", "success": False, "error": "SERPAPI_KEY is missing", "data": None}
    if not query:
        return {"source": "web_search", "success": True, "error": None, "data": []}
    try:
        url = "https://serpapi.com/search.json"
        params = {"q": query, "api_key": settings.serpapi_key}
        resp = requests.get(url, params=params, timeout=20, **_request_kwargs())
        resp.raise_for_status()
        return {"source": "web_search", "success": True, "error": None, "data": resp.json()}
    except requests.RequestException as exc:
        return {"source": "web_search", "success": False, "error": str(exc), "data": None}


def twelvedata_search(query: str | dict, path: str | None = None):
    if not settings.twelvedata_api_key:
        return {"source": "twelvedata", "success": False, "error": "TWELVEDATA_API_KEY is missing", "data": None}

    endpoint = (path or "search").strip().lstrip("/")
    url = f"https://api.twelvedata.com/{endpoint}"
    params = {"apikey": settings.twelvedata_api_key}

    if isinstance(query, dict):
        params.update(query)
    elif query:
        params["symbol"] = query

    try:
        resp = requests.get(url, params=params, timeout=20, **_request_kwargs())
        resp.raise_for_status()
        return {
            "source": "twelvedata",
            "success": True,
            "error": None,
            "endpoint": endpoint,
            "data": resp.json(),
        }
    except requests.RequestException as exc:
        return {
            "source": "twelvedata",
            "success": False,
            "error": str(exc),
            "endpoint": endpoint,
            "data": None,
        }


def load_schema_text(schema_text: str):
    return schema_text


def fetch_chat_history(user_id: int):
    table = settings.chat_history_table
    if not table:
        return []
    query = f"""
    SELECT role, message, created_at
    FROM (
        SELECT role, message, created_at
        FROM {table}
        WHERE user_id=%s
        ORDER BY created_at DESC
        LIMIT 20
    ) h
    ORDER BY created_at ASC
    """
    return fetch_all(query, (user_id,))


def append_chat_message(
    user_id: int,
    role: str,
    message: str,
    request_id: str | None = None,
    metadata_json: str | None = None,
):
    table = settings.chat_history_table
    if not table:
        return 0
    query = f"""
    INSERT INTO {table} (user_id, role, message, request_id, metadata_json)
    VALUES (%s, %s, %s, %s, %s)
    """
    return execute(query, (user_id, role, message, request_id, metadata_json))


def log_tool_call(
    request_id: str,
    user_id: int,
    tool_name: str,
    success: bool,
    error_message: str | None,
    input_json: str | None,
    output_json: str | None,
):
    query = """
    INSERT INTO portfolio.chat_tool_call_log
    (request_id, user_id, tool_name, success, error_message, input_json, output_json)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    return execute(
        query,
        (
            request_id,
            user_id,
            tool_name,
            1 if success else 0,
            error_message,
            input_json,
            output_json,
        ),
    )


def run_query_by_type(query_type: str, user_id: int, params: dict | None = None):
    params = params or {}
    if query_type == "portfolio_summary":
        return fetch_all(
            """
            SELECT a.symbol, a.asset_type, h.quantity, h.avg_cost
            FROM portfolio.holdings h
            JOIN portfolio.assets a ON h.asset_id = a.id
            WHERE h.user_id = %s
            """,
            (user_id,),
        )
    if query_type == "holdings_detail":
        return fetch_all(
            """
            SELECT a.symbol, a.name, a.asset_type, a.currency, h.quantity, h.avg_cost
            FROM portfolio.holdings h
            JOIN portfolio.assets a ON h.asset_id = a.id
            WHERE h.user_id = %s
            ORDER BY a.asset_type, a.symbol
            """,
            (user_id,),
        )
    if query_type == "cash_balance":
        return fetch_all(
            """
            SELECT currency, balance, available_balance, frozen_balance
            FROM portfolio.cash_accounts
            WHERE user_id = %s
            """,
            (user_id,),
        )
    if query_type == "portfolio_nav_daily":
        limit = int(params.get("limit", 90))
        return fetch_all(
            """
            SELECT nav_date, total_value, holding_value, cash, net_value, daily_return
            FROM portfolio.portfolio_nav_daily
            WHERE user_id = %s
            ORDER BY nav_date DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
    if query_type == "trade_history":
        limit = int(params.get("limit", 50))
        return fetch_all(
            """
            SELECT h.user_id, a.symbol, a.asset_type, t.trade_type, t.quantity, t.price,
                   t.amount, t.fee, t.traded_at, t.status
            FROM portfolio.trade_history t
            JOIN portfolio.holdings h ON t.holding_id = h.id
            JOIN portfolio.assets a ON h.asset_id = a.id
            WHERE h.user_id = %s
            ORDER BY t.traded_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
    if query_type == "asset_price_history":
        symbol = params.get("symbol", "")
        if not symbol:
            return []
        limit = int(params.get("limit", 180))
        return fetch_all(
            """
            SELECT p.trade_date, p.open, p.high, p.low, p.close, p.volume
            FROM portfolio.asset_price_daily p
            JOIN portfolio.assets a ON p.asset_id = a.id
            WHERE a.symbol = %s
            ORDER BY p.trade_date DESC
            LIMIT %s
            """,
            (symbol, limit),
        )
    if query_type == "watchlist":
        return fetch_all(
            """
            SELECT a.symbol, a.asset_type, w.added_at, w.note
            FROM portfolio.watchlist w
            JOIN portfolio.assets a ON w.asset_id = a.id
            WHERE w.user_id = %s
            """,
            (user_id,),
        )
    return []
