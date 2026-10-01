import { useId } from "react";
import {
  type Entry,
  type Field,
  type Scalar,
  type Section,
  scalars,
  sections,
} from "../api/profile";

export function entryLabel(value: string | Entry): string {
  if (typeof value === "string") return value;
  return String(value.role || value.name || value.institution || "Profile entry");
}
export function fieldSpecs(target: string): Field[] {
  return scalars.includes(target as Scalar)
    ? [
        {
          key: target,
          label: target.replaceAll("_", " "),
          ...(target === "summary" ? { kind: "long" as const } : {}),
          required: true,
        },
      ]
    : sections[target.split("/")[0] as Section];
}
export function ReadValue({ target, value }: { target: string; value: string | Entry }) {
  return (
    <dl className="profile-values">
      {fieldSpecs(target).map((field) => {
        const item = typeof value === "string" ? value : value[field.key];
        const display = Array.isArray(item)
          ? item.join(", ")
          : typeof item === "boolean"
            ? item
              ? "Yes"
              : "No"
            : item;
        return (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>{display || "Not specified"}</dd>
          </div>
        );
      })}
    </dl>
  );
}
export default function EntryFields({
  target,
  value,
  onChange,
}: {
  target: string;
  value: string | Entry;
  onChange: (value: string | Entry) => void;
}) {
  const prefix = useId();
  return (
    <div className="profile-fields">
      {fieldSpecs(target).map((field) => {
        const item = typeof value === "string" ? value : value[field.key];
        const id = `${prefix}-${field.key}`;
        const change = (next: string | boolean | string[]) => {
          if (typeof value === "string") onChange(String(next));
          else
            onChange({
              ...value,
              [field.key]: next,
              ...(field.key === "current" && next === true ? { end_month: "" } : {}),
            });
        };
        return (
          <div
            key={field.key}
            className={field.kind === "long" || field.kind === "list" ? "wide-field" : undefined}
          >
            <label htmlFor={id}>{field.label}</label>
            {field.kind === "boolean" ? (
              <input
                id={id}
                type="checkbox"
                checked={item === true}
                onChange={(event) => change(event.target.checked)}
              />
            ) : field.options ? (
              <select id={id} value={String(item)} onChange={(event) => change(event.target.value)}>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            ) : field.kind === "long" || field.kind === "list" ? (
              <textarea
                id={id}
                rows={field.kind === "list" ? 4 : 5}
                maxLength={field.kind === "list" ? 9029 : 4000}
                value={Array.isArray(item) ? item.join("\n") : String(item)}
                onChange={(event) =>
                  change(
                    field.kind === "list" ? event.target.value.split("\n") : event.target.value,
                  )
                }
              />
            ) : (
              <input
                id={id}
                type={field.kind === "month" ? "month" : "text"}
                required={field.required}
                maxLength={field.max ?? 300}
                value={String(item)}
                disabled={
                  field.key === "end_month" && typeof value !== "string" && value.current === true
                }
                onChange={(event) => change(event.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
