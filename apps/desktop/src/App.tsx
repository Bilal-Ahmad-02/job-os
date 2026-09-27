import Applications from "./Applications";
import Documents from "./Documents";
import { useBackendHealth } from "./hooks/useBackendHealth";
import Icon from "./Icon";
import OracleMark from "./OracleMark";

const connectionCopy = {
  checking: {
    label: "Checking connection",
    code: "PROBING",
    description: "Awaiting local service response.",
  },
  connected: { label: "Connected", code: "LINK.UP", description: "Local service responding." },
  unavailable: {
    label: "Unavailable",
    code: "NO.CARRIER",
    description: "Start the Oracle backend, then retry the link.",
  },
};

export default function App({ onLock }: { onLock?: () => void }) {
  const { state, lastChecked, refresh } = useBackendHealth();
  const copy = connectionCopy[state];
  return (
    <div className="console-shell">
      <header className="console-header">
        <div className="console-brand">
          <img src="/oracle.png" width="32" height="32" alt="" />
          <span>
            ORACLE<span className="brand-divider"> / </span>
            <small>OPERATOR TERMINAL</small>
          </span>
        </div>
        <span className="operator-id">{"OPERATOR // LOCAL"}</span>
        {onLock ? (
          <button className="seal-button" type="button" onClick={onLock} title="Lock Oracle">
            <Icon name="lock" />
            Lock Oracle
          </button>
        ) : null}
      </header>
      <aside className="module-rail" aria-label="Active module">
        <div className="rail-index">01</div>
        <div className="rail-module" aria-current="page" title="ACQ / Job application dossiers">
          <Icon name="applications" />
          <span>ACQ</span>
        </div>
        <span className="rail-track" aria-hidden="true" />
        <span className="rail-coordinate">JOB.OS / ACQUISITION</span>
      </aside>
      <main className="console-main">
        <section className="operations-pane" aria-labelledby="workspace-title">
          <header className="sector-heading">
            <div>
              <p className="eyebrow">SECTOR.01 / JOB.OS</p>
              <h1 id="workspace-title">
                ACQUISITION
                <span className="sector-cursor" aria-hidden="true">
                  _
                </span>
              </h1>
            </div>
            <span className="sector-stamp">
              PRIVATE
              <br />
              DOSSIER TERMINAL
            </span>
          </header>
          <Documents />
          <Applications />
        </section>
        <aside className="core-pane" aria-label="Oracle system console">
          <div className="panel-caption">
            <span>O / CORE</span>
            <span>LOCAL</span>
          </div>
          <OracleMark />
          <div className="core-identity">
            <strong>ORACLE</strong>
            <span>PERSONAL OPERATIONS INTERFACE</span>
          </div>
          <dl className="system-registers">
            <div>
              <dt>HOST</dt>
              <dd>THIS MACHINE</dd>
            </div>
            <div>
              <dt>CONTROL</dt>
              <dd>MANUAL</dd>
            </div>
            <div>
              <dt>AI MODEL</dt>
              <dd>NOT CONNECTED</dd>
            </div>
            <div>
              <dt>DOMAIN</dt>
              <dd>JOB.OS</dd>
            </div>
          </dl>
          <section className="link-panel" aria-labelledby="connection-heading">
            <div className="panel-caption">
              <h2 id="connection-heading">LINK / BACKEND</h2>
              <span className={`link-code ${state}`}>{copy.code}</span>
            </div>
            <p className={`status-badge ${state}`}>
              <span className="status-dot" aria-hidden="true" />
              {copy.label}
            </p>
            <p className="link-copy" role="status" aria-live="polite" aria-atomic="true">
              {copy.description}
            </p>
            <div className="link-actions">
              <span className="last-checked">
                {lastChecked
                  ? lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "--:--"}
              </span>
              <button type="button" disabled={state === "checking"} onClick={() => void refresh()}>
                <Icon name="refresh" />
                {state === "checking"
                  ? "Checking…"
                  : state === "unavailable"
                    ? "Try again"
                    : "Check again"}
              </button>
            </div>
          </section>
          <details className="console-lexicon">
            <summary>PROTOCOL / KEY</summary>
            <dl>
              <div>
                <dt>ACQ</dt>
                <dd>Job operations</dd>
              </div>
              <div>
                <dt>DOSSIER</dt>
                <dd>Application record</dd>
              </div>
              <div>
                <dt>INGRESS</dt>
                <dd>Source and discovery</dd>
              </div>
              <div>
                <dt>TRACE</dt>
                <dd>Original imported evidence</dd>
              </div>
            </dl>
            <p>
              <kbd>Ctrl</kbd> + <kbd>K</kbd> focuses the dossier query when the index is open.
            </p>
          </details>
        </aside>
      </main>
      <footer className="console-footer">
        <span>
          <span className="status-dot" aria-hidden="true" />
          LOCAL WORKSPACE
        </span>
        <span>ACQ / RECORDS STAY ON THIS MACHINE</span>
        <span>{"ORACLE // 01"}</span>
      </footer>
    </div>
  );
}
