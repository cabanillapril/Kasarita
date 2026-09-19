#pragma once

#include <Arduino.h>
#include <cstddef>
#include <cstdint>

void speakerInit();

void playAudio(
int16_t* buffer,
size_t bytes
);

void playTone(
uint32_t frequency,
uint32_t durationMs
);