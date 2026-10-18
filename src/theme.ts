export type ThemePreference = "light" | "dark" | "system";
export const THEME_KEY = "study-theme-v1";
export function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* Remembering preferences is optional. */
  }
  return "system";
}
export function applyTheme(preference: ThemePreference, systemDark: boolean) {
  const theme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  root.style.backgroundColor = theme === "dark" ? "#121a1b" : "#eae7dc";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", root.style.backgroundColor);
}
