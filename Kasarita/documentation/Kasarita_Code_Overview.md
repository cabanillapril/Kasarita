# Kasarita Code Overview

Kasarita is composed of three connected layers:

```text
ESP32 hardware
   ↓ Wi-Fi / HTTP
FastAPI backend
   ↓ REST / WebSocket
React frontend
```

## 1. ESP32 firmware

### Application startup and main loop

File: [`src/main.cpp`](../src/main.cpp)

- `setup()` initializes the serial connection, OLED display, button, microphone, speaker, and Wi-Fi.
- It sends a boot request to the backend.
- `loop()` continuously calls `stateMachineUpdate()`.

This is the firmware entry point.

### Device state machine

File: [`src/app/state_machine.cpp`](../src/app/state_machine.cpp)

The device uses these states:

- `IDLE` — waits for the button.
- `LISTENING` — records audio while the button is held.
- `PLAYING` — reserved for playback behavior.

`stateMachineUpdate()` controls the main device workflow:

1. Detect a button press.
2. Record microphone input.
3. Send audio to the backend.
4. Display the response.
5. Request TTS audio when an answer is available.
6. Play success or error tones.
7. Return to the idle state.

### Wi-Fi and HTTP communication

Files:

- [`src/backend_bridge.cpp`](../src/backend_bridge.cpp)
- [`src/backend_bridge.h`](../src/backend_bridge.h)

Important functions:

- `initNetwork()` — connects the ESP32 to Wi-Fi.
- `sendCommandToBackend()` — sends text commands to `/chat`.
- `sendAudioToBackend()` — uploads raw microphone PCM data to `/audio`.
- `speakTextWithBackend()` — requests speech from `/tts` and streams PCM audio to the speaker.

Audio is sent as `audio/pcm`. TTS responses must be mono, 16-bit, 16 kHz PCM.

### Microphone recording

File: [`src/hardware/microphone.cpp`](../src/hardware/microphone.cpp)

`microphoneInit()` configures I2S input for the INMP441 microphone at 16 kHz.

`recordAudioWhilePressed()`:

- Allocates a buffer for up to 10 seconds of audio.
- Reads microphone data in chunks.
- Continues while the button is held.
- Returns raw `int16_t` PCM samples.

### Speaker output

File: [`src/hardware/speaker.cpp`](../src/hardware/speaker.cpp)

Important functions:

- `speakerInit()` — configures I2S output for the MAX98357A amplifier.
- `playAudio()` — outputs PCM audio.
- `playTone()` — generates square-wave tones for startup, success, and error notifications.

### OLED display

File: [`src/hardware/display.cpp`](../src/hardware/display.cpp)

- Initializes the SSD1306 OLED.
- Displays device states such as `Kasarita Ready`, `Recording...`, and `Sending...`.
- Truncates long messages to fit the 128x64 display.

### Button input

File: [`src/hardware/button.cpp`](../src/hardware/button.cpp)

- `buttonInit()` configures the button with `INPUT_PULLUP`.
- `buttonIsDown()` detects whether the button is held.
- `buttonPressed()` performs a basic debounce check.

### Hardware pin configuration

File: [`include/pins.h`](../include/pins.h)

Defines GPIO connections for the button, INMP441 microphone, MAX98357A amplifier, and SSD1306 OLED.

### PlatformIO configuration

File: [`platformio.ini`](../platformio.ini)

Defines the ESP32-S3 board, Arduino framework, flash configuration, and required libraries:

- Adafruit GFX
- Adafruit SSD1306
- ArduinoJson

## 2. Backend

### FastAPI application

File: [`backend/app/main.py`](../backend/app/main.py)

The backend provides the main API and voice-processing pipeline.

Important endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Backend health check |
| `POST /chat` | Processes text commands and AI questions |
| `POST /ask` | Sends a study question to the AI tutor |
| `POST /audio` | Receives ESP32 audio and transcribes it |
| `POST /tts` | Converts text into PCM speech |
| `GET /tasks` | Lists saved tasks |
| `POST /tasks` | Creates a task |
| `PATCH /tasks/{id}` | Updates or completes a task |
| `DELETE /tasks/{id}` | Deletes a task |
| `GET /reminders` | Lists reminders |
| `PATCH /reminders/{id}` | Completes a reminder |
| `DELETE /reminders/{id}` | Deletes a reminder |
| `GET /memory` | Retrieves conversation memory |
| `DELETE /memory` | Clears conversation memory |
| `WebSocket /ws` | Sends real-time frontend updates |

### Chat command routing

Function: `chat()`

The `/chat` handler:

1. Identifies whether the request came from the web or ESP32.
2. Checks whether the text is a task or reminder command.
3. Executes the corresponding tool.
4. Generates a natural spoken response.
5. Stores the conversation.
6. Broadcasts the result through WebSocket.
7. Falls back to the AI tutor for normal questions.

This is the primary conversational control flow.

### Audio processing pipeline

Functions: `audio()` and `transcribe_pcm()`

```text
ESP32 PCM audio
   ↓
FastAPI /audio
   ↓
WAV wrapper
   ↓
Faster-Whisper transcription
   ↓
Command interpreter or AI tutor
   ↓
JSON response
```

`transcribe_pcm()` wraps the raw PCM data in a WAV container and uses Faster-Whisper to produce a transcript.

### AI tutor integration

Function: `ask_ai_tutor()`

This function:

- Reads the AI API key, model, and base URL from environment variables.
- Loads recent conversation history.
- Adds the Kasarita system prompt.
- Sends the request to an OpenAI-compatible API.
- Cleans the answer for speech.
- Stores the user and assistant messages.
- Handles rate limits and provider failures.

### AI tool execution

Function: `ai_route_and_execute()`

Allows the AI to call structured tools for:

- Creating tasks
- Listing tasks
- Completing tasks
- Deleting tasks
- Creating reminders
- Listing reminders
- Completing reminders
- Deleting reminders

This converts natural-language requests into database operations.

### Text-to-speech generation

Functions: `get_piper_voice()` and `synthesize_speech_pcm()`

The TTS pipeline:

1. Loads a Piper voice model.
2. Generates speech samples.
3. Validates mono, 16-bit PCM output.
4. Resamples audio to 16 kHz when necessary.
5. Returns raw PCM data to the ESP32.

### WebSocket connection manager

Class: `ConnectionManager`

Manages active browser connections and broadcasts:

- Voice transcripts
- AI responses
- Task updates
- Reminder updates
- ESP32 activity

## 3. Database and command tools

File: [`backend/app/mcp.py`](../backend/app/mcp.py)

### Database initialization

`initialize_database()` creates the SQLite tables:

- `tasks`
- `reminders`
- `conversation_memory`

The backend can use local SQLite or Supabase when `SUPABASE_URL` and `SUPABASE_KEY` are configured.

### Task operations

Important functions:

- `create_task()`
- `get_tasks()`
- `complete_task()`
- `update_task()`
- `delete_task()`

These functions contain the task persistence logic.

### Reminder operations

Important functions:

- `create_reminder()`
- `get_schedule()`
- `complete_reminder()`
- `delete_reminder()`

These support reminders from both the web interface and voice commands.

### Natural-language date parsing

Functions: `resolve_calendar_date()` and `extract_calendar_date()`

They convert expressions such as `today`, `tomorrow`, `next week`, `Monday`, or `March 15` into ISO dates such as:

```text
2026-03-15
```

This is important for voice-created tasks and reminders.

### Command interpretation

Function: `interpret_command()`

Detects whether a sentence is an actionable command and returns a tool name with its arguments.

For example:

```text
Create a task to review networking tomorrow
```

is converted conceptually into:

```python
(
    "create_task",
    {
        "title": "Review networking",
        "due_date": "tomorrow"
    }
)
```

### Conversation memory

Functions:

- `add_memory_message()`
- `get_memory_messages()`
- `clear_memory()`

These maintain recent conversation history for a user or ESP32 session.

### Speech cleanup

Function: `clean_for_speech()`

Removes Markdown, code blocks, bullets, emojis, and excess whitespace so responses sound natural when spoken by TTS.

## 4. React frontend

### Application routing and layout

File: [`frontend/src/App.jsx`](../frontend/src/App.jsx)

Responsibilities:

- Displays authentication when no user is logged in.
- Selects the current page.
- Loads the sidebar.
- Displays task and event modals.
- Shows toast notifications.
- Handles responsive mobile navigation.

### Global application state

File: [`frontend/src/context/store.jsx`](../frontend/src/context/store.jsx)

`AppProvider` stores:

- Current user
- Tasks
- Events
- Chat messages
- Reminders
- Theme
- Study timer
- XP and level data
- Achievements
- Quests
- Device status

`useApp()` exposes this state and the main application actions to components.

### Local persistence

The store uses browser `localStorage`:

- `loadState()` restores application state.
- A React effect saves state after changes.
- `loadTheme()` restores the selected theme.

### Frontend-backend synchronization

The store uses:

- `fetch()` for tasks and reminders.
- WebSocket for real-time chat and ESP32 events.
- HTTP `/chat` as a fallback when WebSocket is unavailable.

Important functions include:

- `reloadTasks()`
- `reloadReminders()`
- `sendWebChatMessage()`
- `markReminderDone()`
- `deleteReminder()`
- `clearChatMemory()`

### WebSocket event handling

The WebSocket logic:

- Connects to `/ws`.
- Receives transcripts and replies.
- Adds messages to the chat.
- Shows ESP32 activity notifications.
- Refreshes tasks and reminders after tool execution.
- Automatically reconnects when disconnected.

### Study timer and gamification

Important functions:

- `startStudySession()`
- `pauseStudySession()`
- `resumeStudySession()`
- `completeStudySession()`
- `awardXp()`
- `completeQuest()`

These implement study countdowns, study-time tracking, XP, levels, streaks, quests, and achievements.

### Task management

The store provides:

- `addTask()`
- `updateTask()`
- `toggleTask()`
- `deleteTask()`

These update the UI and synchronize changes with the backend API.

## 5. Main frontend screens

- [`Dashboard.jsx`](../frontend/src/pages/Dashboard.jsx) — task, progress, study, and reminder summary.
- [`Tasks.jsx`](../frontend/src/pages/Tasks.jsx) — task listing, filtering, editing, and completion.
- [`Chat.jsx`](../frontend/src/pages/Chat.jsx) — web-based AI conversation.
- [`Study.jsx`](../frontend/src/pages/Study.jsx) — study timer and subjects.
- [`Progress.jsx`](../frontend/src/pages/Progress.jsx) — XP, streaks, levels, and achievements.
- [`Analytics.jsx`](../frontend/src/pages/Analytics.jsx) — study analytics and charts.
- [`Settings.jsx`](../frontend/src/pages/Settings.jsx) — theme, subjects, and settings.
- [`Auth.jsx`](../frontend/src/pages/Auth.jsx) — registration and login.
- [`Schedule.jsx`](../frontend/src/pages/Schedule.jsx) — schedule and reminders.

Reusable UI components include:

- [`Sidebar.jsx`](../frontend/src/components/Sidebar.jsx)
- [`TaskRow.jsx`](../frontend/src/components/TaskRow.jsx)
- [`TaskForm.jsx`](../frontend/src/components/TaskForm.jsx)
- [`EventForm.jsx`](../frontend/src/components/EventForm.jsx)
- [`DeviceWidget.jsx`](../frontend/src/components/DeviceWidget.jsx)
- [`Modal.jsx`](../frontend/src/components/Modal.jsx)

## Most critical execution path

```text
Button pressed
→ stateMachineUpdate()
→ recordAudioWhilePressed()
→ sendAudioToBackend()
→ POST /audio
→ transcribe_pcm()
→ interpret_command() or AI tutor
→ task/reminder operation or AI answer
→ WebSocket broadcast
→ ESP32 receives response
→ POST /tts
→ speaker plays generated PCM audio
```

For the web application:

```text
User action
→ AppProvider function
→ REST or WebSocket request
→ FastAPI endpoint
→ mcp.py tool/database function
→ response
→ React state update
→ UI refresh
```

## Important implementation concerns

- Wi-Fi credentials and the backend IP are currently defined in [`src/backend_bridge.cpp`](../src/backend_bridge.cpp).
- Frontend login data is stored in browser `localStorage`; this is suitable for a prototype but not production authentication.
- Backend CORS is permissive and currently allows all origins.
- ESP32, backend, and frontend audio processing must agree on 16 kHz, 16-bit PCM.
- The database layer supports fallback between Supabase and local SQLite.
