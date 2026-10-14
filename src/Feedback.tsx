import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { GentleAudio, type FeedbackKind } from "./sound";

const PREFS = "study-feedback-preferences-v1";
const SEEN = "study-confirmed-feedback-v1";
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Device storage may be disabled. */
  }
}
function receipts(): string[] {
  const stored = read<unknown>(SEEN, []);
  return Array.isArray(stored)
    ? stored.filter((value): value is string => typeof value === "string")
    : [];
}
interface Feedback {
  sounds: boolean;
  animations: boolean;
  reduced: boolean;
  setSounds: (value: boolean) => void;
  setAnimations: (value: boolean) => void;
  confirm: (key: string, kind: FeedbackKind, message: string) => boolean;
}
const Context = createContext<Feedback>({
  sounds: false,
  animations: true,
  reduced: false,
  setSounds: () => {},
  setAnimations: () => {},
  confirm: () => false,
});
export const useFeedback = () => useContext(Context);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(() => {
    const stored = read<{ sounds?: boolean; animations?: boolean }>(PREFS, {});
    return {
      sounds: stored.sounds === true,
      animations: stored.animations !== false,
    };
  });
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const audio = useRef(new GentleAudio());
  const seen = useRef(new Set(receipts()));
  const [notice, setNotice] = useState<{
    key: string;
    kind: FeedbackKind;
    message: string;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query?.matches ?? false);
    query?.addEventListener("change", change);
    return () => query?.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion =
      !prefs.animations || reduced ? "off" : "on";
    write(PREFS, prefs);
  }, [prefs, reduced]);
  useEffect(() => {
    // A remembered preference never starts/resumes audio until a fresh gesture.
    const gesture = () => {
      if (prefsRef.current.sounds) audio.current.unlock();
    };
    window.addEventListener("pointerdown", gesture);
    window.addEventListener("keydown", gesture);
    const engine = audio.current;
    return () => {
      window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("keydown", gesture);
      clearTimeout(timer.current);
      engine.dispose();
    };
  }, []);
  const confirm = useCallback(
    (key: string, kind: FeedbackKind, message: string) => {
      // Persist receipt identities, never credentials or user-entered content.
      for (const id of receipts()) seen.current.add(id);
      if (seen.current.has(key)) return false;
      seen.current.add(key);
      write(SEEN, [...seen.current]);
      if (prefsRef.current.sounds) {
        try {
          audio.current.play(kind);
        } catch {
          /* A browser audio failure must not affect a saved operation. */
        }
      }
      setNotice({ key, kind, message });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(null), 5000);
      return true;
    },
    [],
  );
  return (
    <Context.Provider
      value={{
        ...prefs,
        reduced,
        confirm,
        setSounds: (sounds) => {
          prefsRef.current = { ...prefsRef.current, sounds };
          setPrefs(prefsRef.current);
          if (sounds) audio.current.unlock();
          else audio.current.stop();
        },
        setAnimations: (animations) =>
          setPrefs((value) => ({ ...value, animations })),
      }}
    >
      {children}
      <div
        className="feedback-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice && (
          <div key={notice.key} className={"save-confirmation " + notice.kind}>
            <span className="confirmation-symbol">
              {notice.kind === "submission" || notice.kind === "reward" ? (
                <Sparkles aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
            </span>
            <span>{notice.message}</span>
            <button
              className="icon-button"
              aria-label="Dismiss confirmation"
              onClick={() => setNotice(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}

export function FeedbackControls() {
  const f = useFeedback();
  return (
    <div className="feedback-controls" aria-label="Feedback preferences">
      <button
        className="text-button"
        aria-pressed={f.sounds}
        onClick={() => f.setSounds(!f.sounds)}
      >
        {f.sounds ? <Volume2 size={16} /> : <VolumeX size={16} />} Sounds{" "}
        {f.sounds ? "on" : "off"}
      </button>
      <button
        className="text-button"
        aria-pressed={f.animations}
        onClick={() => f.setAnimations(!f.animations)}
      >
        Animations {f.animations ? "on" : "off"}
      </button>
      {f.reduced && (
        <span className="tiny muted">Device reduced motion is active</span>
      )}
    </div>
  );
}

// Stable content digest makes identical plan retries share a receipt while
// keeping task titles out of device receipt storage.
export async function planReceipt(
  actor: string,
  args: Record<string, unknown>,
) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([args.task_title, args.due_date]),
  );
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `plan:${actor}:${args.task_id}:${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
