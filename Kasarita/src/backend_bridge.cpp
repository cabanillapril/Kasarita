#include "backend_bridge.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "driver/i2s.h"
#include "hardware/speaker.h"
#include "../include/pins.h"

constexpr char WIFI_SSID[] = "esp32";
constexpr char WIFI_PASSWORD[] = "12345678";
constexpr char BACKEND_CHAT_URL[] = "http://192.168.1.44:8000/chat";
constexpr char BACKEND_AUDIO_URL[] = "http://192.168.1.44:8000/audio";
constexpr char BACKEND_TTS_URL[] = "http://192.168.1.44:8000/tts";
constexpr uint32_t SPEAKER_DMA_DRAIN_MS = (8UL * 1024UL * 1000UL) / 16000UL + 100UL;

bool initNetwork()
{
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.println("Connecting to WiFi...");
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
        delay(500);
        Serial.print('.');
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.print("WiFi connected: ");
        Serial.println(WiFi.localIP());
        return true;
    }

    Serial.println();
    Serial.println("WiFi connection timed out");
    return false;
}

bool sendCommandToBackend(const String& command, String& response)
{
    if (WiFi.status() != WL_CONNECTED) {
        response = "WiFi not connected";
        return false;
    }

    HTTPClient http;
    Serial.print("Sending to backend: ");
    Serial.println(BACKEND_CHAT_URL);

    http.begin(BACKEND_CHAT_URL);
    http.setTimeout(10000);
    http.addHeader("Content-Type", "application/json");

    DynamicJsonDocument doc(512);
    doc["text"] = command;
    doc["device_id"] = "esp32-s3";

    String payload;
    serializeJson(doc, payload);

    Serial.print("Payload: ");
    Serial.println(payload);

    int httpCode = http.POST(payload);
    Serial.print("HTTP code: ");
    Serial.println(httpCode);

    if (httpCode > 0) {
        String body = http.getString();
        http.end();

        Serial.print("Response body: ");
        Serial.println(body);

        DynamicJsonDocument responseDoc(1024);
        DeserializationError error = deserializeJson(responseDoc, body);
        if (!error) {
            if (responseDoc.containsKey("reply")) {
                response = responseDoc["reply"].as<String>();
                return true;
            }
        }

        response = body;
        return false;
    }

    String errorBody = http.getString();
    http.end();
    response = "HTTP request failed";
    Serial.print("HTTP error body: ");
    Serial.println(errorBody);
    return false;
}

bool sendAudioToBackend(const int16_t* audio, size_t bytes, String& response, bool& hasAnswer)
{
    hasAnswer = false;
    if (WiFi.status() != WL_CONNECTED) {
        response = "WiFi not connected";
        return false;
    }

    if (audio == nullptr || bytes == 0 || bytes % sizeof(int16_t) != 0) {
        response = "Invalid audio buffer";
        return false;
    }

    HTTPClient http;
    http.begin(BACKEND_AUDIO_URL);
    http.setTimeout(60000);
    http.addHeader("Content-Type", "audio/pcm");
    http.addHeader("X-Device-Id", "esp32-s3");

    uint8_t* payload = reinterpret_cast<uint8_t*>(const_cast<int16_t*>(audio));
    int httpCode = http.POST(payload, bytes);
    Serial.print("Audio HTTP code: ");
    Serial.println(httpCode);
    if (httpCode <= 0) {
        const String error = http.errorToString(httpCode);
        response = String("Audio upload failed: ") + error;
        Serial.printf("Audio upload failed after sending %u bytes: %d (%s)\n",
                      static_cast<unsigned int>(bytes),
                      httpCode,
                      error.c_str());
        http.end();
        return false;
    }

    String body = http.getString();
    http.end();
    Serial.print("Audio response: ");
    Serial.println(body);

    DynamicJsonDocument responseDoc(4096);
    DeserializationError error = deserializeJson(responseDoc, body);
    if (error) {
        response = body;
        return false;
    }

    if (responseDoc["answer"].is<String>() && !responseDoc["answer"].as<String>().isEmpty()) {
        response = responseDoc["answer"].as<String>();
        hasAnswer = true;
    } else if (responseDoc["transcript"].is<String>()) {
        response = responseDoc["transcript"].as<String>();
    } else {
        response = responseDoc["message"].as<String>();
        }

    String status = responseDoc["status"].as<String>();
    return status == "accepted" || status == "transcribed" ||
           status == "answered" || status == "action_completed";
}

bool speakTextWithBackend(const String& text, String& error)
{
    if (WiFi.status() != WL_CONNECTED) {
        error = "WiFi not connected";
        return false;
    }

    HTTPClient http;
    const char* responseHeaders[] = {"Content-Type", "X-Audio-Sample-Rate"};
    http.collectHeaders(responseHeaders, 2);
    http.begin(BACKEND_TTS_URL);
    http.setTimeout(60000);
    http.addHeader("Content-Type", "application/json");

    DynamicJsonDocument requestDoc(2048);
    requestDoc["text"] = text;
    String payload;
    serializeJson(requestDoc, payload);

    const int httpCode = http.POST(payload);
    if (httpCode != HTTP_CODE_OK) {
        Serial.printf("TTS HTTP request failed: %d\n", httpCode);
        error = httpCode > 0 ? http.getString() : "TTS request failed";
        http.end();
        return false;
    }

    const String contentType = http.header("Content-Type");
    const String sampleRate = http.header("X-Audio-Sample-Rate");
    const int contentLength = http.getSize();
    Serial.printf("TTS response: type=%s rate=%s bytes=%d\n",
                  contentType.c_str(), sampleRate.c_str(), contentLength);
    if (!contentType.startsWith("audio/pcm") || sampleRate != "16000" ||
        contentLength <= 0 || contentLength % 2 != 0) {
        error = "Invalid TTS audio response";
        http.end();
        return false;
    }

    WiFiClient* stream = http.getStreamPtr();
    stream->setTimeout(10000);
    uint8_t buffer[1024];
    int remaining = contentLength;
    bool playbackOk = true;
    digitalWrite(I2S_SD_SPK, HIGH);
    delay(10);
    while (remaining > 0) {
        const size_t chunkSize = min(sizeof(buffer), static_cast<size_t>(remaining)) & ~static_cast<size_t>(1);
        size_t bytesRead = 0;
        while (bytesRead < chunkSize) {
            if (stream->available() <= 0 && !http.connected()) {
                playbackOk = false;
                break;
            }
            const size_t count = stream->readBytes(buffer + bytesRead, chunkSize - bytesRead);
            if (count == 0) {
                playbackOk = false;
                break;
            }
            bytesRead += count;
        }
        if (!playbackOk) {
            break;
        }
        if (bytesRead % sizeof(int16_t) != 0) {
            playbackOk = false;
            break;
        }

        size_t bytesWritten = 0;
        while (bytesWritten < bytesRead) {
            size_t written = 0;
            const esp_err_t writeResult = i2s_write(
                I2S_NUM_1,
                buffer + bytesWritten,
                bytesRead - bytesWritten,
                &written,
                portMAX_DELAY
            );
            if (writeResult != ESP_OK || written == 0) {
                playbackOk = false;
                break;
            }
            bytesWritten += written;
        }
        if (!playbackOk) {
            break;
        }
        remaining -= bytesRead;
    }
    if (playbackOk && remaining == 0) {
        delay(SPEAKER_DMA_DRAIN_MS);
    }
    digitalWrite(I2S_SD_SPK, LOW);
    http.end();

    if (!playbackOk || remaining != 0) {
        error = "TTS audio playback was interrupted";
        return false;
    }
    return true;
}
