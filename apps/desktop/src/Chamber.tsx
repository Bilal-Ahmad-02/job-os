import { type CSSProperties, useEffect, useRef, useState } from "react";
import App from "./App";
import AgentRoom from "./chamber/AgentRoom";
import { AGENTS, type Agent, footPercent, SCENE } from "./chamber/agents";
import ChamberScene from "./chamber/ChamberScene";
import { MAX_SCALE, MIN_SCALE, useCamera } from "./chamber/camera";
import { useMotion } from "./chamber/motion";
import { privateSprite } from "./chamber/privateSprites";
import { PixelSprite } from "./chamber/sprites";
import { useLeash } from "./chamber/useLeash";
import ShellHeader from "./ShellHeader";

const JOBS = "jobs";

/** Where a platform figure stands, how big it is, and where a walker turns round. */
function placement(agent: Agent): CSSProperties | undefined {
  if (!agent.at) return undefined;
  const [left, top] = footPercent(agent.at, agent.lift);
  const frame = agent.frames[0] ?? [];
  const [toLeft, toTop] = agent.walksTo ? footPercent(agent.walksTo) : [left, top];
  return {
    left,
    top,
    width: `${(agent.width / SCENE.width) * 100}%`,
    aspectRatio: `${frame[0]?.length ?? 1} / ${frame.length || 1}`,
    "--to-left": toLeft,
    "--to-top": toTop,
  } as CSSProperties;
}

/** A pressable figure with its tag. The owner's own image replaces the drawing when present. */
function AgentButton({ agent, onOpen }: { agent: Agent; onOpen: (id: string) => void }) {
  const custom = privateSprite(agent.sprite);
  const frame = agent.frames[0] ?? [];
  const move = agent.walksTo ? "walk" : agent.lift ? "float" : agent.at ? "stand" : "roam";
  return (
    <button
      type="button"
      className="chamber-agent"
      data-agent={agent.id}
      data-move={move}
      aria-label={agent.room ? `Open ${agent.room.title}` : `Open ${agent.name} console`}
      style={placement(agent)}
      onClick={() => onOpen(agent.id)}
    >
      <span className="chamber-body">
        {custom ? (
          <img className="chamber-figure" src={custom} alt="" />
        ) : (
          <svg
            className="chamber-figure"
            viewBox={`0 0 ${frame[0]?.length ?? 1} ${frame.length || 1}`}
            aria-hidden="true"
            focusable="false"
          >
            {agent.frames.map((rows, index) => (
              <PixelSprite
                // biome-ignore lint/suspicious/noArrayIndexKey: frames are a fixed list.
                key={index}
                rows={rows}
                {...(agent.frames.length > 1
                  ? { className: index ? "chamber-step chamber-step-alternate" : "chamber-step" }
                  : {})}
              />
            ))}
          </svg>
        )}
      </span>
      <span className="chamber-tag">
        <span className="chamber-code">
          {agent.slot} / {agent.name}
        </span>
        <span className="chamber-detail">{agent.note}</span>
      </span>
    </button>
  );
}

/**
 * Hub shown after unlock. Every figure opens its own page. Only JOB.OS does anything; the other
 * pages say they have no function, and the core is labelled dormant. Lines, movement and figures
 * are decoration and never represent model activity.
 */
export default function Chamber({ onLock }: { onLock?: () => void }) {
  const [place, setPlace] = useState("chamber");
  const [jobsOpened, setJobsOpened] = useState(false);
  const [motion, toggleMotion] = useMotion();
  const space = useRef<HTMLElement>(null);
  const camera = useCamera(space);
  const { view } = camera;
  const lastOpened = useRef("");
  const atHub = place === "chamber";
  useLeash(space, atHub, motion, view);

  // Coming back, put keyboard focus on the figure that was opened.
  useEffect(() => {
    if (atHub && lastOpened.current)
      space.current?.querySelector<HTMLElement>(`[data-agent="${lastOpened.current}"]`)?.focus();
  }, [atHub]);

  function open(id: string) {
    lastOpened.current = id;
    if (id === JOBS) setJobsOpened(true);
    setPlace(id);
  }
  const back = () => setPlace("chamber");
  const visited = AGENTS.find((agent) => agent.id === place);

  return (
    <>
      <div className="chamber" hidden={!atHub} data-motion={motion ? "on" : "off"}>
        <ShellHeader caption="THE CHAMBER" onLock={onLock}>
          <button
            className="quiet-button"
            type="button"
            aria-label="Zoom out"
            disabled={view.scale <= MIN_SCALE}
            onClick={() => camera.zoom(-1)}
          >
            −
          </button>
          <button
            className="quiet-button"
            type="button"
            aria-label="Zoom in"
            disabled={view.scale >= MAX_SCALE}
            onClick={() => camera.zoom(1)}
          >
            +
          </button>
          <button
            className="quiet-button"
            type="button"
            disabled={view.scale === 1 && view.x === 0 && view.y === 0}
            onClick={camera.reset}
          >
            Reset view
          </button>
          <button
            className="quiet-button"
            type="button"
            aria-pressed={motion}
            title="Decorative movement only. It does not show any activity."
            onClick={toggleMotion}
          >
            Motion {motion ? "on" : "off"}
          </button>
        </ShellHeader>
        {/* Mouse-only camera; the header buttons do the same by keyboard. */}
        <main
          className="chamber-void"
          aria-labelledby="chamber-title"
          ref={space}
          data-panning={camera.panning}
          onMouseDown={camera.startPan}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="chamber-space" aria-hidden="true">
            <div className="chamber-stars" />
            <div className="chamber-streaks" />
          </div>
          {/* Figures without a place on the platform roam the whole space and pass beneath it. */}
          {AGENTS.filter((agent) => !agent.at).map((agent) => (
            <AgentButton key={agent.id} agent={agent} onOpen={open} />
          ))}
          <h1 id="chamber-title">THE CHAMBER</h1>
          <div
            className="chamber-scene"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            <ChamberScene coreSprite={privateSprite("oracle")} />
            <section className="chamber-core" aria-labelledby="chamber-core-title">
              <h2 id="chamber-core-title">ORACLE / MASTER</h2>
              <p className="chamber-state">DORMANT</p>
              <p>No assistant yet. Nothing is running here.</p>
            </section>
            <ul className="chamber-agents" aria-label="Agents on the platform">
              {AGENTS.filter((agent) => agent.at).map((agent) => (
                <li key={agent.id}>
                  <AgentButton agent={agent} onOpen={open} />
                </li>
              ))}
            </ul>
          </div>
          {/* One dotted line per figure, from the orb to its feet. Decoration, not a data link. */}
          <svg className="chamber-leash" aria-hidden="true" focusable="false">
            {AGENTS.map((agent) => (
              <line key={agent.id} data-for={agent.id} />
            ))}
          </svg>
        </main>
        <footer className="console-footer">
          <span>
            <span className="status-dot" aria-hidden="true" />
            PRIVATE WORKSPACE
          </span>
          <span>
            {AGENTS.length} FIGURES / {AGENTS.filter((agent) => !agent.room).length} WITH A FUNCTION
          </span>
          <span>ORACLE / 00</span>
        </footer>
      </div>
      {/* Keep the console mounted after its first opening so drafts survive a return here. */}
      {jobsOpened && (
        <div hidden={place !== JOBS}>
          <App active={place === JOBS} {...(onLock ? { onLock } : {})} onChamber={back} />
        </div>
      )}
      {visited?.room ? (
        <AgentRoom agent={visited} room={visited.room} onChamber={back} onLock={onLock} />
      ) : null}
    </>
  );
}
