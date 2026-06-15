# ♻️ 스마트 쓰레기통 위치·수거 연동 웹 서비스

쓰레기통에 센서(초음파+무게)를 달아 **얼마나 찼는지**를 측정하고,
Kakao 지도에 표시해 **수거가 필요한 시점**을 판단하는 고등학생 대회/수행평가용
프로토타입입니다.

- 사용자 웹(`/`): 지도에서 쓰레기통 상태 확인 + 수거 요청
- 관리자 웹(`/admin`): 수거 요청 확인 + 환경미화원 위치 + 수거 완료 처리
- 하드웨어: ESP32 + HC-SR04(부피) + 로드셀/HX711(무게) + 택트 스위치(고장)

> **핵심 공식**: `최종 포화도 = 초음파(부피) × 0.6 + 무게 × 0.4`

---

## 폴더 구조

```
smart-trash/
├ src/
│  ├ App.js            # 라우팅(/, /admin) + 시뮬레이션/Firebase 시작
│  ├ TrashMap.js       # 사용자용 지도 화면
│  ├ Admin.js          # 관리자용 화면
│  ├ store.js          # 공유 저장소 + 포화도 계산 + 시뮬레이션 + Firebase
│  ├ useStore.js       # store 구독 훅
│  ├ KakaoMap.js       # 공용 Kakao 지도 컴포넌트(상태별 색 마커)
│  └ useKakaoLoader.js # Kakao SDK 동적 로더
├ firmware/
│  ├ smart_trash_esp32/smart_trash_esp32.ino  # ESP32 펌웨어
│  └ platformio.ini
└ docs/
   ├ 01-회로연결.md
   ├ 02-Firebase설정.md
   └ 03-발표대본.md
```

---

## 웹 실행 방법

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 파일 만들기
cp .env.example .env
#   .env 를 열어 REACT_APP_KAKAO_KEY 에 Kakao JavaScript 키 입력
#   (Firebase 주소는 비워두면 시뮬레이션 모드)

# 3) 실행
npm start          # http://localhost:3000
```

### Kakao 지도 키 발급
1. https://developers.kakao.com → 애플리케이션 추가
2. **앱 키 → JavaScript 키** 복사 → `.env` 의 `REACT_APP_KAKAO_KEY`
3. **플랫폼 → Web → 사이트 도메인**에 `http://localhost:3000` 등록

> 키가 없어도 지도만 안 보일 뿐, 오른쪽 패널·목록·요청·수거 기능은 모두 동작합니다.

---

## 동작 모드

| 모드 | 조건 | 동작 |
|------|------|------|
| 시뮬레이션 | `.env` 의 Firebase 주소 비움 | 시간이 지나면 포화도가 차오름 |
| ESP32 연동 | Firebase 주소 입력 | 실제 센서값을 1.5초마다 읽어 반영 |

두 모드는 섞일 수 있습니다. ESP32 값이 들어온 통은 실측값을, 나머지는
시뮬레이션 값을 사용합니다.

---

## 요청하신 8가지 → 어디에 있나

| 요청 | 위치 |
|------|------|
| 1. 회로 연결 방법 | `docs/01-회로연결.md` |
| 2. Arduino/PlatformIO 코드 | `firmware/smart_trash_esp32/…ino`, `platformio.ini` |
| 3. 초음파 → 포화도 변환 | 펌웨어 `distanceToPct()` |
| 4. 무게 → 포화도 변환 | 펌웨어 `weightToPct()` |
| 5. 최종 포화도 공식 | 펌웨어 `loop()`, 웹 `store.js computeFinalPct()` |
| 6. ESP32 → 웹/Firebase 전송 | 펌웨어 `sendToFirebase()`, `docs/02-Firebase설정.md` |
| 7. 웹에서 센서값 받아 마커 변경 | `store.js applySensorData/startFirebaseSync`, `KakaoMap.js` |
| 8. 발표용 구조 정리 | `docs/03-발표대본.md` |

---

## 라이선스/주의
- 시연용으로 Firebase 테스트 모드(공개)와 인증서 검증 생략(`setInsecure`)을
  사용합니다. 실제 서비스에는 부적합하니 대회/수행평가 시연 용도로만 쓰세요.
- 키(`.env`)는 깃에 올리지 마세요. (`.gitignore` 에 이미 제외돼 있습니다.)
