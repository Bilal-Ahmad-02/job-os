import { invoke } from "@tauri-apps/api/core";
import { type FormEvent, useEffect, useState } from "react";
import App from "./App";
import Icon from "./Icon";
import OracleMark from "./OracleMark";

type Status = "loading" | "setup" | "locked" | "unlocked" | "error";

const safeErrors = new Set([
  "Password created, but workspace setup failed. Close and reopen Oracle to check recovery.",
  "Oracle cannot read its password settings. Access remains locked.",
  "Please wait up to 30 seconds before trying again.",
  "Incorrect password. Wait a moment and try again.",
  "Use 15 to 128 characters for your Oracle password.",
  "A password is already configured.",
]);

export default function AccessGate() {
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    invoke<unknown>("auth_status")
      .then((value) => {
        if (!active) return;
        if (value === "setup" || value === "locked" || value === "unlocked") setStatus(value);
        else setStatus("error");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (status === "setup" && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const submitted = password;
    setPassword("");
    setConfirmation("");
    try {
      await invoke(status === "setup" ? "create_password" : "unlock", { password: submitted });
      setStatus("unlocked");
    } catch (failure) {
      setError(
        typeof failure === "string" && safeErrors.has(failure)
          ? failure
          : "Oracle could not unlock. Close the app and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setStatus("loading");
    setError("");
    try {
      await invoke("lock");
      setStatus("locked");
    } catch {
      setStatus("error");
    }
  }

  if (status === "unlocked") return <App onLock={() => void lock()} />;

  return (
    <main className="access-page">
      <div className="access-identity" aria-hidden="true">
        <p className="eyebrow">LOCAL / PERSONAL OPERATIONS</p>
        <OracleMark />
        <div className="access-wordmark">
          ORACLE<span>OPERATOR INTERFACE / 01</span>
        </div>
      </div>
      <section className="access-card" aria-labelledby="access-title">
        <div className="brand">
          <img src="/oracle.png" width="38" height="38" alt="" />
          <span>Oracle</span>
        </div>
        <p className="eyebrow">IDENT / OPERATOR</p>
        <h1 id="access-title">{status === "setup" ? "INITIALIZE_" : "ACCESS.SEALED"}</h1>
        {status === "loading" ? (
          <p role="status">Checking access…</p>
        ) : status === "error" ? (
          <p role="alert">
            Oracle cannot read its password settings. Access remains locked. Close the app and check
            your local setup.
          </p>
        ) : (
          <>
            <p className="access-description">
              {status === "setup"
                ? "Create a password to open Oracle. Keep it in your password manager; there is no email recovery."
                : "Enter your Oracle password to continue."}
            </p>
            <form onSubmit={(event) => void submit(event)}>
              <label htmlFor="password">
                {status === "setup" ? "Create password" : "Password"}
              </label>
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
                aria-describedby="password-help"
              />
              <p id="password-help" className="input-help">
                Use 15–128 characters. A long, unique passphrase works well.
              </p>
              {status === "setup" ? (
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
              ) : null}
              {error ? (
                <p className="access-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={busy}>
                <Icon name="lock" />
                {busy
                  ? "Please wait…"
                  : status === "setup"
                    ? "Create password & open Oracle"
                    : "Unlock Oracle"}
              </button>
            </form>
            <p className="access-footnote">
              Your password stays on this computer. Oracle locks when you close the app.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
