import { useRef, useState, type FormEvent } from "react";
import type { Data } from "./domain";
import type { Mutate } from "./Academic";

export default function HostPoints({
  data,
  mutate,
  demo,
}: {
  data: Data;
  mutate: Mutate;
  demo: boolean;
}) {
  const [student, setStudent] = useState(
    data.profiles.find((p) => p.role === "melan")?.id ?? "",
  );
  const [points, setPoints] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  // Keep the same receipt after uncertain network outcomes. Editing the form
  // deliberately creates a different adjustment; a retry reuses this receipt.
  const receipt = useRef<{ payload: string; id: string } | null>(null);
  const challenge = data.scores.challenge;
  const installed =
    demo || data.settings.postponed_penalty_points !== undefined;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending.current || !challenge) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const args = {
      student_id: student,
      challenge_id: challenge.id,
      points: Number(points),
      reason: reason.trim(),
    };
    const payload = JSON.stringify(args);
    if (!receipt.current) {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("study-pending-points") ?? "null",
        );
        if (saved && typeof saved.id === "string" && saved.payload === payload)
          receipt.current = saved;
      } catch {
        /* In-memory retry remains available if storage is blocked. */
      }
    }
    if (receipt.current?.payload !== payload)
      receipt.current = { payload, id: crypto.randomUUID() };
    try {
      sessionStorage.setItem(
        "study-pending-points",
        JSON.stringify(receipt.current),
      );
    } catch {
      /* Optional device storage. */
    }
    try {
      if (demo)
        throw new Error(
          "Demo only. Manual points require a connected Host account.",
        );
      await mutate("add_manual_points", {
        adjustment_id: receipt.current.id,
        ...args,
      });
      setMessage(
        "Points saved. The adjustment and reason are recorded in notifications.",
      );
      setReason("");
      receipt.current = null;
      try {
        sessionStorage.removeItem("study-pending-points");
      } catch {
        /* Confirmed by server. */
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not confirm the save. Retry with the same details.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="card host-settings">
      <summary>Host · Add challenge points</summary>
      <p className="notice">
        Add points to the active challenge with a clear reason. The final score
        stays between 0 and 100. Active days, on-time completion and subject
        coverage are still required. This cannot change an archived reward.
      </p>
      {!installed && (
        <p className="error">
          Apply 202610170005_notifications_and_points.sql to enable this tool.
        </p>
      )}
      {!challenge ? (
        <p>Activate a challenge first.</p>
      ) : (
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Student receiving points
              <select
                value={student}
                disabled={busy}
                onChange={(e) => setStudent(e.target.value)}
              >
                {data.profiles
                  .filter((p) => p.role !== "host")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Points to add
              <input
                type="number"
                required
                min="0.1"
                max="100"
                step="0.1"
                value={points}
                disabled={busy}
                onChange={(e) => setPoints(e.target.value)}
              />
            </label>
          </div>
          <label>
            Reason for these points
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the extra effort or correction being recognised."
            />
          </label>
          <p className="tiny muted">
            The student and Host can read this reason. If a save is interrupted,
            retry the same details to avoid adding points twice.
          </p>
          <button className="primary-button" disabled={busy || !installed}>
            {busy ? "Saving…" : "Add points"}
          </button>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      )}
    </details>
  );
}
