// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GREETING } from "@/lib/chat";
import { loadDocuments } from "@/lib/documents/registry";
import { emptyParty } from "@/lib/documents/types";
import { CreateAgreement } from "./CreateAgreement";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ replace: navigation.replace }),
}));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const documents = loadDocuments();
const ID = "d".repeat(32);
const saved = {
  id: ID,
  document: "mutual-nda",
  values: { purpose: "Exploring a merger" },
  parties: [{ ...emptyParty, company: "Initech" }, emptyParty],
  messages: [GREETING, { role: "user", content: "An NDA with Initech" }],
  revision: 2,
  updatedAt: "2026-10-16T10:00:00.000Z",
};

beforeEach(() => {
  navigation.search = "";
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === `/api/documents/${ID}`) return json(saved);
    if (url.startsWith("/documents/")) return json({ intro: null, terms: [] });
    return json({ detail: "Agreement not found." }, 404);
  });
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  navigation.replace.mockClear();
});

describe("CreateAgreement", () => {
  it("starts a new agreement without loading anything", () => {
    render(<CreateAgreement documents={documents} />);
    expect(screen.getByRole("log", { name: "Conversation" }).textContent).toContain("what kind of agreement");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the saved agreement in ?doc=, with its conversation", async () => {
    navigation.search = `doc=${ID}`;
    render(<CreateAgreement documents={documents} />);
    expect(screen.getByRole("status").textContent).toBe("Opening your agreement…");

    const log = await screen.findByRole("log", { name: "Conversation" });
    expect(within(log).getByText("An NDA with Initech")).toBeTruthy();
    const preview = screen.getByRole("article", { name: "Mutual Non-Disclosure Agreement preview" });
    expect(preview.textContent).toContain("Exploring a merger");
    expect(preview.textContent).toContain("Initech");
  });

  it("goes back to a new agreement when the user starts over", async () => {
    navigation.search = `doc=${ID}`;
    render(<CreateAgreement documents={documents} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Start over" }));
    expect(navigation.replace).toHaveBeenCalledWith("/");
  });

  it("says when the agreement can't be found", async () => {
    navigation.search = `doc=${"e".repeat(32)}`;
    render(<CreateAgreement documents={documents} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We couldn't find that agreement");
    expect(within(alert).getByRole("link", { name: "My documents" }).getAttribute("href")).toBe("/documents/");
    expect(within(alert).queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers to try again when the agreement doesn't load", async () => {
    navigation.search = `doc=${ID}`;
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<CreateAgreement documents={documents} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the server");
    await userEvent.setup().click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("log", { name: "Conversation" })).toBeTruthy();
  });
});
