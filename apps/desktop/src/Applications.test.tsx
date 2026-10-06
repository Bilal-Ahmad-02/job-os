import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import Applications from "./Applications";
import {
  type ApplicationRecord,
  blankApplication,
  getApplication,
  listApplications,
  saveApplication,
} from "./api/applications";
import { listDocuments } from "./api/documents";

vi.mock("./api/applications", async (original) => ({
  ...(await original<typeof import("./api/applications")>()),
  getApplication: vi.fn(),
  listApplications: vi.fn(),
  saveApplication: vi.fn(),
}));
vi.mock("./api/documents", () => ({ listDocuments: vi.fn().mockResolvedValue([]) }));
vi.mock("./api/health", () => ({ checkHealth: vi.fn().mockResolvedValue(undefined) }));

let record: ApplicationRecord;
beforeEach(() => {
  record = { ...blankApplication(), id: "synthetic-entry", version: 1 };
  record.data.company = "Example company";
  record.imported = {
    sheet: "Job Application Log",
    row: 3,
    original: { ...record.data },
    links: { C3: "javascript:alert('never execute')" },
  };
  vi.mocked(listApplications)
    .mockReset()
    .mockResolvedValue({
      total: 1,
      items: [
        {
          id: record.id,
          title: "",
          company: record.data.company,
          status: "Unspecified",
          resume_sent: "",
          deadline_date: "",
          follow_up_date: "",
          open_todos: 0,
        },
      ],
    });
  vi.mocked(getApplication)
    .mockReset()
    .mockImplementation(async () => structuredClone(record));
  vi.mocked(saveApplication)
    .mockReset()
    .mockImplementation(async (input) => ({ ...input, version: 2 }));
});

describe("Application history", () => {
  it("keeps an unsaved dossier when switching modules and does not hijack the vault keyboard", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "NEW.DOSSIER" }));
    fireEvent.change(screen.getByLabelText("Job title"), {
      target: { value: "Draft stays private" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Source documents" }));
    expect(screen.getByLabelText("Job title")).not.toBeVisible();
    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Applications" }));
    expect(screen.getByLabelText("Job title")).toBeVisible();
    expect(screen.getByLabelText("Job title")).toHaveValue("Draft stays private");
    expect(saveApplication).not.toHaveBeenCalled();
  });

  it("clears an applied search and returns to the full first page", async () => {
    render(<Applications />);
    await screen.findByRole("button", { name: /Example company/ });
    fireEvent.change(screen.getByLabelText("Search by company or job title"), {
      target: { value: "Example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "EXEC" }));
    await waitFor(() => expect(listApplications).toHaveBeenLastCalledWith("Example", 0));
    fireEvent.click(screen.getByRole("button", { name: "Clear query" }));
    await waitFor(() => expect(listApplications).toHaveBeenLastCalledWith("", 0));
    expect(screen.getByLabelText("Search by company or job title")).toHaveValue("");
    expect(screen.getByLabelText("Search by company or job title")).toHaveFocus();
  });

  it("recovers when a refresh leaves the current page outside the result set", async () => {
    const first = {
      total: 51,
      items: [
        {
          id: record.id,
          title: "",
          company: "Example company",
          status: "Unspecified",
          resume_sent: "",
          deadline_date: "",
          follow_up_date: "",
          open_todos: 0,
        },
      ],
    };
    vi.mocked(listApplications)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ total: 1, items: [] });
    render(<Applications />);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(listApplications).toHaveBeenLastCalledWith("", 50));
    await waitFor(() => expect(screen.getByRole("button", { name: "REFRESH" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "REFRESH" }));
    await waitFor(() => expect(listApplications).toHaveBeenLastCalledWith("", 0));
    expect(await screen.findByRole("button", { name: /Example company/ })).toBeVisible();
  });
  it("focuses the query with Ctrl+K without issuing a request or interfering with an open draft", async () => {
    const view = render(<Applications />);
    await screen.findByRole("button", { name: /Example company/ });
    const requests = vi.mocked(listApplications).mock.calls.length;
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByLabelText("Search by company or job title")).toHaveFocus();
    expect(listApplications).toHaveBeenCalledTimes(requests);
    fireEvent.click(screen.getByRole("button", { name: "NEW.DOSSIER" }));
    const title = screen.getByLabelText("Job title");
    fireEvent.change(title, { target: { value: "Unsaved draft" } });
    title.focus();
    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(title).toHaveFocus();
    expect(title).toHaveValue("Unsaved draft");
    expect(saveApplication).not.toHaveBeenCalled();
    view.unmount();
    const afterUnmount = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      cancelable: true,
    });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });
  it("shows a recovery message when the workspace is missing", async () => {
    vi.mocked(listApplications).mockRejectedValueOnce(
      "Oracle's database is missing. Restore your workspace; an empty replacement has not been created.",
    );
    render(<Applications />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Restore your workspace");
    expect(screen.queryByText("No applications found.")).not.toBeInTheDocument();
    expect(saveApplication).not.toHaveBeenCalled();
  });
  it("keeps partial entries and saves edits without replacing source provenance", async () => {
    render(<Applications />);
    fireEvent.click(await screen.findByRole("button", { name: /Example company/ }));
    const title = await screen.findByLabelText("Job title");
    expect(title).toHaveValue("");
    fireEvent.change(title, { target: { value: "Engineer" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Applied" } });
    fireEvent.click(screen.getByRole("button", { name: "Save application" }));
    expect(await screen.findByText("Saved on this computer.")).toBeVisible();
    expect(vi.mocked(saveApplication).mock.calls[0]?.[0].data).toMatchObject({
      title: "Engineer",
      status: "Applied",
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Original spreadsheet entry/));
    expect(screen.getByText(/javascript:alert/)).toBeVisible();
  });

  it("preserves unsaved input after a conflicting edit and requires explicit discard", async () => {
    vi.mocked(saveApplication).mockRejectedValue(
      "This entry changed. Reload it before saving again.",
    );
    render(<Applications />);
    fireEvent.click(await screen.findByRole("button", { name: /Example company/ }));
    fireEvent.change(await screen.findByLabelText("Job title"), { target: { value: "My draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save application" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This entry changed");
    expect(screen.getByLabelText("Job title")).toHaveValue("My draft");
    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
    expect(screen.getByText("Discard your unsaved changes?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Job title")).toHaveValue("My draft");
  });

  it("creates new entries and requires a title or company", async () => {
    render(<Applications />);
    fireEvent.click(screen.getByRole("button", { name: "NEW.DOSSIER" }));
    expect(screen.getByRole("button", { name: "Save application" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "New company" } });
    fireEvent.click(screen.getByRole("button", { name: "Save application" }));
    await screen.findByText("Saved on this computer.");
    expect(vi.mocked(saveApplication).mock.calls[0]?.[0].version).toBe(0);
  });

  it("does not let a stale search replace a newer result", async () => {
    let finish: ((value: { total: number; items: [] }) => void) | undefined;
    vi.mocked(listApplications).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<Applications />);
    fireEvent.change(screen.getByLabelText("Search by company or job title"), {
      target: { value: "Example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "EXEC" }));
    await screen.findByRole("button", { name: /Example company/ });
    await act(async () => {
      finish?.({ total: 0, items: [] });
    });
    expect(screen.getByRole("button", { name: /Example company/ })).toBeVisible();
  });

  it("hides raw error details and retries", async () => {
    vi.mocked(listApplications).mockRejectedValueOnce("secret SQLite path");
    render(<Applications />);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("secret SQLite path");
    fireEvent.click(screen.getByRole("button", { name: "REFRESH" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Example company/ })).toBeVisible(),
    );
  });

  it("saves owner-set dates on request and shows them in the index without reminding", async () => {
    render(<Applications />);
    fireEvent.click(await screen.findByRole("button", { name: /Example company/ }));
    const deadline = await screen.findByLabelText("Application deadline");
    expect(deadline).toHaveAttribute("type", "date");
    expect(screen.getByText(/does not remind or notify/)).toBeVisible();
    fireEvent.change(deadline, { target: { value: "2000-01-02" } });
    fireEvent.change(screen.getByLabelText("Follow up on"), { target: { value: "2999-12-31" } });
    expect(saveApplication).not.toHaveBeenCalled();
    vi.mocked(listApplications).mockResolvedValue({
      total: 1,
      items: [
        {
          id: record.id,
          title: "",
          company: record.data.company,
          status: "Unspecified",
          resume_sent: "",
          deadline_date: "2000-01-02",
          follow_up_date: "2999-12-31",
          open_todos: 2,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Save application" }));
    await screen.findByText("Saved on this computer.");
    expect(vi.mocked(saveApplication).mock.calls[0]?.[0].data).toMatchObject({
      deadline_date: "2000-01-02",
      follow_up_date: "2999-12-31",
    });
    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
    const entry = await screen.findByRole("button", { name: /Example company/ });
    expect(entry).toHaveTextContent("Deadline 2000-01-02 (passed)");
    expect(entry).toHaveTextContent("Follow up 2999-12-31");
    expect(entry).not.toHaveTextContent("(due)");
    expect(entry).toHaveTextContent("2 to do");
  });

  it("keeps the owner's to-do list, preparation notes and exact document links", async () => {
    const stored = {
      id: "0b2f6c1e-5f0a-4a57-9f0a-2a3a1f2c9d11",
      family_id: "0b2f6c1e-5f0a-4a57-9f0a-2a3a1f2c9d11",
      version: 1,
      previous_id: null,
      is_latest: false,
      filename: "synthetic-cv.pdf",
      kind: "cv" as const,
      byte_size: 10,
      page_count: 1,
      sha256: "a".repeat(64),
      imported_at: "2026-10-01T00:00:00Z",
      evidence_status: "source_only" as const,
    };
    vi.mocked(listDocuments).mockResolvedValueOnce([stored]);
    render(<Applications />);
    fireEvent.click(await screen.findByRole("button", { name: /Example company/ }));
    // The wording says who does what: nothing is added, ticked, reminded, generated or sent.
    expect(await screen.findByText(/does not add items, tick them or remind you/)).toBeVisible();
    expect(screen.getByText(/does not generate or suggest/)).toBeVisible();
    expect(screen.getByText(/has not sent it anywhere and cannot check/)).toBeVisible();
    const save = screen.getByRole("button", { name: "Save application" });
    fireEvent.click(screen.getByRole("button", { name: "Add to-do" }));
    // An untitled item cannot be saved, and the reason is stated.
    expect(save).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Give every to-do a title");
    fireEvent.change(screen.getByLabelText("To-do 1"), { target: { value: "Ask a referee" } });
    fireEvent.change(screen.getByLabelText("Due date for to-do 1"), {
      target: { value: "2026-10-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to-do" }));
    fireEvent.change(screen.getByLabelText("To-do 2"), { target: { value: "Send the form" } });
    fireEvent.click(screen.getByLabelText("Done: Send the form"));
    fireEvent.click(screen.getByRole("button", { name: "Add to-do" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove to-do 3" }));
    fireEvent.change(screen.getByLabelText("Preparation notes"), {
      target: { value: "Revise queues." },
    });
    const link = await screen.findByLabelText(/synthetic-cv\.pdf/);
    expect(link.closest("li")).toHaveTextContent("cv / version 1 / superseded by a newer version");
    fireEvent.click(link);
    expect(saveApplication).not.toHaveBeenCalled();
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await screen.findByText("Saved on this computer.");
    expect(vi.mocked(saveApplication).mock.calls[0]?.[0].data).toMatchObject({
      preparation: "Revise queues.",
      todos: [
        { title: "Ask a referee", due_date: "2026-10-12", done: false },
        { title: "Send the form", due_date: "", done: true },
      ],
      document_ids: [stored.id],
    });
    // Unticking only removes the link from this dossier.
    fireEvent.click(screen.getByLabelText(/synthetic-cv\.pdf/));
    fireEvent.click(screen.getByRole("button", { name: "Save application" }));
    await waitFor(() => expect(saveApplication).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveApplication).mock.calls[1]?.[0].data.document_ids).toEqual([]);
  });

  it("keeps existing document links visible when the documents cannot be listed", async () => {
    record.data.document_ids = ["0b2f6c1e-5f0a-4a57-9f0a-2a3a1f2c9d11"];
    vi.mocked(listDocuments).mockRejectedValueOnce("secret path");
    render(<Applications />);
    fireEvent.click(await screen.findByRole("button", { name: /Example company/ }));
    const alert = await screen.findByText(/could not be listed\. Existing links are kept/);
    expect(alert).not.toHaveTextContent("secret path");
    expect(screen.getByLabelText(/Stored document/)).toBeChecked();
    expect(screen.getByRole("button", { name: "Save application" })).toBeDisabled();
  });
});
