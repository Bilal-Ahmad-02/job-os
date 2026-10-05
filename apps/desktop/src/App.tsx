import { useEffect, useRef, useState } from "react";
import Applications from "./Applications";
import Documents from "./Documents";
import { useBackendHealth } from "./hooks/useBackendHealth";
import Icon from "./Icon";
import Listings from "./Listings";
import ProfileWorkspace from "./ProfileWorkspace";
import ProviderSettings from "./ProviderSettings";
import ShellHeader from "./ShellHeader";
import SystemPanel from "./SystemPanel";
import Tasks from "./Tasks";

type View = "applications" | "documents" | "profile" | "tasks" | "providers" | "listings";
const views = {
  listings: {
    code: "06 / INGRESS",
    label: "Job listings",
    title: "LISTING.INTAKE",
    detail: "Pasted and hand-entered listings",
  },
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

export default function App({
  onLock,
  onChamber,
  active = true,
}: {
  onLock?: () => void;
  onChamber?: () => void;
  /** False while the console stays mounted behind the chamber. */
  active?: boolean;
}) {
  const [view, setView] = useState<View>("applications");
  const [profileOpened, setProfileOpened] = useState(false);
  const [tasksOpened, setTasksOpened] = useState(false);
  const [listingsOpened, setListingsOpened] = useState(false);
  const [listingRequest, setListingRequest] = useState<{ id: string; serial: number } | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const systemButton = useRef<HTMLButtonElement>(null);
  const chamberButton = useRef<HTMLButtonElement>(null);
  const health = useBackendHealth();
  useEffect(() => {
    if (active) chamberButton.current?.focus();
  }, [active]);
  return (
    <div className="console-shell">
      <ShellHeader caption="PERSONAL OPERATIONS" onLock={onLock}>
        {onChamber ? (
          <button
            className="quiet-button"
            type="button"
            aria-label="Return to the chamber"
            ref={chamberButton}
            onClick={onChamber}
          >
            <Icon name="back" />
            Chamber
          </button>
        ) : null}
        <button
          type="button"
          className="quiet-button"
          aria-label="System status"
          ref={systemButton}
          aria-expanded={systemOpen}
          aria-controls="system-panel"
          onClick={() => setSystemOpen(!systemOpen)}
        >
          SYSTEM
        </button>
      </ShellHeader>
      <nav className="module-navigation" aria-label="Workspace modules">
        {(["applications", "documents", "profile", "tasks", "providers", "listings"] as View[]).map(
          (key) => (
            <button
              key={key}
              type="button"
              aria-label={views[key].label}
              aria-current={view === key ? "page" : undefined}
              onClick={() => {
                setView(key);
                if (key === "profile") setProfileOpened(true);
                if (key === "tasks") setTasksOpened(true);
                if (key === "listings") setListingsOpened(true);
              }}
            >
              {views[key].code}
            </button>
          ),
        )}
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
            <Applications
              active={active && view === "applications"}
              onOpenListing={(id) => {
                setListingsOpened(true);
                setView("listings");
                setListingRequest((current) => ({ id, serial: (current?.serial ?? 0) + 1 }));
              }}
            />
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
          {listingsOpened && (
            <div hidden={view !== "listings"}>
              <Listings request={listingRequest} />
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
            : view === "listings"
              ? "INGRESS / MANUAL INTAKE ONLY"
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
