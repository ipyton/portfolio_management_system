import json
from uuid import uuid4
from pathlib import Path
from fastapi import FastAPI, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from .llm import call_planner, call_answer
from .tools import (
    serpapi_search,
    twelvedata_search,
    run_query_by_type,
    fetch_chat_history,
    append_chat_message,
    log_tool_call,
)

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parents[2]
SCHEMA_PATH = BASE_DIR / "Chatbot" / "schema"
ECHARTS_PATH = BASE_DIR / "Chatbot" / "ECharts"

SCHEMA_TEXT = SCHEMA_PATH.read_text(encoding="utf-8") if SCHEMA_PATH.exists() else ""
ECHARTS_EXAMPLES = ECHARTS_PATH.read_text(encoding="utf-8") if ECHARTS_PATH.exists() else ""

PLANNER_SYSTEM = """
You are a planner LLM. Output ONLY valid JSON for the plan.
Decide if the question needs: database, web search, or TwelveData search.
Return fields: need_database, need_web_search, need_twelvedata_search,
database_query_type, database_query_params, web_search_query, twelvedata_query,
twelvedata_path, analysis_goal, need_chart, chart_type.
Never generate or suggest any write/insert/update/delete SQL.
""".strip()

ANSWER_SYSTEM = """
You are an answering LLM. Use the provided planner output and tool results.
If a chart is needed, output ECharts-compatible JSON per the provided examples.
Return ONLY JSON with keys: containsGraph, graphOption, text.
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


def _sse_event(event_name: str, data: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(payload: ChatRequest = Body(...)):
    user_prompt = payload.prompt
    user_id = payload.user_id
    system_prompt = payload.system
    request_id = uuid4().hex

    async def event_stream():
        yield _sse_event("planner_started", {"ok": True, "request_id": request_id})

        try:
            append_chat_message(
                user_id=user_id,
                role="user",
                message=user_prompt,
                request_id=request_id,
                metadata_json=json.dumps({"system": system_prompt}, ensure_ascii=False),
            )
        except Exception:
            pass

        try:
            chat_history = fetch_chat_history(user_id)
        except Exception as exc:
            chat_history = []
            yield _sse_event("history_error", {"ok": False, "error": str(exc)})

        planner_input = f"""
SYSTEM_PROMPT:\n{system_prompt}\n
USER_PROMPT:\n{user_prompt}\n
SCHEMA:\n{SCHEMA_TEXT}\n
CHAT_HISTORY:\n{json.dumps(chat_history, ensure_ascii=False)}
""".strip()

        planner_error = None
        try:
            raw_plan = call_planner(PLANNER_SYSTEM, planner_input)
        except Exception as exc:
            planner_error = str(exc)
            raw_plan = {}

        plan = Plan(**raw_plan)
        plan_data = plan.model_dump()
        if planner_error:
            yield _sse_event("planner_error", {"ok": False, "error": planner_error})
        yield _sse_event("planner_done", {"ok": True, "plan": plan_data})

        db_result = {"source": "database", "success": True, "error": None, "data": []}
        web_result = {"source": "web_search", "success": True, "error": None, "data": []}
        td_result = {"source": "twelvedata", "success": True, "error": None, "data": []}

        if plan.need_database:
            try:
                db_data = run_query_by_type(
                    plan.database_query_type,
                    user_id,
                    plan.database_query_params,
                )
                db_result = {"source": "database", "success": True, "error": None, "data": db_data}
            except Exception as exc:
                db_result = {"source": "database", "success": False, "error": str(exc), "data": None}
            try:
                log_tool_call(
                    request_id=request_id,
                    user_id=user_id,
                    tool_name="database",
                    success=db_result["success"],
                    error_message=db_result["error"],
                    input_json=json.dumps(
                        {
                            "query_type": plan.database_query_type,
                            "query_params": plan.database_query_params,
                        },
                        ensure_ascii=False,
                    ),
                    output_json=json.dumps(db_result, ensure_ascii=False),
                )
            except Exception:
                pass

        if plan.need_web_search:
            web_result = serpapi_search(plan.web_search_query)
            try:
                log_tool_call(
                    request_id=request_id,
                    user_id=user_id,
                    tool_name="web_search",
                    success=web_result["success"],
                    error_message=web_result["error"],
                    input_json=json.dumps({"query": plan.web_search_query}, ensure_ascii=False),
                    output_json=json.dumps(web_result, ensure_ascii=False),
                )
            except Exception:
                pass

        if plan.need_twelvedata_search:
            td_result = twelvedata_search(
                plan.twelvedata_query,
                plan.twelvedata_path,
            )
            try:
                log_tool_call(
                    request_id=request_id,
                    user_id=user_id,
                    tool_name="twelvedata",
                    success=td_result["success"],
                    error_message=td_result["error"],
                    input_json=json.dumps(
                        {
                            "query": plan.twelvedata_query,
                            "path": plan.twelvedata_path,
                        },
                        ensure_ascii=False,
                    ),
                    output_json=json.dumps(td_result, ensure_ascii=False),
                )
            except Exception:
                pass

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

        answer_input = f"""
SYSTEM_PROMPT:\n{system_prompt}\n
ANALYSIS_GOAL:\n{plan.analysis_goal}\n
ECHARTS_EXAMPLES:\n{ECHARTS_EXAMPLES}\n
INPUT_DATA:\n{json.dumps(answer_payload, ensure_ascii=False)}
""".strip()

        yield _sse_event("answer_started", {"ok": True})
        answer_error = None
        try:
            result = call_answer(ANSWER_SYSTEM, answer_input)
            try:
                parsed_result = json.loads(result)
            except json.JSONDecodeError:
                parsed_result = {
                    "containsGraph": False,
                    "graphOption": {},
                    "text": result,
                }
        except Exception as exc:
            answer_error = str(exc)
            parsed_result = {
                "containsGraph": False,
                "graphOption": {},
                "text": "模型调用失败，请检查 GEMINI_MODEL 与 GEMINI_API_KEY 配置。",
            }
        if answer_error:
            yield _sse_event("answer_error", {"ok": False, "error": answer_error})

        try:
            append_chat_message(
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
        except Exception:
            pass

        yield _sse_event("answer_done", parsed_result)
        yield _sse_event("done", {"ok": True, "request_id": request_id})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
