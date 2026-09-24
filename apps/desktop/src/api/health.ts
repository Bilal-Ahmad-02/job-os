import { invoke } from "@tauri-apps/api/core";

/** Native code enforces the lock, fixed destination, timeout, and response-size limit. */
export async function checkHealth(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await invoke("check_health");
  // IPC cannot cancel the native request; discard stale replies (native timeout is 3s).
  signal.throwIfAborted();
}
