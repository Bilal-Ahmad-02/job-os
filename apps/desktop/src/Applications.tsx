import { type FormEvent, Fragment, useEffect, useRef, useState } from "react";
import {
  type ApplicationPage,
  type ApplicationRecord,
  applicationError,
  blankApplication,
  fields,
  getApplication,
  listApplications,
  saveApplication,
  statuses,
} from "./api/applications";
import Icon from "./Icon";

const fieldSectors: Record<number, string> = {
  0: "01 / TARGET.ID",
  2: "02 / INGRESS.INTEL",
  5: "03 / TRANSMISSION",
  8: "04 / FIELD.NOTES",
};

function Editor({
  initial,
  onClose,
  onSaved,
}: {
  initial: ApplicationRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [record, setRecord] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [discard, setDiscard] = useState(false);
  const baseline = useRef(initial.data);
  const dirty = JSON.stringify(record.data) !== JSON.stringify(baseline.current);
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

  return (
    <form className="application-editor" ref={form} onSubmit={(event) => void submit(event)}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">
            DOSSIER / {record.version === 0 ? "UNSAVED" : `REV.${record.version}`}
          </p>
          <h2>{record.version === 0 ? "NEW.ENTRY" : "RECORD.OPEN"}</h2>
        </div>
        <button
          type="button"
          disabled={busy}
          title="Return to dossier index"
          onClick={() => (dirty ? setDiscard(true) : onClose())}
        >
          <Icon name="back" />
          Back to list
        </button>
      </div>
      {discard ? (
        <div className="discard-prompt" role="alert">
          <p>Discard your unsaved changes?</p>
          <button type="button" onClick={onClose}>
            Discard changes
          </button>{" "}
          <button type="button" onClick={() => setDiscard(false)}>
            Keep editing
          </button>
        </div>
      ) : null}
      <p className="input-help">A job title or company is required. Other fields can stay blank.</p>
      <fieldset disabled={busy}>
        <label className="application-field status-field" htmlFor="application-status">
          Status
          <select
            id="application-status"
            value={record.data.status}
            onChange={(event) => {
              const status = statuses.find((value) => value === event.target.value);
              if (status) setRecord({ ...record, data: { ...record.data, status } });
              setSaved("");
            }}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <div className="application-fields">
          {fields.map(([key, label], index) => {
            const short = key === "title" || key === "company" || key === "resume_sent";
            const props = {
              id: `application-${key}`,
              value: record.data[key],
              maxLength: short ? 1000 : 10000,
              onChange: (event: { target: { value: string } }) => {
                setRecord({ ...record, data: { ...record.data, [key]: event.target.value } });
                setSaved("");
              },
            };
            return (
              <Fragment key={key}>
                {fieldSectors[index] ? (
                  <div className="field-sector">{fieldSectors[index]}</div>
                ) : null}
                <div className="application-field">
                  <div>
                    <span className="field-code" aria-hidden="true">
                      F.{String(index + 1).padStart(2, "0")} /{" "}
                    </span>
                    <label htmlFor={props.id}>{label}</label>
                  </div>
                  {short ? (
                    <input {...props} />
                  ) : (
                    <textarea {...props} rows={key === "description" || key === "notes" ? 4 : 2} />
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      </fieldset>
      {error ? (
        <p className="access-error" role="alert">
          {error}
        </p>
      ) : null}
      <p role="status">{saved}</p>
      <button
        type="submit"
        disabled={busy || !(record.data.title.trim() || record.data.company.trim())}
      >
        <Icon name="save" />
        {busy ? "Saving…" : "Save application"}
      </button>
      {record.imported ? (
        <details className="import-details">
          <summary>TRACE / Original spreadsheet entry · row {record.imported.row}</summary>
          <p className="input-help">
            Preserved from {record.imported.sheet}. Your edits above do not alter this copy.
          </p>
          <dl>
            {fields.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{record.imported?.original[key] || "Not provided"}</dd>
              </div>
            ))}
          </dl>
          {Object.entries(record.imported.links).map(([cell, target]) => (
            <p key={cell} className="original-link">
              Embedded link ({cell}): {target}
            </p>
          ))}
        </details>
      ) : null}
    </form>
  );
}

export default function Applications() {
  const [page, setPage] = useState<ApplicationPage>({ items: [], total: 0 });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ApplicationRecord | null>(null);
  const selection = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected) return;
    function focusQuery(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        !event.altKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }
    window.addEventListener("keydown", focusQuery);
    return () => window.removeEventListener("keydown", focusQuery);
  }, [selected]);

  useEffect(
    () => () => {
      selection.current += 1;
    },
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload is the explicit refresh generation.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listApplications(search, offset)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((failure: unknown) => {
        if (active) setError(applicationError(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, offset, reload]);

  async function open(id: string) {
    const ticket = ++selection.current;
    setOpening(true);
    setError("");
    try {
      const result = await getApplication(id);
      if (ticket === selection.current) setSelected(result);
    } catch (failure) {
      if (ticket === selection.current) setError(applicationError(failure));
    } finally {
      if (ticket === selection.current) setOpening(false);
    }
  }

  if (selected)
    return (
      <Editor
        key={selected.id}
        initial={selected}
        onClose={() => setSelected(null)}
        onSaved={() => setReload((value) => value + 1)}
      />
    );

  return (
    <section className="applications-card" aria-labelledby="applications-heading">
      <div className="card-heading">
        <h2 id="applications-heading">DOSSIER.INDEX</h2>
        <button
          type="button"
          disabled={opening}
          title="Add application"
          onClick={() => setSelected(blankApplication())}
        >
          <Icon name="plus" />
          NEW.DOSSIER
        </button>
      </div>
      <form
        className="application-search"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setSearch(query.trim());
          setReload((value) => value + 1);
        }}
      >
        <label className="query-label" htmlFor="application-search">
          <span>QUERY / COMPANY + ROLE</span>
          <kbd>CTRL K</kbd>
        </label>
        <div className="query-line">
          <span className="query-prompt" aria-hidden="true">
            acq &gt;
          </span>
          <input
            ref={searchInput}
            id="application-search"
            aria-label="Search by company or job title"
            placeholder="Filter the dossier index_"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" disabled={opening} title="Search">
            <Icon name="search" />
            EXEC
          </button>
          <button
            type="button"
            disabled={loading || opening}
            title="Refresh applications"
            onClick={() => setReload((value) => value + 1)}
          >
            <Icon name="refresh" />
            SYNC
          </button>
        </div>
      </form>
      {error ? (
        <p className="access-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status">Loading applications…</p>
      ) : error ? null : (
        <>
          <div className="index-readout">
            <span>
              {search ? "MATCHES" : "ARCHIVE"}{" "}
              <strong>{String(page.total).padStart(3, "0")}</strong>
            </span>
            <span>
              IN VIEW <strong>{String(page.items.length).padStart(2, "0")}</strong>
            </span>
            <span>{search ? "FILTER.ACTIVE" : "ALL.RECORDS"}</span>
          </div>
          {page.items.length === 0 ? (
            <p>No applications found.</p>
          ) : (
            <ul className="application-list">
              {page.items.map((item, index) => (
                <li key={item.id}>
                  <button type="button" disabled={opening} onClick={() => void open(item.id)}>
                    <span className="record-position" aria-hidden="true">
                      {String(offset + index + 1).padStart(3, "0")}
                    </span>
                    <span className="record-target">
                      <strong>{item.company || "Company not provided"}</strong>
                      <span>{item.title || "Job title not provided"}</span>
                    </span>
                    <span className="application-meta">
                      <span>{item.status}</span>
                      {item.resume_sent ? <span>Resume sent {item.resume_sent}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {page.total > 50 ? (
            <div className="application-pagination">
              <button
                type="button"
                disabled={offset === 0 || opening}
                onClick={() => setOffset(offset - 50)}
              >
                Previous
              </button>
              <span>
                {offset + 1}–{Math.min(offset + 50, page.total)} of {page.total}
              </span>
              <button
                type="button"
                disabled={offset + 50 >= page.total || opening}
                onClick={() => setOffset(offset + 50)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
      {opening ? <p role="status">Opening application…</p> : null}
    </section>
  );
}
