import { apiFetch } from "./api";
import type { ChatMessage } from "./chat";
import type { DocState } from "./documents/types";
import { jsonRequest } from "./http";

/*
 * The user's saved agreements (backend/app/saved.py). The page makes each agreement's id, so saving is the same
 * PUT whether or not the agreement was saved before.
 */

/** An agreement as "My documents" lists it. */
export interface DocumentSummary {
  id: string;
  document: string;
  documentName: string;
  companies: [string, string];
  /** How many fields and party details are still to fill in; 0 means ready to sign. */
  missing: number;
  /** When it last changed, as an ISO date and time in UTC. */
  updatedAt: string;
}

export interface SavedDocument extends DocState {
  document: string;
  id: string;
  messages: ChatMessage[];
  /** How many times the agreement has been saved (see saveDocument). */
  revision: number;
  updatedAt: string;
}

/** A request about saved agreements failed. `message` is written for the user; `status` is 0 when offline. */
export class SavedDocumentsError extends Error {
  override name = "SavedDocumentsError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** A new agreement's id: 32 random hex characters. */
export function newDocumentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const SOMETHING_WENT_WRONG = "Something went wrong. Please try again.";

/** Fails only with a SavedDocumentsError. */
async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await apiFetch(path, init);
  } catch {
    throw new SavedDocumentsError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  if (response.status === 404) throw new SavedDocumentsError("We couldn't find that agreement.", 404);
  if (!response.ok) throw new SavedDocumentsError(SOMETHING_WENT_WRONG, response.status);
  return response;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await request(path);
  try {
    return (await response.json()) as T;
  } catch {
    throw new SavedDocumentsError(SOMETHING_WENT_WRONG, response.status);
  }
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return requestJson("/api/documents");
}

export function loadDocument(id: string): Promise<SavedDocument> {
  return requestJson(`/api/documents/${id}`);
}

/**
 * Saves the agreement as `revision`, which counts this page's saves of it from the revision it was opened at. The
 * server ignores a save older than the one it has. `keepalive` lets the request finish after the page has gone.
 */
export async function saveDocument(
  id: string,
  state: DocState,
  messages: ChatMessage[],
  revision: number,
  { keepalive = false } = {},
): Promise<void> {
  await request(`/api/documents/${id}`, { ...jsonRequest("PUT", { ...state, messages, revision }), keepalive });
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/api/documents/${id}`, { method: "DELETE" });
}
