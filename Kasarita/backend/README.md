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

- GET /health
- POST /chat
- WS /ws
