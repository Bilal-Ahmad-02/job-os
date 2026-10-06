import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object, text, uuid } from "./wire";

export type DraftKind = "cv" | "cover_letter";
/** One removable piece of a draft, with where its facts came from. */
export type DraftBlock = {
  /** A section name in a CV; empty inside a letter. */
  heading: string;
  text: string;
  /** Profile fields ("summary") and entries ("experience/<id>") whose values appear in the text. */
  sources: string[];
  /** Whether the dossier's job title or company appears in the text. */
  uses_application: boolean;
};
export const gaps = [
  "full_name",
  "summary",
  "experience",
  "education",
  "skills",
  "title",
  "company",
] as const;
export type ApplicationDraft = {
  kind: DraftKind;
  template_version: 1;
  application_id: string;
  application_version: number;
  profile_version: number;
  blocks: DraftBlock[];
  gaps: (typeof gaps)[number][];
  matched_skills: string[];
};

const fields = ["full_name", "headline", "location", "summary"];
const sections = ["experience", "education", "skills", "projects", "certifications"];
function source(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const [section = "", identity, ...rest] = value.split("/");
  return identity === undefined
    ? fields.includes(section)
    : rest.length === 0 && sections.includes(section) && uuid(identity);
}
function block(value: unknown): boolean {
  return (
    object(value) &&
    keys(value, ["heading", "text", "sources", "uses_application"]) &&
    text(value.heading, 40) &&
    text(value.text, 12000) &&
    value.text.length > 0 &&
    Array.isArray(value.sources) &&
    value.sources.length <= 120 &&
    value.sources.every(source) &&
    typeof value.uses_application === "boolean"
  );
}

/**
 * Asks the local backend to assemble a draft for one saved dossier from the stored profile. It
 * is built with fixed templates on this computer; nothing is stored and nothing is sent.
 */
export async function buildDraft(id: string, kind: DraftKind): Promise<ApplicationDraft> {
  const value = await invoke<unknown>("applications", {
    payload: { action: "application_draft", id, kind },
  });
  if (
    !object(value) ||
    !keys(value, [
      "kind",
      "template_version",
      "application_id",
      "application_version",
      "profile_version",
      "blocks",
      "gaps",
      "matched_skills",
    ]) ||
    value.kind !== kind ||
    value.template_version !== 1 ||
    value.application_id !== id ||
    !integer(value.application_version, 1) ||
    !integer(value.profile_version) ||
    !Array.isArray(value.blocks) ||
    value.blocks.length > 300 ||
    !value.blocks.every(block) ||
    !Array.isArray(value.gaps) ||
    new Set(value.gaps).size !== value.gaps.length ||
    !value.gaps.every((gap: unknown) => gaps.some((known) => known === gap)) ||
    !Array.isArray(value.matched_skills) ||
    value.matched_skills.length > 100 ||
    !value.matched_skills.every((skill: unknown) => text(skill, 300))
  )
    throw new Error("Invalid draft response");
  return value as ApplicationDraft;
}
