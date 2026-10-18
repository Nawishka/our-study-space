// Runs before styles/React so a remembered night theme never flashes daylight.
(() => {
  let preference = "system";
  try {
    const saved = localStorage.getItem("study-theme-v1");
    if (["light", "dark", "system"].includes(saved)) preference = saved;
  } catch {
    /* Private browsing may block device storage. */
  }
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePreference = preference;
  root.style.colorScheme = root.dataset.theme;
  root.style.backgroundColor = dark ? "#121a1b" : "#eae7dc";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", root.style.backgroundColor);
})();
