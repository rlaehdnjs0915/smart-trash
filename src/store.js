/**
 * store.js
 * ------------------------------------------------------------------
 * 사용자 웹(TrashMap)과 관리자 웹(Admin)이 함께 쓰는 공유 저장소.
 *
 * - 쓰레기통 목록과 상태를 한 곳에서 관리한다.
 * - useSyncExternalStore 로 어떤 컴포넌트든 구독해서 자동으로 다시 그린다.
 * - 시간이 지나면 포화도가 올라가는 "시뮬레이션" 이 들어있다.
 * - .env 에 Firebase 주소가 있으면 ESP32 실측값을 받아와 시뮬레이션 대신 사용한다.
 *
 * ▶ 포화도(가득 찬 정도) 계산 = 초음파(부피) 60% + 무게 40%
 *    finalPct = ultrasonicPct * 0.6 + weightPct * 0.4
 * ------------------------------------------------------------------
 */

// ----- 1. 상태 기준 -------------------------------------------------
export const WEIGHT_RATIO = 0.4; // 무게 가중치
export const VOLUME_RATIO = 0.6; // 부피(초음파) 가중치

// 최종 포화도(%) → 상태 라벨/색상으로 변환
export function statusOf(bin) {
  if (bin.broken) {
    return { key: "broken", label: "고장", color: "#9e9e9e" };
  }
  const p = bin.finalPct;
  if (p >= 85) return { key: "full", label: "가득 참", color: "#c62828" };
  if (p >= 70) return { key: "high", label: "수거 권장", color: "#ef6c00" };
  if (p >= 40) return { key: "mid", label: "보통", color: "#f9a825" };
  return { key: "low", label: "여유", color: "#2e7d32" };
}

// 초음파/무게 포화도를 합쳐 최종 포화도를 계산
export function computeFinalPct(ultrasonicPct, weightPct) {
  const v = clamp(ultrasonicPct);
  const w = clamp(weightPct);
  return Math.round(v * VOLUME_RATIO + w * WEIGHT_RATIO);
}

function clamp(n) {
  if (Number.isNaN(n) || n == null) return 0;
  return Math.max(0, Math.min(100, n));
}

// ----- 2. 초기 데이터 (시연용 쓰레기통 4개) -------------------------
// lat/lng 는 시연 위치. 본인 학교/지역 좌표로 바꿔도 된다.
function makeBin(id, name, lat, lng, ultra, weight) {
  return {
    id,
    name,
    lat,
    lng,
    ultrasonicPct: ultra, // 부피 기준 포화도(%)
    weightPct: weight, // 무게 기준 포화도(%)
    finalPct: computeFinalPct(ultra, weight),
    broken: false,
    collectRequested: false,
    source: "sim", // "sim" = 시뮬레이션, "esp32" = 실측값
    fillRate: 0.2 + Math.random() * 0.4, // 시뮬레이션에서 차오르는 속도
    updatedAt: Date.now(),
  };
}

let state = {
  // 환경미화원(수거 차량) 위치
  cleaner: { lat: 37.5662, lng: 126.9779 },
  bins: [
    makeBin("bin-1", "정문 앞 쓰레기통", 37.5665, 126.978, 30, 20),
    makeBin("bin-2", "운동장 옆 쓰레기통", 37.5675, 126.9795, 72, 55),
    makeBin("bin-3", "급식실 앞 쓰레기통", 37.5655, 126.9765, 88, 80),
    makeBin("bin-4", "후문 쓰레기통", 37.5648, 126.9788, 10, 5),
  ],
};

// ----- 3. 구독(subscribe) 구조 ------------------------------------
const listeners = new Set();

function emit() {
  // 스냅샷을 새 객체로 만들어 React 가 변화를 감지하게 한다.
  state = { ...state, bins: [...state.bins] };
  listeners.forEach((fn) => fn());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

function updateBin(id, patch) {
  state.bins = state.bins.map((b) =>
    b.id === id ? recalc({ ...b, ...patch, updatedAt: Date.now() }) : b
  );
  emit();
}

// 포화도가 바뀌면 finalPct 를 다시 계산
function recalc(bin) {
  return { ...bin, finalPct: computeFinalPct(bin.ultrasonicPct, bin.weightPct) };
}

// ----- 4. 사용자/관리자 액션 --------------------------------------

// 사용자: 수거 요청
export function requestCollection(id) {
  const bin = state.bins.find((b) => b.id === id);
  if (!bin || bin.broken) return;
  updateBin(id, { collectRequested: true });
}

// 관리자: 수거 완료 → 포화도 초기화
export function completeCollection(id) {
  updateBin(id, {
    collectRequested: false,
    ultrasonicPct: 0,
    weightPct: 0,
    broken: false,
  });
}

// (시연용) 고장 상태 토글 — 실제로는 ESP32 택트 스위치가 보냄
export function toggleBroken(id) {
  const bin = state.bins.find((b) => b.id === id);
  if (!bin) return;
  updateBin(id, { broken: !bin.broken });
}

/**
 * ESP32(또는 Firebase)에서 들어온 실측 센서값을 반영.
 * payload = { ultrasonicPct, weightPct, broken }
 */
export function applySensorData(id, payload) {
  const bin = state.bins.find((b) => b.id === id);
  if (!bin) return;
  updateBin(id, {
    ultrasonicPct: clamp(payload.ultrasonicPct ?? bin.ultrasonicPct),
    weightPct: clamp(payload.weightPct ?? bin.weightPct),
    broken: payload.broken ?? bin.broken,
    source: "esp32",
  });
}

// ----- 5. 시뮬레이션 (시간이 지나면 포화도 증가) -------------------
let simTimer = null;

export function startSimulation() {
  if (simTimer) return;
  simTimer = setInterval(() => {
    let changed = false;
    state.bins = state.bins.map((b) => {
      // 실측(esp32) 값을 쓰는 통은 시뮬레이션으로 건드리지 않는다.
      if (b.source === "esp32" || b.broken || b.collectRequested) return b;
      if (b.ultrasonicPct >= 100 && b.weightPct >= 100) return b;
      changed = true;
      const next = {
        ...b,
        ultrasonicPct: clamp(b.ultrasonicPct + b.fillRate),
        weightPct: clamp(b.weightPct + b.fillRate * 0.7),
      };
      return recalc(next);
    });

    // 환경미화원이 살짝 움직이는 것처럼 보이게(시연용)
    state.cleaner = {
      lat: state.cleaner.lat + (Math.random() - 0.5) * 0.0002,
      lng: state.cleaner.lng + (Math.random() - 0.5) * 0.0002,
    };

    if (changed) emit();
    else emit(); // 미화원 위치 갱신을 위해 항상 emit
  }, 2000);
}

export function stopSimulation() {
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
}

// ----- 6. Firebase 연동 (선택) ------------------------------------
// .env 에 REACT_APP_FIREBASE_DB_URL 이 있으면 1.5초마다 ESP32 값을 읽어온다.
// 별도 SDK 없이 REST API(폴링) 로 구현해 의존성을 최소화했다.
const DB_URL = process.env.REACT_APP_FIREBASE_DB_URL;
let fbTimer = null;

export function startFirebaseSync() {
  if (!DB_URL || fbTimer) return false;
  fbTimer = setInterval(async () => {
    try {
      const res = await fetch(`${DB_URL}/bins.json`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data) return;
      // data 예: { "bin-1": { ultrasonicPct: 80, weightPct: 50, broken: false } }
      Object.entries(data).forEach(([id, payload]) =>
        applySensorData(id, payload)
      );
    } catch (e) {
      // 네트워크 오류는 조용히 무시(시뮬레이션은 계속 동작)
    }
  }, 1500);
  return true;
}

export function isFirebaseEnabled() {
  return Boolean(DB_URL);
}
