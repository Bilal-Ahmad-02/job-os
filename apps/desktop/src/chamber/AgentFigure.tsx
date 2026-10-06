import type { CSSProperties } from "react";
import { type Act, type Figure, home } from "./agents";
import { privateSprite, type Strip } from "./privateSprites";
import { type Frames, PixelSprite } from "./sprites";

/** Extra pieces an act draws over its figure: a class name and how many parts it has. */
const EFFECTS: Partial<Record<Act, readonly [className: string, parts: number]>> = {
  walk: ["chamber-starfall", 7],
  fly: ["chamber-beam", 0],
  swim: ["chamber-wake", 3],
};

/**
 * A strip of frames shown one at a time: the owner's image if one was supplied, otherwise a
 * built-in pixel drawing. The stylesheet steps through a strip on a loop; the choreography steps
 * through the ones that play once.
 */
function Reel({
  art,
  pose,
  className,
}: {
  art: Strip | Frames;
  pose?: string | undefined;
  className?: string;
}) {
  const built = "src" in art ? undefined : art;
  const count = built ? built.length : (art as Strip).frames;
  const columns = built?.[0]?.[0]?.length ?? 1;
  return (
    <span
      className={className ? `chamber-reel ${className}` : "chamber-reel"}
      data-pose={pose}
      data-frames={count}
      style={{ "--n": count } as CSSProperties}
    >
      {built ? (
        <svg
          viewBox={`0 0 ${columns * count} ${built[0]?.length || 1}`}
          aria-hidden="true"
          focusable="false"
        >
          {built.map((rows, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: frames are a fixed list.
            <PixelSprite key={index} rows={rows} x={index * columns} />
          ))}
        </svg>
      ) : (
        <img src={(art as Strip).src} alt="" />
      )}
    </span>
  );
}

/**
 * What is drawn inside a figure's button: the thing it lives on, if any, then an actor holding
 * one drawing per pose and whatever its act adds. Only the first pose shows until the
 * choreography says otherwise, and none of it means anything.
 */
export default function AgentFigure({ agent }: { agent: Figure }) {
  const { sprite, routine } = agent;
  const poses = routine ? [...new Set(routine.map((beat) => beat.pose))] : [undefined];
  const [effect, parts = 0] = (agent.act && EFFECTS[agent.act]) ?? [];
  // An actor on a prop starts where its routine ends, which is where the loop begins.
  const [left, top] = (agent.prop && home(routine)) || [];
  return (
    <>
      {agent.prop ? (
        <Reel art={privateSprite(`${sprite}-prop`) ?? agent.prop} className="chamber-prop" />
      ) : null}
      <span
        className="chamber-actor"
        style={left === undefined ? undefined : { left: `${left}%`, top: `${top}%` }}
      >
        {poses.map((pose) => (
          <Reel
            key={pose ?? ""}
            pose={pose}
            art={
              privateSprite(pose ? `${sprite}-${pose}` : sprite) ??
              agent.poses?.[pose ?? ""] ??
              privateSprite(sprite) ??
              agent.frames
            }
          />
        ))}
        {effect ? (
          <span className={effect}>
            {Array.from({ length: parts }, (_, part) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: identical parts in a fixed order.
              <i key={part} style={{ "--i": part } as CSSProperties} />
            ))}
          </span>
        ) : null}
      </span>
    </>
  );
}
