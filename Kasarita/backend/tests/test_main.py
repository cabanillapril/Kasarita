from fastapi.testclient import TestClient
from types import SimpleNamespace

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_tts_endpoint_returns_16khz_pcm(monkeypatch):
    audio = b"\x01\x00\x02\x00\x03\x00\x04\x00"
    chunk = SimpleNamespace(
        audio_int16_bytes=audio,
        sample_rate=16000,
        sample_width=2,
        sample_channels=1,
    )
    voice = SimpleNamespace(synthesize=lambda text: iter([chunk]))
    monkeypatch.setattr("app.main.get_piper_voice", lambda: voice)

    response = client.post("/tts", json={"text": "Hello Kasarita"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/pcm"
    assert response.headers["x-audio-sample-rate"] == "16000"
    assert response.content == audio


def test_ai_completion_retries_when_answer_hits_token_limit(monkeypatch):
    import asyncio
    from app.main import ensure_terminal_punctuation, request_ai_completion

    token_limits = []

    class FakeResponse:
        def __init__(self, finish_reason, content):
            self.finish_reason = finish_reason
            self.content = content

        def raise_for_status(self):
            pass

        def json(self):
            return {
                "choices": [{
                    "finish_reason": self.finish_reason,
                    "message": {"content": self.content},
                }]
            }

    class FakeAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_value, traceback):
            pass

        async def post(self, url, headers, json):
            token_limits.append(json["max_tokens"])
            if len(token_limits) == 1:
                return FakeResponse("length", "This answer was cut")
            return FakeResponse("stop", "This answer was cut off and is now complete.")

    monkeypatch.setattr("app.main.httpx.AsyncClient", FakeAsyncClient)
    choice = asyncio.run(request_ai_completion("https://example.test/v1", {}))

    assert token_limits == [512, 768]
    assert choice["message"]["content"].endswith(".")
    assert ensure_terminal_punctuation("A complete thought") == "A complete thought."
    assert ensure_terminal_punctuation("Already complete!") == "Already complete!"


def test_tts_endpoint_reports_missing_voice_model(monkeypatch):
    def missing_voice():
        from app.main import TTSNotConfiguredError
        raise TTSNotConfiguredError("Piper voice model is not configured.")

    monkeypatch.setattr("app.main.get_piper_voice", missing_voice)
    response = client.post("/tts", json={"text": "Hello"})

    assert response.status_code == 503
    assert response.json()["detail"] == "Piper voice model is not configured."


def test_chat_endpoint_returns_intent_and_reply(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "chat-reminders.db"))
    response = client.post(
        "/chat",
        json={"text": "set a reminder for study on November 10, 2030", "device_id": "dev-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["intent"] == "command"
    assert payload["reply"] == "I created a reminder for study on November 10, 2030."


def test_websocket_chat_creates_reminder_visible_in_rest_endpoint(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "websocket-reminders.db"))

    with client.websocket_connect("/ws") as websocket:
        websocket.send_json({"text": "set a reminder for study on November 10, 2030"})
        payload = websocket.receive_json()

    assert payload["status"] == "action_completed"
    assert payload["tool"] == "create_reminder"
    reminders = client.get("/reminders").json()["reminders"]
    assert len(reminders) == 1
    assert reminders[0]["title"] == "study"
    assert reminders[0]["remind_at"] == "2030-11-10"


def test_audio_endpoint_accepts_16_bit_pcm(monkeypatch):
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: None)
    response = client.post(
        "/audio",
        content=b"\x00\x00\x01\x00",
        headers={"Content-Type": "audio/pcm", "X-Device-Id": "dev-1"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "status": "accepted",
        "message": "Audio received; speech recognition is not configured.",
        "bytes_received": 4,
        "transcript": None,
        "answer": None,
        "action": None,
        "device_id": "dev-1",
    }


def test_audio_endpoint_rejects_unknown_format():
    response = client.post("/audio", content=b"audio", headers={"Content-Type": "audio/wav"})
    assert response.status_code == 200
    assert response.json()["status"] == "error"


def test_audio_endpoint_returns_ai_answer(monkeypatch):
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "How do Python loops work?")

    async def fake_ai_route(transcript, bytes_received, device_id):
        return None

    async def fake_tutor(question):
        assert question == "How do Python loops work?"
        return "answered", "A loop repeats a block of code."

    monkeypatch.setattr("app.main.ai_route_and_execute", fake_ai_route)
    monkeypatch.setattr("app.main.ask_ai_tutor", fake_tutor)
    response = client.post(
        "/audio",
        content=b"\x00\x00\x01\x00",
        headers={"Content-Type": "audio/pcm"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "answered"
    assert response.json()["transcript"] == "How do Python loops work?"
    assert response.json()["answer"] == "A loop repeats a block of code."





def test_mcp_tools_can_create_and_complete_task(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "mcp-tasks.db"))
    tools_response = client.get("/mcp/tools")
    assert tools_response.status_code == 200
    assert {tool["name"] for tool in tools_response.json()["tools"]} == {
        "create_task",
        "get_tasks",
        "complete_task",
        "delete_task",
        "create_reminder",
        "get_schedule",
        "complete_reminder",
        "delete_reminder",
    }


    create_response = client.post(
        "/mcp/call",
        json={"name": "create_task", "arguments": {"title": "math homework"}},
    )
    created_task = create_response.json()["result"]
    assert create_response.json()["status"] == "ok"
    assert created_task["title"] == "Math homework"
    assert created_task["status"] == "pending"

    complete_response = client.post(
        "/mcp/call",
        json={"name": "complete_task", "arguments": {"task_id": created_task["id"]}},
    )
    assert complete_response.json()["result"]["status"] == "completed"


def test_mcp_rejects_unknown_tools():
    response = client.post("/mcp/call", json={"name": "delete_everything", "arguments": {}})
    assert response.json()["status"] == "error"


def test_task_rest_endpoints(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "tasks.db"))
    create_response = client.post(
        "/tasks",
        json={"arguments": {"title": "REST task", "subject": "Programming"}},
    )
    assert create_response.json()["status"] == "ok"
    task = create_response.json()["task"]
    assert task["subject"] == "Programming"
    assert create_response.json()["status"] == "ok"

    list_response = client.get("/tasks")
    assert any(item["id"] == task["id"] for item in list_response.json()["tasks"])

    update_response = client.patch(
        f"/tasks/{task['id']}",
        json={"arguments": {"title": "updated task title", "status": "completed", "subject": "Algorithms"}},
    )
    assert update_response.json()["task"]["title"] == "Updated task title"
    assert update_response.json()["task"]["status"] == "completed"
    assert update_response.json()["task"]["subject"] == "Algorithms"

    delete_response = client.delete(f"/tasks/{task['id']}")
    assert delete_response.json()["status"] == "ok"


def test_legacy_task_database_adds_default_subject(tmp_path, monkeypatch):
    import sqlite3
    from app.mcp import get_tasks

    database_path = tmp_path / "legacy-tasks.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, due_date TEXT, "
            "priority TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)"
        )
        connection.execute(
            "INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?)",
            ("legacy-task", "Old task", None, "normal", "pending", "2030-01-01T00:00:00+00:00"),
        )
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(database_path))

    assert get_tasks()[0]["subject"] == "General"


def test_create_voice_task_works_with_legacy_supabase_schema(monkeypatch):
    from app.mcp import create_task

    requests = []

    def fake_supabase_request(method, table, **kwargs):
        requests.append(kwargs["json"])
        if "subject" in kwargs["json"]:
            raise ValueError("Supabase returned HTTP 400: Could not find the 'subject' column in the schema cache")
        return [{**kwargs["json"]}]

    monkeypatch.setattr("app.mcp.use_supabase", lambda: True)
    monkeypatch.setattr("app.mcp.supabase_request", fake_supabase_request)

    task = create_task("Call Mom")

    assert len(requests) == 2
    assert "subject" in requests[0]
    assert "subject" not in requests[1]
    assert task["subject"] == "General"


def test_update_task_works_with_legacy_supabase_schema(monkeypatch):
    from app.mcp import update_task

    requests = []

    def fake_supabase_request(method, table, **kwargs):
        requests.append(kwargs["json"])
        if "subject" in kwargs["json"]:
            raise ValueError("Supabase returned HTTP 400: Could not find the 'subject' column in the schema cache")
        return [{"id": "task-1", **kwargs["json"]}]

    monkeypatch.setattr("app.mcp.use_supabase", lambda: True)
    monkeypatch.setattr("app.mcp.find_task_id", lambda task_id: task_id)
    monkeypatch.setattr("app.mcp.supabase_request", fake_supabase_request)

    task = update_task("task-1", {"title": "Renamed task", "subject": "General"})

    assert len(requests) == 2
    assert requests[0]["title"] == "Renamed task"
    assert "subject" in requests[0]
    assert requests[1]["title"] == "Renamed task"
    assert "subject" not in requests[1]
    assert task["title"] == "Renamed task"
    assert task["subject"] == "General"


def test_custom_subject_requires_updated_supabase_schema(monkeypatch):
    from app.mcp import create_task

    def fake_supabase_request(method, table, **kwargs):
        raise ValueError("Could not find the 'subject' column in the schema cache")

    monkeypatch.setattr("app.mcp.use_supabase", lambda: True)
    monkeypatch.setattr("app.mcp.supabase_request", fake_supabase_request)

    try:
        create_task("Call Mom", subject="Programming")
    except ValueError as error:
        assert "Run backend/supabase_schema.sql" in str(error)
    else:
        raise AssertionError("Expected updated Supabase schema to be required")


def test_reminders_rest_endpoint(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "reminders.db"))
    create_response = client.post(
        "/mcp/call",
        json={"name": "create_reminder", "arguments": {"title": "Call Mom", "remind_at": "2030-11-10"}},
    )
    assert create_response.json()["status"] == "ok"
    reminder = create_response.json()["result"]

    list_response = client.get("/reminders")
    assert list_response.json()["reminders"] == [reminder]
    assert reminder["status"] == "pending"

    complete_response = client.patch(f"/reminders/{reminder['id']}")
    assert complete_response.json()["status"] == "ok"
    assert complete_response.json()["reminder"]["status"] == "completed"
    assert client.get("/reminders").json()["reminders"][0]["status"] == "completed"

    delete_response = client.delete(f"/reminders/{reminder['id']}")
    assert delete_response.json()["status"] == "ok"
    assert client.get("/reminders").json()["reminders"] == []


def test_existing_reminder_database_gets_pending_status_migration(tmp_path, monkeypatch):
    import sqlite3
    from app.mcp import get_schedule

    database_path = tmp_path / "legacy-reminders.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "CREATE TABLE reminders (id TEXT PRIMARY KEY, title TEXT NOT NULL, remind_at TEXT, created_at TEXT NOT NULL)"
        )
        connection.execute(
            "INSERT INTO reminders VALUES (?, ?, ?, ?)",
            ("reminder-1", "Call Mom", None, "2030-01-01T00:00:00+00:00"),
        )

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(database_path))

    assert get_schedule() == [{
        "id": "reminder-1",
        "title": "Call Mom",
        "remind_at": None,
        "created_at": "2030-01-01T00:00:00+00:00",
        "status": "pending",
    }]


def test_voice_command_creates_task_without_ai(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "voice-task.db"))
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "add task Math homework tomorrow")
    response = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})

    payload = response.json()
    assert payload["status"] == "action_completed"
    assert payload["action"]["tool"] == "create_task"
    assert payload["action"]["result"]["title"] == "Math homework"
    from app.mcp import resolve_calendar_date
    assert payload["action"]["result"]["due_date"] == resolve_calendar_date("tomorrow")


def test_set_up_review_tasks_voice_command_creates_task_not_reminder(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "review-tasks.db"))
    monkeypatch.setattr(
        "app.main.transcribe_pcm",
        lambda audio_bytes: "I've set up the review tasks for programming languages on November 15, 2026",
    )

    response = client.post(
        "/audio",
        content=b"\x00\x00\x01\x00",
        headers={"Content-Type": "audio/pcm", "X-Device-Id": "esp32-s3"},
    )

    payload = response.json()
    assert payload["status"] == "action_completed"
    assert payload["action"]["tool"] == "create_task"
    assert payload["action"]["result"]["title"] == "Review tasks for programming languages"
    assert payload["action"]["result"]["due_date"] == "2026-11-15"
    assert len(client.get("/tasks").json()["tasks"]) == 1
    assert client.get("/reminders").json()["reminders"] == []


def test_command_storage_failure_does_not_claim_task_was_saved(monkeypatch):
    monkeypatch.setattr(
        "app.main.call_tool",
        lambda tool_name, arguments: (_ for _ in ()).throw(ValueError("Storage unavailable")),
    )

    response = client.post("/chat", json={"text": "set up review tasks"})

    assert response.status_code == 200
    assert response.json()["status"] == "error"
    assert "couldn't save" in response.json()["reply"].lower()


def test_spoken_calendar_dates_resolve_in_utc_calendar():
    from datetime import date
    from app.mcp import extract_calendar_date, interpret_command

    today = date(2026, 11, 10)
    assert extract_calendar_date("Finish report due on November 10", today) == (
        "Finish report",
        "2026-11-10",
    )
    assert extract_calendar_date("Finish report tomorrow", today) == (
        "Finish report",
        "2026-11-11",
    )
    assert extract_calendar_date("Finish report today", today) == (
        "Finish report",
        "2026-11-10",
    )
    assert extract_calendar_date("Finish report on Thursday", today) == (
        "Finish report",
        "2026-11-12",
    )
    assert extract_calendar_date("Finish report on Tuesday", today) == (
        "Finish report",
        "2026-11-17",
    )
    assert extract_calendar_date("Finish report by November 9", today) == (
        "Finish report",
        "2027-11-09",
    )
    assert extract_calendar_date("Finish report due on November tenth", today) == (
        "Finish report",
        "2026-11-10",
    )

    assert interpret_command("remind me to call Mom on Thursday") == (
        "create_reminder",
        {"title": "call Mom", "remind_at": "2026-11-12"},
    )
    assert interpret_command("remind me about my dentist appointment tomorrow") == (
        "create_reminder",
        {"title": "dentist appointment", "remind_at": "2026-11-11"},
    )
    assert interpret_command("add task about my programming assignment tomorrow") == (
        "create_task",
        {"title": "programming assignment", "due_date": "2026-11-11"},
    )
    assert interpret_command("set up review tasks for programming languages on November 15, 2026") == (
        "create_task",
        {"title": "review tasks for programming languages", "due_date": "2026-11-15"},
    )
    assert interpret_command("I've set up the review tasks for programming languages on November 15, 2026") == (
        "create_task",
        {"title": "review tasks for programming languages", "due_date": "2026-11-15"},
    )


def test_task_and_reminder_tools_normalize_spoken_dates(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "calendar.db"))
    from app.mcp import create_reminder, create_task, resolve_calendar_date, update_task

    task = create_task("about my Finish report due on November 10, 2030")
    assert task["title"] == "Finish report"
    assert task["due_date"] == "2030-11-10"
    updated = update_task(task["id"], {"due_date": "November 11, 2030"})
    assert updated["due_date"] == "2030-11-11"

    reminder = create_reminder("about my Call Mom tomorrow")
    assert reminder["title"] == "Call Mom"
    assert reminder["remind_at"] == resolve_calendar_date("tomorrow")


def test_create_reminder_retries_legacy_supabase_without_status(monkeypatch):
    from app.mcp import create_reminder

    requests = []

    def fake_supabase_request(method, table, **kwargs):
        requests.append(kwargs["json"])
        if "status" in kwargs["json"]:
            raise ValueError("Supabase returned HTTP 400: Could not find the 'status' column in the schema cache")
        return [{**kwargs["json"]}]

    monkeypatch.setattr("app.mcp.use_supabase", lambda: True)
    monkeypatch.setattr("app.mcp.supabase_request", fake_supabase_request)

    reminder = create_reminder("Call Mom", "2030-11-10")

    assert len(requests) == 2
    assert "status" in requests[0]
    assert "status" not in requests[1]
    assert reminder["status"] == "pending"


def test_create_reminder_does_not_retry_other_supabase_errors(monkeypatch):
    from app.mcp import create_reminder

    def fake_supabase_request(method, table, **kwargs):
        raise ValueError("Could not reach Supabase")

    monkeypatch.setattr("app.mcp.use_supabase", lambda: True)
    monkeypatch.setattr("app.mcp.supabase_request", fake_supabase_request)

    try:
        create_reminder("Call Mom", "2030-11-10")
    except ValueError as error:
        assert str(error) == "Could not reach Supabase"
    else:
        raise AssertionError("Expected the Supabase error to be raised")


def test_voice_question_still_uses_ai(monkeypatch):
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "How do Python loops work?")

    async def fake_ai_route(transcript, bytes_received, device_id):
        return None

    async def fake_tutor(question):
        return "answered", "A loop repeats code."

    monkeypatch.setattr("app.main.ai_route_and_execute", fake_ai_route)
    monkeypatch.setattr("app.main.ask_ai_tutor", fake_tutor)
    response = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})

    assert response.json()["status"] == "answered"
    assert response.json()["answer"] == "A loop repeats code."





def test_mcp_data_survives_module_reload(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "kasarita.db"))
    import importlib
    import app.mcp as mcp

    importlib.reload(mcp)
    created = mcp.create_task("Persistent task")
    importlib.reload(mcp)

    saved_tasks = mcp.get_tasks()
    assert any(task["id"] == created["id"] for task in saved_tasks)


def test_ask_requires_configuration(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/ask", json={"question": "How do Python loops work?"})
    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"


def test_ask_rejects_empty_questions():
    response = client.post("/ask", json={"question": "   "})
    assert response.status_code == 200
    assert response.json()["status"] == "error"


def test_flexible_voice_task_commands(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "flexible-voice-tasks.db"))
    # 1. New task with flexible prefix
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "new task Read documentation tomorrow")
    res1 = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})
    assert res1.json()["status"] == "action_completed"
    assert res1.json()["action"]["tool"] == "create_task"
    assert res1.json()["action"]["result"]["title"] == "Read documentation"
    from app.mcp import resolve_calendar_date
    assert res1.json()["action"]["result"]["due_date"] == resolve_calendar_date("tomorrow")

    # 2. Add a task to prefix
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "add a task to study embedded systems")
    res2 = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})
    assert res2.json()["status"] == "action_completed"
    assert res2.json()["action"]["result"]["title"] == "Study embedded systems"

    # 3. List tasks
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "show tasks")
    res3 = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})
    assert res3.json()["status"] == "action_completed"
    assert res3.json()["action"]["tool"] == "get_tasks"

    # 5. Punctuated transcript from Whisper (e.g. comma after task)
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "Add task, finish embedded systems lab.")
    res5 = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})
    assert res5.json()["status"] == "action_completed"
    assert res5.json()["action"]["tool"] == "create_task"
    assert res5.json()["action"]["result"]["title"] == "Finish embedded systems lab"
