import { useEffect, useRef, useState } from "react";
import {
  blankListing,
  getListing,
  LISTING_PAGE_SIZE,
  type ListingPage,
  type ListingRecord,
  listingError,
  listListings,
} from "./api/listings";
import Icon from "./Icon";
import ListingEditor from "./listings/ListingEditor";

function collectedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleDateString();
}

/** Manual intake only: nothing here fetches, parses, ranks or matches a listing. */
export default function Listings() {
  const [page, setPage] = useState<ListingPage>({ items: [], total: 0 });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [archived, setArchived] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ListingRecord | null>(null);
  const selection = useRef(0);

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
    listListings(search, offset, archived)
      .then((result) => {
        if (!active) return;
        const lastOffset = Math.max(
          0,
          Math.floor((result.total - 1) / LISTING_PAGE_SIZE) * LISTING_PAGE_SIZE,
        );
        if (offset > lastOffset) setOffset(lastOffset);
        else setPage(result);
      })
      .catch((failure: unknown) => {
        if (active) setError(listingError(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, offset, archived, reload]);

  async function open(id: string) {
    const ticket = ++selection.current;
    setOpening(true);
    setError("");
    try {
      const result = await getListing(id);
      if (ticket === selection.current) setSelected(result);
    } catch (failure) {
      if (ticket === selection.current) setError(listingError(failure));
    } finally {
      if (ticket === selection.current) setOpening(false);
    }
  }

  if (selected)
    return (
      <ListingEditor
        key={selected.id}
        initial={selected}
        onClose={() => setSelected(null)}
        onOpen={(id) => void open(id)}
        onSaved={() => setReload((value) => value + 1)}
      />
    );

  return (
    <section className="applications-card" aria-labelledby="listings-heading">
      <div className="card-heading">
        <h2 id="listings-heading">INGRESS.QUEUE</h2>
        <button type="button" disabled={opening} onClick={() => setSelected(blankListing())}>
          <Icon name="plus" />
          NEW.LISTING
        </button>
      </div>
      <p className="input-help">
        Listings you paste or type in yourself. Oracle does not fetch, read into, rank or match them
        yet.
      </p>
      <form
        className="application-search"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setSearch(query.trim());
          setReload((value) => value + 1);
        }}
      >
        <label className="query-label" htmlFor="listing-search">
          <span>QUERY / COMPANY + ROLE</span>
        </label>
        <div className="query-line">
          <span className="query-prompt" aria-hidden="true">
            ingress &gt;
          </span>
          <input
            id="listing-search"
            aria-label="Search listings by company or job title"
            placeholder="Filter collected listings_"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" disabled={opening}>
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
              }}
            >
              Clear query
            </button>
          ) : null}
          <button
            type="button"
            className="quiet-button"
            aria-pressed={archived}
            disabled={opening}
            onClick={() => {
              setOffset(0);
              setArchived(!archived);
            }}
          >
            {archived ? "Show active" : "Show archived"}
          </button>
          <button
            type="button"
            disabled={loading || opening}
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
        <p role="status">Loading listings…</p>
      ) : error ? null : (
        <>
          <div className="index-readout">
            <span>
              {archived ? "ARCHIVED" : "ACTIVE"}{" "}
              <strong>{String(page.total).padStart(3, "0")}</strong>
            </span>
            <span>
              IN VIEW <strong>{String(page.items.length).padStart(2, "0")}</strong>
            </span>
            <span>{search ? "FILTER.ACTIVE" : "MANUAL.INTAKE"}</span>
          </div>
          {page.items.length === 0 ? (
            <div className="empty-state">
              <p>{archived ? "No archived listings." : "No listings collected."}</p>
              <span>
                {search
                  ? "Try a different company or role, or clear the query."
                  : archived
                    ? "Archived listings stay stored and can be restored."
                    : "Choose NEW.LISTING to paste a job description."}
              </span>
            </div>
          ) : (
            <ul className="application-list" aria-label="Collected listings">
              {page.items.map((item, index) => (
                <li key={item.id}>
                  <button type="button" disabled={opening} onClick={() => void open(item.id)}>
                    <span className="record-position" aria-hidden="true">
                      {String(offset + index + 1).padStart(3, "0")}
                    </span>
                    <span className="record-target">
                      <strong>
                        {item.title ||
                          (item.suggested_title
                            ? `${item.suggested_title} (first line of pasted text)`
                            : "Job title not provided")}
                      </strong>
                      <span>
                        {item.company || "Company not provided"}
                        {item.location ? ` / ${item.location}` : ""}
                      </span>
                    </span>
                    <span className="application-meta">
                      <span className="record-status" data-status="Unspecified">
                        {item.origin === "pasted" ? "Pasted" : "By hand"}
                      </span>
                      {item.closed ? <span>Role closed</span> : null}
                      {item.possible_duplicate ? <span>Possible duplicate</span> : null}
                      <span>Collected {collectedDate(item.collected_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {page.total > LISTING_PAGE_SIZE ? (
            <div className="application-pagination">
              <button
                type="button"
                disabled={offset === 0 || opening}
                onClick={() => setOffset(offset - LISTING_PAGE_SIZE)}
              >
                Previous
              </button>
              <span>
                {offset + 1}–{Math.min(offset + LISTING_PAGE_SIZE, page.total)} of {page.total}
              </span>
              <button
                type="button"
                disabled={offset + LISTING_PAGE_SIZE >= page.total || opening}
                onClick={() => setOffset(offset + LISTING_PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
      {opening ? <p role="status">Opening listing…</p> : null}
    </section>
  );
}
