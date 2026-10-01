import { useEffect, useRef, useState } from "react";
import {
  APPLICATION_PAGE_SIZE,
  type ApplicationPage,
  type ApplicationRecord,
  applicationError,
  blankApplication,
  getApplication,
  listApplications,
} from "./api/applications";
import ApplicationEditor from "./applications/ApplicationEditor";
import Icon from "./Icon";

export default function Applications({ active = true }: { active?: boolean }) {
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
    if (selected || !active) return;
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
  }, [selected, active]);

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
        if (!active) return;
        const lastOffset = Math.max(
          0,
          Math.floor((result.total - 1) / APPLICATION_PAGE_SIZE) * APPLICATION_PAGE_SIZE,
        );
        if (offset > lastOffset) setOffset(lastOffset);
        else setPage(result);
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
      <ApplicationEditor
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
          {query || search ? (
            <button
              type="button"
              className="quiet-button"
              disabled={opening}
              onClick={() => {
                setQuery("");
                setSearch("");
                setOffset(0);
                searchInput.current?.focus();
              }}
            >
              Clear query
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading || opening}
            title="Refresh applications"
            onClick={() => setReload((value) => value + 1)}
          >
            <Icon name="refresh" />
            REFRESH
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
            <div className="empty-state">
              <p>No applications found.</p>
              <span>
                {search
                  ? "Try a different company or role, or clear the query."
                  : "Create a dossier to begin tracking an application."}
              </span>
            </div>
          ) : (
            <ul className="application-list" aria-label="Application dossiers">
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
                      <span className="record-status" data-status={item.status}>
                        {item.status}
                      </span>
                      {item.resume_sent ? <span>Resume sent {item.resume_sent}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {page.total > APPLICATION_PAGE_SIZE ? (
            <div className="application-pagination">
              <button
                type="button"
                disabled={offset === 0 || opening}
                onClick={() => setOffset(offset - APPLICATION_PAGE_SIZE)}
              >
                Previous
              </button>
              <span>
                {offset + 1}–{Math.min(offset + APPLICATION_PAGE_SIZE, page.total)} of {page.total}
              </span>
              <button
                type="button"
                disabled={offset + APPLICATION_PAGE_SIZE >= page.total || opening}
                onClick={() => setOffset(offset + APPLICATION_PAGE_SIZE)}
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
