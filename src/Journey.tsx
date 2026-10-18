import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  Check,
  Clapperboard,
  Flower2,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  dayDifference,
  emptyScore,
  formatDate,
  NAMES,
  STUDENTS,
  studyDate,
  type Data,
  type Profile,
  type Settings,
  type Score,
  type Student,
} from "./domain";
import { Empty, Identity, PageHeading } from "./ui";
import type { Mutate } from "./Academic";
import { nextStep, previewScore, revisedRules, rulesError } from "./scoring";
import { rpc } from "./service";
import { useFeedback } from "./Feedback";
import HostPoints from "./HostPoints";
import Character from "./Character";
function HostSettings({
  data,
  mutate,
  demo,
}: {
  data: Data;
  mutate: Mutate;
  demo: boolean;
}) {
  const [values, setValues] = useState<Settings>(() =>
    revisedRules(data.settings),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [preview, setPreview] = useState<{
    rules: Settings;
    students: Record<Student, Score>;
  } | null>(null);
  const validation = rulesError(values);
  const installed = demo || data.settings.rules_version === 2;
  const args = () => ({
    task_points: Number(values.task_weight),
    practice_points: Number(values.practice_weight),
    performance_points: Number(values.performance_weight),
    papers_per_subject: Number(values.practice_target),
    target: Number(values.target_score),
    study_days: Number(values.minimum_days),
    on_time: Number(values.minimum_on_time),
  });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving.current || validation || !installed) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      await mutate("update_scoring_settings", {
        exam: values.exam_date || null,
        ...args(),
      });
      setMessage(
        "Saved. Exam date applies now; scoring rules apply to the next challenge.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <details className="card host-settings">
      <summary>
        <Settings2 size={19} />
        Host settings & challenge controls
      </summary>
      <form onSubmit={save}>
        <p className="notice">
          Scoring rules are frozen when a challenge starts. Changes here apply
          to the next challenge, keeping the current goalposts steady.
        </p>
        <p className="tiny muted">
          The practice-focused default is 70 task / 25 practice / 5 performance
          points. Missed deadlines cost 1 point once per task. The new penalty
          starts with deadlines on the installation day; earlier overdue tasks
          are exempt.
        </p>
        {!installed && (
          <p role="alert" className="notice">
            Scoring update pending. Apply the new 202610140004_scoring_v2.sql
            migration once to enable these controls. Current challenge scores
            still use their saved rules.
          </p>
        )}
        <div className="form-grid">
          <label>
            Shared A/L exam starting date
            <input
              type="date"
              value={values.exam_date ?? ""}
              onChange={(e) =>
                setValues({ ...values, exam_date: e.target.value })
              }
            />
          </label>
          {(
            [
              ["task_weight", "Task points", 0, 100],
              ["practice_weight", "Practice points", 0, 100],
              ["performance_weight", "Performance points", 0, 100],
              [
                "practice_target",
                "Approved papers per subject for full practice points",
                1,
                100,
              ],
              ["target_score", "Qualifying score", 0, 100],
              ["minimum_days", "Minimum active days", 1, 365],
              ["minimum_on_time", "Minimum on-time percentage", 0, 100],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                step={
                  key === "minimum_days" || key === "practice_target" ? 1 : 0.1
                }
                required
                value={values[key]}
                onChange={(e) => {
                  setValues({ ...values, [key]: Number(e.target.value) });
                  setPreview(null);
                }}
              />
            </label>
          ))}
        </div>
        <p className="tiny muted">
          Task + practice + performance points must total 100. Each subject
          receives one third of the practice and performance weights. The
          practice target is not an eligibility gate.
        </p>
        {validation && (
          <p role="alert" className="error">
            {validation}
          </p>
        )}
        <div className="button-row">
          <button
            className="primary-button"
            disabled={busy || !!validation || !installed}
          >
            Save settings
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || !!validation || !installed}
            onClick={async () => {
              if (saving.current) return;
              saving.current = true;
              setBusy(true);
              setMessage("");
              try {
                if (demo)
                  setPreview({
                    rules: values,
                    students: Object.fromEntries(
                      STUDENTS.map((s) => [
                        s,
                        previewScore(
                          data.scores.students?.[s] ?? emptyScore(s),
                          values,
                          data.subjects.filter(
                            (subject) => subject.student_role === s,
                          ),
                        ),
                      ]),
                    ) as Record<Student, Score>,
                  });
                else setPreview(await rpc("preview_challenge_scores", args()));
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Could not load preview",
                );
              } finally {
                saving.current = false;
                setBusy(false);
              }
            }}
          >
            Preview new calculation
          </button>
        </div>
        {preview && (
          <section
            className="score-preview"
            aria-label="Proposed scoring preview"
          >
            <h3>
              {demo
                ? "Sample calculation preview"
                : "Current work under the proposed rules"}
            </h3>
            <p className="tiny muted">
              Preview only · not earned scores · no data changed. A new
              challenge begins at zero and does not reuse this work.
            </p>
            {STUDENTS.map((s) => {
              const score = preview.students[s];
              return (
                <div key={s}>
                  <strong>
                    {NAMES[s]} · {score.score.toFixed(1)} / 100
                  </strong>
                  <p className="tiny">
                    Tasks {score.task_score.toFixed(1)} /{" "}
                    {preview.rules.task_weight} · Practice{" "}
                    {score.practice_score?.toFixed(1)} /{" "}
                    {preview.rules.practice_weight} · Performance{" "}
                    {score.performance_score?.toFixed(1)} /{" "}
                    {preview.rules.performance_weight}
                    {" · Host +"}
                    {(score.manual_points ?? 0).toFixed(1)}
                    {" · Postponements −"}
                    {(score.penalty_points ?? 0).toFixed(1)}
                  </p>
                </div>
              );
            })}
          </section>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </form>
      {!data.scores.challenge && (
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await mutate("activate_challenge", {});
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Could not activate");
            } finally {
              setBusy(false);
            }
          }}
        >
          Activate the first challenge
        </button>
      )}
    </details>
  );
}
export default function Journey({
  data,
  profile,
  mutate,
  demo = false,
}: {
  data: Data;
  profile: Profile;
  mutate: Mutate;
  demo?: boolean;
}) {
  const feedback = useFeedback();
  const [celebratingId, setCelebratingId] = useState("");
  const challenge = data.scores.challenge;
  const rules = challenge?.rules ?? data.settings;
  const elapsed = challenge
    ? dayDifference(studyDate(), studyDate(new Date(challenge.started_at))) + 1
    : 0;
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("reward-seen") ?? "",
  );
  const reward = data.rewards
    .slice()
    .sort((a, b) => b.unlocked_at.localeCompare(a.unlocked_at))[0];
  const celebrate = reward && dismissed !== reward.id;
  const closeCelebration = () => {
    if (reward) {
      sessionStorage.setItem("reward-seen", reward.id);
      setDismissed(reward.id);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="OUR JOURNEY / KEEP SHOWING UP"
        title="Build the future. Together."
        description="Your next honest effort matters. Let the progress speak."
        aside={
          <span className="pill">
            <Flower2 size={15} />
            {challenge
              ? `Day ${elapsed} · no rush, no expiry`
              : "Your journey is ready to begin"}
          </span>
        }
      />
      {celebrate && (
        <section
          className={
            "celebration" + (celebratingId === reward.id ? " celebrating" : "")
          }
          role="status"
        >
          <Sparkles size={30} />
          <h2>Movie Date Unlocked!</h2>
          <p>
            You both did the work. Your achievement is saved, and a fresh
            challenge has already begun.
          </p>
          <div className="meeting-characters">
            <Character student="melan" />
            <Character student="shashi" />
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              if (
                feedback.confirm(
                  `reward:${reward.id}`,
                  "reward",
                  "Movie Date Unlocked! Your achievement is saved.",
                )
              )
                setCelebratingId(reward.id);
            }}
          >
            Celebrate
          </button>
          <button className="primary-button" onClick={closeCelebration}>
            Here’s to the next chapter
          </button>
        </section>
      )}
      <section className="journey-scene card">
        <div className="eyebrow">THE MOVIE DATE CHALLENGE</div>
        <h2>Do the work. Earn the night.</h2>
        <p className="muted tiny">
          Two individual journeys. One well-earned evening.
        </p>
        <div className="journey-track">
          <div className="journey-path" />
          <div className="movie-center">
            <Clapperboard size={30} />
            <span>MOVIE NIGHT</span>
            <span className="tiny">well earned</span>
          </div>
          {STUDENTS.map((s) => {
            const score = data.scores.students?.[s]?.score ?? 0;
            return (
              <div
                key={s}
                className={"character " + s}
                style={
                  {
                    "--position": `${s === "melan" ? 5 + score * 0.32 : 95 - score * 0.32}%`,
                  } as CSSProperties
                }
              >
                <Character student={s} />
                <strong>
                  {NAMES[s]} <span>{score.toFixed(1)}</span>
                </strong>
              </div>
            );
          })}
          <span className="scene-flower flower-one">✳</span>
          <span className="scene-flower flower-two">✳</span>
          <span className="scene-flower flower-three">✦</span>
        </div>
        <p className="scene-caption">
          Challenge scores reflect the saved rules and can rise or fall. Both
          students must meet every requirement.
        </p>
      </section>
      <div className="student-grid">
        {STUDENTS.map((s) => {
          const owner = data.profiles.find((p) => p.role === s);
          const score =
            data.scores.students?.[s] ?? emptyScore(owner?.id ?? "");
          const subjects = data.subjects.filter((x) => x.student_role === s);
          const remaining = data.tasks.filter(
            (t) =>
              t.owner_id === owner?.id &&
              !t.cancelled_at &&
              !t.completed_at &&
              t.original_due <= studyDate(),
          ).length;
          const requirements = [
            {
              label: `Score of ${rules.target_score}+`,
              value: `${score.score.toFixed(1)} / 100`,
              met: score.score >= rules.target_score,
            },
            {
              label: `${rules.minimum_days} active study days`,
              value: `${score.active_days} days`,
              met: score.active_days >= rules.minimum_days,
            },
            {
              label: `${rules.minimum_on_time}% on-time tasks`,
              value: score.on_time_percent.toFixed(1) + "%",
              met: score.on_time_percent >= rules.minimum_on_time,
            },
            {
              label: "Approved test in every subject",
              value: `${score.subject_coverage} / 3 subjects`,
              met: score.subject_coverage === 3,
            },
          ];
          return (
            <section className={"card score-card " + s} key={s}>
              <div className="card-header">
                <Identity student={s} subtitle="Challenge score" />
                <div className="score-total">
                  {score.score.toFixed(1)}
                  <span>/ 100</span>
                </div>
              </div>
              <div className="subject-rings">
                {data.subjects
                  .filter((x) => x.student_role === s)
                  .map((subject) => {
                    const stats = score.subjects[subject.code];
                    return (
                      <div key={subject.code}>
                        <div
                          className="ring"
                          style={
                            {
                              "--value": `${stats?.average ?? 0}%`,
                            } as CSSProperties
                          }
                        >
                          <strong>
                            {stats?.count
                              ? stats.average?.toFixed(0) + "%"
                              : "—"}
                          </strong>
                        </div>
                        <strong className="tiny">{subject.code}</strong>
                        <span className="tiny muted">
                          {stats?.count ?? 0} approved
                        </span>
                        {rules.rules_version === 2 && (
                          <span className="tiny muted">
                            {Math.min(
                              stats?.count ?? 0,
                              rules.practice_target!,
                            )}{" "}
                            / {rules.practice_target} practice target
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="score-breakdown">
                <div>
                  <span>On-time tasks</span>
                  <strong>
                    {score.task_score.toFixed(1)}
                    <small> / {rules.task_weight} pts</small>
                  </strong>
                  <p>
                    {score.on_time_tasks} / {score.total_tasks} original
                    obligations completed on time ·{" "}
                    {score.on_time_percent.toFixed(1)}%
                  </p>
                </div>
                {rules.rules_version === 2 ? (
                  <>
                    <div>
                      <span>Approved test practice</span>
                      <strong>
                        {(score.practice_score ?? 0).toFixed(1)}
                        <small> / {rules.practice_weight} pts</small>
                      </strong>
                      <p>
                        {subjects.reduce(
                          (sum, subject) =>
                            sum +
                            Math.min(
                              score.subjects[subject.code]?.count ?? 0,
                              rules.practice_target!,
                            ),
                          0,
                        )}{" "}
                        / {3 * rules.practice_target!} practice slots · capped
                        per subject
                      </p>
                    </div>
                    <div>
                      <span>Approved test performance</span>
                      <strong>
                        {(score.performance_score ?? 0).toFixed(1)}
                        <small> / {rules.performance_weight} pts</small>
                      </strong>
                      <p>
                        Each subject average contributes up to{" "}
                        {(rules.performance_weight! / 3).toFixed(1)} points.
                        Missing subjects contribute zero.
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <span>Approved tests</span>
                    <strong>
                      {score.test_score.toFixed(1)}
                      <small> / {rules.test_weight} pts</small>
                    </strong>
                    <p>
                      {score.subject_coverage
                        ? `${score.test_average.toFixed(1)}% average`
                        : "No eligible approved tests yet"}
                    </p>
                  </div>
                )}
              </div>
              {rules.postponed_penalty_points !== undefined && (
                <div
                  className={
                    (score.penalty_points ?? 0) > 0
                      ? "notice notification-warning"
                      : "notice"
                  }
                >
                  <strong>
                    Postponement deductions: −
                    {(score.penalty_points ?? 0).toFixed(1)} pts
                  </strong>
                  <p className="tiny">
                    {score.missed_tasks ?? 0} missed original deadlines × 1
                    point. Charged once per task; completing it late does not
                    erase the deduction.{" "}
                    {rules.penalty_effective_from &&
                      `Applies to tasks originally due from ${formatDate(rules.penalty_effective_from)}.`}
                  </p>
                </div>
              )}
              {(score.manual_points ?? 0) > 0 && (
                <p className="notice">
                  Host-added points: +{score.manual_points!.toFixed(1)}. Reasons
                  are saved in the notification panel.
                </p>
              )}
              <p className="next-step">
                <strong>Your next step</strong>
                <br />
                {nextStep(score, rules, subjects, remaining)}
              </p>
              <h3 className="list-heading">The way to movie night</h3>
              <ul className="requirements">
                {requirements.map((r) => (
                  <li key={r.label}>
                    <span
                      className={
                        r.met ? "requirement-check met" : "requirement-check"
                      }
                    >
                      {r.met ? <Check size={13} /> : <span />}
                    </span>
                    <span>{r.label}</span>
                    <strong>{r.value}</strong>
                  </li>
                ))}
              </ul>
              {score.qualified && (
                <p className="notice">
                  Your requirements are met. Cheering on your study partner!
                </p>
              )}
            </section>
          );
        })}
      </div>
      <details className="card scoring-notes">
        <summary>
          How your challenge score works · rules v{rules.rules_version ?? 1}
        </summary>
        {rules.rules_version !== 2 && (
          <p className="notice">
            This challenge keeps its original task/test formula. Practice and
            equal-subject performance points begin with the next challenge.
            Earned scores and past rewards stay unchanged.
          </p>
        )}
        <p>
          An active study day is a Colombo calendar day with at least one
          original task completed on its original due date. Task points are{" "}
          {rules.task_weight} × on-time original obligations ÷ all original
          obligations due in this challenge. Future plans enter the denominator
          when their day arrives. Carryovers never add another obligation.
        </p>
        {rules.rules_version === 2 ? (
          <p>
            Each subject earns {rules.practice_weight! / 3} × min(approved
            eligible papers ÷ {rules.practice_target}, 1) practice points and{" "}
            {rules.performance_weight! / 3} × its average normalized percentage
            ÷ 100 performance points. The {rules.practice_target}-paper practice
            target is not an additional eligibility requirement: one approved
            paper in each subject is still the coverage gate. All extra papers
            stay in history, graphs and averages after practice points reach
            their cap. Subjects have equal weight; missing subjects contribute
            zero.
          </p>
        ) : (
          <p>
            Test points are {rules.test_weight} × average approved eligible
            percentage ÷ 100. A test joins the active challenge when its draft
            is first saved, provided its test date is on or after the
            challenge’s start date. Later corrections keep that allocation.
            Approvals after a challenge closes stay in your academic history and
            never earn points again.
          </p>
        )}
        <p>
          A qualifying test is a full paper or an agreed comparable timed
          section, checked by Host approval. Duplicate uploads and fragments of
          the same paper are one test, not extra practice. Pending/rejected
          papers earn no points. A test is allocated once when first saved;
          corrections retain its identity and challenge. Later approval cannot
          move an old test into a new challenge.
        </p>
        <p>
          Missing data scores zero. Qualification uses the full-precision score;
          displayed scores round to one decimal. Rounded components may add up
          to a slightly different displayed total; the server sums
          full-precision values before rounding for display. Averages can
          decrease after a lower mark, and task ratios can decrease when due
          tasks are missed. This is a challenge score, not a measure of who
          worked harder. There is no 30-day deadline. When you both qualify, the
          server archives the results, issues one reward, and starts the next
          challenge at zero. Completed archived tasks cannot be undone.
        </p>
        <p>
          When the postponement rule is enabled, a task missed at the end of its
          original Sri Lankan due day deducts 1 point once, in addition to its
          effect on the on-time ratio. Repeated carryovers do not add
          deductions. Host adjustments apply only to their recorded challenge.
          The final calculation is task + practice + performance + Host points −
          postponement deductions, limited to 0–100. Manual points do not
          replace the other eligibility requirements.
        </p>
      </details>
      <section className="card reward-history">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MOMENTS WORTH KEEPING</div>
            <h2>Proof you showed up.</h2>
          </div>
          <Clapperboard size={24} />
        </div>
        {!data.rewards.length ? (
          <Empty>
            Your first movie date is waiting to be earned. Take your time — this
            space isn’t going anywhere.
          </Empty>
        ) : (
          data.rewards.map((r) => {
            const archive = data.challenges.find(
              (c) => c.id === r.challenge_id,
            );
            return (
              <article className="reward-item" key={r.id}>
                <div>
                  <h3>Movie Date Unlocked</h3>
                  <p className="muted tiny">
                    {archive && formatDate(archive.started_at)} –{" "}
                    {formatDate(r.unlocked_at)} ·{" "}
                    {archive?.snapshot?.elapsed_days} days of effort
                  </p>
                  <p className="tiny">
                    Melan {archive?.snapshot?.melan.score.toFixed(1)} · Shashi{" "}
                    {archive?.snapshot?.shashi.score.toFixed(1)}
                  </p>
                  <p className="tiny muted">
                    Saved rules v{archive?.rules.rules_version ?? 1} · archived
                    scores remain unchanged
                  </p>
                  <span className="badge approved">
                    {r.redeemed_at
                      ? "Enjoyed on " + formatDate(r.redeemed_at)
                      : "An evening to look forward to"}
                  </span>
                </div>
                {profile.role === "host" && !r.redeemed_at && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void mutate("redeem_reward", { reward_id: r.id }).catch(
                        () => {},
                      )
                    }
                  >
                    Mark enjoyed
                  </button>
                )}
              </article>
            );
          })
        )}
      </section>
      {profile.role === "host" && (
        <>
          <HostPoints data={data} mutate={mutate} demo={demo} />
          <HostSettings data={data} mutate={mutate} demo={demo} />
        </>
      )}
    </>
  );
}
