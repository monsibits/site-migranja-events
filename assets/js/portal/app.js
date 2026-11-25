import { api, escapeHtml, formatDate, formatMoney, todayISO } from "./api.js";

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
  finances: ["owner"],
  users: ["owner"]
};

let currentUser = null;
let pendingCount = 0;
let usersCache = [];

function canAccess(role, route) {
  return (ROUTES[route] || []).includes(role);
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
    { route: "finances", label: "Finances" },
    { route: "users", label: "Users" }
  ].filter((item) => canAccess(role, item.route));
}

function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Staff";
}

function currentRoute() {
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
  if (!currentUser || currentUser.role === "staff") {
    usersCache = [];
    return;
  }
  if (currentUser.role === "owner") {
    const data = await api("/api/users");
    usersCache = data.users || [];
  }
}

function userName(id) {
  const found = usersCache.find((item) => item.id === id);
  return found ? found.name : "";
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
      currentUser = result.user;
      go("dashboard");
      await bootApp();
    } catch (err) {
      showError(errorBox, err.message);
    }
  });
}

function renderLogin(message = "") {
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
      <div data-form-error>${message ? `<p class="form-error">${escapeHtml(message)}</p>` : ""}</div>
      <button class="btn btn-solid" type="submit">Sign in</button>
    </form>
  `;
  const form = loginScreen.querySelector("[data-login-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: { email: data.get("email"), password: data.get("password") }
      });
      currentUser = result.user;
      go("dashboard");
      await bootApp();
    } catch (err) {
      showError(form.querySelector("[data-form-error]"), err.message);
    }
  });
}

async function boot() {
  if (isSetupView()) {
    renderSetup();
    return;
  }
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
    await bootApp();
  } catch {
    currentUser = null;
    renderLogin();
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
      await api("/api/auth/password", {
        method: "POST",
        body: { current: data.get("current"), next: data.get("next") }
      });
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
  setNavOpen(isWide());
  try {
    await Promise.all([refreshPending(), loadUsers().catch(() => { usersCache = []; })]);
  } catch {
    /* ignore */
  }
  renderNav();
  await renderRoute();
}

async function renderRoute() {
  const route = currentRoute();
  if (route === "setup") return;
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
  const views = {
    dashboard: viewDashboard,
    events: viewEvents,
    requests: viewRequests,
    schedule: viewSchedule,
    tasks: viewTasks,
    attendance: viewAttendance,
    announcements: viewAnnouncements,
    finances: viewFinances,
    users: viewUsers
  };
  try {
    await (views[route] || viewDashboard)();
  } catch (err) {
    if (err.status === 401) {
      currentUser = null;
      renderLogin("Your session has ended. Please sign in again.");
      return;
    }
    mainEl.innerHTML = `<div class="portal-card"><p class="form-error">${escapeHtml(err.message)}</p></div>`;
  }
  renderNav();
}

function clockCard(punch, extra = "") {
  const open = punch && punch.time_in && !punch.time_out;
  const status = !punch
    ? "You have not timed in today."
    : open
      ? `Timed in at ${punch.time_in}.`
      : `Shift closed: ${punch.time_in}–${punch.time_out}.`;
  const action = open ? "Time out" : "Time in";
  return `
    <article class="portal-card clock-card">
      <div>
        <p class="kicker">Today · ${formatDate(todayISO(), { weekday: "long" })}</p>
        <p class="stat">${escapeHtml(status)}</p>
        ${extra}
      </div>
      <button class="btn btn-solid" type="button" data-action="clock">${action}</button>
    </article>
  `;
}

async function viewDashboard() {
  const today = todayISO();
  const [shiftsData, tasksData, eventsData] = await Promise.all([
    api("/api/shifts"),
    api("/api/tasks"),
    canAccess(currentUser.role, "events") ? api("/api/events") : Promise.resolve({ events: [] })
  ]);
  const attendanceData = await api("/api/attendance");
  const punch = (attendanceData.attendance || []).find((row) => row.date === today && row.staff_id === currentUser.id)
    || (attendanceData.attendance || []).find((row) => row.date === today);
  const myPunch = (attendanceData.attendance || []).find((row) => row.staff_id === currentUser.id && row.date === today);
  const shifts = (shiftsData.shifts || []).filter((shift) => shift.date >= today).slice(0, 4);
  const tasks = (tasksData.tasks || []).filter((task) => task.status === "open").slice(0, 4);
  const upcoming = (eventsData.events || []).filter((event) => event.date >= today);

  const management = currentUser.role === "staff"
    ? ""
    : `
      <article class="portal-card">
        <p class="kicker">Booking requests</p>
        <p class="stat">${pendingCount} pending</p>
        <p><a href="#/requests">Review inbox</a></p>
      </article>
      <article class="portal-card">
        <p class="kicker">Upcoming events</p>
        <p class="stat">${upcoming.length}</p>
        <p class="muted tiny">${upcoming[0] ? `Next: ${formatDate(upcoming[0].date, { month: "short" })}` : "None yet"}</p>
      </article>
    `;

  mainEl.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Welcome back</p>
        <h1>${escapeHtml(currentUser.name)}</h1>
      </div>
    </div>
    ${clockCard(myPunch)}
    <div class="card-grid cols-3 stack-gap">${management}</div>
    <div class="card-grid cols-2 stack-gap">
      <section>
        <h2>Upcoming shifts</h2>
        ${shifts.length ? `<ul class="stack-list">${shifts.map((shift) => {
          const who = currentUser.role === "staff" ? shift.role : `${userName(shift.staff_id) || ""} · ${shift.role || ""}`;
          return `<li class="portal-card"><strong>${formatDate(shift.date, { month: "short" })}</strong><p class="muted">${escapeHtml(who)} · ${escapeHtml(shift.start)}–${escapeHtml(shift.end)}</p></li>`;
        }).join("")}</ul>` : `<p class="muted">No upcoming shifts yet.</p>`}
      </section>
      <section>
        <h2>Open tasks</h2>
        ${tasks.length ? `<ul class="stack-list">${tasks.map((task) => `<li class="portal-card"><strong>${escapeHtml(task.title)}</strong><p class="muted">${task.due ? `Due ${formatDate(task.due, { month: "short" })}` : "No due date"}</p></li>`).join("")}</ul>` : `<p class="muted">No open tasks.</p>`}
      </section>
    </div>
  `;
}

async function viewEvents() {
  const data = await api("/api/events");
  const rows = (data.events || []).map((event) => `
    <tr>
      <td>${formatDate(event.date, { month: "short", weekday: "short" })}</td>
      <td>${escapeHtml(event.client || "—")}<br><span class="muted">${escapeHtml(event.title || "")}</span></td>
      <td>${escapeHtml(event.package || "—")}</td>
      <td>${event.pax || "—"}</td>
      <td>${escapeHtml(event.venue || "—")}</td>
      <td><span class="chip chip-${escapeHtml(String(event.status || "").toLowerCase())}">${escapeHtml(event.status || "")}</span></td>
    </tr>
  `).join("");
  mainEl.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Operations</p>
        <h1>Events</h1>
      </div>
    </div>
    <details class="portal-card">
      <summary>Add an event</summary>
      <form class="portal-form stack-gap" data-add-event>
        <div class="field"><label for="ev-date">Date</label><input id="ev-date" name="date" type="date" required></div>
        <div class="field"><label for="ev-client">Client</label><input id="ev-client" name="client" type="text" required></div>
        <div class="field"><label for="ev-title">Title</label><input id="ev-title" name="title" type="text" required></div>
        <div class="field"><label for="ev-type">Type</label>
          <select id="ev-type" name="type">
            <option>Wedding</option><option>Debut</option><option>Birthday</option>
            <option>Christening</option><option>Corporate</option><option>Other</option>
          </select>
        </div>
        <div class="field"><label for="ev-package">Package</label><input id="ev-package" name="package" type="text"></div>
        <div class="field"><label for="ev-pax">Pax</label><input id="ev-pax" name="pax" type="number" min="1" max="500"></div>
        <div class="field"><label for="ev-venue">Venue</label>
          <select id="ev-venue" name="venue">
            <option>Ballroom</option><option>The Nook</option><option>Amore Garden</option>
          </select>
        </div>
        <div class="field"><label for="ev-status">Status</label>
          <select id="ev-status" name="status">
            <option>Confirmed</option><option>Tentative</option><option>Setup</option>
          </select>
        </div>
        <div class="field"><label for="ev-fee">Fee (optional)</label><input id="ev-fee" name="fee" type="number" min="0"></div>
        <div class="field"><label for="ev-deposit">Deposit (optional)</label><input id="ev-deposit" name="deposit" type="number" min="0"></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save event</button>
      </form>
    </details>
    <div class="table-wrap stack-gap">
      <table class="data">
        <thead><tr><th>Date</th><th>Client</th><th>Package</th><th>Pax</th><th>Venue</th><th>Status</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6">No events yet. Add one, or approve a booking request.</td></tr>`}</tbody>
      </table>
    </div>
  `;
  const form = mainEl.querySelector("[data-add-event]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const dataForm = new FormData(form);
    try {
      await api("/api/events", {
        method: "POST",
        body: {
          date: dataForm.get("date"),
          client: dataForm.get("client"),
          title: dataForm.get("title"),
          type: dataForm.get("type"),
          package: dataForm.get("package"),
          pax: Number(dataForm.get("pax")) || 0,
          venue: dataForm.get("venue"),
          status: dataForm.get("status"),
          fee: dataForm.get("fee") === "" ? null : Number(dataForm.get("fee")),
          deposit: dataForm.get("deposit") === "" ? null : Number(dataForm.get("deposit"))
        }
      });
      await viewEvents();
    } catch (err) {
      showError(form.querySelector("[data-form-error]"), err.message);
    }
  });
}

async function viewRequests() {
  const data = await api("/api/requests");
  await refreshPending();
  const cards = (data.requests || []).map((req) => {
    const actions = req.status === "pending"
      ? `<div class="row-actions">
           <button class="btn btn-solid" type="button" data-action="approve" data-id="${escapeHtml(req.id)}">Approve</button>
           <button class="btn btn-danger" type="button" data-action="decline" data-id="${escapeHtml(req.id)}">Decline</button>
         </div>`
      : "";
    return `
      <article class="portal-card">
        <div class="page-head">
          <div>
            <p class="kicker">${formatDate(req.date, { weekday: "long" })}</p>
            <h2>${escapeHtml(req.name)}</h2>
          </div>
          <span class="chip chip-${escapeHtml(req.status)}">${escapeHtml(req.status)}</span>
        </div>
        <p>${escapeHtml(req.type || "")} · ${escapeHtml(String(req.pax || ""))} guests · ${escapeHtml(req.venue || "Any")}</p>
        <p class="muted">${escapeHtml(req.contact)}</p>
        ${req.notes ? `<p>${escapeHtml(req.notes)}</p>` : ""}
        ${actions}
      </article>
    `;
  }).join("") || `<p class="muted">No booking requests yet. They will appear here when someone uses the public calendar.</p>`;
  mainEl.innerHTML = `
    <div class="page-head">
      <div>
        <p class="kicker">Inbox</p>
        <h1>Booking requests</h1>
      </div>
    </div>
    <p class="muted">Approve to mark the date as booked and create an event. Decline frees the date again.</p>
    <div class="stack-list">${cards}</div>
  `;
}

async function viewSchedule() {
  const data = await api("/api/shifts");
  const rows = (data.shifts || []).map((shift) => {
    const who = currentUser.role === "staff" ? "" : `<td>${escapeHtml(userName(shift.staff_id) || "")}</td>`;
    return `<tr>
      <td>${formatDate(shift.date, { month: "short", weekday: "short" })}</td>
      ${who}
      <td>${escapeHtml(shift.start)}–${escapeHtml(shift.end)}</td>
      <td>${escapeHtml(shift.role || "")}</td>
    </tr>`;
  }).join("");
  const whoHead = currentUser.role === "staff" ? "" : "<th>Staff</th>";
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Roster</p><h1>${currentUser.role === "staff" ? "Your schedule" : "Staff schedule"}</h1></div></div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Date</th>${whoHead}<th>Time</th><th>Assignment</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4">No shifts yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

async function viewTasks() {
  const data = await api("/api/tasks");
  const rows = (data.tasks || []).map((task) => {
    const who = currentUser.role === "staff" ? "" : `<td>${escapeHtml(userName(task.staff_id) || "")}</td>`;
    const done = task.status === "done";
    return `<tr>
      <td>${task.due ? formatDate(task.due, { month: "short" }) : "—"}</td>
      ${who}
      <td>${escapeHtml(task.title)}</td>
      <td><span class="chip chip-${done ? "done" : "open"}">${done ? "Done" : "Open"}</span></td>
      <td><button class="btn btn-ghost" type="button" data-action="toggle-task" data-id="${escapeHtml(task.id)}">${done ? "Reopen" : "Mark done"}</button></td>
    </tr>`;
  }).join("");
  const whoHead = currentUser.role === "staff" ? "" : "<th>Staff</th>";
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">To do</p><h1>${currentUser.role === "staff" ? "Your tasks" : "Tasks"}</h1></div></div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Due</th>${whoHead}<th>Task</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5">No tasks yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

async function viewAttendance() {
  const data = await api("/api/attendance");
  const today = todayISO();
  const myPunch = (data.attendance || []).find((row) => row.staff_id === currentUser.id && row.date === today);
  const whoHead = currentUser.role === "staff" ? "" : "<th>Staff</th>";
  const rows = (data.attendance || []).map((row) => `
    <tr>
      <td>${formatDate(row.date, { month: "short", weekday: "short" })}</td>
      ${currentUser.role === "staff" ? "" : `<td>${escapeHtml(userName(row.staff_id) || "")}</td>`}
      <td>${escapeHtml(row.time_in || "—")}</td>
      <td>${escapeHtml(row.time_out || "—")}</td>
    </tr>
  `).join("");
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Time log</p><h1>${currentUser.role === "staff" ? "Your attendance" : "Attendance"}</h1></div></div>
    ${clockCard(myPunch)}
    <div class="table-wrap stack-gap">
      <table class="data">
        <thead><tr><th>Date</th>${whoHead}<th>Time in</th><th>Time out</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4">No entries yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

async function viewAnnouncements() {
  const data = await api("/api/announcements");
  const items = (data.announcements || []).map((item) => `
    <article class="portal-card">
      <p class="kicker">${formatDate(item.date, { month: "short" })}</p>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.body)}</p>
    </article>
  `).join("") || `<p class="muted">No announcements yet.</p>`;
  const compose = currentUser.role === "staff" ? "" : `
    <details class="portal-card">
      <summary>New announcement</summary>
      <form class="portal-form stack-gap" data-add-announcement>
        <div class="field"><label for="an-title">Title</label><input id="an-title" name="title" required></div>
        <div class="field"><label for="an-body">Message</label><textarea id="an-body" name="body" required></textarea></div>
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

async function viewFinances() {
  const data = await api("/api/finances");
  const rows = (data.events || []).map((event) => `
    <tr>
      <td>${formatDate(event.date, { month: "short" })}</td>
      <td>${escapeHtml(event.client || "")} · ${escapeHtml(event.title || "")}</td>
      <td>${formatMoney(event.fee)}</td>
      <td>${formatMoney(event.deposit)}</td>
      <td>${event.fee ? formatMoney((event.fee || 0) - (event.deposit || 0)) : "TBD"}</td>
    </tr>
  `).join("");
  const totals = data.totals || { fees: 0, deposits: 0, balance: 0 };
  mainEl.innerHTML = `
    <div class="page-head"><div><p class="kicker">Owner only</p><h1>Event revenue and deposits</h1></div></div>
    <div class="card-grid cols-3">
      <article class="portal-card"><p class="kicker">Fees</p><p class="stat">${formatMoney(totals.fees)}</p></article>
      <article class="portal-card"><p class="kicker">Deposits</p><p class="stat">${formatMoney(totals.deposits)}</p></article>
      <article class="portal-card"><p class="kicker">Balance</p><p class="stat">${formatMoney(totals.balance)}</p></article>
    </div>
    <div class="table-wrap stack-gap">
      <table class="data">
        <thead><tr><th>Date</th><th>Event</th><th>Fee</th><th>Deposit</th><th>Balance</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5">No fee figures yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

async function viewUsers() {
  await loadUsers();
  const rows = usersCache.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
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
    if (action === "clock") {
      await api("/api/attendance/clock", { method: "POST", body: {} });
      await renderRoute();
    }
    if (action === "approve" || action === "decline") {
      const ok = window.confirm(action === "approve"
        ? "Approve this request? The date will become booked and an event will be added."
        : "Decline this request? The date will become available again.");
      if (!ok) return;
      await api(`/api/requests/${button.dataset.id}/decide`, {
        method: "POST",
        body: { decision: action === "approve" ? "approved" : "declined" }
      });
      await refreshPending();
      await renderRoute();
    }
    if (action === "toggle-task") {
      await api(`/api/tasks/${button.dataset.id}`, { method: "PATCH", body: {} });
      await renderRoute();
    }
  } catch (err) {
    window.alert(err.message);
  }
});

mainEl.addEventListener("change", async (event) => {
  const select = event.target.closest("select[data-action='set-role']");
  if (!select) return;
  try {
    await api(`/api/users/${select.dataset.id}`, { method: "PATCH", body: { role: select.value } });
    await loadUsers();
  } catch (err) {
    window.alert(err.message);
    await renderRoute();
  }
});

document.querySelector("[data-logout]").addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST", body: {} }); } catch { /* ignore */ }
  currentUser = null;
  window.location.hash = "";
  renderLogin();
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
