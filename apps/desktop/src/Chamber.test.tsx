import { readFileSync } from "node:fs";
import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Chamber from "./Chamber";
import {
  AGENTS,
  type Agent,
  CORE,
  home,
  iso,
  ORACLE,
  SCENE,
  scenePercent,
  TIMERS,
} from "./chamber/agents";
import { compile } from "./chamber/choreography";
import * as sprites from "./chamber/sprites";
import { drift, type Swim } from "./chamber/wander";

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
const openJobs = () => screen.getByRole("button", { name: "Open QUEST console" });
function parts(container: HTMLElement) {
  const scene = container.querySelector<HTMLElement>(".chamber-scene:not(.chamber-depths)");
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
    expect(screen.getByText("18 FIGURES / 1 WITH A FUNCTION")).toBeVisible();
  });

  it("shows every figure as a button that says whether it has a function", () => {
    const { container } = render(<Chamber />);
    expect(AGENTS.map((agent) => agent.slot)).toEqual(
      Array.from({ length: 18 }, (_, index) => String(index + 1).padStart(2, "0")),
    );
    for (const agent of AGENTS) {
      const figure = container.querySelector(`button[data-agent="${agent.id}"]`);
      expect(figure).toHaveTextContent(`${agent.slot} / ${agent.name}`);
      expect(figure).toHaveTextContent(agent.room ? "No function yet" : "manual, no automation");
    }
    const standing = within(
      screen.getByRole("list", { name: "Figures in the chamber" }),
    ).getAllByRole("listitem");
    expect(standing).toHaveLength(AGENTS.filter((agent) => agent.at).length);
  });

  it("opens the console from the first figure and returns with its state and focus intact", () => {
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
    // A room has a stylesheet block of its own, or shares the plain one with colours of its own.
    for (const { agent, room } of rooms)
      if (!room.look) expect(styles).toContain(`.room[data-room="${agent.id}"] h1`);
    const looks = rooms.flatMap(({ room }) => (room.look ? [room.look.join()] : []));
    expect(new Set(looks).size).toBe(looks.length);
    expect(styles).toContain('.room[data-look="plain"] h1');
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

  it("places figures inside the drawing and the swimmer under the surface beneath it all", () => {
    const { container } = render(<Chamber />);
    const { scene, space } = parts(container);
    for (const agent of AGENTS) {
      const figure = container.querySelector<HTMLElement>(`[data-agent="${agent.id}"]`);
      if (!figure) throw new Error(`Missing figure ${agent.id}`);
      if (!agent.at) {
        // In the depths, then the water's surface, then the scene: under everything, yet
        // moved by the same camera as the scene.
        const depths = figure.parentElement;
        expect(depths).toHaveClass("chamber-depths");
        expect(depths?.parentElement).toBe(space);
        expect(depths?.style.transform).toBe(scene.style.transform);
        fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
        expect(depths?.style.transform).toBe(scene.style.transform);
        expect(scene.style.transform).toContain("scale(1.15)");
        fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
        expect(figure).toHaveAttribute("data-act", "swim");
        expect(depths?.nextElementSibling).toHaveClass("chamber-surface");
        const after = figure.compareDocumentPosition(scene);
        expect(after & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        continue;
      }
      expect(scene.contains(figure)).toBe(true);
      expect(Number.parseFloat(figure.style.width)).toBeCloseTo((agent.width / SCENE.width) * 100);
      const left = Number.parseFloat(figure.style.left);
      const top = Number.parseFloat(figure.style.top);
      // On the platform, or in the open ground and sky within reach round it.
      expect(left > -110 && left < 210 && top > -70 && top < 160).toBe(true);
    }
    // The drawing is placed, or the figures before it would be painted over it. The swimmer
    // keeps its own colours and follows no fixed path.
    const styles = readFileSync("src/styles/chamber.css", "utf8");
    expect(styles).toMatch(/\.chamber-art \{[^}]*position: relative;/);
    expect(styles).toMatch(
      /\[data-act="swim"\] \.chamber-reel \{\s*filter: var\(--shadow-filter\);\s*\}/,
    );
    expect(styles).toMatch(/\.chamber \{[^}]*--shadow-filter: blur\([\d.]+px\);/);
    expect(styles).not.toMatch(/offset-path: ellipse\(3|chamber-swim|chamber-ripple/);
    // The watcher stands on the bar of the left sand timer; the black hole is off the platform.
    const [barLeft, barTop] = scenePercent(TIMERS.left, TIMERS.bar);
    const watcher = container.querySelector<HTMLElement>('[data-agent="watch"]');
    expect(Number.parseFloat(watcher?.style.left ?? "")).toBeCloseTo(barLeft);
    expect(Number.parseFloat(watcher?.style.top ?? "")).toBeCloseTo(barTop);
    const hole = AGENTS.find((agent) => agent.act === "spin")?.at ?? [0, 0];
    expect(hole[1]).toBeLessThan(0);
    expect(container.querySelector('[data-agent="horizon"]')).toHaveAttribute("data-centred");
  });

  it("keeps moving figures clear of each other and of everything that stands", () => {
    type Box = readonly [left: number, top: number, right: number, bottom: number];
    const meet = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    // A figure's box, from where its feet are: as wide as it is drawn, and as tall unless told.
    const box = ([x, y]: readonly number[], wide: number, tall = wide): Box => [
      (x ?? 0) - wide / 2,
      (y ?? 0) - tall,
      (x ?? 0) + wide / 2,
      y ?? 0,
    ];
    // How tall a figure is drawn, from the proportions of its built-in drawing.
    const shape = (agent: Agent) => {
      const drawing = (agent.prop ?? agent.frames)[0] ?? [];
      return (agent.width * drawing.length) / (drawing[0]?.length || 1);
    };
    const standing = (agent: Agent) => {
      const [x, y] = agent.at ?? [0, 0];
      return box(iso(x, y, agent.lift), agent.width, shape(agent));
    };
    // Every place a routine takes a figure: each straight leg, sampled closely.
    const swept = (agent: Agent) => {
      const stops = (agent.routine ?? []).flatMap((beat) => (beat.to ? [beat.to] : []));
      return stops.flatMap((to, leg) => {
        const from = stops.at(leg - 1) ?? to;
        return Array.from({ length: 25 }, (_, step) => {
          const k = step / 24;
          const at = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k] as const;
          return box(iso(...at, agent.lift), agent.width, Math.min(agent.width, shape(agent)));
        });
      });
    };
    const [cx, cy] = iso(CORE.x, CORE.y);
    // A figure moves if its routine takes it anywhere; the cat only moves inside its tree.
    const moves = (agent: Agent) => !agent.prop && Boolean(home(agent.routine));
    const fixed: Record<string, Box> = {
      // The dome with its orb, as the scene draws it.
      dome: [cx - 92, cy - 165, cx + 92, cy + 46],
      ...Object.fromEntries(
        AGENTS.filter((agent) => agent.at && !moves(agent)).map((agent) => [
          agent.id,
          standing(agent),
        ]),
      ),
    };
    for (const [side, at] of Object.entries({ left: TIMERS.left, right: TIMERS.right })) {
      const [x, y] = iso(at[0], at[1]);
      fixed[`${side} timer`] = [x - 33, y - TIMERS.bar, x + 33, y + 17];
    }
    // The ring of panes round the core is an ellipse, as the stylesheet lays it out: a box meets
    // it if the box's nearest point to the ring's middle is inside it.
    const ring = { x: cx, y: cy - 18, rx: 126, ry: 68 };
    const meetsRing = ([left, top, right, bottom]: Box) =>
      Math.hypot(
        (Math.min(Math.max(ring.x, left), right) - ring.x) / ring.rx,
        (Math.min(Math.max(ring.y, top), bottom) - ring.y) / ring.ry,
      ) < 1;
    const movers = AGENTS.filter(moves).map((agent) => [agent.id, swept(agent)] as const);
    expect(movers.map(([id]) => id)).toEqual(["jobs", "ki", "prowl", "cloud", "throttle"]);
    expect(Object.keys(fixed)).toHaveLength(1 + 12 + 2);
    for (const [id, path] of movers) {
      expect(path.length).toBeGreaterThan(40);
      expect([id, "panes", path.filter(meetsRing)]).toEqual([id, "panes", []]);
      for (const [name, obstacle] of Object.entries(fixed))
        expect([id, name, path.filter((at) => meet(at, obstacle))]).toEqual([id, name, []]);
      // No two movers share ground, so they cannot meet whatever their timing.
      for (const [other, theirs] of movers)
        if (other > id)
          expect([id, other, path.filter((a) => theirs.some((b) => meet(a, b)))]).toEqual([
            id,
            other,
            [],
          ]);
    }
  });

  it("lets the swimmer wander the whole space smoothly and always come back", () => {
    const space = { width: 1400, height: 800 };
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let swim: Swim = {
      x: 300,
      y: 600,
      heading: 0,
      turn: 0,
      want: 0,
      speed: 0,
      pace: 0.04,
      clock: 0,
      until: 0,
    };
    const visited = new Set<string>();
    const step = 1 / 60;
    // Ten minutes of swimming at sixty frames a second.
    for (let frame = 0; frame < 36000; frame += 1) {
      const next = drift(swim, step, space, random);
      // No jerks: it turns under a radian a second and never lurches forward.
      expect(Math.abs(next.heading - swim.heading)).toBeLessThan(1.2 * step);
      expect(Math.hypot(next.x - swim.x, next.y - swim.y)).toBeLessThan(80 * step);
      swim = next;
      // It may slip partly out of view, never far.
      expect(swim.x > -0.5 * space.width && swim.x < 1.5 * space.width).toBe(true);
      expect(swim.y > -0.5 * space.height && swim.y < 1.5 * space.height).toBe(true);
      visited.add(
        `${Math.floor((swim.x / space.width) * 3)},${Math.floor((swim.y / space.height) * 3)}`,
      );
    }
    // Not a circuit: over time it has been in every part of the space.
    for (const cell of ["0,0", "1,0", "2,0", "0,1", "1,1", "2,1", "0,2", "1,2", "2,2"])
      expect(visited).toContain(cell);
    expect(swim.speed).toBeGreaterThan(10);
  });

  it("switches the chamber alone between dark and light and remembers the choice", () => {
    const { container, unmount } = render(<Chamber />);
    const hub = container.querySelector(".chamber");
    const toggle = screen.getByRole("button", { name: "Light off" });
    // Dark is the default, and the switch sits with the other view controls.
    expect(hub).toHaveAttribute("data-theme", "dark");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(hub).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: "Light on" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Only the hub carries the theme: the console is outside it.
    fireEvent.click(openJobs());
    expect(screen.getByTestId("console").closest("[data-theme]")).toBeNull();
    unmount();
    render(<Chamber />);
    fireEvent.click(screen.getByRole("button", { name: "Light on" }));
    expect(screen.getByRole("button", { name: "Light off" })).toBeVisible();
  });

  it("draws the scene from theme tokens that light mode redefines", () => {
    const styles = readFileSync("src/styles/chamber.css", "utf8");
    const scene = readFileSync("src/chamber/ChamberScene.tsx", "utf8");
    // No colour is fixed in the drawing, so nothing stays dark in daylight.
    expect(scene).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const used = new Set([...scene.matchAll(/var\((--[a-z-]+)\)/g)].map(([, name]) => name));
    expect(used.size).toBeGreaterThan(15);
    const block = (selector: string) =>
      styles.slice(styles.indexOf(`${selector} {`)).split("}")[0] ?? "";
    const [dark, light] = [block(".chamber"), block('.chamber[data-theme="light"]')];
    for (const name of used) {
      expect(dark).toContain(`${name}:`);
      expect(light).toContain(`${name}:`);
    }
    // The palette of the owner's reference: paper, icy floor, gold, magenta, mint, slate text.
    for (const colour of ["#f4f1ea", "#e8eff4", "#e0ae3a", "#c24e8e", "#8ee0a6", "#2f3b45"])
      expect(light).toContain(colour);
    expect(light).toMatch(/--shadow-filter: [^;]*brightness\(0\.\d+\)/);
    // `--frame` is how long a strip holds each frame. A colour under that name once stopped
    // every looping strip that had no time of its own, so it may only ever be a time.
    for (const [, value] of styles.matchAll(/--frame:\s*([^;]+);/g))
      expect(value).toMatch(/^[\d.]+s$/);
    expect(styles).toMatch(/var\(--frame, [\d.]+s\)/);
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
    // Sixty presses against fourteen figures: allow for a busy machine.
  }, 15_000);

  it("keeps every built-in figure a clean rectangle of known colours", () => {
    const figures = [
      ...AGENTS.flatMap((agent) => [
        ...agent.frames,
        ...(agent.prop ?? []),
        ...Object.values(agent.poses ?? {}).flat(),
      ]),
      sprites.overseer,
    ];
    for (const rows of figures) {
      expect(new Set(rows.map((row) => row.length)).size).toBe(1);
      expect(rows.join("")).toMatch(/^[.A-Za-z]+$/);
    }
    // The tree is drawn without its cat, which is a separate piece that moves.
    expect(sprites.catTree.join("")).not.toMatch(/[Nn]/);
    // The black hole turns: eight frames, no two alike, each with a dark core.
    expect(new Set(sprites.blackHole.map((rows) => rows.join(""))).size).toBe(8);
    for (const rows of sprites.blackHole) expect(rows.join("")).toContain("kkkk");
  });

  it("shows the core's state when it is pressed and opens no page", () => {
    const { container } = render(<Chamber />);
    const core = screen.getByRole("button", { name: "Oracle master agent" });
    expect(core).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Model connected")).not.toBeInTheDocument();
    fireEvent.click(core);
    expect(core).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: "ORACLE / MASTER" });
    expect(panel).toHaveTextContent("Master agentNot built");
    expect(panel).toHaveTextContent("Model connectedNone");
    expect(panel).toHaveTextContent("Figures with a function1 of 18");
    expect(panel).toHaveTextContent("Ask OracleNot possible yet");
    // Still the hub: no room, no console, no input to type a question into, nothing sent.
    expect(screen.getByRole("heading", { name: "THE CHAMBER" })).toBeVisible();
    expect(document.querySelector(".room")).toBeNull();
    expect(screen.queryByTestId("console")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".chamber input, .chamber textarea")).toHaveLength(0);
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(core);
    expect(screen.queryByText("Model connected")).not.toBeInTheDocument();
  });

  it("circles the core with blank panes that say nothing", () => {
    const { container } = render(<Chamber />);
    const holo = container.querySelector(".chamber-holo");
    expect(holo).toHaveAttribute("aria-hidden", "true");
    const panes = [...(holo?.querySelectorAll<HTMLElement>("i") ?? [])];
    expect(panes).toHaveLength(10);
    expect(holo).toHaveTextContent("");
    expect(new Set(panes.map((pane) => pane.style.getPropertyValue("--at"))).size).toBe(10);
  });

  it("gives each figure one strip per pose and only the effect its act has", () => {
    const { container } = render(<Chamber />);
    const effects = {
      walk: [".chamber-starfall", 7],
      fly: [".chamber-beam", 0],
      swim: [".chamber-wake", 7],
    };
    for (const agent of AGENTS) {
      const figure = container.querySelector(`[data-agent="${agent.id}"]`);
      expect(figure).toHaveAttribute("data-act", agent.act);
      for (const [act, [piece, parts]] of Object.entries(effects)) {
        const found = figure?.querySelectorAll(String(piece)) ?? [];
        expect(found).toHaveLength(agent.act === act ? 1 : 0);
        if (agent.act === act) expect(found[0]?.querySelectorAll("i")).toHaveLength(Number(parts));
      }
      const reels = [
        ...(figure?.querySelectorAll<HTMLElement>(".chamber-actor > .chamber-reel") ?? []),
      ];
      const poses = agent.routine
        ? [...new Set(agent.routine.map((beat) => beat.pose))]
        : [undefined];
      // The first pose of a routine is the one that shows while the hub is still.
      expect(reels.map((reel) => reel.dataset.pose)).toEqual(poses);
      for (const reel of reels) {
        expect(Number(reel.dataset.frames)).toBeGreaterThan(0);
        expect(reel.style.getPropertyValue("--n")).toBe(reel.dataset.frames);
        expect(reel.children).toHaveLength(1);
      }
      // Only the cat has something to live on, and it starts where its routine ends.
      expect(figure?.querySelectorAll(".chamber-prop")).toHaveLength(agent.prop ? 1 : 0);
      const actor = figure?.querySelector<HTMLElement>(".chamber-actor");
      expect(actor?.style.left).toBe(agent.prop ? `${home(agent.routine)?.[0]}%` : "");
    }
  });

  it("works a routine out into a closed loop of keyframes", () => {
    for (const agent of AGENTS.filter((entry) => entry.routine)) {
      const line = compile(agent);
      if (!line) throw new Error(`No timeline for ${agent.id}`);
      const tracks = [line.left, line.top, line.face, line.cast, ...Object.values(line.show)];
      for (const track of tracks) {
        const offsets = track.map((frame) => Number(frame.offset));
        expect(offsets[0]).toBe(0);
        expect(offsets.at(-1)).toBe(1);
        expect(offsets).toEqual([...offsets].sort((x, y) => x - y));
        expect(offsets.every(Number.isFinite)).toBe(true);
      }
      // It ends where it began, so the loop has no jump.
      expect(line.left.at(-1)?.left).toBe(line.left[0]?.left);
      expect(line.top.at(-1)?.top).toBe(line.top[0]?.top);
      // A figure on the platform starts its loop on its own square.
      if (!agent.prop) expect(home(agent.routine)).toEqual(agent.at);
      // Exactly one pose shows at any moment.
      const poses = Object.values(line.show);
      for (const index of poses[0]?.keys() ?? [])
        expect(poses.filter((track) => track[index]?.opacity === 1)).toHaveLength(1);
      for (const spans of Object.values(line.once))
        for (const [start, end] of spans) expect(start < end && start >= 0 && end <= 1).toBe(true);
      expect(line.seconds).toBeGreaterThan(5);
    }
  });

  it("paces walks by distance, arcs a jump, and turns a figure the way it is told", () => {
    const base = AGENTS[0];
    if (!base) throw new Error("No figures");
    const line = compile({
      ...base,
      prop: [["..", ".."]],
      pace: 10,
      routine: [
        { pose: "walk", to: [60, 50] },
        { pose: "hop", to: [20, 30], seconds: 2, hop: 5, once: true },
        { pose: "cast", seconds: 3, cast: true, face: "right" },
        { pose: "walk", to: [20, 50] },
      ],
    });
    if (!line) throw new Error("No timeline");
    // 40 across at 10 a second, a 2 second jump, a 3 second cast, 20 down at 10 a second.
    expect(line.seconds).toBeCloseTo(4 + 2 + 3 + 2);
    expect(line.left.map((frame) => frame.left)).toEqual(["20%", "60%", "20%", "20%", "20%"]);
    // The jump peaks above the higher of its two ends, half way through.
    expect(line.top).toContainEqual({ top: "25%", offset: 5 / 11, easing: "ease-in" });
    // Art faces left: heading right mirrors it, heading left restores it, and a told side holds.
    expect(line.face.map((frame) => frame.scale)).toEqual(["-1 1", "1 1", "-1 1", "-1 1", "-1 1"]);
    expect(line.cast.filter((frame) => frame["--cast"] === 1)).toHaveLength(1);
    expect(line.once).toEqual({ hop: [[4 / 11, 6 / 11]] });
  });

  it("runs routines only while motion is on, and halts one under the pointer", () => {
    const calls: { target: Element; frames: Keyframe[]; duration: number }[] = [];
    const controls = { pause: vi.fn(), play: vi.fn(), cancel: vi.fn() };
    const animate = vi.fn(function (
      this: Element,
      frames: Keyframe[],
      timing: KeyframeAnimationOptions,
    ) {
      calls.push({ target: this, frames, duration: Number(timing.duration) });
      return controls as unknown as Animation;
    });
    Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });
    try {
      const { container, unmount } = render(<Chamber />);
      expect(animate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Motion off" }));
      const of = (id: string) => {
        const figure = container.querySelector(`[data-agent="${id}"]`);
        if (!figure) throw new Error(`Missing figure ${id}`);
        return { figure, mine: calls.filter(({ target }) => figure.contains(target)) };
      };
      const walker = of("jobs");
      const cat = of("perch");
      // Place (two tracks), effect, facing, and one track per pose.
      expect(walker.mine).toHaveLength(4 + 2);
      expect(walker.mine.slice(0, 3).every(({ target }) => target === walker.figure)).toBe(true);
      expect(new Set(walker.mine.map(({ duration }) => duration)).size).toBe(1);
      expect(walker.mine[0]?.duration).toBeGreaterThan(60_000);
      // The cat moves inside its tree, so the tree and its tag stay put.
      expect(cat.mine.slice(0, 3).every(({ target }) => target !== cat.figure)).toBe(true);
      expect(cat.mine[0]?.target).toHaveClass("chamber-actor");
      // Poses that play once are stepped through frame by frame.
      const stepped = cat.mine.filter(({ frames }) =>
        frames.some((frame) => String(frame.easing).startsWith("steps(")),
      );
      expect(stepped).toHaveLength(4);
      // Figures without a routine are left to the stylesheet.
      expect(of("watch").mine).toHaveLength(0);
      expect(of("deep").mine).toHaveLength(0);
      fireEvent.pointerEnter(walker.figure);
      expect(controls.pause).toHaveBeenCalledTimes(walker.mine.length);
      fireEvent.pointerLeave(walker.figure);
      expect(controls.play).toHaveBeenCalledTimes(walker.mine.length);
      unmount();
      expect(controls.cancel).toHaveBeenCalledTimes(calls.length);
    } finally {
      Reflect.deleteProperty(Element.prototype, "animate");
    }
  });

  it("seats the core at its console and turns the panes only when its routine sweeps an arm", () => {
    const { container } = render(<Chamber />);
    const core = screen.getByRole("button", { name: "Oracle master agent" });
    // The figure and its panes are inside the press target; the first pose is the one at rest.
    const reels = [...core.querySelectorAll<HTMLElement>(".chamber-actor > .chamber-reel")];
    expect(reels.map((reel) => reel.dataset.pose)).toEqual(["type", "swipe"]);
    expect(core.querySelector(".chamber-holo")).not.toBeNull();
    expect(container.querySelectorAll(".chamber-art image, .chamber-core-figure")).toHaveLength(0);
    const line = compile(ORACLE);
    if (!line) throw new Error("No timeline for the core");
    // It never leaves its seat, sweeps once a loop, and the panes turn once, after the sweep.
    expect(line.left).toEqual([]);
    expect(line.top).toEqual([]);
    expect(line.once.swipe).toHaveLength(1);
    const turns = line.cast.filter((frame) => frame["--cast"] === 1);
    expect(turns).toHaveLength(1);
    expect(Number(turns[0]?.offset)).toBeGreaterThan(line.once.swipe?.[0]?.[1] ?? 1);
    const styles = readFileSync("src/styles/chamber.css", "utf8");
    expect(styles).toMatch(/--turn: calc\(var\(--at\) \* 10 \+ var\(--cast\) \* 200\);/);
    expect(styles).not.toContain("chamber-orbit");
  });

  it("keeps the floor still and lets a few drifters cross it beneath the platform", () => {
    const { container } = render(<Chamber />);
    const space = container.querySelector(".chamber-space");
    expect(space).toHaveAttribute("aria-hidden", "true");
    // The only grid is the one drawn on the platform itself.
    expect(space?.firstElementChild).toHaveClass("chamber-stars");
    expect(container.querySelector(".chamber-grid")).toBeNull();
    const drifts = [...container.querySelectorAll<HTMLElement>(".chamber-drift")];
    expect(drifts.length).toBeGreaterThan(8);
    expect(new Set(drifts.map((drift) => drift.dataset.kind))).toEqual(
      new Set(["streak", "swish", "spark"]),
    );
    // No two share a cycle length, so they never fall into step.
    expect(new Set(drifts.map((drift) => drift.style.getPropertyValue("--cycle"))).size).toBe(
      drifts.length,
    );
    const styles = readFileSync("src/styles/chamber.css", "utf8");
    expect(styles).not.toMatch(/\.chamber-stars[^{]*\{[^}]*animation/);
    expect(styles).not.toContain("chamber-grid");
    // A drifter is out of sight for most of its cycle.
    expect(styles).toMatch(/@keyframes chamber-drift \{\s*0%,\s*82% \{\s*opacity: 0;/);
  });

  it("turns each sand timer over after the sand has run instead of jumping back", () => {
    const { container } = render(<Chamber />);
    expect(container.querySelectorAll(".chamber-hourglass")).toHaveLength(2);
    const styles = readFileSync("src/styles/chamber.css", "utf8");
    expect(styles).toMatch(
      /@keyframes chamber-flip \{\s*88% \{\s*rotate: 0deg;\s*\}\s*100% \{\s*rotate: 180deg;/,
    );
    expect(styles).toMatch(/\.chamber-hourglass \{\s*animation: chamber-flip 30s/);
    expect(styles).toMatch(/animation: chamber-sand-upper 30s/);
  });
});
