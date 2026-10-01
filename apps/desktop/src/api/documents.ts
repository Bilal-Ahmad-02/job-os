import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object, text, uuid } from "./wire";

export type DocumentSummary = {
  id: string;
  family_id: string;
  version: number;
  previous_id: string | null;
  is_latest: boolean;
  filename: string;
  kind: "cv" | "certificate" | "transcript";
  byte_size: number;
  page_count: number;
  sha256: string;
  imported_at: string;
  evidence_status: "source_only";
};
export async function listDocuments(): Promise<DocumentSummary[]> {
  const result = await invoke<unknown>("applications", { payload: { action: "documents_list" } });
  if (
    !object(result) ||
    !keys(result, ["items"]) ||
    !Array.isArray(result.items) ||
    result.items.length > 100 ||
    !result.items.every(
      (item: unknown) =>
        object(item) &&
        keys(item, [
          "id",
          "family_id",
          "version",
          "previous_id",
          "is_latest",
          "filename",
          "kind",
          "byte_size",
          "page_count",
          "sha256",
          "imported_at",
          "evidence_status",
        ]) &&
        uuid(item.id) &&
        uuid(item.family_id) &&
        integer(item.version, 1, 100) &&
        typeof item.is_latest === "boolean" &&
        (item.version === 1
          ? item.previous_id === null && item.family_id === item.id
          : uuid(item.previous_id) && item.previous_id !== item.id && item.family_id !== item.id) &&
        text(item.filename, 255) &&
        item.filename.length > 0 &&
        ["cv", "certificate", "transcript"].some((kind) => kind === item.kind) &&
        integer(item.byte_size, 1, 10485760) &&
        integer(item.page_count, 1, 100) &&
        typeof item.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(item.sha256) &&
        text(item.imported_at, 40) &&
        item.evidence_status === "source_only",
    )
  ) {
    throw new Error("Invalid document response");
  }
  const items = result.items as DocumentSummary[];
  const byId = new Map(items.map((item) => [item.id, item]));
  if (byId.size !== items.length) throw new Error("Invalid document response");
  for (const item of items) {
    const family = items.filter((other) => other.family_id === item.family_id);
    const previous = item.previous_id ? byId.get(item.previous_id) : undefined;
    if (
      item.is_latest !== (item.version === Math.max(...family.map((v) => v.version))) ||
      new Set(family.map((v) => v.version)).size !== family.length ||
      (item.version > 1 &&
        (!previous ||
          previous.family_id !== item.family_id ||
          previous.kind !== item.kind ||
          previous.version + 1 !== item.version))
    ) {
      throw new Error("Invalid document response");
    }
  }
  return items;
}
