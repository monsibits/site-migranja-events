import { api, clearToken, downloadReport, escapeHtml, formatDate, formatDateTime, formatMoney, getToken, isValidContact, setToken, todayISO, TURNSTILE_SITE_KEY } from "./api.js";
import {
  confirmAction,
  openModal,
  setModuleContext,
  viewAccounting,
  viewEventSheet,
  viewHousekeeping,
  viewHr,
  viewInventory,
  viewOpsDashboard,
  viewOpsReports,
  viewSales,
  viewSettings
} from "./modules.js";

const esc = escapeHtml;

const loginScreen = document.querySelector("#login-screen");
const appScreen = document.querySelector("#app-screen");
const navEl = document.querySelector("[data-nav]");
const mainEl = document.querySelector("#main");
const navToggle = document.querySelector("[data-nav-toggle]");
const userMeta = document.querySelector("[data-user-meta]");

const ROUTES = {
  dashboard: ["owner", "admin", "staff"],
  events: ["owner", "admin"],
  requests: ["owner", "admin"],
  schedule: ["owner", "admin", "staff"],
  tasks: ["owner", "admin", "staff"],
  attendance: ["owner", "admin", "staff"],
  announcements: ["owner", "admin", "staff"],
  sales: ["owner", "admin"],
  housekeeping: ["owner", "admin", "staff"],
  inventory: ["owner", "admin", "staff"],
  accounting: ["owner"],
  finances: ["owner"],
  hr: ["owner", "admin", "staff"],
  reports: ["owner", "admin"],
  users: ["owner"],
  settings: ["owner"]
};

let currentUser = null;
let pendingCount = 0;
let usersCache = [];

function canAccess(role, route) {
  return (ROUTES[route] || []).includes(role);
}

function labelTableCells(root = mainEl) {
  if (!root) return;
  root.querySelectorAll("table.data").forEach((table) => {
    const labels = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((tr) => {
      [...tr.children].forEach((td, i) => {
        const label = labels[i] || "";
        if (td.hasAttribute("data-label")) return;
        if (!label || label.toLowerCase() === "actions") {
          td.classList.add("row-actions");
          td.setAttribute("data-label", label || "Actions");
          return;
        }
        td.setAttribute("data-label", label);
      });
    });
  });
}

function setAccountMenu(open) {
  const menu = document.querySelector("[data-account-menu]");
  const toggle = document.querySelector("[data-account-toggle]");
  if (!menu || !toggle) return;
  menu.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function showSigningOut() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
  document.title = "Signing out… | Mi Granja Events";
  const panel = loginScreen.querySelector("[data-login-panel]");
  if (panel) {
    panel.innerHTML = `
      <p class="kicker">Account</p>
      <h1>Signing out…</h1>
      <p class="muted">Clearing this device.</p>
    `;
  }
}

async function signOut({ everywhere = false } = {}) {
  const hadToken = Boolean(getToken());
  currentUser = null;
  window.location.hash = "";
  setAccountMenu(false);
  showSigningOut();
  if (hadToken) {
    const path = everywhere ? "/api/auth/logout-all" : "/api/auth/logout";
    try { await api(path, { method: "POST", body: {} }); } catch { /* local session will still be cleared */ }
  }
  clearToken();
  renderLogin(everywhere ? "You have been signed out everywhere. Please sign in again." : "");
}

function navItems(role) {
  return [
    { route: "dashboard", label: "Dashboard" },
    { route: "events", label: "Events" },
    { route: "requests", label: "Requests" },
    { route: "schedule", label: "Schedule" },
    { route: "tasks", label: "Tasks" },
    { route: "attendance", label: "Attendance" },
    { route: "announcements", label: "Announcements" },
    { route: "sales", label: "Sales" },
    { route: "housekeeping", label: "Housekeeping" },
    { route: "inventory", label: "Inventory" },
    { route: "accounting", label: "Accounting" },
    { route: "finances", label: "Finances" },
    { route: "hr", label: "HR" },
    { route: "reports", label: "Reports" },
    { route: "users", label: "Users" },
    { route: "settings", label: "Settings" }
  ].filter((item) => canAccess(role, item.route));
}

const PAGE_TITLES = {
  dashboard: "Dashboard",
  events: "Events",
  requests: "Booking requests",
  schedule: "Schedule",
  tasks: "Tasks",
  attendance: "Attendance",
  announcements: "Announcements",
  sales: "Sales",
  housekeeping: "Housekeeping",
  inventory: "Inventory",
  accounting: "Accounting",
  finances: "Finances",
  hr: "HR",
  reports: "Reports",
  users: "Users",
  settings: "Settings"
};

function setPageTitle(route) {
  const label = PAGE_TITLES[route] || "Staff portal";
  document.title = `${label} | Mi Granja Events`;
}

function normalizeHash() {
  const raw = window.location.hash || "";
  if (raw.startsWith("#setup") && !raw.startsWith("#/setup")) {
    history.replaceState(null, "", `#/${raw.slice(1)}`);
    return;
  }
  if (raw && raw.startsWith("#") && !raw.startsWith("#/")) {
    history.replaceState(null, "", `#/${raw.slice(1)}`);
  }
  if (!window.location.hash && currentUser) {
    history.replaceState(null, "", "#/dashboard");
  }
}


function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Staff";
}

function currentRoute() {
  normalizeHash();
  const hash = (window.location.hash || "#/dashboard").replace(/^#\/?/, "");
  return hash.split("?")[0] || "dashboard";
}

function setupToken() {
  const hash = window.location.hash || "";
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : new URL(window.location.href).searchParams.toString();
  const params = new URLSearchParams(query);
  if (hash.startsWith("#setup") || hash.startsWith("#/setup") || currentRoute() === "setup") {
    return params.get("token") || "";
  }
  return params.get("token") || "";
}

function isSetupView() {
  const hash = window.location.hash || "";
  return hash.startsWith("#setup") || hash.startsWith("#/setup") || currentRoute() === "setup";
}

function go(route) {
  window.location.hash = `#/${route}`;
}

function isWide() {
  return window.matchMedia("(min-width: 960px)").matches;
}

function setNavOpen(open) {
  if (isWide()) {
    navEl.hidden = false;
    navToggle.setAttribute("aria-expanded", "true");
    return;
  }
  navEl.hidden = !open;
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function showError(target, message) {
  target.innerHTML = message ? `<p class="form-error">${escapeHtml(message)}</p>` : "";
}

async function refreshPending() {
  if (!currentUser || !canAccess(currentUser.role, "requests")) {
    pendingCount = 0;
    return;
  }
  try {
    const data = await api("/api/requests");
    pendingCount = (data.requests || []).filter((item) => item.status === "pending").length;
  } catch {
    pendingCount = 0;
  }
}

async function loadUsers() {
  if (!currentUser) {
    usersCache = [];
    return;
  }
  try {
    const data = await api("/api/directory");
    usersCache = data.people || [];
  } catch {
    usersCache = [];
  }
}

function userName(id) {
  const found = usersCache.find((item) => item.id === id);
  return found ? found.name : "";
}

function personName(row) {
  return (row && (row.staff_name || userName(row.staff_id))) || "";
}

function loadingMarkup(label = "Loading…") {
  return `<div class="portal-card loading-block" data-loading><span class="spinner" aria-hidden="true"></span><p class="muted">${esc(label)}</p></div>`;
}

function retryMarkup(message) {
  return `<div class="portal-card retry-block"><p class="form-error">${esc(message || "Can't reach the server right now.")}</p><button class="btn btn-solid" type="button" data-retry-route>Try again</button></div>`;
}



function isSample(row) {
  return Boolean(row && (row.is_sample === 1 || row.is_sample === true || row.isSample));
}

function sampleMark(row, visible = "") {
  if (!isSample(row)) return "";
  if (String(visible).toUpperCase().includes("SAMPLE")) return "";
  return ' <span class="chip chip-sample">SAMPLE</span>';
}

async function attachSampleBanner() {
  if (!currentUser || currentUser.role !== "owner") return;
  try {
    const data = await api("/api/sample");
    if (!data.hasSample) return;
  } catch {
    return;
  }
  if (mainEl.querySelector("[data-sample-banner]")) return;
  const banner = document.createElement("aside");
  banner.className = "portal-card sample-banner";
  banner.setAttribute("data-sample-banner", "");
  banner.innerHTML = `
    <div>
      <p class="kicker">Sample records</p>
      <p>This portal has SAMPLE records so you can see how each screen looks. They are marked SAMPLE and do not show on the public booking calendar. You can remove them in <a href="#/settings">Settings</a>.</p>
    </div>
  `;
  mainEl.prepend(banner);
}


function renderNav() {
  const items = navItems(currentUser.role).map((item) => {
    const current = currentRoute() === item.route ? ' aria-current="page"' : "";
    const badge = item.route === "requests" && pendingCount
      ? `<span class="nav-badge">${pendingCount}</span>`
      : "";
    return `<li><a href="#/${item.route}"${current}>${item.label}${badge}</a></li>`;
  }).join("");
  navEl.innerHTML = `<ul>${items}</ul>`;
  userMeta.innerHTML = `<strong>${escapeHtml(currentUser.name)}</strong><span class="tiny muted">${escapeHtml(roleLabel(currentUser.role))}</span>`;
}

function renderSetup() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
  const token = setupToken();
  loginScreen.querySelector("[data-login-panel]").innerHTML = `
    <p class="kicker">First-time setup</p>
    <h1>Create the owner account</h1>
    <p class="muted">Choose the email and password you will use to sign in. This setup code works only once.</p>
    <form class="portal-form" data-setup-form>
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <div class="field">
        <label for="setup-name">Your name</label>
        <input id="setup-name" name="name" type="text" autocomplete="name" required>
      </div>
      <div class="field">
        <label for="setup-email">Email</label>
        <input id="setup-email" name="email" type="email" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="setup-password">Password</label>
        <input id="setup-password" name="password" type="password" autocomplete="new-password" required minlength="10">
        <p class="tiny muted">At least 10 characters, with letters and numbers.</p>
      </div>
      <div class="field">
        <label for="setup-confirm">Confirm password</label>
        <input id="setup-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="10">
      </div>
      <div data-form-error></div>
      <button class="btn btn-solid" type="submit">Save and sign in</button>
    </form>
  `;
  const form = loginScreen.querySelector("[data-setup-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const errorBox = form.querySelector("[data-form-error]");
    if (data.get("password") !== data.get("confirm")) {
      showError(errorBox, "The two passwords do not match.");
      return;
    }
    try {
      const result = await api("/api/auth/setup", {
        method: "POST",
        body: {
          token: String(data.get("token") || ""),
          name: String(data.get("name") || "").trim(),
          email: String(data.get("email") || "").trim(),
          password: String(data.get("password") || "")
        }
      });
      setToken(result.token, result.expiresAt);
      currentUser = result.user;
      go("dashboard");
      await bootApp();
    } catch (err) {
      showError(errorBox, err.message);
    }
  });
}

let loginTurnstile = null;

function ensureTurnstileScript() {
  if (document.getElementById("cf-turnstile-api")) return;
  const script = document.createElement("script");
  script.id = "cf-turnstile-api";
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  document.head.append(script);
}

function mountLoginTurnstile() {
  const host = loginScreen.querySelector("[data-login-turnstile]");
  if (!host) return;
  const start = () => {
    if (!window.turnstile) return;
    if (loginTurnstile !== null) {
      try { window.turnstile.remove(loginTurnstile); } catch { /* ignore */ }
      loginTurnstile = null;
    }
    loginTurnstile = window.turnstile.render(host, { sitekey: TURNSTILE_SITE_KEY });
  };
  ensureTurnstileScript();
  if (window.turnstile) start();
  else {
    const timer = window.setInterval(() => { if (window.turnstile) { window.clearInterval(timer); start(); } }, 200);
    window.setTimeout(() => window.clearInterval(timer), 8000);
  }
}

function renderLogin(message = "", { turnstile = false } = {}) {
  document.title = "Sign in | Mi Granja Events";
  loginScreen.hidden = false;
  appScreen.hidden = true;
  loginScreen.querySelector("[data-login-panel]").innerHTML = `
    <p class="kicker">Employee sign in</p>
    <h1>Welcome back</h1>
    <p class="muted">Use the email and password set up for your staff account.</p>
    <form class="portal-form" data-login-form>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
      </div>
      <div class="field" data-login-turnstile-wrap ${turnstile ? "" : "hidden"}>
        <div data-login-turnstile></div>
      </div>
      <div data-form-error>${message ? `<p class="form-error">${esc(message)}</p>` : ""}</div>
      <button class="btn btn-solid" type="submit">Sign in</button>
    </form>
  `;
  if (turnstile) mountLoginTurnstile();
  const form = loginScreen.querySelector("[data-login-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Signing in…";
    try {
      const turnstileToken = window.turnstile && loginTurnstile !== null
        ? window.turnstile.getResponse(loginTurnstile)
        : "";
      const result = await api("/api/auth/login", {
        method: "POST",
        body: {
          email: data.get("email"),
          password: data.get("password"),
          turnstileToken
        }
      });
      setToken(result.token, result.expiresAt);
      currentUser = result.user;
      go("dashboard");
      await bootApp();
    } catch (err) {
      const need = err.code === "turnstile_required";
      showError(form.querySelector("[data-form-error]"), err.message);
      button.disabled = false;
      button.textContent = "Sign in";
      if (need) {
        form.querySelector("[data-login-turnstile-wrap]").hidden = false;
        mountLoginTurnstile();
      } else if (window.turnstile && loginTurnstile !== null) {
        window.turnstile.reset(loginTurnstile);
      }
    }
  });
}

async function boot() {
  if (isSetupView()) {
    renderSetup();
    return;
  }
  if (!getToken()) {
    currentUser = null;
    renderLogin();
    return;
  }
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
    await bootApp();
  } catch (err) {
    currentUser = null;
    clearToken();
    const message = err.code === "session_expired" || err.status === 401
      ? "Your session has ended. Please sign in again."
      : (err.message || "Please sign in.");
    renderLogin(message);
  }
}

function renderChangePassword() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
  loginScreen.querySelector("[data-login-panel]").innerHTML = `
    <p class="kicker">Update your password</p>
    <h1>Choose a new password</h1>
    <p class="muted">Your account was set up with a temporary password. Please choose a new one before you continue.</p>
    <form class="portal-form" data-change-form>
      <div class="field">
        <label for="current-password">Current password</label>
        <input id="current-password" name="current" type="password" autocomplete="current-password" required>
      </div>
      <div class="field">
        <label for="new-password">New password</label>
        <input id="new-password" name="next" type="password" autocomplete="new-password" required minlength="10">
        <p class="tiny muted">At least 10 characters, with letters and numbers.</p>
      </div>
      <div class="field">
        <label for="new-confirm">Confirm new password</label>
        <input id="new-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="10">
      </div>
      <div data-form-error></div>
      <button class="btn btn-solid" type="submit">Save password</button>
    </form>
  `;
  const form = loginScreen.querySelector("[data-change-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const errorBox = form.querySelector("[data-form-error]");
    if (data.get("next") !== data.get("confirm")) {
      showError(errorBox, "The two passwords do not match.");
      return;
    }
    try {
      const result = await api("/api/auth/password", {
        method: "POST",
        body: { current: data.get("current"), next: data.get("next") }
      });
      if (result.token) setToken(result.token, result.expiresAt);
      currentUser.mustChangePassword = false;
      await bootApp();
    } catch (err) {
      showError(errorBox, err.message);
    }
  });
}

async function bootApp() {
  if (currentUser && currentUser.mustChangePassword) {
    renderChangePassword();
    return;
  }
  loginScreen.hidden = true;
  appScreen.hidden = false;
  const loginPanel = loginScreen.querySelector("[data-login-panel]");
  if (loginPanel) loginPanel.innerHTML = "";
  setNavOpen(isWide());
  try {
    await Promise.all([refreshPending(), loadUsers().catch(() => { usersCache = []; })]);
  } catch {
    /* ignore */
  }
  renderNav();
  await renderRoute();
}

async function bindModuleContext() {
  setModuleContext({
    main: mainEl,
    currentUser,
    user: currentUser,
    users: usersCache,
    api,
    formatDate,
    formatMoney,
    downloadReport,
    go: (route) => { window.location.hash = `#/${route}`; }
  });
}

async function renderRoute() {
  setAccountMenu(false);
  const route = currentRoute();
  setPageTitle(route);
  if (route === "setup") return;
  if (!currentUser) {
    renderLogin();
    return;
  }
  bindModuleContext();
  if (!canAccess(currentUser.role, route)) {
    mainEl.innerHTML = `
      <div class="portal-card">
        <h1>You don’t have access to this page</h1>
        <p class="muted">Your account cannot open this screen. You have been sent back to the dashboard.</p>
      </div>
    `;
    window.setTimeout(() => go("dashboard"), 700);
    renderNav();
    return;
  }
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  if (route === "events" && params.get("sheet")) {
    renderNav();
    await viewEventSheet(params.get("sheet"));
    labelTableCells();
    return;
  }
  const views = {
    dashboard: viewDashboard,
    events: viewEvents,
    requests: viewRequests,
    schedule: viewSchedule,
    tasks: viewTasks,
    attendance: viewAttendance,
    announcements: viewAnnouncements,
    sales: viewSales,
    housekeeping: viewHousekeeping,
    inventory: viewInventory,
    accounting: viewAccounting,
    finances: viewFinances,
    hr: viewHr,
    reports: viewOpsReports,
    users: viewUsers,
    settings: viewSettings
  };
  renderNav();
  try {
    await (views[route] || viewDashboard)();
    labelTableCells();
  } catch (err) {
    mainEl.innerHTML = `<div class="portal-card"><h1>Could not load this page</h1><p class="muted">${escapeHtml(err.message || "Please try again.")}</p><p><button class="btn btn-solid" type="button" data-retry>Try again</button></p></div>`;
    mainEl.querySelector("[data-retry]")?.addEventListener("click", () => renderRoute());
  }
}


function clockCard(punch, extra = "") {
  const open = punch && punch.time_in && !punch.time_out;
  const status = !punch
    ? "You have not timed in today."
    : open
      ? `Timed in at ${punch.time_in}.`
      : `Shift closed: ${punch.time_in}–${punch.time_out}.`;
  const action = open ? "Time out" : "Time in";
  return `<article class="portal-card clock-card">
    <div>
      <p class="kicker">Today</p>
      <h2>Time clock</h2>
      <p>${status}${extra ? ` ${extra}` : ""}</p>
    </div>
    <button class="btn btn-solid" type="button" data-action="clock">${action}</button>
  </article>`;
}

async function viewDashboard() {
  const today = todayISO();
  const attendanceData = await api("/api/attendance").catch(() => ({ attendance: [] }));
  const myPunch = (attendanceData.attendance || []).find((row) => row.staff_id === currentUser.id && row.date === today);
  await viewOpsDashboard({ clockHtml: clockCard(myPunch) });
}

async function viewEvents() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const range = params.get("range") || "all";
  const status = params.get("status") || "";
  const q = params.get("q") || "";
  const query = new URLSearchParams();
  if (range !== "all") query.set("range", range);
  if (status) query.set("status", status);
  if (q) query.set("q", q);
  const data = await api(`/api/events?${query.toString()}`);
  const events = data.events || [];
  const editId = params.get("edit");
  const editing = events.find((item) => item.id === editId);
  const rows = events.map((event) => `
    <tr>
      <td>${esc(formatDate(event.date, { month: "short", weekday: "short" }))}</td>
      <td>${esc(event.client || "—")}${sampleMark(event, event.client)}<br><span class="muted">${esc(event.title || "")}</span></td>
      <td>${esc(event.package || "—")}</td>
      <td>${esc(event.pax ?? "—")}</td>
      <td>${esc(event.venue || "—")}</td>
      <td><span class="chip chip-${esc(String(event.status || "").toLowerCase())}">${esc(event.status || "")}</span></td>
      <td class="row-actions"><div class="action-group">
        <button class="btn btn-ghost" type="button" data-action="edit-event" data-id="${esc(event.id)}">View / Edit</button>
        ${currentUser.role === "owner" ? `<a class="btn btn-ghost" href="#/events?sheet=${esc(event.id)}">Event sheet</a>` : ""}
        ${event.status !== "Cancelled" && event.status !== "Completed" ? `<button class="btn btn-danger" type="button" data-action="cancel-event" data-id="${esc(event.id)}">Cancel</button>` : ""}
      </div></td>
    </tr>
  `).join("");
  const tab = (value, label) => `<button class="btn btn-ghost" type="button" data-action="filter-events" data-range="${value}" aria-pressed="${range === value ? "true" : "false"}">${label}</button>`;
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Operations</p><h1>Events</h1></div></div>
    <div class="filter-tabs" role="tablist" aria-label="Event range">
      ${tab("all", "All")}${tab("upcoming", "Upcoming")}${tab("past", "Past")}
    </div>
    <form class="toolbar" data-event-filters>
      <div class="field"><label for="ev-status-filter">Status</label>
        <select id="ev-status-filter" name="status"><option value="">Any</option>${["Confirmed","Tentative","Setup","Booked","Completed","Cancelled"].map((item) => `<option value="${item}" ${status === item ? "selected" : ""}>${item}</option>`).join("")}</select>
      </div>
      <div class="field"><label for="ev-search">Search</label><input id="ev-search" name="q" type="search" value="${esc(q)}" placeholder="Client, title, or venue"></div>
      <button class="btn btn-solid" type="submit">Filter</button>
    </form>
    ${editing ? eventForm(editing) : ""}
    <details class="portal-card"><summary>Add an event</summary>${eventForm()}</details>
    <div class="table-wrap stack-gap">
      <table class="data">
        <thead><tr><th>Date</th><th>Client</th><th>Package</th><th>Pax</th><th>Venue</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7">No events yet. Add one, or approve a booking request.</td></tr>`}</tbody>
      </table>
    </div>
  `;
  mainEl.querySelector("[data-event-filters]").addEventListener("submit", (event) => {
    event.preventDefault();
    const dataForm = new FormData(event.target);
    const next = new URLSearchParams();
    next.set("range", range);
    if (dataForm.get("status")) next.set("status", dataForm.get("status"));
    if (dataForm.get("q")) next.set("q", dataForm.get("q"));
    window.location.hash = `#/events?${next.toString()}`;
  });
  bindEventForm(mainEl.querySelector("[data-edit-event-form]"), editing);
  bindEventForm(mainEl.querySelector("details [data-event-form]"));
}

function eventForm(event) {
  const ev = event || {};
  const sid = ev.id || "new";
  const types = ["Wedding","Debut","Birthday","Christening","Corporate","Other"];
  const venues = ["Ballroom","The Nook","Amore Garden"];
  const statuses = ["Confirmed","Tentative","Setup","Booked","Completed","Cancelled"];
  const opts = (list, value) => list.map((item) => `<option ${value === item ? "selected" : ""}>${item}</option>`).join("");
  return `
    <form class="portal-form stack-gap ${event ? "drawer" : ""}" ${event ? "data-edit-event-form" : "data-event-form"} data-id="${esc(ev.id || "")}">
      ${event ? "<h2>View or edit event</h2>" : ""}
      <div class="field"><label for="ev-date-${esc(sid)}">Date <span class="req">required</span></label><input id="ev-date-${esc(sid)}" name="date" type="date" required value="${esc(ev.date || "")}"></div>
      <div class="field"><label for="ev-client-${esc(sid)}">Client <span class="req">required</span></label><input id="ev-client-${esc(sid)}" name="client" required value="${esc(ev.client || "")}"></div>
      <div class="field"><label for="ev-title-${esc(sid)}">Title <span class="req">required</span></label><input id="ev-title-${esc(sid)}" name="title" required value="${esc(ev.title || "")}"></div>
      <div class="field"><label for="ev-type-${esc(sid)}">Type</label><select id="ev-type-${esc(sid)}" name="type">${opts(types, ev.type)}</select></div>
      <div class="field"><label for="ev-package-${esc(sid)}">Package</label><input id="ev-package-${esc(sid)}" name="package" value="${esc(ev.package || "")}"></div>
      <div class="field"><label for="ev-pax-${esc(sid)}">Pax</label><input id="ev-pax-${esc(sid)}" name="pax" type="number" min="0" max="2000" value="${esc(ev.pax ?? "")}"></div>
      <div class="field"><label for="ev-venue-${esc(sid)}">Venue</label><select id="ev-venue-${esc(sid)}" name="venue">${opts(venues, ev.venue)}</select></div>
      <div class="field"><label for="ev-status-${esc(sid)}">Status</label><select id="ev-status-${esc(sid)}" name="status">${opts(statuses, ev.status)}</select></div>
      ${currentUser.role === "owner" ? `<div class="field"><label for="ev-fee-${esc(sid)}">Fee</label><input id="ev-fee-${esc(sid)}" name="fee" type="number" min="0" value="${esc(ev.fee ?? "")}"></div>
        <div class="field"><label for="ev-deposit-${esc(sid)}">Deposit</label><input id="ev-deposit-${esc(sid)}" name="deposit" type="number" min="0" value="${esc(ev.deposit ?? "")}"></div>
        ${event ? `<div class="field"><p class="kicker">Contract total</p><p>${ev.contract_total != null && ev.contract_total !== "" ? formatMoney(ev.contract_total) : "—"}</p></div>
        <div class="field"><p class="kicker">Collected</p><p>${ev.collected != null && ev.collected !== "" ? formatMoney(ev.collected) : (ev.deposit != null && ev.deposit !== "" ? formatMoney(ev.deposit) : "—")}</p></div>
        <div class="field"><p class="kicker">Balance</p><p>${ev.balance != null && ev.balance !== "" ? formatMoney(ev.balance) : (ev.contract_total != null || ev.fee != null ? formatMoney((Number(ev.contract_total ?? ev.fee) || 0) - (Number(ev.collected ?? ev.deposit) || 0)) : "TBD")}</p></div>
        <p><a href="#/events?sheet=${esc(ev.id)}">Open event sheet</a></p>` : ""}` : ""}
      <div data-form-error></div>
      <div class="row-actions">
        <button class="btn btn-solid" type="submit">${event ? "Save changes" : "Save event"}</button>
        ${event ? `<button class="btn btn-ghost" type="button" data-close-event>Close</button>` : ""}
      </div>
    </form>
  `;
}

function bindEventForm(form, event) {
  if (!form) return;
  form.querySelector("[data-close-event]")?.addEventListener("click", () => {
    window.location.hash = "#/events";
  });
  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const errorBox = form.querySelector("[data-form-error]");
    if (errorBox) errorBox.textContent = "";
    const dataForm = new FormData(form);
    const client = String(dataForm.get("client") || "").trim();
    if (!client) {
      showError(errorBox, "Please enter the client name.");
      form.querySelector("[name=client]")?.focus();
      return;
    }
    const payload = {
      date: dataForm.get("date"), client, title: dataForm.get("title"),
      type: dataForm.get("type"), package: dataForm.get("package"),
      pax: dataForm.get("pax") === "" ? null : Number(dataForm.get("pax")),
      venue: dataForm.get("venue"), status: dataForm.get("status")
    };
    if (currentUser.role === "owner") {
      payload.fee = dataForm.get("fee") === "" ? null : Number(dataForm.get("fee"));
      payload.deposit = dataForm.get("deposit") === "" ? null : Number(dataForm.get("deposit"));
    }
    try {
      if (event) await api(`/api/events/${event.id}`, { method: "PATCH", body: payload });
      else await api("/api/events", { method: "POST", body: payload });
      window.location.hash = "#/events";
      await viewEvents();
    } catch (err) {
      showError(errorBox, err.message);
    }
  });
}

async function viewRequests() {
  const data = await api("/api/requests");
  await refreshPending();
  const cards = (data.requests || []).map((req) => {
    const actions = req.status === "pending"
      ? `<div class="row-actions">
           <button class="btn btn-solid" type="button" data-action="approve" data-id="${esc(req.id)}">Approve</button>
           <button class="btn btn-danger" type="button" data-action="decline" data-id="${esc(req.id)}">Decline</button>
         </div>`
      : (req.decline_reason ? `<p class="muted">Reason: ${esc(req.decline_reason)}</p>` : "");
    return `
      <article class="portal-card">
        <div class="page-head">
          <div>
            <p class="kicker">${esc(formatDate(req.date, { weekday: "long" }))}</p>
            <h2>${esc(req.name)}${sampleMark(req, req.name)}</h2>
          </div>
          <span class="chip chip-${esc(req.status)}">${esc(req.status)}</span>
        </div>
        <p>${esc(req.type || "")}${req.package ? ` · ${esc(req.package)}` : ""} · ${esc(String(req.pax || ""))} guests · ${esc(req.venue || "Any")}</p>
        <p class="muted">${esc(req.contact)}</p>
        <p class="tiny muted">Submitted ${esc(formatDateTime(req.created_at) || "")}</p>
        ${req.notes ? `<p>${esc(req.notes)}</p>` : ""}
        ${actions}
      </article>
    `;
  }).join("") || `<p class="muted">No booking requests yet. They will appear here when someone uses the public calendar.</p>`;
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Inbox</p><h1>Booking requests</h1></div></div>
    <p class="muted">Approve to mark the date as booked and create an event. Decline frees the date again. Pending requests no longer lock the public calendar by themselves.</p>
    <div class="stack-list">${cards}</div>
  `;
}

async function viewSchedule() {
  const data = await api("/api/shifts");
  const events = canAccess(currentUser.role, "events") ? (await api("/api/events").catch(() => ({ events: [] }))).events || [] : [];
  const rows = (data.shifts || []).map((shift) => {
    const who = currentUser.role === "staff" ? "" : `<td>${esc(personName(shift))}${sampleMark(shift, personName(shift))}</td>`;
    const eventLabel = shift.event_title ? `${shift.event_title}${shift.event_venue ? ` · ${shift.event_venue}` : ""}` : "—";
    return `<tr>
      <td>${esc(formatDate(shift.date, { month: "short", weekday: "short" }))}</td>
      ${who}
      <td>${esc(shift.start)}–${esc(shift.end)}</td>
      <td>${esc(shift.role || "")}</td>
      <td>${esc(eventLabel)}</td>
    </tr>`;
  }).join("");
  const whoHead = currentUser.role === "staff" ? "" : "<th>Staff</th>";
  const addForm = currentUser.role === "staff" ? "" : `
    <details class="portal-card">
      <summary>Add a shift</summary>
      <form class="portal-form stack-gap" data-add-shift>
        <div class="field"><label for="sh-date">Date <span class="req">required</span></label><input id="sh-date" name="date" type="date" required></div>
        <div class="field"><label for="sh-staff">Staff <span class="req">required</span></label>
          <select id="sh-staff" name="staffId" required>${usersCache.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label for="sh-start">Start</label><input id="sh-start" name="start" type="time" required></div>
        <div class="field"><label for="sh-end">End</label><input id="sh-end" name="end" type="time" required></div>
        <div class="field"><label for="sh-role">Assignment</label><input id="sh-role" name="role" placeholder="Coordinator"></div>
        <div class="field"><label for="sh-event">Event</label>
          <select id="sh-event" name="eventId"><option value="">None</option>${events.map((item) => `<option value="${esc(item.id)}">${esc(item.date)} · ${esc(item.title || item.client)}</option>`).join("")}</select>
        </div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save shift</button>
      </form>
    </details>`;
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Roster</p><h1>${currentUser.role === "staff" ? "Your schedule" : "Staff schedule"}</h1></div></div>
    ${addForm}
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Date</th>${whoHead}<th>Time</th><th>Assignment</th><th>Event</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5">No shifts yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
  const form = mainEl.querySelector("[data-add-shift]");
  if (form) form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const dataForm = new FormData(form);
    try {
      await api("/api/shifts", { method: "POST", body: {
        date: dataForm.get("date"), staffId: dataForm.get("staffId"),
        start: dataForm.get("start"), end: dataForm.get("end"),
        role: dataForm.get("role"), eventId: dataForm.get("eventId") || null
      }});
      await viewSchedule();
    } catch (err) {
      showError(form.querySelector("[data-form-error]"), err.message);
    }
  });
}

async function viewTasks() {
  const data = await api("/api/tasks");
  const events = canAccess(currentUser.role, "events") ? (await api("/api/events").catch(() => ({ events: [] }))).events || [] : [];
  const rows = (data.tasks || []).map((task) => {
    const who = currentUser.role === "staff" ? "" : `<td>${esc(personName(task))}${sampleMark(task, personName(task))}</td>`;
    const done = task.status === "done";
    return `<tr>
      <td>${task.due ? esc(formatDate(task.due, { month: "short" })) : "—"}</td>
      ${who}
      <td>${esc(task.title)}${sampleMark(task, task.title)}${task.event_title ? `<br><span class="muted">${esc(task.event_title)}</span>` : ""}</td>
      <td><span class="chip chip-${done ? "done" : "open"}">${done ? "Done" : "Open"}</span></td>
      <td><button class="btn btn-ghost" type="button" data-action="toggle-task" data-id="${esc(task.id)}">${done ? "Reopen" : "Mark done"}</button></td>
    </tr>`;
  }).join("");
  const whoHead = currentUser.role === "staff" ? "" : "<th>Staff</th>";
  const addForm = currentUser.role === "staff" ? "" : `
    <details class="portal-card">
      <summary>Add a task</summary>
      <form class="portal-form stack-gap" data-add-task>
        <div class="field"><label for="tk-title">Task <span class="req">required</span></label><input id="tk-title" name="title" required></div>
        <div class="field"><label for="tk-staff">Staff <span class="req">required</span></label>
          <select id="tk-staff" name="staffId" required>${usersCache.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label for="tk-due">Due</label><input id="tk-due" name="due" type="date"></div>
        <div class="field"><label for="tk-event">Event</label>
          <select id="tk-event" name="eventId"><option value="">None</option>${events.map((item) => `<option value="${esc(item.id)}">${esc(item.date)} · ${esc(item.title || item.client)}</option>`).join("")}</select>
        </div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save task</button>
      </form>
    </details>`;
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">To do</p><h1>${currentUser.role === "staff" ? "Your tasks" : "Tasks"}</h1></div></div>
    ${addForm}
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Due</th>${whoHead}<th>Task</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5">No tasks yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
  const form = mainEl.querySelector("[data-add-task]");
  if (form) form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const dataForm = new FormData(form);
    try {
      await api("/api/tasks", { method: "POST", body: {
        title: dataForm.get("title"), staffId: dataForm.get("staffId"),
        due: dataForm.get("due") || "", eventId: dataForm.get("eventId") || null
      }});
      await viewTasks();
    } catch (err) {
      showError(form.querySelector("[data-form-error]"), err.message);
    }
  });
}

async function viewAttendance() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const staff = params.get("staff") || "";
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (staff) query.set("staff", staff);
  const data = await api(`/api/attendance?${query.toString()}`);
  const today = todayISO();
  const myPunch = (data.attendance || []).find((row) => row.staff_id === currentUser.id && row.date === today);
  const whoHead = currentUser.role === "staff" ? "" : "<th>Staff</th>";
  const canCorrect = currentUser.role === "owner" || currentUser.role === "admin";
  const rows = (data.attendance || []).map((row) => `
    <tr>
      <td>${esc(formatDate(row.date, { month: "short", weekday: "short" }))}</td>
      ${currentUser.role === "staff" ? "" : `<td>${esc(personName(row))}${sampleMark(row, personName(row))}</td>`}
      <td>${esc(row.time_in || "—")}</td>
      <td>${esc(row.time_out || "—")}</td>
      ${canCorrect ? `<td><button class="btn btn-ghost" type="button" data-action="correct-attendance" data-id="${esc(row.id)}" data-date="${esc(row.date || "")}" data-in="${esc(row.time_in || "")}" data-out="${esc(row.time_out || "")}">Correct</button></td>` : ""}
    </tr>
  `).join("");
  const staffFilter = currentUser.role === "staff" ? "" : `
    <div class="field">
      <label for="att-staff">Staff</label>
      <select id="att-staff" name="staff">
        <option value="">Everyone</option>
        ${usersCache.map((item) => `<option value="${esc(item.id)}" ${staff === item.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}
      </select>
    </div>`;
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Time log</p><h1>${currentUser.role === "staff" ? "Your attendance" : "Attendance"}</h1></div></div>
    ${clockCard(myPunch)}
    <form class="toolbar" data-att-filters>
      <div class="field"><label for="att-from">From</label><input id="att-from" name="from" type="date" value="${esc(from)}"></div>
      <div class="field"><label for="att-to">To</label><input id="att-to" name="to" type="date" value="${esc(to)}"></div>
      ${staffFilter}
      <button class="btn btn-solid" type="submit">Filter</button>
      ${currentUser.role !== "staff" ? `<button class="btn btn-ghost" type="button" data-action="export-attendance">Export CSV</button>` : ""}
    </form>
    <div class="table-wrap stack-gap">
      <table class="data">
        <thead><tr><th>Date</th>${whoHead}<th>Time in</th><th>Time out</th>${canCorrect ? "<th></th>" : ""}</tr></thead>
        <tbody>${rows || `<tr><td colspan="5">No entries yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
  mainEl.querySelector("[data-att-filters]").addEventListener("submit", (event) => {
    event.preventDefault();
    const dataForm = new FormData(event.target);
    const next = new URLSearchParams();
    if (dataForm.get("from")) next.set("from", dataForm.get("from"));
    if (dataForm.get("to")) next.set("to", dataForm.get("to"));
    if (dataForm.get("staff")) next.set("staff", dataForm.get("staff"));
    window.location.hash = `#/attendance?${next.toString()}`;
  });
}

async function viewFinances() {
  const data = await api("/api/finances");
  const hasSample = (data.events || []).some(isSample);
  const rows = (data.events || []).map((event) => `
    <tr>
      <td>${esc(formatDate(event.date, { month: "short" }))}</td>
      <td>${esc(event.client || "")} · ${esc(event.title || "")}${sampleMark(event, event.client)}</td>
      <td>${formatMoney(event.contract_total ?? event.fee)}</td>
      <td>${formatMoney(event.collected ?? event.deposit)}</td>
      <td>${formatMoney(event.balance)}</td>
    </tr>
  `).join("");
  const totals = data.totals || { fees: 0, collected: 0, deposits: 0, balance: 0 };
  const sampleTotals = data.sampleTotals || { fees: 0, collected: 0, deposits: 0, balance: 0 };
  const collected = totals.collected ?? totals.deposits;
  const sampleCollected = sampleTotals.collected ?? sampleTotals.deposits;
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Owner only</p><h1>Event revenue and balances</h1></div></div>
    <p class="muted">Balance is the contract total minus payments received. Totals below are for real events only. Sample events are listed and totaled separately.</p>
    <div class="card-grid cols-3">
      <article class="portal-card"><p class="kicker">Contract total</p><p class="stat">${formatMoney(totals.fees)}</p></article>
      <article class="portal-card"><p class="kicker">Collected</p><p class="stat">${formatMoney(collected)}</p></article>
      <article class="portal-card"><p class="kicker">Balance</p><p class="stat">${formatMoney(totals.balance)}</p></article>
    </div>
    ${hasSample ? `<p class="muted">Sample totals: ${formatMoney(sampleTotals.fees)} contract · ${formatMoney(sampleCollected)} collected · ${formatMoney(sampleTotals.balance)} balance. These are not included in the cards above.</p>` : ""}
    <div class="table-wrap stack-gap">
      <table class="data">
        <thead><tr><th>Date</th><th>Event</th><th>Contract</th><th>Collected</th><th>Balance</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5">No figures yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

async function viewReports() {
  const tables = [
    { id: "events", label: "Events" },
    { id: "requests", label: "Booking requests" },
    { id: "attendance", label: "Attendance" }
  ];
  if (currentUser.role === "owner") {
    tables.push(
      { id: "finances", label: "Finances" },
      { id: "leads", label: "Leads" },
      { id: "quotes", label: "Quotes" },
      { id: "payments", label: "Payments" },
      { id: "expenses", label: "Expenses" },
      { id: "inventory", label: "Inventory" },
      { id: "housekeeping", label: "Housekeeping" }
    );
  } else if (currentUser.role === "admin") {
    tables.push({ id: "leads", label: "Leads" }, { id: "inventory", label: "Inventory" }, { id: "housekeeping", label: "Housekeeping" });
  }
  const eventsData = await api("/api/events?limit=200").catch(() => ({ events: [] }));
  const events = eventsData.events || [];
  const hasSample = events.some(isSample);
  const preview = events.slice(0, 40).map((event) => `
    <tr>
      <td>${esc(formatDate(event.date, { month: "short" }))}</td>
      <td>${esc(event.client || event.title || "")}${sampleMark(event, event.client)}</td>
      <td>${esc(event.venue || "—")}</td>
      <td><span class="chip">${esc(event.status || "")}</span></td>
    </tr>
  `).join("");
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Exports</p><h1>Reports</h1></div></div>
    <p class="muted">${hasSample
      ? "Sample rows are included in downloads and marked SAMPLE, so you can see the demo. A Sample column is added to the file. They come out of the files once sample data is removed."
      : "Download a spreadsheet of current records."}</p>
    ${currentUser.role === "owner" ? `<p class="muted">For a live Google Sheet later, an Apps Script can pull the same files using a key stored in Script Properties, not in the sheet itself.</p>` : ""}
    <div class="stack-list">
      ${tables.map((item) => `
        <article class="portal-card row-actions">
          <div><h2>${esc(item.label)}</h2></div>
          <button class="btn btn-solid" type="button" data-action="download-report" data-table="${esc(item.id)}" data-format="csv">CSV</button>
          <button class="btn btn-ghost" type="button" data-action="download-report" data-table="${esc(item.id)}" data-format="xlsx">Excel</button>
        </article>
      `).join("")}
    </div>
    <h2 class="stack-gap">Events in this report</h2>
    ${events.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Date</th><th>Client</th><th>Venue</th><th>Status</th></tr></thead>
      <tbody>${preview}</tbody>
    </table></div>` : `<p class="muted">No events to list yet.</p>`}
    <p class="form-error" data-report-error hidden></p>
  `;
}


async function viewAnnouncements() {
  const data = await api("/api/announcements");
  const items = (data.announcements || []).map((item) => `
    <article class="portal-card">
      <p class="kicker">${esc(formatDate(item.date, { month: "short" }))}</p>
      <h2>${esc(item.title)}${sampleMark(item, item.title)}</h2>
      <p>${esc(item.body)}</p>
    </article>
  `).join("") || `<p class="muted">No announcements yet.</p>`;
  const compose = currentUser.role === "staff" ? "" : `
    <details class="portal-card">
      <summary>New announcement</summary>
      <form class="portal-form stack-gap" data-add-announcement>
        <div class="field"><label for="an-title">Title <span class="req">required</span></label><input id="an-title" name="title" required></div>
        <div class="field"><label for="an-body">Message <span class="req">required</span></label><textarea id="an-body" name="body" required></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Post</button>
      </form>
    </details>
  `;
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Notice board</p><h1>Announcements</h1></div></div>
    ${compose}
    <div class="stack-list stack-gap">${items}</div>
  `;
  const form = mainEl.querySelector("[data-add-announcement]");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const dataForm = new FormData(form);
      try {
        await api("/api/announcements", { method: "POST", body: { title: dataForm.get("title"), body: dataForm.get("body") } });
        await viewAnnouncements();
      } catch (err) {
        showError(form.querySelector("[data-form-error]"), err.message);
      }
    });
  }
}

async function viewUsers() {
  const data = await api("/api/users");
  const people = data.users || data.people || [];
  const rows = people.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}${sampleMark(item)}</td>
      <td>${escapeHtml(item.email)}</td>
      <td>${escapeHtml(item.title || "")}</td>
      <td>
        <label class="sr-only" for="role-${escapeHtml(item.id)}">Role for ${escapeHtml(item.name)}</label>
        <select id="role-${escapeHtml(item.id)}" data-action="set-role" data-id="${escapeHtml(item.id)}">
          <option value="owner" ${item.role === "owner" ? "selected" : ""}>Owner</option>
          <option value="admin" ${item.role === "admin" ? "selected" : ""}>Admin</option>
          <option value="staff" ${item.role === "staff" ? "selected" : ""}>Staff</option>
        </select>
      </td>
    </tr>
  `).join("");
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Owner only</p><h1>Users</h1></div></div>
    <p class="muted">Add a staff or admin account and share the password with them yourself. They will be asked to change it after they sign in. There is no email invite yet.</p>
    <p class="row-actions"><button class="btn btn-ghost" type="button" data-action="logout-all">Sign out everywhere</button></p>
    <details class="portal-card">
      <summary>Add a user</summary>
      <form class="portal-form stack-gap" data-add-user>
        <div class="field"><label for="u-name">Name</label><input id="u-name" name="name" required></div>
        <div class="field"><label for="u-email">Email</label><input id="u-email" name="email" type="email" required></div>
        <div class="field"><label for="u-title">Title</label><input id="u-title" name="title"></div>
        <div class="field"><label for="u-role">Role</label>
          <select id="u-role" name="role"><option value="staff">Staff</option><option value="admin">Admin</option><option value="owner">Owner</option></select>
        </div>
        <div class="field"><label for="u-password">Temporary password</label><input id="u-password" name="password" type="password" required minlength="10">
          <p class="tiny muted">At least 10 characters, with letters and numbers. Share it with them privately.</p>
        </div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save user</button>
      </form>
    </details>
    <div class="table-wrap stack-gap">
      <table class="data">
        <thead><tr><th>Name</th><th>Email</th><th>Title</th><th>Role</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  const form = mainEl.querySelector("[data-add-user]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const dataForm = new FormData(form);
    try {
      await api("/api/users", {
        method: "POST",
        body: {
          name: dataForm.get("name"),
          email: dataForm.get("email"),
          title: dataForm.get("title"),
          role: dataForm.get("role"),
          password: dataForm.get("password")
        }
      });
      await viewUsers();
    } catch (err) {
      showError(form.querySelector("[data-form-error]"), err.message);
    }
  });
}

mainEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === "remove-sample") {
      window.location.hash = "#/settings";
      return;
    }
    if (action === "clock") {
      await api("/api/attendance/clock", { method: "POST", body: {} });
      await renderRoute();
    }
    if (action === "approve" || action === "decline") {
      const body = { decision: action === "approve" ? "approved" : "declined" };
      if (action === "decline") {
        const reason = await openModal({
          title: "Decline this request?",
          message: "Please enter a reason of at least 3 characters.",
          confirmLabel: "Decline",
          danger: true,
          input: { label: "Reason", name: "reason", required: true, min: 3, error: "Please enter a reason of at least 3 characters." }
        });
        if (reason == null) return;
        body.reason = String(reason).trim();
      } else {
        const ok = await confirmAction(
          "Approve this request?",
          "An event will be added, and the date will show as booked on the public calendar.",
          "Approve"
        );
        if (!ok) return;
      }
      await api(`/api/requests/${button.dataset.id}/decide`, { method: "POST", body });
      await refreshPending();
      await renderRoute();
      return;
    }
    if (action === "edit-event") {
      const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
      params.set("edit", button.dataset.id);
      window.location.hash = `#/events?${params.toString()}`;
      return;
    }
    if (action === "cancel-event") {
      const ok = await confirmAction("Cancel this event?", "If no other event is holding the same date and venue, the date will become available again.", "Cancel event");
      if (!ok) return;
      await api(`/api/events/${button.dataset.id}`, { method: "PATCH", body: { status: "Cancelled" } });
      await renderRoute();
      return;
    }
    if (action === "filter-events") {
      const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
      params.set("range", button.dataset.range || "all");
      params.delete("edit");
      window.location.hash = `#/events?${params.toString()}`;
      return;
    }
    if (action === "toggle-task") {
      await api(`/api/tasks/${button.dataset.id}`, { method: "PATCH", body: {} });
      await renderRoute();
      return;
    }
    if (action === "correct-attendance") {
      const values = await openModal({
        title: "Correct attendance",
        message: "Use 24-hour times (HH:MM). Leave time out blank if the day is still open.",
        confirmLabel: "Save correction",
        fields: [
          { name: "time_in", label: "Time in", value: button.dataset.in || "", required: true, error: "Please enter the time in." },
          { name: "time_out", label: "Time out", value: button.dataset.out || "" },
          { name: "note", label: "Reason", required: true, min: 3, error: "Please enter a reason of at least 3 characters." }
        ]
      });
      if (values == null) return;
      await api(`/api/attendance/${button.dataset.id}`, {
        method: "PATCH",
        body: { time_in: values.time_in.trim(), time_out: (values.time_out || "").trim(), note: values.note.trim() }
      });
      await renderRoute();
      return;
    }
    if (action === "export-attendance") {
      await downloadReport("attendance", "csv");
      return;
    }
    if (action === "download-report") {
      const errEl = mainEl.querySelector("[data-report-error]");
      try {
        if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
        await downloadReport(button.dataset.table, button.dataset.format);
      } catch (err) {
        if (errEl) { errEl.hidden = false; errEl.textContent = err.message; }
        else await openModal({ title: "Download failed", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
      }
      return;
    }
    if (action === "logout-all") {
      const ok = await confirmAction("Sign out everywhere?", "This will sign out this account on every device, including this one.", "Sign out everywhere");
      if (!ok) return;
      await api("/api/auth/logout-all", { method: "POST", body: {} });
      clearToken();
      currentUser = null;
      window.location.hash = "";
      renderLogin("You have been signed out everywhere. Please sign in again.");
      return;
    }
  } catch (err) {
    await openModal({ title: "Something went wrong", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
  }
});

mainEl.addEventListener("change", async (event) => {
  const select = event.target.closest("select[data-action='set-role']");
  if (!select) return;
  try {
    await api(`/api/users/${select.dataset.id}`, { method: "PATCH", body: { role: select.value } });
    await loadUsers();
  } catch (err) {
    await openModal({ title: "Could not update the role", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
    await renderRoute();
  }
});

document.querySelector("[data-account-toggle]")?.addEventListener("click", (event) => {
  event.stopPropagation();
  const menu = document.querySelector("[data-account-menu]");
  setAccountMenu(Boolean(menu && menu.hidden));
});
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".portal-user")) setAccountMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setAccountMenu(false);
});

document.querySelector("[data-logout]").addEventListener("click", () => {
  signOut({ everywhere: false });
});

document.querySelector("[data-logout-all]")?.addEventListener("click", async () => {
  const ok = await confirmAction("Sign out everywhere?", "This will sign out this account on every device, including this one.", "Sign out everywhere");
  if (!ok) return;
  signOut({ everywhere: true });
});

navToggle.addEventListener("click", () => setNavOpen(navEl.hidden));
navEl.addEventListener("click", (event) => {
  if (event.target.closest("a") && !isWide()) setNavOpen(false);
});
window.addEventListener("hashchange", () => {
  if (isSetupView()) renderSetup();
  else if (currentUser) renderRoute();
  else boot();
});
window.addEventListener("resize", () => setNavOpen(isWide()));

boot();
