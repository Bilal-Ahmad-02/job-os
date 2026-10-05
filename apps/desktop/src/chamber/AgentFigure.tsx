import type { Agent } from "./agents";
import { privateSprite } from "./privateSprites";
import { catAwake, catCurled, PixelSprite } from "./sprites";

const STARS = [1, 2, 3, 4, 5, 6] as const;

/** The owner's own image when one was supplied under `name`, otherwise the built-in drawing. */
function Sprite({
  name,
  frames,
  className = "",
}: {
  name: string;
  frames: readonly (readonly string[])[];
  className?: string;
}) {
  const custom = privateSprite(name);
  if (custom) return <img className={`chamber-figure ${className}`} src={custom} alt="" />;
  const first = frames[0] ?? [];
  return (
    <svg
      className={`chamber-figure ${className}`}
      viewBox={`0 0 ${first[0]?.length ?? 1} ${first.length || 1}`}
      aria-hidden="true"
      focusable="false"
    >
      {frames.map((rows, index) => (
        <PixelSprite
          // biome-ignore lint/suspicious/noArrayIndexKey: frames are a fixed list.
          key={index}
          rows={rows}
          {...(frames.length > 1
            ? { className: index ? "chamber-step chamber-step-alternate" : "chamber-step" }
            : {})}
        />
      ))}
    </svg>
  );
}

/**
 * What is drawn inside a figure's button: its body and whatever its act needs. The extra pieces
 * are still until the stylesheet or the choreography moves them, and none of them means anything.
 */
export default function AgentFigure({ agent }: { agent: Agent }) {
  return (
    <>
      <span className="chamber-body">
        <Sprite name={agent.sprite} frames={agent.frames} />
      </span>
      {agent.act === "tree" ? (
        <span className="chamber-cat">
          <Sprite name={`${agent.sprite}-asleep`} frames={[catCurled]} className="chamber-asleep" />
          <Sprite name={`${agent.sprite}-awake`} frames={[catAwake]} className="chamber-awake" />
          <span className="chamber-zzz">
            <i>z</i>
            <i>z</i>
            <i>z</i>
          </span>
        </span>
      ) : null}
      {agent.act === "beam" ? <i className="chamber-beam" /> : null}
      {agent.act === "boomerang" ? <i className="chamber-prop" /> : null}
      {agent.act === "route" ? (
        <span className="chamber-starfall">
          {STARS.map((star) => (
            <i key={star} />
          ))}
        </span>
      ) : null}
    </>
  );
}
