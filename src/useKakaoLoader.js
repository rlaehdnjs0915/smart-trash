import { useEffect, useState } from "react";

/**
 * Kakao 지도 SDK를 .env 의 키를 사용해 동적으로 불러오는 훅.
 * 반환값: "loading" | "ready" | "no-key" | "error"
 *
 * 사전 준비:
 *  1) https://developers.kakao.com 에서 앱 생성 → JavaScript 키 복사
 *  2) 플랫폼 → Web → 사이트 도메인에 http://localhost:3000 등록
 *  3) .env 파일에 REACT_APP_KAKAO_KEY=발급받은키
 */
export default function useKakaoLoader() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const key = process.env.REACT_APP_KAKAO_KEY;
    if (!key) {
      setStatus("no-key");
      return;
    }

    // 이미 로드되어 있으면 바로 ready
    if (window.kakao && window.kakao.maps) {
      setStatus("ready");
      return;
    }

    const scriptId = "kakao-map-sdk";
    if (document.getElementById(scriptId)) {
      // 다른 컴포넌트가 이미 추가 중
      const wait = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          clearInterval(wait);
          window.kakao.maps.load(() => setStatus("ready"));
        }
      }, 100);
      return () => clearInterval(wait);
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.onload = () => {
      window.kakao.maps.load(() => setStatus("ready"));
    };
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);
  }, []);

  return status;
}
