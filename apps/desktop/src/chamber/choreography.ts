import { type RefObject, useEffect } from "react";
import { type Agent, iso, scenePercent } from "./agents";

const SPEED = 16; // Scene units a walker covers each second.
const STOP_SECONDS = 7;
const AIM_STEP = 30; // Beam directions are multiples of this many degrees.

/**
 * Walks a figure round its route in straight lines at a steady pace, facing the way it goes and
 * stopping where the route says to, when the star shower inside it is shown. The route is data,
 * so the timeline is built here rather than written out as keyframes. A walker is hard to press,
 * so it halts while the pointer or keyboard is on it.
 */
export function useRoute(button: RefObject<HTMLElement | null>, agent: Agent, moving: boolean) {
  useEffect(() => {
    const element = button.current;
    const { route, stops = [] } = agent;
    if (!moving || !element || !route || typeof element.animate !== "function") return;
    const figure = element.querySelector(".chamber-body");
    const shower = element.querySelector(".chamber-starfall");
    const place: Keyframe[] = [];
    const face: Keyframe[] = [];
    const cast: Keyframe[] = [];
    let clock = 0;
    const legs = route.map((from, index) => {
      const to = route[(index + 1) % route.length] ?? from;
      const [fx, fy] = iso(from[0], from[1]);
      const [tx, ty] = iso(to[0], to[1]);
      return { from, wait: stops.includes(index) ? STOP_SECONDS : 0, dx: tx - fx, dy: ty - fy };
    });
    const total = legs.reduce((sum, leg) => sum + leg.wait + Math.hypot(leg.dx, leg.dy) / SPEED, 0);
    const mark = (frames: Keyframe[], frame: Keyframe) =>
      frames.push({ ...frame, offset: clock / total });
    for (const leg of legs) {
      const [left, top] = scenePercent(leg.from);
      const here = { left: `${left}%`, top: `${top}%` };
      mark(place, here);
      mark(cast, { opacity: leg.wait ? 1 : 0, easing: "step-end" });
      clock += leg.wait;
      mark(place, here);
      mark(cast, { opacity: 0, easing: "step-end" });
      // The drawing faces left; turn it when the next leg heads right.
      mark(face, { scale: `${leg.dx > 0 ? -1 : 1} 1`, easing: "step-end" });
      clock += Math.hypot(leg.dx, leg.dy) / SPEED;
    }
    for (const frames of [place, face, cast]) frames.push({ ...frames[0], offset: 1 });
    const timing = { duration: total * 1000, iterations: Number.POSITIVE_INFINITY };
    const running = [
      element.animate(place, timing),
      ...(figure ? [figure.animate(face, timing)] : []),
      ...(shower ? [shower.animate(cast, timing)] : []),
    ];
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

/**
 * Points a figure's beam somewhere new each time its firing cycle restarts, and turns the figure
 * to face that side. The direction is picked at that moment, so no two shots need match.
 */
export function useAim(button: RefObject<HTMLElement | null>, agent: Agent, moving: boolean) {
  useEffect(() => {
    const element = button.current;
    const beam = element?.querySelector<HTMLElement>(".chamber-beam");
    if (!moving || agent.act !== "beam" || !element || !beam) return;
    const aim = () => {
      const angle = Math.floor(Math.random() * (360 / AIM_STEP)) * AIM_STEP;
      element.style.setProperty("--aim", `${angle}deg`);
      // Angles between a quarter and three quarters of a turn point to the left.
      element.style.setProperty("--face", angle > 90 && angle < 270 ? "1" : "-1");
    };
    aim();
    beam.addEventListener("animationiteration", aim);
    return () => beam.removeEventListener("animationiteration", aim);
  }, [button, agent, moving]);
}
