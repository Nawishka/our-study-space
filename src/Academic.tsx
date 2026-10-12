import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addDays,
  canEdit,
  formatDate,
  NAMES,
  percent,
  STUDENTS,
  studyDate,
  validateFile,
  type Data,
  type Profile,
  type Student,
  type TestRecord,
} from "./domain";
import { Empty, Identity, PageHeading } from "./ui";
import { proofLinks, rpc, supabase } from "./service";
export type Mutate = (
  name: string,
  args: Record<string, unknown>,
) => Promise<void>;
function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="file-preview">
      {file.type.startsWith("image/") ? (
        <img src={url} alt={"Selected marked paper: " + file.name} />
      ) : (
        <FileText />
      )}
      <span>
        {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
      </span>
    </div>
  );
}
function TestForm({
  data,
  profile,
  record,
  close,
  refresh,
  demo,
}: {
  data: Data;
  profile: Profile;
  record?: TestRecord;
  close: () => void;
  refresh: () => Promise<void>;
  demo: boolean;
}) {
  const subjects = data.subjects.filter((s) => s.student_role === profile.role);
  const [subject, setSubject] = useState(
    record?.subject_code ?? subjects[0]?.code ?? "",
  );
  const [obtained, setObtained] = useState(String(record?.obtained ?? ""));
  const [maximum, setMaximum] = useState(String(record?.maximum ?? 100));
  const [note, setNote] = useState(record?.note ?? "");
  const [date, setDate] = useState(record?.taken_on ?? studyDate());
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const id = useRef(record?.id ?? crypto.randomUUID());
  const uploaded = useRef(new Map<File, string>());
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (demo)
        throw new Error(
          "Demo only. Connect Supabase to upload and save real test papers.",
        );
      if (!navigator.onLine)
        throw new Error(
          "You are offline. Your form is still here; reconnect and retry.",
        );
      if (
        Number(maximum) <= 0 ||
        Number(obtained) < 0 ||
        Number(obtained) > Number(maximum)
      )
        throw new Error("Marks must be between zero and the maximum.");
      if (!record && !files.length)
        throw new Error("Attach at least one marked paper.");
      for (const file of files) {
        const message = validateFile(file);
        if (message) throw new Error(message);
      }
      setPhase("Saving draft…");
      await rpc("save_test", {
        test_id: id.current,
        subject,
        score_obtained: Number(obtained),
        score_maximum: Number(maximum),
        test_note: note,
        test_date: date,
      });
      for (const file of files) {
        if (uploaded.current.has(file)) continue;
        setPhase("Uploading " + file.name + "…");
        const extension =
          file.type === "application/pdf"
            ? "pdf"
            : file.type === "image/png"
              ? "png"
              : file.type === "image/webp"
                ? "webp"
                : "jpg";
        const path = `${profile.id}/${id.current}/${crypto.randomUUID()}.${extension}`;
        const r = await supabase!.storage
          .from("test-proofs")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (r.error) throw new Error(r.error.message);
        uploaded.current.set(file, path);
      }
      setPhase("Submitting for approval…");
      await rpc("submit_test", { test_id: id.current });
      await refresh();
      close();
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Upload failed.") +
          " Your draft and any uploaded files are retained; retry safely.",
      );
    } finally {
      setBusy(false);
      setPhase("");
    }
  };
  return (
    <section className="form-panel" aria-label="Test submission">
      <div className="between">
        <h3>
          {record
            ? `Correct Test ${String(record.test_number).padStart(2, "0")}`
            : "A new milestone"}
        </h3>
        <button
          className="icon-button"
          disabled={busy}
          aria-label="Close test form"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <p className="tiny muted">
        Verified effort deserves a place here. Marks appear after host approval.
      </p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Subject
            <select
              value={subject}
              disabled={!!record || busy}
              onChange={(e) => setSubject(e.target.value)}
            >
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Test date
            <input
              type="date"
              required
              max={studyDate()}
              value={date}
              disabled={!!record || busy}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Marks obtained
            <input
              type="number"
              required
              min="0"
              max={maximum}
              step="0.01"
              value={obtained}
              onChange={(e) => setObtained(e.target.value)}
            />
          </label>
          <label>
            Maximum marks
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={maximum}
              onChange={(e) => setMaximum(e.target.value)}
            />
          </label>
        </div>
        <label>
          Note <span className="muted">(optional)</span>
          <textarea
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything useful to remember about this paper?"
          />
        </label>
        <label className="upload-zone">
          <Upload size={23} />
          <span>
            {record
              ? "Add more evidence (existing evidence is retained)"
              : "Attach your marked paper"}
          </span>
          <span className="tiny muted">
            JPEG, PNG, WebP or PDF · up to 10 MB each
          </span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []));
              setError("");
            }}
          />
        </label>
        {files.map((f, i) => (
          <FilePreview key={f.name + i} file={f} />
        ))}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          <Upload size={16} />
          {busy ? phase : "Submit for approval"}
        </button>
        <p className="tiny muted">
          Your subject’s test number is allocated securely on the server.
          Corrections keep the original number.
        </p>
      </form>
    </section>
  );
}
function Evidence({ testId, demo }: { testId: string; demo: boolean }) {
  const [links, setLinks] = useState<{ url: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        className="text-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            if (demo) throw new Error("Demo proof files are not real.");
            setLinks(await proofLinks(testId));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not open proof");
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileText size={15} /> {busy ? "Opening…" : "Open private proof"}
      </button>
      {links.length > 0 && (
        <div className="proof-links">
          {links.map((l, i) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Paper {i + 1} ↗
            </a>
          ))}
          <span className="tiny muted">
            Links expire after 60 seconds. Reopen if needed.
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
function ReviewItem({
  test,
  data,
  mutate,
  demo,
}: {
  test: TestRecord;
  data: Data;
  mutate: Mutate;
  demo: boolean;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const review = async (approve: boolean) => {
    setBusy(true);
    setError("");
    try {
      await mutate("review_test", { test_id: test.id, approve, reason });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="review-item">
      <div className="between">
        <strong>
          {data.profiles.find((p) => p.id === test.owner_id)?.display_name} ·{" "}
          {test.subject_code} · Test {String(test.test_number).padStart(2, "0")}
        </strong>
        <span>
          {test.obtained}/{test.maximum} · {percent(test).toFixed(1)}%
        </span>
      </div>
      <p className="tiny muted">
        {formatDate(test.taken_on)} {test.note && "· " + test.note}
      </p>
      <Evidence testId={test.id} demo={demo} />
      <label>
        Rejection reason
        <input
          value={reason}
          maxLength={2000}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Required only when rejecting"
        />
      </label>
      <div className="button-row">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void review(true)}
        >
          <Check size={16} />
          Approve
        </button>
        <button
          className="secondary-button"
          disabled={busy || reason.trim().length < 3}
          onClick={() => void review(false)}
        >
          Reject with reason
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
function AcademicStudent({
  student,
  data,
  profile,
  refresh,
  demo,
}: {
  student: Student;
  data: Data;
  profile: Profile;
  refresh: () => Promise<void>;
  demo: boolean;
}) {
  const owner = data.profiles.find((p) => p.role === student);
  const subjects = data.subjects.filter((s) => s.student_role === student);
  const [selected, setSelected] = useState(subjects[0]?.code);
  const [form, setForm] = useState<true | TestRecord | false>(false);
  if (!owner) return null;
  const tests = data.tests.filter((t) => t.owner_id === owner.id);
  const approved = tests.filter((t) => t.status === "approved");
  const graph = approved
    .filter((t) => t.subject_code === selected)
    .sort((a, b) => a.test_number - b.test_number)
    .map((t) => ({
      label: `Test ${String(t.test_number).padStart(2, "0")}`,
      percentage: Number(percent(t).toFixed(1)),
      marks: `${t.obtained}/${t.maximum}`,
    }));
  return (
    <section className={"card academic-card " + student}>
      <div className="card-header">
        <Identity
          student={student}
          subtitle="Small improvements. Lasting confidence."
        />
        {profile.id === owner.id && (
          <button
            className="secondary-button compact"
            onClick={() => setForm(true)}
          >
            <Plus size={16} />
            <span>Add test</span>
          </button>
        )}
      </div>
      <div className="subject-grid">
        {subjects.map((s) => {
          const records = approved
            .filter((t) => t.subject_code === s.code)
            .sort((a, b) => a.test_number - b.test_number);
          const latest = records.at(-1);
          const previous = records.at(-2);
          const trend =
            latest && previous ? percent(latest) - percent(previous) : null;
          return (
            <button
              key={s.code}
              className={
                "subject-card " + (selected === s.code ? "selected" : "")
              }
              onClick={() => setSelected(s.code)}
              aria-pressed={selected === s.code}
            >
              <span className="subject-code">{s.code}</span>
              <span className="subject-name">{s.name}</span>
              <strong>{latest ? percent(latest).toFixed(1) + "%" : "—"}</strong>
              <span className="tiny muted">
                {records.length} approved{" "}
                {records.length === 1 ? "test" : "tests"}
              </span>
              {trend !== null && (
                <span className="trend">
                  <TrendingUp size={12} />
                  {trend >= 0 ? "+" : ""}
                  {trend.toFixed(1)} pts
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="chart-header">
        <h3>A little better, every time</h3>
        <span className="tiny muted">{selected} · approved marks</span>
      </div>
      <div
        className="subject-tabs"
        aria-label={NAMES[student] + " graph subject"}
      >
        {subjects.map((s) => (
          <button
            key={s.code}
            aria-pressed={selected === s.code}
            onClick={() => setSelected(s.code)}
          >
            {s.code}
          </button>
        ))}
      </div>
      {graph.length ? (
        <>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={graph}
                margin={{ top: 15, right: 15, bottom: 5, left: -20 }}
              >
                <CartesianGrid vertical={false} stroke="#eeefeb" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Normalized mark"]}
                />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  stroke={student === "melan" ? "#52866e" : "#8b73ad"}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "white", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="chart-data">
            <summary>Read chart values</summary>
            <ul>
              {graph.map((t) => (
                <li key={t.label}>
                  {t.label} · {t.marks} · {t.percentage}%
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <Empty>
          No approved {selected} tests yet. Your first result will start the
          story.
        </Empty>
      )}
      <div className="test-history">
        <h3>Test journal</h3>
        {!tests.length && <p className="tiny muted">No tests submitted yet.</p>}
        {tests
          .slice()
          .sort((a, b) => b.test_number - a.test_number)
          .map((t) => (
            <details key={t.id} className="history-row">
              <summary>
                <span>
                  {t.subject_code}{" "}
                  <strong>Test {String(t.test_number).padStart(2, "0")}</strong>
                </span>
                <span className={"badge " + t.status}>
                  {t.status === "pending" ? "Pending approval" : t.status}
                </span>
                <span>
                  {t.obtained}/{t.maximum}
                </span>
              </summary>
              <div className="history-details">
                <p>
                  {formatDate(t.taken_on)} · {percent(t).toFixed(1)}%
                </p>
                {t.note && <p>{t.note}</p>}
                {t.rejection_reason && (
                  <p className="error">Please correct: {t.rejection_reason}</p>
                )}
                {canEdit(profile, t.owner_id) && (
                  <Evidence testId={t.id} demo={demo} />
                )}{" "}
                {profile.id === t.owner_id && t.status !== "approved" && (
                  <button
                    className="secondary-button"
                    onClick={() => setForm(t)}
                  >
                    Edit & resubmit
                  </button>
                )}
              </div>
            </details>
          ))}
      </div>
      {form && (
        <TestForm
          key={form === true ? "new" : form.id}
          data={data}
          profile={profile}
          record={form === true ? undefined : form}
          close={() => setForm(false)}
          refresh={refresh}
          demo={demo}
        />
      )}
    </section>
  );
}
function Planner({
  student,
  data,
  profile,
  mutate,
}: {
  student: Student;
  data: Data;
  profile: Profile;
  mutate: Mutate;
}) {
  const owner = data.profiles.find((p) => p.role === student);
  const tomorrow = addDays(studyDate(), 1);
  const [date, setDate] = useState(tomorrow);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retryId = useRef(crypto.randomUUID());
  if (!owner) return null;
  const editable = canEdit(profile, owner.id);
  const tasks = data.tasks.filter(
    (t) =>
      t.owner_id === owner.id && t.original_due === date && !t.cancelled_at,
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await mutate("save_task", {
        task_id: editing ?? retryId.current,
        student_id: owner.id,
        task_title: title,
        due_date: date,
      });
      setTitle("");
      setEditing(null);
      retryId.current = crypto.randomUUID();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan was not saved");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={"planner " + student}>
      <div className="between">
        <h3>{NAMES[student]}’s next steps</h3>
        <CalendarDays size={18} />
      </div>
      <label>
        Plan for
        <input
          type="date"
          min={tomorrow}
          max={addDays(studyDate(), 730)}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setEditing(null);
            setTitle("");
          }}
          required
        />
      </label>
      <p className="tiny muted">
        {date === tomorrow ? "Tomorrow" : formatDate(date)} · {tasks.length}{" "}
        planned
      </p>
      <ul className="plan-list">
        {tasks.map((t) => (
          <li key={t.id}>
            <span>{t.title}</span>
            {editable && (
              <div className="button-row">
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(t.id);
                    setTitle(t.title);
                  }}
                >
                  Edit
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={"Delete future task " + t.title}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await mutate("cancel_task", { task_id: t.id });
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Delete failed",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!tasks.length && (
        <p className="tiny muted">A little intention for a new day.</p>
      )}
      {editable && (
        <form onSubmit={submit}>
          <label>
            {editing ? "Edit future task" : "Add a future task"}
            <input
              required
              maxLength={240}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Revise one chapter of mechanics"
            />
          </label>
          <div className="button-row">
            <button className="secondary-button" disabled={busy}>
              <Plus size={16} />
              {busy ? "Saving…" : editing ? "Save changes" : "Add to plan"}
            </button>
            {editing && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditing(null);
                  setTitle("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
export default function Academic({
  data,
  profile,
  mutate,
  refresh,
  demo,
}: {
  data: Data;
  profile: Profile;
  mutate: Mutate;
  refresh: () => Promise<void>;
  demo: boolean;
}) {
  const pending = data.tests.filter((t) => t.status === "pending");
  return (
    <>
      <PageHeading
        eyebrow="LEARN. REFLECT. GROW."
        title="Every effort adds up."
        description="Your papers, your progress, and a little perspective on how far you’ve come."
      />
      <div className="student-grid academic-grid">
        {STUDENTS.map((s) => (
          <AcademicStudent
            key={s}
            student={s}
            data={data}
            profile={profile}
            refresh={refresh}
            demo={demo}
          />
        ))}
      </div>
      {profile.role === "host" && (
        <section className="card review-queue">
          <div className="section-heading">
            <h2>Host review desk</h2>
            <span className="pill">{pending.length} pending</span>
          </div>
          {pending.length ? (
            pending.map((t) => (
              <ReviewItem
                key={t.id}
                test={t}
                data={data}
                mutate={mutate}
                demo={demo}
              />
            ))
          ) : (
            <Empty>All caught up. New submissions will appear here.</Empty>
          )}
        </section>
      )}
      <section className="card planning-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A LITTLE INTENTION</div>
            <h2>Make space for tomorrow.</h2>
            <p className="muted tiny">
              Future plans become today’s focus, right on time.
            </p>
          </div>
          <CalendarDays size={25} />
        </div>
        <div className="student-grid">
          {STUDENTS.map((s) => (
            <Planner
              key={s}
              student={s}
              data={data}
              profile={profile}
              mutate={mutate}
            />
          ))}
        </div>
      </section>
      <a className="journey-cta" href="#/journey">
        <span>
          <span className="eyebrow">YOU’RE BUILDING SOMETHING TOGETHER</span>
          <strong>See where your journey is taking you.</strong>
        </span>
        <ArrowRight size={24} />
      </a>
    </>
  );
}
