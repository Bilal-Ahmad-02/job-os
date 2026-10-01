import { invoke } from "@tauri-apps/api/core";
import { type FormEvent, useEffect, useRef, useState } from "react";
import App from "./App";
import RotationDial, { validSequence } from "./RotationDial";

type Status = "loading" | "setup" | "locked" | "unlocked" | "error";
type Panel = "seal" | "password" | "offer" | "enroll" | "confirm";
const safeErrors = new Set([
  "Password created, but workspace setup failed. Close and reopen Oracle to check recovery.",
  "Oracle cannot read its password settings. Access remains locked.",
  "Please wait up to 30 seconds before trying again.",
  "Incorrect password. Wait a moment and try again.",
  "Use 15 to 128 characters for your Oracle password.",
  "A password is already configured.",
  "Sequence not recognized. Wait a moment and try again.",
  "Use 4 to 8 alternating turns, each 1 to 24 stops.",
  "The rotation sequences do not match.",
]);

export default function AccessGate() {
  const [status, setStatus] = useState<Status>("loading");
  const [panel, setPanel] = useState<Panel>("seal");
  const [configured, setConfigured] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<number[]>([]);
  const [first, setFirst] = useState<number[]>([]);
  const [dialKey, setDialKey] = useState(0);

  function resetDial() {
    setSteps([]);
    setDialKey((key) => key + 1);
  }
  function failure(value: unknown) {
    setError(
      typeof value === "string" && safeErrors.has(value)
        ? value
        : "Oracle could not unlock. Close the app and try again.",
    );
  }
  async function openWorkspace() {
    await invoke("shell_mode", { workspace: true });
    setStatus("unlocked");
    setFirst([]);
    resetDial();
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const value = await invoke<unknown>("auth_status");
        if (!active) return;
        if (value !== "setup" && value !== "locked" && value !== "unlocked") {
          setStatus("error");
          return;
        }
        if (value === "unlocked") {
          await invoke("shell_mode", { workspace: true });
          if (active) setStatus("unlocked");
          return;
        }
        // A damaged dial credential must not prevent password recovery.
        const rotation = await invoke<unknown>("rotation_status").catch(() => false);
        if (active) {
          setConfigured(rotation === true);
          setStatus(value);
        }
      } catch {
        if (active) setStatus("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function run(operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (value) {
      failure(value);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "setup" && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    const submitted = password;
    setPassword("");
    setConfirmation("");
    await run(async () => {
      await invoke(status === "setup" ? "create_password" : "unlock", { password: submitted });
      setStatus("locked");
      if (configured) await openWorkspace();
      else setPanel("offer");
    });
  }
  async function submitRotation() {
    await run(async () => {
      const submitted = steps;
      resetDial();
      if (panel === "enroll") {
        setFirst(submitted);
        setPanel("confirm");
        return;
      }
      if (panel === "confirm") {
        await invoke("enroll_rotation", { steps: first, confirmation: submitted });
        setConfigured(true);
        setFirst([]);
        await invoke("lock");
        setStatus("locked");
        setPanel("seal");
        return;
      }
      await invoke("unlock_rotation", { steps: submitted });
      await openWorkspace();
    });
  }
  async function lock() {
    setStatus("loading");
    setError("");
    setPanel("seal");
    resetDial();
    setFirst([]);
    try {
      await invoke("lock");
      await invoke("shell_mode", { workspace: false });
      setStatus("locked");
    } catch {
      setStatus("error");
    }
  }
  function action(action: "close" | "minimize" | "drag") {
    void invoke("shell_action", { action }).catch(() =>
      setError("Window control unavailable. Use Alt+F4 to close Oracle."),
    );
  }
  if (status === "unlocked") return <App onLock={() => void lock()} />;
  const passwordPanel = panel === "password" || status === "setup";
  const enrolling = panel === "enroll" || panel === "confirm";
  return (
    <main className="seal-page" aria-label="Oracle access console">
      <div className="seal-rim" aria-hidden="true" />
      <header className="seal-header">
        <button
          className="seal-handle"
          type="button"
          aria-label="Move Oracle"
          onPointerDown={(event) => {
            if (event.button === 0) action("drag");
          }}
        >
          ORACLE
        </button>
        <div className="seal-window-controls">
          <button type="button" aria-label="Minimize Oracle" onClick={() => action("minimize")}>
            −
          </button>
          <button type="button" aria-label="Close Oracle" onClick={() => action("close")}>
            ×
          </button>
        </div>
      </header>
      <section
        className={`seal-content ${passwordPanel ? "seal-recovery" : ""}`}
        aria-labelledby="seal-title"
      >
        <h1 id="seal-title">
          {passwordPanel
            ? status === "setup"
              ? "RECOVERY / INITIALIZE"
              : "RECOVERY / PASSWORD"
            : enrolling
              ? panel === "confirm"
                ? "REPEAT YOUR SEQUENCE"
                : "DEFINE YOUR SEQUENCE"
              : panel === "offer"
                ? "ROTATION / ENROLL"
                : "ACCESS.SEALED"}
        </h1>
        {status === "loading" ? (
          <p role="status">Checking access…</p>
        ) : status === "error" ? (
          <p role="alert">
            Oracle cannot read its password settings. Access remains locked. Close the app and check
            your local setup.
          </p>
        ) : passwordPanel ? (
          <form onSubmit={(event) => void submitPassword(event)}>
            <p>
              {status === "setup"
                ? "Keep this recovery password in your password manager."
                : "Your existing Oracle password opens the recovery path."}
            </p>
            <label htmlFor="password">{status === "setup" ? "Create password" : "Password"}</label>
            <input
              id="password"
              type="password"
              autoComplete={status === "setup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={15}
              maxLength={256}
              disabled={busy}
            />
            {status === "setup" && (
              <>
                <label htmlFor="confirmation">Confirm password</label>
                <input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  maxLength={256}
                  disabled={busy}
                />
              </>
            )}
            <button type="submit" disabled={busy}>
              {busy
                ? "Verifying…"
                : status === "setup"
                  ? "Create recovery password"
                  : "Unlock Oracle"}
            </button>
            {status !== "setup" && (
              <button
                type="button"
                className="seal-link"
                disabled={busy}
                onClick={() => {
                  setPassword("");
                  setPanel("seal");
                  setError("");
                }}
              >
                Return to seal
              </button>
            )}
          </form>
        ) : panel === "offer" ? (
          <div className="seal-offer">
            <p>
              Choose 4–8 alternating turns. Each turn can travel 1–24 stops; a full revolution is
              12.
            </p>
            <p>Repeat the sequence to save it. Your password remains the recovery route.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                resetDial();
                setPanel("enroll");
              }}
            >
              Set rotation key
            </button>
            <button
              type="button"
              className="seal-link"
              disabled={busy}
              onClick={() => void run(openWorkspace)}
            >
              Set up later / open workspace
            </button>
          </div>
        ) : (
          <>
            <RotationDial
              key={dialKey}
              disabled={busy || (!configured && !enrolling)}
              onChange={setSteps}
            />
            <div className="seal-dial-actions">
              {configured || enrolling ? (
                <>
                  <button
                    type="button"
                    disabled={busy || !validSequence(steps)}
                    onClick={() => void submitRotation()}
                  >
                    {busy
                      ? "Verifying…"
                      : panel === "enroll"
                        ? "Record sequence"
                        : panel === "confirm"
                          ? "Save rotation key"
                          : "Unseal"}
                  </button>
                  <button
                    type="button"
                    className="seal-link"
                    disabled={busy}
                    onClick={() => {
                      resetDial();
                      setError("");
                    }}
                  >
                    Clear turns
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setPanel("password")}>
                  Initialize rotation key
                </button>
              )}
            </div>
            {enrolling ? (
              <button
                type="button"
                className="seal-link"
                disabled={busy}
                onClick={() => {
                  setFirst([]);
                  resetDial();
                  setPanel("offer");
                  setError("");
                }}
              >
                Cancel setup
              </button>
            ) : (
              <button
                type="button"
                className="seal-link"
                disabled={busy}
                onClick={() => {
                  resetDial();
                  setError("");
                  setPanel("password");
                }}
              >
                Password recovery
              </button>
            )}
          </>
        )}
        {error && (
          <p className="seal-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <footer className="seal-footer">PERSONAL / LOCAL</footer>
    </main>
  );
}
