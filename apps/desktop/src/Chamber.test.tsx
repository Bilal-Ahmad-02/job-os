import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Chamber from "./Chamber";

vi.mock("./App", () => ({
  default: ({
    active,
    onChamber,
    onLock,
  }: {
    active: boolean;
    onChamber: () => void;
    onLock?: () => void;
  }) => (
    <div data-testid="console" data-active={active}>
      <label>
        Draft
        <input />
      </label>
      <button type="button" onClick={onChamber}>
        Chamber
      </button>
      <button type="button" onClick={onLock}>
        Lock Oracle
      </button>
    </div>
  ),
}));

describe("Oracle chamber", () => {
  it("opens on the hub without mounting the console and labels the core as dormant", () => {
    render(<Chamber />);
    expect(screen.getByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    const core = screen.getByRole("region", { name: "ORACLE / MASTER" });
    expect(within(core).getByText("DORMANT")).toBeVisible();
    expect(within(core).getByText(/No assistant yet/)).toBeVisible();
    expect(screen.queryByTestId("console")).not.toBeInTheDocument();
  });
  it("offers one real module and only unnamed, non-interactive empty slots", () => {
    render(<Chamber />);
    const slots = within(screen.getByRole("list", { name: "Agent slots" })).getAllByRole(
      "listitem",
    );
    expect(slots).toHaveLength(4);
    const [jobs, ...empty] = slots;
    expect(jobs).toContainElement(screen.getByRole("button", { name: "Open JOB.OS console" }));
    for (const slot of empty) {
      expect(slot).toHaveTextContent(/UNASSIGNED.*Empty slot/);
      expect(within(slot).queryByRole("button")).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
  it("opens the console from the JOB.OS node and returns with its state and focus intact", () => {
    render(<Chamber onLock={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Open JOB.OS console" }));
    expect(screen.getByTestId("console")).toBeVisible();
    expect(screen.getByTestId("console")).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("heading", { name: "THE CHAMBER", hidden: true })).not.toBeVisible();
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Chamber" }));
    expect(screen.getByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(screen.getByTestId("console")).not.toBeVisible();
    expect(screen.getByTestId("console")).toHaveAttribute("data-active", "false");
    const node = screen.getByRole("button", { name: "Open JOB.OS console" });
    expect(node).toHaveFocus();
    fireEvent.click(node);
    expect(screen.getByLabelText("Draft")).toHaveValue("unsaved");
  });
  it("locks from the hub and from the console", () => {
    const onLock = vi.fn();
    render(<Chamber onLock={onLock} />);
    fireEvent.click(screen.getByRole("button", { name: "Lock Oracle" }));
    fireEvent.click(screen.getByRole("button", { name: "Open JOB.OS console" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock Oracle" }));
    expect(onLock).toHaveBeenCalledTimes(2);
  });
});
