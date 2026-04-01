import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import SystemMessage, HumanMessage
from .config import settings


def _extract_json(text: str) -> dict:
    raw = (text or "").strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines).strip()
    return json.loads(raw)


def _safe_str(value, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return ", ".join(str(v) for v in value)
    return str(value)


def _safe_bool(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return bool(value)


def _safe_dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def get_llm(model_name: str | None = None, temperature: float = 0.2):
    return ChatGoogleGenerativeAI(
        model=model_name or settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=temperature,
        transport=settings.gemini_transport,
    )


def call_planner(system_prompt: str, user_prompt: str) -> dict:
    llm = get_llm(temperature=0)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    result = llm.invoke(messages)
    try:
        parsed = _extract_json(result.content)
        return {
            "need_database": _safe_bool(parsed.get("need_database", False)),
            "need_web_search": _safe_bool(parsed.get("need_web_search", False)),
            "need_twelvedata_search": _safe_bool(parsed.get("need_twelvedata_search", False)),
            "database_query_type": _safe_str(parsed.get("database_query_type", "")),
            "database_query_params": _safe_dict(parsed.get("database_query_params", {})),
            "web_search_query": _safe_str(parsed.get("web_search_query", "")),
            "twelvedata_query": _safe_str(parsed.get("twelvedata_query", "")),
            "twelvedata_path": _safe_str(parsed.get("twelvedata_path", "")),
            "analysis_goal": _safe_str(parsed.get("analysis_goal", "")),
            "need_chart": _safe_bool(parsed.get("need_chart", False)),
            "chart_type": _safe_str(parsed.get("chart_type", "")),
        }
    except json.JSONDecodeError:
        return {
            "need_database": False,
            "need_web_search": False,
            "need_twelvedata_search": False,
            "database_query_type": "",
            "database_query_params": {},
            "web_search_query": "",
            "twelvedata_query": "",
            "twelvedata_path": "",
            "analysis_goal": "",
            "need_chart": False,
            "chart_type": "",
        }


def call_answer(system_prompt: str, user_prompt: str) -> str:
    llm = get_llm(temperature=0.2)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    result = llm.invoke(messages)
    return result.content
