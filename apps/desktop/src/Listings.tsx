import { useEffect, useRef, useState } from "react";
import {
  blankListing,
  deleteSearch,
  getListing,
  LISTING_PAGE_SIZE,
  type ListingPage,
  type ListingRecord,
  type ListingView,
  listingError,
  listingViews,
  listListings,
  listSearches,
  type SavedSearch,
  saveSearch,
} from "./api/listings";
import Icon from "./Icon";
import ListingEditor from "./listings/ListingEditor";

function collectedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleDateString();
}

const emptyViews: Record<ListingView, [string, string]> = {
  incoming: ["No listings waiting for review.", "Choose NEW.LISTING to paste a job description."],
  shortlist: ["Nothing shortlisted.", "Open a listing and choose Add to shortlist."],
  tracked: [
    "No applications started from listings.",
    "Open a listing and choose Start application.",
  ],
  dismissed: ["No dismissed listings.", "Dismissed listings stay stored and can be restored."],
};

/** Manual intake and review: nothing here fetches, ranks, matches or decides for the owner. */
export default function Listings() {
  const [page, setPage] = useState<ListingPage>({ items: [], total: 0 });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<ListingView>("incoming");
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [searchName, setSearchName] = useState("");
  const [searchError, setSearchError] = useState("");
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
    listListings(search, offset, view)
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
  }, [search, offset, view, reload]);
  useEffect(() => {
    let active = true;
    listSearches()
      .then((result) => {
        if (active) setSearches(result);
      })
      .catch((failure: unknown) => {
        if (active) setSearchError(listingError(failure));
      });
    return () => {
      active = false;
    };
  }, []);
  async function changeSearches(operation: Promise<SavedSearch[]>) {
    setSearchError("");
    try {
      setSearches(await operation);
      setSearchName("");
    } catch (failure) {
      setSearchError(listingError(failure));
    }
  }

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
            disabled={loading || opening}
            onClick={() => setReload((value) => value + 1)}
          >
            <Icon name="refresh" />
            REFRESH
          </button>
        </div>
      </form>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle these as form fields. */}
      <div className="listing-views" role="group" aria-label="Listing views">
        {(Object.keys(listingViews) as ListingView[]).map((key) => (
          <button
            key={key}
            type="button"
            className="quiet-button"
            aria-pressed={view === key}
            disabled={opening}
            onClick={() => {
              setOffset(0);
              setView(key);
            }}
          >
            {listingViews[key]}
          </button>
        ))}
      </div>
      <div className="listing-searches">
        <span>SAVED SEARCHES</span>
        {searches.length === 0 ? <span>None saved.</span> : null}
        {searches.map((item) => (
          <span key={item.id} className="saved-search">
            <button
              type="button"
              className="quiet-button"
              disabled={opening}
              title={`${listingViews[item.view]} / ${item.query || "no text filter"}`}
              onClick={() => {
                setQuery(item.query);
                setSearch(item.query);
                setView(item.view);
                setOffset(0);
              }}
            >
              {item.name}
            </button>
            <button
              type="button"
              className="quiet-button"
              aria-label={`Remove saved search ${item.name}`}
              onClick={() => void changeSearches(deleteSearch(item.id))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-label="Name for the current search"
          placeholder="Name the current view and filter"
          value={searchName}
          maxLength={80}
          onChange={(event) => setSearchName(event.target.value)}
        />
        <button
          type="button"
          className="quiet-button"
          disabled={!searchName.trim() || searches.length >= 20}
          onClick={() => void changeSearches(saveSearch(searchName.trim(), search, view))}
        >
          Save search
        </button>
      </div>
      {searchError ? (
        <p className="access-error" role="alert">
          {searchError}
        </p>
      ) : null}
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
              {listingViews[view].toUpperCase()}{" "}
              <strong>{String(page.total).padStart(3, "0")}</strong>
            </span>
            <span>
              IN VIEW <strong>{String(page.items.length).padStart(2, "0")}</strong>
            </span>
            <span>{search ? "FILTER.ACTIVE" : "MANUAL.INTAKE"}</span>
          </div>
          {page.items.length === 0 ? (
            <div className="empty-state">
              <p>{emptyViews[view][0]}</p>
              <span>
                {search
                  ? "Try a different company or role, or clear the query."
                  : emptyViews[view][1]}
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
                      {item.shortlisted && view !== "shortlist" ? <span>Shortlisted</span> : null}
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
