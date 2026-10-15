// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocumentSummary } from "@/lib/savedDocuments";
import { DocumentList } from "./DocumentList";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

const NDA: DocumentSummary = {
  id: "a".repeat(32),
  document: "mutual-nda",
  documentName: "Mutual Non-Disclosure Agreement",
  companies: ["Acme, Inc.", "Globex Corporation"],
  missing: 0,
  updatedAt: "2026-10-16T10:00:00.000Z",
};
const CSA: DocumentSummary = {
  id: "b".repeat(32),
  document: "csa",
  documentName: "Cloud Service Agreement",
  companies: ["", ""],
  missing: 12,
  updatedAt: "2026-10-15T09:00:00.000Z",
};

const rows = () => within(screen.getByRole("list", { name: "Your agreements" })).getAllByRole("listitem");

describe("DocumentList", () => {
  it("lists each agreement with its parties, progress and last change", async () => {
    fetchMock.mockResolvedValue(json([NDA, CSA]));
    render(<DocumentList />);
    expect(screen.getByRole("status").textContent).toBe("Loading your agreements");

    await screen.findByRole("list", { name: "Your agreements" });
    const [nda, csa] = rows();
    expect(within(nda).getByRole("heading").textContent).toBe("Mutual Non-Disclosure Agreement");
    expect(nda.textContent).toContain("Acme, Inc. and Globex Corporation");
    expect(nda.textContent).toContain("Ready to sign");
    expect(nda.textContent).toContain("Updated");
    expect(csa.textContent).toContain("Parties not added yet");
    expect(csa.textContent).toContain("12 fields left");
    const open = within(nda).getByRole("link", { name: /^Open the Mutual Non-Disclosure Agreement/ });
    expect(open.getAttribute("href")).toBe(`/?doc=${NDA.id}`);
  });

  it("invites the user to create their first agreement", async () => {
    fetchMock.mockResolvedValue(json([]));
    render(<DocumentList />);
    expect(await screen.findByText("No agreements yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create your first agreement" }).getAttribute("href")).toBe("/");
  });

  it("deletes an agreement once the user confirms", async () => {
    fetchMock.mockResolvedValueOnce(json([NDA, CSA]));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<DocumentList />);
    const user = userEvent.setup();
    await screen.findByRole("list", { name: "Your agreements" });

    const deleteCsa = () => within(rows()[1]).getByRole("button", { name: /^Delete the Cloud Service Agreement/ });
    await user.click(deleteCsa());
    // The keyboard focus moves to the new buttons, and back when the user cancels.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(deleteCsa());
    expect(rows()).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(deleteCsa());
    expect(within(rows()[1]).getByText("Delete it?")).toBeTruthy();
    await user.click(within(rows()[1]).getByRole("button", { name: /^Yes, delete the Cloud Service Agreement/ }));
    expect(rows()).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/documents/${CSA.id}`, { method: "DELETE" });
    expect(document.activeElement).toBe(within(rows()[0]).getByRole("link", { name: /^Open/ }));
  });

  it("puts an agreement back if it couldn't be deleted", async () => {
    fetchMock.mockResolvedValueOnce(json([NDA]));
    fetchMock.mockResolvedValueOnce(json({}, 500));
    render(<DocumentList />);
    const user = userEvent.setup();
    await screen.findByRole("list", { name: "Your agreements" });
    await user.click(screen.getByRole("button", { name: /^Delete/ }));
    await user.click(screen.getByRole("button", { name: /^Yes, delete/ }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Couldn't delete the Mutual Non-Disclosure Agreement");
    expect(rows()).toHaveLength(1);
  });

  it("puts back only the agreement whose delete failed", async () => {
    let failFirst!: () => void;
    fetchMock.mockResolvedValueOnce(json([NDA, CSA]));
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (failFirst = () => resolve(json({}, 500)))));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<DocumentList />);
    const user = userEvent.setup();
    await screen.findByRole("list", { name: "Your agreements" });
    await user.click(screen.getByRole("button", { name: /^Delete the Mutual/ }));
    await user.click(screen.getByRole("button", { name: /^Yes, delete the Mutual/ }));
    await user.click(screen.getByRole("button", { name: /^Delete the Cloud/ }));
    await user.click(screen.getByRole("button", { name: /^Yes, delete the Cloud/ }));
    await act(async () => failFirst());
    expect(rows().map((row) => within(row).getByRole("heading").textContent)).toEqual([
      "Mutual Non-Disclosure Agreement",
    ]);
  });

  it("moves the focus to creating an agreement after deleting the last one", async () => {
    fetchMock.mockResolvedValueOnce(json([NDA]));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<DocumentList />);
    const user = userEvent.setup();
    await screen.findByRole("list", { name: "Your agreements" });
    await user.click(screen.getByRole("button", { name: /^Delete/ }));
    await user.click(screen.getByRole("button", { name: /^Yes, delete/ }));
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Create your first agreement" }));
  });

  it("offers to retry when the list doesn't load", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    fetchMock.mockResolvedValueOnce(json([NDA]));
    render(<DocumentList />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn’t load your agreements");
    await userEvent.setup().click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("list", { name: "Your agreements" })).toBeTruthy();
  });
});
