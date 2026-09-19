# Kasarita Progress

Last updated: 2026-09-19

## Overall Status

Current stage: **working voice assistant prototype with persistent Supabase task storage**.

The device can record speech, send it to the backend, transcribe it with Whisper, route commands to task tools, and send ordinary questions to an AI tutor. Supabase task creation has been verified through the backend API.

## Completed Milestones

### 1. Firmware foundation

- [x] PlatformIO project targets the ESP32-S3 N16R8 board with the Arduino framework.
- [x] Firmware is split into application, hardware, and backend bridge modules.
- [x] OLED display module initializes over I2C.
- [x] Push-button module detects user interaction.
- [x] INMP441 microphone module initializes through I2S.
- [x] MAX98357A speaker module initializes through I2S.
- [x] Captured audio uses 16-bit samples at 16 kHz.
- [x] The state machine transitions through idle, recording, processing, and response behavior.

### 2. Wi-Fi and backend connection

- [x] ESP32 connects to the configured Wi-Fi network.
- [x] FastAPI listens on `0.0.0.0:8000` for LAN access.
- [x] ESP32 uses the computer address configured in `src/backend_bridge.cpp`.
- [x] Backend connectivity was verified through successful `POST /audio` requests.
- [x] ESP32 serial logging reports HTTP status codes and response bodies.

### 3. Audio upload

- [x] Button press starts audio capture.
- [x] The captured PCM buffer is retained until upload completes.
- [x] ESP32 sends audio to `POST /audio` with `Content-Type: audio/pcm`.
- [x] Backend validates that the payload is non-empty and contains complete 16-bit samples.
- [x] Invalid content types and malformed audio return structured JSON errors.

### 4. Speech recognition

- [x] Backend wraps the incoming PCM samples as a mono WAV stream.
- [x] `faster-whisper` is installed in the backend virtual environment.
- [x] The `base.en` model is loaded and cached for reuse.
- [x] Transcribed text is returned in the `transcript` JSON field.
- [x] ESP32 displays the transcript when no tutor answer is available.

### 5. AI tutoring

- [x] `POST /ask` accepts student questions.
- [x] OpenAI-compatible configuration uses `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL`.
- [x] AI requests use a student-focused programming tutor system prompt.
- [x] AI provider errors are converted into structured responses.
- [x] HTTP 429 quota/rate-limit errors return a clear `rate_limited` status.
- [x] Voice transcripts are forwarded to the tutor through the `/audio` flow.
- [x] Tutor answers are returned as the `answer` field and displayed by the ESP32.

### 6. MCP-style task tools

- [x] `GET /mcp/tools` lists the approved tools.
- [x] `POST /mcp/call` executes only registered tools.
- [x] `create_task` creates pending tasks.
- [x] `get_tasks` lists saved tasks.
- [x] `complete_task` marks a task as completed.
- [x] `create_reminder` creates reminders.
- [x] `get_schedule` lists reminders.
- [x] Unknown tool names are rejected.

### 7. Natural-language command routing

- [x] Commands beginning with `add task` or `create task` route to `create_task`.
- [x] Commands containing `tomorrow` preserve a `due_date` value.
- [x] `show my tasks`, `list my tasks`, and `what are my tasks` route to `get_tasks`.
- [x] Schedule and reminder listing phrases route to `get_schedule`.
- [x] Unrecognized text is treated as an AI question instead of an action.
- [x] Voice actions return `action_completed` with the tool result.

### 8. Persistent storage

- [x] SQLite storage was added as the local fallback.
- [x] The database path is configurable through `KASARITA_DB_PATH`.
- [x] SQLite schema creates `tasks` and `reminders` tables automatically.
- [x] A reload-style test proves task data survives module/backend restart.
- [x] Supabase REST storage is enabled when both Supabase variables are present.
- [x] `backend/supabase_schema.sql` defines the hosted `tasks` and `reminders` tables.
- [x] Supabase task creation was verified through `POST /mcp/call`.
- [x] Supabase row-level security remains enabled; the backend uses the service-role key server-side.

### 9. Dashboard task integration

- [x] Added `GET /tasks` for dashboard task loading.
- [x] Added `POST /tasks` for dashboard task creation.
- [x] Added `PATCH /tasks/{id}` for task updates and completion.
- [x] Added `DELETE /tasks/{id}` for task deletion.
- [x] REST endpoints reuse the SQLite/Supabase storage layer.
- [x] React task state loads backend tasks when a user signs in.
- [x] React task creation synchronizes the optimistic local task with the backend result.
- [x] React task completion, editing, and deletion call the backend.
- [x] Local task behavior remains available when the backend is unavailable.

### 10. Dashboard visual refinement

- [x] Added a study command-center hero with a clearer primary action area.
- [x] Added completion-rate progress ring and streak context.
- [x] Added icon-led summary cards for tasks, completion, streak, and schedule.
- [x] Added quick actions for task review and voice interaction.
- [x] Improved section labels, spacing, contrast, button states, and responsive behavior.
- [x] Kept the existing routes, task controls, and theme variables compatible.

### 9. Validation

- [x] Backend test suite passes with 13 tests.
- [x] React production build passes.
- [x] PlatformIO firmware build passes.
- [x] Firmware was uploaded through COM15.
- [x] Serial monitor was used to verify device responses.
- [x] Backend environment variables were checked without printing secret values.

## Current End-to-End Flows

### Voice question

```text
Button press
    -> ESP32 records 16-bit PCM audio
    -> ESP32 uploads POST /audio
    -> FastAPI wraps PCM as WAV
    -> faster-whisper creates transcript
    -> Backend sends transcript to AI tutor
    -> JSON answer returns to ESP32
    -> OLED and serial monitor show the answer
```

### Voice task command

```text
Button press
    -> ESP32 records command
    -> Whisper returns the transcript
    -> Rule-based router recognizes an action phrase
    -> Approved MCP tool executes
    -> Task is written to Supabase or SQLite
    -> Action result returns to ESP32
```

## Current API

- `GET /health` - verifies backend availability.
- `POST /audio` - accepts PCM audio, transcribes it, routes commands, or asks the AI tutor.
- `POST /ask` - asks the AI tutor with text.
- `GET /mcp/tools` - lists approved tools.
- `POST /mcp/call` - executes an approved task or reminder tool.
- `POST /chat` - provides the original basic intent response.
- `WS /ws` - provides the original realtime text channel.

## Configuration

The local file is `backend/.env`. It must not be committed or pasted into chat.

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
KASARITA_DB_PATH=data/kasarita.db
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
```

Storage behavior:

- If `SUPABASE_URL` and `SUPABASE_KEY` are both set, MCP tools use Supabase.
- If either Supabase value is missing, MCP tools use local SQLite.
- The Supabase schema must be run from `backend/supabase_schema.sql` in the Supabase SQL Editor.

## How To Run

### Start the backend

```powershell
cd backend
.\.venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Run backend tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_main.py -q
```

### Upload firmware

Stop the serial monitor before uploading:

```powershell
cd ..
pio run --target upload --upload-port COM15
```

### Monitor the ESP32

```powershell
pio device monitor --port COM15 --baud 115200
```

Expected audio logging:

```text
Audio HTTP code: 200
Audio response: {"status":"answered", ...}
```

### Test Supabase task creation

Use Python JSON serialization to avoid PowerShell `curl.exe` quoting problems:

```powershell
cd backend
.\.venv\Scripts\python.exe -c "import httpx; r=httpx.post('http://localhost:8000/mcp/call',json={'name':'create_task','arguments':{'title':'Test Supabase task'}}); print(r.status_code); print(r.text)"
```

Then view the row in Supabase **Table Editor -> tasks**.

## Known Limitations

- The OpenAI API key previously used in local configuration was exposed and must be revoked and replaced.
- AI answers depend on provider quota and can return `rate_limited`.
- The frontend dashboard is connected to task APIs; reminders and tutor APIs are still pending.
- Text-to-speech is not implemented; the speaker currently plays local test audio and tones.
- OLED responses are truncated rather than paginated.
- ESP32 recording uses a fixed duration rather than speech-end detection.
- Wake-word detection is not implemented.
- Wi-Fi credentials and backend URL remain compiled into firmware source.
- Supabase currently uses the backend service-role key and does not yet have user-specific row ownership.
- The rule-based command router supports only a limited set of phrases.

## Next Milestones

### Milestone 1: Complete React dashboard integration

- Add frontend API configuration for the backend URL.
- Add reminder list loading and creation from dedicated endpoints.
- Add tutor question submission and response display in the Voice page.
- Add loading, empty, and error states.
- Verify task rows created through the dashboard appear in Supabase.

### Milestone 2: Add dedicated REST resources

- Add `GET /tasks` for task retrieval.
- Add `POST /tasks` for task creation.
- Add `PATCH /tasks/{id}/complete` for completion.
- Add `GET /reminders` and `POST /reminders`.
- Keep MCP tools as the assistant-facing action layer.
- Add request validation and consistent HTTP status codes.

### Milestone 3: Add text-to-speech

- Select a TTS provider or local engine.
- Convert tutor/action responses to audio.
- Add an audio response endpoint for the ESP32.
- Play response audio through the MAX98357A speaker.
- Keep OLED and serial text as fallback output.

### Milestone 4: Improve interaction control

- Add speech-end detection or a shorter configurable recording window.
- Add listening, uploading, processing, and responding indicators.
- Add wake-word detection if hardware performance allows.
- Add retry and timeout behavior for Wi-Fi and backend failures.

### Milestone 5: Secure and productionize

- Revoke all exposed API keys and rotate credentials.
- Move Wi-Fi credentials and backend URL into secure build-time configuration.
- Add authenticated users and user-specific Supabase rows.
- Replace broad service-role access with controlled backend policies where practical.
- Add rate limits and request-size limits.
- Add structured logging without secrets or raw credentials.

## Verification Evidence

Latest known results:

```text
Backend tests: 12 passed
PlatformIO build: SUCCESS
ESP32 upload: completed on COM15
Supabase environment variables: detected without printing values
Supabase task request: working after service-role/RLS configuration
```
