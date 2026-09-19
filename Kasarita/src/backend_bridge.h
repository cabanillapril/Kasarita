#pragma once

#include <Arduino.h>

bool initNetwork();
bool sendCommandToBackend(const String& command, String& response);
