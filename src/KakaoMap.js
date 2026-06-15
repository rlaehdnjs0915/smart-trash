import { useEffect, useRef } from "react";
import useKakaoLoader from "./useKakaoLoader";
import { statusOf } from "./store";

/**
 * 사용자/관리자 화면이 공통으로 쓰는 Kakao 지도.
 *
 * props
 *  - bins: 쓰레기통 배열
 *  - cleaner: 환경미화원 좌표 { lat, lng } (관리자에서만 전달)
 *  - onSelectBin: 마커 클릭 시 호출 (binId)
 *  - selectedId: 선택된 쓰레기통 id
 */
export default function KakaoMap({ bins, cleaner, onSelectBin, selectedId }) {
  const status = useKakaoLoader();
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const overlays = useRef([]); // 쓰레기통 커스텀 오버레이
  const cleanerOverlay = useRef(null);

  // 지도 최초 생성
  useEffect(() => {
    if (status !== "ready" || mapObj.current) return;
    const { kakao } = window;
    const center = bins[0]
      ? new kakao.maps.LatLng(bins[0].lat, bins[0].lng)
      : new kakao.maps.LatLng(37.5665, 126.978);
    mapObj.current = new kakao.maps.Map(mapRef.current, {
      center,
      level: 4,
    });
  }, [status, bins]);

  // 쓰레기통 마커 갱신
  useEffect(() => {
    if (status !== "ready" || !mapObj.current) return;
    const { kakao } = window;

    // 기존 오버레이 제거
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];

    bins.forEach((bin) => {
      const st = statusOf(bin);
      const selected = bin.id === selectedId;

      const el = document.createElement("div");
      el.className = "pin";
      el.innerHTML = `
        <div class="pin-dot" style="background:${st.color};${
        selected ? "outline:3px solid #1565c0;outline-offset:2px;" : ""
      }"></div>
        <div class="pin-label">${bin.name} ${
        bin.broken ? "⚠️" : bin.finalPct + "%"
      }</div>
      `;
      el.addEventListener("click", () => onSelectBin && onSelectBin(bin.id));

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(bin.lat, bin.lng),
        content: el,
        yAnchor: 1,
        zIndex: selected ? 10 : 1,
      });
      overlay.setMap(mapObj.current);
      overlays.current.push(overlay);
    });
  }, [status, bins, selectedId, onSelectBin]);

  // 환경미화원 마커 갱신
  useEffect(() => {
    if (status !== "ready" || !mapObj.current || !cleaner) return;
    const { kakao } = window;
    const pos = new kakao.maps.LatLng(cleaner.lat, cleaner.lng);

    if (!cleanerOverlay.current) {
      const el = document.createElement("div");
      el.className = "cleaner-pin";
      el.title = "환경미화원";
      el.textContent = "🚛";
      cleanerOverlay.current = new kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 5,
      });
      cleanerOverlay.current.setMap(mapObj.current);
    } else {
      cleanerOverlay.current.setPosition(pos);
    }
  }, [status, cleaner]);

  if (status === "no-key") {
    return (
      <div className="map map-fallback">
        <div>
          <h3>🗺️ Kakao 지도 키가 없습니다</h3>
          <p className="muted">
            <code>.env</code> 파일에{" "}
            <code>REACT_APP_KAKAO_KEY</code> 를 넣고 다시 실행하세요.
            <br />
            키가 없어도 오른쪽 목록/패널 기능은 정상 동작합니다.
          </p>
        </div>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="map map-fallback">
        지도 로딩 실패 — 키와 도메인 등록을 확인하세요.
      </div>
    );
  }

  return <div className="map" ref={mapRef} />;
}
