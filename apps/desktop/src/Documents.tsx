import { useEffect, useState } from "react";
import { type DocumentSummary, listDocuments } from "./api/documents";
import Icon from "./Icon";

function importedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleDateString();
}

function VersionMetadata({ item }: { item: DocumentSummary }) {
  return (
    <div className="source-detail">
      <p>
        Imported {importedDate(item.imported_at)} / {item.page_count} pages /{" "}
        {(item.byte_size / 1024).toFixed(1)} KiB
      </p>
      <p>Source material only. Storing a document does not verify its claims.</p>
      <details className="source-integrity">
        <summary className="integrity-label">File integrity and document ID</summary>
        <p>Document ID</p>
        <code>{item.id}</code>
        <p>SHA-256 of the stored original</p>
        <code>{item.sha256}</code>
      </details>
    </div>
  );
}

export default function Documents() {
  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload is an explicit refresh generation.
  useEffect(() => {
    let active = true;
    setState("loading");
    listDocuments()
      .then((result) => {
        if (active) {
          setItems(result);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const filter = query.trim().toLocaleLowerCase();
  const groups = items
    .filter((item) => item.is_latest)
    .map((latest) => ({
      latest,
      versions: items
        .filter((item) => item.family_id === latest.family_id)
        .sort((a, b) => b.version - a.version),
    }));
  const visible = groups.filter((group) =>
    group.versions.some((item) =>
      `${item.filename} ${item.kind}`.toLocaleLowerCase().includes(filter),
    ),
  );
  return (
    <section className="document-register" aria-labelledby="documents-heading">
      <div className="card-heading">
        <h2 id="documents-heading">EVIDENCE / SOURCE REGISTER</h2>
        <button
          type="button"
          className="quiet-button"
          disabled={state === "loading"}
          onClick={() => setReload((value) => value + 1)}
        >
          <Icon name="refresh" />
          Refresh sources
        </button>
      </div>
      <p className="input-help">
        Originals and version history, stored locally. New versions never replace the files behind
        existing citations.
      </p>
      <label className="document-query">
        FILTER / FILENAME + TYPE
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={255}
          placeholder="Find a source document"
          aria-label="Find a source document"
        />
      </label>
      {state === "loading" ? (
        <p className="loading-state" role="status">
          Reading source register…
        </p>
      ) : state === "error" ? (
        <p className="access-error" role="alert">
          Oracle could not read the document register. Retry or reopen Oracle.
        </p>
      ) : (
        <>
          <div className="index-readout">
            <span>
              DOCUMENTS <strong>{String(groups.length).padStart(2, "0")}</strong>
            </span>
            <span>
              IN VIEW <strong>{String(visible.length).padStart(2, "0")}</strong>
            </span>
            <span>VERSIONS / {items.length} / ORIGINALS PRESERVED</span>
          </div>
          {visible.length === 0 ? (
            <div className="empty-state">
              <p>
                {items.length ? "No sources match your filter." : "No source documents imported."}
              </p>
              {query ? (
                <button type="button" onClick={() => setQuery("")}>
                  Clear filter
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="source-list">
              {visible.map(({ latest: item, versions }, index) => (
                <li key={item.id}>
                  <details className="source-entry">
                    <summary>
                      <span className="source-number" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="source-title">
                        <strong>{item.filename}</strong>
                        <span>
                          {item.kind.toUpperCase()} / {item.page_count}{" "}
                          {item.page_count === 1 ? "PAGE" : "PAGES"} /{" "}
                          {(item.byte_size / 1024).toFixed(1)} KiB
                        </span>
                      </span>
                      <span className="source-state">LATEST / V{item.version}</span>
                    </summary>
                    <VersionMetadata item={item} />
                    <details className="source-history">
                      <summary className="history-label">
                        Version history ({versions.length})
                      </summary>
                      <p className="input-help">
                        Latest version shown above.{" "}
                        {versions.length === 1
                          ? "No earlier originals."
                          : "Earlier originals remain below."}
                      </p>
                      <ol>
                        {versions
                          .filter((version) => !version.is_latest)
                          .map((version) => (
                            <li key={version.id}>
                              <h3>
                                V{version.version} / {version.filename}
                              </h3>
                              <p className="input-help">
                                Earlier version / retained for existing citations
                              </p>
                              <VersionMetadata item={version} />
                            </li>
                          ))}
                      </ol>
                    </details>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
