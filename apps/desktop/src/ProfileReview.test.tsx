import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { listDocuments } from "./api/documents";
import { emptyCandidate, getReview, type ReviewState, saveReview } from "./api/profile";
import ProfileReview from "./ProfileReview";

vi.mock("./api/profile", async (original) => ({
  ...(await original<typeof import("./api/profile")>()),
  getReview: vi.fn(),
  saveReview: vi.fn(),
}));
vi.mock("./api/documents", () => ({ listDocuments: vi.fn() }));
const source = "12345678-1234-1234-1234-123456789012";
function sample(): ReviewState {
  return {
    version: 0,
    draft_sha256: "a".repeat(64),
    profile: {
      version: 0,
      updated_at: "",
      evidence_status: "user_provided",
      data: emptyCandidate(),
    },
    decisions: [],
    draft: {
      created_at: "2026-09-29",
      status: "unreviewed",
      method: "assisted_import",
      payload: {
        data: {
          ...emptyCandidate(),
          full_name: "Synthetic Candidate",
          headline: "Synthetic headline",
        },
        warnings: ["Owner review required"],
        evidence: [
          {
            target: "full_name",
            citations: [{ document_id: source, page: 1, excerpt: "Synthetic Candidate" }],
            notes: ["Confirm spelling"],
          },
          {
            target: "headline",
            citations: [{ document_id: source, page: 2, excerpt: "Synthetic headline" }],
            notes: [],
          },
        ],
      },
    },
  };
}
beforeEach(() => {
  vi.mocked(getReview).mockReset().mockResolvedValue(sample());
  vi.mocked(saveReview).mockReset();
  vi.mocked(listDocuments)
    .mockReset()
    .mockResolvedValue([
      {
        id: source,
        family_id: source,
        version: 1,
        previous_id: null,
        is_latest: true,
        filename: "Synthetic CV.pdf",
        kind: "cv",
        page_count: 2,
        byte_size: 100,
        sha256: "b".repeat(64),
        imported_at: "",
        evidence_status: "source_only",
      },
    ]);
});
it("does not approve on load and saves only an explicitly corrected entry", async () => {
  const saved = sample();
  saved.version = 1;
  saved.profile.version = 1;
  saved.profile.data.full_name = "Corrected name";
  saved.decisions = [{ target: "full_name", decision: "approved", reviewed_at: "now" }];
  vi.mocked(saveReview).mockResolvedValue(saved);
  render(<ProfileReview />);
  const input = await screen.findByLabelText("full name");
  expect(screen.getByText("Synthetic CV.pdf · v1 · page 1")).toBeVisible();
  expect(saveReview).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Corrected name" } });
  fireEvent.click(screen.getByRole("button", { name: "Approve entry" }));
  await waitFor(() =>
    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ version: 0 }),
      "full_name",
      "approved",
      { ...emptyCandidate(), full_name: "Corrected name" },
    ),
  );
  expect(
    await screen.findByText(
      "Entry approved and saved to your profile. Source evidence remains unchanged.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Reject entry" })).toBeDisabled();
});
it("retains corrections across entry navigation", async () => {
  render(<ProfileReview />);
  fireEvent.change(await screen.findByLabelText("full name"), {
    target: { value: "Unsaved correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: /02.*headline/ }));
  expect(screen.getByLabelText("headline")).toHaveValue("Synthetic headline");
  fireEvent.click(screen.getByRole("button", { name: /01.*full name/ }));
  expect(screen.getByLabelText("full name")).toHaveValue("Unsaved correction");
  expect(saveReview).not.toHaveBeenCalled();
});
it("sends rejection without candidate data", async () => {
  const saved = sample();
  saved.version = 1;
  saved.decisions = [{ target: "full_name", decision: "rejected", reviewed_at: "now" }];
  vi.mocked(saveReview).mockResolvedValue(saved);
  render(<ProfileReview />);
  await screen.findByLabelText("full name");
  fireEvent.click(screen.getByRole("button", { name: "Reject entry" }));
  expect(
    await screen.findByText("Entry rejected. It was not added to your profile."),
  ).toBeVisible();
  expect(saveReview).toHaveBeenCalledWith(expect.anything(), "full_name", "rejected", null);
});
it("keeps corrections after conflict and shows the latest saved value after reload", async () => {
  vi.mocked(saveReview).mockRejectedValue("This entry changed. Reload it before saving again.");
  render(<ProfileReview />);
  fireEvent.change(await screen.findByLabelText("full name"), {
    target: { value: "Keep my correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Approve entry" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("workspace changed");
  const latest = sample();
  latest.profile.version = 1;
  latest.profile.data.full_name = "Other saved name";
  vi.mocked(getReview).mockResolvedValue(latest);
  fireEvent.click(screen.getByRole("button", { name: "Reload latest state" }));
  expect(await screen.findByText("Other saved name")).toBeVisible();
  expect(screen.getByLabelText("full name")).toHaveValue("Keep my correction");
});
it("blocks duplicate actions and navigation during a pending decision", async () => {
  let finish: ((state: ReviewState) => void) | undefined;
  vi.mocked(saveReview).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<ProfileReview />);
  await screen.findByLabelText("full name");
  fireEvent.click(screen.getByRole("button", { name: "Approve entry" }));
  expect(screen.getByRole("button", { name: "Approve entry" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reload latest state" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /02.*headline/ })).toBeDisabled();
  await act(async () => {
    finish?.(sample());
  });
});
it("hides raw errors and recovers from initial failure", async () => {
  vi.mocked(getReview).mockRejectedValueOnce("private file path");
  render(<ProfileReview />);
  expect(await screen.findByRole("alert")).not.toHaveTextContent("private file path");
  fireEvent.click(screen.getByRole("button", { name: "Reload latest state" }));
  expect(await screen.findByLabelText("full name")).toBeVisible();
});

it("warns when a citation still uses an earlier original", async () => {
  const original = (await listDocuments())[0];
  if (!original) throw new Error("Missing synthetic fixture");
  vi.mocked(listDocuments).mockResolvedValue([
    { ...original, is_latest: false },
    {
      ...original,
      id: "87654321-1234-1234-1234-123456789012",
      version: 2,
      previous_id: original.id,
      filename: "New CV.pdf",
    },
  ]);
  render(<ProfileReview />);
  await screen.findByLabelText("full name");
  expect(screen.getByText(/A newer version is stored/)).toBeVisible();
  expect(screen.getByText("Synthetic CV.pdf · v1 · page 1")).toBeVisible();
  expect(saveReview).not.toHaveBeenCalled();
});
