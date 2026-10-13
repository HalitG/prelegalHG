// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { signIn } from "@/lib/session";
import { AppHeader } from "./AppHeader";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("AppHeader", () => {
  it("shows who is signed in", () => {
    signIn("jo@acme.com");
    render(<AppHeader />);
    expect(screen.getByText("jo@acme.com")).toBeTruthy();
  });

  it("signs the visitor out", async () => {
    signIn("jo@acme.com");
    render(<AppHeader />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    expect(localStorage.getItem("prelegal.session")).toBeNull();
    expect(screen.queryByText("jo@acme.com")).toBeNull();
  });
});
