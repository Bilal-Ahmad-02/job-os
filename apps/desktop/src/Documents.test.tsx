import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { listDocuments } from "./api/documents";
import Documents from "./Documents";

vi.mock("./api/documents", () => ({ listDocuments: vi.fn() }));
beforeEach(() => vi.mocked(listDocuments).mockReset());

it("filters the register locally and keeps checksums inside a disclosure", async () => {
  vi.mocked(listDocuments).mockResolvedValue([
    {
      id: "synthetic",
      family_id: "synthetic",
      version: 1,
      previous_id: null,
      is_latest: true,
      filename: "Synthetic CV.pdf",
      kind: "cv",
      byte_size: 1024,
      page_count: 1,
      sha256: "a".repeat(64),
      imported_at: "2026-09-28T00:00:00Z",
      evidence_status: "source_only",
    },
    {
      id: "synthetic-2",
      family_id: "synthetic-2",
      version: 1,
      previous_id: null,
      is_latest: true,
      filename: "Course.pdf",
      kind: "certificate",
      byte_size: 2048,
      page_count: 2,
      sha256: "b".repeat(64),
      imported_at: "2026-09-28T00:00:00Z",
      evidence_status: "source_only",
    },
  ]);
  render(<Documents />);
  expect(await screen.findByText("Synthetic CV.pdf")).toBeVisible();
  expect(screen.getByText("a".repeat(64))).not.toBeVisible();
  fireEvent.change(screen.getByLabelText("Find a source document"), {
    target: { value: "certificate" },
  });
  expect(screen.queryByText("Synthetic CV.pdf")).not.toBeInTheDocument();
  expect(screen.getByText("Course.pdf")).toBeVisible();
  expect(listDocuments).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Find a source document"), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No sources match your filter.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  expect(screen.getByText("Synthetic CV.pdf")).toBeVisible();
});

it("hides internal errors and can recover through refresh", async () => {
  vi.mocked(listDocuments).mockRejectedValueOnce("private database path").mockResolvedValueOnce([]);
  render(<Documents />);
  expect(await screen.findByRole("alert")).not.toHaveTextContent("private database path");
  fireEvent.click(screen.getByRole("button", { name: "Refresh sources" }));
  expect(await screen.findByText("No source documents imported.")).toBeVisible();
});

it("groups versions, reveals preserved originals, and searches older filenames", async () => {
  const original = {
    id: "first",
    family_id: "first",
    version: 1,
    previous_id: null,
    is_latest: false,
    filename: "Old CV.pdf",
    kind: "cv" as const,
    byte_size: 100,
    page_count: 1,
    sha256: "a".repeat(64),
    imported_at: "2026-09-01",
    evidence_status: "source_only" as const,
  };
  vi.mocked(listDocuments).mockResolvedValue([
    original,
    {
      ...original,
      id: "second",
      version: 2,
      previous_id: "first",
      is_latest: true,
      filename: "Current CV.pdf",
      sha256: "b".repeat(64),
    },
  ]);
  render(<Documents />);
  expect(await screen.findByText("Current CV.pdf")).toBeVisible();
  expect(screen.getByText("LATEST / V2")).toBeVisible();
  expect(screen.getByText("V1 / Old CV.pdf")).not.toBeVisible();
  fireEvent.click(screen.getByText("Current CV.pdf"));
  fireEvent.click(screen.getByText("Version history (2)"));
  expect(screen.getByText("V1 / Old CV.pdf")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Find a source document"), {
    target: { value: "Old CV" },
  });
  expect(screen.getByText("Current CV.pdf")).toBeVisible();
  expect(screen.getByText("V1 / Old CV.pdf")).toBeVisible();
});
