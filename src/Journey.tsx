import { useState, type CSSProperties, type FormEvent } from "react";
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
  type Student,
} from "./domain";
import { Empty, Identity, PageHeading } from "./ui";
import type { Mutate } from "./Academic";
export function Character({ student }: { student: Student }) {
  return (
    <svg
      viewBox="0 0 100 140"
      role="img"
      aria-label={NAMES[student] + " study companion"}
    >
      <ellipse cx="50" cy="132" rx="27" ry="5" fill="#454c3920" />
      {student === "shashi" && (
        <path d="M24 37Q18 7 50 6Q83 5 78 43L84 87H18Z" fill="#48403c" />
      )}
      <path
        d="M35 104l-2 23m31-23 3 23"
        stroke="#494544"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M31 128h-7m44 0h8"
        stroke="#665d53"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M25 77Q50 62 74 77L72 110H28Z"
        fill={student === "melan" ? "#93bba7" : "#b9a7d8"}
      />
      <path
        d="M27 80l-7 23m54-23 6 23"
        stroke="#e9b998"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <rect x="43" y="59" width="14" height="18" rx="6" fill="#e9b998" />
      <ellipse cx="50" cy="40" rx="25" ry="28" fill="#f3c7a6" />
      {student === "melan" ? (
        <path
          d="M25 37Q15 2 53 6Q81 6 78 38L69 26Q41 29 39 17L28 39Z"
          fill="#49403a"
        />
      ) : (
        <path
          d="M24 33Q24 7 49 9Q76 7 77 35Q58 29 47 18Q39 29 24 33Z"
          fill="#48403c"
        />
      )}
      <path
        d="M39 42v3m22-3v3"
        stroke="#49403a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M45 54q5 5 10 0"
        fill="none"
        stroke="#ad6b61"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="33" cy="51" rx="5" ry="3" fill="#e9978b" opacity=".5" />
      <ellipse cx="66" cy="51" rx="5" ry="3" fill="#e9978b" opacity=".5" />
      <path
        d="M36 90l13 4 14-4v18l-14 4-13-4z"
        fill="#fffbef"
        stroke="#e0d8c9"
      />
      <path d="M49 94v18" stroke="#c9c6b6" />
      {student === "shashi" && <path d="M69 23l8-6 3 10-9 2Z" fill="#b9a7d8" />}
    </svg>
  );
}
function HostSettings({ data, mutate }: { data: Data; mutate: Mutate }) {
  const [values, setValues] = useState<Settings>(data.settings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await mutate("update_settings", {
        exam: values.exam_date || null,
        task_points: Number(values.task_weight),
        test_points: Number(values.test_weight),
        target: Number(values.target_score),
        study_days: Number(values.minimum_days),
        on_time: Number(values.minimum_on_time),
      });
      setMessage(
        "Saved. Exam date applies now; scoring rules apply to the next challenge.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save settings");
    } finally {
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
              ["test_weight", "Test points", 0, 100],
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
                step={key === "minimum_days" ? 1 : 0.1}
                required
                value={values[key]}
                onChange={(e) =>
                  setValues({ ...values, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <p className="tiny muted">
          Task points + test points must total 100. All three subjects are
          always required.
        </p>
        <button className="primary-button" disabled={busy}>
          Save settings
        </button>
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
}: {
  data: Data;
  profile: Profile;
  mutate: Mutate;
}) {
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
        eyebrow="BETTER, TOGETHER"
        title="A shared dream. Two little steps."
        description="Keep showing up for yourselves. There’s something lovely waiting along the way."
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
        <section className="celebration" role="status">
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
          <button className="primary-button" onClick={closeCelebration}>
            Here’s to the next chapter
          </button>
        </section>
      )}
      <section className="journey-scene card">
        <div className="eyebrow">THE MOVIE DATE CHALLENGE</div>
        <h2>Little by little, closer together.</h2>
        <p className="muted tiny">
          Two individual journeys. One well-earned evening.
        </p>
        <div className="journey-track">
          <div className="journey-path" />
          <div className="movie-center">
            <Clapperboard size={30} />
            <span>MOVIE NIGHT</span>
            <span className="tiny">our little reward</span>
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
          Every honest effort brings you a little closer. Both students must
          meet every requirement.
        </p>
      </section>
      <div className="student-grid">
        {STUDENTS.map((s) => {
          const owner = data.profiles.find((p) => p.role === s);
          const score =
            data.scores.students?.[s] ?? emptyScore(owner?.id ?? "");
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
                <Identity
                  student={s}
                  subtitle="Your effort, honestly measured."
                />
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
                    {score.on_time_tasks} of {score.total_tasks} original
                    obligations
                  </p>
                </div>
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
              </div>
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
        <summary>How your journey is measured</summary>
        <p>
          An active study day is a Colombo calendar day with at least one
          original task completed on its original due date. Task points are{" "}
          {rules.task_weight} × on-time original obligations ÷ all original
          obligations due in this challenge. Future plans enter the denominator
          when their day arrives. Carryovers never add another obligation.
        </p>
        <p>
          Test points are {rules.test_weight} × average approved eligible
          percentage ÷ 100. A test joins the active challenge when its draft is
          first saved, provided its test date is on or after the challenge’s
          start date. Later corrections keep that allocation. Approvals after a
          challenge closes stay in your academic history and never earn points
          again.
        </p>
        <p>
          Missing data scores zero. Qualification uses the full-precision score;
          displayed scores round to one decimal. Scores can fall when due tasks
          are missed. There is no 30-day deadline. When you both qualify, the
          server archives the results, issues one reward, and starts the next
          challenge at zero. Completed archived tasks cannot be undone.
        </p>
      </details>
      <section className="card reward-history">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MOMENTS WORTH KEEPING</div>
            <h2>Our little collection of wins.</h2>
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
      {profile.role === "host" && <HostSettings data={data} mutate={mutate} />}
    </>
  );
}
