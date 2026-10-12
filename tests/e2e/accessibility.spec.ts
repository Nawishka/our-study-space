import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test("three pages meet automated WCAG AA checks", async ({ page }) => {
  await page.goto("./?view=host#/daily");
  await expect(page.getByLabel("Username")).toBeVisible();
  const login = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    login.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  for (const route of ["daily", "academic", "journey"]) {
    await page.goto("./?demo=1#/" + route);
    await expect(page.locator("h1")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        null,
        2,
      ),
    ).toEqual([]);
  }
});
