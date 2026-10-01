import { useRef, useState } from "react";
import Applications from "./Applications";
import Documents from "./Documents";
import { useBackendHealth } from "./hooks/useBackendHealth";
import Icon from "./Icon";
import ProfileWorkspace from "./ProfileWorkspace";
import ProviderSettings from "./ProviderSettings";
import SystemPanel from "./SystemPanel";
import Tasks from "./Tasks";

type View = "applications" | "documents" | "profile" | "tasks" | "providers";
const views = {
  providers: {
    code: "05 / CONTROL",
    label: "Provider settings",
    title: "CONNECTION.CONTROL",
    detail: "Credentials / explicit permission",
  },
  tasks: {
    code: "04 / TASKS",
    label: "Background tasks",
    title: "TASK.CONTROL",
    detail: "Local work / explicit authority",
  },
  applications: {
    code: "01 / ACQ",
    label: "Applications",
    title: "ACQUISITION",
    detail: "Your application dossiers",
  },
  documents: {
    code: "02 / VAULT",
    label: "Source documents",
    title: "SOURCE.VAULT",
    detail: "Originals and evidence",
  },
  profile: {
    code: "03 / IDENTITY",
    label: "Profile review",
    title: "IDENTITY.CORE",
    detail: "Saved profile / source review",
  },
} as const;
const linkCode = { checking: "PROBING", connected: "LINK.UP", unavailable: "NO.CARRIER" };

export default function App({ onLock }: { onLock?: () => void }) {
  const [view, setView] = useState<View>("applications");
  const [profileOpened, setProfileOpened] = useState(false);
  const [tasksOpened, setTasksOpened] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const systemButton = useRef<HTMLButtonElement>(null);
  const health = useBackendHealth();
  return (
    <div className="console-shell">
      <header className="console-header">
        <div className="console-brand">
          <img src="/oracle.png" width="32" height="32" alt="" />
          <span>ORACLE</span>
          <small>PERSONAL OPERATIONS</small>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="quiet-button"
            aria-label="System status"
            ref={systemButton}
            aria-expanded={systemOpen}
            aria-controls="system-panel"
            onClick={() => setSystemOpen(!systemOpen)}
          >
            <span className={`status-dot ${health.state}`} aria-hidden="true" />
            {linkCode[health.state]}
          </button>
          {onLock ? (
            <button className="quiet-button" type="button" onClick={onLock}>
              <Icon name="lock" />
              Lock Oracle
            </button>
          ) : null}
        </div>
      </header>
      <nav className="module-navigation" aria-label="Workspace modules">
        {(["applications", "documents", "profile", "tasks", "providers"] as View[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-label={views[key].label}
            aria-current={view === key ? "page" : undefined}
            onClick={() => {
              setView(key);
              if (key === "profile") setProfileOpened(true);
              if (key === "tasks") setTasksOpened(true);
            }}
          >
            {views[key].code}
          </button>
        ))}
        <span className="module-caption">JOB.OS / LOCAL</span>
      </nav>
      <main className="console-main" data-system-open={systemOpen}>
        <section className="operations-pane" aria-labelledby="workspace-title">
          <header className="sector-heading">
            <div>
              <p className="eyebrow">{views[view].detail}</p>
              <h1 id="workspace-title">
                {views[view].title}
                <span className="sector-cursor" aria-hidden="true">
                  _
                </span>
              </h1>
            </div>
            <span className="sector-stamp">OPERATOR / LOCAL</span>
          </header>
          {/* Keep drafts in memory when changing modules; locking unmounts the workspace. */}
          <div hidden={view !== "applications"}>
            <Applications active={view === "applications"} />
          </div>
          {profileOpened && (
            <div hidden={view !== "profile"}>
              <ProfileWorkspace />
            </div>
          )}
          {tasksOpened && (
            <div hidden={view !== "tasks"}>
              <Tasks />
            </div>
          )}
          {view === "providers" && <ProviderSettings />}
          <div hidden={view !== "documents"}>
            <Documents />
          </div>
        </section>
        {systemOpen ? (
          <SystemPanel
            health={health}
            onClose={() => {
              setSystemOpen(false);
              systemButton.current?.focus();
            }}
          />
        ) : null}
      </main>
      <footer className="console-footer">
        <span>
          <span className="status-dot" aria-hidden="true" />
          PRIVATE WORKSPACE
        </span>
        <span>
          {view === "applications"
            ? "CTRL K / QUERY INDEX"
            : view === "tasks"
              ? "TASKS / COOPERATIVE EXECUTION"
              : view === "providers"
                ? "CONNECTIONS / EXPLICIT PERMISSION"
                : view === "profile"
                  ? "EVIDENCE / OWNER REVIEW"
                  : "SOURCE MATERIAL / UNREVIEWED"}
        </span>
        <span>ORACLE / 01</span>
      </footer>
    </div>
  );
}
