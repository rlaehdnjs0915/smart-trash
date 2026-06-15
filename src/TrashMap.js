import { useState } from "react";
import KakaoMap from "./KakaoMap";
import useStore from "./useStore";
import { statusOf, requestCollection } from "./store";

/**
 * 사용자용 화면 ( / )
 * - 지도에 쓰레기통 마커 표시(상태에 따라 색이 다름)
 * - 마커를 누르면 이름/현재 용량/남은 용량/상태/수거요청 버튼 표시
 */
export default function TrashMap() {
  const { bins } = useStore();
  const [selectedId, setSelectedId] = useState(null);
  const selected = bins.find((b) => b.id === selectedId);

  return (
    <div className="layout">
      <KakaoMap
        bins={bins}
        onSelectBin={setSelectedId}
        selectedId={selectedId}
      />

      <aside className="panel">
        <h2 style={{ marginTop: 0 }}>쓰레기통 정보</h2>

        {!selected && (
          <p className="muted">
            지도에서 쓰레기통 마커를 누르면 상세 정보가 표시됩니다.
          </p>
        )}

        {selected && <BinDetail bin={selected} />}

        <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #eee" }} />
        <h3 style={{ fontSize: 15 }}>전체 목록</h3>
        {bins.map((b) => {
          const st = statusOf(b);
          return (
            <div
              key={b.id}
              className="row"
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedId(b.id)}
            >
              <span>{b.name}</span>
              <span className="badge" style={{ background: st.color }}>
                {b.broken ? "고장" : b.finalPct + "%"}
              </span>
            </div>
          );
        })}
      </aside>
    </div>
  );
}

function BinDetail({ bin }) {
  const st = statusOf(bin);
  const remain = 100 - bin.finalPct;

  return (
    <div className="card">
      <h3>{bin.name}</h3>
      <div className="row">
        <span>상태</span>
        <span className="badge" style={{ background: st.color }}>
          {st.label}
        </span>
      </div>

      {bin.broken ? (
        <p className="muted" style={{ marginTop: 12 }}>
          ⚠️ 이 쓰레기통은 고장 신고 상태입니다. 수거 요청을 할 수 없습니다.
        </p>
      ) : (
        <>
          <div className="row">
            <span>현재 용량</span>
            <strong>{bin.finalPct}%</strong>
          </div>
          <div className="bar">
            <span style={{ width: `${bin.finalPct}%`, background: st.color }} />
          </div>
          <div className="row">
            <span>남은 용량</span>
            <strong>{remain}%</strong>
          </div>

          <div className="row muted">
            <span>· 초음파(부피) 기준</span>
            <span>{Math.round(bin.ultrasonicPct)}%</span>
          </div>
          <div className="row muted">
            <span>· 무게 기준</span>
            <span>{Math.round(bin.weightPct)}%</span>
          </div>

          <button
            className="btn"
            disabled={bin.collectRequested}
            onClick={() => requestCollection(bin.id)}
          >
            {bin.collectRequested ? "수거 요청 완료 ✓" : "수거 요청하기"}
          </button>
        </>
      )}
    </div>
  );
}
