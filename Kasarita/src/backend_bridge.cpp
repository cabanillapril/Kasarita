#include "backend_bridge.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

constexpr char WIFI_SSID[] = "B315_420";
constexpr char WIFI_PASSWORD[] = "Tessaprilj123@";
constexpr char BACKEND_URL[] = "http://192.168.1.14:8001/chat";

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
    Serial.println(BACKEND_URL);

    http.begin(BACKEND_URL);
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
