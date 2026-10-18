import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ThemeControl from "../src/ThemeControl";
import { readTheme, THEME_KEY } from "../src/theme";
let dark = true;
const listeners = new Set<() => void>();
beforeEach(() => {
  localStorage.clear();
  listeners.clear();
  dark = true;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: dark,
      addEventListener: (_event: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_event: string, fn: () => void) =>
        listeners.delete(fn),
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("honours system changes, persists explicit themes, and preserves independent feedback preferences", () => {
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_event: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_event: string, fn: () => void) =>
      listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", () => query);
  localStorage.setItem(
    "study-feedback-preferences-v1",
    '{"sounds":false,"animations":false}',
  );
  render(<ThemeControl />);
  expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  expect(document.documentElement.dataset.theme).toBe("dark");
  act(() => {
    dark = false;
    listeners.forEach((fn) => fn());
  });
  expect(document.documentElement.dataset.theme).toBe("light");
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  expect(readTheme()).toBe("dark");
  act(() => listeners.forEach((fn) => fn()));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("study-feedback-preferences-v1")).toBe(
    '{"sounds":false,"animations":false}',
  );
});
it("synchronises changes from another tab and removes listeners on unmount", () => {
  const { unmount } = render(<ThemeControl />);
  act(() => {
    localStorage.setItem(THEME_KEY, "light");
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
  });
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  expect(document.documentElement.dataset.theme).toBe("light");
  unmount();
  expect(listeners.size).toBe(0);
});
it("uses System for invalid preferences and works when device storage is unavailable", () => {
  localStorage.setItem(THEME_KEY, "invalid");
  expect(readTheme()).toBe("system");
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  render(<ThemeControl />);
  fireEvent.click(screen.getByRole("radio", { name: "Light" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  get.mockRestore();
  set.mockRestore();
});
it("applies remembered appearance before React and styles load, including System and blocked storage", () => {
  const script = readFileSync(
    "public/theme-init.js",
    "utf8",
  );
  for (const [preference, systemDark, result] of [
    ["dark", false, "dark"],
    ["light", true, "light"],
    ["system", true, "dark"],
    ["invalid", false, "light"],
  ] as const) {
    const root = {
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    };
    runInNewContext(script, {
      localStorage: { getItem: () => preference },
      window: { matchMedia: () => ({ matches: systemDark }) },
      document: { documentElement: root, querySelector: () => null },
    });
    expect(root.dataset.theme).toBe(result);
    expect(root.style.colorScheme).toBe(result);
  }
  const root = { dataset: {} as Record<string, string>, style: {} };
  runInNewContext(script, {
    localStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
    },
    window: { matchMedia: () => ({ matches: true }) },
    document: { documentElement: root, querySelector: () => null },
  });
  expect(root.dataset.theme).toBe("dark");
});
