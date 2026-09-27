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
  ]) {
    invoke.mockResolvedValue(value);
    await expect(getApplication(record.id)).rejects.toThrow("Invalid application response");
  }
});

it("accepts document metadata but rejects bytes, paths and unsupported evidence claims", async () => {
  const item = {
    id: crypto.randomUUID(),
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
