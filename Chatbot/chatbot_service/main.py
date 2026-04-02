import asyncio
import json
import threading
from string import hexdigits
from uuid import uuid4
from pathlib import Path
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from .llm import call_planner, call_answer_stream
from .tools import (
    serpapi_search,
    twelvedata_search,
    run_query_by_type,
    fetch_chat_history,
    append_chat_message,
    log_tool_call,
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

BASE_DIR = Path(__file__).resolve().parents[2]
SCHEMA_PATH = BASE_DIR / "Chatbot" / "schema"
ECHARTS_PATH = BASE_DIR / "Chatbot" / "ECharts"

SCHEMA_TEXT = SCHEMA_PATH.read_text(encoding="utf-8") if SCHEMA_PATH.exists() else ""
ECHARTS_EXAMPLES = ECHARTS_PATH.read_text(encoding="utf-8") if ECHARTS_PATH.exists() else ""

PLANNER_QUERY_TYPES = """
portfolio_summary, holdings_detail, cash_balance, portfolio_nav_daily,
trade_history, asset_price_history, watchlist, custom_sql.
""".strip()

PLANNER_SYSTEM = """
You are a planning model for a finance assistant.
Return exactly ONE JSON object and nothing else.
Do NOT output markdown, code fences, comments, trailing commas, or extra keys.

Output schema (all keys required):
{
  "need_database": boolean,
  "need_web_search": boolean,
  "need_twelvedata_search": boolean,
  "database_query_type": string,
  "database_query_params": object,
  "web_search_query": string,
  "twelvedata_query": string,
  "twelvedata_path": string,
  "analysis_goal": string,
  "need_chart": boolean,
  "chart_type": string
}

Decision rules:
1. Use database only when internal portfolio/user/history data is required.
2. Use web search only when up-to-date public web info is required.
3. Use TwelveData only for market/asset endpoints.
4. If need_database=false, set database_query_type="" and database_query_params={}.
5. If need_web_search=false, set web_search_query="".
6. If need_twelvedata_search=false, set twelvedata_query="" and twelvedata_path="".
7. If need_chart=false, set chart_type=""; otherwise choose one of: line, bar, pie, scatter.
8. For TwelveData:
   - if requesting recent trend/candles, use twelvedata_path="time_series"
     and include interval (recommended 1day) in twelvedata_query.
   - if only requesting latest price, use twelvedata_path="price".

Database query policy:
- Preferred query types: __PLANNER_QUERY_TYPES__
- If a predefined type is not enough, you may use a custom query type name.
- For custom queries, put SQL in database_query_params.sql
  or database_query_params.queries.
- SQL MUST be a single read-only SELECT/WITH statement.
- Use named placeholders (for example :user_id, :symbol).
- Never generate write SQL (insert/update/delete/alter/drop/create/truncate/etc).

analysis_goal must be short and task-oriented (1 sentence).
""".replace("__PLANNER_QUERY_TYPES__", PLANNER_QUERY_TYPES).strip()

ANSWER_SYSTEM = """
You are the answering model in a two-stage finance assistant.
Return exactly ONE JSON object and nothing else.
Do NOT output markdown, code fences, comments, or extra keys.

Output schema (all keys required):
{
  "containsGraph": boolean,
  "graphOption": object,
  "text": string
}

Hard requirements:
1. Output MUST be strict RFC8259 JSON.
2. Use only double-quoted strings and keys.
3. graphOption must be pure JSON (no JavaScript functions, no comments, no trailing commas).
4. text must be non-empty, concise, and directly answer the user.
5. If chart is not needed or data is insufficient: containsGraph=false and graphOption={}.
6. If chart is needed and data supports it: containsGraph=true and graphOption is valid ECharts option JSON.
7. Do not invent unavailable factual data. If data is missing, state it clearly in text.

Language policy (non-negotiable):
- Output text MUST be English only.
- Do not output Chinese or mixed-language responses.
""".strip()


class ChatRequest(BaseModel):
    prompt: str
    user_id: int = 0
    system: str = ""


class Plan(BaseModel):
    need_database: bool = False
    need_web_search: bool = False
    need_twelvedata_search: bool = False
    database_query_type: str = ""
    database_query_params: dict = Field(default_factory=dict)
    web_search_query: str = ""
    twelvedata_query: str = ""
    twelvedata_path: str = ""
    analysis_goal: str = ""
    need_chart: bool = False
    chart_type: str = ""


def _normalize_runtime_system_prompt(system_prompt: str) -> str:
    text = (system_prompt or "").strip()
    if not text:
        return ""
    # Bound prompt size to reduce prompt injection/noise from oversized user input.
    return text[:4000]


def _sse_event(event_name: str, data: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


async def _run_blocking(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


async def _stream_from_blocking(generator_factory):
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[str, object]] = asyncio.Queue()

    def worker():
        try:
            for item in generator_factory():
                loop.call_soon_threadsafe(queue.put_nowait, ("data", item))
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc)))
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))

    threading.Thread(target=worker, daemon=True).start()

    while True:
        kind, payload = await queue.get()
        if kind == "data":
            yield payload
        elif kind == "error":
            raise RuntimeError(str(payload))
        else:
            break


def _extract_partial_text_field(raw_json: str) -> str:
    marker = '"text"'
    marker_pos = raw_json.find(marker)
    if marker_pos < 0:
        return ""

    colon_pos = raw_json.find(":", marker_pos + len(marker))
    if colon_pos < 0:
        return ""

    i = colon_pos + 1
    while i < len(raw_json) and raw_json[i].isspace():
        i += 1
    if i >= len(raw_json) or raw_json[i] != '"':
        return ""

    i += 1
    out = []
    escaped = False

    while i < len(raw_json):
        ch = raw_json[i]
        if escaped:
            if ch == "n":
                out.append("\n")
            elif ch == "t":
                out.append("\t")
            elif ch == "r":
                out.append("\r")
            elif ch in {'"', "\\", "/"}:
                out.append(ch)
            elif ch == "u" and i + 4 < len(raw_json):
                code = raw_json[i + 1 : i + 5]
                if all(c in hexdigits for c in code):
                    out.append(chr(int(code, 16)))
                    i += 4
                else:
                    out.append("u")
            else:
                out.append(ch)
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == '"':
            break
        else:
            out.append(ch)
        i += 1

    return "".join(out)


def _parse_json_maybe_fenced(raw_text: str):
    raw = (raw_text or "").strip()
    if not raw:
        raise json.JSONDecodeError("empty", raw, 0)
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines).strip()
    return json.loads(raw)


def _error_payload(stage: str, request_id: str, exc: Exception):
    return {"ok": False, "stage": stage, "request_id": request_id, "error": str(exc)}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(payload: ChatRequest = Body(...)):
    user_prompt = payload.prompt
    user_id = payload.user_id
    system_prompt = payload.system
    runtime_system_prompt = _normalize_runtime_system_prompt(system_prompt)
    request_id = uuid4().hex

    async def event_stream():
        yield _sse_event("planner_started", {"ok": True, "request_id": request_id})

        try:
            await _run_blocking(
                append_chat_message,
                user_id=user_id,
                role="user",
                message=user_prompt,
                request_id=request_id,
                metadata_json=json.dumps({"system": system_prompt}, ensure_ascii=False),
            )
        except Exception as exc:
            yield _sse_event("persistence_error", _error_payload("persist_user_message", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "persist_user_message"})
            return

        try:
            chat_history = await _run_blocking(fetch_chat_history, user_id)
        except Exception as exc:
            yield _sse_event("history_error", _error_payload("fetch_chat_history", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "fetch_chat_history"})
            return

        planner_input = json.dumps(
            {
                "user_prompt": user_prompt,
                "schema": SCHEMA_TEXT,
                "chat_history": chat_history,
            },
            ensure_ascii=False,
            default=str,
        )

        try:
            raw_plan = await _run_blocking(
                call_planner,
                PLANNER_SYSTEM,
                planner_input,
                runtime_system_prompt,
            )
            plan = Plan(**raw_plan)
        except Exception as exc:
            yield _sse_event("planner_error", _error_payload("planner", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "planner"})
            return

        plan_data = plan.model_dump()
        yield _sse_event("planner_done", {"ok": True, "plan": plan_data})

        db_result = {"source": "database", "success": True, "error": None, "data": []}
        web_result = {"source": "web_search", "success": True, "error": None, "data": []}
        td_result = {"source": "twelvedata", "success": True, "error": None, "data": []}

        async def _run_database_tool():
            db_data = await _run_blocking(
                run_query_by_type,
                plan.database_query_type,
                user_id,
                plan.database_query_params,
            )
            result = {"source": "database", "success": True, "error": None, "data": db_data}
            await _run_blocking(
                log_tool_call,
                request_id=request_id,
                user_id=user_id,
                tool_name="database",
                success=result["success"],
                error_message=result["error"],
                input_json=json.dumps(
                    {
                        "query_type": plan.database_query_type,
                        "query_params": plan.database_query_params,
                    },
                    ensure_ascii=False,
                    default=str,
                ),
                output_json=json.dumps(result, ensure_ascii=False, default=str),
            )
            return result

        async def _run_web_tool():
            result = await _run_blocking(serpapi_search, plan.web_search_query)
            await _run_blocking(
                log_tool_call,
                request_id=request_id,
                user_id=user_id,
                tool_name="web_search",
                success=result["success"],
                error_message=result["error"],
                input_json=json.dumps({"query": plan.web_search_query}, ensure_ascii=False, default=str),
                output_json=json.dumps(result, ensure_ascii=False, default=str),
            )
            return result

        async def _run_twelvedata_tool():
            result = await _run_blocking(
                twelvedata_search,
                plan.twelvedata_query,
                plan.twelvedata_path,
            )
            await _run_blocking(
                log_tool_call,
                request_id=request_id,
                user_id=user_id,
                tool_name="twelvedata",
                success=result["success"],
                error_message=result["error"],
                input_json=json.dumps(
                    {
                        "query": plan.twelvedata_query,
                        "path": plan.twelvedata_path,
                    },
                    ensure_ascii=False,
                    default=str,
                ),
                output_json=json.dumps(result, ensure_ascii=False, default=str),
            )
            return result

        tool_tasks: dict[str, asyncio.Task] = {}
        if plan.need_database:
            tool_tasks["database"] = asyncio.create_task(_run_database_tool())
        if plan.need_web_search:
            tool_tasks["web_search"] = asyncio.create_task(_run_web_tool())
        if plan.need_twelvedata_search:
            tool_tasks["twelvedata"] = asyncio.create_task(_run_twelvedata_tool())

        if tool_tasks:
            try:
                task_results = await asyncio.gather(*tool_tasks.values())
            except Exception as exc:
                for task in tool_tasks.values():
                    if not task.done():
                        task.cancel()
                yield _sse_event("tools_error", _error_payload("tools", request_id, exc))
                yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "tools"})
                return

            for key, result in zip(tool_tasks.keys(), task_results):
                if key == "database":
                    db_result = result
                elif key == "web_search":
                    web_result = result
                elif key == "twelvedata":
                    td_result = result

        yield _sse_event(
            "tools_done",
            {
                "ok": True,
                "database": {"success": db_result["success"], "error": db_result["error"]},
                "web": {"success": web_result["success"], "error": web_result["error"]},
                "twelvedata": {"success": td_result["success"], "error": td_result["error"]},
            },
        )

        answer_payload = {
            "user_prompt": user_prompt,
            "plan": plan_data,
            "db_result": db_result,
            "web_result": web_result,
            "twelvedata_result": td_result,
        }

        answer_input = json.dumps(
            {
                "analysis_goal": plan.analysis_goal,
                "echarts_examples": ECHARTS_EXAMPLES,
                "input_data": answer_payload,
            },
            ensure_ascii=False,
            default=str,
        )

        yield _sse_event("answer_started", {"ok": True})
        raw_answer = ""
        streamed_text_emitted = ""
        raw_text_mode = False
        try:
            async for chunk in _stream_from_blocking(
                lambda: call_answer_stream(ANSWER_SYSTEM, answer_input, runtime_system_prompt)
            ):
                chunk_text = str(chunk or "")
                if not chunk_text:
                    continue
                raw_answer += chunk_text

                if not raw_text_mode:
                    stripped = raw_answer.lstrip()
                    if stripped and not stripped.startswith("{"):
                        raw_text_mode = True

                if raw_text_mode:
                    streamed_text_emitted += chunk_text
                    yield _sse_event("answer_delta", {"delta": chunk_text})
                    continue

                preview_text = _extract_partial_text_field(raw_answer)
                if len(preview_text) > len(streamed_text_emitted):
                    delta = preview_text[len(streamed_text_emitted) :]
                    streamed_text_emitted = preview_text
                    if delta:
                        yield _sse_event("answer_delta", {"delta": delta})
        except Exception as exc:
            yield _sse_event("answer_error", _error_payload("answer_stream", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_stream"})
            return

        result = raw_answer.strip()
        if not result:
            exc = ValueError("answer stream returned empty content")
            yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
            return

        try:
            parsed_result = _parse_json_maybe_fenced(result)
        except Exception as exc:
            yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
            return

        if not isinstance(parsed_result, dict):
            exc = ValueError("answer result must be a JSON object")
            yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
            return

        for required_key in ("containsGraph", "graphOption", "text"):
            if required_key not in parsed_result:
                exc = ValueError(f"answer result missing required key: {required_key}")
                yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
                yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
                return

        if not isinstance(parsed_result.get("containsGraph"), bool):
            exc = ValueError("containsGraph must be a boolean")
            yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
            return

        if not isinstance(parsed_result.get("text"), str) or not parsed_result.get("text", "").strip():
            exc = ValueError("text must be a non-empty string")
            yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
            return

        graph_option = parsed_result.get("graphOption")
        if not isinstance(graph_option, dict):
            exc = ValueError("graphOption must be a JSON object")
            yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
            return

        if parsed_result["containsGraph"] and not graph_option:
            exc = ValueError("graphOption must be non-empty when containsGraph=true")
            yield _sse_event("answer_error", _error_payload("answer_parse", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "answer_parse"})
            return

        if not parsed_result["containsGraph"]:
            parsed_result["graphOption"] = {}

        try:
            await _run_blocking(
                append_chat_message,
                user_id=user_id,
                role="assistant",
                message=parsed_result.get("text", ""),
                request_id=request_id,
                metadata_json=json.dumps(
                    {
                        "containsGraph": parsed_result.get("containsGraph", False),
                        "graphOption": parsed_result.get("graphOption", {}),
                    },
                    ensure_ascii=False,
                ),
            )
        except Exception as exc:
            yield _sse_event("persistence_error", _error_payload("persist_assistant_message", request_id, exc))
            yield _sse_event("done", {"ok": False, "request_id": request_id, "stage": "persist_assistant_message"})
            return

        yield _sse_event("answer_done", parsed_result)
        yield _sse_event("done", {"ok": True, "request_id": request_id})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
