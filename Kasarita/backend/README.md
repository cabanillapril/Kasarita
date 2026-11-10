# Kasarita Backend

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # on Windows use .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

Set `OPENAI_API_KEY` in a local `.env` file to enable AI tutoring. Do not commit that file. The default SQLite database is stored at `backend/data/kasarita.db`.

## ESP32 text-to-speech

Kasarita uses Piper locally to synthesize replies for the ESP32 speaker. Install backend requirements, then download an English voice model from the Piper voice catalog:

```powershell
python -m pip install -r requirements.txt
python -m piper.download_voices en_US-lessac-medium --download-dir models
```

Set `PIPER_MODEL=models/en_US-lessac-medium.onnx` in `backend/.env` (or configure another Piper `.onnx` voice model). Keep the model and its `.onnx.json` configuration together. Voice files are intentionally excluded from Git; review each voice model's card and dataset license before use.

The backend exposes `POST /tts` with `{"text":"Hello"}` and responds with mono, 16-bit PCM at 16 kHz for the ESP32. The ESP32 plays replies through its MAX98357A speaker; the OLED and serial output remain available if speech synthesis is unavailable.

To use Supabase instead of SQLite, set `SUPABASE_URL` and `SUPABASE_KEY` in `.env`, then run `supabase_schema.sql` in the Supabase SQL editor. When both values are present, MCP tools use Supabase automatically.

Run the updated `supabase_schema.sql` to add the task `subject` column and reminder `status` column. Reminder creation remains compatible with an older reminders table that lacks `status`; completion and deletion still require the updated schema.

- GET /health
- POST /chat
- POST /ask
- GET /mcp/tools
- POST /mcp/call
- WS /ws

## Task and reminder dates

Task and reminder commands accept spoken dates such as "today", "tomorrow", "on Thursday", or "due on November 10". Dates are resolved using the UTC calendar and stored as `YYYY-MM-DD`; a month/day without a year uses the next occurrence, and a weekday always means the next occurrence (not today).

For example, say "Add task: Finish the report due on November 10" or "Remind me to call Mom on Thursday". Task dates can also be normalized through `PATCH /tasks/{task_id}` by setting `due_date`.
