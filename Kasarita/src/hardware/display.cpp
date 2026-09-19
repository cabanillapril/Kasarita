#include "display.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "../../include/pins.h"


#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64


Adafruit_SSD1306 display(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    -1
);


void displayInit()
{

    Wire.begin(OLED_SDA, OLED_SCL);


    if(!display.begin(
        SSD1306_SWITCHCAPVCC,
        0x3C))
    {
        Serial.println("OLED FAILED");
        while(true);
    }


    display.clearDisplay();

    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setTextWrap(false);

    displayText("IntelliVo Ready");
}



void displayText(String text)
{
    display.clearDisplay();
    display.setCursor(0, 0);
    display.setTextWrap(false);

    String line = text;
    const uint8_t maxChars = 21;
    if (line.length() > maxChars) {
        line = line.substring(0, maxChars);
        line += "...";
    }

    display.println(line);
    display.display();
}