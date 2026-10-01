import { useEffect, useState } from "react";
import { type DocumentSummary, listDocuments } from "./api/documents";
import {
  type Entry,
  getReview,
  type ReviewState,
  saveReview,
  singleCandidate,
  targetValue,
} from "./api/profile";
import EntryFields, { entryLabel, ReadValue } from "./profile/EntryFields";

export default function ProfileReview({
  refresh = 0,
  onSaved,
}: {
  refresh?: number;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [edits, setEdits] = useState<Record<string, string | Entry>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload intentionally starts a fresh request with cleanup.
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    Promise.all([getReview(), listDocuments()])
      .then(([result, sources]) => {
        if (!active) return;
        setState(result);
        setDocuments(sources);
        setSelected((current) => current || result.draft?.payload.evidence[0]?.target || "");
      })
      .catch(() => {
        if (active)
          setError(
            "Oracle could not load the review workspace. Retry when the local workspace is available.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [reload, refresh]);
  const draft = state?.draft;
  const evidence = draft?.payload.evidence.find((item) => item.target === selected);
  const original = draft ? targetValue(draft.payload.data, selected) : undefined;
  const approved = state ? targetValue(state.profile.data, selected) : undefined;
  const decision = state?.decisions.find((item) => item.target === selected)?.decision;
  const value = edits[selected] ?? (decision === "approved" ? approved : original) ?? original;
  const dirty = Object.hasOwn(edits, selected);
  const remaining = draft ? draft.payload.evidence.length - (state?.decisions.length ?? 0) : 0;
  async function decide(next: "approved" | "rejected") {
    if (!state || value === undefined || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    let corrected = value;
    if (typeof corrected !== "string" && Array.isArray(corrected.technologies)) {
      corrected = {
        ...corrected,
        technologies: corrected.technologies.map((item) => item.trim()).filter(Boolean),
      };
    }
    try {
      const result = await saveReview(
        state,
        selected,
        next,
        next === "approved" ? singleCandidate(selected, corrected) : null,
      );
      setState(result);
      onSaved?.();
      setEdits((current) => {
        const copy = { ...current };
        delete copy[selected];
        return copy;
      });
      setNotice(
        next === "approved"
          ? "Entry approved and saved to your profile. Source evidence remains unchanged."
          : "Entry rejected. It was not added to your profile.",
      );
    } catch (reason) {
      setError(
        reason === "This entry changed. Reload it before saving again."
          ? "The workspace changed. Reload latest state, compare the saved value, then retry. Your correction stays here."
          : "The decision could not be saved. Check required fields, dates, completion status, and field limits. Your correction stays here; reload latest state before retrying if the connection was interrupted.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile-review" aria-label="Candidate evidence review" aria-busy={busy}>
      <header className="review-toolbar">
        <div>
          <p className="eyebrow">OWNER VALIDATION / HUMAN AUTHORITY</p>
          <p>
            Approve only what Oracle should use. Approval records your decision; it does not verify
            a credential.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setNotice("");
            setReload((n) => n + 1);
          }}
        >
          Reload latest state
        </button>
      </header>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!state && !error && <p role="status">Loading private evidence…</p>}
      {state && !draft && (
        <p>No profile draft is available. Import source evidence before reviewing entries.</p>
      )}
      {draft && state && (
        <>
          <div className="index-readout">
            <span>
              UNREVIEWED <strong>{remaining}</strong>
            </span>
            <span>
              APPROVED{" "}
              <strong>
                {state.decisions.filter((item) => item.decision === "approved").length}
              </strong>
            </span>
            <span>PROFILE REV / {state.profile.version}</span>
          </div>
          <details className="review-warnings">
            <summary>Extraction limits and review notes ({draft.payload.warnings.length})</summary>
            <ul>
              {draft.payload.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
          <div className="review-layout">
            <nav className="review-index" aria-label="Draft entries">
              {draft.payload.evidence.map((item, index) => {
                const itemValue = targetValue(draft.payload.data, item.target);
                const status =
                  state.decisions.find((entry) => entry.target === item.target)?.decision ??
                  "unreviewed";
                return (
                  <button
                    type="button"
                    key={item.target}
                    disabled={busy}
                    aria-current={selected === item.target ? "true" : undefined}
                    onClick={() => {
                      setSelected(item.target);
                      setNotice("");
                    }}
                  >
                    <span className="review-sequence">
                      {String(index + 1).padStart(2, "0")} /{" "}
                      {(item.target.split("/")[0] ?? "").replaceAll("_", " ")}
                    </span>
                    <strong>{itemValue === undefined ? "Entry" : entryLabel(itemValue)}</strong>
                    <small>
                      {Object.hasOwn(edits, item.target)
                        ? "UNSAVED CORRECTION"
                        : status.toUpperCase()}
                    </small>
                  </button>
                );
              })}
            </nav>
            {evidence && value !== undefined && original !== undefined && (
              <div className="review-detail">
                <div className="review-title">
                  <div>
                    <p className="eyebrow">{decision ?? "unreviewed"}</p>
                    <h2>{entryLabel(original)}</h2>
                  </div>
                  <span>{dirty ? "LOCAL CHANGES" : "SOURCE LINKED"}</span>
                </div>
                {evidence.notes.length > 0 && (
                  <ul className="entry-cautions">
                    {evidence.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
                <div className="review-comparison">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void decide("approved");
                    }}
                  >
                    <fieldset disabled={busy}>
                      <legend>Corrected profile entry</legend>
                      <EntryFields
                        target={selected}
                        value={value}
                        onChange={(next) =>
                          setEdits((current) => ({ ...current, [selected]: next }))
                        }
                      />
                      <div className="review-actions">
                        <button type="submit">
                          {decision === "approved" ? "Save approved correction" : "Approve entry"}
                        </button>
                        <button
                          type="button"
                          disabled={decision === "approved" || decision === "rejected"}
                          onClick={() => void decide("rejected")}
                        >
                          Reject entry
                        </button>
                      </div>
                    </fieldset>
                    <p className="field-hint">
                      Each approval saves immediately. Changing modules retains unsaved corrections;
                      locking or closing Oracle clears them.
                    </p>
                  </form>
                  <aside className="review-evidence" aria-label="Source evidence">
                    <h3>Evidence channel</h3>
                    {evidence.citations.map((citation) => {
                      const document = documents.find(
                        (source) => source.id === citation.document_id,
                      );
                      return (
                        <figure
                          key={`${citation.document_id}-${citation.page}-${citation.excerpt}`}
                        >
                          <figcaption>
                            {document?.filename ?? "Source document"}
                            {document ? ` · v${document.version}` : ""} · page {citation.page}
                          </figcaption>
                          {document && !document.is_latest && (
                            <p className="entry-cautions">
                              A newer version is stored. This citation remains linked to the earlier
                              original; review it before relying on the claim.
                            </p>
                          )}
                          <blockquote>{citation.excerpt}</blockquote>
                        </figure>
                      );
                    })}
                    <details>
                      <summary>Original extracted proposal</summary>
                      <ReadValue target={selected} value={original} />
                    </details>
                    {approved && (
                      <details open>
                        <summary>Latest saved profile value</summary>
                        <ReadValue target={selected} value={approved} />
                      </details>
                    )}
                  </aside>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
