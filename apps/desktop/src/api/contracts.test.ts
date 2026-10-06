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

it("carries to-do items, preparation notes and document links, and counts open items", async () => {
  const record = { ...blankApplication(), version: 2, updated_at: "2026-10-06T00:00:00Z" };
  record.data.company = "Synthetic";
  record.data.preparation = "Notes";
  record.data.todos = [{ title: "Call", due_date: "2026-10-20", done: false }];
  record.data.document_ids = [crypto.randomUUID()];
  invoke.mockResolvedValue(record);
  expect((await getApplication(record.id)).data).toEqual(record.data);
  await saveApplication(record);
  expect(invoke).toHaveBeenLastCalledWith("applications", {
    payload: { action: "update", id: record.id, version: 2, data: record.data },
  });
  const item = {
    id: record.id,
    title: "",
    company: "Synthetic",
    status: "Saved",
    resume_sent: "",
    deadline_date: "",
    follow_up_date: "",
    open_todos: 1,
  };
  invoke.mockResolvedValue({ total: 1, items: [item] });
  expect((await listApplications("", 0)).items[0]?.open_todos).toBe(1);
  for (const open_todos of [undefined, -1, 31, "1"]) {
    invoke.mockResolvedValue({ total: 1, items: [{ ...item, open_todos }] });
    await expect(listApplications("", 0)).rejects.toThrow("Invalid application response");
  }
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
    { ...record, data: { ...record.data, preparation: 5 } },
    { ...record, data: { ...record.data, todos: undefined } },
    { ...record, data: { ...record.data, todos: [{ title: " ", due_date: "", done: false }] } },
    { ...record, data: { ...record.data, todos: [{ title: "Call", due_date: "", done: 1 }] } },
    { ...record, data: { ...record.data, todos: [{ title: "Call", due_date: "x", done: true }] } },
    {
      ...record,
      data: { ...record.data, todos: [{ title: "Call", due_date: "", done: true, by: "x" }] },
    },
    {
      ...record,
      data: { ...record.data, todos: Array(31).fill({ title: "t", due_date: "", done: false }) },
    },
    { ...record, data: { ...record.data, document_ids: ["not-a-uuid"] } },
    { ...record, data: { ...record.data, document_ids: [record.id, record.id] } },
    {
      ...record,
      data: { ...record.data, document_ids: Array.from({ length: 11 }, () => crypto.randomUUID()) },
    },
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
