import { expect, it } from "vitest";
import { demoData } from "../src/demo";
import { emptyScore } from "../src/domain";
import {
  nextStep,
  previewScore,
  revisedRules,
  rulesError,
} from "../src/scoring";
const data = demoData();
const subjects = data.subjects.filter((s) => s.student_role === "melan");
// Keep explicit v2 fixtures alongside the new practice-focused default.
const rules = revisedRules({
  ...data.settings,
  practice_weight: 15,
  performance_weight: 15,
});
it("calculates the demo preview without rounding or inventing missing subjects", () => {
  const score = {
    ...emptyScore("melan"),
    total_tasks: 3,
    on_time_tasks: 2,
    subjects: { ET: { count: 4, average: 50 }, SFT: { count: 1, average: 80 } },
  };
  const result = previewScore(score, rules, subjects);
  expect(result.practice_score).toBe(7.5);
  expect(result.performance_score).toBe(6.5);
  expect(result.score).toBeCloseTo((70 * 2) / 3 + 14, 12);
  expect(previewScore(emptyScore("melan"), rules, subjects).score).toBe(0);
});
it("caps practice while every additional paper's subject average still matters", () => {
  const score = {
    ...emptyScore("melan"),
    total_tasks: 20,
    on_time_tasks: 20,
    active_days: 20,
    on_time_percent: 100,
    subject_coverage: 3,
    subjects: {
      ET: { count: 8, average: 100 },
      SFT: { count: 3, average: 100 },
      ICT: { count: 2, average: 100 },
    },
  };
  expect(previewScore(score, rules, subjects)).toMatchObject({
    practice_score: 15,
    performance_score: 15,
    score: 100,
    qualified: true,
  });
  // One in each subject can qualify without meeting the practice target.
  for (const subject of Object.values(score.subjects)) subject.count = 1;
  expect(previewScore(score, rules, subjects)).toMatchObject({
    practice_score: 7.5,
    score: 92.5,
    qualified: true,
  });
});
it("validates configurable weights and chooses calm, actionable next steps", () => {
  expect(rulesError({ ...rules, practice_weight: 16 })).toContain("total 100");
  expect(rulesError({ ...rules, practice_target: 1.5 })).toContain("whole");
  const score = {
    ...emptyScore("melan"),
    subjects: {
      ET: { count: 2, average: 80 },
      SFT: { count: 2, average: 80 },
      ICT: { count: 0, average: null },
    },
  };
  expect(nextStep(score, rules, subjects, 2)).toContain("first ICT test");
  score.subjects.ICT.count = 1;
  expect(nextStep(score, rules, subjects, 2)).toBe(
    "Complete today’s planned tasks.",
  );
  expect(nextStep(score, rules, subjects, 0)).toContain("One more approved");
});
