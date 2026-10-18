import { useEffect, useId, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  readTheme,
  THEME_KEY,
  type ThemePreference,
} from "./theme";

export default function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>(readTheme);
  const name = useId();
  useEffect(() => {
    const system = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => applyTheme(preference, system?.matches ?? false);
    update();
    system?.addEventListener("change", update);
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null)
        setPreference(readTheme());
    };
    window.addEventListener("storage", sync);
    return () => {
      system?.removeEventListener("change", update);
      window.removeEventListener("storage", sync);
    };
  }, [preference]);
  return (
    <fieldset className="theme-control">
      <legend className="sr-only">Appearance</legend>
      {(
        [
          { value: "light", label: "Light", Icon: Sun },
          { value: "dark", label: "Dark", Icon: Moon },
          { value: "system", label: "System", Icon: Monitor },
        ] as const
      ).map(({ value, label, Icon }) => (
        <label className="theme-option" key={value}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={preference === value}
            onChange={() => {
              setPreference(value);
              try {
                localStorage.setItem(THEME_KEY, value);
              } catch {
                /* Works for this visit. */
              }
            }}
          />
          <span>
            <Icon size={16} aria-hidden="true" />
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
