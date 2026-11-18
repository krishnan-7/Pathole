/*
 * ======================================================================================
 * PROJECT: ESP32-Based Smart Pothole Detection & Real-Time Camera Monitoring System
 * ======================================================================================
 * Hardware Components:
 *   - ESP32 Dev Module (WROOM-32)
 *   - HC-SR04 Ultrasonic Distance Sensor
 *   - Common Cathode RGB LED (Red, Green, Blue)
 *   - Active 5V / 3.3V Buzzer
 *   - Current Limiting Resistors (220Ω / 330Ω)
 *   - Voltage Divider for HC-SR04 Echo (1kΩ + 2kΩ recommended for 5V -> 3.3V conversion)
 * 
 * Pin Configuration:
 *   HC-SR04:
 *     TRIG            -> GPIO 5
 *     ECHO            -> GPIO 18 (via voltage divider)
 *     VCC             -> VIN (5V)
 *     GND             -> GND
 * 
 *   RGB LED (Common Cathode):
 *     RED             -> GPIO 14 (via 220Ω/330Ω resistor)
 *     GREEN           -> GPIO 26 (via 220Ω/330Ω resistor)
 *     BLUE            -> GPIO 27 (via 220Ω/330Ω resistor)
 *     Common Cathode  -> GND
 * 
 *   Active Buzzer:
 *     Positive (+)    -> GPIO 25
 *     Negative (-)    -> GND
 * 
 * Serial Communication:
 *   Baud Rate: 115200 bps
 *   Output: Newline-separated JSON strings
 * 
 * Detection Zones:
 *   ZONE 1 - SAFE:            0.0 <= distance <= 50.0 cm  | LED: OFF   | Buzzer: OFF          | Camera: No Capture
 *   ZONE 2 - NORMAL:          50.0 < distance <= 55.0 cm  | LED: GREEN | Buzzer: OFF          | Camera: No Capture
 *   ZONE 3 - POTHOLE WARNING: 55.0 < distance <= 60.0 cm  | LED: BLUE  | Buzzer: INTERMITTENT | Camera: Auto Capture
 *   ZONE 4 - CRITICAL DANGER: distance > 60.0 cm          | LED: RED   | Buzzer: CONTINUOUS   | Camera: Auto Capture
 * 
 * Auto-Capture & Debounce / Re-arm:
 *   - Trigger capture once when distance >= 56.0 cm
 *   - Disarm further captures during the same event
 *   - Re-arm capture ONLY when distance drops back to <= 53.0 cm
 * ======================================================================================
 */
=========================================================
 SMART POTHOLE DETECTION SYSTEM
 ESP32 + HC-SR04 + RGB LED + ACTIVE BUZZER
 LAPTOP WEBCAM AUTO CAPTURE TRIGGER
=========================================================

// ---------------------- PIN DEFINITIONS ----------------------
#define PIN_TRIG        5
#define PIN_ECHO        18
#define PIN_LED_RED     14
#define PIN_LED_GREEN   26
#define PIN_LED_BLUE    27
#define PIN_BUZZER      25
 HC-SR04:
 TRIG -> GPIO 5
 ECHO -> GPIO 18 (Voltage Divider)

// ---------------------- TIMING CONSTANTS ---------------------
const unsigned long SENSOR_INTERVAL_MS = 100;     // Sensor reading frequency (10 Hz)
const unsigned long INTERMITTENT_BEEP_MS = 150;   // 150ms ON, 150ms OFF
const unsigned long ECHO_TIMEOUT_US = 30000;      // 30ms timeout (~5.1 meters max)
 RGB COMMON CATHODE:
 RED   -> GPIO 14
 GREEN -> GPIO 26
 BLUE  -> GPIO 27
 COMMON -> GND

// ---------------------- STATE VARIABLES ----------------------
unsigned long lastSensorReadTime = 0;
unsigned long lastBuzzerToggleTime = 0;
bool buzzerIntermittentState = false;
 ACTIVE BUZZER:
 POSITIVE -> GPIO 25
 NEGATIVE -> GND

// Re-arm state machine for camera capture
bool isArmed = true;       // True when system is ready to trigger a new capture
bool captureTriggeredNow = false;
 SERIAL BAUD RATE: 115200
=========================================================
*/

// Test Mode Override Variables (activated by Website Testing Panel)
bool testModeActive = false;
unsigned long testModeStartTime = 0;
const unsigned long TEST_MODE_TIMEOUT_MS = 8000; // Auto-revert to normal after 8 seconds of inactivity
#define TRIG_PIN   5
#define ECHO_PIN   18

String testLedState = "OFF";       // "RED", "GREEN", "BLUE", "OFF"
String testBuzzerState = "OFF";    // "SHORT", "INTERMITTENT", "CONTINUOUS", "OFF"
unsigned long shortBeepEndTime = 0;
#define RED_PIN    14
#define GREEN_PIN  26
#define BLUE_PIN   27

// ---------------------- FUNCTION DECLARATIONS ----------------
float measureDistanceCm();
void updateOutputs(float distance, bool sensorOk);
void setRgbLed(bool r, bool g, bool b);
void setBuzzer(bool state);
void handleSerialCommands();
void processCommand(String cmd);
#define BUZZER_PIN 25

// =============================================================
// SETUP
// =============================================================
void setup() {
  // Initialize Serial Monitor
  Serial.begin(115200);
  delay(500);
#define SOUND_SPEED 0.0343
#define ECHO_TIMEOUT 30000

  // Configure HC-SR04 Pins
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT_PULLDOWN); // Pull down to prevent floating noise on Echo
  digitalWrite(PIN_TRIG, LOW);
// Detection thresholds
#define SAFE_LIMIT   50.0
#define GREEN_LIMIT  55.0
#define BLUE_LIMIT   60.0

  // Configure RGB LED Pins
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_BLUE, OUTPUT);
  setRgbLed(false, false, false); // All OFF initially
// Camera trigger thresholds
#define CAMERA_TRIGGER 56.0
#define CAMERA_REARM   53.0

  // Configure Buzzer Pin
  pinMode(PIN_BUZZER, OUTPUT);
  setBuzzer(false);
unsigned long previousMillis = 0;
unsigned long buzzerMillis = 0;

  // Self-test LED sequence on boot
  setRgbLed(true, false, false); delay(150);
  setRgbLed(false, true, false); delay(150);
  setRgbLed(false, false, true); delay(150);
  setRgbLed(false, false, false);
const unsigned long measureInterval = 150;
const unsigned long beepInterval = 300;

  // Startup announcement
  Serial.println("{\"system\":\"ESP32_POTHOLE_SYSTEM_BOOT\",\"status\":\"READY\",\"baud\":115200}");
bool buzzerState = false;
bool cameraArmed = true;

// Detection information
String currentZone = "SAFE";
String currentLED = "OFF";
String currentBuzzer = "OFF";

// =================================================
// RGB LED CONTROL
// =================================================

void turnOffLED() {
  digitalWrite(RED_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
  digitalWrite(BLUE_PIN, LOW);
}

// =============================================================
// MAIN LOOP
// =============================================================
void loop() {
  unsigned long currentMillis = millis();
void greenLED() {
  turnOffLED();
  digitalWrite(GREEN_PIN, HIGH);
}

  // 1. Process any incoming commands from Web Dashboard Testing Panel
  handleSerialCommands();
void blueLED() {
  turnOffLED();
  digitalWrite(BLUE_PIN, HIGH);
}

  // 2. Handle Test Mode timeout
  if (testModeActive && (currentMillis - testModeStartTime > TEST_MODE_TIMEOUT_MS)) {
    testModeActive = false;
    testLedState = "OFF";
    testBuzzerState = "OFF";
    setRgbLed(false, false, false);
    setBuzzer(false);
  }
void redLED() {
  turnOffLED();
  digitalWrite(RED_PIN, HIGH);
}

  // 3. Sensor measurement and JSON telemetry update
  if (currentMillis - lastSensorReadTime >= SENSOR_INTERVAL_MS) {
    lastSensorReadTime = currentMillis;
// =================================================
// BUZZER CONTROL
// =================================================

    float rawDistance = measureDistanceCm();
    bool sensorOk = (rawDistance > 0.0 && rawDistance <= 400.0);
void buzzerOff() {
  digitalWrite(BUZZER_PIN, LOW);
  buzzerState = false;
}

    // If Test Mode is NOT overriding hardware outputs, run standard detection logic
    if (!testModeActive) {
      updateOutputs(rawDistance, sensorOk);
    } else {
      // In Test Mode, maintain test output states
      applyTestOutputs(currentMillis);
    }
void intermittentBuzzer(unsigned long currentMillis) {

  if (currentMillis - buzzerMillis >= beepInterval) {

    buzzerMillis = currentMillis;
    buzzerState = !buzzerState;

    digitalWrite(BUZZER_PIN, buzzerState);
  }
}

// =============================================================
// DISTANCE MEASUREMENT (HC-SR04 with Filtering)
// =============================================================
float measureDistanceCm() {
  // Send 10us ultrasonic trigger pulse
  digitalWrite(PIN_TRIG, LOW);
void continuousBuzzer() {
  digitalWrite(BUZZER_PIN, HIGH);
  buzzerState = true;
}

// =================================================
// ULTRASONIC DISTANCE MEASUREMENT
// =================================================

float measureDistance() {

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // Read Echo pulse duration
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, ECHO_TIMEOUT_US);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration =
      pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT);

  if (duration == 0) {
    // Sensor timed out or object out of range
    return -1.0;
  }

  // Speed of sound in air is ~343 m/s = 0.0343 cm/us
  // Distance = (duration * 0.0343) / 2
  float distance = (float)duration * 0.0343 / 2.0;
  float distance =
      (duration * SOUND_SPEED) / 2.0;

  return distance;
}

// =============================================================
// DETECTION LOGIC & TELEMETRY DISPATCH
// =============================================================
void updateOutputs(float distance, bool sensorOk) {
  unsigned long now = millis();
  String zoneStr = "OFF";
  String ledStr = "OFF";
  String buzzerStr = "OFF";
  String sensorStatus = sensorOk ? "OK" : "ERROR";
  captureTriggeredNow = false;
// =================================================
// SERIAL JSON OUTPUT
// =================================================

  if (!sensorOk) {
    // Sensor failure or out of range
    setRgbLed(false, false, false);
    setBuzzer(false);
    zoneStr = "ERROR";
    ledStr = "OFF";
    buzzerStr = "OFF";
  } else {
    // ----------------- ZONE 1 - SAFE (0.0 to 50.0 cm) -----------------
    if (distance >= 0.0 && distance <= 50.0) {
      zoneStr = "SAFE";
      ledStr = "OFF";
      buzzerStr = "OFF";
      setRgbLed(false, false, false);
      setBuzzer(false);
    }
    // ----------------- ZONE 2 - NORMAL (> 50.0 to 55.0 cm) ------------
    else if (distance > 50.0 && distance <= 55.0) {
      zoneStr = "NORMAL";
      ledStr = "GREEN";
      buzzerStr = "OFF";
      setRgbLed(false, true, false); // GREEN ON
      setBuzzer(false);
    }
    // ----------------- ZONE 3 - POTHOLE WARNING (> 55.0 to 60.0 cm) ---
    else if (distance > 55.0 && distance <= 60.0) {
      zoneStr = "BLUE";
      ledStr = "BLUE";
      buzzerStr = "INTERMITTENT";
      setRgbLed(false, false, true); // BLUE ON
void sendJSON(
  float distance,
  String zone,
  String led,
  String buzzer,
  bool capture,
  String sensor
) {

      // Intermittent Buzzer logic (150ms ON / 150ms OFF)
      if (now - lastBuzzerToggleTime >= INTERMITTENT_BEEP_MS) {
        lastBuzzerToggleTime = now;
        buzzerIntermittentState = !buzzerIntermittentState;
        setBuzzer(buzzerIntermittentState);
      }
    }
    // ----------------- ZONE 4 - CRITICAL DANGER (> 60.0 cm) -----------
    else if (distance > 60.0) {
      zoneStr = "RED";
      ledStr = "RED";
      buzzerStr = "CONTINUOUS";
      setRgbLed(true, false, false); // RED ON
      setBuzzer(true);               // Buzzer continuously ON
    }
  Serial.print("{");

    // ----------------- CAMERA AUTO-CAPTURE ARM/TRIGGER LOGIC ----------
    // Requirement 5: When distance reaches or exceeds 56.0 cm, capture one image automatically.
    // Record every detection in history. Prevent repeated capture during the same pothole event.
    // Re-arm capture only when distance returns to 53.0 cm or below.
    if (distance >= 56.0) {
      if (isArmed) {
        captureTriggeredNow = true;
        isArmed = false; // Disarm until road surface returns to normal
      }
    } else if (distance <= 53.0) {
      isArmed = true;   // Re-armed for subsequent pothole
    }
  }

  // Output strict JSON matching section 6 of master prompt:
  // {"distance": 57.40, "zone": "BLUE", "led": "BLUE", "buzzer": "INTERMITTENT", "capture": true, "sensor": "OK"}
  Serial.print("{\"distance\":");
  if (sensorOk) {
  Serial.print("\"distance\":");
  if (distance >= 0) {
    Serial.print(distance, 2);
  } else {
    Serial.print(-1.0, 2);
    Serial.print("null");
  }

  Serial.print(",\"zone\":\"");
  Serial.print(zoneStr);
  Serial.print(zone);

  Serial.print("\",\"led\":\"");
  Serial.print(ledStr);
  Serial.print(led);

  Serial.print("\",\"buzzer\":\"");
  Serial.print(buzzerStr);
  Serial.print(buzzer);

  Serial.print("\",\"capture\":");
  Serial.print(captureTriggeredNow ? "true" : "false");
  Serial.print(",\"armed\":");
  Serial.print(isArmed ? "true" : "false");
  Serial.print(capture ? "true" : "false");

  Serial.print(",\"sensor\":\"");
  Serial.print(sensorStatus);
  Serial.println("}");
}
  Serial.print(sensor);

// =============================================================
// HARDWARE DRIVERS
// =============================================================
void setRgbLed(bool r, bool g, bool b) {
  // Common Cathode: HIGH = ON, LOW = OFF
  digitalWrite(PIN_LED_RED,   r ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN, g ? HIGH : LOW);
  digitalWrite(PIN_LED_BLUE,  b ? HIGH : LOW);
  Serial.println("\"}");
}

void setBuzzer(bool state) {
  // Active Buzzer: HIGH = Sound ON, LOW = Sound OFF
  digitalWrite(PIN_BUZZER, state ? HIGH : LOW);
// =================================================
// SETUP
// =================================================

void setup() {

  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(TRIG_PIN, LOW);

  turnOffLED();
  buzzerOff();

  delay(500);

  Serial.println();
  Serial.println("SMART POTHOLE DETECTION SYSTEM");
  Serial.println("ESP32 INITIALIZED");
  Serial.println("SERIAL COMMUNICATION READY");
  Serial.println("--------------------------------");
}

// =============================================================
// TEST MODE HARDWARE EXECUTION
// =============================================================
void applyTestOutputs(unsigned long now) {
  // Apply Test LED
  if (testLedState == "RED") {
    setRgbLed(true, false, false);
  } else if (testLedState == "GREEN") {
    setRgbLed(false, true, false);
  } else if (testLedState == "BLUE") {
    setRgbLed(false, false, true);
  } else {
    setRgbLed(false, false, false);
  }
// =================================================
// MAIN LOOP
// =================================================

  // Apply Test Buzzer
  if (testBuzzerState == "SHORT") {
    if (now < shortBeepEndTime) {
      setBuzzer(true);
    } else {
      setBuzzer(false);
      testBuzzerState = "OFF";
void loop() {

  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= measureInterval) {

    previousMillis = currentMillis;

    float distance = measureDistance();

    bool captureEvent = false;

    // SENSOR ERROR
    if (distance < 0) {

      turnOffLED();
      buzzerOff();

      currentZone = "SENSOR_ERROR";
      currentLED = "OFF";
      currentBuzzer = "OFF";

      sendJSON(
        distance,
        currentZone,
        currentLED,
        currentBuzzer,
        false,
        "ERROR"
      );

      return;
    }
  } else if (testBuzzerState == "INTERMITTENT") {
    if (now - lastBuzzerToggleTime >= INTERMITTENT_BEEP_MS) {
      lastBuzzerToggleTime = now;
      buzzerIntermittentState = !buzzerIntermittentState;
      setBuzzer(buzzerIntermittentState);

    // CAMERA RE-ARM
    if (distance <= CAMERA_REARM) {
      cameraArmed = true;
    }
  } else if (testBuzzerState == "CONTINUOUS") {
    setBuzzer(true);
  } else {
    setBuzzer(false);
  }

  // Read distance for sensor test telemetry
  float rawDistance = measureDistanceCm();
  bool sensorOk = (rawDistance > 0.0 && rawDistance <= 400.0);
    // CAMERA TRIGGER
    if (distance >= CAMERA_TRIGGER && cameraArmed) {

  // Send telemetry in test mode as well
  Serial.print("{\"distance\":");
  Serial.print(sensorOk ? rawDistance : -1.0, 2);
  Serial.print(",\"zone\":\"TEST_MODE\"");
  Serial.print(",\"led\":\"");
  Serial.print(testLedState);
  Serial.print("\",\"buzzer\":\"");
  Serial.print(testBuzzerState);
  Serial.print("\",\"capture\":false,\"armed\":false,\"sensor\":\"");
  Serial.print(sensorOk ? "OK" : "ERROR");
  Serial.println("\",\"testMode\":true}");
}
      captureEvent = true;
      cameraArmed = false;
    }

// =============================================================
// SERIAL COMMAND INTERPRETER (Dashboard Testing Panel Support)
// =============================================================
void handleSerialCommands() {
  while (Serial.available() > 0) {
    String incoming = Serial.readStringUntil('\n');
    incoming.trim();
    if (incoming.length() > 0) {
      processCommand(incoming);
    // SAFE ZONE: 0 TO 50 CM
    if (distance <= SAFE_LIMIT) {

      turnOffLED();
      buzzerOff();

      currentZone = "SAFE";
      currentLED = "OFF";
      currentBuzzer = "OFF";
    }
  }
}

void processCommand(String cmd) {
  cmd.toUpperCase();
    // GREEN ZONE: ABOVE 50 TO 55 CM
    else if (distance <= GREEN_LIMIT) {

  if (cmd == "PING" || cmd == "CMD:PING") {
    Serial.println("{\"pong\":true,\"status\":\"ESP32_OK\",\"device\":\"WROOM-32\"}");
    return;
  }
      greenLED();
      buzzerOff();

  if (cmd == "CMD:TEST_START") {
    testModeActive = true;
    testModeStartTime = millis();
    Serial.println("{\"testMode\":true,\"status\":\"TEST_MODE_ENABLED\"}");
    return;
  }
      currentZone = "GREEN";
      currentLED = "GREEN";
      currentBuzzer = "OFF";
    }

  if (cmd == "CMD:TEST_STOP") {
    testModeActive = false;
    testLedState = "OFF";
    testBuzzerState = "OFF";
    setRgbLed(false, false, false);
    setBuzzer(false);
    Serial.println("{\"testMode\":false,\"status\":\"TEST_MODE_DISABLED\"}");
    return;
  }
    // BLUE ZONE: ABOVE 55 TO 60 CM
    else if (distance <= BLUE_LIMIT) {

  // LED Commands
  if (cmd == "CMD:LED_RED") {
    testModeActive = true;
    testModeStartTime = millis();
    testLedState = "RED";
    setRgbLed(true, false, false);
    Serial.println("{\"testLed\":\"RED\",\"status\":\"EXECUTED\"}");
  } else if (cmd == "CMD:LED_GREEN") {
    testModeActive = true;
    testModeStartTime = millis();
    testLedState = "GREEN";
    setRgbLed(false, true, false);
    Serial.println("{\"testLed\":\"GREEN\",\"status\":\"EXECUTED\"}");
  } else if (cmd == "CMD:LED_BLUE") {
    testModeActive = true;
    testModeStartTime = millis();
    testLedState = "BLUE";
    setRgbLed(false, false, true);
    Serial.println("{\"testLed\":\"BLUE\",\"status\":\"EXECUTED\"}");
  } else if (cmd == "CMD:LED_OFF") {
    testLedState = "OFF";
    setRgbLed(false, false, false);
    Serial.println("{\"testLed\":\"OFF\",\"status\":\"EXECUTED\"}");
  }
      blueLED();

  // Buzzer Commands
  else if (cmd == "CMD:BUZZER_SHORT") {
    testModeActive = true;
    testModeStartTime = millis();
    testBuzzerState = "SHORT";
    shortBeepEndTime = millis() + 200; // 200ms beep
    setBuzzer(true);
    Serial.println("{\"testBuzzer\":\"SHORT\",\"status\":\"EXECUTED\"}");
  } else if (cmd == "CMD:BUZZER_INTERMITTENT") {
    testModeActive = true;
    testModeStartTime = millis();
    testBuzzerState = "INTERMITTENT";
    Serial.println("{\"testBuzzer\":\"INTERMITTENT\",\"status\":\"EXECUTED\"}");
  } else if (cmd == "CMD:BUZZER_CONTINUOUS") {
    testModeActive = true;
    testModeStartTime = millis();
    testBuzzerState = "CONTINUOUS";
    setBuzzer(true);
    Serial.println("{\"testBuzzer\":\"CONTINUOUS\",\"status\":\"EXECUTED\"}");
  } else if (cmd == "CMD:BUZZER_STOP") {
    testBuzzerState = "OFF";
    setBuzzer(false);
    Serial.println("{\"testBuzzer\":\"STOPPED\",\"status\":\"EXECUTED\"}");
      intermittentBuzzer(currentMillis);

      currentZone = "BLUE";
      currentLED = "BLUE";
      currentBuzzer = "INTERMITTENT";
    }

    // RED ZONE: ABOVE 60 CM
    else {

      redLED();
      continuousBuzzer();

      currentZone = "RED";
      currentLED = "RED";
      currentBuzzer = "CONTINUOUS";
    }

    // SEND REAL-TIME DATA TO LAPTOP
    sendJSON(
      distance,
      currentZone,
      currentLED,
      currentBuzzer,
      captureEvent,
      "OK"
    );
  }
}
