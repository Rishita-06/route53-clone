import type { DnsRecord, HostedZone, ImportResult, Page, RecordInput, User } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "r53_token";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

type Query = Record<string, string | number | boolean | undefined | null>;
const qs = (q?: Query) => {
  const p = new URLSearchParams();
  Object.entries(q ?? {}).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function raw(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = tokenStore.get();
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Unable to reach the server. Check that the API is running.");
  }
  if (!res.ok) {
    let msg = res.statusText, fields = {};
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : msg;
      fields = body.fields ?? {};
    } catch { /* non-JSON error */ }
    if (res.status === 401 && auth) onUnauthorized?.();
    throw new ApiError(res.status, msg, fields);
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const res = await raw(path, init, auth);
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  login: (account_id: string, username: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", json("POST", { account_id, username, password }), false),
  me: () => request<User>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", json("POST")),

  listZones: (q: Query) => request<Page<HostedZone>>(`/api/zones${qs(q)}`),
  getZone: (id: string) => request<HostedZone>(`/api/zones/${id}`),
  createZone: (b: { name: string; comment: string; is_private: boolean; vpc_id?: string; vpc_region?: string; tags: Record<string, string> }) =>
    request<HostedZone>("/api/zones", json("POST", b)),
  updateZone: (id: string, b: { comment?: string; tags?: Record<string, string> }) =>
    request<HostedZone>(`/api/zones/${id}`, json("PUT", b)),
  deleteZone: (id: string, force = false) => request<void>(`/api/zones/${id}${qs({ force })}`, json("DELETE")),

  listRecords: (zid: string, q: Query) => request<Page<DnsRecord>>(`/api/zones/${zid}/records${qs(q)}`),
  getRecord: (zid: string, rid: number) => request<DnsRecord>(`/api/zones/${zid}/records/${rid}`),
  createRecord: (zid: string, b: RecordInput) => request<DnsRecord>(`/api/zones/${zid}/records`, json("POST", b)),
  updateRecord: (zid: string, rid: number, b: RecordInput) => request<DnsRecord>(`/api/zones/${zid}/records/${rid}`, json("PUT", b)),
  deleteRecords: (zid: string, ids: number[]) =>
    request<{ deleted: number }>(`/api/zones/${zid}/records/bulk-delete`, json("POST", { ids })),

  importZone: (zid: string, content: string, overwrite: boolean) =>
    request<ImportResult>(`/api/zones/${zid}/import`, json("POST", { content, overwrite })),
  async exportZone(zid: string, format: "json" | "bind", fallbackName: string) {
    const res = await raw(`/api/zones/${zid}/export${qs({ format })}`);
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? `${fallbackName}.${format === "json" ? "json" : "zone"}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
