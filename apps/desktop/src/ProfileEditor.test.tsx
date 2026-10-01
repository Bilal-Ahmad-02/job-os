import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CandidateProfile, emptyCandidate, getProfile, saveProfile } from "./api/profile";
import ProfileEditor from "./ProfileEditor";
import { newEntry } from "./profile/editorData";

vi.mock("./api/profile", async (original) => ({
  ...(await original<typeof import("./api/profile")>()),
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));
function saved(version = 1): CandidateProfile {
  return {
    version,
    updated_at: "2026-01-01T00:00:00Z",
    evidence_status: "user_provided",
    data: { ...emptyCandidate(), full_name: "Synthetic candidate" },
  };
}
beforeEach(() => {
  vi.mocked(getProfile).mockReset().mockResolvedValue(saved());
  vi.mocked(saveProfile)
    .mockReset()
    .mockImplementation(async (version, data) => ({ ...saved(version + 1), data }));
});
describe("saved profile editor", () => {
  it("saves the complete profile using the loaded revision without changing other sections", async () => {
    const profile = saved();
    profile.data.skills = [{ ...newEntry("skills"), name: "Synthetic skill" }];
    profile.data.preferences.target_roles = ["Synthetic role"];
    vi.mocked(getProfile).mockResolvedValue(profile);
    const changed = vi.fn();
    render(<ProfileEditor onSaved={changed} />);
    fireEvent.change(await screen.findByLabelText("headline"), {
      target: { value: "New headline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText(/Profile saved\./);
    expect(saveProfile).toHaveBeenCalledWith(1, { ...profile.data, headline: "New headline" });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  });
  it("keeps stable entry IDs and requires an explicit removal and save", async () => {
    const profile = saved();
    const entry = { ...newEntry("skills"), name: "Synthetic skill" };
    profile.data.skills = [entry];
    vi.mocked(getProfile).mockResolvedValue(profile);
    render(<ProfileEditor />);
    await screen.findByLabelText("full name");
    fireEvent.click(screen.getByRole("button", { name: "skills" }));
    fireEvent.change(screen.getByLabelText("Skill"), { target: { value: "Corrected skill" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText(/Profile saved\./);
    expect(vi.mocked(saveProfile).mock.calls[0]?.[1].skills[0]?.id).toBe(entry.id);
    fireEvent.click(screen.getByRole("button", { name: "Remove entry" }));
    expect(saveProfile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal from draft" }));
    expect(saveProfile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(saveProfile).toHaveBeenLastCalledWith(2, { ...profile.data, skills: [] }),
    );
  });
  it("creates entries with stable IDs and unspecified education completion", async () => {
    render(<ProfileEditor />);
    await screen.findByLabelText("full name");
    fireEvent.click(screen.getByRole("button", { name: "education" }));
    fireEvent.click(screen.getByRole("button", { name: "Add education" }));
    expect(screen.getByLabelText("Completion")).toHaveValue("unspecified");
    fireEvent.change(screen.getByLabelText("Institution"), {
      target: { value: "Synthetic institute" },
    });
    fireEvent.change(screen.getByLabelText("Qualification"), {
      target: { value: "Synthetic course" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText(/Profile saved\./);
    expect(vi.mocked(saveProfile).mock.calls[0]?.[1].education[0]).toMatchObject({
      id: expect.any(String),
      completion: "unspecified",
    });
  });
  it("normalizes preference lines and saves only explicitly chosen options", async () => {
    render(<ProfileEditor />);
    await screen.findByLabelText("full name");
    fireEvent.click(screen.getByRole("button", { name: "Job preferences" }));
    fireEvent.change(screen.getByLabelText("Target roles (one per line)"), {
      target: { value: " Example role \n\nSecond role\n" },
    });
    fireEvent.click(screen.getByLabelText("remote"));
    fireEvent.change(screen.getByLabelText("Excluded employers (one per line)"), {
      target: { value: " Synthetic agency \n\n" },
    });
    fireEvent.change(screen.getByLabelText("Excluded listing phrases (one per line)"), {
      target: { value: " commission only \nunpaid\n" },
    });
    fireEvent.change(screen.getByLabelText("Other constraints and review notes"), {
      target: { value: "Review commute individually" },
    });
    expect(saveProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText(/Profile saved\./);
    expect(vi.mocked(saveProfile).mock.calls[0]?.[1].preferences).toMatchObject({
      target_roles: ["Example role", "Second role"],
      work_modes: ["remote"],
      employment_types: [],
      excluded_employers: ["Synthetic agency"],
      excluded_keywords: ["commission only", "unpaid"],
      constraints: "Review commute individually",
    });
  });
  it("retains existing notes and blocks duplicate exclusions without issuing a save", async () => {
    const profile = saved();
    profile.data.preferences.constraints = "Legacy exclusion notes";
    vi.mocked(getProfile).mockResolvedValue(profile);
    render(<ProfileEditor />);
    await screen.findByLabelText("full name");
    fireEvent.click(screen.getByRole("button", { name: "Job preferences" }));
    expect(screen.getByLabelText("Other constraints and review notes")).toHaveValue(
      "Legacy exclusion notes",
    );
    fireEvent.change(screen.getByLabelText("Excluded employers (one per line)"), {
      target: { value: "Example agency\n example AGENCY " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("repeated job preferences");
    expect(saveProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Basic details" }));
    fireEvent.click(screen.getByRole("button", { name: "Job preferences" }));
    expect(screen.getByLabelText("Excluded employers (one per line)")).toHaveValue(
      "Example agency\n example AGENCY ",
    );
  });
  it("preserves drafts on conflict and compares latest before explicit replacement", async () => {
    vi.mocked(saveProfile).mockRejectedValue("This entry changed. Reload it before saving again.");
    render(<ProfileEditor />);
    fireEvent.change(await screen.findByLabelText("headline"), {
      target: { value: "My unsaved headline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(screen.getByLabelText("headline")).toHaveValue("My unsaved headline");
    const latest = saved(2);
    latest.data.full_name = "New saved name";
    vi.mocked(getProfile).mockResolvedValue(latest);
    fireEvent.click(screen.getByRole("button", { name: "Check latest saved profile" }));
    await screen.findByText("New saved name");
    expect(screen.getByLabelText("headline")).toHaveValue("My unsaved headline");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Use latest saved profile — discard my draft" }),
    );
    expect(screen.getByLabelText("full name")).toHaveValue("New saved name");
    expect(screen.getByLabelText("headline")).toHaveValue("");
    expect(saveProfile).toHaveBeenCalledTimes(1);
  });
  it("handles a lost save response without automatic retries or leaking error details", async () => {
    vi.mocked(saveProfile).mockRejectedValue("private path and data");
    render(<ProfileEditor />);
    fireEvent.change(await screen.findByLabelText("headline"), { target: { value: "Retained" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save was not confirmed");
    expect(screen.queryByText("private path and data")).not.toBeInTheDocument();
    expect(screen.getByLabelText("headline")).toHaveValue("Retained");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    expect(saveProfile).toHaveBeenCalledTimes(1);
  });
  it("refreshes clean data after evidence approval but retains a dirty draft", async () => {
    const view = render(<ProfileEditor refresh={0} />);
    await screen.findByLabelText("full name");
    const latest = saved(2);
    latest.data.headline = "Approved headline";
    vi.mocked(getProfile).mockResolvedValue(latest);
    view.rerender(<ProfileEditor refresh={1} />);
    await waitFor(() => expect(screen.getByLabelText("headline")).toHaveValue("Approved headline"));
    fireEvent.change(screen.getByLabelText("headline"), { target: { value: "My draft" } });
    vi.mocked(getProfile).mockResolvedValue(saved(3));
    view.rerender(<ProfileEditor refresh={2} />);
    await screen.findByText("NEWER SAVED REVISION");
    expect(screen.getByLabelText("headline")).toHaveValue("My draft");
  });
  it("does not duplicate writes while a save is pending", async () => {
    let finish: (value: CandidateProfile) => void = () => {};
    vi.mocked(saveProfile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<ProfileEditor />);
    fireEvent.change(await screen.findByLabelText("headline"), { target: { value: "Pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    expect(saveProfile).toHaveBeenCalledTimes(1);
    await act(async () => finish(saved(2)));
  });
  it("rejects incomplete hidden sections before sending a save", async () => {
    render(<ProfileEditor />);
    await screen.findByLabelText("full name");
    fireEvent.click(screen.getByRole("button", { name: "skills" }));
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Basic details" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("required entry fields");
    expect(saveProfile).not.toHaveBeenCalled();
  });
});
