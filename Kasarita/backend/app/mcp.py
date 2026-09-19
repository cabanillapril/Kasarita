import os
import re
import sqlite3
import httpx
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4


def database_path() -> Path:
    return Path(os.getenv("KASARITA_DB_PATH", "data/kasarita.db"))


def use_supabase() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY"))


def supabase_request(method: str, table: str, **kwargs: Any) -> list[dict[str, Any]]:
    url = f"{os.environ['SUPABASE_URL'].rstrip('/')}/rest/v1/{table}"
    headers = {
        "apikey": os.environ["SUPABASE_KEY"],
        "Authorization": f"Bearer {os.environ['SUPABASE_KEY']}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    try:
        response = httpx.request(method, url, headers=headers, timeout=15, **kwargs)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        detail = error.response.text[:300]
        raise ValueError(f"Supabase returned HTTP {error.response.status_code}: {detail}") from error
    except httpx.HTTPError as error:
        raise ValueError(f"Could not reach Supabase: {error}") from error
    return response.json() if response.content else []


def connect() -> sqlite3.Connection:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                due_date TEXT,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                remind_at TEXT,
                created_at TEXT NOT NULL
            );
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


TOOL_DEFINITIONS = [
    {"name": "create_task", "description": "Create a pending task."},
    {"name": "get_tasks", "description": "Return saved tasks."},
    {"name": "complete_task", "description": "Mark a task as completed."},
    {"name": "create_reminder", "description": "Create a reminder."},
    {"name": "get_schedule", "description": "Return saved reminders."},
]


def create_task(title: str, due_date: Optional[str] = None, priority: str = "normal") -> dict[str, Any]:
    task = {
        "id": str(uuid4()),
        "title": title.strip(),
        "due_date": due_date,
        "priority": priority,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if use_supabase():
        return supabase_request("POST", "tasks", json=task)[0]
    initialize_database()
    with connect() as connection:
        connection.execute(
            "INSERT INTO tasks (id, title, due_date, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            tuple(task.values()),
        )
    return task


def get_tasks() -> list[dict[str, Any]]:
    if use_supabase():
        return supabase_request("GET", "tasks", params={"select": "*", "order": "created_at.asc"})
    initialize_database()
    with connect() as connection:
        rows = connection.execute("SELECT * FROM tasks ORDER BY created_at").fetchall()
    return [row_to_dict(row) for row in rows]


def complete_task(task_id: str) -> dict[str, Any]:
    if use_supabase():
        result = supabase_request("PATCH", "tasks", params={"id": f"eq.{task_id}"}, json={"status": "completed"})
        if result:
            return result[0]
        raise ValueError(f"Task not found: {task_id}")
    initialize_database()
    with connect() as connection:
        connection.execute("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_id,))
        row = connection.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is not None:
        return row_to_dict(row)
    raise ValueError(f"Task not found: {task_id}")


def update_task(task_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    allowed = {key: value for key, value in fields.items() if key in {"title", "due_date", "priority", "status"}}
    if not allowed:
        raise ValueError("No updatable task fields supplied")
    if use_supabase():
        result = supabase_request("PATCH", "tasks", params={"id": f"eq.{task_id}"}, json=allowed)
        if result:
            return result[0]
        raise ValueError(f"Task not found: {task_id}")
    initialize_database()
    assignments = ", ".join(f"{key} = ?" for key in allowed)
    with connect() as connection:
        connection.execute(f"UPDATE tasks SET {assignments} WHERE id = ?", (*allowed.values(), task_id))
        row = connection.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        raise ValueError(f"Task not found: {task_id}")
    return row_to_dict(row)


def delete_task(task_id: str) -> None:
    if use_supabase():
        supabase_request("DELETE", "tasks", params={"id": f"eq.{task_id}"})
        return
    initialize_database()
    with connect() as connection:
        connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))


def create_reminder(title: str, remind_at: Optional[str] = None) -> dict[str, Any]:
    reminder = {
        "id": str(uuid4()),
        "title": title.strip(),
        "remind_at": remind_at,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if use_supabase():
        return supabase_request("POST", "reminders", json=reminder)[0]
    initialize_database()
    with connect() as connection:
        connection.execute(
            "INSERT INTO reminders (id, title, remind_at, created_at) VALUES (?, ?, ?, ?)",
            tuple(reminder.values()),
        )
    return reminder


def get_schedule() -> list[dict[str, Any]]:
    if use_supabase():
        return supabase_request("GET", "reminders", params={"select": "*", "order": "created_at.asc"})
    initialize_database()
    with connect() as connection:
        rows = connection.execute("SELECT * FROM reminders ORDER BY created_at").fetchall()
    return [row_to_dict(row) for row in rows]


TOOL_HANDLERS = {
    "create_task": create_task,
    "get_tasks": get_tasks,
    "complete_task": complete_task,
    "update_task": update_task,
    "delete_task": delete_task,
    "create_reminder": create_reminder,
    "get_schedule": get_schedule,
}


def call_tool(name: str, arguments: dict[str, Any]) -> Any:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
    return handler(**arguments)


def interpret_command(text: str) -> Optional[tuple[str, dict[str, Any]]]:
    normalized = " ".join(text.lower().split())
    if normalized.startswith(("add task ", "create task ", "remind me to ")):
        title = re.sub(r"^(add task|create task|remind me to)\s+", "", text, flags=re.IGNORECASE)
        due_date = None
        if re.search(r"\btomorrow\b", title, flags=re.IGNORECASE):
            due_date = "tomorrow"
            title = re.sub(r"\s+tomorrow\b", "", title, flags=re.IGNORECASE).strip()
        if title:
            return "create_task", {"title": title, "due_date": due_date}

    if normalized.startswith(("remind me ", "create reminder ")):
        title = re.sub(r"^(remind me|create reminder)\s+(to\s+)?", "", text, flags=re.IGNORECASE).strip()
        if title:
            return "create_reminder", {"title": title}

    if normalized in {"show my tasks", "list my tasks", "what are my tasks"}:
        return "get_tasks", {}

    if normalized in {"show my schedule", "show my reminders", "what is my schedule"}:
        return "get_schedule", {}

    return None