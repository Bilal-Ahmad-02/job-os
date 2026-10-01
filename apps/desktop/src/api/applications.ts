import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object, text, uuid } from "./wire";

export const APPLICATION_PAGE_SIZE = 50;

export const fields = [
  ["title", "Job title"],
  ["company", "Company"],
  ["website", "Website / job URL"],
  ["source", "Discovery source"],
  ["learning", "Topics to learn"],
  ["resume_sent", "Resume sent (date)"],
  ["how_sent", "How sent"],
  ["references_sent", "References sent"],
  ["description", "Job description / keywords"],
  ["status_notes", "Application status / date notes"],
  ["interview", "Interview / date"],
  ["follow_up", "Follow-up (how / date)"],
  ["notes", "Other comments"],
] as const;

export const statuses = [
  "Unspecified",
  "Saved",
  "Preparing",
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;

export type FieldName = (typeof fields)[number][0];
export type ApplicationData = Record<FieldName, string> & { status: (typeof statuses)[number] };
export type ApplicationSummary = {
  id: string;
  title: string;
  company: string;
  status: string;
  resume_sent: string;
};
export type ApplicationPage = { total: number; items: ApplicationSummary[] };
export type ApplicationRecord = {
  id: string;
  version: number;
  data: ApplicationData;
  updated_at: string;
  imported: null | {
    sheet: string;
    row: number;
    original: Record<FieldName, string>;
    links: Record<string, string>;
  };
};

export function blankApplication(): ApplicationRecord {
  return {
    id: crypto.randomUUID(),
    version: 0,
    updated_at: "",
    imported: null,
    data: {
      title: "",
      company: "",
      website: "",
      source: "",
      learning: "",
      resume_sent: "",
      how_sent: "",
      references_sent: "",
      description: "",
      status_notes: "",
      interview: "",
      follow_up: "",
      notes: "",
      status: "Unspecified",
    },
  };
}

function status(value: unknown): boolean {
  return statuses.some((candidate) => candidate === value);
}
function sourceFields(value: unknown, withStatus: boolean): boolean {
  return (
    object(value) &&
    keys(value, [...fields.map(([key]) => key), ...(withStatus ? ["status"] : [])]) &&
    fields.every(([key]) =>
      text(
        value[key],
        withStatus && ["title", "company", "resume_sent"].includes(key) ? 1000 : 10000,
      ),
    ) &&
    (!withStatus || status(value.status))
  );
}
function provenance(value: unknown): boolean {
  return (
    value === null ||
    (object(value) &&
      keys(value, ["sheet", "row", "original", "links"]) &&
      text(value.sheet, 1000) &&
      integer(value.row, 1) &&
      sourceFields(value.original, false) &&
      object(value.links) &&
      Object.keys(value.links).length <= 13 &&
      Object.values(value.links).every((link) => text(link, 10000)))
  );
}
function recordResult(value: unknown): ApplicationRecord {
  if (
    !object(value) ||
    !keys(value, ["id", "version", "data", "updated_at", "imported"]) ||
    !uuid(value.id) ||
    !integer(value.version, 1) ||
    !sourceFields(value.data, true) ||
    !text(value.updated_at, 40) ||
    !provenance(value.imported)
  )
    throw new Error("Invalid application response");
  return value as ApplicationRecord;
}
export async function listApplications(query: string, offset: number): Promise<ApplicationPage> {
  const value = await invoke<unknown>("applications", {
    payload: { action: "list", query, offset },
  });
  if (
    !object(value) ||
    !keys(value, ["total", "items"]) ||
    !integer(value.total) ||
    !Array.isArray(value.items) ||
    value.items.length > APPLICATION_PAGE_SIZE ||
    value.items.length > value.total ||
    !value.items.every(
      (item: unknown) =>
        object(item) &&
        keys(item, ["id", "title", "company", "status", "resume_sent"]) &&
        uuid(item.id) &&
        text(item.title, 1000) &&
        text(item.company, 1000) &&
        status(item.status) &&
        text(item.resume_sent, 1000),
    )
  ) {
    throw new Error("Invalid application response");
  }
  return value as ApplicationPage;
}
export async function getApplication(id: string): Promise<ApplicationRecord> {
  return recordResult(await invoke<unknown>("applications", { payload: { action: "get", id } }));
}
export async function saveApplication(record: ApplicationRecord): Promise<ApplicationRecord> {
  return recordResult(
    await invoke<unknown>("applications", {
      payload: {
        action: record.version === 0 ? "create" : "update",
        id: record.id,
        version: record.version,
        data: record.data,
      },
    }),
  );
}

const safeErrors = new Set([
  "Oracle's database is missing. Restore your workspace; an empty replacement has not been created.",
  "Oracle's workspace identity is missing or does not match. Close Oracle and restore the matching workspace files.",
  "This workspace needs a compatible Oracle version or a reviewed migration. Its schema was not reset.",
  "An Oracle workspace already exists. Initialization will not replace it.",
  "Oracle could not safely open the workspace. Close Oracle and check database access or restore a verified backup.",
  "This entry changed. Reload it before saving again.",
  "This application could not be found. Refresh the list.",
  "Check your entry: a job title or company is required, and fields have length limits.",
  "Application details are too large.",
]);

export function applicationError(error: unknown): string {
  return typeof error === "string" && safeErrors.has(error)
    ? error
    : "Oracle could not access your applications. Check the local Python setup and retry.";
}
