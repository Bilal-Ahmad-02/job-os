import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccessGate from "./AccessGate";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./App", () => ({
  default: ({ onLock }: { onLock: () => void }) => (
    <div>
      Private workspace
      <button type="button" onClick={onLock}>
        Lock Oracle
      </button>
    </div>
  ),
}));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
});

describe("Oracle access gate", () => {
  it("does not render the workspace until the native unlock succeeds", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("locked").mockResolvedValueOnce(undefined);
    render(<AccessGate />);
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Password"), {
      target: { value: "test-only passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock Oracle" }));
    expect(await screen.findByText("Private workspace")).toBeVisible();
    expect(invoke).toHaveBeenCalledWith("unlock", { password: "test-only passphrase" });
  });

  it("clears the password on failure and only displays approved error messages", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce("locked")
      .mockRejectedValueOnce("sensitive internal details");
    render(<AccessGate />);
    const field = await screen.findByLabelText("Password");
    fireEvent.change(field, { target: { value: "test-only passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock Oracle" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Oracle could not unlock");
    expect(field).toHaveValue("");
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("sensitive internal details")).not.toBeInTheDocument();
  });

  it("requires matching passwords on first launch", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("setup");
    render(<AccessGate />);
    fireEvent.change(await screen.findByLabelText("Create password"), {
      target: { value: "test-only passphrase" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create password & open Oracle" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(invoke).toHaveBeenCalledTimes(1);
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "test-only passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create password & open Oracle" }));
    expect(await screen.findByText("Private workspace")).toBeVisible();
    expect(invoke).toHaveBeenCalledWith("create_password", { password: "test-only passphrase" });
  });

  it.each(["unexpected", null])("fails closed for an invalid native status %s", async (status) => {
    vi.mocked(invoke).mockResolvedValueOnce(status);
    render(<AccessGate />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access remains locked");
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Create password")).not.toBeInTheDocument();
  });

  it("fails closed when password storage cannot be read", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("file inaccessible");
    render(<AccessGate />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access remains locked");
  });

  it("hides the workspace immediately while the native lock is pending", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce("unlocked")
      .mockImplementationOnce(() => new Promise(() => {}));
    render(<AccessGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Lock Oracle" }));
    await waitFor(() => expect(screen.queryByText("Private workspace")).not.toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("lock");
  });
});
