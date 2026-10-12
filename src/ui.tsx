import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Leaf,
  LockKeyhole,
} from "lucide-react";
import {
  NAMES,
  ZONE,
  canEdit,
  countdown,
  formatDate,
  progress,
  studyDate,
  type Data,
  type Profile,
  type Student,
  type Task,
} from "./domain";
export function Brand() {
  return (
    <a className="brand" href="#/daily" aria-label="Our Study Space home">
      <span className="brand-icon">
        <BookOpen size={24} />
      </span>
      <span>
        our study space
        <span className="brand-sub">A LITTLE SPACE. A LITTLE PROGRESS.</span>
      </span>
    </a>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Leaf size={23} />
      <p>{children}</p>
    </div>
  );
}
export function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="clock">
      <span>
        {new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: ZONE,
        }).format(now)}
      </span>
      <span className="clock-time">
        {new Intl.DateTimeFormat("en-GB", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: ZONE,
        }).format(now)}{" "}
        <span className="muted">· Sri Lanka</span>
      </span>
    </time>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {aside}
    </div>
  );
}
export function Identity({
  student,
  subtitle,
}: {
  student: Student;
  subtitle: string;
}) {
  return (
    <div className="identity">
      <span className={"avatar " + student}>{NAMES[student][0]}</span>
      <div>
        <h2>
          {NAMES[student]}
          <span className="tiny muted">’s space</span>
        </h2>
        <p className="muted tiny">{subtitle}</p>
      </div>
    </div>
  );
}
function TaskRow({
  task,
  done,
  editable,
  busy,
  onToggle,
}: {
  task: Task;
  done: boolean;
  editable: boolean;
  busy: boolean;
  onToggle: (id: string, done: boolean) => Promise<void>;
}) {
  const postponed = task.original_due < studyDate();
  return (
    <li className={"task-row " + (done ? "is-done" : "")}>
      {editable ? (
        <button
          disabled={busy}
          className="check-button"
          aria-label={
            done ? "Undo " + task.title : "Mark as done: " + task.title
          }
          onClick={() => void onToggle(task.id, !done).catch(() => {})}
        >
          {done ? <Check size={16} /> : <span />}
        </button>
      ) : (
        <span className="check-static">
          {done ? <Check size={16} /> : <span />}
        </span>
      )}
      <div className="task-copy">
        <span>{task.title}</span>
        {postponed && (
          <details className="task-details">
            <summary>Postponed</summary>
            <span>Originally due {formatDate(task.original_due)}</span>
          </details>
        )}
      </div>
      {done && editable && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void onToggle(task.id, false).catch(() => {})}
        >
          Undo
        </button>
      )}
    </li>
  );
}
export function Daily({
  data,
  profile,
  busy,
  onToggle,
}: {
  data: Data;
  profile: Profile;
  busy: boolean;
  onToggle: (id: string, done: boolean) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [today, setToday] = useState(studyDate());
  useEffect(() => {
    const timer = setInterval(() => setToday(studyDate()), 1000);
    return () => clearInterval(timer);
  }, []);
  const exam = countdown(data.settings.exam_date, today);
  return (
    <>
      <PageHeading
        eyebrow="ONE DAY AT A TIME"
        title="Make room for progress."
        description="A fresh page, a shared purpose. Let’s make today count."
        aside={
          <span className="pill">
            <Leaf size={14} /> Steady is a beautiful pace
          </span>
        }
      />
      <section
        className={"exam-banner " + exam.tone}
        aria-label="Shared A/L exam countdown"
      >
        <div className="exam-illustration" aria-hidden="true">
          <svg viewBox="0 0 150 100">
            <path
              d="M15 75Q60 68 72 83L72 27Q40 10 15 24Z"
              fill="#e4ebdf"
              stroke="#7c998b"
            />
            <path
              d="M72 83Q100 67 136 74V24Q104 10 72 27Z"
              fill="#fffaf0"
              stroke="#7c998b"
            />
            <path
              d="M29 36l28 4m-28 9 28 4m31-12 32-6m-32 19 32-6"
              stroke="#acbbaa"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path d="M110 5v15m-7-7h14" stroke="#c4ad75" strokeWidth="2" />
          </svg>
        </div>
        <div>
          <div className="eyebrow">OUR NEXT BIG MILESTONE</div>
          <strong
            className={
              data.settings.exam_date ? "countdown-number" : "countdown-unset"
            }
          >
            {exam.label}
          </strong>
          <p>{exam.detail}</p>
        </div>
        <div className="exam-note">
          Small steps today.
          <br />
          <em>Big possibilities tomorrow.</em>
          {data.settings.exam_date && (
            <span>{formatDate(data.settings.exam_date)}</span>
          )}
        </div>
      </section>
      <div className="section-heading">
        <h2>Today’s focus</h2>
        <span className="muted tiny">Two paths. Cheering each other on.</span>
      </div>
      <div className="student-grid">
        {(["melan", "shashi"] as Student[]).map((student) => {
          const owner = data.profiles.find((p) => p.role === student);
          if (!owner) return null;
          const days = data.task_days.filter((d) => d.study_date === today);
          const tasks = data.tasks.filter(
            (t) =>
              t.owner_id === owner.id &&
              !t.cancelled_at &&
              days.some((d) => d.task_id === t.id),
          );
          const done = tasks.filter(
            (t) => days.find((d) => d.task_id === t.id)?.completed,
          );
          const left = tasks.filter(
            (t) => !days.find((d) => d.task_id === t.id)?.completed,
          );
          const p = progress(done.length, tasks.length);
          const editable = canEdit(profile, owner.id);
          return (
            <section key={student} className={"card student-card " + student}>
              <header className="card-header">
                <Identity
                  student={student}
                  subtitle={
                    editable
                      ? "Your little steps matter."
                      : "A little encouragement goes a long way."
                  }
                />
                <button
                  className="icon-button"
                  aria-expanded={!collapsed[student]}
                  aria-label={
                    (collapsed[student] ? "Expand " : "Minimize ") +
                    NAMES[student] +
                    " tasks"
                  }
                  onClick={() =>
                    setCollapsed({
                      ...collapsed,
                      [student]: !collapsed[student],
                    })
                  }
                >
                  {collapsed[student] ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronUp size={20} />
                  )}
                </button>
              </header>
              <div className="progress-area">
                <div className="between">
                  <span className="tiny">Daily progress</span>
                  <strong>{p.empty ? "—" : p.percent + "%"}</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={NAMES[student] + " daily progress"}
                  aria-valuenow={p.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: p.percent + "%" }} />
                </div>
                <div className="between tiny muted">
                  <span>
                    {p.empty
                      ? "No tasks planned"
                      : `${p.done} done · ${p.remaining} remaining`}
                  </span>
                  <span>
                    {p.empty ? "A blank canvas" : `${p.done} / ${tasks.length}`}
                  </span>
                </div>
              </div>
              {!collapsed[student] && (
                <>
                  <h3 className="list-heading">
                    Tasks remaining <span>{left.length}</span>
                  </h3>
                  {left.length ? (
                    <ul className="task-list">
                      {left.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          done={false}
                          editable={editable}
                          busy={busy}
                          onToggle={onToggle}
                        />
                      ))}
                    </ul>
                  ) : (
                    <Empty>
                      {tasks.length
                        ? "Everything for today is done. Take a breath."
                        : "Plan something small for tomorrow in Academic Growth."}
                    </Empty>
                  )}
                  <h3 className="list-heading done-label">
                    Tasks done <span>{done.length}</span>
                  </h3>
                  <ul className="task-list">
                    {done.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        done
                        editable={editable}
                        busy={busy}
                        onToggle={onToggle}
                      />
                    ))}
                  </ul>
                  {!done.length && (
                    <p className="tiny muted empty-line">
                      Your first little win is waiting.
                    </p>
                  )}
                  <footer className="card-footer">
                    {editable ? (
                      <>
                        <Leaf size={14} /> Progress, at your own pace.
                      </>
                    ) : (
                      <>
                        <LockKeyhole size={14} /> Shared with you · read only
                      </>
                    )}
                  </footer>
                </>
              )}
            </section>
          );
        })}
      </div>
      <div className="quiet-note">
        “Great things are done by a series of small things brought together.”
        <span>One task, one page, one day.</span>
      </div>
    </>
  );
}
