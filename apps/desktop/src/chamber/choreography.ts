import { type RefObject, useEffect } from "react";
import { type Figure, home, type Point, SCENE, scenePercent } from "./agents";

const EASING = { in: "ease-in", out: "ease-out", both: "ease-in-out" } as const;

/** A span of the loop, as fractions of it. */
type Span = readonly [start: number, end: number];

export type Timeline = {
  seconds: number;
  /**
   * Position, as two tracks so a jump can rise and fall while it travels evenly. Both are empty
   * for a figure that never leaves its place.
   */
  left: Keyframe[];
  top: Keyframe[];
  /** Mirrors the drawing, which faces left, when the figure faces right. */
  face: Keyframe[];
  /** `--cast` climbs from 0 to 1 across each beat that runs the figure's effect. */
  cast: Keyframe[];
  /** For each pose, when its drawing is the one showing. */
  show: Record<string, Keyframe[]>;
  /** For each pose that plays through once, the spans in which it does. */
  once: Record<string, Span[]>;
};

/**
 * Turns a figure's routine into keyframes. The routine is data, so the timeline is worked out
 * here, once, instead of being written by hand in the stylesheet.
 */
export function compile(agent: Figure): Timeline | undefined {
  const { routine = [], pace = 1 } = agent;
  // Inside a prop a point is already a percentage of it; on the platform it is a grid square.
  const place = (point: Point): Point => (agent.prop ? point : scenePercent(point, agent.lift));
  if (!routine.length) return undefined;
  const start = home(routine);
  const drawing = agent.prop?.[0];
  const tall = drawing ? drawing.length / (drawing[0]?.length || 1) : SCENE.height / SCENE.width;

  let here: Point = start ? place(start) : [0, 0];
  let facing = 1;
  const beats = routine.map((beat) => {
    const from = here;
    here = beat.to ? place(beat.to) : here;
    const [dx, dy] = [here[0] - from[0], here[1] - from[1]];
    if (beat.face) facing = beat.face === "left" ? 1 : -1;
    else if (dx) facing = dx > 0 ? -1 : 1;
    return {
      ...beat,
      from,
      end: here,
      facing,
      length: beat.seconds ?? Math.hypot(dx, dy * tall) / pace,
    };
  });
  // A figure that starts with a pause is still facing the way its last move left it.
  const settled = beats.at(-1)?.facing ?? 1;
  const seconds = beats.reduce((sum, beat) => sum + beat.length, 0);
  const poses = [...new Set(routine.map((beat) => beat.pose))];
  const line: Timeline = { seconds, left: [], top: [], face: [], cast: [], show: {}, once: {} };
  for (const pose of poses) line.show[pose] = [];

  let clock = 0;
  let turned = false;
  for (const beat of beats) {
    const offset = clock / seconds;
    const until = (clock + beat.length) / seconds;
    const easing = beat.ease ? EASING[beat.ease] : "linear";
    line.left.push({ left: `${beat.from[0]}%`, offset, easing });
    if (beat.hop) {
      const peak = Math.min(beat.from[1], beat.end[1]) - beat.hop;
      line.top.push({ top: `${beat.from[1]}%`, offset, easing: "ease-out" });
      line.top.push({ top: `${peak}%`, offset: (offset + until) / 2, easing: "ease-in" });
    } else line.top.push({ top: `${beat.from[1]}%`, offset, easing });
    turned ||= Boolean(beat.face || beat.end[0] !== beat.from[0]);
    line.face.push({ scale: `${turned ? beat.facing : settled} 1`, offset, easing: "step-end" });
    line.cast.push({ "--cast": 0, offset, easing: beat.cast ? easing : "step-end" });
    if (beat.cast) line.cast.push({ "--cast": 1, offset: until, easing: "step-end" });
    for (const pose of poses)
      line.show[pose]?.push({ opacity: pose === beat.pose ? 1 : 0, offset, easing: "step-end" });
    if (beat.once) line.once[beat.pose] = [...(line.once[beat.pose] ?? []), [offset, until]];
    clock += beat.length;
  }
  if (!start) line.left = line.top = [];
  for (const track of [line.left, line.top, line.face, line.cast, ...Object.values(line.show)])
    if (track.length) track.push({ ...track[0], offset: 1 });
  return line;
}

/** Steps a strip of `frames` from its first frame to its last across each span, and rewinds. */
function playOnce(spans: readonly Span[], frames: number): Keyframe[] {
  const rest: Keyframe = { translate: "0%", easing: "step-end" };
  const track: Keyframe[] = [{ ...rest, offset: 0 }];
  for (const [start, end] of spans) {
    track.push({ translate: "0%", offset: start, easing: `steps(${frames})` });
    track.push({ ...rest, translate: "-100%", offset: end });
  }
  return [...track, { ...rest, offset: 1 }];
}

/**
 * Runs a figure's routine while the hub's motion is on: where it is, which way it faces, which
 * drawing shows and when its effect plays. A moving figure is hard to press, so the whole routine
 * halts while the pointer or keyboard is on it.
 */
export function useRoutine(button: RefObject<HTMLElement | null>, agent: Figure, moving: boolean) {
  useEffect(() => {
    const element = button.current;
    const actor = element?.querySelector<HTMLElement>(".chamber-actor");
    if (!moving || !element || !actor || typeof element.animate !== "function") return;
    const line = compile(agent);
    if (!line) return;
    const timing = { duration: line.seconds * 1000, iterations: Number.POSITIVE_INFINITY };
    const mover = agent.prop ? actor : element;
    const running = [line.left, line.top, line.cast]
      .filter((track) => track.length)
      .map((track) => mover.animate(track, timing));
    running.push(actor.animate(line.face, timing));
    for (const reel of actor.querySelectorAll<HTMLElement>("[data-pose]")) {
      const pose = reel.dataset.pose ?? "";
      const strip = reel.firstElementChild;
      const spans = line.once[pose];
      running.push(reel.animate(line.show[pose] ?? [], timing));
      if (spans && strip)
        running.push(strip.animate(playOnce(spans, Number(reel.dataset.frames)), timing));
    }
    const halt = () => {
      for (const animation of running) animation.pause();
    };
    const resume = () => {
      for (const animation of running) animation.play();
    };
    const events: [string, () => void][] = [
      ["pointerenter", halt],
      ["focus", halt],
      ["pointerleave", resume],
      ["blur", resume],
    ];
    for (const [name, handler] of events) element.addEventListener(name, handler);
    return () => {
      for (const [name, handler] of events) element.removeEventListener(name, handler);
      for (const animation of running) animation.cancel();
    };
  }, [button, agent, moving]);
}
