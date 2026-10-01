import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { emptyCandidate } from "./api/profile";
import ProfileWorkspace from "./ProfileWorkspace";

vi.mock("./api/profile", async (original) => ({
  ...(await original<typeof import("./api/profile")>()),
  getProfile: vi.fn(async () => ({
    version: 0,
    updated_at: "",
    evidence_status: "user_provided",
    data: emptyCandidate(),
  })),
  getReview: vi.fn(async () => ({
    version: 0,
    draft_sha256: "",
    draft: null,
    decisions: [],
    profile: {
      version: 0,
      updated_at: "",
      evidence_status: "user_provided",
      data: emptyCandidate(),
    },
  })),
}));
vi.mock("./api/documents", () => ({ listDocuments: vi.fn(async () => []) }));

it("retains profile edits when switching between saved profile and evidence review", async () => {
  render(<ProfileWorkspace />);
  fireEvent.change(await screen.findByLabelText("headline"), {
    target: { value: "Unsaved local headline" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Evidence review" }));
  expect(await screen.findByText(/No profile draft is available/)).toBeVisible();
  expect(screen.getByLabelText("headline")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Saved profile" }));
  expect(screen.getByLabelText("headline")).toBeVisible();
  expect(screen.getByLabelText("headline")).toHaveValue("Unsaved local headline");
});
