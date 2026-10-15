// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSessionForTests } from "@/lib/session";
import { AppHeader } from "./AppHeader";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const autosave = vi.hoisted(() => ({ savePendingChanges: vi.fn(async () => {}) }));
vi.mock("@/lib/useAutosave", () => autosave);

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  navigation.pathname = "/";
  setSessionForTests({ status: "signed-in", session: { id: 1, name: "Jo Smith", email: "jo@acme.com" } });
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

const nav = () => within(screen.getByRole("navigation", { name: "Main" }));

describe("AppHeader", () => {
  it("shows who is signed in", () => {
    render(<AppHeader />);
    const name = screen.getByText("Jo Smith");
    expect(name.getAttribute("title")).toBe("jo@acme.com");
  });

  it("links to a new agreement and to the user's documents", () => {
    render(<AppHeader />);
    expect(nav().getByRole("link", { name: "New agreement" }).getAttribute("href")).toBe("/");
    expect(nav().getByRole("link", { name: "My documents" }).getAttribute("href")).toBe("/documents/");
    expect(screen.getByRole("link", { name: "Prelegal home" }).getAttribute("href")).toBe("/");
  });

  it.each([
    ["/", "New agreement"],
    ["/documents/", "My documents"],
    ["/documents", "My documents"],
  ])("marks the page the user is on (%s)", (pathname, current) => {
    navigation.pathname = pathname;
    render(<AppHeader />);
    const links = nav().getAllByRole("link");
    expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toEqual([
      nav().getByRole("link", { name: current }),
    ]);
  });

  it("saves the last changes, then signs the user out", async () => {
    fetchMock.mockImplementation(async () => {
      expect(autosave.savePendingChanges).toHaveBeenCalled();
      return new Response(null, { status: 204 });
    });
    render(<AppHeader />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signout", { method: "POST" });
    expect(screen.queryByText("Jo Smith")).toBeNull();
  });
});
