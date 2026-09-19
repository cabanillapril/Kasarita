#include <Arduino.h>


#include "hardware/display.h"
#include "hardware/button.h"
#include "hardware/microphone.h"
#include "hardware/speaker.h"


#include "app/state_machine.h"
#include "backend_bridge.h"

void setup()
{
    Serial.begin(115200);

    displayInit();
    buttonInit();
    microphoneInit();
    speakerInit();

    if (initNetwork()) {
        String response;
        if (sendCommandToBackend("boot", response)) {
            Serial.print("Backend reply: ");
            Serial.println(response);
        } else {
            Serial.print("Backend error: ");
            Serial.println(response);
        }
    }
}

void loop()
{

stateMachineUpdate();

}