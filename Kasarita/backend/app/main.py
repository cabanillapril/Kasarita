from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from typing import Optional

app = FastAPI(title="IntelliVo Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    text: str
    device_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    status: str
    intent: str
    device_id: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    intent, reply = generate_reply(req.text)
    return ChatResponse(reply=reply, status="ok", intent=intent, device_id=req.device_id)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            text = payload.get("text", "")
            device_id = payload.get("device_id")
            intent, reply = generate_reply(text)
            await websocket.send_text(json.dumps({"reply": reply, "status": "ok", "intent": intent, "device_id": device_id}))
    except WebSocketDisconnect:
        pass


def generate_reply(text: str) -> tuple[str, str]:
    text = (text or "").strip()
    lowered = text.lower()
    if not text:
        return "idle", "I didn't catch any speech. Please try again."

    if "reminder" in lowered:
        return "reminder", "I can help you create a reminder."
    if "timer" in lowered:
        return "timer", "I can start a timer for you."
    if "study" in lowered:
        return "study", "Great idea. I can log your study session."

    return "general", f"You said: {text}"
