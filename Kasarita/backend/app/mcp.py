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
            CREATE TABLE IF NOT EXISTS conversation_memory (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )


def clean_for_speech(text: str) -> str:
    """Sanitizes text so it sounds completely natural when read by Text-To-Speech (TTS),
    removing all robotic markdown characters, headers, bullet symbols, asterisks, etc."""
    if not text:
        return ""

    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", " ", text)
    # Inline code
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Strip markdown bold, italics, strikethrough (***, **, *, __, _, ~~)
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)
    text = re.sub(r"~{1,2}([^~]+)~{1,2}", r"\1", text)
    # Strip markdown headers (#, ##, ###, etc.)
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Strip blockquotes (> )
    text = re.sub(r"^\s*>\s*", "", text, flags=re.MULTILINE)
    # Strip horizontal rules (---, ***, ___)
    text = re.sub(r"^\s*[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Strip bullet symbols (* , - , + ) at line starts
    text = re.sub(r"^\s*[\*\-\+]\s+", "", text, flags=re.MULTILINE)
    # Strip numbered list markers (1. , 2. ) at line starts
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    # Strip emoji characters so TTS doesn't read symbol names
    text = re.sub(r"[\U00010000-\U0010ffff]", "", text)
    # Strip stray markdown symbols and robotic characters
    text = re.sub(r"[\*#~`|\[\]{}]", "", text)
    # Collapse multiple dashes or underscores (e.g. --- or ___)
    text = re.sub(r"[-_]{2,}", " ", text)
    # Clean up multiple newlines or spaces into smooth spoken sentences
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    text = " ".join(lines)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def add_memory_message(session_id: str, role: str, content: str) -> dict[str, Any]:
    """Stores a conversational message in memory for context continuity."""
    session = session_id or "default"
    msg = {
        "id": str(uuid4()),
        "session_id": session,
        "role": role,
        "content": content.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if use_supabase():
        try:
            return supabase_request("POST", "conversation_memory", json=msg)[0]
        except Exception:
            pass  # Fall back to local sqlite
    initialize_database()
    with connect() as connection:
        connection.execute(
            "INSERT INTO conversation_memory (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            tuple(msg.values()),
        )
    return msg


def get_memory_messages(session_id: str, limit: int = 10) -> list[dict[str, Any]]:
    """Retrieves the recent conversation history for a given session."""
    session = session_id or "default"
    if use_supabase():
        try:
            return supabase_request(
                "GET",
                "conversation_memory",
                params={"session_id": f"eq.{session}", "select": "*", "order": "created_at.desc", "limit": str(limit)},
            )[::-1]
        except Exception:
            pass  # Fall back to local sqlite
    initialize_database()
    with connect() as connection:
        rows = connection.execute(
            "SELECT * FROM conversation_memory WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
            (session, limit),
        ).fetchall()
    return [row_to_dict(row) for row in reversed(rows)]


def clear_memory(session_id: str) -> None:
    """Clears conversation memory for a session."""
    session = session_id or "default"
    if use_supabase():
        try:
            supabase_request("DELETE", "conversation_memory", params={"session_id": f"eq.{session}"})
            return
        except Exception:
            pass
    initialize_database()
    with connect() as connection:
        connection.execute("DELETE FROM conversation_memory WHERE session_id = ?", (session,))



def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


TOOL_DEFINITIONS = [
    {"name": "create_task", "description": "Create a pending task."},
    {"name": "get_tasks", "description": "Return saved tasks."},
    {"name": "complete_task", "description": "Mark a task as completed."},
    {"name": "delete_task", "description": "Delete a task."},
    {"name": "create_reminder", "description": "Create a reminder."},
    {"name": "get_schedule", "description": "Return saved reminders."},
]

OPENAI_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new pending task for the student.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "The title or description of the task to create."},
                    "due_date": {"type": "string", "description": "Optional due date or relative time, e.g. 'tomorrow', 'today', 'next week'."},
                    "priority": {"type": "string", "enum": ["low", "normal", "high"], "description": "Task priority level."}
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_tasks",
            "description": "Retrieve all saved tasks.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark an existing task as completed using its task_id or title search term.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The ID or title search term of the task to complete."}
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete or remove an existing task using its task_id or title search term.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The ID or title search term of the task to delete."}
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": "Create a new reminder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "The title of the reminder."},
                    "remind_at": {"type": "string", "description": "Optional date/time for the reminder."}
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_schedule",
            "description": "Retrieve all saved reminders and schedule items.",
            "parameters": {"type": "object", "properties": {}}
        }
    }
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
    task_id = find_task_id(task_id)
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
    task_id = find_task_id(task_id)
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
    task_id = find_task_id(task_id)
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


def find_task_id(search_term: str) -> str:
    term = search_term.strip().lower()
    if not term:
        return search_term
    tasks = get_tasks()
    for task in tasks:
        if task.get("id", "").lower() == term:
            return task["id"]
    for task in tasks:
        if task.get("title", "").lower() == term:
            return task["id"]
    for task in tasks:
        if term in task.get("title", "").lower() or task.get("title", "").lower() in term:
            return task["id"]
    return search_term


def interpret_command(text: str) -> Optional[tuple[str, dict[str, Any]]]:
    if not text:
        return None

    # Clean text and handle common transcription artifacts (commas, colons, trailing periods)
    cleaned = text.strip()
    normalized = " ".join(cleaned.lower().split())

    # Task Creation
    create_pattern = (
        r"^(can\s+you\s+|could\s+you\s+|please\s+)?"
        r"(add\s+(a\s+)?task(\s+to)?|create\s+(a\s+)?task(\s+to)?|new\s+task(\s+to)?|"
        r"remind\s+me\s+to|remember\s+to|i\s+need\s+to|put\s+on\s+my\s+task\s+list|"
        r"make\s+a\s+task|schedule\s+task|todo)"
        r"[,:\-\s]+\s*"
    )
    if re.search(create_pattern, normalized):
        title = re.sub(create_pattern, "", cleaned, flags=re.IGNORECASE).strip(".,;:!? ")
        due_date = None
        for date_keyword in ["tomorrow", "today", "tonight", "next week"]:
            if re.search(r"\b" + date_keyword + r"\b", title, flags=re.IGNORECASE):
                due_date = date_keyword
                title = re.sub(r"\s+\b" + date_keyword + r"\b", "", title, flags=re.IGNORECASE).strip(".,;:!? ")
                break
        if title:
            return "create_task", {"title": title, "due_date": due_date}

    # Task Completion
    complete_pattern = (
        r"^(can\s+you\s+|could\s+you\s+|please\s+)?"
        r"(complete\s+task|finish\s+task|done\s+with\s+task|check\s+off\s+task|mark\s+task)"
        r"[,:\-\s]+\s*"
    )
    if re.search(complete_pattern, normalized):
        raw_target = re.sub(complete_pattern, "", cleaned, flags=re.IGNORECASE).strip(".,;:!? ")
        raw_target = re.sub(r"\s+(as\s+)?(completed|done)$", "", raw_target, flags=re.IGNORECASE).strip(".,;:!? ")
        if raw_target:
            target_id = find_task_id(raw_target)
            return "complete_task", {"task_id": target_id}

    # Task Deletion
    delete_pattern = (
        r"^(can\s+you\s+|could\s+you\s+|please\s+)?"
        r"(delete\s+task|remove\s+task|cancel\s+task)"
        r"[,:\-\s]+\s*"
    )
    if re.search(delete_pattern, normalized):
        raw_target = re.sub(delete_pattern, "", cleaned, flags=re.IGNORECASE).strip(".,;:!? ")
        if raw_target:
            target_id = find_task_id(raw_target)
            return "delete_task", {"task_id": target_id}

    # Reminders Creation
    reminder_pattern = (
        r"^(can\s+you\s+|could\s+you\s+|please\s+)?"
        r"(remind\s+me|create\s+reminder|add\s+reminder|set\s+reminder)"
        r"[,:\-\s]+\s*(to\s+)?"
    )
    if re.search(reminder_pattern, normalized):
        title = re.sub(reminder_pattern, "", cleaned, flags=re.IGNORECASE).strip(".,;:!? ")
        if title:
            return "create_reminder", {"title": title}

    # Task Listing / Retrieval
    clean_no_punc = normalized.strip(".,;:!? ")
    if (
        clean_no_punc in {"show my tasks", "list my tasks", "what are my tasks", "show tasks", "list tasks", "get tasks", "get my tasks", "check my tasks", "view tasks", "my tasks", "what tasks do i have", "display tasks"}
        or re.match(r"^(can\s+you\s+|could\s+you\s+|please\s+)?(show|list|view|check|get|display)\s+(my\s+)?tasks$", clean_no_punc)
    ):
        return "get_tasks", {}

    # Schedule / Reminders Retrieval
    if (
        clean_no_punc in {"show my schedule", "show my reminders", "what is my schedule", "show schedule", "list schedule", "view schedule"}
        or re.match(r"^(can\s+you\s+|could\s+you\s+|please\s+)?(show|list|view|check|get|display)\s+(my\s+)?(schedule|reminders)$", clean_no_punc)
    ):
        return "get_schedule", {}

    return None
