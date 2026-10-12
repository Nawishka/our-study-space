import { expect, test } from "@playwright/test";
test("three pages fit, navigation survives refresh, demo is explicit", async ({
  page,
}) => {
  await page.goto("./?demo=1#/daily");
  await expect(page.getByText("DEMO PREVIEW", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Make room for progress." }),
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
