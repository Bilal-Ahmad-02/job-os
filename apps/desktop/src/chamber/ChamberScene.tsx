import { cloakedWatcher, hoveringFighter, overseer, PixelSprite, sleepingCat } from "./sprites";

/** Scene coordinates: a 760 x 480 canvas with a 2:1 isometric grid, origin at the far corner. */
export const SCENE = { width: 760, height: 480 } as const;
export const ORB = { x: 380, y: 170 } as const;
/** The far end of the JOB.OS figure's walk; its tether runs from the orb to this point. */
export const WALK_END = { x: 156, y: 382 } as const;
/** Slots with no agent. Each shows a decorative figure; `lift` raises one that floats. */
export const EMPTY_PADS = [
  { slot: "02", x: 9, y: 1.2, figure: sleepingCat, lift: 0 },
  { slot: "03", x: 1.5, y: 8.5, figure: hoveringFighter, lift: 22 },
  { slot: "04", x: 8.5, y: 8.5, figure: cloakedWatcher, lift: 0 },
] as const;

export function iso(x: number, y: number, z = 0): [number, number] {
  return [380 + (x - y) * 32, 110 + (x + y) * 16 - z];
}
function points(corners: readonly (readonly [number, number])[], drop = 0): string {
  return corners
    .map(([x, y]) => iso(x, y))
    .map(([sx, sy]) => `${sx},${sy + drop}`)
    .join(" ");
}

// A square court with three wings, like the reference platform seen from the same angle.
const court = [
  [0, 0],
  [10, 0],
  [10, 3],
  [13, 3],
  [13, 7],
  [10, 7],
  [10, 10],
  [7, 10],
  [7, 13],
  [3, 13],
  [3, 10],
  [0, 10],
  [0, 7],
  [-3, 7],
  [-3, 3],
  [0, 3],
] as const;
const gridLines = Array.from({ length: 17 }, (_, index) => index - 3);

function Hourglass({ x, y, id }: { x: number; y: number; id: string }) {
  const [cx, base] = iso(x, y);
  return (
    <g>
      <ellipse cx={cx} cy={base} rx="32" ry="16" fill="#07100c" stroke="#376347" />
      <ellipse cx={cx} cy={base - 5} rx="26" ry="13" fill="#0e1f17" stroke="#32ce74" />
      <clipPath id={`${id}-lower`}>
        <rect x={cx - 19} y={base - 54} width="38" height="46" rx="17" />
      </clipPath>
      <clipPath id={`${id}-upper`}>
        <rect x={cx - 19} y={base - 106} width="38" height="46" rx="17" />
      </clipPath>
      <g clipPath={`url(#${id}-upper)`}>
        <rect
          className="chamber-sand chamber-sand-upper"
          x={cx - 19}
          y={base - 106}
          width="38"
          height="46"
          fill="#32ce74"
        />
      </g>
      <g clipPath={`url(#${id}-lower)`}>
        <rect
          className="chamber-sand chamber-sand-lower"
          x={cx - 19}
          y={base - 54}
          width="38"
          height="46"
          fill="#32ce74"
        />
      </g>
      <line
        className="chamber-sand-stream"
        x1={cx}
        y1={base - 62}
        x2={cx}
        y2={base - 12}
        stroke="#70ee9c"
        strokeWidth="2"
        strokeDasharray="3 4"
      />
      <rect
        x={cx - 21}
        y={base - 56}
        width="42"
        height="50"
        rx="19"
        fill="#9fe8bd14"
        stroke="#4f8f69"
      />
      <rect
        x={cx - 21}
        y={base - 108}
        width="42"
        height="50"
        rx="19"
        fill="#9fe8bd14"
        stroke="#4f8f69"
      />
      <rect x={cx - 6} y={base - 62} width="12" height="10" fill="#12241a" stroke="#32ce74" />
      <path
        d={`M${cx - 25} ${base - 104}A25 30 0 0 1 ${cx + 25} ${base - 104}Z`}
        fill="#12241a"
        stroke="#32ce74"
      />
      <ellipse cx={cx} cy={base - 104} rx="25" ry="7" fill="#0b1a13" stroke="#32ce74" />
      <path d={`M${cx} ${base - 134}v-10`} stroke="#70ee9c" strokeWidth="2" />
      <circle cx={cx} cy={base - 146} r="3" fill="#70ee9c" />
    </g>
  );
}

/**
 * Decorative chamber drawing. Nothing in it reports activity: the orb and screen are dim and the
 * tether does not pulse, because the Oracle core is not running.
 */
export default function ChamberScene({
  coreSprite,
  slotSprites = {},
}: {
  coreSprite?: string;
  /** Owner-supplied images for the agentless slots, keyed by slot number. */
  slotSprites?: Record<string, string | undefined>;
}) {
  const [cx, cy] = iso(5, 5);
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

      <polygon points={points(court, 14)} fill="#020403" stroke="#1e3528" />
      <polygon points={points(court)} fill="#07100c" stroke="#376347" strokeWidth="1.5" />
      <g clipPath="url(#chamber-court)" stroke="#32ce7426" strokeWidth="1">
        {gridLines.map((line) => (
          <g key={line}>
            <polyline
              points={points([
                [line, -3],
                [line, 13],
              ])}
            />
            <polyline
              points={points([
                [-3, line],
                [13, line],
              ])}
            />
          </g>
        ))}
      </g>

      {EMPTY_PADS.map((pad) => (
        <polygon
          key={pad.slot}
          points={points([
            [pad.x - 0.9, pad.y - 0.9],
            [pad.x + 0.9, pad.y - 0.9],
            [pad.x + 0.9, pad.y + 0.9],
            [pad.x - 0.9, pad.y + 0.9],
          ])}
          fill="#0b1a1366"
          stroke="#376347"
          strokeDasharray="5 5"
        />
      ))}

      <Hourglass x={-1.5} y={5} id="chamber-glass-a" />

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
      <line
        className="chamber-tether"
        x1={ORB.x}
        y1={ORB.y}
        x2={WALK_END.x}
        y2={WALK_END.y}
        stroke="#32ce74"
        strokeWidth="2"
        strokeOpacity="0.75"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />
      {coreSprite ? (
        <image
          className="chamber-figure"
          href={coreSprite}
          x={cx - 24}
          y={cy - 72}
          width="48"
          height="56"
          preserveAspectRatio="xMidYMax meet"
        />
      ) : (
        <PixelSprite rows={overseer} x={cx - 24} y={cy - 72} scale={4} />
      )}
      <polygon
        points={`${cx - 34},${cy - 22} ${cx + 34},${cy - 22} ${cx + 44},${cy - 6} ${cx - 44},${cy - 6}`}
        fill="#12241a"
        stroke="#376347"
      />
      <rect x={cx - 44} y={cy - 6} width="88" height="7" fill="#07100c" stroke="#376347" />
      <rect x={cx - 19} y={cy - 46} width="38" height="25" fill="#040706" stroke="#4f8f69" />
      <path d={`M${cx - 11} ${cy - 33}h22`} stroke="#1e3528" strokeWidth="2" />
      <circle cx={ORB.x} cy={ORB.y} r="15" fill="#32ce7414" />
      <circle cx={ORB.x} cy={ORB.y} r="10" fill="url(#chamber-orb)" stroke="#376347" />

      {/* Figures on slots that have no agent. They are scenery: not pressable and not connected. */}
      {EMPTY_PADS.map((pad) => {
        const [px, py] = iso(pad.x, pad.y);
        const width = (pad.figure[0]?.length ?? 0) * 4;
        const height = pad.figure.length * 4;
        const custom = slotSprites[pad.slot];
        return (
          <g key={pad.slot} className="chamber-occupant" data-slot={pad.slot}>
            {pad.lift ? <ellipse cx={px} cy={py + 4} rx="16" ry="6" fill="#00000066" /> : null}
            <g className={pad.lift ? "chamber-float" : undefined}>
              {custom ? (
                <image
                  className="chamber-figure"
                  href={custom}
                  x={px - 28}
                  y={py + 6 - pad.lift - 66}
                  width="56"
                  height="66"
                  preserveAspectRatio="xMidYMax meet"
                />
              ) : (
                <PixelSprite
                  rows={pad.figure}
                  x={px - width / 2}
                  y={py + 6 - pad.lift - height}
                  scale={4}
                />
              )}
            </g>
          </g>
        );
      })}

      <Hourglass x={11.5} y={6} id="chamber-glass-b" />
    </svg>
  );
}
