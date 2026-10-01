import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { listDocuments } from "./api/documents";
import { changeTask, listTasks, type Task } from "./api/tasks";
import Tasks from "./Tasks";

vi.mock("./api/documents", () => ({ listDocuments: vi.fn() }));
vi.mock("./api/tasks", async (original) => ({
  ...(await original<typeof import("./api/tasks")>()),
  listTasks: vi.fn(),
  changeTask: vi.fn(),
  createTask: vi.fn(),
}));
const task: Task = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "document_extract",
  state: "queued",
  version: 1,
  total: 2,
  completed: 0,
  attempt: 1,
  error: "",
  document_ids: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"],
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};
function deferred() {
  let resolve!: (value: Task) => void;
  const promise = new Promise<Task>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listDocuments).mockResolvedValue([]);
  vi.mocked(listTasks).mockResolvedValue([{ ...task }]);
});

it("loads durable progress without automatically resuming", async () => {
  render(<Tasks />);
  expect(await screen.findByRole("button", { name: "Resume task" })).toBeEnabled();
  expect(changeTask).not.toHaveBeenCalled();
});

it("runs one document per step and displays confirmed completion", async () => {
  vi.mocked(changeTask)
    .mockResolvedValueOnce({ ...task, completed: 1, version: 3 })
    .mockResolvedValueOnce({ ...task, completed: 2, state: "succeeded", version: 5 });
  render(<Tasks />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume task" }));
  expect(await screen.findByText("SUCCEEDED")).toBeVisible();
  expect(changeTask).toHaveBeenCalledTimes(2);
  expect(vi.mocked(changeTask).mock.calls[1]?.[0].version).toBe(3);
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "2");
});

it("cancels the remainder only after the current document is confirmed", async () => {
  const step = deferred();
  vi.mocked(changeTask)
    .mockReturnValueOnce(step.promise)
    .mockResolvedValueOnce({ ...task, completed: 1, state: "cancelled", version: 4 });
  render(<Tasks />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume task" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel after current document" }));
  expect(changeTask).toHaveBeenCalledTimes(1);
  await act(async () => step.resolve({ ...task, completed: 1, version: 3 }));
  expect(await screen.findByText("CANCELLED")).toBeVisible();
  expect(changeTask).toHaveBeenLastCalledWith(
    expect.objectContaining({ completed: 1, version: 3 }),
    "task_cancel",
  );
});

it("does not admit another step after locking or closing unmounts the workspace", async () => {
  const step = deferred();
  vi.mocked(changeTask).mockReturnValueOnce(step.promise);
  const view = render(<Tasks />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume task" }));
  view.unmount();
  await act(async () => step.resolve({ ...task, completed: 1, version: 3 }));
  expect(changeTask).toHaveBeenCalledTimes(1);
});

it("requires successful reconciliation after a lost response and a failed refresh", async () => {
  vi.mocked(changeTask).mockRejectedValueOnce(new Error("transport"));
  render(<Tasks />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume task" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("outcome was not confirmed");
  expect(screen.getByRole("button", { name: "Resume task" })).toBeDisabled();
  vi.mocked(listTasks).mockRejectedValueOnce(new Error("transport"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh tasks" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not load tasks"));
  expect(screen.getByRole("button", { name: "Resume task" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh tasks" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Resume task" })).toBeEnabled());
  expect(changeTask).toHaveBeenCalledTimes(1);
});

it("requires explicit recovery for a running claim and bounds retries", async () => {
  vi.mocked(listTasks).mockResolvedValue([{ ...task, state: "running" }]);
  render(<Tasks />);
  expect(await screen.findByRole("status")).toHaveTextContent("two minutes");
  expect(screen.queryByRole("button", { name: "Resume task" })).not.toBeInTheDocument();
  vi.mocked(listTasks).mockResolvedValue([
    { ...task, state: "interrupted", attempt: 3, error: "interrupted" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Refresh tasks" }));
  expect(await screen.findByText("INTERRUPTED")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Retry remaining documents" }),
  ).not.toBeInTheDocument();
  expect(changeTask).not.toHaveBeenCalled();
});
