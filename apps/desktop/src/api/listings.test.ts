import { beforeEach, expect, it, vi } from "vitest";
import {
  blankListing,
  deleteSearch,
  getListing,
  type ListingRecord,
  listingError,
  listListings,
  listSearches,
  saveListing,
  saveSearch,
  trackListing,
  validLink,
} from "./listings";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
beforeEach(() => invoke.mockReset());

function stored(changes: Partial<ListingRecord> = {}): ListingRecord {
  return {
    ...blankListing(),
    version: 1,
    origin: "pasted",
    original_text: "Synthetic listing text",
    original_sha256: "a".repeat(64),
    collected_at: "2026-10-05T12:00:00+00:00",
    updated_at: "2026-10-05T12:00:00+00:00",
    ...changes,
  };
}

it("creates with the pasted text exactly as entered and never sends server-owned fields", async () => {
  const draft = { ...blankListing(), original_text: "  Synthetic role\r\n\tRemote  " };
  invoke.mockResolvedValue(stored({ id: draft.id, original_text: draft.original_text }));
  await saveListing(draft);
  expect(invoke).toHaveBeenCalledWith("applications", {
    payload: {
      action: "listing_create",
      id: draft.id,
      data: draft.data,
      original_text: "  Synthetic role\r\n\tRemote  ",
    },
  });
  invoke.mockResolvedValue(stored({ id: draft.id, origin: "manual", original_text: "" }));
  await saveListing({ ...draft, original_text: " \n " });
  expect(invoke.mock.calls.at(-1)?.[1].payload.original_text).toBe("");
});

it("updates only owner fields, the archive flag and the revision", async () => {
  const record = stored({ archived: true });
  invoke.mockResolvedValue({ ...record, version: 2 });
  expect((await saveListing(record)).version).toBe(2);
  expect(invoke).toHaveBeenCalledWith("applications", {
    payload: {
      action: "listing_update",
      id: record.id,
      version: 1,
      data: record.data,
      archived: true,
      closed: false,
      shortlisted: false,
    },
  });
});

it("rejects malformed, inconsistent or extended listing records", async () => {
  const record = stored();
  const match = {
    id: crypto.randomUUID(),
    title: "Synthetic role",
    company: "",
    collected_at: "2026-10-01T12:00:00+00:00",
    archived: true,
    closed: false,
    reasons: ["same_text"],
  };
  for (const value of [
    null,
    { ...record, version: 0 },
    { ...record, origin: "scraped" },
    { ...record, origin: "manual" },
    { ...record, original_sha256: "short" },
    { ...record, archived: 1 },
    { ...record, data: { ...record.data, title: "x".repeat(301) } },
    { ...record, data: { title: "Only" } },
    { ...record, path: "/private" },
    { ...record, normalized: undefined },
    { ...record, closed: "yes" },
    { ...record, shortlisted: 1 },
    { ...record, application_id: "not-a-uuid" },
    { ...record, matches: undefined },
    { ...record, matches: [{ ...match, id: record.id }] },
    { ...record, matches: [match, match] },
    { ...record, matches: [{ ...match, reasons: [] }] },
    { ...record, matches: [{ ...match, reasons: ["same_vibe"] }] },
    { ...record, matches: [{ ...match, original_text: "private" }] },
    { ...record, normalized: { ...record.normalized, rules_version: 2 } },
    { ...record, normalized: { ...record.normalized, links: ["javascript:alert(1)"] } },
    { ...record, normalized: { ...record.normalized, mentioned_work_modes: ["remote", "remote"] } },
    { ...record, normalized: { ...record.normalized, mentioned_employment_types: ["ceo"] } },
    { ...record, normalized: { ...record.normalized, company: "Guessed AB" } },
  ]) {
    invoke.mockResolvedValue(value);
    await expect(getListing(record.id)).rejects.toThrow("Invalid listing response");
  }
  const flagged = { ...record, closed: true, matches: [match] };
  invoke.mockResolvedValue(flagged);
  expect(await getListing(record.id)).toEqual(flagged);
});

it("rejects pages that are oversized, malformed or from the other archive view", async () => {
  const item = {
    id: crypto.randomUUID(),
    origin: "pasted",
    title: "Synthetic role",
    suggested_title: "",
    company: "",
    location: "",
    collected_at: "2026-10-05T12:00:00+00:00",
    archived: false,
    closed: false,
    shortlisted: false,
    application_id: null,
    possible_duplicate: true,
  };
  invoke.mockResolvedValue({ total: 1, items: [item] });
  expect((await listListings("", 0, "incoming")).items).toEqual([item]);
  expect(invoke).toHaveBeenCalledWith("applications", {
    payload: { action: "listings_list", query: "", offset: 0, view: "incoming" },
  });
  for (const value of [
    { total: 0, items: [item] },
    { total: 1, items: [{ ...item, archived: true }] },
    { total: 1, items: [{ ...item, shortlisted: true }] },
    { total: 1, items: [{ ...item, application_id: crypto.randomUUID() }] },
    { total: 1, items: [{ ...item, original_text: "private" }] },
    { total: 1, items: [{ ...item, id: "bad" }] },
    { total: 1, items: [{ ...item, possible_duplicate: "maybe" }] },
    { total: 1, items: [item], extra: true },
  ]) {
    invoke.mockResolvedValue(value);
    await expect(listListings("", 0, "incoming")).rejects.toThrow("Invalid listing response");
  }
});

it("accepts only plain web links and redacts unknown failures", () => {
  expect(["", "https://example.test/job", " http://example.test "].every(validLink)).toBe(true);
  expect(
    ["javascript:alert(1)", "file:///c:/private", "example.test", "https://a b"].some(validLink),
  ).toBe(false);
  expect(listingError("private path /home/someone")).toMatch(/could not access your listings/);
  expect(listingError("This entry changed. Reload it before saving again.")).toBe(
    "This entry changed. Reload it before saving again.",
  );
  expect(listingError("This application could not be found. Refresh the list.")).toBe(
    "This listing could not be found. Refresh the list.",
  );
});

it("starts an application with a fresh dossier ID and requires the link in the reply", async () => {
  const record = stored();
  const application_id = crypto.randomUUID();
  invoke.mockResolvedValue({ ...record, version: 2, application_id });
  expect((await trackListing(record)).application_id).toBe(application_id);
  const payload = invoke.mock.calls.at(-1)?.[1].payload;
  expect(payload).toMatchObject({ action: "listing_track", id: record.id, version: 1 });
  expect(payload.application_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(Object.keys(payload)).toHaveLength(4);
  invoke.mockResolvedValue({ ...record, version: 2 });
  await expect(trackListing(record)).rejects.toThrow("Invalid listing response");
});

it("validates saved searches strictly and sends only the named filter", async () => {
  const search = { id: crypto.randomUUID(), name: "Data roles", query: "data", view: "shortlist" };
  invoke.mockResolvedValue({ items: [search] });
  expect(await listSearches()).toEqual([search]);
  expect(await saveSearch("Data roles", "data", "shortlist")).toEqual([search]);
  expect(invoke.mock.calls.at(-1)?.[1].payload).toMatchObject({
    action: "listing_search_save",
    name: "Data roles",
    query: "data",
    view: "shortlist",
  });
  expect(await deleteSearch(search.id)).toEqual([search]);
  expect(invoke).toHaveBeenLastCalledWith("applications", {
    payload: { action: "listing_search_delete", id: search.id },
  });
  for (const value of [
    null,
    { items: [search, search] },
    { items: [{ ...search, view: "everything" }] },
    { items: [{ ...search, name: " " }] },
    { items: [{ ...search, results: [] }] },
    { items: Array.from({ length: 21 }, () => ({ ...search, id: crypto.randomUUID() })) },
  ]) {
    invoke.mockResolvedValue(value);
    await expect(listSearches()).rejects.toThrow("Invalid saved search response");
  }
});
