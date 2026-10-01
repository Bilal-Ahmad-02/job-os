import { invoke } from "@tauri-apps/api/core";
import { expect, it, vi } from "vitest";
import { listTasks, taskResult } from "./tasks";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const task = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "document_extract",
  state: "queued",
  version: 1,
  total: 1,
  completed: 0,
  attempt: 1,
  error: "",
  document_ids: ["22222222-2222-4222-8222-222222222222"],
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};
it("rejects unknown actions, leaked errors, invalid progress and unbounded task payloads", () => {
  expect(taskResult(task)).toEqual(task);
  for (const changes of [
    { kind: "shell" },
    { error: "private filesystem path" },
    { completed: 2 },
    { state: "succeeded" },
    { attempt: 4 },
    { extra: "unexpected" },
    { document_ids: [task.document_ids[0], task.document_ids[0]], total: 2 },
  ])
    expect(() => taskResult({ ...task, ...changes })).toThrow();
});
it("rejects duplicate task rows and oversized lists", async () => {
  vi.mocked(invoke).mockResolvedValueOnce({ items: [task, task] });
  await expect(listTasks()).rejects.toThrow();
  vi.mocked(invoke).mockResolvedValueOnce({ items: Array(101).fill(task) });
  await expect(listTasks()).rejects.toThrow();
});
