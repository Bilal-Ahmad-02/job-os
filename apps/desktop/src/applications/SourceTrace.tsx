import { type ApplicationRecord, fields } from "../api/applications";

export default function SourceTrace({
  source,
}: {
  source: NonNullable<ApplicationRecord["imported"]>;
}) {
  return (
    <details className="import-details">
      <summary>TRACE / Original spreadsheet entry · row {source.row}</summary>
      <p className="input-help">
        Preserved from {source.sheet}. Editing this dossier does not change its source.
      </p>
      <dl>
        {fields.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{source.original[key] || "Not provided"}</dd>
          </div>
        ))}
      </dl>
      {Object.entries(source.links).map(([cell, target]) => (
        <p key={cell} className="original-link">
          Embedded link ({cell}): {target}
        </p>
      ))}
    </details>
  );
}
