#include "speaker.h"

#include <Arduino.h>
#include "driver/i2s.h"

#include "../../include/pins.h"



void speakerInit()
{


pinMode(
I2S_SD_SPK,
OUTPUT
);

digitalWrite(
I2S_SD_SPK,
LOW);



i2s_config_t config =
{

.mode =
(i2s_mode_t)
(I2S_MODE_MASTER |
I2S_MODE_TX),


.sample_rate = 16000,

.bits_per_sample =
I2S_BITS_PER_SAMPLE_16BIT,


.channel_format =
I2S_CHANNEL_FMT_ONLY_LEFT,


.communication_format =
I2S_COMM_FORMAT_STAND_I2S,


.dma_buf_count=8,

.dma_buf_len=1024

};



i2s_pin_config_t pins =
{

.bck_io_num =
I2S_BCLK_SPK,


.ws_io_num =
I2S_LRC_SPK,


.data_out_num =
I2S_DOUT_SPK,


.data_in_num =
I2S_PIN_NO_CHANGE

};



i2s_driver_install(
I2S_NUM_1,
&config,
0,
NULL
);


i2s_set_pin(
I2S_NUM_1,
&pins
);

}




void playAudio(
int16_t* buffer,
size_t bytes
)
{


digitalWrite(
I2S_SD_SPK,
HIGH
);



size_t written;


i2s_write(
I2S_NUM_1,
buffer,
bytes,
&written,
portMAX_DELAY
);



digitalWrite(
I2S_SD_SPK,
LOW
);

}

void playTone(
uint32_t frequency,
uint32_t durationMs
)
{
    if (frequency == 0 || durationMs == 0) {
        return;
    }

    const uint32_t sampleRate = 16000;
    const size_t chunkSize = 256;
    int16_t buffer[chunkSize];
    uint32_t totalSamples = (sampleRate * durationMs) / 1000;
    uint32_t phase = 0;

    digitalWrite(I2S_SD_SPK, HIGH);

    for (uint32_t sent = 0; sent < totalSamples;) {
        size_t count = chunkSize;
        if (sent + count > totalSamples) {
            count = totalSamples - sent;
        }

        for (size_t i = 0; i < count; ++i) {
            phase += (frequency << 16) / sampleRate;
            bool high = (phase & 0xFFFF) > 0x7FFF;
            buffer[i] = high ? 12000 : -12000;
        }

        size_t written = 0;
        i2s_write(I2S_NUM_1, buffer, count * sizeof(int16_t), &written, portMAX_DELAY);
        sent += count;
    }

    digitalWrite(I2S_SD_SPK, LOW);
}