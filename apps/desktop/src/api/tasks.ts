import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object, text, uuid } from "./wire";

export const states = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export type TaskState = (typeof states)[number];
export const taskErrors: Record<string, string> = {
  "": "",
  document_invalid: "The PDF could not be read safely.",
  document_timeout: "The document exceeded its processing deadline.",
  source_no_text: "No readable text was found. OCR is not available yet.",
  source_changed: "The stored source did not match its recorded identity.",
  source_missing: "The source document is unavailable.",
  interrupted: "The worker stopped before confirming this document.",
  storage: "The operation failed. Check the workspace before retrying.",
};
export type Task = {
  id: string;
  kind: "document_extract";
  state: TaskState;
  version: number;
  total: number;
  completed: number;
  attempt: number;
  error: string;
  document_ids: string[];
  created_at: string;
  updated_at: string;
};
export function taskResult(value: unknown): Task {
  if (
    !object(value) ||
    !keys(value, [
      "id",
      "kind",
      "state",
      "version",
      "total",
      "completed",
      "attempt",
      "error",
      "document_ids",
      "created_at",
      "updated_at",
    ]) ||
    !uuid(value.id) ||
    value.kind !== "document_extract" ||
    !states.some((state) => state === value.state) ||
    !integer(value.version, 1) ||
    !integer(value.total, 1, 100) ||
    !integer(value.completed, 0, value.total) ||
    !integer(value.attempt, 1, 3) ||
    typeof value.error !== "string" ||
    !Object.hasOwn(taskErrors, value.error) ||
    !Array.isArray(value.document_ids) ||
    value.document_ids.length !== value.total ||
    !value.document_ids.every(uuid) ||
    new Set(value.document_ids).size !== value.total ||
    !text(value.created_at, 40) ||
    !text(value.updated_at, 40) ||
    (value.state === "succeeded" && value.completed !== value.total)
  )
    throw new Error("Invalid task response");
  return value as Task;
}
export async function listTasks(): Promise<Task[]> {
  const result = await invoke<unknown>("applications", { payload: { action: "tasks_list" } });
  if (
    !object(result) ||
    !keys(result, ["items"]) ||
    !Array.isArray(result.items) ||
    result.items.length > 100
  )
    throw new Error("Invalid task list");
  const tasks = result.items.map(taskResult);
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length)
    throw new Error("Duplicate task ID");
  return tasks;
}
export async function createTask(id: string, documentIds: string[]): Promise<Task> {
  return taskResult(
    await invoke<unknown>("applications", {
      payload: { action: "task_create", id, document_ids: documentIds },
    }),
  );
}
export async function changeTask(
  task: Task,
  action: "task_advance" | "task_cancel" | "task_retry",
): Promise<Task> {
  return taskResult(
    await invoke<unknown>("applications", {
      payload: { action, id: task.id, version: task.version },
    }),
  );
}
