import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "./store";

/**
 * 공유 저장소(store.js)를 React 컴포넌트에서 구독하는 훅.
 * store 가 바뀔 때마다 컴포넌트가 자동으로 다시 그려진다.
 */
export default function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
