import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccessGate from "./AccessGate";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./App", () => ({
  default: ({ onLock, onChamber }: { onLock: () => void; onChamber: () => void }) => (
    <div>
      Private workspace
      <button type="button" onClick={onChamber}>
        Chamber
      </button>
      <button type="button" onClick={onLock}>
        Lock Oracle
      </button>
    </div>
  ),
}));
function native(status: unknown = "locked", configured = true) {
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "auth_status") return status;
    if (command === "rotation_status") return configured;
    return undefined;
  });
}
async function recovery() {
  fireEvent.click(await screen.findByRole("button", { name: "Password recovery" }));
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "test-only passphrase" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Unlock Oracle" }));
}
function turns() {
  const dial = screen.getByRole("slider", { name: "Rotation dial" });
  for (const key of ["ArrowRight", "ArrowLeft", "ArrowRight", "ArrowLeft"]) {
    fireEvent.keyDown(dial, { key });
    fireEvent.keyDown(dial, { key: " " });
  }
}
beforeEach(() => {
  vi.mocked(invoke).mockReset();
  native();
});
describe("Oracle circular access gate", () => {
  it("starts sealed without a password form and only opens after native verification and expansion", async () => {
    render(<AccessGate />);
    await screen.findByRole("button", { name: "Unseal" });
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("THE CHAMBER")).not.toBeInTheDocument();
    turns();
    fireEvent.click(screen.getByRole("button", { name: "Unseal" }));
    expect(await screen.findByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(invoke).toHaveBeenCalledWith("unlock_rotation", { steps: [1, -1, 1, -1] });
    expect(invoke).toHaveBeenCalledWith("shell_mode", { workspace: true });
  });
  it("preserves password recovery and clears its input on failure without leaking errors", async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "auth_status") return "locked";
      if (command === "rotation_status") return true;
      throw "sensitive internal details";
    });
    render(<AccessGate />);
    await recovery();
    expect(await screen.findByRole("alert")).toHaveTextContent("Oracle could not unlock");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.queryByText("THE CHAMBER")).not.toBeInTheDocument();
    expect(screen.queryByText("sensitive internal details")).not.toBeInTheDocument();
  });
  it("uses the existing password for recovery", async () => {
    render(<AccessGate />);
    await recovery();
    expect(await screen.findByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(invoke).toHaveBeenCalledWith("unlock", { password: "test-only passphrase" });
  });
  it("enrolls only after password authentication and a repeated sequence, then requires a real unlock", async () => {
    native("locked", false);
    render(<AccessGate />);
    await recovery();
    fireEvent.click(await screen.findByRole("button", { name: "Set rotation key" }));
    turns();
    fireEvent.click(screen.getByRole("button", { name: "Record sequence" }));
    await screen.findByText("REPEAT YOUR SEQUENCE");
    turns();
    fireEvent.click(screen.getByRole("button", { name: "Save rotation key" }));
    await screen.findByRole("button", { name: "Unseal" });
    expect(invoke).toHaveBeenCalledWith("enroll_rotation", {
      steps: [1, -1, 1, -1],
      confirmation: [1, -1, 1, -1],
    });
    expect(invoke).toHaveBeenCalledWith("lock");
    expect(screen.queryByText("THE CHAMBER")).not.toBeInTheDocument();
  });
  it("permits postponing enrollment without changing the password", async () => {
    native("locked", false);
    render(<AccessGate />);
    await recovery();
    fireEvent.click(await screen.findByRole("button", { name: "Set up later / open workspace" }));
    expect(await screen.findByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(invoke).not.toHaveBeenCalledWith("enroll_rotation", expect.anything());
  });
  it("requires matching recovery passwords on first installation", async () => {
    native("setup", false);
    render(<AccessGate />);
    fireEvent.change(await screen.findByLabelText("Create password"), {
      target: { value: "test-only passphrase" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create recovery password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(invoke).not.toHaveBeenCalledWith("create_password", expect.anything());
  });
  it.each(["unexpected", null])("fails closed for invalid native status %s", async (status) => {
    native(status);
    render(<AccessGate />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access remains locked");
    expect(screen.queryByText("THE CHAMBER")).not.toBeInTheDocument();
  });
  it("does not mount records while native unlock is pending or rejected", async () => {
    let reject: (reason: string) => void = () => {};
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "auth_status") return "locked";
      if (command === "rotation_status") return true;
      if (command === "unlock_rotation")
        return new Promise((_, fail) => {
          reject = fail;
        });
    });
    render(<AccessGate />);
    await screen.findByRole("button", { name: "Unseal" });
    turns();
    fireEvent.click(screen.getByRole("button", { name: "Unseal" }));
    expect(screen.queryByText("THE CHAMBER")).not.toBeInTheDocument();
    reject("Sequence not recognized. Wait a moment and try again.");
    expect(await screen.findByRole("alert")).toHaveTextContent("Sequence not recognized");
    expect(invoke).not.toHaveBeenCalledWith("shell_mode", { workspace: true });
    expect(screen.getByRole("button", { name: "Unseal" })).toBeDisabled();
  });
  it("hides records immediately when locking and returns to a circle", async () => {
    native("unlocked");
    render(<AccessGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Lock Oracle" }));
    await waitFor(() => expect(screen.queryByText("THE CHAMBER")).not.toBeInTheDocument());
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("shell_mode", { workspace: false }));
  });
  it("opens the console only from the chamber, returns to it, and locks from the console", async () => {
    native("unlocked");
    render(<AccessGate />);
    expect(await screen.findByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open JOB.OS console" }));
    expect(screen.getByText("Private workspace")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Chamber" }));
    expect(screen.getByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(screen.getByText("Private workspace")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open JOB.OS console" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock Oracle" }));
    await waitFor(() => expect(screen.queryByText("Private workspace")).not.toBeInTheDocument());
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("shell_mode", { workspace: false }));
  });
});
