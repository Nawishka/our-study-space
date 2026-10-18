import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Notifications from "../src/Notifications";
import HostPoints from "../src/HostPoints";
import { demoData } from "../src/demo";

beforeEach(() => sessionStorage.clear());
it("shows only the student’s notices and gives Host working owner/type filters", () => {
  const data = demoData();
  const mutate = vi.fn();
  const refresh = vi.fn();
  const melan = data.profiles.find((p) => p.role === "melan")!;
  const host = data.profiles.find((p) => p.role === "host")!;
  const { rerender } = render(
    <Notifications
      data={data}
      profile={melan}
      mutate={mutate}
      refresh={refresh}
      demo
    />,
  );
  fireEvent.click(screen.getByText("Notifications"));
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.queryByText("Test approved")).not.toBeInTheDocument();
  expect(screen.getByText("Task postponed").closest("li")).toHaveClass(
    "notification-warning",
  );
  rerender(
    <Notifications
      data={data}
      profile={host}
      mutate={mutate}
      refresh={refresh}
      demo
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  fireEvent.change(screen.getByLabelText("Student"), {
    target: { value: "shashi" },
  });
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Show"), {
    target: { value: "warning" },
  });
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Test needs a correction")).toBeInTheDocument();
});
it("does not mark a failed save read and replaces identical Realtime snapshots without duplicate notices", async () => {
  const data = demoData();
  const profile = data.profiles.find((p) => p.role === "melan")!;
  const mutate = vi.fn().mockRejectedValue(new Error("Connection interrupted"));
  const { rerender } = render(
    <Notifications
      data={data}
      profile={profile}
      mutate={mutate}
      refresh={vi.fn()}
      demo={false}
    />,
  );
  fireEvent.click(screen.getByText("Notifications"));
  await act(async () =>
    fireEvent.click(screen.getAllByRole("button", { name: "Mark read" })[0]),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Connection interrupted");
  expect(screen.getByText("2 unread")).toBeInTheDocument();
  rerender(
    <Notifications
      data={structuredClone(data)}
      profile={profile}
      mutate={mutate}
      refresh={vi.fn()}
      demo={false}
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(mutate).toHaveBeenCalledTimes(1);
});
it("reuses a manual-point receipt after failure and blocks double clicks until backend confirmation", async () => {
  const mutate = vi.fn().mockRejectedValueOnce(new Error("Save interrupted"));
  render(<HostPoints data={demoData()} mutate={mutate} demo={false} />);
  fireEvent.click(screen.getByText("Host · Add challenge points"));
  fireEvent.change(screen.getByLabelText("Reason for these points"), {
    target: { value: "Extra careful revision" },
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Add points" })),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Save interrupted");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  let resolve!: () => void;
  mutate.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add points" }));
  fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate.mock.calls[0][1].adjustment_id).toBe(
    mutate.mock.calls[1][1].adjustment_id,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await act(async () => resolve());
  expect(screen.getByRole("status")).toHaveTextContent("Points saved");
  expect(sessionStorage.getItem("study-pending-points")).toBeNull();
  expect(within(screen.getByRole("status")).queryByRole("alert")).toBeNull();
});
