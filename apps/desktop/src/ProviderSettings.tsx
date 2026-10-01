import { useEffect, useRef, useState } from "react";
import {
  getProvider,
  type ProviderStatus,
  providerError,
  testProvider,
  updateProvider,
} from "./api/providers";

export default function ProviderSettings() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [tested, setTested] = useState(false);
  const [reconcile, setReconcile] = useState(false);
  const alive = useRef(false);
  const admitted = useRef(false);
  useEffect(() => {
    let active = true;
    alive.current = true;
    getProvider()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((failure: unknown) => {
        if (active) setError(providerError(failure));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, []);

  async function perform(operation: () => Promise<void>) {
    if (admitted.current) return;
    admitted.current = true;
    setBusy(true);
    setError("");
    setTested(false);
    try {
      await operation();
    } catch (failure) {
      if (alive.current) {
        setError(providerError(failure));
        setReconcile(true);
      }
    } finally {
      admitted.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function change(action: "enter_key" | "remove_key" | "permission", allowed?: boolean) {
    if (!status || reconcile) return;
    void perform(async () => {
      const next = await updateProvider(status, action, allowed);
      if (alive.current) setStatus(next);
    });
  }
  return (
    <section className="provider-workspace" aria-label="Provider settings">
      <header className="review-toolbar">
        <div>
          <p className="eyebrow">CONTROL / EXTERNAL CONNECTIONS</p>
          <h2>OPENAI / CONNECTION SETUP</h2>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              const next = await getProvider();
              if (alive.current) {
                setStatus(next);
                setReconcile(false);
              }
            })
          }
        >
          Refresh settings
        </button>
      </header>
      <p>
        Prepare a connection without enabling AI tasks. Your profile, PDFs, application history and
        extracted text are not accessible to this connection check.
      </p>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {reconcile && (
        <p>
          Refresh to confirm the saved state. Oracle has not automatically retried the operation.
        </p>
      )}
      {status && (
        <>
          <dl className="system-registers">
            <div>
              <dt>Credential</dt>
              <dd>
                {status.key_present ? "Saved in Windows Credential Manager" : "No API key saved"}
              </dd>
            </div>
            <div>
              <dt>Record access</dt>
              <dd>None</dd>
            </div>
            <div>
              <dt>AI execution</dt>
              <dd>Not enabled</dd>
            </div>
          </dl>
          <fieldset disabled={busy || reconcile} className="provider-controls">
            <legend>Windows credential vault</legend>
            <p>
              The key is entered in a Windows dialog and is never returned to this interface. Use
              the API key in its password field, not your Oracle or Windows password. Finish or
              cancel that dialog before locking Oracle.
            </p>
            <div className="review-actions">
              <button type="button" onClick={() => change("enter_key")}>
                {status.key_present ? "Replace API key in Windows" : "Add API key in Windows"}
              </button>
              <button
                type="button"
                disabled={!status.key_present}
                onClick={() => change("remove_key")}
              >
                Remove saved key
              </button>
            </div>
            <p className="field-hint">
              Replacing or removing a key disables connection permission. Removing it here does not
              revoke it at OpenAI. Keys are not included in Oracle backups; keep your own recovery
              copy.
            </p>
          </fieldset>
          <fieldset
            disabled={busy || reconcile || !status.key_present}
            className="provider-controls"
          >
            <legend>Connection permission</legend>
            <label className="task-source">
              <input
                type="checkbox"
                checked={status.connection_tests_allowed}
                onChange={(event) => change("permission", event.target.checked)}
              />
              Allow manual connection checks to OpenAI
            </label>
            <p>
              Only “Test connection” contacts api.openai.com. It sends the saved API key and normal
              network metadata to list available models. It sends no prompt or private records and
              does not generate content. No automatic checks or retries.
            </p>
            <button
              type="button"
              disabled={!status.connection_tests_allowed}
              onClick={() =>
                void perform(async () => {
                  await testProvider(status);
                  if (alive.current) setTested(true);
                })
              }
            >
              Test connection
            </button>
          </fieldset>
          <p role="status">
            {busy
              ? "Working — waiting for the native operation."
              : tested
                ? "Connection verified for this saved configuration. AI tasks remain disabled."
                : "No connection test confirmed in this view."}
          </p>
        </>
      )}
    </section>
  );
}
