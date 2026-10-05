import { useEffect, useRef, useState } from "react";
import App from "./App";
import ChamberScene, { EMPTY_PADS } from "./chamber/ChamberScene";
import { investigator, PixelSprite } from "./chamber/sprites";
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

/**
 * Hub shown after unlock. Only JOB.OS exists, so only its figure walks and can be opened. The
 * core and empty pads are labelled as inactive, and no motion here represents model activity.
 */
export default function Chamber({ onLock }: { onLock?: () => void }) {
  const [place, setPlace] = useState<Place>("chamber");
  const [jobsOpened, setJobsOpened] = useState(false);
  const [motion, setMotion] = useState(initialMotion);
  const jobsNode = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);

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
        <main className="chamber-void" aria-labelledby="chamber-title">
          <div className="chamber-space" aria-hidden="true">
            <div className="chamber-stars" />
            <div className="chamber-streaks" />
          </div>
          <h1 id="chamber-title">THE CHAMBER</h1>
          <div className="chamber-scene">
            <ChamberScene />
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
                  <svg viewBox="0 0 36 54" aria-hidden="true" focusable="false">
                    <PixelSprite rows={investigator[0] ?? []} scale={3} className="chamber-step" />
                    <PixelSprite
                      rows={investigator[1] ?? []}
                      scale={3}
                      className="chamber-step chamber-step-alternate"
                    />
                  </svg>
                </button>
              </li>
              {EMPTY_PADS.map((pad) => (
                <li key={pad.slot} className="chamber-slot chamber-empty" data-slot={pad.slot}>
                  <span className="chamber-code">{pad.slot} / UNASSIGNED</span>
                  <span className="chamber-detail">Empty slot</span>
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
          <span>1 MODULE / 3 EMPTY SLOTS</span>
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
