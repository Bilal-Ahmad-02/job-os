import { type CandidateProfile, type Section, scalars, sections } from "../api/profile";
import { ReadValue } from "./EntryFields";

export default function ProfileSnapshot({ profile }: { profile: CandidateProfile }) {
  return (
    <div className="profile-snapshot">
      <p>Latest saved revision: {profile.version}. Your draft above is unchanged.</p>
      {scalars.map((key) => (
        <ReadValue key={key} target={key} value={profile.data[key]} />
      ))}
      {(Object.keys(sections) as Section[]).map((section) => (
        <section key={section}>
          <h3>{section}</h3>
          {profile.data[section].length === 0 ? (
            <p>No entries.</p>
          ) : (
            profile.data[section].map((entry) => (
              <ReadValue key={entry.id} target={`${section}/${entry.id}`} value={entry} />
            ))
          )}
        </section>
      ))}
      <h3>Job preferences</h3>
      <dl className="profile-values">
        {Object.entries(profile.data.preferences).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>{(Array.isArray(value) ? value.join(", ") : value) || "Not specified"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
