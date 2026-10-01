import { useId } from "react";
import type { Candidate } from "../api/profile";

type Preferences = Candidate["preferences"];
export default function PreferencesFields({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (next: Preferences) => void;
}) {
  const prefix = useId();
  return (
    <div className="profile-fields">
      <div className="wide-field">
        <p className="eyebrow">SEARCH / PARAMETERS</p>
        <p>
          Define your search scope. Empty choices mean unspecified; multiple choices are
          alternatives. Remote work does not imply eligibility to work in every country.
        </p>
      </div>
      {(
        [
          ["target_roles", "Target roles"],
          ["locations", "Preferred locations"],
          ["excluded_employers", "Excluded employers"],
          ["excluded_keywords", "Excluded listing phrases"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`${prefix}-${key}`}>{label} (one per line)</label>
          <textarea
            id={`${prefix}-${key}`}
            rows={5}
            maxLength={6019}
            value={value[key].join("\n")}
            onChange={(event) => onChange({ ...value, [key]: event.target.value.split("\n") })}
          />
          <p className="field-hint">Up to 20 entries, 300 characters each.</p>
          {key === "excluded_employers" && (
            <p className="field-hint">Employer names to avoid. Keep one name per line.</p>
          )}
          {key === "excluded_keywords" && (
            <p className="field-hint">
              Words or phrases to flag in job listings. Plain text, not regular expressions or
              commands. Broad terms can exclude otherwise useful roles.
            </p>
          )}
        </div>
      ))}
      {(
        [
          ["work_modes", ["onsite", "hybrid", "remote"]],
          [
            "employment_types",
            ["full_time", "part_time", "contract", "temporary", "internship", "traineeship"],
          ],
        ] as const
      ).map(([key, options]) => (
        <fieldset className="preference-options" key={key}>
          <legend>{key === "work_modes" ? "Work arrangements" : "Employment types"}</legend>
          {options.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={value[key].includes(option)}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [key]: event.target.checked
                      ? [...value[key], option]
                      : value[key].filter((item) => item !== option),
                  })
                }
              />
              {option.replaceAll("_", " ")}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="wide-field">
        <label htmlFor={`${prefix}-constraints`}>Other constraints and review notes</label>
        <textarea
          id={`${prefix}-constraints`}
          rows={5}
          maxLength={4000}
          value={value.constraints}
          onChange={(event) => onChange({ ...value, constraints: event.target.value })}
        />
        <p className="field-hint">
          Use notes for salary, commute, eligibility or other conditions needing review. Oracle does
          not interpret these notes as automatic rules. Existing notes are kept as written.
        </p>
      </div>
      <p className="wide-field field-hint">
        Save profile to retain these choices locally. Search and matching are upcoming steps; saving
        does not contact a job source, send your profile or start a search.
      </p>
    </div>
  );
}
