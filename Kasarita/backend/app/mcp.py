import os
import re
import sqlite3
import httpx
import calendar
from datetime import date, datetime, timedelta, timezone
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
                subject TEXT NOT NULL DEFAULT 'General',
                due_date TEXT,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                remind_at TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
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
        task_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "subject" not in task_columns:
            connection.execute(
                "ALTER TABLE tasks ADD COLUMN subject TEXT NOT NULL DEFAULT 'General'"
            )
        reminder_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(reminders)").fetchall()
        }
        if "status" not in reminder_columns:
            connection.execute(
                "ALTER TABLE reminders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"
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
    {"name": "complete_reminder", "description": "Mark a saved reminder as done."},
    {"name": "delete_reminder", "description": "Delete a saved reminder."},
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
                    "subject": {"type": "string", "description": "The subject associated with this task."},
                    "due_date": {"type": "string", "description": "Optional due date; accepts calendar dates, weekdays, today, and tomorrow."},
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
                    "remind_at": {"type": "string", "description": "Optional calendar date or date/time for the reminder; spoken dates are resolved using UTC."}
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
    },
    {
        "type": "function",
        "function": {
            "name": "complete_reminder",
            "description": "Mark a saved reminder as done by its ID.",
            "parameters": {
                "type": "object",
                "properties": {"reminder_id": {"type": "string"}},
                "required": ["reminder_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_reminder",
            "description": "Delete a saved reminder by its ID.",
            "parameters": {
                "type": "object",
                "properties": {"reminder_id": {"type": "string"}},
                "required": ["reminder_id"]
            }
        }
    }
]


_MONTHS = {
    name.casefold(): month
    for month, name in enumerate(calendar.month_name)
    if name
}
_MONTHS.update({
    name.casefold(): month
    for month, name in enumerate(calendar.month_abbr)
    if name
})
_WEEKDAYS = {
    name.casefold(): weekday
    for weekday, name in enumerate(calendar.day_name)
}
_DAY_WORDS = {
    "first": 1, "1st": 1,
    "second": 2, "2nd": 2,
    "third": 3, "3rd": 3,
    "fourth": 4, "4th": 4,
    "fifth": 5, "5th": 5,
    "sixth": 6, "6th": 6,
    "seventh": 7, "7th": 7,
    "eighth": 8, "8th": 8,
    "ninth": 9, "9th": 9,
    "tenth": 10, "10th": 10,
    "eleventh": 11, "11th": 11,
    "twelfth": 12, "12th": 12,
    "thirteenth": 13, "13th": 13,
    "fourteenth": 14, "14th": 14,
    "fifteenth": 15, "15th": 15,
    "sixteenth": 16, "16th": 16,
    "seventeenth": 17, "17th": 17,
    "eighteenth": 18, "18th": 18,
    "nineteenth": 19, "19th": 19,
    "twentieth": 20, "20th": 20,
    "twenty-first": 21, "21st": 21,
    "twenty-second": 22, "22nd": 22,
    "twenty-third": 23, "23rd": 23,
    "twenty-fourth": 24, "24th": 24,
    "twenty-fifth": 25, "25th": 25,
    "twenty-sixth": 26, "26th": 26,
    "twenty-seventh": 27, "27th": 27,
    "twenty-eighth": 28, "28th": 28,
    "twenty-ninth": 29, "29th": 29,
    "thirtieth": 30, "30th": 30,
    "thirty-first": 31, "31st": 31,
}
_DAY_TOKEN = r"(?:\d{1,2}(?:st|nd|rd|th)?|" + "|".join(
    sorted((re.escape(word) for word in _DAY_WORDS), key=len, reverse=True)
) + r")"
_MONTH_TOKEN = "|".join(sorted((re.escape(month) for month in _MONTHS), key=len, reverse=True))
_DATE_TOKEN = (
    rf"(?:\d{{4}}-\d{{2}}-\d{{2}}|today|tomorrow|tonight|next\s+week|"
    rf"(?:(?:next|this)\s+)?(?:{'|'.join(_WEEKDAYS)})|"
    rf"(?:{_MONTH_TOKEN})\.?\s+{_DAY_TOKEN}(?:,?\s+\d{{4}})?|"
    rf"(?:the\s+)?{_DAY_TOKEN}\s+(?:of\s+)?(?:{_MONTH_TOKEN})\.?(?:,?\s+\d{{4}})?)"
)
_DATE_PHRASE = re.compile(
    rf"(?<!\w)(?P<phrase>(?:(?:due|deadline)(?:\s+on)?|on|by|for)\s+)?"
    rf"(?P<date>{_DATE_TOKEN})(?!\w)",
    re.IGNORECASE,
)


def _day_number(day_text: str) -> int:
    normalized = day_text.casefold()
    if normalized in _DAY_WORDS:
        return _DAY_WORDS[normalized]
    return int(re.sub(r"(st|nd|rd|th)$", "", normalized))


def _month_number(month_text: str) -> int:
    return _MONTHS[month_text.rstrip(".").casefold()]


def _make_month_day(month: int, day: int, year: Optional[int], today: date) -> date:
    candidate_year = year or today.year
    while True:
        try:
            candidate = date(candidate_year, month, day)
        except ValueError:
            if year is not None:
                raise
            candidate_year += 1
            continue
        if year is not None or candidate >= today:
            return candidate
        candidate_year += 1


def resolve_calendar_date(value: str, today: Optional[date] = None) -> Optional[str]:
    """Resolve a spoken calendar date to an ISO date in UTC's calendar."""
    reference = today or datetime.now(timezone.utc).date()
    text = value.strip().casefold()
    text = re.sub(r"^(?:(?:due|deadline)(?:\s+on)?|on|by|for)\s+", "", text)

    if text in {"today", "tonight"}:
        return reference.isoformat()
    if text == "tomorrow":
        return (reference + timedelta(days=1)).isoformat()
    if text == "next week":
        return (reference + timedelta(days=7)).isoformat()

    weekday_match = re.fullmatch(r"(?:(?:next|this)\s+)?([a-z]+)", text)
    if weekday_match and weekday_match.group(1) in _WEEKDAYS:
        target = _WEEKDAYS[weekday_match.group(1)]
        days_ahead = (target - reference.weekday()) % 7 or 7
        return (reference + timedelta(days=days_ahead)).isoformat()

    try:
        return date.fromisoformat(text).isoformat()
    except ValueError:
        pass

    year_match = re.search(r"\b(19|20)\d{2}\b", text)
    year = int(year_match.group()) if year_match else None
    date_text = re.sub(r",?\s*\b(19|20)\d{2}\b", "", text).strip()
    month_first = re.fullmatch(rf"({_MONTH_TOKEN})\.?\s+({_DAY_TOKEN})", date_text)
    day_first = re.fullmatch(rf"(?:the\s+)?({_DAY_TOKEN})\s+(?:of\s+)?({_MONTH_TOKEN})\.?", date_text)
    if month_first:
        month = _month_number(month_first.group(1))
        day = _day_number(month_first.group(2))
    elif day_first:
        day = _day_number(day_first.group(1))
        month = _month_number(day_first.group(2))
    else:
        return None

    try:
        return _make_month_day(month, day, year, reference).isoformat()
    except ValueError:
        return None


def extract_calendar_date(text: str, today: Optional[date] = None) -> tuple[str, Optional[str]]:
    match = _DATE_PHRASE.search(text)
    if match is None:
        return text.strip(" .,;:!?"), None

    resolved = resolve_calendar_date(match.group("date"), today)
    if resolved is None:
        return text.strip(" .,;:!?"), None
    title = f"{text[:match.start()]} {text[match.end():]}".strip(" .,;:!?")
    title = re.sub(r"\s+", " ", title)
    return title, resolved


def _normalize_date_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Date values must be strings")
    resolved = resolve_calendar_date(value)
    return resolved or value


def format_calendar_date(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    try:
        return date.fromisoformat(value).strftime("%B %d, %Y").replace(" 0", " ")
    except ValueError:
        return value


def _clean_item_title(title: str) -> str:
    title = re.sub(r"^about\s+my\s+", "", title.strip(), flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", title).strip(" .,;:!?")


def create_task(
    title: str,
    due_date: Optional[str] = None,
    priority: str = "normal",
    subject: str = "General",
) -> dict[str, Any]:
    title, extracted_date = extract_calendar_date(title)
    title = _clean_item_title(title)
    if title:
        title = title[0].upper() + title[1:]
    task = {
        "id": str(uuid4()),
        "title": title,
        "subject": subject,
        "due_date": _normalize_date_value(due_date) if due_date is not None else extracted_date,
        "priority": priority,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if use_supabase():
        try:
            result = supabase_request("POST", "tasks", json=task)
        except ValueError as error:
            detail = str(error).lower()
            missing_subject_column = (
                "subject" in detail
                and ("column" in detail or "schema cache" in detail)
            )
            if not missing_subject_column:
                raise
            if subject != "General":
                raise ValueError(
                    "The Supabase tasks table does not have a subject column. "
                    "Run backend/supabase_schema.sql before saving custom task subjects."
                ) from error

            legacy_task = {key: value for key, value in task.items() if key != "subject"}
            result = supabase_request("POST", "tasks", json=legacy_task)
            if result:
                result[0].setdefault("subject", "General")
                return result[0]
            legacy_task["subject"] = "General"
            return legacy_task
        return result[0]
    initialize_database()
    with connect() as connection:
        connection.execute(
            "INSERT INTO tasks (id, title, subject, due_date, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    allowed = {key: value for key, value in fields.items() if key in {"title", "subject", "due_date", "priority", "status"}}
    if "title" in allowed:
        title, extracted_date = extract_calendar_date(str(allowed["title"]))
        title = _clean_item_title(title)
        if title:
            title = title[0].upper() + title[1:]
        allowed["title"] = title
        if "due_date" not in allowed and extracted_date is not None:
            allowed["due_date"] = extracted_date
    if "due_date" in allowed:
        allowed["due_date"] = _normalize_date_value(allowed["due_date"])
    if not allowed:
        raise ValueError("No updatable task fields supplied")
    if use_supabase():
        try:
            result = supabase_request("PATCH", "tasks", params={"id": f"eq.{task_id}"}, json=allowed)
        except ValueError as error:
            detail = str(error).lower()
            missing_subject_column = (
                "subject" in detail
                and ("column" in detail or "schema cache" in detail)
            )
            if not missing_subject_column or allowed.get("subject") != "General":
                raise

            legacy_fields = {key: value for key, value in allowed.items() if key != "subject"}
            result = supabase_request(
                "PATCH",
                "tasks",
                params={"id": f"eq.{task_id}"},
                json=legacy_fields,
            )
            if result:
                result[0].setdefault("subject", "General")
                return result[0]
            raise ValueError(f"Task not found: {task_id}")
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
    title, extracted_date = extract_calendar_date(title)
    title = _clean_item_title(title)
    reminder = {
        "id": str(uuid4()),
        "title": title,
        "remind_at": _normalize_date_value(remind_at) if remind_at is not None else extracted_date,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if use_supabase():
        try:
            result = supabase_request("POST", "reminders", json=reminder)
        except ValueError as error:
            detail = str(error).lower()
            missing_status_column = (
                "status" in detail
                and ("column" in detail or "schema cache" in detail)
            )
            if not missing_status_column:
                raise

            legacy_reminder = {key: value for key, value in reminder.items() if key != "status"}
            result = supabase_request("POST", "reminders", json=legacy_reminder)
            if result:
                result[0].setdefault("status", "pending")
                return result[0]
            legacy_reminder["status"] = "pending"
            return legacy_reminder
        return result[0]
    initialize_database()
    with connect() as connection:
        connection.execute(
            "INSERT INTO reminders (id, title, remind_at, status, created_at) VALUES (?, ?, ?, ?, ?)",
            tuple(reminder.values()),
        )
    return reminder


def complete_reminder(reminder_id: str) -> dict[str, Any]:
    if use_supabase():
        result = supabase_request(
            "PATCH",
            "reminders",
            params={"id": f"eq.{reminder_id}"},
            json={"status": "completed"},
        )
        if result:
            return result[0]
        raise ValueError(f"Reminder not found: {reminder_id}")

    initialize_database()
    with connect() as connection:
        connection.execute(
            "UPDATE reminders SET status = 'completed' WHERE id = ?",
            (reminder_id,),
        )
        row = connection.execute(
            "SELECT * FROM reminders WHERE id = ?",
            (reminder_id,),
        ).fetchone()
    if row is None:
        raise ValueError(f"Reminder not found: {reminder_id}")
    return row_to_dict(row)


def delete_reminder(reminder_id: str) -> None:
    if use_supabase():
        result = supabase_request(
            "DELETE",
            "reminders",
            params={"id": f"eq.{reminder_id}", "select": "id"},
        )
        if not result:
            raise ValueError(f"Reminder not found: {reminder_id}")
        return

    initialize_database()
    with connect() as connection:
        cursor = connection.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
    if cursor.rowcount == 0:
        raise ValueError(f"Reminder not found: {reminder_id}")


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
    "complete_reminder": complete_reminder,
    "delete_reminder": delete_reminder,
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

    # Reminder creation must precede task creation so "remind me to" is not a task.
    reminder_pattern = (
        r"^(can\s+you\s+|could\s+you\s+|please\s+)?"
        r"(remind\s+me(?:\s+to)?|create\s+(a\s+)?reminder|add\s+(a\s+)?reminder|set\s+(a\s+)?reminder)"
        r"[,:\-\s]+\s*"
    )
    if re.search(reminder_pattern, normalized):
        title = re.sub(reminder_pattern, "", cleaned, flags=re.IGNORECASE).strip(".,;:!? ")
        title = re.sub(r"^(?:to|for)\s+", "", title, flags=re.IGNORECASE)
        title, remind_at = extract_calendar_date(title)
        title = _clean_item_title(title)
        if title:
            return "create_reminder", {"title": title, "remind_at": remind_at}

    # Task Creation
    create_pattern = (
        r"^(?:(?:can\s+you\s+|could\s+you\s+|please\s+)?"
        r"(add\s+(a\s+)?tasks?(\s+to)?|create\s+(a\s+)?tasks?(\s+to)?|new\s+tasks?(\s+to)?|"
        r"set\s+up|remember\s+to|i\s+need\s+to|put\s+on\s+my\s+task\s+list|"
        r"make\s+a\s+task|schedule\s+tasks?|todo)|i(?:['’]ve| have)\s+set\s+up)"
        r"[,:\-\s]+\s*"
    )
    if re.search(create_pattern, normalized):
        title = re.sub(create_pattern, "", cleaned, flags=re.IGNORECASE).strip(".,;:!? ")
        title = re.sub(r"^(?:a|the)\s+", "", title, flags=re.IGNORECASE)
        title = re.sub(r"^tasks?\s+(?:to\s+)?", "", title, flags=re.IGNORECASE)
        title, due_date = extract_calendar_date(title)
        title = _clean_item_title(title)
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
