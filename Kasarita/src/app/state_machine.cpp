#include "state_machine.h"

#include "../backend_bridge.h"
#include "../hardware/button.h"
#include "../hardware/display.h"
#include "../hardware/microphone.h"
#include "../hardware/speaker.h"

#include <Arduino.h>
#include <stdlib.h>

State current = IDLE;

void stateMachineUpdate()
{
    switch (current)
    {
        case IDLE:
            if (buttonIsDown())
            {
                current = LISTENING;
            }
            break;

        case LISTENING:
        {
            displayText("Recording...");

            size_t bytes = 0;
            int16_t* audio = recordAudioWhilePressed(bytes);

            if (audio == nullptr || bytes == 0)
            {
                Serial.println("Audio capture failed");
                displayText("Capture failed");
                current = IDLE;
                break;
            }

            displayText("Sending...");
            String response;
            bool ok = sendAudioToBackend(audio, bytes, response);
            free(audio);
            if (ok)
            {
                displayText(response);
                playTone(880, 120);
                delay(80);
                playTone(1320, 120);
            }
            else
            {
                displayText(response);
                playTone(220, 180);
                delay(80);
                playTone(180, 180);
            }

            current = IDLE;
            delay(1000);
            displayText("Ready");
            break;
        }


        case PLAYING:
            break;
    }
}
