import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"] as const) {
  test(`${theme} studio covers every page and role with accessible contrast`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("./?demo=1#/daily");
    await page
      .getByRole("radio", {
        name: theme === "dark" ? "Dark" : "Light",
        exact: true,
      })
      .check();
    for (const role of ["melan", "shashi", "host"]) {
      await page.getByLabel("Demo role").selectOption(role);
      for (const route of ["daily", "academic", "journey"]) {
        await page.evaluate((r) => {
          location.hash = "/" + r;
        }, route);
        await expect(page.locator("h1")).toHaveText(
          route === "daily"
            ? "Your goal needs action today."
            : route === "academic"
              ? "Practice with purpose."
              : "Build the future. Together.",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (route === "journey")
          await expect(
            page.getByText("Host · Add challenge points", { exact: true }),
          ).toHaveCount(role === "host" ? 1 : 0);
        if (route === "academic")
          await expect(
            page.getByText("Host review desk", { exact: true }),
          ).toHaveCount(role === "host" ? 1 : 0);
        const panel = page.locator(".notification-panel");
        if (!(await panel.getAttribute("open").then((x) => x !== null)))
          await panel.locator("summary").click();
        await expect(panel.getByRole("listitem")).toHaveCount(
          role === "host" ? 4 : 2,
        );
        const box = await panel.boundingBox();
        const bell = await panel.locator("summary > svg").boundingBox();
        expect(bell!.x - box!.x).toBeGreaterThanOrEqual(18);
        const badge = await panel.locator("summary .pill").boundingBox();
        expect(badge!.x + badge!.width).toBeLessThan(box!.x + box!.width - 12);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ).toEqual([]);
        await panel.locator("summary").click();
      }
    }
    await page.screenshot({
      path: `test-results/studio-${theme}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page
      .locator(".journey-scene")
      .screenshot({
        path: `test-results/companions-${theme}-${test.info().project.name}.png`,
      });
    // Expanded Host forms, chart tooltips and warnings use the same theme tokens.
    await page
      .getByText("Host · Add challenge points", { exact: true })
      .click();
    await page.getByLabel("Reason for these points").fill("Visual review only");
    await page.getByRole("button", { name: "Add points", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Demo only");
    await page
      .getByText("Host settings & challenge controls", { exact: true })
      .click();
    await page.getByRole("button", { name: "Preview new calculation" }).click();
    await expect(
      page.getByRole("region", { name: "Proposed scoring preview" }),
    ).toBeVisible();
    await page.evaluate(() => {
      location.hash = "/academic";
    });
    await page.getByLabel("Demo role").selectOption("melan");
    await page
      .getByRole("button", { name: "Add test", exact: false })
      .first()
      .click();
    await expect(
      page.getByRole("region", { name: "Test submission" }),
    ).toBeVisible();
    const formScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      formScan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("theme persists, follows System, supports keyboard and leaves motion/sound independent", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("./?view=host#/daily");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const light = page.getByRole("radio", { name: "Light", exact: true });
  await light.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(light).toBeChecked();
  await page.getByRole("radio", { name: "System", exact: true }).check();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("./?demo=1#/daily");
  await expect(
    page.getByRole("button", { name: "Sounds off" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.getByRole("button", { name: "Animations on" }).click();
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Animations off" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sounds off" })).toBeVisible();
  const labels = await page
    .locator(".theme-option > span")
    .first()
    .boundingBox();
  expect(labels!.height).toBeGreaterThanOrEqual(44);
  expect(
    await page
      .locator(".check-button")
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
});
