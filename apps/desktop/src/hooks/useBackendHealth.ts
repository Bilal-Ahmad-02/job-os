import { useCallback, useEffect, useRef, useState } from "react";
import { checkHealth } from "../api/health";

export type ConnectionState = "idle" | "checking" | "connected" | "unavailable";

export function useBackendHealth() {
  const [state, setState] = useState<ConnectionState>("idle");
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
    // This optional developer diagnostic is not the record runtime's health signal.
    // Only an explicit click contacts the HTTP service; focus never starts a check.
    return () => {
      activeRequest.current?.abort();
    };
  }, []);

  return { state, lastChecked, refresh };
}
