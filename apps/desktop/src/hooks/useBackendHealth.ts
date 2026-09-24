import { useCallback, useEffect, useRef, useState } from "react";
import { checkHealth } from "../api/health";

export type ConnectionState = "checking" | "connected" | "unavailable";

export function useBackendHealth() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState("checking");
    try {
      await checkHealth(controller.signal);
      if (!controller.signal.aborted) setState("connected");
    } catch {
      if (!controller.signal.aborted) setState("unavailable");
    } finally {
      if (!controller.signal.aborted) setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Refresh after returning to the app; no background polling or stale replies.
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      activeRequest.current?.abort();
    };
  }, [refresh]);

  return { state, lastChecked, refresh };
}
