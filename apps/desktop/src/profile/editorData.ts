import {
  type Candidate,
  type Entry,
  type Field,
  preferenceLists,
  type Section,
  sections,
} from "../api/profile";

export function newEntry(section: Section): Entry {
  return Object.fromEntries([
    ["id", crypto.randomUUID()],
    ...(sections[section] as Field[]).map((field) => [
      field.key,
      field.kind === "boolean" ? false : field.kind === "list" ? [] : (field.options?.[0] ?? ""),
    ]),
  ]) as Entry;
}
export function normalizedProfile(data: Candidate): Candidate {
  const copy = structuredClone(data);
  for (const project of copy.projects) {
    if (Array.isArray(project.technologies))
      project.technologies = project.technologies.map((item) => item.trim()).filter(Boolean);
  }
  for (const key of preferenceLists) {
    copy.preferences[key] = copy.preferences[key].map((item) => item.trim()).filter(Boolean);
  }
  return copy;
}
