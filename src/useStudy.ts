import { useCallback, useEffect, useRef, useState } from "react";
import { demoData } from "./demo";
import { loadData, rpc, supabase } from "./service";
import { studyDate, type Data, type Profile } from "./domain";
import { planReceipt, useFeedback } from "./Feedback";
export function useStudy(profile: Profile | null, demo: boolean) {
  const feedback = useFeedback();
  const [data, setData] = useState<Data | null>(demo ? demoData : null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const identity = useRef(profile?.id);
  identity.current = profile?.id;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    demo ? "Demo · changes stay in this tab" : "Connecting",
  );
  const loading = useRef(false);
  const queued = useRef(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (demo || !profile || identity.current !== profile.id) return;
    if (loading.current) {
      queued.current = true;
      return;
    }
    loading.current = true;
    try {
      const d = await loadData();
      if (mounted.current && identity.current === profile.id) {
        setData(d);
        setLoadedFor(profile.id);
        setError("");
      }
    } catch (e) {
      if (mounted.current && identity.current === profile.id)
        setError(
          e instanceof Error
            ? e.message
            : "Could not refresh your study space.",
        );
    } finally {
      loading.current = false;
      if (queued.current) {
        queued.current = false;
        void refresh();
      }
    }
  }, [demo, profile]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!profile || demo) return;
    void refresh();
    let debounce: ReturnType<typeof setTimeout>;
    const channel = supabase!
      .channel("study-updates")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => void refresh(), 180);
      })
      .subscribe((state) => {
        setStatus(
          state === "SUBSCRIBED"
            ? "Live updates connected"
            : "Reconnecting · periodic refresh active",
        );
        if (state === "SUBSCRIBED") void refresh();
      });
    const reconnect = () => {
      setStatus(
        navigator.onLine ? "Reconnecting" : "Offline · changes cannot be saved",
      );
      if (navigator.onLine) void refresh();
    };
    const timer = setInterval(() => void refresh(), 60000);
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    window.addEventListener("focus", reconnect);
    return () => {
      clearTimeout(debounce);
      clearInterval(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
      window.removeEventListener("focus", reconnect);
      void supabase!.removeChannel(channel);
    };
  }, [demo, profile, refresh]);
  const mutate = async (
    name: string,
    args: Record<string, unknown>,
    optimistic?: (d: Data) => Data,
  ) => {
    if (saving.current) throw new Error("Wait for the current save to finish.");
    if (!navigator.onLine && !demo) {
      const message = "You are offline. Reconnect and retry.";
      setError(message);
      setStatus("Not saved · offline");
      throw new Error(message);
    }
    saving.current = true;
    const previous = data;
    setBusy(true);
    setError("");
    setStatus(demo ? "Demo · changes stay in this tab" : "Saving…");
    if (optimistic && data) setData(optimistic(data));
    try {
      if (!demo) await rpc(name, args);
      else if (!optimistic)
        throw new Error(
          "This is a preview. Connect Supabase to save tests, plans and settings.",
        );
      setStatus(demo ? "Demo · changes stay in this tab" : "Saved");
      if (!demo && profile && identity.current === profile.id) {
        if (name === "complete_task" && args.done === true)
          feedback.confirm(
            `task:${profile.id}:${args.task_id}:${studyDate()}`,
            "task",
            "Task completed. A little step forward.",
          );
        if (name === "save_task") {
          // Feedback failure must never turn a confirmed save into a rollback.
          try {
            feedback.confirm(
              await planReceipt(profile.id, args),
              "plan",
              "Future plan saved.",
            );
          } catch {
            /* Saved status remains visible. */
          }
        }
      }
      await refresh();
    } catch (e) {
      if (optimistic) setData(previous);
      const msg = e instanceof Error ? e.message : "Save failed. Please retry.";
      setError(msg);
      setStatus("Not saved · please retry");
      throw e;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const toggle = (id: string, done: boolean) =>
    mutate("complete_task", { task_id: id, done }, (d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === id
          ? { ...t, completed_at: done ? new Date().toISOString() : null }
          : t,
      ),
      task_days: d.task_days.map((t) =>
        t.task_id === id && t.study_date === studyDate()
          ? { ...t, completed: done }
          : t,
      ),
    }));
  return {
    data: demo || loadedFor === profile?.id ? data : null,
    error,
    busy,
    status,
    refresh,
    mutate,
    toggle,
  };
}
