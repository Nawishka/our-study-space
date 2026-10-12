import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("../src/authentication", () => ({ signInUsername: mocks.signIn }));
vi.mock("../src/service", () => ({ configured: true }));
import Auth from "../src/Auth";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockResolvedValue(undefined);
});
it("offers username/password with password-manager support and no email/code flow", () => {
  render(<Auth />);
  expect(screen.getByLabelText("Username")).toHaveAttribute(
    "autocomplete",
    "username",
  );
  expect(screen.getByLabelText("Password")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  expect(
    screen.queryByLabelText(/email|verification code/i),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Ask the space owner to reset/)).toBeInTheDocument();
});
it("submits credentials, clears the password on success and supports show/hide", async () => {
  render(<Auth />);
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "melan" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "User-chosen-secret9!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() =>
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith(
      "melan",
      "User-chosen-secret9!",
    ),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Password")).toHaveValue(""),
  );
});
it("shows rejected credentials and leaves the user on the login screen", async () => {
  mocks.signIn.mockRejectedValue(new Error("Incorrect username or password."));
  render(<Auth />);
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "host" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Incorrect username or password.",
  );
  expect(
    screen.getByRole("heading", { name: "Your space to grow." }),
  ).toBeInTheDocument();
});
