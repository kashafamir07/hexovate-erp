/**
 * Thin API client for the Hexovate ERP backend (server/).
 * - base URL from VITE_API_URL (defaults to the local dev API)
 * - bearer token kept in localStorage (set by login/me)
 * - consistent success/error unwrapping matching the API response format
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "http://localhost:4000/api";

export const TOKEN_KEY = "hexovate.accessToken";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const UNAUTHORIZED_EVENT = "hexovate:unauthorized";

export interface ApiFieldError {
  field?: string;
  msg: string;
  location?: string;
}

export class ApiError extends Error {
  status: number;
  errors: ApiFieldError[];
  fieldErrors: Record<string, string>;
  constructor(status: number, message: string, errors: ApiFieldError[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.fieldErrors = {};
    for (const e of errors) if (e.field) this.fieldErrors[e.field] = e.msg;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check that the API is running and VITE_API_URL is correct.");
  }

  if (res.status === 204) return undefined as T;

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const message = body?.message || `Request failed (${res.status})`;
    const errors = body && !body.success ? ((body as unknown as { errors?: ApiFieldError[] }).errors ?? []) : [];
    throw new ApiError(res.status, message, errors);
  }
  return body ? body.data : (undefined as T);
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const apiPatch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
export const apiDelete = <T>(path: string) => request<T>(path, { method: "DELETE" });

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.status === 0 ? e.message : e.message;
  return e instanceof Error ? e.message : "Something went wrong";
}
