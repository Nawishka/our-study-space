import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { webcrypto } from "node:crypto";
import { demoData } from "../src/demo";
const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  unlock: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
  rpc: vi.fn(),
  loadData: vi.fn(),
  changed: () => {},
}));
vi.mock("../src/sound", () => ({
  GentleAudio: class {
    play = mocks.play;
    unlock = mocks.unlock;
    stop = mocks.stop;
    dispose = mocks.dispose;
  },
}));
vi.mock("../src/service", () => ({
  rpc: mocks.rpc,
  loadData: mocks.loadData,
  proofLinks: vi.fn(),
  supabase: {
    channel: () => ({
      on: (_event: unknown, _filter: unknown, callback: () => void) => {
        mocks.changed = callback;
        return { subscribe: vi.fn() };
      },
    }),
    removeChannel: vi.fn(),
  },
}));
import {
  FeedbackControls,
  FeedbackProvider,
  useFeedback,
} from "../src/Feedback";
import { useStudy } from "../src/useStudy";
import { TestForm } from "../src/Academic";
import Journey from "../src/Journey";

const profile = { id: "melan", role: "melan" as const, display_name: "Melan" };
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <FeedbackProvider>
      <FeedbackControls />
      {children}
    </FeedbackProvider>
  );
}
function ConfirmButton() {
  const feedback = useFeedback();
  return (
    <button
      onClick={() => feedback.confirm("confirmed:1", "task", "Task saved.")}
    >
      Confirm
    </button>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  mocks.loadData.mockResolvedValue(demoData());
  mocks.rpc.mockResolvedValue(undefined);
  mocks.unlock.mockResolvedValue(true);
  mocks.play.mockReturnValue(true);
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

it("offers an explicit sound sample without creating a saved-action confirmation", async () => {
  render(
    <Wrapper>
      <ConfirmButton />
    </Wrapper>,
  );
  expect(
    screen.queryByRole("button", { name: "Test sound" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  expect(mocks.play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Test sound" }));
  await screen.findByText("Sound sample played.");
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith("task");
  expect(localStorage.getItem("study-confirmed-feedback-v1")).toBeNull();
});

it("does not play a delayed sample after sounds have been turned off", async () => {
  render(
    <Wrapper>
      <ConfirmButton />
    </Wrapper>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  let resume!: (ready: boolean) => void;
  mocks.unlock.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        resume = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Test sound" }));
  fireEvent.click(screen.getByRole("button", { name: "Sounds on" }));
  await act(async () => {
    resume(true);
  });
  expect(mocks.play).not.toHaveBeenCalled();
});

it("reports unavailable audio without pretending the sample played", async () => {
  render(
    <Wrapper>
      <ConfirmButton />
    </Wrapper>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  mocks.unlock.mockResolvedValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "Test sound" }));
  await screen.findByText(/Audio unavailable/);
  expect(mocks.play).not.toHaveBeenCalled();
});

it("keeps sound off for an ordinary confirmed action until the user enables it", () => {
  render(
    <Wrapper>
      <ConfirmButton />
    </Wrapper>,
  );
  fireEvent.click(screen.getByText("Confirm"));
  expect(screen.getByRole("status")).toHaveTextContent("Task saved.");
  expect(mocks.play).not.toHaveBeenCalled();
  expect(mocks.unlock).not.toHaveBeenCalled();
});

it("confirms future plans once after saving, with no celebration for failed plans", async () => {
  const { result } = renderHook(() => useStudy(profile, false), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.data).not.toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  const args = {
    task_id: "planned-task",
    student_id: profile.id,
    task_title: "Read a chapter",
    due_date: "2026-11-20",
  };
  mocks.rpc.mockRejectedValueOnce(new Error("Save interrupted"));
  await act(async () => {
    await expect(result.current.mutate("save_task", args)).rejects.toThrow(
      "Save interrupted",
    );
  });
  expect(mocks.play).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.mutate("save_task", args);
  });
  expect(screen.getByRole("status")).toHaveTextContent("Future plan saved.");
  await act(async () => {
    await result.current.mutate("save_task", args);
  });
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith("plan");
});

it("defaults to silence, initializes only from an interaction, remembers independent preferences and deduplicates across reloads", () => {
  const view = render(
    <Wrapper>
      <ConfirmButton />
    </Wrapper>,
  );
  expect(screen.getByRole("button", { name: "Sounds off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(mocks.unlock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  expect(mocks.unlock).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Animations on" }));
  expect(document.documentElement.dataset.motion).toBe("off");
  fireEvent.click(screen.getByText("Confirm"));
  fireEvent.click(screen.getByText("Confirm"));
  expect(screen.getByRole("status")).toHaveTextContent("Task saved.");
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith("task");
  view.unmount();
  mocks.unlock.mockClear();
  mocks.play.mockClear();
  render(
    <Wrapper>
      <ConfirmButton />
    </Wrapper>,
  );
  expect(screen.getByRole("button", { name: "Sounds on" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Animations off" })).toBeVisible();
  expect(mocks.unlock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Confirm"));
  expect(mocks.play).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("honors device reduced motion while allowing independent user-enabled sound", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  render(
    <Wrapper>
      <ConfirmButton />
    </Wrapper>,
  );
  expect(document.documentElement.dataset.motion).toBe("off");
  expect(screen.getByText("Device reduced motion is active")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  fireEvent.click(screen.getByText("Confirm"));
  expect(mocks.play).toHaveBeenCalledOnce();
  expect(document.documentElement.dataset.motion).toBe("off");
  expect(screen.getByRole("status")).toHaveTextContent("Task saved.");
});

it("celebrates only confirmed saves once, never optimistic/failed/offline saves, undo or repeated Realtime events", async () => {
  const { result } = renderHook(() => useStudy(profile, false), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.data).not.toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  let resolve!: () => void;
  mocks.rpc.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.toggle("task-1", true);
  });
  expect(mocks.play).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  await act(async () => {
    resolve();
    await saving;
  });
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith("task");
  await act(async () => {
    await result.current.toggle("task-1", true);
  });
  await act(async () => {
    await result.current.toggle("task-1", false);
  });
  mocks.loadData.mockResolvedValue({ ...demoData(), tests: [] });
  act(() => {
    mocks.changed();
    mocks.changed();
  });
  await waitFor(() => expect(result.current.data?.tests).toHaveLength(0));
  expect(mocks.play).toHaveBeenCalledOnce();
  mocks.rpc.mockRejectedValueOnce(new Error("Not saved"));
  await act(async () => {
    await expect(result.current.toggle("task-2", true)).rejects.toThrow(
      "Not saved",
    );
  });
  expect(
    result.current.data?.tasks.find((t) => t.id === "task-2")?.completed_at,
  ).toBeNull();
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  await act(async () => {
    await expect(result.current.toggle("task-2", true)).rejects.toThrow(
      "offline",
    );
  });
  expect(mocks.play).toHaveBeenCalledOnce();
});

it("announces successful test submission as awaiting approval, guards double submits, and stays silent on failure", async () => {
  const data = demoData();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn();
  const record = { ...data.tests[0], status: "draft" as const };
  const view = render(
    <Wrapper>
      <TestForm
        data={data}
        profile={profile}
        record={record}
        refresh={refresh}
        close={close}
        demo={false}
      />
    </Wrapper>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  let resolve!: () => void;
  mocks.rpc.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const button = screen.getByRole("button", { name: "Submit for approval" });
  fireEvent.submit(button.closest("form")!);
  fireEvent.submit(button.closest("form")!);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.play).not.toHaveBeenCalled();
  await act(async () => {
    resolve();
  });
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(screen.getByRole("status")).toHaveTextContent(
    "Submitted — awaiting approval.",
  );
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith("submission");
  view.unmount();
  mocks.play.mockClear();
  mocks.rpc.mockRejectedValueOnce(new Error("Upload interrupted"));
  render(
    <Wrapper>
      <TestForm
        data={data}
        profile={profile}
        record={{ ...record, id: "different-test" }}
        refresh={refresh}
        close={close}
        demo={false}
      />
    </Wrapper>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Upload interrupted",
  );
  expect(mocks.play).not.toHaveBeenCalled();
});

it("shows a discovered reward silently and celebrates only once after an explicit click", () => {
  const data = demoData();
  data.rewards = [
    {
      id: "reward-1",
      challenge_id: "past",
      unlocked_at: new Date().toISOString(),
      redeemed_at: null,
    },
  ];
  render(
    <Wrapper>
      <Journey data={data} profile={profile} mutate={vi.fn()} />
    </Wrapper>,
  );
  expect(
    screen.getByRole("heading", { name: "Movie Date Unlocked!" }),
  ).toBeVisible();
  expect(mocks.play).not.toHaveBeenCalled();
  expect(mocks.unlock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sounds off" }));
  fireEvent.click(screen.getByRole("button", { name: "Celebrate" }));
  fireEvent.click(screen.getByRole("button", { name: "Celebrate" }));
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith("reward");
});
