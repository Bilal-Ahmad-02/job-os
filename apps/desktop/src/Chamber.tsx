import { type CSSProperties, memo, useCallback, useEffect, useRef, useState } from "react";
import App from "./App";
import AgentFigure from "./chamber/AgentFigure";
import AgentRoom from "./chamber/AgentRoom";
import { AGENTS, type Agent, CORE, ORACLE, SCENE, scenePercent } from "./chamber/agents";
import ChamberScene from "./chamber/ChamberScene";
import ChamberSpace from "./chamber/ChamberSpace";
import { MAX_SCALE, MIN_SCALE, useCamera } from "./chamber/camera";
import { useRoutine } from "./chamber/choreography";
import { useMotion, useTheme } from "./chamber/motion";
import { useLeash } from "./chamber/useLeash";
import { useWander } from "./chamber/wander";
import ShellHeader from "./ShellHeader";

const JOBS = "jobs";
const PANES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const WITH_A_FUNCTION = AGENTS.filter((agent) => !agent.room).length;
const [CORE_LEFT, CORE_TOP] = scenePercent([CORE.x, CORE.y], 10);

/** Where a figure in the scene stands and how wide it is. The swimmer has no such place. */
function placement(agent: Agent): CSSProperties | undefined {
  if (!agent.at) return undefined;
  const [left, top] = scenePercent(agent.at, agent.lift);
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${(agent.width / SCENE.width) * 100}%`,
    ...(agent.tempo && { "--frame": `${agent.tempo}s` }),
  };
}

/**
 * A pressable figure with its tag. Its act runs only while the hub's motion is on. Remembered,
 * so moving the camera does not redraw every figure.
 */
const AgentButton = memo(function AgentButton({
  agent,
  moving,
  onOpen,
}: {
  agent: Agent;
  moving: boolean;
  onOpen: (id: string) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useRoutine(button, agent, moving);
  useWander(button, moving && agent.act === "swim");
  return (
    <button
      type="button"
      className="chamber-agent"
      ref={button}
      data-agent={agent.id}
      data-act={agent.act}
      data-centred={agent.centred}
      aria-label={agent.room ? `Open ${agent.room.title}` : `Open ${agent.name} console`}
      style={placement(agent)}
      onClick={() => onOpen(agent.id)}
    >
      <AgentFigure agent={agent} />
      <span className="chamber-tag">
        <span className="chamber-code">
          {agent.slot} / {agent.name}
        </span>
        <span className="chamber-detail">{agent.note}</span>
      </span>
    </button>
  );
});

/**
 * The core: pressing it shows or hides its state and opens nothing. The panes round it are blank
 * because nothing is running; they turn only as decoration, when its routine sweeps an arm.
 */
const Core = memo(function Core({
  moving,
  open,
  onToggle,
}: {
  moving: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useRoutine(button, ORACLE, moving);
  return (
    <button
      type="button"
      className="chamber-core-button"
      ref={button}
      aria-label="Oracle master agent"
      aria-expanded={open}
      aria-controls="chamber-core"
      style={{ left: `${CORE_LEFT}%`, top: `${CORE_TOP}%` }}
      onClick={onToggle}
    >
      <AgentFigure agent={ORACLE} />
      <span className="chamber-holo" aria-hidden="true">
        {PANES.map((pane) => (
          <i key={pane} style={{ "--at": pane } as CSSProperties} />
        ))}
      </span>
    </button>
  );
});

/**
 * Hub shown after unlock. Every figure opens its own page; pressing the core shows its state
 * and opens nothing. Only the job console does anything: the other pages say they have no function and
 * the core says it is dormant. Lines, panes, movement and figures are decoration and never
 * represent model activity.
 */
export default function Chamber({ onLock }: { onLock?: () => void }) {
  const [place, setPlace] = useState("chamber");
  const [jobsOpened, setJobsOpened] = useState(false);
  const [coreOpen, setCoreOpen] = useState(false);
  const [motion, toggleMotion] = useMotion();
  const [theme, toggleTheme] = useTheme();
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

  const open = useCallback((id: string) => {
    lastOpened.current = id;
    if (id === JOBS) setJobsOpened(true);
    setPlace(id);
  }, []);
  const toggleCore = useCallback(() => setCoreOpen((shown) => !shown), []);
  const back = () => setPlace("chamber");
  const visited = AGENTS.find((agent) => agent.id === place);

  return (
    <>
      <div
        className="chamber"
        hidden={!atHub}
        data-motion={motion ? "on" : "off"}
        data-theme={theme}
      >
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
          <button
            className="quiet-button"
            type="button"
            aria-pressed={theme === "light"}
            title="Colours of the chamber only. The job console stays dark."
            onClick={toggleTheme}
          >
            Light {theme === "light" ? "on" : "off"}
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
          <ChamberSpace />
          {/*
            The depths: a second layer the same size as the scene and moved by the same camera,
            but under the water's surface, and so under everything.
          */}
          <div className="chamber-scene chamber-depths" style={{ transform: camera.transform }}>
            {AGENTS.filter((agent) => !agent.at).map((agent) => (
              <AgentButton key={agent.id} agent={agent} moving={motion} onOpen={open} />
            ))}
          </div>
          <div className="chamber-surface" aria-hidden="true" />
          <h1 id="chamber-title">THE CHAMBER</h1>
          <div className="chamber-scene" style={{ transform: camera.transform }}>
            <ChamberScene />
            <Core moving={motion} open={coreOpen} onToggle={toggleCore} />
            <section
              className="chamber-core"
              id="chamber-core"
              aria-labelledby="chamber-core-title"
            >
              <h2 id="chamber-core-title">ORACLE / MASTER</h2>
              <p className="chamber-state">DORMANT</p>
              <p>No assistant yet. Nothing is running here.</p>
              {coreOpen ? (
                <dl className="chamber-status">
                  <dt>Master agent</dt>
                  <dd>Not built</dd>
                  <dt>Model connected</dt>
                  <dd>None</dd>
                  <dt>Figures with a function</dt>
                  <dd>
                    {WITH_A_FUNCTION} of {AGENTS.length}
                  </dd>
                  <dt>Ask Oracle</dt>
                  <dd>Not possible yet</dd>
                </dl>
              ) : null}
            </section>
            <ul className="chamber-agents" aria-label="Figures in the chamber">
              {AGENTS.filter((agent) => agent.at).map((agent) => (
                <li key={agent.id}>
                  <AgentButton agent={agent} moving={motion} onOpen={open} />
                </li>
              ))}
            </ul>
          </div>
          {/* One dotted line per figure, from the orb to it. Decoration, not a data link. */}
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
            {AGENTS.length} FIGURES / {WITH_A_FUNCTION} WITH A FUNCTION
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
