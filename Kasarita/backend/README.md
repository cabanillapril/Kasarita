# IntelliVo Backend

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

To use Supabase instead of SQLite, set `SUPABASE_URL` and `SUPABASE_KEY` in `.env`, then run `supabase_schema.sql` in the Supabase SQL editor. When both values are present, MCP tools use Supabase automatically.

- GET /health
- POST /chat
- POST /ask
- GET /mcp/tools
- POST /mcp/call
- WS /ws
