/**
 * adkerala ESP32 firmware
 *
 * Hardware:
 *  - 3 push buttons (normally-open, connect to GND):
 *      FORWARD  → GPIO 12
 *      UNDO     → GPIO 14
 *      ANNOUNCE → GPIO 27
 *  - Built-in LED on GPIO 2 (status indicator)
 *
 * Behaviour:
 *  1. Connect to bus WiFi router (credentials in NVS)
 *  2. Discover display device via mDNS → "adkerala-display.local" port 8765
 *  3. Send button events as JSON over WebSocket
 *  4. Send heartbeat every 10 s
 *  5. Reconnect every 2 s on disconnect
 *  6. NEVER connects to the internet — local LAN only
 *
 * Configuration (written via Serial on first boot or via separate config tool):
 *  wifi_ssid / wifi_pass / device_token (used for display to validate source)
 *
 * LED status:
 *  - Slow blink (1 Hz): connecting to WiFi
 *  - Fast blink (5 Hz): WebSocket connecting
 *  - Solid ON: connected and ready
 */

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebSocketsClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ── Pin definitions ────────────────────────────────────────────────────────────
#define PIN_FORWARD   12
#define PIN_UNDO      14
#define PIN_ANNOUNCE  27
#define PIN_LED        2

// ── Timing ────────────────────────────────────────────────────────────────────
#define HEARTBEAT_INTERVAL_MS  10000
#define DEBOUNCE_MS             50
#define WS_RETRY_INTERVAL_MS  2000

// ── WebSocket client ──────────────────────────────────────────────────────────
WebSocketsClient wsClient;
Preferences      prefs;

// ── State ─────────────────────────────────────────────────────────────────────
bool    wsConnected       = false;
bool    mdnsResolved      = false;
String  displayIp         = "";
String  wifiSsid          = "";
String  wifiPass          = "";
String  deviceToken       = "";
uint32_t lastHeartbeat    = 0;
uint32_t lastWsRetry      = 0;

// Button debounce
bool     btnForwardLast   = HIGH;
bool     btnUndoLast      = HIGH;
bool     btnAnnounceLast  = HIGH;
uint32_t btnForwardTime   = 0;
uint32_t btnUndoTime      = 0;
uint32_t btnAnnounceTime  = 0;

// ── Forward declarations ──────────────────────────────────────────────────────
void connectWifi();
void resolveDisplay();
void connectWs();
void sendButton(const char* button);
void sendHeartbeat();
void wsEvent(WStype_t type, uint8_t* payload, size_t length);
void checkButtons();

// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n[adkerala] ESP32 firmware starting");

  // Button pins — internal pull-up, press = LOW
  pinMode(PIN_FORWARD,  INPUT_PULLUP);
  pinMode(PIN_UNDO,     INPUT_PULLUP);
  pinMode(PIN_ANNOUNCE, INPUT_PULLUP);
  pinMode(PIN_LED,      OUTPUT);

  // Load config from NVS
  prefs.begin("adkerala", true); // read-only namespace
  wifiSsid    = prefs.getString("wifi_ssid",    "");
  wifiPass    = prefs.getString("wifi_pass",    "");
  deviceToken = prefs.getString("device_token", "esp32-default");
  prefs.end();

  if (wifiSsid.isEmpty()) {
    Serial.println("[CONFIG] No WiFi credentials! Set via Serial config.");
    Serial.println("[CONFIG] Send: SET wifi_ssid=<ssid>|wifi_pass=<pass>|device_token=<token>");
    // Blink LED indefinitely waiting for config
    while (true) {
      digitalWrite(PIN_LED, HIGH); delay(100);
      digitalWrite(PIN_LED, LOW);  delay(100);
      handleSerialConfig();
    }
  }

  connectWifi();
}

void loop() {
  wsClient.loop();
  checkButtons();

  uint32_t now = millis();

  // Heartbeat
  if (wsConnected && now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  // Retry WS connection if not connected
  if (!wsConnected && now - lastWsRetry > WS_RETRY_INTERVAL_MS) {
    lastWsRetry = now;
    if (!mdnsResolved) {
      resolveDisplay();
    }
    if (mdnsResolved) {
      connectWs();
    }
  }

  // WiFi check
  if (WiFi.status() != WL_CONNECTED) {
    wsConnected   = false;
    mdnsResolved  = false;
    connectWifi();
  }
}

// ── WiFi ──────────────────────────────────────────────────────────────────────

void connectWifi() {
  Serial.printf("[WiFi] Connecting to: %s\n", wifiSsid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    digitalWrite(PIN_LED, HIGH); delay(500);
    digitalWrite(PIN_LED, LOW);  delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
    MDNS.begin("adkerala-esp32");
    resolveDisplay();
  } else {
    Serial.println("\n[WiFi] Failed — will retry");
  }
}

// ── mDNS discovery ────────────────────────────────────────────────────────────

void resolveDisplay() {
  // Try to resolve adkerala-display.local
  IPAddress ip = MDNS.queryHost("adkerala-display");
  if (ip != INADDR_NONE) {
    displayIp    = ip.toString();
    mdnsResolved = true;
    Serial.printf("[mDNS] Display found at: %s\n", displayIp.c_str());
  } else {
    Serial.println("[mDNS] Display not found yet");
  }
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

void connectWs() {
  Serial.printf("[WS] Connecting to ws://%s:8765\n", displayIp.c_str());
  wsClient.begin(displayIp.c_str(), 8765, "/");
  wsClient.onEvent(wsEvent);
  wsClient.setReconnectInterval(WS_RETRY_INTERVAL_MS);

  // Fast blink while connecting
  digitalWrite(PIN_LED, HIGH); delay(100);
  digitalWrite(PIN_LED, LOW);  delay(100);
}

void wsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      wsConnected = true;
      digitalWrite(PIN_LED, HIGH); // solid ON
      Serial.println("[WS] Connected to display");
      break;

    case WStype_DISCONNECTED:
      wsConnected  = false;
      mdnsResolved = false; // re-resolve on reconnect in case display rebooted
      digitalWrite(PIN_LED, LOW);
      Serial.println("[WS] Disconnected from display");
      break;

    case WStype_TEXT:
      // ACK received from display — ignore
      break;

    default:
      break;
  }
}

// ── Button handling ───────────────────────────────────────────────────────────

void checkButtons() {
  uint32_t now = millis();

  bool fwd = digitalRead(PIN_FORWARD)  == LOW;
  bool und = digitalRead(PIN_UNDO)     == LOW;
  bool ann = digitalRead(PIN_ANNOUNCE) == LOW;

  // FORWARD
  if (fwd && !btnForwardLast) {
    btnForwardTime = now;
  } else if (!fwd && btnForwardLast && (now - btnForwardTime) > DEBOUNCE_MS) {
    sendButton("forward");
  }
  btnForwardLast = fwd;

  // UNDO
  if (und && !btnUndoLast) {
    btnUndoTime = now;
  } else if (!und && btnUndoLast && (now - btnUndoTime) > DEBOUNCE_MS) {
    sendButton("undo");
  }
  btnUndoLast = und;

  // ANNOUNCE
  if (ann && !btnAnnounceLast) {
    btnAnnounceTime = now;
  } else if (!ann && btnAnnounceLast && (now - btnAnnounceTime) > DEBOUNCE_MS) {
    sendButton("announce");
  }
  btnAnnounceLast = ann;
}

// ── Message sending ───────────────────────────────────────────────────────────

void sendButton(const char* button) {
  if (!wsConnected) return;

  StaticJsonDocument<128> doc;
  doc["type"]   = "btn";
  doc["button"] = button;
  doc["token"]  = deviceToken;
  doc["ts"]     = millis();

  char buf[128];
  serializeJson(doc, buf);
  wsClient.sendTXT(buf);

  Serial.printf("[BTN] Sent: %s\n", button);
}

void sendHeartbeat() {
  if (!wsConnected) return;

  StaticJsonDocument<64> doc;
  doc["type"] = "heartbeat";
  doc["ts"]   = millis();

  char buf[64];
  serializeJson(doc, buf);
  wsClient.sendTXT(buf);
}

// ── Serial config (first-time setup) ─────────────────────────────────────────

void handleSerialConfig() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();
  if (!line.startsWith("SET ")) return;
  line = line.substring(4);

  prefs.begin("adkerala", false); // read-write

  // Parse key=value pairs separated by |
  int start = 0;
  while (start < (int)line.length()) {
    int sep   = line.indexOf('=', start);
    int delim = line.indexOf('|', start);
    if (delim < 0) delim = line.length();
    if (sep < 0 || sep > delim) { start = delim + 1; continue; }

    String key = line.substring(start, sep);
    String val = line.substring(sep + 1, delim);
    prefs.putString(key.c_str(), val.c_str());
    Serial.printf("[CONFIG] Saved: %s = %s\n", key.c_str(), val.c_str());

    start = delim + 1;
  }

  prefs.end();
  Serial.println("[CONFIG] Done. Restarting...");
  delay(500);
  ESP.restart();
}
