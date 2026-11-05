#include "microphone.h"
#include "button.h"

#include <Arduino.h>
#include "driver/i2s.h"
#include "esp_heap_caps.h"

#include "../../include/pins.h"

#define SAMPLE_RATE 16000
#define RECORD_TIME 10
#define BUFFER_SIZE (RECORD_TIME * SAMPLE_RATE * 2)

void microphoneInit()
{
    i2s_config_t config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .dma_buf_count = 8,
        .dma_buf_len = 1024
    };

    i2s_pin_config_t pins = {
        .bck_io_num = I2S_BCLK_MIC,
        .ws_io_num = I2S_LRC_MIC,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_DIN_MIC
    };

    i2s_driver_install(I2S_NUM_0, &config, 0, NULL);
    i2s_set_pin(I2S_NUM_0, &pins);
}

int16_t* recordAudioWhilePressed(size_t &bytes)
{
    bytes = 0;
    size_t max_bytes = BUFFER_SIZE;
    int16_t *buffer = (int16_t*)heap_caps_malloc(max_bytes, MALLOC_CAP_DEFAULT);
    if (!buffer) return nullptr;

    const size_t chunk_size = 2048;
    while (buttonIsDown() && bytes < max_bytes)
    {
        size_t read_bytes = 0;
        i2s_read(
            I2S_NUM_0,
            (uint8_t*)buffer + bytes,
            chunk_size,
            &read_bytes,
            pdMS_TO_TICKS(50)
        );
        bytes += read_bytes;
    }

    if (bytes == 0)
    {
        free(buffer);
        return nullptr;
    }

    return buffer;
}

int16_t* recordAudio(size_t &bytes)
{
    return recordAudioWhilePressed(bytes);
}