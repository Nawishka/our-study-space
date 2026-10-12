import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Daily } from "../src/ui";
import { demoData } from "../src/demo";
it("keeps both panels readable but only exposes owned completion controls", () => {
  const data = demoData();
  const toggle = vi.fn().mockResolvedValue(undefined);
  render(
    <Daily
      data={data}
      profile={data.profiles[0]}
      busy={false}
      onToggle={toggle}
    />,
  );
  expect(
    screen.getByText("Physics past paper · 5 questions"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: "Mark as done: Physics past paper · 5 questions",
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Mark as done: Practice logic gates & truth tables",
    }),
  );
  expect(toggle).toHaveBeenCalledWith("task-1", true);
  expect(screen.getByText("50%")).toBeInTheDocument();
});
it("collapses without losing the independent progress summary", () => {
  const data = demoData();
  render(
    <Daily
      data={data}
      profile={data.profiles[0]}
      busy={false}
      onToggle={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Minimize Shashi tasks" }),
  );
  expect(
    screen.queryByText("Physics past paper · 5 questions"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("progressbar", { name: "Shashi daily progress" }),
  ).toHaveAttribute("aria-valuenow", "25");
  fireEvent.click(screen.getByRole("button", { name: "Expand Shashi tasks" }));
  expect(
    screen.getByText("Physics past paper · 5 questions"),
  ).toBeInTheDocument();
});
