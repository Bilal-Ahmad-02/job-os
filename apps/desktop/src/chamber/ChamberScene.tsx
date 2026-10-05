import { AGENTS, CORE, iso, type Point, SCENE } from "./agents";
import { overseer, PixelSprite } from "./sprites";

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
const gridLines = Array.from({ length: 20 }, (_, index) => index - 3);
const standing = AGENTS.filter((agent) => agent.at);
const GLASS = { fill: "#9fe8bd14", stroke: "#4f8f69" } as const;
const FRAME = { fill: "#12241a", stroke: "#32ce74" } as const;

/**
 * A sand timer hung between two posts. The glass is the same at both ends, so when the sand has
 * run out it can turn over and start again without a jump.
 */
function Hourglass({ x, y, id }: { x: number; y: number; id: string }) {
  const [cx, base] = iso(x, y);
  const mid = base - 66;
  return (
    <g>
      <ellipse cx={cx} cy={base} rx="38" ry="17" fill="#07100c" stroke="#376347" />
      <path
        d={`M${cx - 33} ${base}V${mid}M${cx + 33} ${base}V${mid}`}
        stroke="#376347"
        strokeWidth="3"
      />
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
 * Decorative chamber drawing. The orb and the console screen are dim, because the Oracle core is
 * not running. Figures, their lines to the orb and the panes around the core are drawn by the
 * chamber on top of this.
 */
export default function ChamberScene({ coreSprite }: { coreSprite?: string | undefined }) {
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

      {/* The floor is slightly see-through so the space, and what swims in it, shows beneath. */}
      <polygon points={points(court, 14)} fill="#020403b8" stroke="#1e3528" />
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

      {/* A pad where each standing figure starts, and a shadow under one that hovers. */}
      {standing.map(({ id, at = [0, 0], lift }) => {
        const [x, y] = at;
        const [px, py] = iso(x, y);
        return (
          <g key={id}>
            <polygon
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
            {lift ? <ellipse cx={px} cy={py} rx="16" ry="6" fill="#00000066" /> : null}
          </g>
        );
      })}

      <Hourglass x={-1.5} y={6.5} id="chamber-glass-a" />

      {/* The core: a low dais under a wire dome, with a dim orb above a console. */}
      <ellipse cx={cx} cy={cy + 6} rx="96" ry="48" fill="#03080580" />
      <ellipse cx={cx} cy={cy} rx="92" ry="46" fill="#050c08" stroke="#1e3528" />
      <ellipse cx={cx} cy={cy - 10} rx="92" ry="46" fill="#0b1a13" stroke="#32ce74" />
      <g fill="none" stroke="#32ce7455" strokeWidth="1.2">
        <path d={`M${cx - 92} ${cy - 10}A92 130 0 0 1 ${cx + 92} ${cy - 10}`} />
        <path d={`M${cx - 46} ${cy + 30}Q${cx - 66} ${cy - 80} ${cx} ${cy - 140}`} />
        <path d={`M${cx + 46} ${cy + 30}Q${cx + 66} ${cy - 80} ${cx} ${cy - 140}`} />
        <ellipse cx={cx} cy={cy - 78} rx="80" ry="30" />
      </g>
      <g className="chamber-core-figure">
        {coreSprite ? (
          <image
            href={coreSprite}
            x={cx - 44}
            y={cy - 126}
            width="88"
            height="106"
            preserveAspectRatio="xMidYMax meet"
          />
        ) : (
          <PixelSprite rows={overseer} x={cx - 24} y={cy - 72} scale={4} />
        )}
      </g>
      <polygon
        points={`${cx - 34},${cy - 22} ${cx + 34},${cy - 22} ${cx + 44},${cy - 6} ${cx - 44},${cy - 6}`}
        fill="#12241a"
        stroke="#376347"
      />
      <rect x={cx - 44} y={cy - 6} width="88" height="7" fill="#07100c" stroke="#376347" />
      <rect x={cx - 19} y={cy - 46} width="38" height="25" fill="#040706" stroke="#4f8f69" />
      <path d={`M${cx - 11} ${cy - 33}h22`} stroke="#1e3528" strokeWidth="2" />
      <circle cx={cx} cy={cy - 150} r="15" fill="#32ce7414" />
      <circle
        className="chamber-orb"
        cx={cx}
        cy={cy - 150}
        r="10"
        fill="url(#chamber-orb)"
        stroke="#376347"
      />

      <Hourglass x={14.8} y={7.2} id="chamber-glass-b" />
    </svg>
  );
}
