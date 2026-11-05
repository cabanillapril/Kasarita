#include "button.h"
#include <Arduino.h>
#include "../../include/pins.h"


void buttonInit()
{
    pinMode(
        BUTTON_PIN,
        INPUT_PULLUP
    );
}



bool buttonIsDown()
{
    return digitalRead(BUTTON_PIN) == LOW;
}

bool buttonPressed()
{
    if (digitalRead(BUTTON_PIN) == LOW)
    {
        delay(30);
        return digitalRead(BUTTON_PIN) == LOW;
    }
    return false;
}