#pragma once

#include <Arduino.h>

bool initNetwork();
bool sendCommandToBackend(const String& command, String& response);
bool sendAudioToBackend(const int16_t* audio, size_t bytes, String& response);
