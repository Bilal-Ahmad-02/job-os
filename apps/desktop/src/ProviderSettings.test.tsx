import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getProvider, type ProviderStatus, testProvider, updateProvider } from "./api/providers";
import ProviderSettings from "./ProviderSettings";

vi.mock("./api/providers", async (original) => ({
  ...(await original<typeof import("./api/providers")>()),
  getProvider: vi.fn(),
  updateProvider: vi.fn(),
  testProvider: vi.fn(),
}));
const empty: ProviderStatus = {
  provider: "openai",
  revision: 0,
  key_present: false,
  connection_tests_allowed: false,
  record_access: "none",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProvider).mockResolvedValue(empty);
});

it("loads only metadata without a key input or automatic provider request", async () => {
  render(<ProviderSettings />);
  expect(await screen.findByText("No API key saved")).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  expect(testProvider).not.toHaveBeenCalled();
  expect(updateProvider).not.toHaveBeenCalled();
});

it("opens native key entry without passing a secret and requires separate permission and testing", async () => {
  const saved = { ...empty, revision: 1, key_present: true };
  const allowed = { ...saved, revision: 2, connection_tests_allowed: true };
  vi.mocked(updateProvider).mockResolvedValueOnce(saved).mockResolvedValueOnce(allowed);
  vi.mocked(testProvider).mockResolvedValue(undefined);
  render(<ProviderSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Add API key in Windows" }));
  expect(await screen.findByText("Saved in Windows Credential Manager")).toBeVisible();
  expect(updateProvider).toHaveBeenNthCalledWith(1, empty, "enter_key", undefined);
  expect(testProvider).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled(),
  );
  expect(updateProvider).toHaveBeenNthCalledWith(2, saved, "permission", true);
  expect(testProvider).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  expect(await screen.findByText(/Connection verified for this saved configuration/)).toBeVisible();
  expect(testProvider).toHaveBeenCalledExactlyOnceWith(allowed);
});

it("clears permission and the visible test result after removing a key", async () => {
  const allowed = { ...empty, revision: 2, key_present: true, connection_tests_allowed: true };
  vi.mocked(getProvider).mockResolvedValue(allowed);
  vi.mocked(testProvider).mockResolvedValue(undefined);
  vi.mocked(updateProvider).mockResolvedValue({ ...empty, revision: 3 });
  render(<ProviderSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
  await screen.findByText(/Connection verified for this saved configuration/);
  fireEvent.click(screen.getByRole("button", { name: "Remove saved key" }));
  expect(await screen.findByText("No API key saved")).toBeVisible();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  expect(
    screen.queryByText(/Connection verified for this saved configuration/),
  ).not.toBeInTheDocument();
});

it("redacts unknown failures and requires successful refresh before further mutations", async () => {
  vi.mocked(updateProvider).mockRejectedValueOnce("private secret from unexpected transport");
  render(<ProviderSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Add API key in Windows" }));
  expect(await screen.findByRole("alert")).not.toHaveTextContent("private secret");
  expect(screen.getByRole("button", { name: "Add API key in Windows" })).toBeDisabled();
  vi.mocked(getProvider).mockRejectedValueOnce(new Error("private"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh settings" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Refresh settings" })).toBeEnabled(),
  );
  expect(screen.getByRole("button", { name: "Add API key in Windows" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh settings" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add API key in Windows" })).toBeEnabled(),
  );
  expect(updateProvider).toHaveBeenCalledTimes(1);
});

it("does not retry or start a check when native key entry finishes after unmount", async () => {
  let finish!: (status: ProviderStatus) => void;
  vi.mocked(updateProvider).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<ProviderSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Add API key in Windows" }));
  view.unmount();
  await act(async () => finish({ ...empty, revision: 1, key_present: true }));
  expect(updateProvider).toHaveBeenCalledTimes(1);
  expect(testProvider).not.toHaveBeenCalled();
});
