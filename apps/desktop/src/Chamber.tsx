import { useEffect, useRef, useState } from "react";
import App from "./App";
import ChamberScene, { EMPTY_PADS } from "./chamber/ChamberScene";
import { privateSprites } from "./chamber/privateSprites";
import { investigator, nightGlider, PixelSprite } from "./chamber/sprites";
import Icon from "./Icon";

type Place = "chamber" | "jobs";
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

type View = { scale: number; x: number; y: number };
const HOME: View = { scale: 1, x: 0, y: 0 };
const MIN_SCALE = 0.6;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.15;

/** Keeps the scene within reach: the further in, the further it may be dragged. */
function limited(view: View): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  const reach = 520 * scale;
  return {
    scale,
    x: Math.min(reach, Math.max(-reach, view.x)),
    y: Math.min(reach, Math.max(-reach, view.y)),
  };
}
/** Zooms about a point given relative to the centre of the space, so that point stays put. */
function zoomed(view: View, factor: number, px = 0, py = 0): View {
  // Rounded so repeated steps in and out return to exactly the starting size.
  const target = Math.round(view.scale * factor * 10000) / 10000;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, target));
  const ratio = scale / view.scale;
  return limited({ scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio });
}

/**
 * Hub shown after unlock. Only JOB.OS exists, so only its figure walks and can be opened. The
 * core and empty pads are labelled as inactive, and no motion here represents model activity.
 */
export default function Chamber({ onLock }: { onLock?: () => void }) {
  const [place, setPlace] = useState<Place>("chamber");
  const [jobsOpened, setJobsOpened] = useState(false);
  const [motion, setMotion] = useState(initialMotion);
  const [view, setView] = useState<View>(HOME);
  const [panning, setPanning] = useState(false);
  const space = useRef<HTMLElement>(null);
  const jobsNode = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);

  // The wheel zooms about the pointer. A native listener is needed to stop the page scrolling.
  useEffect(() => {
    const element = space.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      if (!element || event.deltaY === 0) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setView((current) =>
        zoomed(
          current,
          event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
          event.clientX - box.left - box.width / 2,
          event.clientY - box.top - box.height / 2,
        ),
      );
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  /** Holding the right mouse button drags the space; the left button still presses figures. */
  function startPan(event: React.MouseEvent) {
    if (event.button !== 2) return;
    event.preventDefault();
    const origin = { x: event.clientX - view.x, y: event.clientY - view.y };
    setPanning(true);
    function move(next: MouseEvent) {
      setView((current) =>
        limited({ ...current, x: next.clientX - origin.x, y: next.clientY - origin.y }),
      );
    }
    function stop() {
      setPanning(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  useEffect(() => {
    if (place === "chamber" && returning.current) jobsNode.current?.focus();
  }, [place]);

  return (
    <>
      <div className="chamber" hidden={place !== "chamber"} data-motion={motion ? "on" : "off"}>
        <header className="console-header">
          <div className="console-brand">
            <img src="/oracle.png" width="32" height="32" alt="" />
            <span>ORACLE</span>
            <small>THE CHAMBER</small>
          </div>
          <div className="header-actions">
            <button
              className="quiet-button"
              type="button"
              aria-label="Zoom out"
              disabled={view.scale <= MIN_SCALE}
              onClick={() => setView((current) => zoomed(current, 1 / ZOOM_STEP))}
            >
              −
            </button>
            <button
              className="quiet-button"
              type="button"
              aria-label="Zoom in"
              disabled={view.scale >= MAX_SCALE}
              onClick={() => setView((current) => zoomed(current, ZOOM_STEP))}
            >
              +
            </button>
            <button
              className="quiet-button"
              type="button"
              disabled={view.scale === 1 && view.x === 0 && view.y === 0}
              onClick={() => setView(HOME)}
            >
              Reset view
            </button>
            <button
              className="quiet-button"
              type="button"
              aria-pressed={motion}
              title="Decorative movement only. It does not show any activity."
              onClick={() => {
                const next = !motion;
                setMotion(next);
                try {
                  window.localStorage.setItem(MOTION_KEY, next ? "on" : "off");
                } catch {
                  // The choice still applies until Oracle is closed.
                }
              }}
            >
              Motion {motion ? "on" : "off"}
            </button>
            {onLock ? (
              <button className="quiet-button" type="button" onClick={onLock}>
                <Icon name="lock" />
                Lock Oracle
              </button>
            ) : null}
          </div>
        </header>
        {/* Mouse-only camera; the header buttons do the same by keyboard. */}
        <main
          className="chamber-void"
          aria-labelledby="chamber-title"
          ref={space}
          data-panning={panning}
          onMouseDown={startPan}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="chamber-space" aria-hidden="true">
            <div className="chamber-stars" />
            <div className="chamber-streaks" />
            {/* A figure that roams the whole space below the platform. Scenery: no agent behind it. */}
            <div className="chamber-roamer" data-slot="05">
              <span className="chamber-roamer-body">
                {privateSprites.slots["05"] ? (
                  <img className="chamber-figure" src={privateSprites.slots["05"]} alt="" />
                ) : (
                  <svg
                    className="chamber-figure"
                    viewBox="0 0 64 40"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <PixelSprite rows={nightGlider} scale={4} />
                  </svg>
                )}
              </span>
              <span className="chamber-code">05 / UNASSIGNED</span>
              <span className="chamber-detail">Figure only / no agent yet</span>
            </div>
          </div>
          <h1 id="chamber-title">THE CHAMBER</h1>
          <div
            className="chamber-scene"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            <ChamberScene
              {...(privateSprites.oracle ? { coreSprite: privateSprites.oracle } : {})}
              slotSprites={privateSprites.slots}
            />
            <section className="chamber-core" aria-labelledby="chamber-core-title">
              <h2 id="chamber-core-title">ORACLE / MASTER</h2>
              <p className="chamber-state">DORMANT</p>
              <p>No assistant yet. Nothing is running here.</p>
            </section>
            <ul className="chamber-nodes" aria-label="Agent slots">
              <li className="chamber-slot">
                <button
                  type="button"
                  className="chamber-agent"
                  ref={jobsNode}
                  aria-label="Open JOB.OS console"
                  onClick={() => {
                    setJobsOpened(true);
                    setPlace("jobs");
                  }}
                >
                  <span className="chamber-tag">
                    <span className="chamber-code">01 / JOB.OS</span>
                    <span className="chamber-detail">Job search / manual, no automation</span>
                  </span>
                  {privateSprites.jobOs ? (
                    <img className="chamber-figure" src={privateSprites.jobOs} alt="" />
                  ) : (
                    <svg
                      className="chamber-figure"
                      viewBox="0 0 36 54"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <PixelSprite
                        rows={investigator[0] ?? []}
                        scale={3}
                        className="chamber-step"
                      />
                      <PixelSprite
                        rows={investigator[1] ?? []}
                        scale={3}
                        className="chamber-step chamber-step-alternate"
                      />
                    </svg>
                  )}
                </button>
              </li>
              {EMPTY_PADS.map((pad) => (
                <li key={pad.slot} className="chamber-slot chamber-empty" data-slot={pad.slot}>
                  <span className="chamber-code">{pad.slot} / UNASSIGNED</span>
                  <span className="chamber-detail">Figure only / no agent yet</span>
                </li>
              ))}
            </ul>
          </div>
        </main>
        <footer className="console-footer">
          <span>
            <span className="status-dot" aria-hidden="true" />
            PRIVATE WORKSPACE
          </span>
          <span>1 MODULE / 4 FIGURES WITHOUT AN AGENT</span>
          <span>ORACLE / 00</span>
        </footer>
      </div>
      {/* Keep the console mounted after its first opening so drafts survive a return here. */}
      {jobsOpened && (
        <div hidden={place !== "jobs"}>
          <App
            active={place === "jobs"}
            {...(onLock ? { onLock } : {})}
            onChamber={() => {
              returning.current = true;
              setPlace("chamber");
            }}
          />
        </div>
      )}
    </>
  );
}
