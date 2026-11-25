export const API_BASE = "https://migranja-portal.migranja-events.workers.dev";

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

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const expired = data.code === "session_expired" || (response.status === 401 && Boolean(token) && path !== "/api/auth/login");
    if (expired) clearToken();
    const error = new Error(data.error || "Request failed");
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
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
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

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}
