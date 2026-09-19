import io
import os
import wave
from functools import lru_cache

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel, Field
import json
from starlette.concurrency import run_in_threadpool
from typing import Any, Optional
from dotenv import load_dotenv
from .mcp import call_tool, get_tasks, initialize_database, interpret_command, TOOL_DEFINITIONS

load_dotenv()
initialize_database()

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

class AskRequest(BaseModel):
    question: str
    device_id: Optional[str] = None

class AskResponse(BaseModel):
    status: str
    answer: str
    device_id: Optional[str] = None

class AudioResponse(BaseModel):
    status: str
    message: str
    bytes_received: int
    transcript: Optional[str] = None
    answer: Optional[str] = None
    action: Optional[dict[str, Any]] = None
    device_id: Optional[str] = None

class ToolCallRequest(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)

class TaskRequest(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    intent, reply = generate_reply(req.text)
    return ChatResponse(reply=reply, status="ok", intent=intent, device_id=req.device_id)

@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        return AskResponse(
            status="error",
            answer="Please ask a question.",
            device_id=req.device_id,
        )

    status, answer = await ask_ai_tutor(question)
    return AskResponse(status=status, answer=answer, device_id=req.device_id)


async def ask_ai_tutor(question: str) -> tuple[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "not_configured", "AI tutoring is not configured yet. Set OPENAI_API_KEY in the backend environment."

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Kasarita, a patient programming tutor for students. "
                    "Explain concepts clearly, use small examples, and guide the student "
                    "instead of doing graded work dishonestly."
                ),
            },
            {"role": "user", "content": question},
        ],
        "temperature": 0.3,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
        response.raise_for_status()
        answer = response.json()["choices"][0]["message"]["content"].strip()
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 429:
            return (
                "rate_limited",
                "The AI tutor is temporarily unavailable because the provider limit was reached. "
                "Please check the API account quota or try again later.",
            )
        return "error", f"The AI provider returned HTTP {error.response.status_code}."
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
        return "error", f"I could not reach the AI tutor: {error}"

    return "answered", answer

@app.get("/mcp/tools")
def list_mcp_tools():
    return {"tools": TOOL_DEFINITIONS}

@app.post("/mcp/call")
def call_mcp_tool(req: ToolCallRequest):
    try:
        result = call_tool(req.name, req.arguments)
    except (TypeError, ValueError) as error:
        return {"status": "error", "tool": req.name, "error": str(error)}
    return {"status": "ok", "tool": req.name, "result": result}

@app.get("/tasks")
def list_tasks():
    return {"tasks": get_tasks()}

@app.post("/tasks")
def create_task_endpoint(req: TaskRequest):
    try:
        result = call_tool("create_task", req.arguments)
    except (TypeError, ValueError) as error:
        return {"status": "error", "error": str(error)}
    return {"status": "ok", "task": result}

@app.patch("/tasks/{task_id}")
def update_task_endpoint(task_id: str, req: TaskRequest):
    try:
        result = call_tool("update_task", {"task_id": task_id, "fields": req.arguments})
    except (TypeError, ValueError) as error:
        return {"status": "error", "error": str(error)}
    return {"status": "ok", "task": result}

@app.delete("/tasks/{task_id}")
def delete_task_endpoint(task_id: str):
    try:
        call_tool("delete_task", {"task_id": task_id})
    except (TypeError, ValueError) as error:
        return {"status": "error", "error": str(error)}
    return {"status": "ok", "task_id": task_id}

@app.post("/audio", response_model=AudioResponse)
async def audio(request: Request):
    content_type = request.headers.get("content-type", "")
    if content_type.split(";", 1)[0].lower() != "audio/pcm":
        return AudioResponse(
            status="error",
            message="Expected audio/pcm audio data.",
            bytes_received=0,
            device_id=request.headers.get("x-device-id"),
        )

    audio_bytes = await request.body()
    if not audio_bytes or len(audio_bytes) % 2:
        return AudioResponse(
            status="error",
            message="Audio must contain non-empty 16-bit PCM samples.",
            bytes_received=len(audio_bytes),
            device_id=request.headers.get("x-device-id"),
        )

    try:
        transcript = await run_in_threadpool(transcribe_pcm, audio_bytes)
    except Exception as error:
        return AudioResponse(
            status="error",
            message=f"Speech recognition failed: {error}",
            bytes_received=len(audio_bytes),
            device_id=request.headers.get("x-device-id"),
        )
    if transcript is None:
        return AudioResponse(
            status="accepted",
            message="Audio received; speech recognition is not configured.",
            bytes_received=len(audio_bytes),
            device_id=request.headers.get("x-device-id"),
        )

    if not transcript:
        return AudioResponse(
            status="transcribed",
            message="No speech was detected.",
            bytes_received=len(audio_bytes),
            transcript="",
            device_id=request.headers.get("x-device-id"),
        )

    command = interpret_command(transcript)
    if command is not None:
        tool_name, arguments = command
        try:
            result = call_tool(tool_name, arguments)
        except (TypeError, ValueError) as error:
            return AudioResponse(
                status="error",
                message=str(error),
                bytes_received=len(audio_bytes),
                transcript=transcript,
                device_id=request.headers.get("x-device-id"),
            )
        action = {"tool": tool_name, "result": result}
        return AudioResponse(
            status="action_completed",
            message=f"Completed {tool_name.replace('_', ' ')}.",
            bytes_received=len(audio_bytes),
            transcript=transcript,
            answer=action["result"].get("title", "Done") if isinstance(action["result"], dict) else "Done",
            action=action,
            device_id=request.headers.get("x-device-id"),
        )

    ai_status, answer = await ask_ai_tutor(transcript)

    return AudioResponse(
        status=ai_status,
        message="Speech recognized and answered." if ai_status == "answered" else answer,
        bytes_received=len(audio_bytes),
        transcript=transcript,
        answer=answer,
        device_id=request.headers.get("x-device-id"),
    )


@lru_cache(maxsize=1)
def get_transcription_model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.getenv("WHISPER_MODEL", "base.en"),
        device="cpu",
        compute_type="int8",
    )


def transcribe_pcm(audio_bytes: bytes) -> Optional[str]:
    try:
        model = get_transcription_model()
    except ImportError:
        return None

    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(audio_bytes)
    wav_buffer.seek(0)

    segments, _ = model.transcribe(wav_buffer, beam_size=5, vad_filter=True)
    return " ".join(segment.text.strip() for segment in segments).strip()

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
