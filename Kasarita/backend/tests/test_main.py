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


def test_tts_endpoint_reports_missing_voice_model(monkeypatch):
    def missing_voice():
        from app.main import TTSNotConfiguredError
        raise TTSNotConfiguredError("Piper voice model is not configured.")

    monkeypatch.setattr("app.main.get_piper_voice", missing_voice)
    response = client.post("/tts", json={"text": "Hello"})

    assert response.status_code == 503
    assert response.json()["detail"] == "Piper voice model is not configured."


def test_chat_endpoint_returns_intent_and_reply():
    response = client.post(
        "/chat",
        json={"text": "set a reminder for study", "device_id": "dev-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["intent"] == "reminder"
    assert "reminder" in payload["reply"].lower()


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





def test_mcp_tools_can_create_and_complete_task():
    tools_response = client.get("/mcp/tools")
    assert tools_response.status_code == 200
    assert {tool["name"] for tool in tools_response.json()["tools"]} == {
        "create_task",
        "get_tasks",
        "complete_task",
        "delete_task",
        "create_reminder",
        "get_schedule",
    }


    create_response = client.post(
        "/mcp/call",
        json={"name": "create_task", "arguments": {"title": "Math homework"}},
    )
    created_task = create_response.json()["result"]
    assert create_response.json()["status"] == "ok"
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
    create_response = client.post("/tasks", json={"arguments": {"title": "REST task"}})
    assert create_response.json()["status"] == "ok"
    task = create_response.json()["task"]
    assert create_response.json()["status"] == "ok"

    list_response = client.get("/tasks")
    assert any(item["id"] == task["id"] for item in list_response.json()["tasks"])

    update_response = client.patch(
        f"/tasks/{task['id']}",
        json={"arguments": {"status": "completed"}},
    )
    assert update_response.json()["task"]["status"] == "completed"

    delete_response = client.delete(f"/tasks/{task['id']}")
    assert delete_response.json()["status"] == "ok"


def test_voice_command_creates_task_without_ai(monkeypatch):
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "add task Math homework tomorrow")
    response = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})

    payload = response.json()
    assert payload["status"] == "action_completed"
    assert payload["action"]["tool"] == "create_task"
    assert payload["action"]["result"]["title"] == "Math homework"
    assert payload["action"]["result"]["due_date"] == "tomorrow"


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


def test_flexible_voice_task_commands(monkeypatch):
    # 1. New task with flexible prefix
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "new task Read documentation tomorrow")
    res1 = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})
    assert res1.json()["status"] == "action_completed"
    assert res1.json()["action"]["tool"] == "create_task"
    assert res1.json()["action"]["result"]["title"] == "Read documentation"
    assert res1.json()["action"]["result"]["due_date"] == "tomorrow"

    # 2. Add a task to prefix
    monkeypatch.setattr("app.main.transcribe_pcm", lambda audio_bytes: "add a task to study embedded systems")
    res2 = client.post("/audio", content=b"\x00\x00\x01\x00", headers={"Content-Type": "audio/pcm"})
    assert res2.json()["status"] == "action_completed"
    assert res2.json()["action"]["result"]["title"] == "study embedded systems"

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
    assert res5.json()["action"]["result"]["title"] == "finish embedded systems lab"

