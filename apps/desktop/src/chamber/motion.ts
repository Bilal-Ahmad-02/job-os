import { useState } from "react";

const MOTION_KEY = "oracle.chamber.motion";

/** The owner's saved choice if there is one, otherwise the system's reduced-motion preference. */
function initialMotion(): boolean {
  try {
    const saved = window.localStorage.getItem(MOTION_KEY);
    if (saved === "on" || saved === "off") return saved === "on";
  } catch {
    // Storage can be unavailable; fall through to the system preference.
  }
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches
  );
}

/** Whether the chamber's decorative movement runs, and a switch that remembers the choice. */
export function useMotion(): [boolean, () => void] {
  const [motion, setMotion] = useState(initialMotion);
  return [
    motion,
    () => {
      const next = !motion;
      setMotion(next);
      try {
        window.localStorage.setItem(MOTION_KEY, next ? "on" : "off");
      } catch {
        // The choice still applies until Oracle is closed.
      }
    },
  ];
}
