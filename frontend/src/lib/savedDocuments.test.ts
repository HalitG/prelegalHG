import { afterEach, describe, expect, it, vi } from "vitest";
import { GREETING } from "./chat";
import { emptyState, type DocState } from "./documents/types";
import {
  deleteDocument,
  listDocuments,
  loadDocument,
  newDocumentId,
  saveDocument,
  SavedDocumentsError,
} from "./savedDocuments";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ID = "0123456789abcdef0123456789abcdef";
const state: DocState = { ...emptyState, document: "mutual-nda", values: { purpose: "A deal" } };

describe("newDocumentId", () => {
  it("makes 32 random hex characters", () => {
    const ids = new Set(Array.from({ length: 50 }, newDocumentId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("the saved agreements API", () => {
  it("saves the agreement and its conversation with a PUT", async () => {
    fetchMock.mockResolvedValue(json({ id: ID, updatedAt: "2026-10-16T10:00:00.000Z" }));
    await saveDocument(ID, state, [GREETING], 3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/documents/${ID}`);
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ ...state, messages: [GREETING], revision: 3 });
  });

  it("lists, loads and deletes", async () => {
    fetchMock.mockResolvedValueOnce(json([{ id: ID }]));
    await expect(listDocuments()).resolves.toEqual([{ id: ID }]);
    fetchMock.mockResolvedValueOnce(json({ id: ID, ...state, messages: [GREETING] }));
    await expect(loadDocument(ID)).resolves.toMatchObject({ id: ID, document: "mutual-nda" });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await deleteDocument(ID);
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/documents", undefined],
      [`/api/documents/${ID}`, undefined],
      [`/api/documents/${ID}`, "DELETE"],
    ]);
  });

  it("explains a response it can't read", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(listDocuments()).rejects.toMatchObject({ message: "Something went wrong. Please try again." });
  });

  it.each([
    [async () => json({ detail: "Agreement not found." }, 404), 404, "We couldn't find that agreement."],
    [async () => json({}, 500), 500, "Something went wrong. Please try again."],
    [() => Promise.reject(new TypeError("Failed to fetch")), 0, "Couldn't reach the server. Check your connection and try again."],
  ])("explains a failure", async (response, status, message) => {
    fetchMock.mockImplementation(response);
    const error = await loadDocument(ID).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SavedDocumentsError);
    expect(error).toMatchObject({ status, message });
  });
});
