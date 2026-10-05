import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object, text, uuid } from "./wire";

export const LISTING_PAGE_SIZE = 50;
export const ORIGINAL_LIMIT = 50000;

export const listingFields = [
  ["title", "Job title", 300],
  ["company", "Company", 300],
  ["location", "Location", 300],
  ["url", "Listing link", 2000],
  ["source", "Where you found it", 300],
  ["notes", "Your notes", 4000],
] as const;

export type ListingField = (typeof listingFields)[number][0];
export type ListingData = Record<ListingField, string>;
export type ListingOrigin = "pasted" | "manual";
export type ListingRecord = {
  id: string;
  version: number;
  origin: ListingOrigin;
  data: ListingData;
  original_text: string;
  original_sha256: string;
  collected_at: string;
  updated_at: string;
  archived: boolean;
};
export type ListingSummary = {
  id: string;
  origin: ListingOrigin;
  title: string;
  company: string;
  location: string;
  collected_at: string;
  archived: boolean;
};
export type ListingPage = { total: number; items: ListingSummary[] };

export function blankListing(): ListingRecord {
  return {
    id: crypto.randomUUID(),
    version: 0,
    origin: "manual",
    data: { title: "", company: "", location: "", url: "", source: "", notes: "" },
    original_text: "",
    original_sha256: "",
    collected_at: "",
    updated_at: "",
    archived: false,
  };
}

export function validLink(value: string): boolean {
  return /^(|https?:\/\/\S+)$/.test(value.trim());
}

function origin(value: unknown): boolean {
  return value === "pasted" || value === "manual";
}
function listingResult(value: unknown): ListingRecord {
  if (
    !object(value) ||
    !keys(value, [
      "id",
      "version",
      "origin",
      "data",
      "original_text",
      "original_sha256",
      "collected_at",
      "updated_at",
      "archived",
    ]) ||
    !uuid(value.id) ||
    !integer(value.version, 1) ||
    !origin(value.origin) ||
    !object(value.data) ||
    !keys(
      value.data,
      listingFields.map(([key]) => key),
    ) ||
    !listingFields.every(([key, , limit]) => text((value.data as ListingData)[key], limit)) ||
    !text(value.original_text, ORIGINAL_LIMIT) ||
    (value.origin === "pasted") !== value.original_text.length > 0 ||
    typeof value.original_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.original_sha256) ||
    !text(value.collected_at, 40) ||
    !text(value.updated_at, 40) ||
    typeof value.archived !== "boolean"
  )
    throw new Error("Invalid listing response");
  return value as ListingRecord;
}

export async function listListings(
  query: string,
  offset: number,
  archived: boolean,
): Promise<ListingPage> {
  const value = await invoke<unknown>("applications", {
    payload: { action: "listings_list", query, offset, archived },
  });
  if (
    !object(value) ||
    !keys(value, ["total", "items"]) ||
    !integer(value.total) ||
    !Array.isArray(value.items) ||
    value.items.length > LISTING_PAGE_SIZE ||
    value.items.length > value.total ||
    !value.items.every(
      (item: unknown) =>
        object(item) &&
        keys(item, ["id", "origin", "title", "company", "location", "collected_at", "archived"]) &&
        uuid(item.id) &&
        origin(item.origin) &&
        text(item.title, 300) &&
        text(item.company, 300) &&
        text(item.location, 300) &&
        text(item.collected_at, 40) &&
        item.archived === archived,
    )
  )
    throw new Error("Invalid listing response");
  return value as ListingPage;
}
export async function getListing(id: string): Promise<ListingRecord> {
  return listingResult(
    await invoke<unknown>("applications", { payload: { action: "listing_get", id } }),
  );
}
export async function saveListing(record: ListingRecord): Promise<ListingRecord> {
  const payload =
    record.version === 0
      ? {
          action: "listing_create",
          id: record.id,
          data: record.data,
          // Whitespace alone is not a listing; real pasted text is sent exactly as entered.
          original_text: record.original_text.trim() ? record.original_text : "",
        }
      : {
          action: "listing_update",
          id: record.id,
          version: record.version,
          data: record.data,
          archived: record.archived,
        };
  return listingResult(await invoke<unknown>("applications", { payload }));
}

const messages: Record<string, string> = {
  "Oracle's database is missing. Restore your workspace; an empty replacement has not been created.":
    "",
  "Oracle's workspace identity is missing or does not match. Close Oracle and restore the matching workspace files.":
    "",
  "This workspace needs a compatible Oracle version or a reviewed migration. Its schema was not reset.":
    "",
  "Oracle could not safely open the workspace. Close Oracle and check database access or restore a verified backup.":
    "",
  "Oracle's runtime stopped unexpectedly. Close and reopen Oracle before checking the last operation. It was not retried.":
    "",
  "This entry changed. Reload it before saving again.": "",
  "This application could not be found. Refresh the list.":
    "This listing could not be found. Refresh the list.",
  "Check your entry: a job title or company is required, and fields have length limits.":
    "Check the listing: paste its text or give a job title or company. Links must start with http:// or https://, and fields have length limits.",
  "Application details are too large.": "The listing is too large to save.",
};

export function listingError(error: unknown): string {
  return typeof error === "string" && Object.hasOwn(messages, error)
    ? messages[error] || error
    : "Oracle could not access your listings. Refresh, or reopen Oracle if this continues.";
}
