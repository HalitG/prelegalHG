/** Request options for sending `body` as JSON. */
export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

/** The error message the API gave, if it gave one as text. */
export async function errorDetail(response: Response): Promise<string | null> {
  try {
    const detail = ((await response.json()) as { detail?: unknown } | null)?.detail;
    return typeof detail === "string" ? detail : null;
  } catch {
    return null;
  }
}
