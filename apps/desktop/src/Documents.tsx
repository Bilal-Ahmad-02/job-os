import { useEffect, useState } from "react";
import { type DocumentSummary, listDocuments } from "./api/documents";

export default function Documents() {
  const [items, setItems] = useState<DocumentSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
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
  return (
    <details className="document-register">
      <summary>
        EVIDENCE / SOURCE VAULT{" "}
        <span className="document-count">
          {state === "ready" ? String(items.length).padStart(2, "0") : "--"}
        </span>
      </summary>
      <p className="document-help">
        Original documents. Source material only; qualifications have not been reviewed or verified.
      </p>
      {state === "loading" ? (
        <p role="status">Reading source register…</p>
      ) : state === "error" ? (
        <p className="access-error" role="alert">
          Oracle could not read the document register. Retry or reopen Oracle.
        </p>
      ) : items.length === 0 ? (
        <p>No source documents imported.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.filename}</strong>
              <span className="document-metadata">
                {item.kind.toUpperCase()} / {item.page_count}{" "}
                {item.page_count === 1 ? "PAGE" : "PAGES"} / {(item.byte_size / 1024).toFixed(1)}{" "}
                KiB
              </span>
              <small>SHA256 / {item.sha256}</small>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={state === "loading"}
        onClick={() => setReload((value) => value + 1)}
      >
        Refresh sources
      </button>
    </details>
  );
}
