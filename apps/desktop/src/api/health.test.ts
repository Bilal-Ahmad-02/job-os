import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";
import { checkHealth } from "./health";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("native health request", () => {
  it("calls the guarded native command without a URL or credentials", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await checkHealth(new AbortController().signal);
    expect(invoke).toHaveBeenCalledWith("check_health");
  });
  it("propagates locked and unavailable failures", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Unlock Oracle to continue."));
    await expect(checkHealth(new AbortController().signal)).rejects.toThrow("Unlock Oracle");
  });
  it("discards replies after cancellation", async () => {
    const controller = new AbortController();
    vi.mocked(invoke).mockImplementation(async () => {
      controller.abort();
    });
    await expect(checkHealth(controller.signal)).rejects.toThrow();
  });
});
