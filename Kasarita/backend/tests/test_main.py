from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


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
