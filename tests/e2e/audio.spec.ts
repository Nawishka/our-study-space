import { test, expect } from "@playwright/test";

test("real browser audio produces a brief signal only after an explicit sound request", async ({
  page,
}) => {
  // Observe the real audio graph, rather than replacing playback with a mock.
  await page.addInitScript(() => {
    const probe = { contexts: 0, voices: 0, peak: 0, current: 0 };
    Object.assign(window, { audioProbe: probe });
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      private monitor: AnalyserNode;
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts++;
        this.monitor = this.createAnalyser();
        this.monitor.fftSize = 256;
        const samples = new Float32Array(256);
        setInterval(() => {
          this.monitor.getFloatTimeDomainData(samples);
          probe.current = Math.max(...samples.map(Math.abs));
          probe.peak = Math.max(probe.peak, probe.current);
        }, 10);
      }
      createGain() {
        const gain = super.createGain();
        gain.connect(this.monitor);
        return gain;
      }
      createOscillator() {
        probe.voices++;
        return super.createOscillator();
      }
    };
  });
  const probe = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            audioProbe: {
              contexts: number;
              voices: number;
              peak: number;
              current: number;
            };
          }
        ).audioProbe,
    );
  await page.goto("./?demo=1#/daily");
  await expect(page.getByRole("button", { name: "Sounds off" })).toBeVisible();
  expect((await probe()).contexts).toBe(0);
  await page.getByRole("button", { name: "Sounds off" }).click();
  expect((await probe()).voices).toBe(0);
  await page.getByRole("button", { name: "Test sound" }).click();
  await expect(page.getByText("Sound sample played.")).toBeVisible();
  await expect.poll(async () => (await probe()).peak).toBeGreaterThan(0.001);
  expect((await probe()).voices).toBe(2);
  expect((await probe()).peak).toBeLessThan(0.06);
  await expect.poll(async () => (await probe()).current).toBeLessThan(0.0001);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sounds on" })).toBeVisible();
  expect((await probe()).contexts).toBe(0);
  await page.getByRole("button", { name: "Sounds on" }).click();
  await expect(page.getByRole("button", { name: "Test sound" })).toHaveCount(0);
  expect((await probe()).voices).toBe(0);
});
