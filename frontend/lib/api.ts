export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export type Role = "organizer" | "church";

/** Each role keeps its own token, so one browser can be signed in as an organizer and a church at once. */
export const tokenKey = (role: Role) => `scg_token_${role}`;

export function getToken(role: Role): string | null {
  try { return localStorage.getItem(tokenKey(role)); } catch { return null; }
}
export function setToken(role: Role, token: string | null) {
  try {
    if (token) localStorage.setItem(tokenKey(role), token);
    else localStorage.removeItem(tokenKey(role));
  } catch {}
}

/** Church endpoints live under /api/church/; everything else that needs auth is organizer-only. */
const roleForPath = (path: string): Role => (path.startsWith("/api/church/") ? "church" : "organizer");

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Fired after any successful edit so the board refreshes even if the live stream drops. */
export const CHANGED_EVENT = "scg:changed";
/** Fired when the server rejects a stored token; `detail` is the token's role. */
export const UNAUTHORIZED_EVENT = "scg:unauthorized";

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, as }: { method?: string; body?: unknown; as?: Role } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const role = as ?? roleForPath(path);
  const token = getToken(role);
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new CustomEvent<Role>(UNAUTHORIZED_EVENT, { detail: role }));
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  if (method !== "GET") window.dispatchEvent(new Event(CHANGED_EVENT));
  return data as T;
}
