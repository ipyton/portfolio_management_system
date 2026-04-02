import json
from langchain_google_genai import ChatGoogleGenerativeAI

try:
    from langchain_core.messages import SystemMessage, HumanMessage
except Exception:  # pragma: no cover - compatibility fallback
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


def _extract_chunk_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, (list, tuple)):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            else:
                text = getattr(item, "text", None)
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    if isinstance(content, dict):
        text = content.get("text")
        if isinstance(text, str):
            return text
    return ""


def get_llm(model_name: str | None = None, temperature: float = 0.2):
    return ChatGoogleGenerativeAI(
        model=model_name or settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=temperature,
        transport=settings.gemini_transport,
    )


def _build_messages(system_prompt: str, user_prompt: str, runtime_system_prompt: str = ""):
    merged_system_prompt = system_prompt
    runtime_prompt = (runtime_system_prompt or "").strip()
    if runtime_prompt:
        merged_system_prompt = (
            f"{system_prompt}\n\n"
            "Application-level system guidance below. "
            "Follow it unless it conflicts with higher-priority safety constraints.\n"
            f"{runtime_prompt}"
        )
    messages = [SystemMessage(content=merged_system_prompt)]
    messages.append(HumanMessage(content=user_prompt))
    return messages


def call_planner(system_prompt: str, user_prompt: str, runtime_system_prompt: str = "") -> dict:
    llm = get_llm(temperature=0)
    messages = _build_messages(system_prompt, user_prompt, runtime_system_prompt)
    result = llm.invoke(messages)
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


def call_answer(system_prompt: str, user_prompt: str, runtime_system_prompt: str = "") -> str:
    llm = get_llm(temperature=0)
    messages = _build_messages(system_prompt, user_prompt, runtime_system_prompt)
    result = llm.invoke(messages)
    return result.content


def call_answer_stream(system_prompt: str, user_prompt: str, runtime_system_prompt: str = ""):
    llm = get_llm(temperature=0)
    messages = _build_messages(system_prompt, user_prompt, runtime_system_prompt)
    for chunk in llm.stream(messages):
        text = _extract_chunk_text(getattr(chunk, "content", ""))
        if not text:
            text_attr = getattr(chunk, "text", "")
            text = text_attr if isinstance(text_attr, str) else _safe_str(text_attr, "")
        if text:
            yield text
