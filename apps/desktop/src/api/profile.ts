import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object, text, uuid } from "./wire";

export type Field = {
  key: string;
  label: string;
  max?: number;
  required?: boolean;
  kind?: "month" | "boolean" | "list" | "long";
  options?: readonly string[];
};
const period: Field[] = [
  { key: "start_month", label: "Start month", kind: "month" },
  { key: "end_month", label: "End month", kind: "month" },
  { key: "current", label: "Currently active", kind: "boolean" },
];
export const sections = {
  experience: [
    { key: "role", label: "Role", required: true },
    { key: "organization", label: "Organization", required: true },
    { key: "location", label: "Location" },
    ...period,
    { key: "description", label: "Description", kind: "long" },
  ],
  education: [
    { key: "institution", label: "Institution", required: true },
    { key: "qualification", label: "Qualification", required: true },
    { key: "field_of_study", label: "Field of study" },
    ...period,
    {
      key: "completion",
      label: "Completion",
      options: ["unspecified", "in_progress", "completed"],
    },
    { key: "details", label: "Details", kind: "long" },
  ],
  skills: [
    { key: "name", label: "Skill", required: true },
    { key: "category", label: "Category" },
    { key: "details", label: "Details", kind: "long" },
  ],
  projects: [
    { key: "name", label: "Project", required: true },
    { key: "role", label: "Role" },
    ...period,
    { key: "description", label: "Description", kind: "long" },
    { key: "technologies", label: "Technologies (one per line)", kind: "list" },
    { key: "url", label: "Reference URL", max: 1000 },
  ],
  certifications: [
    { key: "name", label: "Certificate", required: true },
    { key: "issuer", label: "Issuer", required: true },
    { key: "issued_month", label: "Issued month", kind: "month" },
    { key: "expires_month", label: "Expiry month", kind: "month" },
    { key: "credential_reference", label: "Credential reference" },
    { key: "details", label: "Details", kind: "long" },
  ],
} satisfies Record<string, Field[]>;
export type Section = keyof typeof sections;
export const scalars = ["full_name", "headline", "location", "summary"] as const;
export type Scalar = (typeof scalars)[number];
export type Entry = { id: string; [key: string]: string | boolean | string[] };
export const preferenceLists = [
  "target_roles",
  "locations",
  "excluded_employers",
  "excluded_keywords",
] as const;
export type Candidate = Record<Scalar, string> &
  Record<Section, Entry[]> & {
    preferences: {
      target_roles: string[];
      locations: string[];
      excluded_employers: string[];
      excluded_keywords: string[];
      work_modes: string[];
      employment_types: string[];
      constraints: string;
    };
  };
export type CandidateProfile = {
  version: number;
  updated_at: string;
  evidence_status: "user_provided";
  data: Candidate;
};
export const sectionLimits = {
  experience: 50,
  education: 30,
  skills: 100,
  projects: 50,
  certifications: 50,
};
export type Evidence = {
  target: string;
  citations: { document_id: string; page: number; excerpt: string }[];
  notes: string[];
};
export type ReviewState = {
  version: number;
  draft_sha256: string;
  draft: null | {
    created_at: string;
    status: "unreviewed";
    method: "assisted_import";
    payload: { data: Candidate; evidence: Evidence[]; warnings: string[] };
  };
  profile: CandidateProfile;
  decisions: { target: string; decision: "approved" | "rejected"; reviewed_at: string }[];
};
export function emptyCandidate(): Candidate {
  return {
    full_name: "",
    headline: "",
    location: "",
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    preferences: {
      target_roles: [],
      locations: [],
      excluded_employers: [],
      excluded_keywords: [],
      work_modes: [],
      employment_types: [],
      constraints: "",
    },
  };
}
export function targetValue(data: Candidate, target: string): string | Entry | undefined {
  if (scalars.includes(target as Scalar)) return data[target as Scalar];
  const [section, id] = target.split("/");
  return section && Object.hasOwn(sections, section)
    ? data[section as Section].find((entry) => entry.id === id)
    : undefined;
}
export function singleCandidate(target: string, value: string | Entry): Candidate {
  const data = emptyCandidate();
  if (scalars.includes(target as Scalar)) data[target as Scalar] = value as string;
  else data[target.split("/")[0] as Section] = [value as Entry];
  return data;
}
function strings(value: unknown, limit: number, length: number): value is string[] {
  return Array.isArray(value) && value.length <= limit && value.every((item) => text(item, length));
}
function fieldValid(value: unknown, field: Field): boolean {
  if (field.kind === "boolean") return typeof value === "boolean";
  if (field.kind === "list")
    return strings(value, 30, 300) && value.every((item) => item.trim().length > 0);
  if (!text(value, field.max ?? (field.kind === "long" ? 4000 : 300))) return false;
  if (field.required && !value.trim()) return false;
  if (field.kind === "month" && !/^(|[0-9]{4}-(0[1-9]|1[0-2]))$/.test(value)) return false;
  return !field.options || field.options.includes(value);
}
function candidate(value: unknown): value is Candidate {
  if (!object(value) || !keys(value, [...scalars, ...Object.keys(sections), "preferences"]))
    return false;
  if (!scalars.every((key) => text(value[key], key === "summary" ? 4000 : 300))) return false;
  const ids = new Set<string>();
  for (const section of Object.keys(sections) as Section[]) {
    const entries = value[section];
    if (!Array.isArray(entries) || entries.length > sectionLimits[section]) return false;
    for (const entry of entries) {
      if (
        !object(entry) ||
        !keys(entry, ["id", ...sections[section].map((field) => field.key)]) ||
        !uuid(entry.id) ||
        ids.has(entry.id) ||
        !sections[section].every((field) => fieldValid(entry[field.key], field))
      )
        return false;
      ids.add(entry.id);
    }
  }
  const p = value.preferences;
  return (
    object(p) &&
    keys(p, [...preferenceLists, "work_modes", "employment_types", "constraints"]) &&
    preferenceLists.every((key) => {
      const values = p[key];
      return strings(values, 20, 300) && values.every((item) => item.trim().length > 0);
    }) &&
    strings(p.work_modes, 3, 30) &&
    p.work_modes.every((v) => ["onsite", "hybrid", "remote"].includes(v)) &&
    strings(p.employment_types, 6, 30) &&
    p.employment_types.every((v) =>
      ["full_time", "part_time", "contract", "temporary", "internship", "traineeship"].includes(v),
    ) &&
    text(p.constraints, 4000)
  );
}
export function profileResult(value: unknown): CandidateProfile {
  if (
    !object(value) ||
    !keys(value, ["version", "updated_at", "evidence_status", "data"]) ||
    !integer(value.version) ||
    !text(value.updated_at, 40) ||
    value.evidence_status !== "user_provided" ||
    !candidate(value.data)
  ) {
    throw new Error("Invalid profile response");
  }
  return value as CandidateProfile;
}
export async function getProfile(): Promise<CandidateProfile> {
  return profileResult(
    await invoke<unknown>("applications", { payload: { action: "profile_get" } }),
  );
}
export async function saveProfile(version: number, data: Candidate): Promise<CandidateProfile> {
  return profileResult(
    await invoke<unknown>("applications", { payload: { action: "profile_save", version, data } }),
  );
}
export function profileProblem(data: Candidate): string | null {
  if (!candidate(data))
    return "Complete required entry fields and check field and collection limits. Empty sections are allowed.";
  for (const section of ["experience", "education", "projects"] as const) {
    for (const entry of data[section]) {
      if (
        (entry.current && entry.end_month) ||
        (entry.start_month && entry.end_month && entry.start_month > entry.end_month)
      )
        return `Check dates in ${section}: end month cannot precede start month or accompany a current entry.`;
      if (section === "education" && entry.current && entry.completion === "completed")
        return "Current education cannot be marked completed.";
    }
  }
  for (const entry of data.certifications) {
    if (entry.issued_month && entry.expires_month && entry.issued_month > entry.expires_month)
      return "Certificate expiry cannot precede its issue month.";
  }
  for (const values of [
    ...preferenceLists.map((key) => data.preferences[key]),
    data.preferences.work_modes,
    data.preferences.employment_types,
  ]) {
    if (new Set(values.map((value) => value.trim().toLowerCase())).size !== values.length)
      return "Remove repeated job preferences before saving.";
  }
  if (new TextEncoder().encode(JSON.stringify(data)).length > 256 * 1024)
    return "Profile exceeds the storage limit. Shorten lengthy descriptions.";
  return null;
}
export function reviewResult(value: unknown): ReviewState {
  const invalid = () => {
    throw new Error("Invalid profile review response");
  };
  if (
    !object(value) ||
    !keys(value, ["version", "draft_sha256", "draft", "profile", "decisions"]) ||
    !integer(value.version) ||
    !text(value.draft_sha256, 64)
  )
    return invalid();
  const profile = value.profile;
  if (
    !object(profile) ||
    !keys(profile, ["version", "updated_at", "evidence_status", "data"]) ||
    !integer(profile.version) ||
    !text(profile.updated_at, 40) ||
    profile.evidence_status !== "user_provided" ||
    !candidate(profile.data)
  )
    return invalid();
  const targets = new Set<string>();
  if (value.draft !== null) {
    const draft = value.draft;
    if (
      !/^[a-f0-9]{64}$/.test(value.draft_sha256) ||
      !object(draft) ||
      !keys(draft, ["created_at", "status", "method", "payload"]) ||
      !text(draft.created_at, 40) ||
      draft.status !== "unreviewed" ||
      draft.method !== "assisted_import"
    )
      return invalid();
    const p = draft.payload;
    if (
      !object(p) ||
      !keys(p, ["data", "evidence", "warnings"]) ||
      !candidate(p.data) ||
      !strings(p.warnings, 20, 1000) ||
      !Array.isArray(p.evidence) ||
      p.evidence.length > 284
    )
      return invalid();
    for (const item of p.evidence) {
      if (
        !object(item) ||
        !keys(item, ["target", "citations", "notes"]) ||
        !text(item.target, 100) ||
        !targetValue(p.data, item.target) ||
        targets.has(item.target) ||
        !strings(item.notes, 8, 1000) ||
        !Array.isArray(item.citations) ||
        item.citations.length < 1 ||
        item.citations.length > 5 ||
        !item.citations.every(
          (c: unknown) =>
            object(c) &&
            keys(c, ["document_id", "page", "excerpt"]) &&
            uuid(c.document_id) &&
            integer(c.page, 1, 100) &&
            text(c.excerpt, 6000) &&
            c.excerpt.trim().length > 0,
        )
      )
        return invalid();
      targets.add(item.target);
    }
  } else if (value.draft_sha256 !== "") return invalid();
  const seen = new Set<string>();
  if (
    !Array.isArray(value.decisions) ||
    value.decisions.length > 284 ||
    !value.decisions.every((item: unknown) => {
      if (
        !object(item) ||
        !keys(item, ["target", "decision", "reviewed_at"]) ||
        !text(item.target, 100) ||
        !targets.has(item.target) ||
        seen.has(item.target) ||
        !["approved", "rejected"].includes(String(item.decision)) ||
        !text(item.reviewed_at, 40)
      )
        return false;
      seen.add(item.target);
      return true;
    })
  )
    return invalid();
  return value as ReviewState;
}
export async function getReview(): Promise<ReviewState> {
  return reviewResult(
    await invoke<unknown>("applications", { payload: { action: "profile_review_get" } }),
  );
}
export async function saveReview(
  state: ReviewState,
  target: string,
  decision: "approved" | "rejected",
  data: Candidate | null,
): Promise<ReviewState> {
  return reviewResult(
    await invoke<unknown>("applications", {
      payload: {
        action: "profile_review_save",
        version: state.version,
        profile_version: state.profile.version,
        draft_sha256: state.draft_sha256,
        target,
        decision,
        data,
      },
    }),
  );
}
