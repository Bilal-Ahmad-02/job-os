import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Applications from "./Applications";
import {
  type ApplicationRecord,
  blankApplication,
  getApplication,
  listApplications,
  saveApplication,
} from "./api/applications";

vi.mock("./api/applications", async (original) => ({
  ...(await original<typeof import("./api/applications")>()),
  getApplication: vi.fn(),
  listApplications: vi.fn(),
  saveApplication: vi.fn(),
}));

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
    fireEvent.click(screen.getByRole("button", { name: "SYNC" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Example company/ })).toBeVisible(),
    );
  });
});
