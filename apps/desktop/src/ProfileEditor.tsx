import { useEffect, useRef, useState } from "react";
import {
  type Candidate,
  type CandidateProfile,
  type Entry,
  getProfile,
  profileProblem,
  type Section,
  saveProfile,
  scalars,
  sectionLimits,
  sections,
} from "./api/profile";
import EntryFields, { entryLabel } from "./profile/EntryFields";
import { newEntry, normalizedProfile } from "./profile/editorData";
import PreferencesFields from "./profile/PreferencesFields";
import ProfileSnapshot from "./profile/ProfileSnapshot";

type Session = { base: CandidateProfile; draft: Candidate; latest: CandidateProfile | null };
type Channel = "basics" | Section | "preferences";
const dirty = (session: Session) =>
  JSON.stringify(session.base.data) !== JSON.stringify(session.draft);

export default function ProfileEditor({
  refresh = 0,
  onSaved,
}: {
  refresh?: number;
  onSaved?: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [channel, setChannel] = useState<Channel>("basics");
  const [selection, setSelection] = useState("");
  const [remove, setRemove] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const request = useRef(0);
  const pending = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit refresh signals reload persisted state; draft edits never trigger reads.
  useEffect(() => {
    const generation = ++request.current;
    pending.current = true;
    setBusy(true);
    setError("");
    getProfile()
      .then((result) => {
        if (request.current !== generation) return;
        setSession((current) =>
          current && dirty(current)
            ? { ...current, latest: result }
            : { base: result, draft: structuredClone(result.data), latest: null },
        );
        setUncertain(false);
      })
      .catch(() => {
        if (request.current === generation)
          setError(
            "Oracle could not load the saved profile. Your draft is retained. Check the local workspace and retry.",
          );
      })
      .finally(() => {
        if (request.current === generation) {
          pending.current = false;
          setBusy(false);
        }
      });
    return () => {
      request.current++;
    };
  }, [reload, refresh]);

  function edit(next: Candidate) {
    setSession((current) => (current ? { ...current, draft: next } : null));
    setNotice("");
  }
  async function save() {
    if (
      !session ||
      pending.current ||
      uncertain ||
      (session.latest && session.latest.version !== session.base.version)
    )
      return;
    const data = normalizedProfile(session.draft);
    const problem = profileProblem(data);
    if (problem) {
      setError(problem);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const generation = ++request.current;
    try {
      const saved = await saveProfile(session.base.version, data);
      if (generation !== request.current) return;
      setSession({ base: saved, draft: structuredClone(saved.data), latest: null });
      setNotice("Profile saved. Original documents and evidence decisions are unchanged.");
      onSaved?.();
    } catch (reason) {
      if (generation !== request.current) return;
      setUncertain(true);
      setError(
        reason === "This entry changed. Reload it before saving again."
          ? "The saved profile changed elsewhere. Your draft is retained. Check latest saved profile and compare before replacing your draft."
          : "Save was not confirmed. Your draft is retained. Check latest saved profile before trying again; Oracle will not automatically repeat a write.",
      );
    } finally {
      if (generation === request.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  function replaceDraft(profile: CandidateProfile) {
    setSession({ base: profile, draft: structuredClone(profile.data), latest: null });
    setUncertain(false);
    setError("");
    setRemove("");
    setNotice("Draft replaced with saved profile.");
  }
  const data = session?.draft;
  const section = Object.hasOwn(sections, channel) ? (channel as Section) : null;
  const entries = section && data ? data[section] : [];
  const selected = entries.find((entry) => entry.id === selection) ?? entries[0];
  const changed = session ? dirty(session) : false;
  const stale = session?.latest && session.latest.version !== session.base.version;
  return (
    <section className="profile-editor" aria-label="Saved candidate profile" aria-busy={busy}>
      <header className="review-toolbar">
        <div>
          <p className="eyebrow">PROFILE / OWNER PROVIDED</p>
          <p>
            Edit what Oracle may use about you. Manual entries are your assertions, not verified
            credentials.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setNotice("");
            setReload((n) => n + 1);
          }}
        >
          Check latest saved profile
        </button>
      </header>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!session && busy && <p role="status">Loading saved profile…</p>}
      {session && data && (
        <>
          <div className="index-readout">
            <span>PROFILE REV / {session.base.version}</span>
            <span>{changed ? "UNSAVED CHANGES" : "SAVED STATE"}</span>
            <span>{stale ? "NEWER SAVED REVISION" : "OWNER PROVIDED"}</span>
          </div>
          <nav className="profile-channels" aria-label="Profile sections">
            {(["basics", ...Object.keys(sections), "preferences"] as Channel[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-current={key === channel ? "page" : undefined}
                onClick={() => {
                  setChannel(key);
                  setSelection("");
                  setRemove("");
                }}
              >
                {key === "basics"
                  ? "Basic details"
                  : key === "preferences"
                    ? "Job preferences"
                    : key}
              </button>
            ))}
          </nav>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset className="profile-edit-fields" disabled={busy}>
              <legend>
                {channel === "basics"
                  ? "Basic details"
                  : channel === "preferences"
                    ? "Job preferences"
                    : channel}
              </legend>
              {channel === "basics" && (
                <div className="profile-fields">
                  {scalars.map((key) => (
                    <div key={key} className={key === "summary" ? "wide-field" : undefined}>
                      <label htmlFor={`profile-${key}`}>{key.replaceAll("_", " ")}</label>
                      {key === "summary" ? (
                        <textarea
                          id={`profile-${key}`}
                          rows={5}
                          maxLength={4000}
                          value={data[key]}
                          onChange={(event) => edit({ ...data, [key]: event.target.value })}
                        />
                      ) : (
                        <input
                          id={`profile-${key}`}
                          maxLength={300}
                          value={data[key]}
                          onChange={(event) => edit({ ...data, [key]: event.target.value })}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {channel === "preferences" && (
                <PreferencesFields
                  value={data.preferences}
                  onChange={(preferences) => edit({ ...data, preferences })}
                />
              )}
              {section && (
                <>
                  <div className="profile-entry-toolbar">
                    <span>
                      {entries.length} / {sectionLimits[section]} entries
                    </span>
                    <button
                      type="button"
                      disabled={entries.length >= sectionLimits[section]}
                      onClick={() => {
                        const entry = newEntry(section);
                        edit({ ...data, [section]: [...entries, entry] });
                        setSelection(entry.id);
                        setRemove("");
                      }}
                    >
                      Add{" "}
                      {section === "experience"
                        ? "experience"
                        : section === "education"
                          ? "education"
                          : section === "skills"
                            ? "skill"
                            : section === "projects"
                              ? "project"
                              : "certificate"}
                    </button>
                  </div>
                  {entries.length === 0 ? (
                    <p>
                      No {section} recorded. Add an entry or approve a supported claim in Evidence
                      review.
                    </p>
                  ) : (
                    <div className="review-layout">
                      <nav className="review-index" aria-label={`${section} entries`}>
                        {entries.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            aria-current={entry.id === selected?.id ? "true" : undefined}
                            onClick={() => {
                              setSelection(entry.id);
                              setRemove("");
                            }}
                          >
                            {entryLabel(entry)}
                          </button>
                        ))}
                      </nav>
                      {selected && (
                        <div className="review-detail">
                          <EntryFields
                            target={`${section}/${selected.id}`}
                            value={selected}
                            onChange={(value) =>
                              edit({
                                ...data,
                                [section]: entries.map((entry) =>
                                  entry.id === selected.id ? (value as Entry) : entry,
                                ),
                              })
                            }
                          />
                          <div className="review-actions">
                            {remove === selected.id ? (
                              <>
                                <p>
                                  Remove this entry from your profile when you save? Original
                                  sources remain in the Vault.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    edit({
                                      ...data,
                                      [section]: entries.filter(
                                        (entry) => entry.id !== selected.id,
                                      ),
                                    });
                                    setRemove("");
                                    setSelection("");
                                  }}
                                >
                                  Confirm removal from draft
                                </button>
                                <button type="button" onClick={() => setRemove("")}>
                                  Keep entry
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setRemove(selected.id)}>
                                Remove entry
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="review-actions">
                <button type="submit" disabled={!changed || uncertain || Boolean(stale)}>
                  {busy ? "Saving…" : "Save profile"}
                </button>
                <button type="button" disabled={!changed} onClick={() => setRemove("discard")}>
                  Discard draft changes
                </button>
              </div>
              {remove === "discard" && (
                <div className="profile-discard">
                  <p>Discard all unsaved profile edits and return to the loaded revision?</p>
                  <button type="button" onClick={() => replaceDraft(session.base)}>
                    Confirm discard
                  </button>
                  <button type="button" onClick={() => setRemove("")}>
                    Keep editing
                  </button>
                </div>
              )}
            </fieldset>
          </form>
          <p className="field-hint">
            Changing modules retains this draft. Locking or closing Oracle clears unsaved edits.
            Source review decisions are managed separately in Evidence review.
          </p>
          {session.latest && (
            <aside className="profile-latest" aria-label="Latest saved profile comparison">
              <p>
                {stale
                  ? "A newer saved revision is available. Compare it with your draft before continuing."
                  : "Latest saved state loaded. Your draft has not been replaced."}
              </p>
              <details open={Boolean(stale)}>
                <summary>Compare latest saved profile</summary>
                <ProfileSnapshot profile={session.latest} />
              </details>
              <button
                type="button"
                disabled={busy}
                onClick={() => replaceDraft(session.latest ?? session.base)}
              >
                Use latest saved profile — discard my draft
              </button>
            </aside>
          )}
        </>
      )}
    </section>
  );
}
