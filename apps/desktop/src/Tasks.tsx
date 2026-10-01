import { useEffect, useRef, useState } from "react";
import { type DocumentSummary, listDocuments } from "./api/documents";
import { changeTask, createTask, listTasks, type Task, taskErrors } from "./api/tasks";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState("");
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const alive = useRef(false);
  const admitted = useRef(false);
  const stop = useRef(false);
  const recoveryNeeded = useRef(false);
  // No task is automatically resumed when the component mounts or the app unlocks.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload is an explicit user request to reconcile durable state.
  useEffect(() => {
    let active = true;
    setBusy(true);
    Promise.all([listTasks(), listDocuments()])
      .then(([rows, sources]) => {
        if (active) {
          setTasks(rows);
          setDocuments(sources);
          setSelected((ids) =>
            ids.filter((id) => sources.some((source) => source.id === id && source.is_latest)),
          );
          setError("");
          recoveryNeeded.current = false;
        }
      })
      .catch(() => {
        if (active) {
          recoveryNeeded.current = true;
          setError(
            "Oracle could not load tasks. Reopen Oracle if its runtime stopped; no task was retried.",
          );
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  function remember(task: Task) {
    if (alive.current) setTasks((rows) => [task, ...rows.filter((item) => item.id !== task.id)]);
  }
  async function run(initial: Task) {
    let task = initial;
    remember(task);
    setRunning(task.id);
    while (alive.current && !stop.current && task.state === "queued") {
      task = await changeTask(task, "task_advance");
      if (!alive.current) return;
      remember(task);
    }
    if (alive.current && stop.current && task.state === "queued") {
      remember(await changeTask(task, "task_cancel"));
    }
  }
  async function operate(operation: () => Promise<void>) {
    if (admitted.current || recoveryNeeded.current) return;
    admitted.current = true;
    stop.current = false;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch {
      // A lost response may hide a committed step. Only an explicit refresh reconciles it.
      recoveryNeeded.current = true;
      if (alive.current)
        setError(
          "The task outcome was not confirmed. Refresh tasks before continuing. If the runtime stopped, reopen Oracle. No write was automatically retried.",
        );
    } finally {
      admitted.current = false;
      if (alive.current) {
        setBusy(false);
        setRunning("");
        setStopping(false);
      }
    }
  }
  const unresolved = tasks.some((task) => task.state === "running");
  return (
    <section className="task-workspace" aria-label="Background tasks">
      <header className="review-toolbar">
        <div>
          <p className="eyebrow">TASKS / LOCAL EXECUTION</p>
          <p>
            Extract readable text from stored originals. This does not approve claims or generate a
            profile draft.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => setReload((n) => n + 1)}>
          Refresh tasks
        </button>
      </header>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <details className="task-create" open={tasks.length === 0}>
        <summary>New source-text extraction task</summary>
        <fieldset disabled={busy || recoveryNeeded.current || unresolved || tasks.length >= 100}>
          <legend>Select current source versions</legend>
          {documents
            .filter((document) => document.is_latest)
            .map((document) => (
              <label className="task-source" key={document.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(document.id)}
                  onChange={(event) =>
                    setSelected((ids) =>
                      event.target.checked
                        ? [...ids, document.id]
                        : ids.filter((id) => id !== document.id),
                    )
                  }
                />
                {document.filename} / v{document.version}
              </label>
            ))}
          {documents.length === 0 && <p>No source documents are stored yet.</p>}
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() =>
              void operate(async () => {
                const task = await createTask(crypto.randomUUID(), selected);
                if (!alive.current) return;
                setSelected([]);
                await run(task);
              })
            }
          >
            Start extraction
          </button>
        </fieldset>
      </details>
      <p className="field-hint">
        You can change modules while this runs. Cancellation takes effect after the current
        document; existing text is reused. Locking or closing stops further steps. Unfinished tasks
        require explicit resume. Record operations and locking may wait for the current document. Up
        to three attempts per task; 100 retained tasks.
      </p>
      {unresolved && !running && (
        <p role="status">
          An unconfirmed worker claim is present. Wait up to two minutes, then refresh to recover it
          as interrupted. Oracle will not start a second parser meanwhile.
        </p>
      )}
      {tasks.length === 0 && !busy && <p>No tasks yet.</p>}
      <div className="task-list">
        {tasks.map((task) => (
          <article
            className="task-record"
            key={task.id}
            aria-label={`Extraction task ${task.id.slice(0, 8)}`}
          >
            <header>
              <h2>TEXT / {task.id.slice(0, 8)}</h2>
              <span>
                {running === task.id
                  ? stopping
                    ? "STOPPING AFTER CURRENT DOCUMENT"
                    : "PROCESSING"
                  : task.state.toUpperCase()}
              </span>
            </header>
            <progress
              aria-label={`Task ${task.id.slice(0, 8)} progress`}
              value={task.completed}
              max={task.total}
            />
            <p>
              {task.completed} / {task.total} documents confirmed · attempt {task.attempt} / 3
            </p>
            {task.error && <p className="error-message">{taskErrors[task.error]}</p>}
            <details>
              <summary>Task sources</summary>
              <ul>
                {task.document_ids.map((id) => (
                  <li key={id}>
                    {documents.find((document) => document.id === id)?.filename ?? "Stored source"}
                  </li>
                ))}
              </ul>
            </details>
            <div className="review-actions">
              {running === task.id ? (
                <button
                  type="button"
                  disabled={stopping}
                  onClick={() => {
                    stop.current = true;
                    setStopping(true);
                  }}
                >
                  Cancel after current document
                </button>
              ) : (
                <>
                  {task.state === "queued" && (
                    <>
                      <button
                        type="button"
                        disabled={busy || recoveryNeeded.current || unresolved}
                        onClick={() => void operate(() => run(task))}
                      >
                        Resume task
                      </button>
                      <button
                        type="button"
                        disabled={busy || recoveryNeeded.current}
                        onClick={() =>
                          void operate(async () => remember(await changeTask(task, "task_cancel")))
                        }
                      >
                        Cancel task
                      </button>
                    </>
                  )}
                  {["failed", "interrupted", "cancelled"].includes(task.state) &&
                    task.attempt < 3 && (
                      <button
                        type="button"
                        disabled={busy || recoveryNeeded.current || unresolved}
                        onClick={() =>
                          void operate(async () => {
                            const next = await changeTask(task, "task_retry");
                            if (alive.current) await run(next);
                          })
                        }
                      >
                        Retry remaining documents
                      </button>
                    )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
