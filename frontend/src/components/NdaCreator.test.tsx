// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GREETING } from "@/lib/chat";
import { loadMndaTemplate } from "@/lib/nda/template";
import { defaultFormData, type NdaFormData } from "@/lib/nda/types";
import { NdaCreator } from "./NdaCreator";

const template = loadMndaTemplate();
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

const parties: NdaFormData["parties"] = [
  { company: "Acme, Inc.", name: "", title: "", noticeAddress: "" },
  { company: "Globex Corporation", name: "", title: "", noticeAddress: "" },
];

function reply(text: string, fields: Partial<NdaFormData> = {}) {
  return new Response(JSON.stringify({ reply: text, fields: { ...defaultFormData, ...fields } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fetch response the test sends when it chooses. */
function deferredResponse() {
  let resolve!: (response: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  return (response: Response) => act(async () => resolve(response));
}

const requestBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1]?.body as string);
const conversation = () => within(screen.getByRole("log", { name: "Conversation" }));
const preview = () => screen.getByRole("article", { name: "Mutual NDA preview" });

async function say(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Message"), text);
  await user.keyboard("{Enter}");
  return user;
}

describe("NdaCreator", () => {
  it("opens with the assistant's greeting in the static HTML, without calling the API", () => {
    const html = renderToString(<NdaCreator template={template} />);
    expect(html).toContain("which two companies are entering into the NDA");
    expect(html).toContain('aria-label="Conversation"');
    render(<NdaCreator template={template} />);
    expect(conversation().getByText(/which two companies/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the user's message and fills in the agreement from the reply", async () => {
    const respond = deferredResponse();
    render(<NdaCreator template={template} />);
    expect(screen.getAllByText("10 fields left")).toHaveLength(2);

    await say("Acme, Inc. and Globex Corporation");
    expect(conversation().getByText("Acme, Inc. and Globex Corporation")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Assistant is typing");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");

    await respond(reply("Great. Who signs for Acme?", { parties }));
    expect(conversation().getByText("Great. Who signs for Acme?")).toBeTruthy();
    expect(screen.queryByText("Assistant is typing")).toBeNull();
    expect(preview().textContent).toContain("Acme, Inc.");
    expect(preview().textContent).toContain("Globex Corporation");
    expect(screen.getAllByText("8 fields left")).toHaveLength(2);
  });

  it("sends the whole conversation, the current fields and today's date", async () => {
    fetchMock.mockResolvedValueOnce(reply("Who signs for Acme?", { parties })).mockResolvedValueOnce(reply("Thanks!"));
    render(<NdaCreator template={template} />);
    await say("Acme and Globex");
    await say("Jo Smith");

    expect(requestBody(0)).toEqual({
      messages: [GREETING, { role: "user", content: "Acme and Globex" }],
      fields: defaultFormData,
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(requestBody(1).messages).toEqual([
      GREETING,
      { role: "user", content: "Acme and Globex" },
      { role: "assistant", content: "Who signs for Acme?" },
      { role: "user", content: "Jo Smith" },
    ]);
    expect(requestBody(1).fields.parties).toEqual(parties);
  });

  it("starts a new line with Shift+Enter, and doesn't send a blank message", async () => {
    render(<NdaCreator template={template} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    await user.type(screen.getByLabelText("Message"), "   {Enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Message"));
    await user.type(screen.getByLabelText("Message"), "line one{Shift>}{Enter}{/Shift}line two");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("line one\nline two");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send.disabled).toBe(false);
  });

  it("shows what went wrong and retries without repeating the message", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(reply("Thanks!"));
    render(<NdaCreator template={template} />);
    const user = await say("Acme and Globex");

    expect(screen.getByRole("alert").textContent).toContain("Couldn't reach the assistant");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(conversation().getByText("Thanks!")).toBeTruthy();
    expect(conversation().getAllByText("Acme and Globex")).toHaveLength(1);
    expect(requestBody(1).messages).toEqual(requestBody(0).messages);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the server has no OpenAI API key", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    render(<NdaCreator template={template} />);
    await say("Hello");
    expect(screen.getByRole("alert").textContent).toContain("no OpenAI API key");
  });

  it("starts over with a new conversation and a blank agreement", async () => {
    fetchMock.mockResolvedValueOnce(reply("Great.", { parties }));
    render(<NdaCreator template={template} />);
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
    const user = await say("Acme and Globex");
    expect(preview().textContent).toContain("Acme, Inc.");

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(conversation().queryByText("Great.")).toBeNull();
    expect(conversation().getByText(/which two companies/)).toBeTruthy();
    expect(preview().textContent).not.toContain("Acme, Inc.");
    expect(screen.queryByRole("button", { name: "Start over" })).toBeNull();
  });

  it("ignores a reply that arrives after starting over", async () => {
    const respond = deferredResponse();
    render(<NdaCreator template={template} />);
    const user = await say("Acme and Globex");
    await user.click(screen.getByRole("button", { name: "Start over" }));

    await respond(reply("Too late.", { parties }));
    expect(conversation().queryByText("Too late.")).toBeNull();
    expect(preview().textContent).not.toContain("Acme, Inc.");
  });

  it("lets the user edit the fields directly, and tells the assistant about the edits", async () => {
    fetchMock.mockResolvedValueOnce(reply("Thanks!", { governingLaw: "Texas" }));
    render(<NdaCreator template={template} />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Edit the fields yourself"));
    await user.type(screen.getByLabelText("Governing law (state)"), "Texas");
    expect(preview().textContent).toContain("Texas");

    await say("That's the governing law.");
    expect(requestBody().fields.governingLaw).toBe("Texas");
  });

  it("locks the fields while a reply is on its way, since the reply replaces them", async () => {
    const respond = deferredResponse();
    render(<NdaCreator template={template} />);
    const governingLaw = screen.getByLabelText("Governing law (state)");
    expect(governingLaw.matches(":disabled")).toBe(false);

    await say("Hello");
    expect(governingLaw.matches(":disabled")).toBe(true);

    await respond(reply("Hi!"));
    expect(governingLaw.matches(":disabled")).toBe(false);
  });
});
