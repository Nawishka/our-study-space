import { addDays, emptyScore, studyDate, type Data } from "./domain";
import { previewScore } from "./scoring";
export function demoData(): Data {
  const today = studyDate();
  const settings = {
    rules_version: 2,
    postponed_penalty_points: 1,
    practice_weight: 25,
    performance_weight: 5,
    practice_target: 2,
    exam_date: null,
    task_weight: 70,
    test_weight: 30,
    target_score: 85,
    minimum_days: 20,
    minimum_on_time: 80,
  };
  const profiles = [
    { id: "melan", role: "melan" as const, display_name: "Melan" },
    { id: "shashi", role: "shashi" as const, display_name: "Shashi" },
    { id: "host", role: "host" as const, display_name: "Host" },
  ];
  const subjects = [
    {
      code: "ET",
      name: "Engineering Technology",
      student_role: "melan" as const,
    },
    {
      code: "SFT",
      name: "Science for Technology",
      student_role: "melan" as const,
    },
    {
      code: "ICT",
      name: "Information & Communication Technology",
      student_role: "melan" as const,
    },
    { code: "BIO", name: "Biology", student_role: "shashi" as const },
    { code: "CHEM", name: "Chemistry", student_role: "shashi" as const },
    { code: "PHY", name: "Physics", student_role: "shashi" as const },
  ];
  const titles = [
    "Revise mechanics · structured questions",
    "Practice logic gates & truth tables",
    "SFT past paper · Section A",
    "Review this week’s short notes",
    "Cell biology · active recall",
    "Organic chemistry · reaction map",
    "Physics past paper · 5 questions",
    "Review the tricky bits",
  ];
  const tasks = titles.map((title, i) => ({
    id: "task-" + i,
    owner_id: i < 4 ? "melan" : "shashi",
    title,
    original_due: i === 2 ? addDays(today, -1) : today,
    completed_at: [0, 3, 4].includes(i) ? new Date().toISOString() : null,
    cancelled_at: null,
    challenge_id: "demo-challenge",
  }));
  const tests = subjects.flatMap((s, i) =>
    [68, 76, 82].map((score, j) => ({
      id: `test-${i}-${j}`,
      owner_id: s.student_role,
      subject_code: s.code,
      test_number: j + 1,
      obtained: score + (i % 3) * 2,
      maximum: 100,
      note: "Sample approved test — demonstration only",
      taken_on: addDays(today, -(3 - j) * 4),
      status: "approved" as const,
      rejection_reason: null,
      challenge_id: "demo-challenge",
    })),
  );
  const challenge = {
    id: "demo-challenge",
    started_at: addDays(today, -12) + "T00:00:00+05:30",
    ended_at: null,
    rules: settings,
    snapshot: null,
  };
  const data: Data = {
    profiles,
    subjects,
    tasks,
    task_days: tasks.map((t) => ({
      task_id: t.id,
      study_date: today,
      completed: !!t.completed_at,
    })),
    tests,
    settings,
    challenges: [challenge],
    rewards: [],
    notification_reads: [],
    notifications: [
      {
        id: "demo-notice-1",
        owner_id: "melan",
        kind: "task_postponed",
        severity: "warning",
        title: "Task postponed",
        message:
          "SFT past paper · Section A. 1 challenge point deducted once. The total cannot go below zero.",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-notice-2",
        owner_id: "melan",
        kind: "score_down",
        severity: "warning",
        title: "Challenge score decreased",
        message:
          "Sample score change after a missed deadline. Your next step: complete today’s planned tasks.",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-notice-3",
        owner_id: "shashi",
        kind: "test_approved",
        severity: "success",
        title: "Test approved",
        message: "CHEM · Test 03. Approved by Host.",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-notice-4",
        owner_id: "shashi",
        kind: "test_rejected",
        severity: "warning",
        title: "Test needs a correction",
        message:
          "PHY · Test 04. Please include the marked final page before resubmitting.",
        created_at: new Date().toISOString(),
      },
    ],
    scores: {
      challenge,
      students: {
        melan: {
          ...emptyScore("melan"),
          missed_tasks: 1,
          penalty_points: 1,
          total_tasks: 36,
          on_time_tasks: 29,
          active_days: 12,
          on_time_percent: 80.56,
          test_average: 76,
          subject_coverage: 3,
          task_score: 56.39,
          test_score: 22.8,
          score: 79.19,
          subjects: {
            ET: { count: 3, average: 75.33 },
            SFT: { count: 3, average: 77.33 },
            ICT: { count: 3, average: 79.33 },
          },
        },
        shashi: {
          ...emptyScore("shashi"),
          total_tasks: 38,
          on_time_tasks: 33,
          active_days: 11,
          on_time_percent: 86.84,
          test_average: 78,
          subject_coverage: 3,
          task_score: 60.79,
          test_score: 23.4,
          score: 84.19,
          subjects: {
            BIO: { count: 3, average: 75.33 },
            CHEM: { count: 3, average: 77.33 },
            PHY: { count: 3, average: 79.33 },
          },
        },
      },
    },
  };
  for (const student of ["melan", "shashi"] as const) {
    data.scores.students![student] = previewScore(
      data.scores.students![student],
      settings,
      subjects.filter((s) => s.student_role === student),
    );
  }
  return data;
}
