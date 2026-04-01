import requests
import re
import time
import json
from collections.abc import Mapping
from urllib.parse import parse_qsl
from .config import settings
from .db import fetch_all, execute


_SQL_COMMENT_RE = re.compile(r"/\*.*?\*/|--[^\n]*|#[^\n]*", re.S)
_SQL_FORBIDDEN_RE = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|call|execute|exec|set|use|lock|unlock|commit|rollback)\b",
    re.I,
)
_SQL_INTO_FILE_RE = re.compile(r"\binto\s+(outfile|dumpfile)\b", re.I)
_SQL_NAMED_PARAM_RE = re.compile(r":([A-Za-z_][A-Za-z0-9_]*)")


def _strip_sql_comments(sql: str) -> str:
    return _SQL_COMMENT_RE.sub(" ", sql or "")


def _validate_select_sql(sql: str) -> str:
    normalized = " ".join(_strip_sql_comments(sql).strip().split())
    if not normalized:
        raise ValueError("SQL is empty")

    single_stmt = normalized.rstrip(";").strip()
    if ";" in single_stmt:
        raise ValueError("Only a single SQL statement is allowed")

    lower_stmt = single_stmt.lower()
    if not (lower_stmt.startswith("select") or lower_stmt.startswith("with")):
        raise ValueError("Only SELECT/WITH queries are allowed")

    if _SQL_FORBIDDEN_RE.search(single_stmt):
        raise ValueError("Only read-only SQL is allowed")
    if _SQL_INTO_FILE_RE.search(single_stmt):
        raise ValueError("Exporting query results to files is not allowed")

    if lower_stmt.startswith("with") and "select" not in lower_stmt:
        raise ValueError("WITH query must contain SELECT")

    return single_stmt


def _build_sql_params(sql: str, user_id: int, params: dict) -> tuple[str, tuple]:
    bind_map = {}
    if isinstance(params, dict):
        nested_params = params.get("params")
        if isinstance(nested_params, Mapping):
            bind_map.update(nested_params)
        bind_map.update(params)
    bind_map["user_id"] = user_id
    values = []

    def repl(match: re.Match) -> str:
        name = match.group(1)
        if name not in bind_map:
            raise ValueError(f"missing SQL param: {name}")
        value = bind_map[name]
        if isinstance(value, (dict, list, set)):
            raise ValueError(f"invalid SQL param type for {name}")
        values.append(value)
        return "%s"

    prepared = _SQL_NAMED_PARAM_RE.sub(repl, sql)
    return prepared, tuple(values)


def _execute_custom_select(sql: str, user_id: int, params: dict):
    safe_sql = _validate_select_sql(sql)
    prepared_sql, sql_params = _build_sql_params(safe_sql, user_id, params)
    return fetch_all(prepared_sql, sql_params)


def _collect_custom_sql_candidates(params: dict) -> list[tuple[str, str]]:
    candidates = []
    if not isinstance(params, dict):
        return candidates

    sql_value = params.get("sql")
    if isinstance(sql_value, str):
        candidates.append(("sql", sql_value))

    queries = params.get("queries")
    if isinstance(queries, Mapping):
        for key, value in queries.items():
            if isinstance(value, str):
                candidates.append((str(key), value))
    elif isinstance(queries, (list, tuple)):
        for idx, item in enumerate(queries, start=1):
            if not isinstance(item, Mapping):
                continue
            sql = item.get("sql")
            if not isinstance(sql, str):
                continue
            query_name = item.get("query_name")
            if not isinstance(query_name, str) or not query_name.strip():
                query_name = item.get("name")
            if not isinstance(query_name, str) or not query_name.strip():
                query_name = f"query_{idx}"
            candidates.append((query_name, sql))

    for key, value in params.items():
        if key in {"sql", "queries"}:
            continue
        if not isinstance(value, str):
            continue
        stripped = _strip_sql_comments(value).lstrip().lower()
        if stripped.startswith("select") or stripped.startswith("with"):
            candidates.append((str(key), value))

    return candidates


def _run_custom_query_type(query_type: str, user_id: int, params: dict):
    candidates = _collect_custom_sql_candidates(params)
    if not candidates:
        raise ValueError(
            f"Unsupported database_query_type: {query_type}. "
            "Provide database_query_params.sql or database_query_params.queries with SELECT/WITH SQL."
        )

    if len(candidates) == 1:
        return _execute_custom_select(candidates[0][1], user_id, params)

    result = {}
    for key, sql in candidates:
        result[key] = _execute_custom_select(sql, user_id, params)
    return result


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
        raise ValueError("SERPAPI_KEY is missing")
    if not query:
        raise ValueError("web_search_query is empty")
    url = "https://serpapi.com/search.json"
    params = {"q": query, "api_key": settings.serpapi_key}
    resp = requests.get(url, params=params, timeout=20, **_request_kwargs())
    resp.raise_for_status()
    return {"source": "web_search", "success": True, "error": None, "data": resp.json()}


def _normalize_twelvedata_endpoint(path: str | None) -> tuple[str, dict]:
    raw = (path or "search").strip().lstrip("/")
    if not raw:
        return "search", {}
    if "?" not in raw:
        return raw, {}
    endpoint, query_text = raw.split("?", 1)
    endpoint = endpoint.strip() or "search"
    pairs = parse_qsl(query_text, keep_blank_values=False)
    query_params = {k: v for k, v in pairs if k}
    return endpoint, query_params


def _parse_twelvedata_query(query: str | dict | None) -> dict:
    params = {}
    if isinstance(query, dict):
        return dict(query)

    query_text = str(query or "").strip()
    if not query_text:
        return params

    # Accept JSON-style dict text from planner output.
    if query_text.startswith("{") and query_text.endswith("}"):
        try:
            loaded = json.loads(query_text)
            if isinstance(loaded, dict):
                return loaded
        except Exception:
            pass

    query_text = query_text.lstrip("?")
    if "=" in query_text:
        parsed_pairs = parse_qsl(query_text, keep_blank_values=False)
        if parsed_pairs:
            return {k: v for k, v in parsed_pairs if k}

    params["symbol"] = query_text
    return params


def _normalize_interval_value(value: str) -> str:
    normalized = str(value or "").strip().lower()
    mapping = {
        "day": "1day",
        "daily": "1day",
        "1d": "1day",
        "week": "1week",
        "weekly": "1week",
        "1w": "1week",
        "month": "1month",
        "monthly": "1month",
        "1m": "1month",
        "hour": "1h",
        "1hour": "1h",
        "minute": "1min",
    }
    return mapping.get(normalized, str(value or "").strip())


def _apply_twelvedata_defaults(endpoint: str, params: dict):
    if endpoint == "time_series":
        # Strong default for "recent trend" requests.
        params.setdefault("interval", "1day")
        params.setdefault("outputsize", "30")

        if "interval" in params:
            params["interval"] = _normalize_interval_value(params["interval"])


def _request_twelvedata_json(url: str, params: dict, attempts: int = 2) -> dict:
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            resp = requests.get(url, params=params, timeout=20, **_request_kwargs())
            resp.raise_for_status()
            payload = resp.json()
            if isinstance(payload, dict):
                return payload
            raise ValueError("TwelveData response is not a JSON object")
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt >= attempts:
                break
            time.sleep(0.3 * attempt)
    raise ValueError(f"TwelveData request failed: {last_error}")


def _is_twelvedata_interval_error(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    if str(payload.get("status", "")).lower() != "error":
        return False
    message = str(payload.get("message", "")).lower()
    return "interval" in message


def twelvedata_search(query: str | dict, path: str | None = None):
    if not settings.twelvedata_api_key:
        raise ValueError("TWELVEDATA_API_KEY is missing")

    endpoint, endpoint_params = _normalize_twelvedata_endpoint(path)
    url = f"https://api.twelvedata.com/{endpoint}"
    params = {"apikey": settings.twelvedata_api_key}
    params.update(endpoint_params)

    parsed_query_params = _parse_twelvedata_query(query)
    params.update(parsed_query_params)
    _apply_twelvedata_defaults(endpoint, params)

    payload = _request_twelvedata_json(url, params)

    # One targeted retry for interval-related planner drift.
    if _is_twelvedata_interval_error(payload) and endpoint == "time_series":
        retry_params = dict(params)
        retry_params["interval"] = "1day"
        retry_params.setdefault("outputsize", "30")
        payload = _request_twelvedata_json(url, retry_params)

    if isinstance(payload, dict) and str(payload.get("status", "")).lower() == "error":
        code = payload.get("code")
        message = payload.get("message") or "TwelveData returned status=error"
        if code is not None:
            raise ValueError(f"TwelveData error ({code}): {message}")
        raise ValueError(f"TwelveData error: {message}")

    return {
        "source": "twelvedata",
        "success": True,
        "error": None,
        "endpoint": endpoint,
        "data": payload,
    }


def load_schema_text(schema_text: str):
    return schema_text


def fetch_chat_history(user_id: int):
    table = settings.chat_history_table
    if not table:
        raise ValueError("CHAT_HISTORY_TABLE is not configured")
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
        raise ValueError("CHAT_HISTORY_TABLE is not configured")
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
            raise ValueError("symbol is required for asset_price_history")
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
    return _run_custom_query_type(query_type, user_id, params)
