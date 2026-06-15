import { useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import TrashMap from "./TrashMap";
import Admin from "./Admin";
import {
  startSimulation,
  stopSimulation,
  startFirebaseSync,
  isFirebaseEnabled,
} from "./store";

export default function App() {
  // 앱이 켜지는 동안 시뮬레이션 + (설정 시) Firebase 동기화를 돌린다.
  useEffect(() => {
    startSimulation();
    startFirebaseSync();
    return () => stopSimulation();
  }, []);

  return (
    <div>
      <nav className="topbar">
        <h1>♻️ 스마트 쓰레기 수거 관리 시스템</h1>
        <NavLink to="/" end>
          사용자
        </NavLink>
        <NavLink to="/admin">관리자</NavLink>
        <span className="muted" style={{ color: "#c8e6c9" }}>
          {isFirebaseEnabled() ? "ESP32 연동" : "시뮬레이션"}
        </span>
      </nav>

      <Routes>
        <Route path="/" element={<TrashMap />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  );
}
