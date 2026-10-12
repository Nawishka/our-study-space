import { describe, expect, it } from "vitest";
import {
  addDays,
  canEdit,
  countdown,
  dayDifference,
  percent,
  progress,
  studyDate,
  validateFile,
  viewMismatch,
} from "../src/domain";
describe("Colombo study dates", () => {
  it("rolls over exactly at 18:30 UTC, independent of host timezone", () => {
    expect(studyDate(new Date("2026-10-12T18:29:59Z"))).toBe("2026-10-12");
    expect(studyDate(new Date("2026-10-12T18:30:00Z"))).toBe("2026-10-13");
  });
  it("handles leap dates and calendar day distances", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(dayDifference("2026-11-01", "2026-10-01")).toBe(31);
  });
  it("does not invent an exam date and handles urgency, exam day and past", () => {
    expect(countdown(null).tone).toBe("neutral");
    expect(countdown("2026-12-31", "2026-10-12").tone).toBe("neutral");
    expect(countdown("2026-11-20", "2026-10-12").tone).toBe("amber");
    expect(countdown("2026-11-06", "2026-10-12").label).toBe("25");
    expect(countdown("2026-10-13", "2026-10-12").tone).toBe("urgent");
    expect(countdown("2026-10-12", "2026-10-12").label).toBe("EXAM DAY");
    expect(countdown("2026-10-11", "2026-10-12").label).toBe(
      "A new chapter begins",
    );
  });
});
describe("progress and permissions", () => {
  it("reports 8/10 accurately and handles undo and no tasks", () => {
    expect(progress(8, 10)).toEqual({
      done: 8,
      remaining: 2,
      percent: 80,
      empty: false,
    });
    expect(progress(7, 10).percent).toBe(70);
    expect(progress(0, 0)).toEqual({
      done: 0,
      remaining: 0,
      percent: 0,
      empty: true,
    });
  });
  it("never treats a URL hint as a role", () => {
    const melan = { id: "m", role: "melan" as const, display_name: "Melan" };
    expect(viewMismatch("host", melan.role)).toBe(true);
    expect(canEdit(melan, "s")).toBe(false);
    expect(canEdit(melan, "m")).toBe(true);
    expect(viewMismatch("melan", "melan")).toBe(false);
  });
  it("normalizes unequal maximum marks", () => {
    expect(percent({ obtained: 40, maximum: 50 })).toBe(80);
  });
  it("rejects unsupported, oversized and empty proofs", () => {
    expect(validateFile({ type: "image/svg+xml", size: 100 })).toBeTruthy();
    expect(validateFile({ type: "image/png", size: 10485761 })).toBeTruthy();
    expect(validateFile({ type: "application/pdf", size: 0 })).toBeTruthy();
    expect(
      validateFile({ type: "application/pdf", size: 10485760 }),
    ).toBeNull();
  });
});
