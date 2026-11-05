#include "backend_bridge.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

constexpr char WIFI_SSID[] = "esp32";
constexpr char WIFI_PASSWORD[] = "12345678";
constexpr char BACKEND_CHAT_URL[] = "http://192.168.68.163:8000/chat";
constexpr char BACKEND_AUDIO_URL[] = "http://192.168.68.163:8000/audio";

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

bool sendAudioToBackend(const int16_t* audio, size_t bytes, String& response)
{
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
    http.setTimeout(15000);
    http.addHeader("Content-Type", "audio/pcm");
    http.addHeader("X-Device-Id", "esp32-s3");

    uint8_t* payload = reinterpret_cast<uint8_t*>(const_cast<int16_t*>(audio));
    int httpCode = http.POST(payload, bytes);
    Serial.print("Audio HTTP code: ");
    Serial.println(httpCode);
    if (httpCode <= 0) {
        response = "Audio upload failed";
        http.end();
        return false;
    }

    String body = http.getString();
    http.end();
    Serial.print("Audio response: ");
    Serial.println(body);

    DynamicJsonDocument responseDoc(512);
    DeserializationError error = deserializeJson(responseDoc, body);
    if (error) {
        response = body;
        return false;
    }

    if (responseDoc["answer"].is<String>()) {
        response = responseDoc["answer"].as<String>();
    } else if (responseDoc["transcript"].is<String>()) {
        response = responseDoc["transcript"].as<String>();
    } else {
        response = responseDoc["message"].as<String>();
        }

        String status = responseDoc["status"].as<String>();
        return status == "accepted" || status == "transcribed" || status == "answered";
}
