import { expect, test } from "@playwright/test";
test("notification filters and Host point controls remain usable on every screen", async ({
  page,
}) => {
  await page.goto("./?demo=1#/journey");
  await page.locator(".notification-panel > summary").click();
  const notices = page.getByRole("list", { name: "Study notifications" });
  await expect(notices.getByRole("listitem")).toHaveCount(2);
  await expect(notices.locator(".notification-warning")).toHaveCount(2);
  await page.getByLabel("Demo role").selectOption("host");
  await page.locator(".notification-panel > summary").click();
  await expect(notices.getByRole("listitem")).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Student", exact: true })
    .selectOption("shashi");
  await page
    .getByRole("combobox", { name: "Show", exact: true })
    .selectOption("warning");
  await expect(notices.getByRole("listitem")).toHaveCount(1);
  await page.getByText("Host · Add challenge points", { exact: true }).click();
  await page
    .getByLabel("Reason for these points")
    .fill("Extra timed paper practice");
  await page.getByRole("button", { name: "Add points", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Demo only");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-notifications.png`,
    fullPage: true,
  });
});
test("revised scoring preview, independent preferences and reduced motion fit the screen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?demo=1#/journey");
  await expect(
    page.getByRole("button", { name: "Sounds off" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await expect(page.getByText("Challenge score", { exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByText("Approved test practice", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByText("Approved test performance", { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByText("Your next step", { exact: true })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Animations on" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Animations off" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Sounds off" })).toBeVisible();
  await page.getByLabel("Demo role").selectOption("host");
  await page
    .getByText("Host settings & challenge controls", { exact: true })
    .click();
  await page.getByRole("button", { name: "Preview new calculation" }).click();
  await expect(
    page.getByRole("region", { name: "Proposed scoring preview" }),
  ).toBeVisible();
  await page.getByLabel("Practice points", { exact: true }).fill("16");
  await expect(page.getByRole("alert")).toContainText("total 100");
  await expect(
    page.getByRole("button", { name: "Save settings", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-scoring-v2.png`,
    fullPage: true,
  });
});
test("three pages fit, navigation survives refresh, demo is explicit", async ({
  page,
}) => {
  await page.goto("./?demo=1#/daily");
  await expect(page.getByText("DEMO PREVIEW", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your goal needs action today." }),
  ).toBeVisible();
  for (const route of ["daily", "academic", "journey"]) {
    await page.goto("./?demo=1#/" + route);
    await page.reload();
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${test.info().project.name}-${route}.png`,
      fullPage: true,
    });
  }
  await page.screenshot({
    path: `test-results/${test.info().project.name}-journey.png`,
    fullPage: true,
  });
});
test("task completion and undo update just the owner progress", async ({
  page,
}) => {
  await page.goto("./?demo=1#/daily");
  const melan = page.getByRole("progressbar", { name: "Melan daily progress" });
  await expect(melan).toHaveAttribute("aria-valuenow", "50");
  await page
    .getByRole("button", {
      name: "Mark as done: Practice logic gates & truth tables",
    })
    .click();
  await expect(melan).toHaveAttribute("aria-valuenow", "75");
  await page
    .getByRole("button", {
      name: "Undo Practice logic gates & truth tables",
      exact: true,
    })
    .click();
  await expect(melan).toHaveAttribute("aria-valuenow", "50");
  await expect(
    page.getByRole("progressbar", { name: "Shashi daily progress" }),
  ).toHaveAttribute("aria-valuenow", "25");
});
test("pending results excluded and host view hint does not authenticate", async ({
  page,
}) => {
  await page.goto("./?view=host#/daily");
  await expect(
    page.getByRole("heading", { name: "Your space to grow." }),
  ).toBeVisible();
  await expect(page.getByText("Host review desk")).toHaveCount(0);
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await expect(page.getByLabel(/Email address|verification code/i)).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.goto("./?demo=1#/academic");
  await page
    .getByRole("button", { name: "Add test", exact: false })
    .first()
    .click();
  await expect(page.getByText("Attach your marked paper")).toBeVisible();
  await page.getByLabel("Marks obtained").fill("80");
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByRole("alert")).toContainText("Demo only");
});
