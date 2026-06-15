/*
 * ===================================================================
 *  스마트 쓰레기통 - ESP32 펌웨어
 * ===================================================================
 *  센서:
 *   - HC-SR04 초음파 거리센서  → 부피(높이) 기준 포화도
 *   - 로드셀(5kg) + HX711      → 무게 기준 포화도
 *   - 택트 스위치              → 고장 상태(누르면 고장)
 *
 *  계산:
 *   최종 포화도 = 부피 포화도 * 0.6 + 무게 포화도 * 0.4
 *   (웹의 src/store.js 와 동일한 공식)
 *
 *  전송:
 *   Wi-Fi → Firebase Realtime Database (REST PATCH)
 *   주소 예) https://<프로젝트>-default-rtdb.firebaseio.com/bins/bin-1.json
 *
 *  필요 라이브러리 (Arduino IDE > 라이브러리 매니저):
 *   - "HX711" by Bogdan Necula (bogde)
 *  (WiFi, HTTPClient, WiFiClientSecure 는 ESP32 보드패키지에 기본 포함)
 * ===================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "HX711.h"

// ---------- 1. 사용자 설정 ----------------------------------------
const char* WIFI_SSID     = "여기에_와이파이_이름";
const char* WIFI_PASSWORD = "여기에_와이파이_비밀번호";

// Firebase Realtime Database 주소 (끝에 / 없이)
const String FIREBASE_DB = "https://프로젝트이름-default-rtdb.firebaseio.com";
// 이 쓰레기통의 ID (웹 store.js 의 id 와 일치시켜야 함)
const String BIN_ID = "bin-1";

// ---------- 2. 핀 배치 --------------------------------------------
// HC-SR04
const int PIN_TRIG = 5;
const int PIN_ECHO = 18;
// HX711
const int PIN_HX_DOUT = 16;
const int PIN_HX_SCK  = 4;
// 택트 스위치 (고장 버튼). 내부 풀업 사용 → 누르면 LOW
const int PIN_BUTTON = 19;

// ---------- 3. 보정(캘리브레이션) 값 ------------------------------
// ▼ 초음파: 통이 "빈" 상태의 거리(cm)와 "가득 찬" 상태의 거리(cm)
//   센서는 위(뚜껑)에서 아래로 본다. 비면 거리가 멀고, 차면 가까워진다.
const float DIST_EMPTY = 20.0; // 통이 비었을 때 센서~바닥 거리(cm)
const float DIST_FULL  = 4.0;  // 통이 가득 찼을 때 센서~쓰레기 거리(cm)

// ▼ 무게: HX711 보정 계수 와 "가득 찼다고 볼 무게(g)"
//   CALIB_FACTOR 는 아래 [보정 방법] 참고해서 직접 구한다.
const float CALIB_FACTOR = -7050.0; // 로드셀마다 다름 → 반드시 보정 필요
const float WEIGHT_FULL_G = 1000.0; // 이 무게(g)면 무게 포화도 100%로 본다

// 가중치 (웹과 동일)
const float VOLUME_RATIO = 0.6;
const float WEIGHT_RATIO = 0.4;

// 전송 주기(ms)
const unsigned long SEND_INTERVAL = 3000;

HX711 scale;
unsigned long lastSend = 0;

// ---------- 4. 헬퍼 함수 ------------------------------------------
float clamp100(float v) {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

// 초음파 거리(cm) 측정 (여러 번 측정해 평균)
float readDistanceCm() {
  long total = 0;
  int valid = 0;
  for (int i = 0; i < 5; i++) {
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);
    long dur = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms 타임아웃
    if (dur > 0) {
      total += dur;
      valid++;
    }
    delay(20);
  }
  if (valid == 0) return DIST_EMPTY; // 측정 실패 시 빈 것으로 처리
  float avgDur = (float)total / valid;
  return avgDur * 0.0343 / 2.0; // 음속 343m/s
}

// 거리 → 부피 포화도(%)
float distanceToPct(float dist) {
  // 거리가 DIST_EMPTY 이면 0%, DIST_FULL 이면 100%
  float pct = (DIST_EMPTY - dist) / (DIST_EMPTY - DIST_FULL) * 100.0;
  return clamp100(pct);
}

// 무게(g) → 무게 포화도(%)
float weightToPct(float grams) {
  if (grams < 0) grams = 0;
  return clamp100(grams / WEIGHT_FULL_G * 100.0);
}

// ---------- 5. Firebase 전송 --------------------------------------
void sendToFirebase(int ultraPct, int weightPct, bool broken) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // 시연용: 인증서 검증 생략 (간단함 우선)

  HTTPClient https;
  String url = FIREBASE_DB + "/bins/" + BIN_ID + ".json";
  if (!https.begin(client, url)) {
    Serial.println("HTTPS begin 실패");
    return;
  }
  https.addHeader("Content-Type", "application/json");

  // PATCH = 해당 통의 값만 갱신
  String body = "{";
  body += "\"name\":\"" + BIN_ID + "\",";
  body += "\"ultrasonicPct\":" + String(ultraPct) + ",";
  body += "\"weightPct\":" + String(weightPct) + ",";
  body += "\"broken\":" + String(broken ? "true" : "false");
  body += "}";

  int code = https.sendRequest("PATCH", body);
  Serial.printf("Firebase 응답: %d\n", code);
  https.end();
}

// ---------- 6. setup ----------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  // 로드셀 초기화
  scale.begin(PIN_HX_DOUT, PIN_HX_SCK);
  scale.set_scale(CALIB_FACTOR);
  scale.tare(); // 시작 시 0점 잡기 (통은 비워둔 상태로 켜기)

  // Wi-Fi 연결
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Wi-Fi 연결 중");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi 연결됨: " + WiFi.localIP().toString());
}

// ---------- 7. loop -----------------------------------------------
void loop() {
  if (millis() - lastSend < SEND_INTERVAL) return;
  lastSend = millis();

  // (1) 초음파 → 부피 포화도
  float dist = readDistanceCm();
  float volPct = distanceToPct(dist);

  // (2) 무게 → 무게 포화도
  float grams = scale.get_units(5); // 5회 평균
  if (grams < 0) grams = 0;
  float wPct = weightToPct(grams);

  // (3) 최종 포화도 (참고용 로그)
  float finalPct = volPct * VOLUME_RATIO + wPct * WEIGHT_RATIO;

  // (4) 고장 버튼 (눌리면 LOW)
  bool broken = (digitalRead(PIN_BUTTON) == LOW);

  Serial.printf(
    "거리 %.1fcm → 부피 %.0f%% | 무게 %.0fg → %.0f%% | 최종 %.0f%% | %s\n",
    dist, volPct, grams, wPct, finalPct, broken ? "고장" : "정상");

  // (5) 웹으로 전송 (최종 계산은 웹/서버에서도 동일 공식으로 다시 함)
  sendToFirebase((int)round(volPct), (int)round(wPct), broken);
}

/*
 * ===================================================================
 *  [HX711 무게 보정 방법]
 *  1) CALIB_FACTOR 를 임시로 1.0 으로 두고 업로드.
 *  2) 통을 비운 채로 켜고 시리얼 모니터의 raw 값을 확인 (scale.get_units()).
 *  3) 무게를 아는 물건(예: 500g)을 올리고 나온 값 X 를 확인.
 *  4) CALIB_FACTOR = X / 500  으로 설정 후 다시 업로드.
 *  5) 정확히 500g 으로 나오면 보정 완료.
 * ===================================================================
 */
