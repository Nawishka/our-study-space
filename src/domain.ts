export type Role = "host" | "melan" | "shashi";
export type Student = Exclude<Role, "host">;
export interface Profile {
  id: string;
  role: Role;
  display_name: string;
}
export interface Subject {
  code: string;
  name: string;
  student_role: Student;
}
export interface Task {
  id: string;
  owner_id: string;
  title: string;
  original_due: string;
  completed_at: string | null;
  cancelled_at: string | null;
  challenge_id: string | null;
}
export interface TaskDay {
  task_id: string;
  study_date: string;
  completed: boolean;
}
export interface TestRecord {
  id: string;
  owner_id: string;
  subject_code: string;
  test_number: number;
  obtained: number;
  maximum: number;
  note: string;
  taken_on: string;
  status: "draft" | "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  challenge_id: string | null;
}
export interface Settings {
  postponed_penalty_points?: number;
  penalty_effective_from?: string;
  rules_version?: number;
  practice_weight?: number;
  performance_weight?: number;
  practice_target?: number;
  exam_date: string | null;
  task_weight: number;
  test_weight: number;
  target_score: number;
  minimum_days: number;
  minimum_on_time: number;
}
export interface Score {
  missed_tasks?: number;
  penalty_points?: number;
  manual_points?: number;
  score_before_adjustments?: number;
  rules_version?: number;
  practice_score?: number;
  performance_score?: number;
  owner_id: string;
  total_tasks: number;
  on_time_tasks: number;
  active_days: number;
  on_time_percent: number;
  test_average: number;
  subject_coverage: number;
  task_score: number;
  test_score: number;
  score: number;
  qualified: boolean;
  subjects: Record<string, { count: number; average: number | null }>;
}
export interface Challenge {
  id: string;
  started_at: string;
  ended_at: string | null;
  rules: Settings;
  snapshot: { melan: Score; shashi: Score; elapsed_days: number } | null;
}
export interface Reward {
  id: string;
  challenge_id: string;
  unlocked_at: string;
  redeemed_at: string | null;
}
export interface Data {
  notifications?: StudyNotification[];
  notification_reads?: { notification_id: string; reader_id: string }[];
  notification_error?: string;
  profiles: Profile[];
  subjects: Subject[];
  tasks: Task[];
  task_days: TaskDay[];
  tests: TestRecord[];
  settings: Settings;
  challenges: Challenge[];
  rewards: Reward[];
  scores: { challenge?: Challenge; students?: Record<Student, Score> };
}
export interface StudyNotification {
  id: string;
  owner_id: string;
  kind:
    | "score_up"
    | "score_down"
    | "test_approved"
    | "test_rejected"
    | "task_postponed"
    | "manual_points"
    | "reward";
  severity: "info" | "success" | "warning";
  title: string;
  message: string;
  created_at: string;
}
export const STUDENTS: Student[] = ["melan", "shashi"];
export const NAMES: Record<Role, string> = {
  host: "Host",
  melan: "Melan",
  shashi: "Shashi",
};
export const ZONE = "Asia/Colombo";
export function studyDate(instant: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function dayDifference(a: string, b: string) {
  return Math.round(
    (Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000,
  );
}
export function countdown(exam: string | null, today = studyDate()) {
  if (!exam)
    return {
      label: "Your next chapter awaits",
      detail: "The host will set your A/L examination date.",
      tone: "neutral",
    };
  const days = dayDifference(exam, today);
  return {
    label:
      days < 0
        ? "A new chapter begins"
        : days === 0
          ? "EXAM DAY"
          : String(days),
    detail:
      days > 0
        ? "DAYS UNTIL YOUR A/L EXAMINATIONS"
        : days === 0
          ? "Breathe. You’ve put in the work."
          : "Your exam starting date has passed.",
    tone:
      days < 0 || days > 60
        ? "neutral"
        : days > 30
          ? "amber"
          : days > 7
            ? "coral"
            : "urgent",
  };
}
export function progress(done: number, total: number) {
  return {
    done,
    remaining: total - done,
    percent: total ? Math.round((done / total) * 100) : 0,
    empty: total === 0,
  };
}
export function canEdit(profile: Profile, owner: string) {
  return profile.role === "host" || profile.id === owner;
}
export function viewMismatch(hint: string | null, role: Role) {
  return !!hint && ["host", "melan", "shashi"].includes(hint) && hint !== role;
}
export function percent(t: Pick<TestRecord, "obtained" | "maximum">) {
  return (Number(t.obtained) / Number(t.maximum)) * 100;
}
export function validateFile(file: Pick<File, "size" | "type">) {
  return !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
    file.type,
  )
    ? "Choose a JPEG, PNG, WebP or PDF file."
    : file.size > 10 * 1024 * 1024
      ? "Each file must be 10 MB or smaller."
      : file.size === 0
        ? "This file is empty."
        : null;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ZONE,
  }).format(new Date(date.length === 10 ? date + "T00:00:00+05:30" : date));
}
export const emptyScore = (id: string): Score => ({
  owner_id: id,
  total_tasks: 0,
  on_time_tasks: 0,
  active_days: 0,
  on_time_percent: 0,
  test_average: 0,
  subject_coverage: 0,
  task_score: 0,
  test_score: 0,
  score: 0,
  qualified: false,
  subjects: {},
});
