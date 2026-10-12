import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { demoData } from "../src/demo";
const mocks = vi.hoisted(() => ({ loadData: vi.fn(), rpc: vi.fn() }));
vi.mock("../src/service", () => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
    loadData: mocks.loadData,
    rpc: mocks.rpc,
    supabase: { channel: () => channel, removeChannel: vi.fn() },
  };
});
import { useStudy } from "../src/useStudy";
const profile = { id: "melan", role: "melan" as const, display_name: "Melan" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadData.mockResolvedValue(demoData());
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
});
it("rolls back an optimistic completion after a server failure and exposes the error", async () => {
  const { result } = renderHook(() => useStudy(profile, false));
  await waitFor(() => expect(result.current.data).not.toBeNull());
  mocks.rpc.mockRejectedValueOnce(new Error("Connection interrupted"));
  await act(async () => {
    await expect(result.current.toggle("task-1", true)).rejects.toThrow(
      "Connection interrupted",
    );
  });
  expect(
    result.current.data?.tasks.find((t) => t.id === "task-1")?.completed_at,
  ).toBeNull();
  expect(result.current.error).toBe("Connection interrupted");
  expect(result.current.status).toContain("Not saved");
});
it("refuses offline writes without pretending to save", async () => {
  const { result } = renderHook(() => useStudy(profile, false));
  await waitFor(() => expect(result.current.data).not.toBeNull());
  Object.defineProperty(navigator, "onLine", {
    value: false,
    configurable: true,
  });
  await act(async () => {
    await expect(result.current.toggle("task-1", true)).rejects.toThrow(
      "offline",
    );
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(result.current.error).toContain("offline");
});
it("hides the prior identity’s private dataset while a new identity loads", async () => {
  const { result, rerender } = renderHook(
    ({ identity }) => useStudy(identity, false),
    {
      initialProps: {
        identity: profile as {
          id: string;
          role: "melan" | "shashi";
          display_name: string;
        },
      },
    },
  );
  await waitFor(() => expect(result.current.data).not.toBeNull());
  mocks.loadData.mockImplementation(() => new Promise(() => {}));
  rerender({
    identity: { id: "shashi", role: "shashi", display_name: "Shashi" },
  });
  expect(result.current.data).toBeNull();
});
