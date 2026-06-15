import { useState } from "react";
import KakaoMap from "./KakaoMap";
import useStore from "./useStore";
import { statusOf, completeCollection, toggleBroken } from "./store";

/**
 * 관리자용 화면 ( /admin )
 * - 지도에 쓰레기통 마커 + 환경미화원(🚛) 위치
 * - 수거 요청 목록
 * - 수거 완료 버튼(누르면 해당 통의 포화도가 0으로 초기화)
 */
export default function Admin() {
  const { bins, cleaner } = useStore();
  const [selectedId, setSelectedId] = useState(null);

  // 수거가 필요한 통: 사용자가 요청했거나, 포화도가 높은(70%+) 통
  const requests = bins.filter(
    (b) => b.collectRequested || (!b.broken && b.finalPct >= 70)
  );
  const brokenBins = bins.filter((b) => b.broken);

  return (
    <div className="layout">
      <KakaoMap
        bins={bins}
        cleaner={cleaner}
        onSelectBin={setSelectedId}
        selectedId={selectedId}
      />

      <aside className="panel">
        <h2 style={{ marginTop: 0 }}>관리자 대시보드</h2>

        <h3 style={{ fontSize: 15 }}>🧹 수거 요청 / 권장 ({requests.length})</h3>
        {requests.length === 0 && (
          <p className="muted">현재 수거가 필요한 쓰레기통이 없습니다.</p>
        )}
        {requests.map((b) => {
          const st = statusOf(b);
          return (
            <div key={b.id} className="card">
              <div className="row">
                <strong onClick={() => setSelectedId(b.id)} style={{ cursor: "pointer" }}>
                  {b.name}
                </strong>
                <span className="badge" style={{ background: st.color }}>
                  {st.label} {b.finalPct}%
                </span>
              </div>
              <div className="row muted">
                <span>
                  {b.collectRequested ? "사용자 요청 ✓" : "자동 권장(포화도 높음)"}
                </span>
                <span>부피 {Math.round(b.ultrasonicPct)}% / 무게 {Math.round(b.weightPct)}%</span>
              </div>
              <button className="btn" onClick={() => completeCollection(b.id)}>
                수거 완료 처리
              </button>
            </div>
          );
        })}

        {brokenBins.length > 0 && (
          <>
            <h3 style={{ fontSize: 15, marginTop: 20 }}>
              ⚠️ 고장 신고 ({brokenBins.length})
            </h3>
            {brokenBins.map((b) => (
              <div key={b.id} className="card">
                <div className="row">
                  <strong>{b.name}</strong>
                  <span className="badge" style={{ background: "#9e9e9e" }}>
                    고장
                  </span>
                </div>
                <button
                  className="btn secondary"
                  onClick={() => completeCollection(b.id)}
                >
                  점검 완료 처리
                </button>
              </div>
            ))}
          </>
        )}

        <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #eee" }} />
        <h3 style={{ fontSize: 15 }}>전체 쓰레기통</h3>
        {bins.map((b) => {
          const st = statusOf(b);
          return (
            <div key={b.id} className="row">
              <span
                onClick={() => setSelectedId(b.id)}
                style={{ cursor: "pointer" }}
              >
                {b.name}
              </span>
              <span>
                <span className="badge" style={{ background: st.color }}>
                  {b.broken ? "고장" : b.finalPct + "%"}
                </span>
                {/* 시연용: 고장 상태를 손으로 토글 (실제로는 ESP32 버튼이 보냄) */}
                <button
                  className="btn danger"
                  style={{ width: "auto", padding: "2px 8px", marginLeft: 6, fontSize: 12 }}
                  onClick={() => toggleBroken(b.id)}
                  title="시연용 고장 토글"
                >
                  고장↔정상
                </button>
              </span>
            </div>
          );
        })}
      </aside>
    </div>
  );
}
