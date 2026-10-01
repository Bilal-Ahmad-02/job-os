import { invoke } from "@tauri-apps/api/core";
import { expect, it, vi } from "vitest";
import { providerError, providerStatus, testProvider, updateProvider } from "./providers";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const status = {
  provider: "openai" as const,
  revision: 1,
  key_present: true,
  connection_tests_allowed: false,
  record_access: "none" as const,
};

it("rejects secret-bearing responses, unexpected providers and record permissions", () => {
  expect(providerStatus(status)).toEqual(status);
  for (const change of [
    { key: "private" },
    { provider: "other" },
    { revision: -1 },
    { record_access: "all" },
    { key_present: "yes" },
  ]) {
    expect(() => providerStatus({ ...status, ...change })).toThrow();
  }
  expect(providerError("private secret")).not.toContain("secret");
});
it("sends only operation and saved revision for native key entry", async () => {
  vi.mocked(invoke).mockResolvedValueOnce(status);
  await updateProvider(status, "enter_key");
  expect(invoke).toHaveBeenLastCalledWith("provider_settings", {
    payload: { action: "enter_key", revision: 1 },
  });
});
it("rejects a connection result for a different settings revision", async () => {
  vi.mocked(invoke).mockResolvedValueOnce({ connected: true, revision: 2 });
  await expect(testProvider(status)).rejects.toThrow();
});
