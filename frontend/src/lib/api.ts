import { expireSession } from "./session";

/**
 * `fetch` for the API routes that need a signed-in user. A 401 means the sign-in has ended (signed out elsewhere,
 * or the server restarted, which empties its database), so the page returns to the sign-in screen.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (response.status === 401) expireSession();
  return response;
}
