import type { useBackendHealth } from "./hooks/useBackendHealth";
import Icon from "./Icon";

const connectionCopy = {
  checking: { label: "Checking connection", description: "Awaiting local service response." },
  connected: { label: "Connected", description: "Local health service responding." },
  unavailable: {
    label: "Unavailable",
    description:
      "Start the Oracle health service, then retry. Your local records use a separate connection.",
  },
};

export default function SystemPanel({
  health,
  onClose,
}: {
  health: ReturnType<typeof useBackendHealth>;
  onClose: () => void;
}) {
  const { state, lastChecked, refresh } = health;
  const copy = connectionCopy[state];
  return (
    <aside className="system-panel" id="system-panel" aria-label="Oracle system console">
      <div className="panel-heading">
        <h2>SYSTEM / STATUS</h2>
        <button type="button" className="quiet-button" onClick={onClose}>
          Close system
        </button>
      </div>
      <p className="eyebrow">LOCAL OPERATIONS</p>
      <dl className="system-registers">
        <div>
          <dt>Control</dt>
          <dd>Manual</dd>
        </div>
        <div>
          <dt>AI model</dt>
          <dd>Not connected</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>This computer</dd>
        </div>
      </dl>
      <section className="link-panel" aria-labelledby="connection-heading">
        <h3 id="connection-heading">HEALTH / BACKEND</h3>
        <p className={`status-badge ${state}`}>
          <span className="status-dot" aria-hidden="true" />
          {copy.label}
        </p>
        <p className="input-help" role="status" aria-live="polite">
          {copy.description}
        </p>
        <div className="link-actions">
          <span className="last-checked">
            {lastChecked
              ? lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Not checked"}
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
      <section className="console-lexicon" aria-labelledby="protocol-heading">
        <h3 id="protocol-heading">PROTOCOL / KEY</h3>
        <dl>
          <div>
            <dt>ACQ</dt>
            <dd>Application dossiers</dd>
          </div>
          <div>
            <dt>VAULT</dt>
            <dd>Original source documents</dd>
          </div>
          <div>
            <dt>TRACE</dt>
            <dd>Preserved spreadsheet evidence</dd>
          </div>
        </dl>
        <p>
          <kbd>Ctrl K</kbd> focuses the query when the dossier index is active.
        </p>
      </section>
    </aside>
  );
}
