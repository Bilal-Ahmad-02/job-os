import { useState } from "react";
import { type ApplicationDraft, buildDraft, type DraftBlock, type DraftKind } from "../api/drafts";

const KINDS: readonly [DraftKind, string][] = [
  ["cv", "CV"],
  ["cover_letter", "cover letter"],
];
const GAP_WORDS: Record<ApplicationDraft["gaps"][number], string> = {
  full_name: "your name",
  summary: "a summary",
  experience: "any experience",
  education: "any education",
  skills: "any skills",
  title: "this dossier's job title",
  company: "this dossier's company",
};

/** In plain words, where a block's contents came from. */
function origin(block: DraftBlock): string {
  const parts = block.sources.map((source) => source.split("/")[0]?.replace("_", " ") ?? "");
  const counted = [...new Set(parts)].map((part) => {
    const count = parts.filter((other) => other === part).length;
    return count > 1 ? `${part} (${count} entries)` : part;
  });
  if (block.uses_application) counted.push("this dossier's job title or company");
  return counted.length
    ? `From your ${counted.join(", ")}${block.sources.length ? "" : ", in template wording"}`
    : "Template wording only";
}

/** The kept blocks as one text: a CV prints each section name once, above its first block. */
function compose(blocks: readonly DraftBlock[]): string {
  return blocks
    .map((block, index) =>
      block.heading && block.heading !== blocks[index - 1]?.heading
        ? `${block.heading}\n${block.text}`
        : block.text,
    )
    .join("\n\n");
}

/**
 * Template-built drafts for one saved dossier. The owner builds one, removes what they do not
 * want, confirms they have read it, and copies the text. Oracle writes no sentence with a model,
 * keeps no copy and sends nothing.
 */
export default function ApplicationDrafts({
  applicationId,
  unsaved,
}: {
  applicationId: string;
  unsaved: boolean;
}) {
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [left, setLeft] = useState<ReadonlySet<number>>(new Set());
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const kept = draft?.blocks.filter((_, index) => !left.has(index)) ?? [];
  const text = compose(kept);

  async function build(kind: DraftKind) {
    setBusy(true);
    setNotice("");
    try {
      setDraft(await buildDraft(applicationId, kind));
      setLeft(new Set());
      setRead(false);
    } catch {
      setDraft(null);
      setNotice("The draft could not be built. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to the clipboard on this computer. Nothing was sent or saved.");
    } catch {
      setNotice("Copying was blocked. Select the text in the box below and copy it yourself.");
    }
  }

  return (
    <section className="editor-section" aria-label="08 / DRAFTS">
      <h3 className="field-sector">08 / DRAFTS</h3>
      <p className="input-help">
        Built on this computer from your profile with fixed wording, in English. No AI writes any of
        it, nothing is stored and nothing is sent. Treat it as a starting point to edit.
      </p>
      {KINDS.map(([kind, name]) => (
        <button
          key={kind}
          type="button"
          className="quiet-button"
          disabled={busy || unsaved}
          title={unsaved ? "Save your changes first; a draft uses the saved dossier" : undefined}
          onClick={() => void build(kind)}
        >
          Build {name} draft
        </button>
      ))}
      {notice ? (
        <p className="save-status" role="status">
          {notice}
        </p>
      ) : null}
      {draft ? (
        <div className="draft-review">
          <p className="input-help">
            Template {draft.template_version}, from dossier revision {draft.application_version} and
            profile revision {draft.profile_version}.
            {draft.matched_skills.length
              ? ` Placed first because the job text mentions them: ${draft.matched_skills.join(", ")}.`
              : " No skill of yours was found in the job text, so nothing was reordered."}
          </p>
          {draft.gaps.length ? (
            <p className="input-help" role="note">
              Not in your profile or dossier, so left out:{" "}
              {draft.gaps.map((gap) => GAP_WORDS[gap]).join(", ")}.
            </p>
          ) : null}
          {draft.blocks.length === 0 ? (
            <p className="input-help">Your profile has nothing to build this from yet.</p>
          ) : null}
          <ol className="draft-blocks">
            {draft.blocks.map((block, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks are a fixed, ordered result.
              <li key={index} data-left={left.has(index)}>
                <label>
                  <input
                    type="checkbox"
                    checked={!left.has(index)}
                    onChange={(event) => {
                      const next = new Set(left);
                      if (event.target.checked) next.delete(index);
                      else next.add(index);
                      setLeft(next);
                      setRead(false);
                    }}
                  />
                  <span>
                    {block.heading ? <strong>{block.heading}</strong> : null}
                    <span className="draft-text">{block.text}</span>
                    <small>{origin(block)}</small>
                  </span>
                </label>
              </li>
            ))}
          </ol>
          <label className="application-field wide-field" htmlFor="draft-text">
            Draft text
            <textarea id="draft-text" readOnly rows={12} value={text} />
          </label>
          <label className="draft-confirm">
            <input
              type="checkbox"
              checked={read}
              onChange={(event) => setRead(event.target.checked)}
            />
            I have read this draft and will check and edit it before I use it.
          </label>
          <button type="button" disabled={!read || !text} onClick={() => void copy()}>
            Copy draft text
          </button>
        </div>
      ) : null}
    </section>
  );
}
