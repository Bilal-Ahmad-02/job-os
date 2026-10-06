import { type RefObject, useEffect } from "react";

/** Where a wandering swimmer is, in pixels of the space it roams, and what it is doing. */
export type Swim = {
  x: number;
  y: number;
  /** Direction of travel in radians: 0 is right, a quarter turn is down. */
  heading: number;
  /** How fast the heading is changing, and the rate it is easing toward. */
  turn: number;
  want: number;
  /** Pixels a second, and the share of the space's shorter side it is easing toward. */
  speed: number;
  pace: number;
  /** Seconds swum, and when it will next change its mind. */
  clock: number;
  until: number;
};

/** The sharpest it will turn, in radians a second. */
const TIGHTEST = 1;
/** How far past an edge of the layer that holds it its middle may stray, as a share of it. */
const MARGIN = 0.3;

/**
 * One moment of an aimless swim. Every few seconds it picks a new curve and pace, and eases into
 * both, so it never jerks. Near the limit of the space it leans back toward the middle, harder
 * the further out it is, so it can slip partly out of view but always comes back.
 */
export function drift(
  now: Swim,
  seconds: number,
  space: { width: number; height: number },
  random: () => number,
): Swim {
  let { want, pace, until } = now;
  if (now.clock >= until) {
    want = (random() - 0.5) * 0.9;
    pace = 0.04 + random() * 0.05;
    until = now.clock + 2 + random() * 4;
  }
  const [cx, cy] = [space.width / 2, space.height / 2];
  const out = Math.max(
    Math.abs(now.x - cx) / (space.width * (0.5 + MARGIN)),
    Math.abs(now.y - cy) / (space.height * (0.5 + MARGIN)),
  );
  // The shorter way round to face the middle.
  const off = Math.atan2(cy - now.y, cx - now.x) - now.heading;
  const pull = out > 0.8 ? Math.atan2(Math.sin(off), Math.cos(off)) * (out - 0.8) * 5 : 0;
  // However hard it is pulled, it never turns faster than a wide, unhurried arc.
  const aim = Math.max(-TIGHTEST, Math.min(TIGHTEST, want + pull));
  const turn = now.turn + (aim - now.turn) * Math.min(1, seconds * 1.5);
  const cruise = pace * Math.min(space.width, space.height);
  const speed = now.speed + (cruise - now.speed) * Math.min(1, seconds * 0.6);
  const heading = now.heading + turn * seconds;
  return {
    x: now.x + Math.cos(heading) * speed * seconds,
    y: now.y + Math.sin(heading) * speed * seconds,
    heading,
    turn,
    want,
    speed,
    pace,
    clock: now.clock + seconds,
    until,
  };
}

/**
 * Lets a figure swim wherever it likes across the space that holds it, turned to face the way it
 * is going. It starts from where the stylesheet rests it, stops under the pointer or keyboard so
 * it can be pressed, and goes back to its resting place when motion is switched off.
 */
export function useWander(button: RefObject<HTMLElement | null>, moving: boolean) {
  useEffect(() => {
    const element = button.current;
    const space = element?.parentElement;
    const actor = element?.querySelector<HTMLElement>(".chamber-actor");
    if (!moving || !element || !space || !actor) return;
    let swim: Swim | undefined;
    let halted = false;
    let last = performance.now();
    let frameId = requestAnimationFrame(function tick(time) {
      // A long gap, such as a hidden window, counts as a short one.
      const seconds = Math.min(0.1, (time - last) / 1000);
      last = time;
      const [width, height] = [space.clientWidth, space.clientHeight];
      // It sets off from its resting place, once the space has been laid out.
      if (!swim && width) {
        const rest = getComputedStyle(element);
        const [x, y] = [Number.parseFloat(rest.left), Number.parseFloat(rest.top)];
        const heading = Math.random() * Math.PI * 2;
        swim = { x, y, heading, turn: 0, want: 0, speed: 0, pace: 0.05, clock: 0, until: 0 };
      }
      if (swim && !halted) {
        swim = drift(swim, seconds, { width, height }, Math.random);
        element.style.left = `${swim.x}px`;
        element.style.top = `${swim.y}px`;
        // The drawing's head is at the top, a quarter turn from the heading's zero.
        actor.style.rotate = `${swim.heading + Math.PI / 2}rad`;
      }
      frameId = requestAnimationFrame(tick);
    });
    const halt = () => {
      halted = true;
    };
    const resume = () => {
      halted = false;
    };
    const events: [string, () => void][] = [
      ["pointerenter", halt],
      ["focus", halt],
      ["pointerleave", resume],
      ["blur", resume],
    ];
    for (const [name, handler] of events) element.addEventListener(name, handler);
    return () => {
      cancelAnimationFrame(frameId);
      for (const [name, handler] of events) element.removeEventListener(name, handler);
      for (const [target, property] of [
        [element, "left"],
        [element, "top"],
        [actor, "rotate"],
      ] as const)
        target.style.removeProperty(property);
    };
  }, [button, moving]);
}
