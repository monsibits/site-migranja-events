export const API_BASE = "https://migranja-portal.migranja-events.workers.dev";
export const TURNSTILE_SITE_KEY = "0x4AAAAAAGSrpXsnJmbKqvfS";

const TOKEN_KEY = "mg_portal_session";

export function getToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return "";
    const data = JSON.parse(raw);
    if (!data || !data.token) return "";
    if (data.expiresAt && Date.parse(data.expiresAt) && Date.now() > Date.parse(data.expiresAt)) {
      clearToken();
      return "";
    }
    return data.token;
  } catch {
    return "";
  }
}

export function setToken(token, expiresAt) {
  if (!token) {
    clearToken();
    return;
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: expiresAt || null }));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

export const esc = escapeHtml;

function networkMessage() {
  return "Can't reach the server right now. Check your connection and try again.";
}

export async function api(path, { method = "GET", body, retry = true } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    if (retry) return api(path, { method, body, retry: false });
    const error = new Error(networkMessage());
    error.status = 0;
    error.code = "network";
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const expired = data.code === "session_expired" || (response.status === 401 && Boolean(token) && path !== "/api/auth/login");
    if (expired) clearToken();
    const error = new Error(data.error || "Something went wrong. Please try again.");
    error.status = response.status;
    error.code = data.code || (expired ? "session_expired" : "");
    error.data = data;
    throw error;
  }
  return data;
}

export function todayISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDate(iso, options = {}) {
  if (!iso) return "";
  const raw = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: options.weekday,
    year: "numeric",
    month: options.month || "long",
    day: "numeric"
  }).format(date);
}

export function formatMoney(amount) {
  if (amount === null || amount === undefined || amount === "") return "TBD";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function isValidContact(value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return true;
  const digits = text.replace(/[^\d+]/g, "");
  return /^(?:\+?63|0)9\d{9}$/.test(digits);
}

export function downloadUrl(path) {
  const token = getToken();
  const url = new URL(`${API_BASE}${path}`);
  return { url: url.toString(), token };
}

export async function downloadReport(table, format) {
  const path = `/api/reports/export?table=${encodeURIComponent(table)}&format=${encodeURIComponent(format)}`;
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  } catch {
    throw new Error(networkMessage());
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not download the file.");
  }
  const blob = await response.blob();
  const link = document.createElement("a");
  const href = URL.createObjectURL(blob);
  link.href = href;
  const header = response.headers.get("Content-Disposition") || "";
  const named = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  const ext = format === "xlsx" ? "xlsx" : "csv";
  link.download = named ? decodeURIComponent(named[1].trim()) : `${table}.${ext}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
