import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type ListingField,
  type ListingRecord,
  listingError,
  listingFields,
  ORIGINAL_LIMIT,
  saveListing,
  validLink,
} from "../api/listings";
import Icon from "../Icon";

function collected(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Time unavailable" : date.toLocaleString();
}

export default function ListingEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: ListingRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [record, setRecord] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [discard, setDiscard] = useState(false);
  const baseline = useRef(JSON.stringify(initial));
  const dirty = JSON.stringify(record) !== baseline.current;
  const form = useRef<HTMLFormElement>(null);
  const unsaved = record.version === 0;
  const linkOk = validLink(record.data.url);
  const identified = Boolean(
    record.data.title.trim() ||
      record.data.company.trim() ||
      (record.origin === "pasted" || unsaved ? record.original_text.trim() : ""),
  );
  useEffect(() => {
    form.current?.querySelector<HTMLElement>("textarea, input")?.focus();
  }, []);

  async function save(next: ListingRecord, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await saveListing(next);
      setRecord(result);
      baseline.current = JSON.stringify(result);
      setSaved(message);
      onSaved();
    } catch (failure) {
      setError(listingError(failure));
    } finally {
      setBusy(false);
    }
  }
  function change(key: ListingField, value: string) {
    setRecord((current) => ({ ...current, data: { ...current.data, [key]: value } }));
    setSaved("");
  }

  return (
    <form
      className="application-editor"
      ref={form}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void save(record, "Saved on this computer.");
      }}
    >
      <div className="card-heading">
        <div>
          <p className="eyebrow">
            LISTING / {unsaved ? "UNSAVED" : `REV.${record.version}`}
            {record.archived ? " / ARCHIVED" : ""}
          </p>
          <h2>{record.data.title || record.data.company || "NEW.LISTING"}</h2>
        </div>
        <button
          type="button"
          className="quiet-button"
          disabled={busy}
          onClick={() => (dirty ? setDiscard(true) : onClose())}
        >
          <Icon name="back" />
          Back to list
        </button>
      </div>
      {discard ? (
        <div className="discard-prompt" role="alert">
          <p>Discard your unsaved changes?</p>
          <button type="button" disabled={busy} onClick={onClose}>
            Discard changes
          </button>{" "}
          <button type="button" onClick={() => setDiscard(false)}>
            Keep editing
          </button>
        </div>
      ) : null}
      <p className="input-help">
        {unsaved
          ? "Paste the listing text, or enter a job title or company by hand. The pasted text is kept exactly as entered and cannot be edited after saving."
          : "Your fields can be edited. The original text and collection time below never change."}
      </p>
      <fieldset className="editor-fields" disabled={busy}>
        {unsaved ? (
          <section className="editor-section" aria-label="01 / SOURCE TEXT">
            <h3 className="field-sector">01 / SOURCE TEXT</h3>
            <label className="application-field wide-field" htmlFor="listing-original">
              Pasted listing text
              <textarea
                id="listing-original"
                rows={10}
                maxLength={ORIGINAL_LIMIT}
                value={record.original_text}
                onChange={(event) => {
                  setRecord((current) => ({ ...current, original_text: event.target.value }));
                  setSaved("");
                }}
              />
            </label>
          </section>
        ) : null}
        <section className="editor-section" aria-label="02 / YOUR FIELDS">
          <h3 className="field-sector">02 / YOUR FIELDS</h3>
          <div className="application-fields">
            {listingFields.map(([key, label, limit]) => {
              const props = {
                id: `listing-${key}`,
                value: record.data[key],
                maxLength: limit,
                onChange: (event: { target: { value: string } }) => change(key, event.target.value),
              };
              return (
                <label
                  className={`application-field${key === "notes" ? " wide-field" : ""}`}
                  key={key}
                  htmlFor={props.id}
                >
                  {label}
                  {key === "notes" ? <textarea {...props} rows={3} /> : <input {...props} />}
                </label>
              );
            })}
          </div>
          {linkOk ? null : (
            <p className="access-error" role="alert">
              A listing link must start with http:// or https:// and contain no spaces.
            </p>
          )}
        </section>
      </fieldset>
      {unsaved ? null : (
        <section className="listing-original" aria-labelledby="listing-original-heading">
          <h3 className="field-sector" id="listing-original-heading">
            03 / ORIGINAL AS COLLECTED
          </h3>
          <p className="input-help">
            {record.origin === "pasted" ? "Pasted by you" : "Entered by hand, no pasted text"} /
            collected {collected(record.collected_at)}. Unverified source material: nothing in it is
            treated as an instruction or a confirmed fact.
          </p>
          {record.origin === "pasted" ? (
            <>
              <pre>{record.original_text}</pre>
              <details className="source-integrity">
                <summary className="integrity-label">Text integrity</summary>
                <p>SHA-256 of the stored text</p>
                <code>{record.original_sha256}</code>
              </details>
            </>
          ) : null}
        </section>
      )}
      <div className="editor-actions">
        <div>
          {error ? (
            <p className="access-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="save-status" role="status">
            {saved || (dirty ? "Unsaved changes" : "No unsaved changes")}
          </p>
        </div>
        {unsaved ? null : (
          <button
            type="button"
            className="quiet-button"
            disabled={busy || dirty}
            title={dirty ? "Save or discard your changes first" : undefined}
            onClick={() =>
              void save(
                { ...record, archived: !record.archived },
                record.archived ? "Returned to the active list." : "Archived. Nothing was deleted.",
              )
            }
          >
            {record.archived ? "Restore listing" : "Archive listing"}
          </button>
        )}
        <button type="submit" disabled={busy || !identified || !linkOk || (!unsaved && !dirty)}>
          <Icon name="save" />
          {busy ? "Saving…" : "Save listing"}
        </button>
      </div>
    </form>
  );
}
