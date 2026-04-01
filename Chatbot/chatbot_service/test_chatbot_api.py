import argparse
import json
import sys
from typing import Any

import requests
from fastapi.testclient import TestClient


def test_health(base_url: str, timeout: int) -> bool:
    url = f"{base_url}/health"
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    ok = data.get("status") == "ok"
    print(f"[health] status_code={resp.status_code}, body={data}")
    return ok


def _parse_sse_line(line: str) -> tuple[str | None, Any | None]:
    if line.startswith("event:"):
        return "event", line.split(":", 1)[1].strip()
    if line.startswith("data:"):
        raw = line.split(":", 1)[1].strip()
        try:
            return "data", json.loads(raw)
        except json.JSONDecodeError:
            return "data", raw
    return None, None


def test_chat_sse(base_url: str, prompt: str, user_id: int, system: str, timeout: int) -> bool:
    url = f"{base_url}/chat"
    payload = {
        "prompt": prompt,
        "user_id": user_id,
        "system": system,
    }

    with requests.post(url, json=payload, stream=True, timeout=timeout) as resp:
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        print(f"[chat] status_code={resp.status_code}, content_type={content_type}")

        if "text/event-stream" not in content_type.lower():
            print("[chat] invalid content type, expected text/event-stream")
            return False

        current_event = None
        seen_done = False
        seen_answer_done = False

        for raw_line in resp.iter_lines(decode_unicode=True):
            if raw_line is None:
                continue
            line = raw_line.strip()
            if not line:
                continue

            kind, value = _parse_sse_line(line)
            if kind == "event":
                current_event = value
                print(f"[sse] event={current_event}")
            elif kind == "data":
                print(f"[sse] data={value}")
                if current_event == "answer_done":
                    seen_answer_done = isinstance(value, dict) and "text" in value
                if current_event == "done":
                    seen_done = True
                    break

        return seen_done and seen_answer_done


def test_inprocess(prompt: str, user_id: int, system: str) -> bool:
    from chatbot_service.main import app

    with TestClient(app) as client:
        health_resp = client.get("/health")
        health_resp.raise_for_status()
        print(f"[health-inprocess] status_code={health_resp.status_code}, body={health_resp.json()}")

        chat_resp = client.post(
            "/chat",
            json={"prompt": prompt, "user_id": user_id, "system": system},
            headers={"accept": "text/event-stream"},
        )
        chat_resp.raise_for_status()

        body = chat_resp.text
        print("[chat-inprocess] raw_sse_preview=")
        print("\n".join(body.splitlines()[:20]))

        return "event: answer_done" in body and "event: done" in body


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test for chatbot FastAPI service")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--prompt", default="请分析我当前组合并给出建议")
    parser.add_argument("--user-id", type=int, default=1)
    parser.add_argument("--system", default="你是专业投研助手")
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--inprocess", action="store_true")
    args = parser.parse_args()

    try:
        if args.inprocess:
            ok = test_inprocess(args.prompt, args.user_id, args.system)
            if ok:
                print("✅ chatbot in-process smoke test passed")
                return 0
            print("❌ chatbot in-process smoke test failed")
            return 2

        health_ok = test_health(args.base_url, args.timeout)
        chat_ok = test_chat_sse(
            args.base_url,
            args.prompt,
            args.user_id,
            args.system,
            args.timeout,
        )
    except Exception as exc:
        print(f"[error] {exc}")
        return 1

    if health_ok and chat_ok:
        print("✅ chatbot smoke test passed")
        return 0

    print("❌ chatbot smoke test failed")
    return 2


if __name__ == "__main__":
    sys.exit(main())
