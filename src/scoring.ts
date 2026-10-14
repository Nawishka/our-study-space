import type { Score, Settings, Subject } from "./domain";

export const revisedRules = (settings: Settings): Settings => ({
  ...settings,
  rules_version: 2,
  task_weight: settings.rules_version === 2 ? settings.task_weight : 70,
  test_weight: settings.rules_version === 2 ? settings.test_weight : 30,
  practice_weight: settings.practice_weight ?? 15,
  performance_weight: settings.performance_weight ?? 15,
  practice_target: settings.practice_target ?? 2,
});

export function rulesError(r: Settings): string | null {
  const weights = [r.task_weight, r.practice_weight, r.performance_weight];
  if (
    weights.some((v) => v == null || !Number.isFinite(v) || v < 0 || v > 100) ||
    Math.abs(weights.reduce<number>((sum, v) => sum + (v ?? 0), 0) - 100) > 1e-9
  )
    return "Task, practice and performance points must total 100.";
  if (
    !Number.isInteger(r.practice_target) ||
    r.practice_target! < 1 ||
    r.practice_target! > 100
  )
    return "Choose a whole practice target from 1 to 100 papers per subject.";
  if (
    !Number.isInteger(r.minimum_days) ||
    r.minimum_days < 1 ||
    r.minimum_days > 365 ||
    !Number.isFinite(r.target_score) ||
    r.target_score < 0 ||
    r.target_score > 100 ||
    !Number.isFinite(r.minimum_on_time) ||
    r.minimum_on_time < 0 ||
    r.minimum_on_time > 100
  )
    return "Use valid percentages and 1 to 365 active study days.";
  return null;
}

// For the explicitly labelled demo preview only. Production previews use the
// host-only database RPC, and earned scores always come from the database.
export function previewScore(
  score: Score,
  rules: Settings,
  subjects: Subject[],
): Score {
  const error = rulesError(rules);
  if (error) throw new Error(error);
  const practice =
    (subjects.reduce(
      (sum, s) =>
        sum +
        Math.min(
          (score.subjects[s.code]?.count ?? 0) / rules.practice_target!,
          1,
        ),
      0,
    ) *
      rules.practice_weight!) /
    3;
  const performance =
    (subjects.reduce(
      (sum, s) => sum + (score.subjects[s.code]?.average ?? 0),
      0,
    ) *
      rules.performance_weight!) /
    300;
  const task = score.total_tasks
    ? (rules.task_weight * score.on_time_tasks) / score.total_tasks
    : 0;
  const total = Math.min(100, Math.max(0, task + practice + performance));
  return {
    ...score,
    rules_version: 2,
    task_score: task,
    practice_score: practice,
    performance_score: performance,
    test_score: practice + performance,
    score: total,
    qualified:
      total >= rules.target_score &&
      score.active_days >= rules.minimum_days &&
      score.on_time_percent >= rules.minimum_on_time &&
      score.subject_coverage === 3,
  };
}

export function nextStep(
  score: Score,
  rules: Settings,
  subjects: Subject[],
  remainingToday: number,
): string {
  const missing = subjects.find((s) => !score.subjects[s.code]?.count);
  if (missing)
    return `Complete your first ${missing.code} test and submit it for approval.`;
  if (remainingToday > 0) return "Complete today’s planned tasks.";
  if (rules.rules_version === 2) {
    const underTarget = subjects.find(
      (s) => score.subjects[s.code].count < rules.practice_target!,
    );
    if (underTarget) {
      const left =
        rules.practice_target! - score.subjects[underTarget.code].count;
      return `${left === 1 ? "One more" : left + " more"} approved ${underTarget.name} ${left === 1 ? "paper reaches" : "papers reach"} your practice target.`;
    }
  }
  if (
    score.active_days < rules.minimum_days ||
    score.on_time_percent < rules.minimum_on_time
  )
    return "Plan a manageable task for tomorrow and complete it on its due date.";
  if (score.score < rules.target_score)
    return "Review a tricky topic before your next timed paper.";
  return "Your requirements are met. Keep your routine comfortable while the shared challenge continues.";
}
