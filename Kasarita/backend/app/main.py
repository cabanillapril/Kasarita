import io
import logging
import os
import sys
import wave
from array import array
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import httpx
from pydantic import BaseModel, Field
import json
from starlette.concurrency import run_in_threadpool
from typing import Any, Optional
from dotenv import load_dotenv
from .mcp import (
    call_tool,
    get_tasks,
    initialize_database,
    interpret_command,
    TOOL_DEFINITIONS,
    OPENAI_TOOL_DEFINITIONS,
    clean_for_speech,
    add_memory_message,
    get_memory_messages,
    clear_memory,
)

load_dotenv()
initialize_database()
logger = logging.getLogger(__name__)
TTS_SAMPLE_RATE = 16000

SYSTEM_PROMPT = (
    "You are Kasarita, a friendly, warm, and concise AI study companion and voice assistant for students. "
    "Guidelines: "
    "1. Speak naturally in conversational, friendly English. "
    "2. Keep your answers brief and punchy, usually in 1 to 3 short sentences. Avoid long lectures or essays. "
    "3. NEVER use markdown symbols, asterisks (*), hashtags (#), dashes (-), bullet points, numbered lists, backticks, or robotic formatting. "
    "4. Your response will be read aloud by Text-To-Speech (TTS), so make every word sound natural when spoken out loud. "
    "5. Maintain context from previous turns in our conversation."
)


# ── WebSocket connection manager ──────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active = [w for w in self.active if w is not ws]

    async def broadcast(self, payload: dict):
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Kasarita Backend", version="0.1.0")

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
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    status: str
    intent: str
    device_id: Optional[str] = None

class AskRequest(BaseModel):
    question: str
    device_id: Optional[str] = None
    session_id: Optional[str] = None

class AskResponse(BaseModel):
    status: str
    answer: str
    device_id: Optional[str] = None

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=600)

class TTSNotConfiguredError(RuntimeError):
    pass

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

async def _invoke_ai_tutor(question: str, session_id: str = "default") -> tuple[str, str]:
    import inspect
    try:
        sig = inspect.signature(ask_ai_tutor)
        if len(sig.parameters) == 1:
            return await ask_ai_tutor(question)
        return await ask_ai_tutor(question, session_id=session_id)
    except Exception:
        return await ask_ai_tutor(question)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    text = clean_for_speech(req.text)
    if not text:
        raise HTTPException(status_code=422, detail="Text must contain speakable content.")

    try:
        pcm_audio = await run_in_threadpool(synthesize_speech_pcm, text)
    except TTSNotConfiguredError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.exception("Piper speech synthesis failed.")
        raise HTTPException(status_code=500, detail="Speech synthesis failed; check backend logs.") from error

    return Response(
        content=pcm_audio,
        media_type="audio/pcm",
        headers={"X-Audio-Sample-Rate": str(TTS_SAMPLE_RATE)},
    )

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    source = "esp32" if (req.device_id and "esp" in req.device_id.lower()) else "web"
    session_id = req.session_id or req.device_id or "default"

    # Check if this text is a task or schedule command
    command = interpret_command(req.text)
    if command is not None:
        tool_name, arguments = command
        try:
            result = call_tool(tool_name, arguments)
            if tool_name == "create_task":
                title = arguments.get("title", "task")
                due = arguments.get("due_date")
                reply_text = f"I added the task {title}." if not due else f"I added the task {title} due {due}."
            elif tool_name == "complete_task":
                reply_text = "I marked that task as completed."
            elif tool_name == "delete_task":
                reply_text = "I removed that task for you."
            elif tool_name == "create_reminder":
                title = arguments.get("title", "reminder")
                reply_text = f"I created a reminder for {title}."
            elif tool_name in ("get_tasks", "get_schedule"):
                if isinstance(result, list) and len(result) > 0:
                    titles = [item.get("title", "task") for item in result[:3]]
                    reply_text = f"You have {len(result)} items: {', '.join(titles)}."
                else:
                    reply_text = "You do not have any saved items right now."
            else:
                reply_text = result.get("title", "Done") if isinstance(result, dict) else "Done"

            reply_text = clean_for_speech(reply_text) or reply_text
            add_memory_message(session_id, "user", req.text)
            add_memory_message(session_id, "assistant", reply_text)

            await manager.broadcast({
                "reply": reply_text,
                "transcript": req.text,
                "status": "action_completed",
                "tool": tool_name,
                "source": source,
                "device_id": req.device_id,
            })
            return ChatResponse(reply=reply_text, status="ok", intent="command", device_id=req.device_id)
        except Exception:
            pass

    intent, fallback_reply = generate_reply(req.text)
    if intent in ("reminder", "timer", "study"):
        await manager.broadcast({
            "reply": fallback_reply,
            "transcript": req.text,
            "status": "ok",
            "source": source,
            "device_id": req.device_id,
        })
        return ChatResponse(reply=fallback_reply, status="ok", intent=intent, device_id=req.device_id)

    ai_status, reply = await _invoke_ai_tutor(req.text, session_id=session_id)
    if ai_status == "answered":
        await manager.broadcast({
            "reply": reply,
            "transcript": req.text,
            "status": "answered",
            "source": source,
            "device_id": req.device_id,
        })
        return ChatResponse(reply=reply, status="ok", intent=intent, device_id=req.device_id)
    if ai_status == "rate_limited":
        await manager.broadcast({
            "reply": reply,
            "transcript": req.text,
            "status": "rate_limited",
            "source": source,
            "device_id": req.device_id,
        })
        return ChatResponse(reply=reply, status="rate_limited", intent=intent, device_id=req.device_id)

    await manager.broadcast({
        "reply": fallback_reply,
        "transcript": req.text,
        "status": "ok",
        "source": source,
        "device_id": req.device_id,
    })
    return ChatResponse(reply=fallback_reply, status="ok", intent=intent, device_id=req.device_id)

@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        return AskResponse(
            status="error",
            answer="Please ask a question.",
            device_id=req.device_id,
        )

    session_id = req.session_id or req.device_id or "default"
    status, answer = await _invoke_ai_tutor(question, session_id=session_id)
    return AskResponse(status=status, answer=answer, device_id=req.device_id)



async def ask_ai_tutor(question: str, session_id: str = "default") -> tuple[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "not_configured", "AI tutoring is not configured yet. Set OPENAI_API_KEY in the backend environment."

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Retrieve recent conversation memory
    history = get_memory_messages(session_id, limit=8)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": question})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 160,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
        response.raise_for_status()
        raw_answer = response.json()["choices"][0]["message"]["content"].strip()
        answer = clean_for_speech(raw_answer) or raw_answer
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

    # Store turn into memory
    add_memory_message(session_id, "user", question)
    add_memory_message(session_id, "assistant", answer)

    return "answered", answer


async def ai_route_and_execute(transcript: str, bytes_received: int, device_id: Optional[str]) -> Optional[AudioResponse]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    session_id = device_id or "esp32"
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    history = get_memory_messages(session_id, limit=6)
    messages = [
        {
            "role": "system",
            "content": (
                SYSTEM_PROMPT
                + " Always call a tool if the user wants to create, list, complete, or delete tasks or reminders. "
                "For questions, respond in brief conversational spoken English."
            ),
        }
    ]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": transcript})

    payload = {
        "model": model,
        "messages": messages,
        "tools": OPENAI_TOOL_DEFINITIONS,
        "tool_choice": "auto",
        "temperature": 0.2,
        "max_tokens": 160,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
        if response.status_code != 200:
            return None

        choice = response.json()["choices"][0]["message"]
        tool_calls = choice.get("tool_calls")
        if tool_calls:
            call_info = tool_calls[0]["function"]
            tool_name = call_info["name"]
            arguments_str = call_info.get("arguments", "{}")
            arguments = json.loads(arguments_str) if isinstance(arguments_str, str) else arguments_str
            result = call_tool(tool_name, arguments)
            action = {"tool": tool_name, "result": result}
            
            if tool_name == "create_task":
                title = arguments.get("title", "task")
                due = arguments.get("due_date")
                answer_text = f"I added the task {title}." if not due else f"I added the task {title} due {due}."
            elif tool_name == "complete_task":
                answer_text = "I marked that task as completed."
            elif tool_name == "delete_task":
                answer_text = "I removed that task for you."
            elif tool_name == "create_reminder":
                title = arguments.get("title", "reminder")
                answer_text = f"I created a reminder for {title}."
            elif tool_name in ("get_tasks", "get_schedule"):
                if isinstance(result, list) and len(result) > 0:
                    titles = [item.get("title", "task") for item in result[:3]]
                    answer_text = f"You have {len(result)} items: {', '.join(titles)}."
                else:
                    answer_text = "You do not have any saved items right now."
            else:
                answer_text = "Done."

            add_memory_message(session_id, "user", transcript)
            add_memory_message(session_id, "assistant", answer_text)

            return AudioResponse(
                status="action_completed",
                message=f"Completed {tool_name.replace('_', ' ')}.",
                bytes_received=bytes_received,
                transcript=transcript,
                answer=answer_text,
                action=action,
                device_id=device_id,
            )

        content = choice.get("content")
        if content:
            clean_answer = clean_for_speech(content.strip()) or content.strip()
            add_memory_message(session_id, "user", transcript)
            add_memory_message(session_id, "assistant", clean_answer)
            return AudioResponse(
                status="answered",
                message="Speech recognized and answered.",
                bytes_received=bytes_received,
                transcript=transcript,
                answer=clean_answer,
                device_id=device_id,
            )
    except Exception:
        return None

    return None


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
        if tool_name == "create_task":
            title = arguments.get("title", "task")
            due = arguments.get("due_date")
            reply_text = f"I added the task {title}." if not due else f"I added the task {title} due {due}."
        elif tool_name == "complete_task":
            reply_text = "I marked that task as completed."
        elif tool_name == "delete_task":
            reply_text = "I removed that task for you."
        elif tool_name == "create_reminder":
            title = arguments.get("title", "reminder")
            reply_text = f"I created a reminder for {title}."
        elif tool_name in ("get_tasks", "get_schedule"):
            if isinstance(result, list) and len(result) > 0:
                titles = [item.get("title", "task") for item in result[:3]]
                reply_text = f"You have {len(result)} items: {', '.join(titles)}."
            else:
                reply_text = "You do not have any saved items right now."
        else:
            reply_text = action["result"].get("title", "Done") if isinstance(action["result"], dict) else "Done"

        reply_text = clean_for_speech(reply_text) or reply_text
        session_id = request.headers.get("x-device-id") or "esp32"
        add_memory_message(session_id, "user", transcript)
        add_memory_message(session_id, "assistant", reply_text)

        resp = AudioResponse(
            status="action_completed",
            message=f"Completed {tool_name.replace('_', ' ')}.",
            bytes_received=len(audio_bytes),
            transcript=transcript,
            answer=reply_text,
            action=action,
            device_id=request.headers.get("x-device-id"),
        )
        await manager.broadcast({
            "reply": reply_text,
            "transcript": transcript,
            "status": "action_completed",
            "tool": tool_name,
            "source": "esp32",
            "device_id": request.headers.get("x-device-id"),
        })
        return resp

    ai_result = await ai_route_and_execute(transcript, len(audio_bytes), request.headers.get("x-device-id"))
    if ai_result is not None:
        broadcast_answer = ai_result.answer or ai_result.message
        await manager.broadcast({
            "reply": broadcast_answer,
            "transcript": transcript,
            "status": ai_result.status,
            "source": "esp32",
            "device_id": ai_result.device_id,
        })
        return ai_result

    session_id = request.headers.get("x-device-id") or "esp32"
    ai_status, answer = await _invoke_ai_tutor(transcript, session_id=session_id)
    resp = AudioResponse(
        status=ai_status,
        message="Speech recognized and answered." if ai_status == "answered" else answer,
        bytes_received=len(audio_bytes),
        transcript=transcript,
        answer=answer,
        device_id=request.headers.get("x-device-id"),
    )
    await manager.broadcast({
        "reply": answer,
        "transcript": transcript,
        "status": ai_status,
        "source": "esp32",
        "device_id": request.headers.get("x-device-id"),
    })
    return resp


@lru_cache(maxsize=1)
def get_piper_voice():
    model_setting = os.getenv("PIPER_MODEL", "models/en_US-lessac-medium.onnx")
    model_path = Path(model_setting)
    if not model_path.is_absolute():
        model_path = Path(__file__).resolve().parents[1] / model_path
    if not model_path.is_file():
        raise TTSNotConfiguredError(
            f"Piper voice model not found at {model_path}. Install a Piper voice model "
            "and set PIPER_MODEL in backend/.env."
        )

    try:
        from piper import PiperVoice
    except ImportError as error:
        raise TTSNotConfiguredError(
            "Piper is not installed. Install backend requirements to enable ESP32 speech."
        ) from error

    try:
        return PiperVoice.load(str(model_path))
    except Exception as error:
        logger.exception("Could not load Piper model at %s.", model_path)
        raise TTSNotConfiguredError(f"Could not load Piper voice model at {model_path}.") from error


def synthesize_speech_pcm(text: str) -> bytes:
    voice = get_piper_voice()
    chunks = list(voice.synthesize(text))
    if not chunks:
        raise RuntimeError("Piper returned no audio.")

    first = chunks[0]
    source_rate = first.sample_rate
    if first.sample_width != 2 or first.sample_channels != 1 or source_rate <= 0:
        raise RuntimeError("Piper voice must produce mono 16-bit PCM audio.")
    if any(
        chunk.sample_rate != source_rate
        or chunk.sample_width != 2
        or chunk.sample_channels != 1
        for chunk in chunks
    ):
        raise RuntimeError("Piper returned audio chunks with inconsistent formats.")

    samples = array("h")
    for chunk in chunks:
        samples.frombytes(chunk.audio_int16_bytes)
    if sys.byteorder != "little":
        samples.byteswap()

    if source_rate == TTS_SAMPLE_RATE:
        return samples.tobytes()

    output_count = round((len(samples) - 1) * TTS_SAMPLE_RATE / source_rate) + 1
    resampled = array("h")
    for index in range(output_count):
        source_position = index * source_rate / TTS_SAMPLE_RATE
        left = int(source_position)
        right = min(left + 1, len(samples) - 1)
        fraction = source_position - left
        sample = round(samples[left] + (samples[right] - samples[left]) * fraction)
        resampled.append(max(-32768, min(32767, sample)))

    if sys.byteorder != "little":
        resampled.byteswap()
    return resampled.tobytes()


@app.get("/memory")
def get_memory_endpoint(session_id: str = "default", limit: int = 20):
    return {"session_id": session_id, "messages": get_memory_messages(session_id, limit=limit)}


@app.delete("/memory")
def clear_memory_endpoint(session_id: str = "default"):
    clear_memory(session_id)
    return {"status": "ok", "message": f"Cleared memory for {session_id}"}


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
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue
            text = payload.get("text", "").strip()
            device_id = payload.get("device_id")
            session_id = payload.get("session_id") or device_id or "web"
            source = payload.get("source", "web")
            if not text:
                continue

            # Try AI tutor first with session memory, fall back to rule-based
            ai_status, reply = await _invoke_ai_tutor(text, session_id=session_id)
            if ai_status not in ("answered", "rate_limited"):
                _, reply = generate_reply(text)

            await websocket.send_text(json.dumps({
                "reply": reply,
                "transcript": text,
                "status": ai_status,
                "source": source,
                "device_id": device_id,
            }))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


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
