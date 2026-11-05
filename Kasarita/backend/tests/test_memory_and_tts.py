import pytest
from app.mcp import clean_for_speech, add_memory_message, get_memory_messages, clear_memory, initialize_database
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_clean_for_speech_strips_markdown_and_robot_characters():
    dirty_text = (
        "### Hello!\n\n"
        "Here are your tasks:\n"
        "* **Study** for *math* exam\n"
        "- Complete assignment ***today***\n"
        "---\n"
        "`print('hello')`\n"
        "Keep up the great work! 👍 🎉"
    )
    cleaned = clean_for_speech(dirty_text)
    assert "#" not in cleaned
    assert "*" not in cleaned
    assert "-" not in cleaned
    assert "`" not in cleaned
    assert "Study for math exam" in cleaned
    assert "Complete assignment today" in cleaned
    assert "Keep up the great work!" in cleaned


def test_conversation_memory_storage_and_retrieval(tmp_path, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setenv("KASARITA_DB_PATH", str(tmp_path / "memory_test.db"))
    initialize_database()

    session_id = "test_user_session"
    clear_memory(session_id)

    add_memory_message(session_id, "user", "My name is John.")
    add_memory_message(session_id, "assistant", "Nice to meet you, John!")
    add_memory_message(session_id, "user", "What is my name?")

    messages = get_memory_messages(session_id, limit=10)
    assert len(messages) == 3
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "My name is John."
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == "Nice to meet you, John!"
    assert messages[2]["role"] == "user"
    assert messages[2]["content"] == "What is my name?"

    # Test REST endpoints
    get_res = client.get(f"/memory?session_id={session_id}")
    assert get_res.status_code == 200
    assert len(get_res.json()["messages"]) == 3

    del_res = client.delete(f"/memory?session_id={session_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "ok"

    empty_messages = get_memory_messages(session_id, limit=10)
    assert len(empty_messages) == 0
