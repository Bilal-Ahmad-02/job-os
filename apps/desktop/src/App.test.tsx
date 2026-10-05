import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { checkHealth } from "./api/health";

vi.mock("./api/health", () => ({ checkHealth: vi.fn() }));

function renderConsole(check = true) {
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "System status" }));
  if (check) fireEvent.click(screen.getByRole("button", { name: "Run diagnostic" }));
  return view;
}

describe("Oracle console header", () => {
  it("offers a return to the chamber only when the hub provides one", () => {
    const onChamber = vi.fn();
    const view = render(<App onChamber={onChamber} onLock={() => {}} />);
    const back = screen.getByRole("button", { name: "Return to the chamber" });
    expect(back).toHaveTextContent("Chamber");
    expect(back).toHaveFocus();
    expect(screen.getByRole("button", { name: "Lock Oracle" })).toBeVisible();
    fireEvent.click(back);
    expect(onChamber).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<App />);
    expect(screen.queryByRole("button", { name: "Return to the chamber" })).not.toBeInTheDocument();
  });
});

describe("Oracle connection panel", () => {
  it("does not contact the optional diagnostic on startup, focus or opening the panel", () => {
    vi.mocked(checkHealth).mockClear();
    renderConsole(false);
    fireEvent.focus(window);
    expect(checkHealth).not.toHaveBeenCalled();
    expect(screen.getByText("Not requested")).toBeVisible();
    expect(screen.getByRole("button", { name: "System status" })).toHaveTextContent("SYSTEM");
  });
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
    expect(await screen.findByText("Diagnostic responding")).toBeVisible();
    expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
  });

  it("shows an actionable unavailable state and recovers on retry", async () => {
    vi.mocked(checkHealth)
      .mockRejectedValueOnce(new Error("private error details"))
      .mockResolvedValueOnce(undefined);
    renderConsole();
    expect(await screen.findByText("Diagnostic unavailable")).toBeVisible();
    expect(screen.getByText(/not required for normal Oracle use/)).toBeVisible();
    expect(screen.queryByText("private error details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Diagnostic responding")).toBeVisible();
  });

  it("disables retry while a request is pending and cancels on unmount", () => {
    vi.mocked(checkHealth).mockImplementation(() => new Promise(() => {}));
    const view = renderConsole();
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
    const signal = vi.mocked(checkHealth).mock.calls.at(-1)?.[0];
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("does not restart a pending diagnostic on focus", async () => {
    let finishOld: (() => void) | undefined;
    vi.mocked(checkHealth).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOld = resolve;
        }),
    );
    vi.mocked(checkHealth).mockClear();
    renderConsole();
    fireEvent.focus(window);
    expect(checkHealth).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishOld?.();
    });
    await waitFor(() => expect(screen.getByText("Diagnostic responding")).toBeVisible());
  });
});
