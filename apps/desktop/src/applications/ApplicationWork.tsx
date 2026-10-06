import { useEffect, useState } from "react";
import { type ApplicationData, DOCUMENT_LIMIT, TODO_LIMIT, type Todo } from "../api/applications";
import { type DocumentSummary, listDocuments } from "../api/documents";
import Icon from "../Icon";

type Work = Pick<ApplicationData, "preparation" | "todos" | "document_ids">;

/**
 * The owner's own working notes for one application: what to do, what to prepare for an
 * interview, and which stored document versions were used. Nothing here is filled in, ticked or
 * sent by Oracle, and a due date is only displayed.
 */
export default function ApplicationWork({
  data,
  onChange,
}: {
  data: Work;
  onChange: (change: Partial<Work>) => void;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let current = true;
    listDocuments()
      .then((items) => current && setDocuments(items))
      .catch(() => current && setUnavailable(true));
    return () => {
      current = false;
    };
  }, []);

  const setTodo = (index: number, change: Partial<Todo>) =>
    onChange({
      todos: data.todos.map((todo, at) => (at === index ? { ...todo, ...change } : todo)),
    });
  const linked = new Set(data.document_ids);
  // A link whose document is not in the list is still shown, so it is never dropped unseen.
  const unlisted = data.document_ids.filter((id) => !documents?.some((item) => item.id === id));

  return (
    <>
      <section className="editor-section" aria-label="05 / TO DO">
        <h3 className="field-sector">05 / TO DO</h3>
        <p className="input-help">
          Your own list. Oracle does not add items, tick them or remind you; a date is only shown.
        </p>
        <ul className="todo-list">
          {data.todos.map((todo, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: items have no identity but their place.
            <li key={index} data-done={todo.done}>
              <input
                type="checkbox"
                aria-label={`Done: ${todo.title || `item ${index + 1}`}`}
                checked={todo.done}
                onChange={(event) => setTodo(index, { done: event.target.checked })}
              />
              <input
                aria-label={`To-do ${index + 1}`}
                value={todo.title}
                maxLength={200}
                placeholder="What needs doing"
                onChange={(event) => setTodo(index, { title: event.target.value })}
              />
              <input
                type="date"
                aria-label={`Due date for to-do ${index + 1}`}
                value={todo.due_date}
                onChange={(event) => setTodo(index, { due_date: event.target.value })}
              />
              <button
                type="button"
                className="quiet-button"
                aria-label={`Remove to-do ${index + 1}`}
                onClick={() => onChange({ todos: data.todos.filter((_, at) => at !== index) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="quiet-button"
          disabled={data.todos.length >= TODO_LIMIT}
          onClick={() =>
            onChange({ todos: [...data.todos, { title: "", due_date: "", done: false }] })
          }
        >
          <Icon name="plus" />
          Add to-do
        </button>
      </section>
      <section className="editor-section" aria-label="06 / INTERVIEW PREPARATION">
        <h3 className="field-sector">06 / INTERVIEW PREPARATION</h3>
        <label className="application-field wide-field" htmlFor="application-preparation">
          Preparation notes
          <textarea
            id="application-preparation"
            rows={5}
            maxLength={10000}
            value={data.preparation}
            onChange={(event) => onChange({ preparation: event.target.value })}
          />
        </label>
        <p className="input-help">Written by you. Oracle does not generate or suggest these.</p>
      </section>
      <section className="editor-section" aria-label="07 / DOCUMENTS USED">
        <h3 className="field-sector">07 / DOCUMENTS USED</h3>
        <p className="input-help">
          Tick the stored document versions you used. A tick records your statement that this exact
          file was used; Oracle has not sent it anywhere and cannot check that you did.
        </p>
        {unavailable ? (
          <p className="access-error" role="alert">
            Your stored documents could not be listed. Existing links are kept as they are.
          </p>
        ) : null}
        {documents?.length === 0 && unlisted.length === 0 ? (
          <p className="input-help">No documents are stored yet. Add them in the profile area.</p>
        ) : null}
        <ul className="document-links">
          {documents?.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={linked.has(item.id)}
                  disabled={!linked.has(item.id) && linked.size >= DOCUMENT_LIMIT}
                  onChange={(event) =>
                    onChange({
                      document_ids: event.target.checked
                        ? [...data.document_ids, item.id]
                        : data.document_ids.filter((id) => id !== item.id),
                    })
                  }
                />
                <span>
                  {item.filename}
                  <small>
                    {item.kind} / version {item.version} /{" "}
                    {item.is_latest ? "current" : "superseded by a newer version"}
                  </small>
                </span>
              </label>
            </li>
          ))}
          {unlisted.map((id) => (
            <li key={id}>
              <label>
                <input
                  type="checkbox"
                  checked
                  onChange={() =>
                    onChange({ document_ids: data.document_ids.filter((kept) => kept !== id) })
                  }
                />
                <span>
                  Stored document
                  <small>
                    {documents ? "not among the listed documents" : "details not loaded"}
                  </small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
