import type { CSSProperties } from "react";

/**
 * Things that cross the space now and then: a kind, a colour, where it starts (percent), the way
 * it heads (degrees), how long its cycle is and how far into it it begins (seconds). Each is
 * out of sight for most of its cycle, and the cycles differ, so the sky never repeats in step.
 */
const DRIFTS = [
  ["streak", "#70ee9c", 8, 18, 26.57, 23, 0],
  ["streak", "#6fd6ff", 62, 6, 153.43, 31, 9],
  ["streak", "#c9a8ff", 30, 74, -26.57, 37, 20],
  ["streak", "#ffcf6b", 84, 58, 206.57, 41, 5],
  ["streak", "#ff8fb8", 4, 52, 26.57, 53, 33],
  ["swish", "#70ee9c", 55, 30, 12, 29, 14],
  ["swish", "#8fb4ff", 12, 62, -18, 43, 2],
  ["swish", "#e6b8ff", 70, 80, 196, 47, 26],
  ["spark", "#ffffff", 22, 34, 0, 13, 4],
  ["spark", "#ffcf6b", 76, 22, 90, 17, 11],
  ["spark", "#6fd6ff", 44, 88, 200, 19, 7],
  ["spark", "#ff8fb8", 90, 44, 300, 11, 1],
  ["spark", "#b7f5cf", 6, 84, 60, 27, 16],
] as const;

/**
 * The dark floor the platform stands on. Its specks do not move. With motion on, a few coloured
 * streaks, curved swishes and sparks pass across it from time to time, beneath the platform.
 */
export default function ChamberSpace() {
  return (
    <div className="chamber-space" aria-hidden="true">
      <div className="chamber-stars" />
      {DRIFTS.map(([kind, tint, x, y, turn, cycle, begin]) => (
        <i
          key={`${kind}${x}`}
          className="chamber-drift"
          data-kind={kind}
          style={
            {
              "--tint": tint,
              "--x": `${x}%`,
              "--y": `${y}%`,
              "--turn": `${turn}deg`,
              "--cycle": `${cycle}s`,
              "--begin": `-${begin}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
