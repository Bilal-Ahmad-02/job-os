import { readFileSync } from "node:fs";
import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Chamber from "./Chamber";
import { AGENTS, SCENE } from "./chamber/agents";
import * as sprites from "./chamber/sprites";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
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

const rooms = AGENTS.flatMap((agent) => (agent.room ? [{ agent, room: agent.room }] : []));
const openJobs = () => screen.getByRole("button", { name: "Open JOB.OS console" });
function parts(container: HTMLElement) {
  const scene = container.querySelector<HTMLElement>(".chamber-scene");
  const space = container.querySelector<HTMLElement>(".chamber-void");
  if (!scene || !space) throw new Error("Chamber scene is missing");
  return { scene, space };
}
beforeEach(() => window.localStorage.clear());

describe("Oracle chamber", () => {
  it("opens on the hub without mounting any page and labels the core as dormant", () => {
    render(<Chamber />);
    expect(screen.getByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    const core = screen.getByRole("region", { name: "ORACLE / MASTER" });
    expect(within(core).getByText("DORMANT")).toBeVisible();
    expect(within(core).getByText(/No assistant yet/)).toBeVisible();
    expect(screen.queryByTestId("console")).not.toBeInTheDocument();
    expect(document.querySelector(".room")).toBeNull();
    expect(screen.getByText("5 FIGURES / 1 WITH A FUNCTION")).toBeVisible();
  });

  it("shows every figure as a button that says whether it has a function", () => {
    const { container } = render(<Chamber />);
    expect(AGENTS.map((agent) => agent.slot)).toEqual(["01", "02", "03", "04", "05"]);
    for (const agent of AGENTS) {
      const figure = container.querySelector(`button[data-agent="${agent.id}"]`);
      expect(figure).toHaveTextContent(`${agent.slot} / ${agent.name}`);
      expect(figure).toHaveTextContent(agent.room ? "No function yet" : "manual, no automation");
    }
    const standing = within(
      screen.getByRole("list", { name: "Agents on the platform" }),
    ).getAllByRole("listitem");
    expect(standing).toHaveLength(AGENTS.filter((agent) => agent.at).length);
  });

  it("opens the console from JOB.OS and returns with its state and focus intact", () => {
    render(<Chamber onLock={() => {}} />);
    fireEvent.click(openJobs());
    expect(screen.getByTestId("console")).toBeVisible();
    expect(screen.getByTestId("console")).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("heading", { name: "THE CHAMBER", hidden: true })).not.toBeVisible();
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Chamber" }));
    expect(screen.getByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(screen.getByTestId("console")).not.toBeVisible();
    expect(screen.getByTestId("console")).toHaveAttribute("data-active", "false");
    expect(openJobs()).toHaveFocus();
    fireEvent.click(openJobs());
    expect(screen.getByLabelText("Draft")).toHaveValue("unsaved");
  });

  it.each(rooms)(
    "opens $room.title as an honest page with no function and returns to its figure",
    ({ agent, room }) => {
      const onLock = vi.fn();
      const { container } = render(<Chamber onLock={onLock} />);
      fireEvent.click(screen.getByRole("button", { name: `Open ${room.title}` }));
      expect(screen.getByRole("heading", { name: "THE CHAMBER", hidden: true })).not.toBeVisible();
      const page = container.querySelector(`.room[data-room="${agent.id}"]`);
      expect(page).toHaveTextContent(`${agent.slot} / ${agent.name}`);
      expect(screen.getByRole("heading", { name: room.title })).toBeVisible();
      expect(page).toHaveTextContent(room.line);
      expect(page).toHaveTextContent(/No agent lives here yet\. This page does nothing/);
      // A still page: nothing to type into, nothing sent, and the console is not started.
      expect(page?.querySelectorAll("input, textarea, select, form, a")).toHaveLength(0);
      expect(invoke).not.toHaveBeenCalled();
      expect(screen.queryByTestId("console")).not.toBeInTheDocument();
      const back = screen.getByRole("button", { name: "Return to the chamber" });
      expect(back).toHaveFocus();
      fireEvent.click(screen.getByRole("button", { name: "Lock Oracle" }));
      expect(onLock).toHaveBeenCalledTimes(1);
      fireEvent.click(back);
      expect(document.querySelector(".room")).toBeNull();
      expect(screen.getByRole("button", { name: `Open ${room.title}` })).toHaveFocus();
    },
  );

  it("gives each room its own title, words and stylesheet block", () => {
    const styles = readFileSync("src/styles/rooms.css", "utf8");
    expect(new Set(rooms.map(({ room }) => room.title)).size).toBe(rooms.length);
    expect(new Set(rooms.map(({ room }) => room.line)).size).toBe(rooms.length);
    for (const { agent } of rooms) expect(styles).toContain(`.room[data-room="${agent.id}"] h1`);
    expect(styles).not.toMatch(/animation|@keyframes/);
  });

  it("locks from the hub and from the console", () => {
    const onLock = vi.fn();
    render(<Chamber onLock={onLock} />);
    fireEvent.click(screen.getByRole("button", { name: "Lock Oracle" }));
    fireEvent.click(openJobs());
    fireEvent.click(screen.getByRole("button", { name: "Lock Oracle" }));
    expect(onLock).toHaveBeenCalledTimes(2);
  });

  it("draws one line from the orb for every figure and marks the drawing decorative", () => {
    const { container } = render(<Chamber />);
    expect(container.querySelector(".chamber-art")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".chamber-orb")).toHaveLength(1);
    const lines = [...container.querySelectorAll<SVGLineElement>(".chamber-leash line")];
    expect(lines.map((line) => line.dataset.for)).toEqual(AGENTS.map((agent) => agent.id));
    for (const line of lines)
      for (const name of ["x1", "y1", "x2", "y2"])
        expect(Number.isFinite(Number(line.getAttribute(name)))).toBe(true);
    expect(container.querySelector(".chamber-leash")).toHaveAttribute("aria-hidden", "true");
  });

  it("stands platform figures inside the drawing and lets the roamer use the whole space", () => {
    const { container } = render(<Chamber />);
    const { scene, space } = parts(container);
    for (const agent of AGENTS) {
      const figure = container.querySelector<HTMLElement>(`[data-agent="${agent.id}"]`);
      if (!figure) throw new Error(`Missing figure ${agent.id}`);
      if (!agent.at) {
        // Outside the camera: it is not zoomed or dragged with the platform.
        expect(figure.parentElement).toBe(space);
        expect(figure).toHaveAttribute("data-move", "roam");
        continue;
      }
      expect(scene.contains(figure)).toBe(true);
      const left = Number.parseFloat(figure.style.left);
      const top = Number.parseFloat(figure.style.top);
      expect(left > 0 && left < 100 && top > 0 && top < 100).toBe(true);
      expect(Number.parseFloat(figure.style.width)).toBeCloseTo((agent.width / SCENE.width) * 100);
    }
    expect(container.querySelector('[data-agent="jobs"]')).toHaveAttribute("data-move", "walk");
    expect(container.querySelector('[data-agent="summit"]')).toHaveAttribute("data-move", "float");
  });

  it("keeps the hub hideable and every animation behind the motion switch", () => {
    // Component tests do not apply stylesheets, so guard the rules that broke or could.
    const styles = readFileSync("src/styles/chamber.css", "utf8");
    expect(styles).toMatch(/\.chamber\[hidden\]\s*\{\s*display:\s*none;/);
    const rules = [...styles.matchAll(/([^{}]+)\{([^{}]*animation[^{}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(5);
    // Selectors in a list sit on separate lines; commas inside :is() stay on one line.
    for (const [, selector = ""] of rules)
      for (const part of selector.split(/,\s*\n/))
        expect(part).toContain('.chamber[data-motion="on"]');
  });

  it("starts still without a motion preference and moves only after the owner switches it on", () => {
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
  });

  it("zooms with the wheel or buttons, drags with the right button only, and resets", () => {
    const { container } = render(<Chamber />);
    const { scene, space } = parts(container);
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
    const { scene, space } = parts(container);
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

  it("keeps every built-in figure a clean rectangle of known colours", () => {
    const figures = [...AGENTS.flatMap((agent) => agent.frames), sprites.overseer];
    for (const rows of figures) {
      expect(new Set(rows.map((row) => row.length)).size).toBe(1);
      expect(rows.join("")).toMatch(/^[.A-Za-z]+$/);
    }
    // The cat sleeps on top of a tall tree: the cat itself is only the first few rows.
    expect(sprites.sleepingCat.length).toBeGreaterThanOrEqual(30);
    expect(sprites.sleepingCat.slice(8).join("")).not.toMatch(/[Nn]/);
  });
});
