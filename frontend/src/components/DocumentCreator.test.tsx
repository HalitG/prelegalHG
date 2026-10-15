// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GREETING, type ChatResult } from "@/lib/chat";
import { DISCLAIMER } from "@/lib/disclaimer";
import { documentText } from "@/lib/documents/build";
import { loadDocuments } from "@/lib/documents/registry";
import { emptyState, type DocState } from "@/lib/documents/types";
import { DocumentCreator } from "./DocumentCreator";

const documents = loadDocuments();
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The chat's answers, in order, each made when its request arrives. */
let chatAnswers: (() => Promise<Response>)[] = [];
// The page caches each agreement's text for the whole test run, so tests that need a fetch to fail or wait use
// agreements no other test loads.

/** Agreements whose text fails to load the next time it is fetched. */
let failingTexts = new Set<string>();
/** Agreements whose text only arrives once the test lets it, by calling the function. */
let heldTexts = new Map<string, Promise<void>>();

function holdText(id: string) {
  let release!: () => void;
  heldTexts.set(id, new Promise((r) => (release = r)));
  return () => act(async () => release());
}

beforeEach(() => {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const text = url.match(/^\/documents\/(.+)\.json$/);
    if (text) {
      if (failingTexts.delete(text[1])) return json({}, 500);
      await heldTexts.get(text[1]);
      return json(documentText(documents.find((document) => document.id === text[1])!));
    }
    // Saving, which happens a moment after each change once an agreement is chosen.
    if (url.startsWith("/api/documents/")) return json({ id: url.split("/").pop(), updatedAt: "2026-10-16T10:00:00Z" });
    const answer = chatAnswers.shift();
    if (!answer) throw new Error(`Unexpected request to ${url}`);
    return answer();
  });
});

afterEach(async () => {
  cleanup();
  // Unmounting saves what was waiting to be saved; let that finish within this test.
  await new Promise((resolve) => setTimeout(resolve, 0));
  fetchMock.mockReset();
  chatAnswers = [];
  failingTexts = new Set();
  heldTexts = new Map();
});

const parties: DocState["parties"] = [
  { company: "Acme, Inc.", name: "", title: "", noticeAddress: "" },
  { company: "Globex Corporation", name: "", title: "", noticeAddress: "" },
];

function answer(reply: string, state: Partial<DocState> = {}, nextQuestion = "") {
  const result: ChatResult = { reply, nextQuestion, ...emptyState, ...state };
  chatAnswers.push(async () => json(result));
}

/** A chat answer the test sends when it chooses. */
function deferredAnswer() {
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>((r) => (resolve = r));
  chatAnswers.push(() => response);
  return (reply: string, state: Partial<DocState> = {}) =>
    act(async () => resolve(json({ reply, nextQuestion: "", ...emptyState, ...state })));
}

const chatRequests = () => fetchMock.mock.calls.filter(([url]) => url === "/api/chat");
const saves = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).startsWith("/api/documents/"))
    .map(([url, init]) => ({ id: String(url).split("/").pop(), body: JSON.parse(init?.body as string) }));
/** Saving waits a moment after the last change. */
const waitForSave = (count = 1) => waitFor(() => expect(saves()).toHaveLength(count), { timeout: 3000 });
const requestBody = (call = 0) => JSON.parse(chatRequests()[call][1]?.body as string);
const conversation = () => within(screen.getByRole("log", { name: "Conversation" }));
const preview = (name = "Mutual Non-Disclosure Agreement") => screen.getByRole("article", { name: `${name} preview` });
const messageBox = () => screen.getByLabelText("Message") as HTMLTextAreaElement;

async function say(text: string) {
  const user = userEvent.setup();
  await user.type(messageBox(), text);
  await user.keyboard("{Enter}");
  return user;
}

describe("DocumentCreator", () => {
  it("opens with the assistant's greeting and the agreements it can prepare, without calling the API", () => {
    const html = renderToString(<DocumentCreator documents={documents} />);
    expect(html).toContain("what kind of agreement do you need?");
    expect(html).toContain('aria-label="Conversation"');
    render(<DocumentCreator documents={documents} />);
    expect(conversation().getByText(/what kind of agreement do you need/)).toBeTruthy();
    const agreements = screen.getByRole("list", { name: "Agreements the assistant can prepare" });
    expect(within(agreements).getAllByRole("listitem")).toHaveLength(11);
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the agreement the assistant picks, with its reply and next question", async () => {
    const respond = deferredAnswer();
    render(<DocumentCreator documents={documents} />);

    await say("An NDA between Acme, Inc. and Globex Corporation");
    expect(conversation().getByText("An NDA between Acme, Inc. and Globex Corporation")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Assistant is typing");
    expect(messageBox().value).toBe("");

    await respond("A Mutual NDA it is.", { document: "mutual-nda", parties });
    expect(screen.queryByText("Assistant is typing")).toBeNull();
    expect(preview().textContent).toContain("Acme, Inc.");
    expect(preview().textContent).toContain("Globex Corporation");
    // 6 signer fields, and the 7 NDA fields that apply until a term is chosen.
    expect(screen.getAllByText("13 fields left")).toHaveLength(2);
    // The Standard Terms arrive separately.
    expect(await within(preview()).findByText(/Introduction/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Download PDF" })).toHaveLength(2);
  });

  it("shows the next question after the reply, as one message", async () => {
    answer("A Mutual NDA it is.", { document: "mutual-nda" }, "Who are the two parties?");
    render(<DocumentCreator documents={documents} />);
    await say("I need an NDA");
    const bubble = conversation().getByText(/A Mutual NDA it is\./);
    expect(bubble.textContent).toBe("Assistant: A Mutual NDA it is.\n\nWho are the two parties?");
  });

  it("sends the whole conversation, the agreement as it stands and today's date", async () => {
    answer("An NDA it is.", { document: "mutual-nda", parties }, "Who signs for Acme?");
    answer("Thanks!", { document: "mutual-nda", parties });
    render(<DocumentCreator documents={documents} />);
    await say("An NDA with Globex");
    await say("Jo Smith");

    expect(requestBody(0)).toEqual({
      messages: [GREETING, { role: "user", content: "An NDA with Globex" }],
      ...emptyState,
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(requestBody(1).messages).toEqual([
      GREETING,
      { role: "user", content: "An NDA with Globex" },
      { role: "assistant", content: "An NDA it is.\n\nWho signs for Acme?" },
      { role: "user", content: "Jo Smith" },
    ]);
    expect(requestBody(1).document).toBe("mutual-nda");
    expect(requestBody(1).parties).toEqual(parties);
  });

  it("switches to another agreement when the assistant does", async () => {
    answer("An NDA it is.", { document: "mutual-nda", parties });
    answer("A Cloud Service Agreement instead.", { document: "csa", parties, values: { governingLaw: "Delaware" } });
    render(<DocumentCreator documents={documents} />);
    await say("An NDA");
    expect(preview()).toBeTruthy();

    await say("Actually, they're buying our SaaS product");
    const csa = preview("Cloud Service Agreement");
    expect(within(csa).getByText("Order Form")).toBeTruthy();
    expect(within(csa).getAllByText("Provider").length).toBeGreaterThan(0);
    expect(csa.textContent).toContain("Delaware");
    expect(await within(csa).findByText(/Access and Use\./)).toBeTruthy();
  });

  it("starts a new line with Shift+Enter, and doesn't send a blank message", async () => {
    render(<DocumentCreator documents={documents} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    await user.type(messageBox(), "   {Enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(messageBox());
    await user.type(messageBox(), "line one{Shift>}{Enter}{/Shift}line two");
    expect(messageBox().value).toBe("line one\nline two");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send.disabled).toBe(false);
  });

  it("shows what went wrong and retries without repeating the message", async () => {
    chatAnswers.push(async () => {
      throw new TypeError("Failed to fetch");
    });
    answer("Thanks!");
    render(<DocumentCreator documents={documents} />);
    const user = await say("An NDA");

    expect(screen.getByRole("alert").textContent).toContain("Couldn't reach the assistant");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(conversation().getByText("Thanks!")).toBeTruthy();
    expect(conversation().getAllByText("An NDA")).toHaveLength(1);
    expect(requestBody(1).messages).toEqual(requestBody(0).messages);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).toBe(messageBox());
  });

  it("says when the server has no OpenAI API key", async () => {
    chatAnswers.push(async () => new Response("{}", { status: 503 }));
    render(<DocumentCreator documents={documents} />);
    await say("Hello");
    expect(screen.getByRole("alert").textContent).toContain("no OpenAI API key");
  });

  it("starts over with a new conversation and no agreement", async () => {
    answer("Great.", { document: "mutual-nda", parties });
    render(<DocumentCreator documents={documents} />);
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
    const user = await say("An NDA");
    expect(preview().textContent).toContain("Acme, Inc.");

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(conversation().queryByText("Great.")).toBeNull();
    expect(conversation().getByText(/what kind of agreement do you need/)).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText("Your agreement will appear here")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
    expect(document.activeElement).toBe(messageBox());
  });

  it("ignores a reply that arrives after starting over", async () => {
    const respond = deferredAnswer();
    render(<DocumentCreator documents={documents} />);
    const user = await say("An NDA");
    await user.click(screen.getByRole("button", { name: "Start over" }));

    await respond("Too late.", { document: "mutual-nda", parties });
    expect(conversation().queryByText("Too late.")).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("puts the cursor back in the message box when the answer arrives", async () => {
    const respond = deferredAnswer();
    render(<DocumentCreator documents={documents} />);
    const user = await say("An NDA");
    // e.g. the user clicks the preview while waiting.
    messageBox().blur();
    expect(document.activeElement).toBe(document.body);

    await respond("An NDA it is.", { document: "mutual-nda" });
    expect(document.activeElement).toBe(messageBox());
    await user.keyboard("Acme and Globex");
    expect(messageBox().value).toBe("Acme and Globex");
  });

  it("doesn't take the cursor from another field the user is typing in", async () => {
    const respond = deferredAnswer();
    render(
      <>
        <DocumentCreator documents={documents} />
        <input aria-label="Elsewhere" />
      </>,
    );
    const user = await say("An NDA");
    await user.click(screen.getByLabelText("Elsewhere"));

    await respond("An NDA it is.", { document: "mutual-nda" });
    expect(document.activeElement).toBe(screen.getByLabelText("Elsewhere"));
  });

  it("lets the user edit the fields once an agreement is chosen, and tells the assistant about the edits", async () => {
    answer("An NDA it is.", { document: "mutual-nda" });
    answer("Thanks!", { document: "mutual-nda", values: { governingLaw: "Texas" } });
    render(<DocumentCreator documents={documents} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Edit the fields yourself"));
    expect(screen.getByText(/Once you and the assistant have chosen an agreement/)).toBeTruthy();

    await say("An NDA");
    await user.type(screen.getByLabelText("Governing Law"), "Texas");
    expect(preview().textContent).toContain("Texas");
    await user.click(screen.getByRole("radio", { name: "Until terminated" }));
    expect(preview().textContent).toContain("Continues until terminated");

    await say("That's the governing law.");
    expect(requestBody(1).values).toMatchObject({ governingLaw: "Texas", mndaTerm: "until-terminated" });
  });

  it("asks for a number of years only for a fixed term", async () => {
    answer("An NDA it is.", { document: "mutual-nda" });
    render(<DocumentCreator documents={documents} />);
    const user = userEvent.setup();
    await say("An NDA");
    await user.click(screen.getByText("Edit the fields yourself"));
    expect(screen.queryByLabelText("MNDA Term (years)")).toBeNull();

    await user.click(screen.getAllByRole("radio", { name: "Fixed term" })[0]);
    await user.type(screen.getByLabelText("MNDA Term (years)"), "2");
    expect(preview().textContent).toContain("Expires 2 years from Effective Date.");
  });

  it("locks the fields while a reply is on its way, since the reply replaces them", async () => {
    answer("An NDA it is.", { document: "mutual-nda" });
    const respond = deferredAnswer();
    render(<DocumentCreator documents={documents} />);
    await say("An NDA");
    const governingLaw = screen.getByLabelText("Governing Law");
    expect(governingLaw.matches(":disabled")).toBe(false);

    await say("Hello");
    expect(governingLaw.matches(":disabled")).toBe(true);

    await respond("Hi!", { document: "mutual-nda" });
    expect(governingLaw.matches(":disabled")).toBe(false);
  });

  it("shows that the Standard Terms are loading", async () => {
    const release = holdText("baa");
    answer("A BAA it is.", { document: "baa" });
    render(<DocumentCreator documents={documents} />);
    await say("A BAA");

    const loading = within(preview("Business Associate Agreement")).getByRole("status");
    expect(loading.textContent).toBe("Loading the Standard Terms");
    await release();
    expect(within(preview("Business Associate Agreement")).queryByRole("status")).toBeNull();
    expect(within(preview("Business Associate Agreement")).getByText(/Business Associate Agreement/, { selector: "h3" })).toBeTruthy();
  });

  it("keeps the fields within the lengths the server accepts", async () => {
    answer("A Design Partner Agreement it is.", { document: "design-partner" });
    render(<DocumentCreator documents={documents} />);
    const user = userEvent.setup();
    await say("A design partner agreement");
    await user.click(screen.getByText("Edit the fields yourself"));
    expect((screen.getByLabelText("Term") as HTMLInputElement).maxLength).toBe(500);
    expect((screen.getByLabelText("Product") as HTMLTextAreaElement).maxLength).toBe(5000);
    expect((screen.getAllByLabelText("Notice address")[0] as HTMLInputElement).maxLength).toBe(1000);
  });

  it("offers to retry when the Standard Terms don't load", async () => {
    failingTexts.add("pilot");
    answer("A Pilot Agreement it is.", { document: "pilot" });
    render(<DocumentCreator documents={documents} />);
    const user = await say("A pilot");

    const alert = await within(preview("Pilot Agreement")).findByRole("alert");
    expect(alert.textContent).toContain("Couldn’t load the Standard Terms");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await within(preview("Pilot Agreement")).findByText(/Pilot Access/)).toBeTruthy();
  });

  it("saves the agreement and the conversation once an agreement is chosen", async () => {
    answer("A Mutual NDA it is.", { document: "mutual-nda", parties }, "What is it for?");
    render(<DocumentCreator documents={documents} />);
    await say("An NDA with Globex");

    await waitForSave();
    const [{ id, body }] = saves();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(body).toMatchObject({ document: "mutual-nda", parties });
    expect(body.messages.map((message: { role: string }) => message.role)).toEqual(["assistant", "user", "assistant"]);
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("doesn't save before an agreement is chosen", async () => {
    answer("Which agreement do you need?");
    render(<DocumentCreator documents={documents} />);
    await say("Hello");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(saves()).toEqual([]);
  });

  it("shows that the agreement is a draft, above the preview", async () => {
    answer("A Mutual NDA it is.", { document: "mutual-nda" });
    render(<DocumentCreator documents={documents} />);
    expect(screen.queryByRole("note")).toBeNull();
    await say("An NDA");
    expect(screen.getByRole("note").textContent).toContain(DISCLAIMER);
  });

  it("carries on with a saved agreement and its conversation", async () => {
    const messages = [GREETING, { role: "user" as const, content: "An NDA with Globex" }];
    const saved = {
      id: "c".repeat(32),
      document: "mutual-nda",
      values: {},
      parties,
      messages,
      revision: 4,
      updatedAt: "now",
    };
    render(<DocumentCreator documents={documents} initial={saved} />);
    expect(conversation().getByText("An NDA with Globex")).toBeTruthy();
    expect(preview().textContent).toContain("Globex Corporation");
    expect(screen.getByText("Saved")).toBeTruthy();

    answer("Thanks.", { document: "mutual-nda", values: { purpose: "A deal" }, parties });
    await say("It's for a deal");
    expect(requestBody().messages).toEqual([...messages, { role: "user", content: "It's for a deal" }]);
    await waitForSave();
    expect(saves()[0].id).toBe("c".repeat(32));
    expect(saves()[0].body.revision).toBe(5);
  });

  it("doesn't save a conversation whose last message got no reply", async () => {
    answer("A Mutual NDA it is.", { document: "mutual-nda" });
    render(<DocumentCreator documents={documents} />);
    await say("An NDA");
    await waitForSave();
    chatAnswers.push(async () => json({}, 502));
    await say("For a deal");
    expect(await screen.findByRole("alert")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(saves()).toHaveLength(1);
  });

  it("saves a new agreement under a new id after starting over", async () => {
    const onStartOver = vi.fn();
    answer("A Mutual NDA it is.", { document: "mutual-nda" });
    render(<DocumentCreator documents={documents} onStartOver={onStartOver} />);
    const user = await say("An NDA");
    await waitForSave();

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(onStartOver).toHaveBeenCalledTimes(1);
    answer("A Cloud Service Agreement it is.", { document: "csa" });
    await say("A CSA");
    await waitForSave(2);
    const [first, second] = saves();
    expect(second.id).not.toBe(first.id);
    expect(second.body.document).toBe("csa");
  });
});
