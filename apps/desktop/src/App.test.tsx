import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { checkHealth } from "./api/health";

vi.mock("./api/health", () => ({ checkHealth: vi.fn() }));

function renderConsole() {
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "System status" }));
  return view;
}

describe("Oracle connection panel", () => {
  it("returns focus to the system toggle after closing the drawer", () => {
    vi.mocked(checkHealth).mockResolvedValue(undefined);
    renderConsole();
    fireEvent.click(screen.getByRole("button", { name: "Close system" }));
    expect(screen.getByRole("button", { name: "System status" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "System status" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
  it("shows connected after a successful health check", async () => {
    vi.mocked(checkHealth).mockResolvedValue(undefined);
    renderConsole();
    expect(await screen.findByText("Connected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
  });

  it("shows an actionable unavailable state and recovers on retry", async () => {
    vi.mocked(checkHealth)
      .mockRejectedValueOnce(new Error("private error details"))
      .mockResolvedValueOnce(undefined);
    renderConsole();
    expect(await screen.findByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("private error details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Connected")).toBeVisible();
  });

  it("disables retry while a request is pending and cancels on unmount", () => {
    vi.mocked(checkHealth).mockImplementation(() => new Promise(() => {}));
    const view = renderConsole();
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
    const signal = vi.mocked(checkHealth).mock.calls.at(-1)?.[0];
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("ignores stale results after focus starts a newer check", async () => {
    let finishOld: (() => void) | undefined;
    vi.mocked(checkHealth)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error("Backend stopped"));
    renderConsole();
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByText("Unavailable")).toBeVisible());
    await act(async () => {
      finishOld?.();
    });
    expect(screen.getByText("Unavailable")).toBeVisible();
  });
});
