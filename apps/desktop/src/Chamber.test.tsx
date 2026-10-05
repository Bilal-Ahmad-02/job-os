import { readFileSync } from "node:fs";
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
    // The only other controls are the camera buttons and the decorative motion switch.
    expect(screen.getAllByRole("button")).toHaveLength(5);
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
  it("keeps the hub hideable and every animation behind the motion switch", () => {
    // Component tests do not apply stylesheets, so guard the two rules that broke or could.
    const styles = readFileSync("src/styles/chamber.css", "utf8");
    expect(styles).toMatch(/\.chamber\[hidden\]\s*\{\s*display:\s*none;/);
    const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*animation[^{}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(5);
    for (const [, selector] of rules) expect(selector).toContain('.chamber[data-motion="on"]');
  });
  it("shows the figure and tether for the one real module and marks the scene decorative", () => {
    const { container } = render(<Chamber />);
    expect(container.querySelector(".chamber-art")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".chamber-tether")).toHaveLength(1);
    expect(container.querySelectorAll(".chamber-agent")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Open JOB.OS console" })).toHaveTextContent(
      "manual, no automation",
    );
  });
  it("starts still without a motion preference and moves only after the owner switches it on", () => {
    window.localStorage.clear();
    const { container, unmount } = render(<Chamber />);
    const hub = container.querySelector(".chamber");
    const toggle = screen.getByRole("button", { name: "Motion off" });
    expect(hub).toHaveAttribute("data-motion", "off");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(hub).toHaveAttribute("data-motion", "on");
    expect(screen.getByRole("button", { name: "Motion on" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    unmount();
    render(<Chamber />);
    expect(screen.getByRole("button", { name: "Motion on" })).toBeVisible();
    window.localStorage.clear();
  });
  it("zooms with the wheel or buttons, drags with the right button only, and resets", () => {
    const { container } = render(<Chamber />);
    const scene = container.querySelector<HTMLElement>(".chamber-scene");
    const space = container.querySelector<HTMLElement>(".chamber-void");
    if (!scene || !space) throw new Error("Chamber scene is missing");
    const reset = screen.getByRole("button", { name: "Reset view" });
    expect(scene.style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(reset).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(scene.style.transform).toBe("translate(0px, 0px) scale(1.15)");
    const wheel = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    fireEvent(space, wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(scene.style.transform).toBe("translate(0px, 0px) scale(1)");
    // The left button never drags, so a figure can still be pressed.
    fireEvent.mouseDown(space, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 90, clientY: 50 });
    expect(scene.style.transform).toBe("translate(0px, 0px) scale(1)");
    fireEvent.mouseDown(space, { button: 2, clientX: 10, clientY: 10 });
    expect(space).toHaveAttribute("data-panning", "true");
    fireEvent.mouseMove(window, { clientX: 90, clientY: 50 });
    expect(scene.style.transform).toBe("translate(80px, 40px) scale(1)");
    fireEvent.mouseUp(window);
    expect(space).toHaveAttribute("data-panning", "false");
    fireEvent.mouseMove(window, { clientX: 300, clientY: 300 });
    expect(scene.style.transform).toBe("translate(80px, 40px) scale(1)");
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    fireEvent(space, menu);
    expect(menu.defaultPrevented).toBe(true);
    fireEvent.click(reset);
    expect(scene.style.transform).toBe("translate(0px, 0px) scale(1)");
  });
  it("keeps zoom and drag within limits", () => {
    const { container } = render(<Chamber />);
    const scene = container.querySelector<HTMLElement>(".chamber-scene");
    const space = container.querySelector<HTMLElement>(".chamber-void");
    if (!scene || !space) throw new Error("Chamber scene is missing");
    for (let step = 0; step < 20; step += 1)
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(scene.style.transform).toBe("translate(0px, 0px) scale(3)");
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    fireEvent.mouseDown(space, { button: 2, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 99999, clientY: -99999 });
    fireEvent.mouseUp(window);
    expect(scene.style.transform).toBe("translate(1560px, -1560px) scale(3)");
    for (let step = 0; step < 40; step += 1)
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(scene.style.transform).toContain("scale(0.6)");
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  });
});
