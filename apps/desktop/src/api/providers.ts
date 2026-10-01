import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object } from "./wire";

export type ProviderStatus = {
  provider: "openai";
  revision: number;
  key_present: boolean;
  connection_tests_allowed: boolean;
  record_access: "none";
};

export function providerStatus(value: unknown): ProviderStatus {
  if (
    !object(value) ||
    !keys(value, [
      "provider",
      "revision",
      "key_present",
      "connection_tests_allowed",
      "record_access",
    ]) ||
    value.provider !== "openai" ||
    !integer(value.revision) ||
    typeof value.key_present !== "boolean" ||
    typeof value.connection_tests_allowed !== "boolean" ||
    value.record_access !== "none"
  )
    throw new Error("Invalid provider status");
  return value as ProviderStatus;
}

export async function getProvider(): Promise<ProviderStatus> {
  return providerStatus(
    await invoke<unknown>("provider_settings", { payload: { action: "status" } }),
  );
}

export async function updateProvider(
  status: ProviderStatus,
  action: "enter_key" | "remove_key" | "permission",
  allowed?: boolean,
): Promise<ProviderStatus> {
  const payload =
    action === "permission"
      ? { action, revision: status.revision, allowed }
      : { action, revision: status.revision };
  return providerStatus(await invoke<unknown>("provider_settings", { payload }));
}

export async function testProvider(status: ProviderStatus): Promise<void> {
  const result = await invoke<unknown>("provider_settings", {
    payload: { action: "test", revision: status.revision },
  });
  if (
    !object(result) ||
    !keys(result, ["connected", "revision"]) ||
    result.connected !== true ||
    result.revision !== status.revision
  ) {
    throw new Error("Invalid connection result");
  }
}

const publicErrors = new Set([
  "Provider settings changed. Refresh before continuing.",
  "Oracle's provider settings are unreadable. No connection was attempted.",
  "Windows could not access Oracle's provider credentials.",
  "Windows could not open the API key dialog.",
  "The API key format was not accepted. No key was saved.",
  "Provider settings are busy or unavailable. Close the key dialog, then refresh.",
  "Save a key and explicitly allow connection tests first.",
  "The connection check failed. Check your network and provider status, then retry explicitly.",
  "OpenAI did not accept this API key.",
  "This API key cannot list models. Check its provider permissions.",
  "The provider limited this request. Wait before trying again.",
  "The provider returned an unexpected response.",
  "Unlock Oracle to continue.",
]);
export function providerError(error: unknown): string {
  return typeof error === "string" && publicErrors.has(error)
    ? error
    : "Oracle could not confirm this provider operation. Refresh settings before continuing.";
}
