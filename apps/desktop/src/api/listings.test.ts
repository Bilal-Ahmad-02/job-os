import { beforeEach, expect, it, vi } from "vitest";
import {
  blankListing,
  getListing,
  type ListingRecord,
  listingError,
  listListings,
  saveListing,
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
    },
  });
});

it("rejects malformed, inconsistent or extended listing records", async () => {
  const record = stored();
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
  ]) {
    invoke.mockResolvedValue(value);
    await expect(getListing(record.id)).rejects.toThrow("Invalid listing response");
  }
  invoke.mockResolvedValue(record);
  expect(await getListing(record.id)).toEqual(record);
});

it("rejects pages that are oversized, malformed or from the other archive view", async () => {
  const item = {
    id: crypto.randomUUID(),
    origin: "pasted",
    title: "Synthetic role",
    company: "",
    location: "",
    collected_at: "2026-10-05T12:00:00+00:00",
    archived: false,
  };
  invoke.mockResolvedValue({ total: 1, items: [item] });
  expect((await listListings("", 0, false)).items).toEqual([item]);
  expect(invoke).toHaveBeenCalledWith("applications", {
    payload: { action: "listings_list", query: "", offset: 0, archived: false },
  });
  for (const value of [
    { total: 0, items: [item] },
    { total: 1, items: [{ ...item, archived: true }] },
    { total: 1, items: [{ ...item, original_text: "private" }] },
    { total: 1, items: [{ ...item, id: "bad" }] },
    { total: 1, items: [item], extra: true },
  ]) {
    invoke.mockResolvedValue(value);
    await expect(listListings("", 0, false)).rejects.toThrow("Invalid listing response");
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
