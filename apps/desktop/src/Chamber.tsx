import { useEffect, useRef, useState } from "react";
import App from "./App";
import Icon from "./Icon";
import OracleMark from "./OracleMark";

type Place = "chamber" | "jobs";
const emptySlots = ["02", "03", "04"];

/**
 * Hub shown after unlock. Only JOB.OS exists; the core and empty slots are labelled as inactive
 * and never represent model activity.
 */
export default function Chamber({ onLock }: { onLock?: () => void }) {
  const [place, setPlace] = useState<Place>("chamber");
  const [jobsOpened, setJobsOpened] = useState(false);
  const jobsNode = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);

  useEffect(() => {
    if (place === "chamber" && returning.current) jobsNode.current?.focus();
  }, [place]);

  return (
    <>
      <div className="chamber" hidden={place !== "chamber"}>
        <header className="console-header">
          <div className="console-brand">
            <img src="/oracle.png" width="32" height="32" alt="" />
            <span>ORACLE</span>
            <small>THE CHAMBER</small>
          </div>
          {onLock ? (
            <div className="header-actions">
              <button className="quiet-button" type="button" onClick={onLock}>
                <Icon name="lock" />
                Lock Oracle
              </button>
            </div>
          ) : null}
        </header>
        <main className="chamber-void" aria-labelledby="chamber-title">
          <div className="chamber-floor" aria-hidden="true">
            <div className="chamber-grid" />
          </div>
          <h1 id="chamber-title">THE CHAMBER</h1>
          <div className="chamber-board">
            <section className="chamber-core" aria-labelledby="chamber-core-title">
              <OracleMark />
              <h2 id="chamber-core-title">ORACLE / MASTER</h2>
              <p className="chamber-state">DORMANT</p>
              <p>No assistant yet. Nothing is running here.</p>
            </section>
            <ul className="chamber-nodes" aria-label="Agent slots">
              <li className="chamber-slot" data-slot="01">
                <button
                  type="button"
                  className="chamber-node"
                  ref={jobsNode}
                  aria-label="Open JOB.OS console"
                  onClick={() => {
                    setJobsOpened(true);
                    setPlace("jobs");
                  }}
                >
                  <span className="chamber-code">01 / JOB.OS</span>
                  <span className="chamber-name">Job search</span>
                  <span className="chamber-detail">Manual console / no automation</span>
                  <span className="chamber-enter">ENTER</span>
                </button>
              </li>
              {emptySlots.map((slot) => (
                <li key={slot} className="chamber-slot chamber-empty" data-slot={slot}>
                  <span className="chamber-code">{slot} / UNASSIGNED</span>
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
