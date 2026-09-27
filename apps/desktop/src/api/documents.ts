import { invoke } from "@tauri-apps/api/core";
import { integer, keys, object, text, uuid } from "./wire";

export type DocumentSummary = {
  id: string;
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
          "filename",
          "kind",
          "byte_size",
          "page_count",
          "sha256",
          "imported_at",
          "evidence_status",
        ]) &&
        uuid(item.id) &&
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
  return result.items as DocumentSummary[];
}
