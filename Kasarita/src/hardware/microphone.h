#pragma once

#include <Arduino.h>
#include <cstddef>
#include <cstdint>

void microphoneInit();

int16_t* recordAudio(size_t &bytes);