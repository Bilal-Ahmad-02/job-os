import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type ApplicationRecord,
  applicationError,
  dateFields,
  type FieldName,
  fields,
  saveApplication,
  statuses,
} from "../api/applications";
import Icon from "../Icon";
import ApplicationWork from "./ApplicationWork";
import SourceTrace from "./SourceTrace";

const sections: { label: string; fields: readonly FieldName[] }[] = [
  { label: "01 / TARGET", fields: ["title", "company", "website", "source"] },
  { label: "02 / INTELLIGENCE", fields: ["description", "learning"] },
  {
    label: "03 / TRANSMISSION",
    fields: ["resume_sent", "how_sent", "references_sent", "status_notes"],
  },
  { label: "04 / FOLLOW THROUGH", fields: ["interview", "follow_up", "notes"] },
];
const labels = Object.fromEntries(fields) as Record<FieldName, string>;

export default function ApplicationEditor({
  initial,
  onClose,
  onOpenListing,
  onSaved,
}: {
  initial: ApplicationRecord;
  onClose: () => void;
  onOpenListing?: (id: string) => void;
  onSaved: () => void;
}) {
  const [record, setRecord] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [discard, setDiscard] = useState(false);
  const baseline = useRef(initial.data);
  const dirty = JSON.stringify(record.data) !== JSON.stringify(baseline.current);
  const untitled = record.data.todos.some((todo) => !todo.title.trim());
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector("input")?.focus();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await saveApplication(record);
      setRecord(result);
      baseline.current = result.data;
      setSaved("Saved on this computer.");
      onSaved();
    } catch (failure) {
      setError(applicationError(failure));
    } finally {
      setBusy(false);
    }
  }

  function change(key: FieldName, value: string) {
    setRecord((current) => ({ ...current, data: { ...current.data, [key]: value } }));
    setSaved("");
  }

  return (
    <form className="application-editor" ref={form} onSubmit={(event) => void submit(event)}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">
            DOSSIER / {record.version === 0 ? "UNSAVED" : `REV.${record.version}`}
          </p>
          <h2>{record.data.company || record.data.title || "NEW.ENTRY"}</h2>
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
      <p className="input-help">A job title or company is required. Other fields can stay blank.</p>
      <fieldset className="editor-fields" disabled={busy}>
        <label className="application-field status-field" htmlFor="application-status">
          Status
          <select
            id="application-status"
            value={record.data.status}
            onChange={(event) => {
              const status = statuses.find((value) => value === event.target.value);
              if (status)
                setRecord((current) => ({ ...current, data: { ...current.data, status } }));
              setSaved("");
            }}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <div className="application-dates">
          {dateFields.map(([key, label]) => (
            <label className="application-field" key={key} htmlFor={`application-${key}`}>
              {label}
              <input
                id={`application-${key}`}
                type="date"
                value={record.data[key]}
                onChange={(event) => {
                  const value = event.target.value;
                  setRecord((current) => ({ ...current, data: { ...current.data, [key]: value } }));
                  setSaved("");
                }}
              />
            </label>
          ))}
          <p className="input-help">
            Dates you set yourself. Oracle shows them in the index; it does not remind or notify.
          </p>
        </div>
        {sections.map((section) => (
          <section className="editor-section" key={section.label} aria-label={section.label}>
            <h3 className="field-sector">{section.label}</h3>
            <div className="application-fields">
              {section.fields.map((key) => {
                const short = key === "title" || key === "company" || key === "resume_sent";
                const wide = key === "description" || key === "notes";
                const props = {
                  id: `application-${key}`,
                  value: record.data[key],
                  maxLength: short ? 1000 : 10000,
                  onChange: (event: { target: { value: string } }) =>
                    change(key, event.target.value),
                };
                return (
                  <label
                    className={`application-field${wide ? " wide-field" : ""}`}
                    key={key}
                    htmlFor={props.id}
                  >
                    {labels[key]}
                    {short ? <input {...props} /> : <textarea {...props} rows={wide ? 4 : 2} />}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
        <ApplicationWork
          data={record.data}
          onChange={(change) => {
            setRecord((current) => ({ ...current, data: { ...current.data, ...change } }));
            setSaved("");
          }}
        />
      </fieldset>
      {record.imported ? <SourceTrace source={record.imported} /> : null}
      {record.listing_id ? (
        <p className="input-help" role="note">
          Started from a listing you collected in 06 / INGRESS; its full original text is kept
          there.{" "}
          {onOpenListing ? (
            <button
              type="button"
              className="quiet-button"
              disabled={busy || dirty}
              title={dirty ? "Save or discard your changes first" : undefined}
              onClick={() => record.listing_id && onOpenListing(record.listing_id)}
            >
              Open source listing
            </button>
          ) : null}
        </p>
      ) : null}
      <div className="editor-actions">
        <div>
          {error ? (
            <p className="access-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="save-status" role="status">
            {untitled
              ? "Give every to-do a title, or remove it, before saving."
              : saved || (dirty ? "Unsaved changes" : "No unsaved changes")}
          </p>
        </div>
        <button
          type="submit"
          disabled={
            busy ||
            !(record.data.title.trim() || record.data.company.trim()) ||
            untitled ||
            (record.version > 0 && !dirty)
          }
        >
          <Icon name="save" />
          {busy ? "Saving…" : "Save application"}
        </button>
      </div>
    </form>
  );
}
