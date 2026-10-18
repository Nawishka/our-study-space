import { afterEach, expect, it, vi } from "vitest";
import { GentleAudio } from "../src/sound";
afterEach(() => vi.unstubAllGlobals());
it("never creates audio until unlocked by an interaction; phrases are brief and replace previous playback", () => {
  const voices: {
    stop: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: () => {
      const voice = {
        type: "",
        frequency: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      voices.push(voice);
      return voice;
    },
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  };
  const constructor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal("AudioContext", constructor);
  const sound = new GentleAudio();
  sound.play("reward");
  expect(constructor).not.toHaveBeenCalled();
  sound.unlock();
  sound.play("reward");
  expect(constructor).toHaveBeenCalledOnce();
  expect(voices).toHaveLength(4);
  expect(voices[3].stop).toHaveBeenCalledWith(0.63);
  sound.play("plan");
  expect(voices[0].stop).toHaveBeenCalledTimes(2);
  expect(voices).toHaveLength(5);
  sound.dispose();
  expect(context.close).toHaveBeenCalledOnce();
});
it("silently falls back when the browser does not provide audio", () => {
  vi.stubGlobal("AudioContext", undefined);
  const sound = new GentleAudio();
  expect(() => {
    sound.unlock();
    sound.play("task");
    sound.dispose();
  }).not.toThrow();
});

it("waits for browser audio resume before reporting readiness", async () => {
  let resume!: () => void;
  const context = {
    state: "suspended",
    resume: () =>
      new Promise<void>((resolve) => {
        resume = () => {
          context.state = "running";
          resolve();
        };
      }),
  };
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return context;
    }),
  );
  const sound = new GentleAudio();
  const ready = sound.unlock();
  expect(sound.play("task")).toBe(false);
  resume();
  await expect(ready).resolves.toBe(true);
});

it("handles a rejected browser resume without an unhandled rejection", async () => {
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return {
        state: "suspended",
        resume: () => Promise.reject(new Error("Blocked")),
      };
    }),
  );
  await expect(new GentleAudio().unlock()).resolves.toBe(false);
});
