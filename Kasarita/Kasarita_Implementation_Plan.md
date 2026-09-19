# Kasarita Implementation Plan

## Project

**Kasarita: An MCP-Enabled ESP32-S3 Voice-Driven Student Productivity and Learning Management System with Real-Time Web Integration**

---

## 1. Current Status

The main hardware components have already been tested individually.

Confirmed working hardware includes:

- ESP32-S3 N16R8
- INMP441 microphone
- MAX98357A amplifier and speaker

Other planned hardware components:

- OLED SSD1306 128×64
- Push button
- Red listening LED
- Blue synchronization LED
- Buzzer
- RTC

The next stage is to move from individual hardware testing to **system integration**.

---

# 2. Overall System Development Flow

The implementation will follow this sequence:

```text
Hardware Stabilization
        ↓
ESP32-S3 Firmware
        ↓
Wi-Fi Communication
        ↓
FastAPI Backend
        ↓
Speech Recognition
        ↓
MCP Server
        ↓
Database
        ↓
LLM / Conversational Processing
        ↓
Web Dashboard
        ↓
Full System Integration
        ↓
Testing and Evaluation
```

The system should be developed incrementally instead of implementing all features at once.

---

# 3. Phase 1 — Stabilize the ESP32-S3 Firmware

## Goal

Create one reliable ESP32-S3 firmware project where the hardware components can operate together.

## Tasks

### 3.1 Organize the firmware

Use the planned project structure:

```text
Kasarita/
├── include/
│   ├── pins.h
│   ├── config.h
│   └── globals.h
│
├── src/
│   ├── app/
│   ├── hardware/
│   └── network/
│
└── platformio.ini
```

### 3.2 Implement hardware modules

Create separate modules for:

- Microphone
- Speaker
- OLED
- Button
- LEDs
- Buzzer
- RTC

### 3.3 Test simultaneous operation

Verify that:

- The microphone can capture audio.
- The speaker can play audio.
- The OLED can display status.
- The button can trigger an action.
- LEDs indicate the correct system state.
- The buzzer works.
- The RTC provides the correct time.

## Completion Criteria

The ESP32-S3 can run all required hardware without crashes, unexpected resets, or major conflicts.

---

# 4. Phase 2 — Establish Wi-Fi Communication

## Goal

Allow the ESP32-S3 to communicate with the Kasarita backend.

## Architecture

```text
ESP32-S3
    │
    │ Wi-Fi
    ↓
FastAPI Backend
```

## Tasks

1. Connect the ESP32-S3 to Wi-Fi.
2. Create a basic FastAPI server.
3. Create a simple API endpoint.
4. Send a request from the ESP32-S3.
5. Return a response from the backend.
6. Display the response on the OLED.
7. Optionally play a confirmation through the speaker.

## Initial Test

The ESP32 sends:

```text
hello
```

The backend responds:

```text
Hello! I am Kasarita.
```

## Completion Criteria

The ESP32-S3 can reliably send and receive data from the backend over Wi-Fi.

---

# 5. Phase 3 — Implement Audio Capture

## Goal

Connect the working INMP441 microphone to the network communication system.

## Flow

```text
INMP441
   ↓
ESP32-S3
   ↓
Audio Buffer
   ↓
Backend
```

## Tasks

1. Configure the microphone for 16 kHz audio.
2. Capture 16-bit audio samples.
3. Implement a controlled recording duration.
4. Store the audio in a buffer.
5. Send the recorded audio to the backend.
6. Add OLED and LED status indicators.

## Suggested States

```text
IDLE
 ↓
LISTENING
 ↓
RECORDING
 ↓
UPLOADING
 ↓
PROCESSING
 ↓
RESPONSE
```

## Completion Criteria

The ESP32 can record a short voice input and successfully transmit the audio to the backend.

---

# 6. Phase 4 — Speech-to-Text

## Goal

Convert recorded speech into text.

## Flow

```text
ESP32 Microphone
       ↓
Audio
       ↓
FastAPI Backend
       ↓
Whisper / faster-whisper
       ↓
Recognized Text
```

## Tasks

1. Receive audio from the ESP32.
2. Pass the audio to the speech recognition service.
3. Convert speech into text.
4. Return the recognized text to the backend.
5. Display the recognized command on the web interface during development.

## Example

User says:

> Add math homework tomorrow.

System produces:

```text
Add math homework tomorrow.
```

## Completion Criteria

Normal voice commands can be converted into usable text with acceptable accuracy.

---

# 7. Phase 5 — Implement the MCP Server

## Goal

Introduce MCP as the tool-access layer between the conversational system and Kasarita's functions.

## Architecture

```text
Speech
  ↓
Speech-to-Text
  ↓
LLM
  ↓
MCP Server
  ↓
Kasarita Tools
```

## Initial MCP Tools

Start with only the essential tools:

```text
create_task()
get_tasks()
complete_task()
create_reminder()
get_schedule()
```

Additional tools can be added later if needed.

## Example

User:

```text
Add math homework tomorrow.
```

Processing:

```text
Speech
  ↓
Text
  ↓
LLM
  ↓
create_task()
  ↓
Database
```

## Completion Criteria

The MCP server can receive a request and correctly execute predefined Kasarita tools.

---

# 8. Phase 6 — Database Integration

## Goal

Store student productivity data persistently.

## Initial Data

The system should support:

- Tasks
- Reminders
- Schedules
- Study sessions
- User information
- Completion status

## Example Task

```text
Task:
    title: Math Homework
    due_date: 2026-09-20
    status: pending
```

## Architecture

```text
MCP Tool
   ↓
Backend
   ↓
Database
```

## Tasks

1. Define the database structure.
2. Create the required collections/tables.
3. Implement create operations.
4. Implement read operations.
5. Implement update operations.
6. Implement completion/deletion operations.
7. Connect MCP tools to the database.

## Completion Criteria

Tasks and reminders created through Kasarita remain available after restarting the system.

---

# 9. Phase 7 — LLM Integration

## Goal

Allow Kasarita to understand natural-language requests and select appropriate MCP tools.

## Example

User:

```text
I need to study mathematics tomorrow at 7 PM.
```

The LLM should determine that the request requires a scheduling/reminder action.

Possible tool call:

```text
create_reminder(
    title="Study mathematics",
    date="2026-09-20",
    time="19:00"
)
```

## Important Design Principle

The LLM should not directly modify the database.

Instead:

```text
LLM
 ↓
MCP Tool
 ↓
Backend
 ↓
Database
```

This keeps system actions controlled and easier to test.

## Completion Criteria

The system can understand several natural-language student commands and map them to the correct MCP tools.

---

# 10. Phase 8 — Text-to-Speech and ESP32 Response

## Goal

Allow Kasarita to respond through the speaker.

## Flow

```text
LLM
 ↓
Response Text
 ↓
Text-to-Speech
 ↓
Audio
 ↓
ESP32-S3
 ↓
MAX98357A
 ↓
Speaker
```

## Example

User:

```text
What tasks do I have today?
```

Kasarita responds:

```text
You have three tasks today.
```

The response should also be displayed on the OLED when appropriate.

## Completion Criteria

Kasarita can provide understandable spoken responses through the ESP32 speaker.

---

# 11. Phase 9 — Wake-Word and Interaction Control

## Goal

Make voice interaction more natural and reduce unnecessary recording.

## Basic Flow

```text
Idle
 ↓
Wake Word Detected
 ↓
Listening
 ↓
Command Recording
 ↓
Processing
 ↓
Response
 ↓
Idle
```

## Tasks

1. Implement offline wake-word detection.
2. Activate the microphone recording state after detection.
3. Use the red LED to indicate listening.
4. Use the blue LED to indicate synchronization/processing.
5. Return to idle after the response.

## Completion Criteria

Kasarita responds only after the intended wake-word interaction.

---

# 12. Phase 10 — Real-Time Web Integration

## Goal

Provide a web interface where users can view and manage their productivity information.

## Dashboard Features

Initial dashboard:

- Login
- Tasks
- Schedule
- Reminders
- Study sessions
- Progress
- Device status
- Recent activity

## Architecture

```text
                 ┌───────────────┐
                 │ Web Dashboard │
                 └───────┬───────┘
                         │
ESP32-S3 ←──────→ Backend ←──────→ MCP
                         │
                         ↓
                     Database
                         │
                         ↓
                        LLM
```

## Real-Time Updates

When a task is created using voice:

```text
Voice Command
     ↓
MCP Tool
     ↓
Database
     ↓
Web Dashboard updates
```

The same information should remain synchronized between the ESP32 and web interface.

---

# 13. Phase 11 — Study and Productivity Features

After the core system works, implement the student-focused features.

## Task Management

- Create task
- View tasks
- Complete task
- Update task
- Delete task

## Reminder Management

- Create reminder
- View upcoming reminders
- Trigger reminder
- Mark reminder as completed

## Schedule Management

- Add schedule
- View schedule
- Check today's schedule

## Study Support

Possible features:

- Study session tracking
- Study reminders
- Progress tracking
- Conversational research mode

Only features necessary for the approved scope should be included.

---

# 14. Phase 12 — Full System Integration

At this stage, test the complete flow.

## Example 1 — Creating a Task

```text
User
 ↓
"Add programming assignment tomorrow."
 ↓
ESP32-S3
 ↓
Speech Recognition
 ↓
LLM
 ↓
MCP create_task()
 ↓
Database
 ↓
Web Dashboard
 ↓
ESP32 Confirmation
 ↓
Speaker
```

## Example 2 — Checking Tasks

```text
User
 ↓
"What tasks do I have today?"
 ↓
ESP32-S3
 ↓
Speech Recognition
 ↓
LLM
 ↓
MCP get_tasks()
 ↓
Database
 ↓
LLM Response
 ↓
Text-to-Speech
 ↓
ESP32 Speaker
```

---

# 15. Phase 13 — System Testing

Testing should be performed after the core integration is functional.

## Functional Testing

Test:

- Voice commands
- Task creation
- Task retrieval
- Task completion
- Reminders
- Schedule
- Web synchronization
- Audio input
- Audio output

## Hardware Testing

Test:

- Microphone
- Speaker
- OLED
- Button
- LEDs
- Buzzer
- RTC
- Wi-Fi connection

## Error Testing

Test what happens when:

- Wi-Fi is disconnected.
- Backend is unavailable.
- Speech recognition fails.
- The LLM fails.
- An MCP tool fails.
- Database access fails.
- The user gives an invalid command.

---

# 16. Phase 14 — Offline and Recovery Behavior

Define what Kasarita does when there is no internet connection.

Possible behavior:

```text
Internet Available
    ↓
Normal Voice Processing
```

If connection is unavailable:

```text
Internet Unavailable
    ↓
Offline Mode
    ↓
Local Wake Word
    ↓
Basic Device Functions
```

The system should clearly indicate its current state using the LEDs and OLED.

---

# 17. Phase 15 — Performance Evaluation

After development is complete, evaluate the system using the selected ISO/IEC 25010 characteristics.

## Functional Suitability

Determine whether the implemented functions meet the intended student productivity requirements.

## Performance Efficiency

Measure factors such as:

- Response time
- Processing time
- Synchronization time
- Resource usage

## Compatibility

Check whether the system works correctly across its intended hardware, backend, database, and web components.

## Usability

Evaluate:

- Ease of interaction
- Ease of learning
- Clarity of feedback
- Ease of using voice commands

## Reliability

Evaluate:

- Successful request rate
- System stability
- Error recovery
- Connection reliability

---

# 18. Recommended Development Order

Use this order to avoid building too many features simultaneously:

```text
1. ESP32 Hardware Stabilization
          ↓
2. Wi-Fi Connection
          ↓
3. ESP32 ↔ FastAPI Communication
          ↓
4. Microphone Audio Capture
          ↓
5. Audio Upload
          ↓
6. Speech-to-Text
          ↓
7. MCP Server
          ↓
8. Database
          ↓
9. MCP Tools
          ↓
10. LLM Integration
          ↓
11. Text-to-Speech
          ↓
12. Speaker Response
          ↓
13. Wake Word
          ↓
14. Web Dashboard
          ↓
15. Real-Time Synchronization
          ↓
16. Full Integration
          ↓
17. Testing
          ↓
18. ISO 25010 Evaluation
```

---

# 19. Immediate Next Task

The next task should **not** be the LLM or the complete MCP system yet.

Start with:

```text
ESP32-S3
    ↓
Wi-Fi
    ↓
FastAPI
    ↓
Simple HTTP Request
    ↓
Response
    ↓
ESP32 OLED
```

### First milestone

Make this work:

```text
ESP32 sends:
"Kasarita test"

Backend returns:
"Kasarita backend connected."
```

Once this works reliably, proceed to audio transmission and speech recognition.

---

# 20. Development Milestones

| Milestone | Target Result |
|---|---|
| M1 | All ESP32 hardware operates together |
| M2 | ESP32 connects to Wi-Fi |
| M3 | ESP32 communicates with FastAPI |
| M4 | ESP32 records and uploads audio |
| M5 | Speech is converted to text |
| M6 | MCP server is operational |
| M7 | Database is connected |
| M8 | MCP tools modify/retrieve data |
| M9 | LLM can use MCP tools |
| M10 | ESP32 receives spoken responses |
| M11 | Wake-word interaction works |
| M12 | Web dashboard is connected |
| M13 | Real-time synchronization works |
| M14 | Complete Kasarita workflow works |
| M15 | System testing is completed |
| M16 | ISO 25010 evaluation is conducted |

---

## Final Development Target

The finished Kasarita system should demonstrate this complete interaction:

```text
              ┌─────────────────┐
              │     Student     │
              └────────┬────────┘
                       │
                    Voice
                       ↓
              ┌─────────────────┐
              │    ESP32-S3     │
              │ Mic / Speaker   │
              └────────┬────────┘
                       │
                     Wi-Fi
                       ↓
              ┌─────────────────┐
              │  FastAPI / MCP  │
              │     Server      │
              └────────┬────────┘
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
        Speech-to-Text          LLM
                                 │
                                 ↓
                            MCP Tools
                                 │
                                 ↓
                            Database
                                 │
                    ┌────────────┴────────────┐
                    ↓                         ↓
             Web Dashboard              ESP32 Response
```

The main goal is to build and verify each layer separately before connecting it to the next layer. This makes development easier to debug and provides clear evidence for the Agile development process and thesis documentation.
