import { useRef, useState } from "react";
import { Bell, Check, TriangleAlert } from "lucide-react";
import { NAMES, ZONE, type Data, type Profile } from "./domain";
import type { Mutate } from "./Academic";

export default function Notifications({
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
  const [owner, setOwner] = useState("all");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [demoReads, setDemoReads] = useState<string[]>([]);
  const receipts = new Set(
    (data.notification_reads ?? [])
      .filter((r) => r.reader_id === profile.id)
      .map((r) => r.notification_id),
  );
  if (demo) demoReads.forEach((id) => receipts.add(id));
  // The database enforces this too. This extra filter keeps demo roles isolated.
  const visible = (data.notifications ?? []).filter(
    (n) => profile.role === "host" || n.owner_id === profile.id,
  );
  const unread = visible.filter((n) => !receipts.has(n.id)).length;
  const items = visible
    .filter(
      (n) =>
        (profile.role !== "host" || owner === "all" || n.owner_id === owner) &&
        (filter === "all" ||
          (filter === "unread" && !receipts.has(n.id)) ||
          (filter === "warning" && n.severity === "warning") ||
          (filter === "tasks" && n.kind === "task_postponed") ||
          (filter === "tests" && n.kind.startsWith("test_")) ||
          (filter === "scores" &&
            (n.kind.startsWith("score_") || n.kind === "manual_points"))),
    )
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  async function read(id: string) {
    if (saving.current) return;
    saving.current = true;
    setBusy(id);
    setError("");
    try {
      if (demo) setDemoReads((r) => [...r, id]);
      else await mutate("mark_notification_read", { notice_id: id });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not mark this notice as read. Please retry.",
      );
    } finally {
      saving.current = false;
      setBusy("");
    }
  }
  return (
    <details className="card notification-panel">
      <summary>
        <Bell size={20} aria-hidden="true" /> Notifications{" "}
        <span className="pill">{unread} unread</span>
      </summary>
      <p className="tiny muted">
        {profile.role === "host"
          ? "All student updates, with your own read status."
          : "Your score changes, test decisions and postponed tasks, in one place."}{" "}
        {demo && "Sample notices only."}
      </p>
      <div className="notification-filters">
        {profile.role === "host" && (
          <label>
            Student
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="all">Everyone</option>
              {data.profiles
                .filter((p) => p.role !== "host")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All notifications</option>
            <option value="unread">Unread</option>
            <option value="warning">Warnings</option>
            <option value="scores">Score changes</option>
            <option value="tests">Test decisions</option>
            <option value="tasks">Postponed tasks</option>
          </select>
        </label>
      </div>
      {(error || data.notification_error) && (
        <div className="error" role="alert">
          {error || data.notification_error}
          <button className="secondary-button" onClick={() => void refresh()}>
            Retry refresh
          </button>
        </div>
      )}
      {!items.length && !data.notification_error && (
        <p className="notice">
          No notifications match this view. New updates will appear here.
        </p>
      )}
      <ul className="notification-list" aria-label="Study notifications">
        {items.map((n) => (
          <li
            key={n.id}
            className={
              "notification-item " +
              (n.severity === "warning" ? "notification-warning" : "")
            }
          >
            <div className="notification-title">
              {n.severity === "warning" ? (
                <TriangleAlert size={18} aria-hidden="true" />
              ) : (
                <Check size={18} aria-hidden="true" />
              )}
              <strong>
                {n.severity === "warning" && (
                  <span className="sr-only">Warning: </span>
                )}
                {n.title}
              </strong>
              {!receipts.has(n.id) && <span className="tiny">Unread</span>}
            </div>
            <p>{n.message}</p>
            <div className="notification-meta">
              <span className="tiny">
                {profile.role === "host" &&
                  NAMES[
                    data.profiles.find((p) => p.id === n.owner_id)?.role ??
                      "host"
                  ] + " · "}
                <time dateTime={n.created_at}>
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: ZONE,
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(n.created_at))}
                </time>{" "}
                · Sri Lanka
              </span>
              {!receipts.has(n.id) && (
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => void read(n.id)}
                >
                  {busy === n.id ? "Saving…" : "Mark read"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
