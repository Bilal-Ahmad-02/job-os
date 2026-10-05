import { beforeEach, expect, it, vi } from "vitest";
import {
  blankApplication,
  getApplication,
  listApplications,
  saveApplication,
} from "./applications";
import { listDocuments } from "./documents";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
beforeEach(() => invoke.mockReset());

it("accepts a complete application and retains every field", async () => {
  const record = { ...blankApplication(), version: 1, updated_at: "2026-09-27T00:00:00Z" };
  invoke.mockResolvedValue(record);
  expect(await getApplication(record.id)).toEqual(record);
  expect(await saveApplication(record)).toEqual(record);
});

it.each([
  null,
  { total: -1, items: [] },
  { total: 0, items: [], unexpected: true },
  { total: 1, items: [{ id: "bad" }] },
])("rejects invalid application pages: %j", async (value) => {
  invoke.mockResolvedValue(value);
  await expect(listApplications("", 0)).rejects.toThrow("Invalid application response");
});

it("rejects incomplete records and malformed import provenance", async () => {
  const record = { ...blankApplication(), version: 1 };
  for (const value of [
    { ...record, data: { company: "Synthetic" } },
    { ...record, imported: { sheet: "Sheet", row: 2, original: {}, links: {} } },
    { ...record, version: 0 },
    { ...record, listing_id: "not-a-uuid" },
    { ...record, listing_id: undefined },
    { ...record, data: { ...record.data, deadline_date: "2026-02-30" } },
    { ...record, data: { ...record.data, follow_up_date: "soon" } },
  ]) {
    invoke.mockResolvedValue(value);
    await expect(getApplication(record.id)).rejects.toThrow("Invalid application response");
  }
});

it("accepts document metadata but rejects bytes, paths and unsupported evidence claims", async () => {
  const documentId = crypto.randomUUID();
  const item = {
    id: documentId,
    family_id: documentId,
    version: 1,
    previous_id: null,
    is_latest: true,
    filename: "source.pdf",
    kind: "cv",
    byte_size: 100,
    page_count: 1,
    sha256: "a".repeat(64),
    imported_at: "2026-09-27T00:00:00Z",
    evidence_status: "source_only",
  };
  invoke.mockResolvedValue({ items: [item] });
  expect(await listDocuments()).toEqual([item]);
  for (const changed of [
    { ...item, content: "private" },
    { ...item, path: "C:/private" },
    { ...item, evidence_status: "verified" },
    { ...item, page_count: 101 },
  ]) {
    invoke.mockResolvedValue({ items: [changed] });
    await expect(listDocuments()).rejects.toThrow("Invalid document response");
  }
});

it("rejects incomplete, branching, or inconsistent version histories", async () => {
  const firstId = crypto.randomUUID();
  const first = {
    id: firstId,
    family_id: firstId,
    version: 1,
    previous_id: null,
    is_latest: false,
    filename: "source.pdf",
    kind: "cv",
    byte_size: 100,
    page_count: 1,
    sha256: "a".repeat(64),
    imported_at: "2026-09-29",
    evidence_status: "source_only",
  };
  const second = {
    ...first,
    id: crypto.randomUUID(),
    previous_id: first.id,
    version: 2,
    is_latest: true,
  };
  invoke.mockResolvedValue({ items: [first, second] });
  expect(await listDocuments()).toEqual([first, second]);
  for (const items of [
    [second],
    [first, { ...second, previous_id: second.id }],
    [{ ...first, is_latest: true }, second],
    [first, { ...second, kind: "transcript" }],
    [first, second, { ...second, id: crypto.randomUUID() }],
  ]) {
    invoke.mockResolvedValue({ items });
    await expect(listDocuments()).rejects.toThrow("Invalid document response");
  }
});
