import { useBackendHealth } from "./hooks/useBackendHealth";

const connectionCopy = {
  checking: {
    label: "Checking connection",
    title: "Connecting to your workspace.",
    description: "Checking the local service on this computer.",
  },
  connected: {
    label: "Connected",
    title: "Your local service is ready.",
    description:
      "Oracle can reach the backend on this computer. Your desktop connection is working.",
  },
  unavailable: {
    label: "Unavailable",
    title: "The local service is unavailable.",
    description:
      "Start the Oracle backend, then try again. No connection to an external service is needed.",
  },
};

export default function App({ onLock }: { onLock?: () => void }) {
  const { state, lastChecked, refresh } = useBackendHealth();
  const copy = connectionCopy[state];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace">
        <div className="brand">
          <img src="/oracle.svg" width="38" height="38" alt="" />
          <span>Oracle</span>
        </div>
        <p className="sidebar-caption">PERSONAL WORKSPACE</p>
        <div className="current-view" aria-current="page">
          <span className="view-symbol" aria-hidden="true">
            ◫
          </span>
          Overview
        </div>
        <div className="sidebar-footer">
          <span className="local-dot" aria-hidden="true" />
          Runs on your computer
        </div>
      </aside>

      <main>
        <header className="page-header">
          <span>Workspace / Overview</span>
          {onLock ? (
            <button type="button" onClick={onLock}>
              Lock Oracle
            </button>
          ) : null}
        </header>

        <section className="workspace" aria-labelledby="workspace-title">
          <p className="eyebrow">A PLACE TO BEGIN</p>
          <h1 id="workspace-title">
            Your next chapter,
            <br />
            in one place.
          </h1>
          <p className="intro">
            A personal workspace for your job search. Built around you, starting here.
          </p>

          <section className="connection-card" aria-labelledby="connection-heading">
            <div className="card-heading">
              <h2 id="connection-heading">Backend connection</h2>
              <span className={`status-badge ${state}`}>
                <span className="status-dot" aria-hidden="true" />
                {copy.label}
              </span>
            </div>
            <div className="connection-copy" role="status" aria-live="polite" aria-atomic="true">
              <h3>{copy.title}</h3>
              <p>{copy.description}</p>
            </div>
            <div className="card-footer">
              <span className="last-checked">
                {state === "checking"
                  ? "Waiting for a response…"
                  : lastChecked
                    ? `Last checked ${lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Not checked yet"}
              </span>
              <button type="button" disabled={state === "checking"} onClick={() => void refresh()}>
                {state === "checking"
                  ? "Checking…"
                  : state === "unavailable"
                    ? "Try again"
                    : "Check again"}
                <span aria-hidden="true">↻</span>
              </button>
            </div>
          </section>

          <div className="workspace-note">
            <span className="note-line" aria-hidden="true" />
            <div>
              <h2>One step at a time.</h2>
              <p>
                This first version connects your desktop to its local service. Job tracking and AI
                assistance will follow.
              </p>
            </div>
          </div>
        </section>
        <footer className="page-footer">
          <span>ORACLE</span>
          <span>Personal by design.</span>
        </footer>
      </main>
    </div>
  );
}
