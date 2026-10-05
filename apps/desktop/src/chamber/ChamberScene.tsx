import { AGENTS, CORE, iso, type Point, SCENE, TIMERS } from "./agents";

function points(corners: readonly Point[], drop = 0): string {
  return corners
    .map(([x, y]) => iso(x, y))
    .map(([sx, sy]) => `${sx},${sy + drop}`)
    .join(" ");
}

// A square court with three wings, seen from the angle of the owner's reference picture.
const court: readonly Point[] = [
  [0, 0],
  [13, 0],
  [13, 4],
  [16, 4],
  [16, 9],
  [13, 9],
  [13, 13],
  [9, 13],
  [9, 16],
  [4, 16],
  [4, 13],
  [0, 13],
  [0, 9],
  [-3, 9],
  [-3, 4],
  [0, 4],
];
/** The court's outline pushed outward by `by` grid squares on every side. */
function widened(by: number): Point[] {
  // Each edge pushes its corners toward its own outer side; the outline runs clockwise.
  const push = (dx: number, dy: number) => [Math.sign(dy) * by, -Math.sign(dx) * by] as const;
  return court.map(([x, y], index) => {
    const [px, py] = court.at(index - 1) ?? [x, y];
    const [nx, ny] = court[(index + 1) % court.length] ?? [x, y];
    const [before, after] = [push(x - px, y - py), push(nx - x, ny - y)];
    return [x + before[0] + after[0], y + before[1] + after[1]];
  });
}
/**
 * Two steps lead down from the court to the floor. Each is drawn as a ring around whatever stands
 * on it (the outline of that, at the foot of its riser), so the see-through layers never pile up.
 */
const RISE = 10;
const foot = (edge: readonly Point[], drop: number) => `M${points(edge, drop + RISE)}Z`;
const steps = [2, 1].map((step) => {
  const [edge, drop] = [widened(step * 0.65), step * RISE];
  const inner = foot(step > 1 ? widened((step - 1) * 0.65) : court, drop - RISE);
  return { drop, riser: foot(edge, drop) + inner, tread: `M${points(edge, drop)}Z${inner}` };
});
const gridLines = Array.from({ length: 20 }, (_, index) => index - 3);
const padded = AGENTS.filter((agent) => agent.pad);
const GLASS = { fill: "#9fe8bd14", stroke: "#4f8f69" } as const;
const FRAME = { fill: "#12241a", stroke: "#32ce74" } as const;

/**
 * A sand timer hung between two posts joined by a bar across the top, high enough for the glass
 * to turn under it. The glass is the same at both ends, so when the sand has run out it can turn
 * over and start again without a jump.
 */
function Hourglass({ at: [x, y], id }: { at: Point; id: string }) {
  const [cx, base] = iso(x, y);
  const mid = base - 66;
  const bar = base - TIMERS.bar;
  return (
    <g>
      <ellipse cx={cx} cy={base} rx="38" ry="17" fill="#07100c" stroke="#376347" />
      <path
        d={`M${cx - 33} ${base}V${bar}M${cx + 33} ${base}V${bar}`}
        stroke="#376347"
        strokeWidth="3"
      />
      <rect x={cx - 40} y={bar} width="80" height="5" rx="2" {...FRAME} />
      <g className="chamber-hourglass">
        <clipPath id={`${id}-upper`}>
          <rect x={cx - 19} y={mid - 49} width="38" height="46" rx="17" />
        </clipPath>
        <clipPath id={`${id}-lower`}>
          <rect x={cx - 19} y={mid + 3} width="38" height="46" rx="17" />
        </clipPath>
        <g clipPath={`url(#${id}-upper)`}>
          <rect
            className="chamber-sand chamber-sand-upper"
            x={cx - 19}
            y={mid - 49}
            width="38"
            height="46"
            fill="#32ce74"
          />
        </g>
        <g clipPath={`url(#${id}-lower)`}>
          <rect
            className="chamber-sand chamber-sand-lower"
            x={cx - 19}
            y={mid + 3}
            width="38"
            height="46"
            fill="#32ce74"
          />
        </g>
        <line
          className="chamber-sand-stream"
          x1={cx}
          y1={mid - 4}
          x2={cx}
          y2={mid + 46}
          stroke="#70ee9c"
          strokeWidth="2"
          strokeDasharray="3 4"
        />
        <rect x={cx - 21} y={mid - 51} width="42" height="50" rx="19" {...GLASS} />
        <rect x={cx - 21} y={mid + 1} width="42" height="50" rx="19" {...GLASS} />
        <rect x={cx - 6} y={mid - 5} width="12" height="10" {...FRAME} />
        <rect x={cx - 27} y={mid - 58} width="54" height="8" rx="3" {...FRAME} />
        <rect x={cx - 27} y={mid + 50} width="54" height="8" rx="3" {...FRAME} />
      </g>
      <circle cx={cx - 33} cy={mid} r="4" {...FRAME} />
      <circle cx={cx + 33} cy={mid} r="4" {...FRAME} />
    </g>
  );
}

/**
 * Decorative chamber drawing: the court raised two steps above the floor, the sand timers and
 * the core's dais, dome and dim orb. The core's figure, the other figures, their lines to the
 * orb and the panes around the core are drawn by the chamber on top of this.
 */
export default function ChamberScene() {
  const [cx, cy] = iso(CORE.x, CORE.y);
  return (
    <svg
      className="chamber-art"
      viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="chamber-court">
          <polygon points={points(court)} />
        </clipPath>
        <radialGradient id="chamber-orb" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#b7f5cf" />
          <stop offset="0.45" stopColor="#2a8f57" />
          <stop offset="1" stopColor="#0b1a13" />
        </radialGradient>
      </defs>

      {/* Everything is slightly see-through, so what swims under the floor shows beneath. */}
      {steps.map(({ drop, riser, tread }) => (
        <g key={drop} stroke="#1e3528" fillRule="evenodd">
          <path d={riser} fill="#020403b8" />
          <path d={tread} fill="#0c1b14b8" />
        </g>
      ))}
      <polygon points={points(court, RISE)} fill="#020403b8" stroke="#1e3528" />
      <polygon points={points(court)} fill="#07100cb8" stroke="#376347" strokeWidth="1.5" />
      <g clipPath="url(#chamber-court)" stroke="#32ce7426" strokeWidth="1">
        {gridLines.map((line) => (
          <g key={line}>
            <polyline
              points={points([
                [line, -3],
                [line, 16],
              ])}
            />
            <polyline
              points={points([
                [-3, line],
                [16, line],
              ])}
            />
          </g>
        ))}
      </g>

      {/* The square a figure calls its own. */}
      {padded.map(({ id, at: [x, y] = [0, 0] }) => (
        <polygon
          key={id}
          points={points([
            [x - 0.9, y - 0.9],
            [x + 0.9, y - 0.9],
            [x + 0.9, y + 0.9],
            [x - 0.9, y + 0.9],
          ])}
          fill="#0b1a1366"
          stroke="#376347"
          strokeDasharray="5 5"
        />
      ))}

      <Hourglass at={TIMERS.left} id="chamber-glass-a" />

      {/* The core's place: a low dais under a wire dome, with a dim orb at the top. */}
      <ellipse cx={cx} cy={cy + 6} rx="96" ry="48" fill="#03080580" />
      <ellipse cx={cx} cy={cy} rx="92" ry="46" fill="#050c08" stroke="#1e3528" />
      <ellipse cx={cx} cy={cy - 10} rx="92" ry="46" fill="#0b1a13" stroke="#32ce74" />
      <g fill="none" stroke="#32ce7455" strokeWidth="1.2">
        <path d={`M${cx - 92} ${cy - 10}A92 130 0 0 1 ${cx + 92} ${cy - 10}`} />
        <path d={`M${cx - 46} ${cy + 30}Q${cx - 66} ${cy - 80} ${cx} ${cy - 140}`} />
        <path d={`M${cx + 46} ${cy + 30}Q${cx + 66} ${cy - 80} ${cx} ${cy - 140}`} />
        <ellipse cx={cx} cy={cy - 78} rx="80" ry="30" />
      </g>
      <circle cx={cx} cy={cy - 150} r="15" fill="#32ce7414" />
      <circle
        className="chamber-orb"
        cx={cx}
        cy={cy - 150}
        r="10"
        fill="url(#chamber-orb)"
        stroke="#376347"
      />

      <Hourglass at={TIMERS.right} id="chamber-glass-b" />
    </svg>
  );
}
