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



bool buttonPressed()
{
    if(digitalRead(BUTTON_PIN)==LOW)
    {
        delay(50);

        while(
        digitalRead(BUTTON_PIN)==LOW);

        return true;
    }

    return false;
}