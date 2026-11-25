/**
 * Operations module screens for the staff portal.
 * Phone-first cards and a compact header already come from portal.css / app.js.
 */
import { api, downloadReport, escapeHtml, formatDate, formatMoney, todayISO } from "./api.js";

const esc = escapeHtml;

const ctx = {
  user: null,
  main: null,
  users: [],
  go: () => {}
};

export function setModuleContext(next) {
  Object.assign(ctx, next);
}

function role() {
  return (ctx.user && ctx.user.role) || "staff";
}
function isOwner() { return role() === "owner"; }
function canWrite(resource) {
  if (resource === "sales" || resource === "housekeeping") return role() === "owner" || role() === "admin";
  if (resource === "inventory") return role() === "owner" || role() === "admin";
  if (resource === "hr") return role() === "owner" || role() === "admin";
  if (resource === "accounting" || resource === "payroll") return role() === "owner";
  return isOwner();
}

export function isSample(row) {
  return !!(row && (row.is_sample === 1 || row.is_sample === true));
}

export function sampleChip(row) {
  return isSample(row) ? ' <span class="sample-chip">SAMPLE</span>' : "";
}

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return formatMoney(value);
}

function params() {
  return new URLSearchParams((window.location.hash.split("?")[1] || "").replace(/^\?/, ""));
}

function tabLink(route, id, label, current) {
  const active = current === id ? ' aria-current="page"' : "";
  return `<a class="btn btn-ghost" href="#/${route}?tab=${encodeURIComponent(id)}"${active}>${esc(label)}</a>`;
}

function tabBar(route, items, current) {
  return `<div class="filter-tabs module-tabs" role="tablist">${items.map((item) => tabLink(route, item.id, item.label, current)).join("")}</div>`;
}

function emptyState(title, text) {
  return `<div class="empty-state portal-card"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p></div>`;
}

function pageHead(kicker, title, sub = "") {
  return `<div class="page-head"><div><p class="kicker">${esc(kicker)}</p><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div></div>`;
}

function optionList(items, value, labelFn) {
  return (items || []).map((item) => {
    const id = item.id || item.item_id || item;
    const label = labelFn ? labelFn(item) : (item.name || item.label || item);
    return `<option value="${esc(id)}" ${String(value || "") === String(id) ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");
}

function showError(box, message) {
  if (!box) return;
  box.hidden = false;
  box.classList.add("form-error");
  box.textContent = message;
}

export function openModal({ title, message, confirmLabel = "OK", cancelLabel = "Cancel", danger = false, input = null, fields = null }) {
  const fieldList = fields || (input ? [{ ...input, name: input.name || "value" }] : null);
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "mg-modal-backdrop";
    const fieldsHtml = (fieldList || []).map((field, index) => `
        <div class="field">
          <label for="mg-modal-input-${index}">${esc(field.label || "")}</label>
          <input id="mg-modal-input-${index}" name="${esc(field.name || "value")}" type="${esc(field.type || "text")}" value="${esc(field.value || "")}" ${field.required ? "required" : ""} placeholder="${esc(field.placeholder || "")}">
        </div>`).join("");
    backdrop.innerHTML = `
      <div class="mg-modal" role="dialog" aria-modal="true" aria-labelledby="mg-modal-title">
        <h2 id="mg-modal-title">${esc(title)}</h2>
        ${message ? `<p>${esc(message)}</p>` : ""}
        ${fieldsHtml}
        <p class="form-error" data-modal-error hidden></p>
        <div class="mg-modal__actions">
          <button class="btn btn-ghost" type="button" data-modal-cancel>${esc(cancelLabel)}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-solid"}" type="button" data-modal-ok>${esc(confirmLabel)}</button>
        </div>
      </div>`;
    const finish = (value) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onKey = (event) => { if (event.key === "Escape") finish(null); };
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
    });
    backdrop.querySelector("[data-modal-cancel]").addEventListener("click", () => finish(null));
    backdrop.querySelector("[data-modal-ok]").addEventListener("click", () => {
      if (!fieldList) return finish(true);
      const error = backdrop.querySelector("[data-modal-error]");
      const values = {};
      for (let index = 0; index < fieldList.length; index++) {
        const field = fieldList[index];
        const el = backdrop.querySelector(`#mg-modal-input-${index}`);
        const value = el.value.trim();
        if (field.required && value.length < (field.min || 1)) {
          showError(error, field.error || "Please fill this in.");
          el.focus();
          return;
        }
        values[field.name || "value"] = value;
      }
      finish(fieldList.length === 1 ? values[fieldList[0].name || "value"] : values);
    });
    document.addEventListener("keydown", onKey);
    document.body.append(backdrop);
    const focus = backdrop.querySelector("#mg-modal-input") || backdrop.querySelector("[data-modal-ok]");
    focus?.focus();
  });
}

export function confirmAction(title, message, confirmLabel = "Confirm") {
  return openModal({ title, message, confirmLabel });
}

export function printDocument(opts, innerHtml) {
  const isObj = opts && typeof opts === "object";
  const title = isObj ? (opts.title || "Document") : opts;
  let html = isObj ? (opts.html || innerHtml) : innerHtml;
  if (isObj && !html) {
    const rows = (opts.rows || []).map((pair) => `<tr><th>${esc(pair[0])}</th><td>${esc(pair[1])}</td></tr>`).join("");
    html = `${opts.kicker ? `<p class="muted">${esc(opts.kicker)}</p>` : ""}<h1>${esc(opts.heading || title)}</h1>${opts.body || ""}${rows ? `<table>${rows}</table>` : ""}`;
  }
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) {
    openModal({ title: "Pop-up blocked", message: "Please allow pop-ups to print this document.", confirmLabel: "OK", cancelLabel: "Close" });
    return;
  }
  win.document.write(`<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #2b1d14; margin: 0; padding: 1.5rem; background: #fff; }
    .doc { max-width: 40rem; margin: 0 auto; }
    img.logo { width: 7rem; height: auto; }
    h1 { font-size: 1.4rem; margin: 0.4rem 0 0.2rem; }
    .muted { color: #6b5a4e; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border-bottom: 1px solid #e6d8cc; text-align: left; padding: 0.4rem 0.2rem; }
    th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .total { font-weight: 700; }
    .actions { margin-top: 1.5rem; }
    @media print { .actions { display: none; } body { padding: 0; } }
  </style>
</head><body>
  <div class="doc">
    <img class="logo" src="/assets/img/logo.webp" alt="Mi Granja Events and Leisure Inc.">
    ${html}
    <p class="muted">Mi Granja Events and Leisure Inc. · Balagbag, Indang, Cavite · sales@migranjaevents.com</p>
    <p class="actions"><button type="button" onclick="window.print()">Print</button></p>
  </div>
</body></html>`);
  win.document.close();
}

export function svgChart(rows, series) {
  const width = 640;
  const height = 220;
  const pad = { l: 44, r: 12, t: 16, b: 36 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(1, ...rows.flatMap((row) => series.map((s) => Number(row[s.key]) || 0)));
  const barW = innerW / Math.max(rows.length, 1);
  const colors = { revenue: "#6b3f2a", expenses: "#c4894a", sample: "#b9a394" };
  const bars = rows.map((row, i) => series.map((s, si) => {
    const value = Number(row[s.key]) || 0;
    const h = (value / max) * innerH;
    const x = pad.l + i * barW + 4 + si * ((barW - 8) / series.length);
    const y = pad.t + innerH - h;
    const w = Math.max(2, (barW - 8) / series.length - 2);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${s.color || colors[s.key] || "#6b3f2a"}" rx="1.5">
      <title>${esc(s.label)} ${esc(row.label || row.month || "")}: ${esc(money(value))}</title></rect>`;
  }).join("")).join("");
  const labels = rows.map((row, i) => {
    const x = pad.l + i * barW + barW / 2;
    const text = String(row.label || row.month || "").replace(/^\d{4}-/, "");
    return `<text x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#6b5a4e">${esc(text)}</text>`;
  }).join("");
  const ticks = [0, 0.5, 1].map((t) => {
    const y = pad.t + innerH * (1 - t);
    const val = Math.round(max * t);
    return `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}" stroke="#eadfd4" />
      <text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#6b5a4e">${val >= 1000 ? `${Math.round(val / 1000)}k` : val}</text>`;
  }).join("");
  const legend = series.map((s, i) => `<span class="chart-legend"><i style="background:${s.color || colors[s.key]}"></i>${esc(s.label)}</span>`).join("");
  return `<div class="chart-card portal-card">
    <svg class="month-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly totals">${ticks}${bars}${labels}</svg>
    <p class="chart-legend-row">${legend}</p>
  </div>`;
}

function formFrom(selector, map) {
  const form = typeof selector === "string" ? ctx.main.querySelector(selector) : selector;
  if (!form) return null;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const errorBox = form.querySelector("[data-form-error]");
    try {
      await map(data, form);
    } catch (err) {
      showError(errorBox, err.message);
    }
  });
  return form;
}

function reload(hash) {
  if (hash) window.location.hash = hash;
  return ctx.go(params().get("tab") ? undefined : undefined);
}


function currentTab(fallback) {
  return params().get("tab") || fallback;
}

function venueOptions(value) {
  return ["Ballroom", "The Nook", "Amore Garden"].map((item) =>
    `<option value="${esc(item)}" ${value === item ? "selected" : ""}>${esc(item)}</option>`
  ).join("");
}

function staffOptions(value, includeBlank = true) {
  const people = ctx.users || [];
  return `${includeBlank ? `<option value="">Unassigned</option>` : ""}${optionList(people, value, (p) => p.name)}`;
}

async function eventOptions(value) {
  if (!ctx._events) {
    try { ctx._events = (await api("/api/events")).events || []; }
    catch { ctx._events = []; }
  }
  return `<option value="">None</option>` + optionList(ctx._events, value, (e) => `${e.date} · ${e.client || e.title || "Event"}`);
}

export async function viewOpsDashboard({ clockHtml = "" } = {}) {
  const today = todayISO();
  const [dash, shiftsData, tasksData] = await Promise.all([
    api("/api/dashboard").catch(() => null),
    api("/api/shifts"),
    api("/api/tasks")
  ]);
  const kpis = (dash && dash.kpis) || {};
  const sampleKpis = (dash && dash.sampleKpis) || {};
  const chart = (dash && dash.chart) || [];
  const upcoming = (dash && dash.upcoming) || [];
  const lowStock = (dash && dash.lowStock) || [];
  const shifts = (shiftsData.shifts || []).filter((shift) => shift.date >= today).slice(0, 5);
  const tasks = (tasksData.tasks || []).filter((task) => task.status === "open").slice(0, 5);

  const ownerCards = isOwner() ? `
    <article class="portal-card"><p class="kicker">Revenue this month</p><p class="stat">${money(kpis.revenueMonth)}</p>${dash && dash.hasSample ? `<p class="tiny muted">Sample: ${money(sampleKpis.revenueMonth)}</p>` : ""}</article>
    <article class="portal-card"><p class="kicker">Unpaid balances</p><p class="stat">${money(kpis.unpaidBalance)}</p><p class="tiny muted">${kpis.unpaidCount || 0} open ${kpis.unpaidCount === 1 ? "event" : "events"}</p></article>
  ` : "";

  const sharedCards = `
    <article class="portal-card"><p class="kicker">Upcoming events</p><p class="stat">${kpis.upcomingEvents ?? upcoming.length}</p><p class="tiny muted">${upcoming[0] ? `Next: ${formatDate(upcoming[0].date, { month: "short" })} · ${esc(upcoming[0].client || upcoming[0].title || "")}` : "None yet"}</p></article>
    <article class="portal-card"><p class="kicker">Occupancy this month</p><p class="stat">${kpis.occupancy ?? 0}%</p><p class="tiny muted">${kpis.occupancyDays || 0} of ${kpis.daysInMonth || "—"} days held</p></article>
    <article class="portal-card"><p class="kicker">Open tasks</p><p class="stat">${kpis.openTasks ?? tasks.length}</p></article>
    <article class="portal-card"><p class="kicker">Low stock</p><p class="stat">${kpis.lowStock ?? lowStock.length}</p>${lowStock[0] ? `<p class="tiny muted">${esc(lowStock[0].name)}</p>` : ""}</article>
    ${role() !== "staff" ? `<article class="portal-card"><p class="kicker">Pending requests</p><p class="stat">${kpis.pendingRequests ?? 0}</p><p><a href="#/requests">Review inbox</a></p></article>` : ""}
    <article class="portal-card"><p class="kicker">Housekeeping</p><p class="stat">${kpis.openHousekeeping ?? 0}</p><p><a href="#/housekeeping">Open jobs</a></p></article>
  `;

  const chartHtml = isOwner() && chart.length
    ? svgChart(chart.map((row) => ({ ...row, label: row.month })), [
        { key: "revenue", label: "Revenue", color: "#6b3f2a" },
        { key: "expenses", label: "Expenses", color: "#c4894a" }
      ].filter((s) => chart.some((row) => row[s.key] != null)))
    : (isOwner() ? `<p class="muted">No monthly totals yet.</p>` : "");

  // Dashboard API may use realRev/sampleRev — map common keys
  const chartRows = chart.map((row) => ({
    label: row.month || row.label,
    revenue: row.revenue ?? row.realRev ?? row.collected ?? 0,
    expenses: row.expenses ?? row.realExp ?? 0
  }));

  const shiftList = shifts.length
    ? `<ul class="stack-list">${shifts.map((shift) => {
        const eventName = shift.event_title || shift.event_client || "";
        const who = role() === "staff"
          ? [shift.role, eventName].filter(Boolean).join(" · ")
          : `${shift.staff_name || "Staff"} · ${shift.role || ""}${eventName ? ` · ${eventName}` : ""}`;
        return `<li class="portal-card"><strong>${formatDate(shift.date, { month: "short" })}</strong><p class="muted">${esc(who)} · ${esc(shift.start)}–${esc(shift.end)}</p>${sampleChip(shift)}</li>`;
      }).join("")}</ul>`
    : `<p class="muted">No upcoming shifts yet.</p>`;

  const taskList = tasks.length
    ? `<ul class="stack-list">${tasks.map((task) => `<li class="portal-card"><strong>${esc(task.title)}</strong><p class="muted">${task.due ? `Due ${formatDate(task.due, { month: "short" })}` : "No due date"}</p>${sampleChip(task)}</li>`).join("")}</ul>`
    : `<p class="muted">No open tasks.</p>`;

  ctx.main.innerHTML = `
    ${pageHead("Welcome back", ctx.user?.name || "Dashboard")}
    ${clockHtml}
    <div class="card-grid cols-3 stack-gap">${ownerCards}${sharedCards}</div>
    ${isOwner() && chartRows.length ? svgChart(chartRows, [
      { key: "revenue", label: "Revenue", color: "#6b3f2a" },
      { key: "expenses", label: "Expenses", color: "#c4894a" }
    ]) : chartHtml}
    <div class="card-grid cols-2 stack-gap">
      <section><h2>Upcoming shifts</h2>${shiftList}<p><a href="#/schedule">Full schedule</a></p></section>
      <section><h2>Open tasks</h2>${taskList}<p><a href="#/tasks">All tasks</a></p></section>
    </div>
    ${role() !== "staff" ? `<p class="muted"><a href="#/events">Events</a> · <a href="#/sales">Sales</a> · <a href="#/inventory">Inventory</a></p>` : `<p class="muted"><a href="#/housekeeping">Housekeeping</a> · <a href="#/inventory">Stock</a> · <a href="#/hr?tab=leave">Leave</a></p>`}
  `;
}

async function loadSalesData() {
  const [clients, leads, packages, quotes, contracts, payments, pipeline] = await Promise.all([
    api("/api/clients"),
    api("/api/leads"),
    api("/api/packages"),
    api("/api/quotes").catch(() => ({ quotes: [], statuses: [] })),
    api("/api/contracts").catch(() => ({ contracts: [], statuses: [] })),
    isOwner() ? api("/api/payments") : Promise.resolve({ payments: [], kinds: [], methods: [] }),
    api("/api/sales/pipeline")
  ]);
  return { clients, leads, packages, quotes, contracts, payments, pipeline };
}

export async function viewSales() {
  const tab = currentTab("pipeline");
  const data = await loadSalesData();
  const tabs = [
    { id: "pipeline", label: "Pipeline" },
    { id: "clients", label: "Clients" },
    { id: "leads", label: "Leads" },
    { id: "packages", label: "Packages" },
    { id: "quotes", label: "Quotes" },
    { id: "contracts", label: "Contracts" }
  ];
  if (isOwner()) tabs.push({ id: "payments", label: "Payments" });
  ctx.main.innerHTML = `
    ${pageHead("Sales", "Sales and bookings", "Leads, packages, quotes, contracts and receipts.")}
    ${tabBar("sales", tabs, tab)}
    <div data-sales-panel></div>
  `;
  const panel = ctx.main.querySelector("[data-sales-panel]");
  if (tab === "pipeline") renderPipeline(panel, data);
  else if (tab === "clients") renderClients(panel, data);
  else if (tab === "leads") renderLeads(panel, data);
  else if (tab === "packages") renderPackages(panel, data);
  else if (tab === "quotes") renderQuotes(panel, data);
  else if (tab === "contracts") renderContracts(panel, data);
  else if (tab === "payments" && isOwner()) renderPayments(panel, data);
  else panel.innerHTML = emptyState("Not available", "That sales tab is not available for your role.");
}

function renderPipeline(panel, data) {
  const stages = data.leads.stages || ["new", "contacted", "quoted", "won", "lost"];
  const leads = data.leads.leads || [];
  const unpaid = data.pipeline.unpaid || [];
  const by = {};
  for (const stage of stages) by[stage] = leads.filter((row) => row.status === stage);
  panel.innerHTML = `
    <div class="pipeline">
      ${stages.map((stage) => `
        <section class="pipeline__col portal-card">
          <h2>${esc(stage)} <span class="muted">${by[stage].length}</span></h2>
          ${by[stage].length ? by[stage].map((lead) => `
            <article class="pipeline-card">
              <strong>${esc(lead.name)}${sampleChip(lead)}</strong>
              <p class="muted tiny">${esc([lead.type, lead.venue, lead.event_date, lead.pax ? `${lead.pax} pax` : ""].filter(Boolean).join(" · ") || "No event details yet")}</p>
            </article>`).join("") : `<p class="muted tiny">None</p>`}
        </section>`).join("")}
    </div>
    ${isOwner() && unpaid.length ? `
      <h2>Unpaid balances</h2>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Date</th><th>Client</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
        <tbody>${unpaid.map((row) => `<tr>
          <td>${esc(row.date || "")}</td>
          <td>${esc(row.client || row.client_name || "")}${sampleChip(row)}</td>
          <td>${money(row.contract_total)}</td>
          <td>${money(row.paid)}</td>
          <td>${money(row.balance)}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : ""}
  `;
}

function renderClients(panel, data) {
  const rows = data.clients.clients || [];
  panel.innerHTML = `
    ${canWrite("sales") ? `<details class="portal-card"><summary>Add a client</summary>
      <form class="portal-form" data-add-client>
        <div class="field"><label for="cli-name">Name</label><input id="cli-name" name="name" required maxlength="120"></div>
        <div class="field"><label for="cli-contact">Contact</label><input id="cli-contact" name="contact" maxlength="80"></div>
        <div class="field"><label for="cli-email">Email</label><input id="cli-email" name="email" type="email" maxlength="80"></div>
        <div class="field"><label for="cli-company">Company</label><input id="cli-company" name="company" maxlength="120"></div>
        <div class="field"><label for="cli-notes">Notes</label><textarea id="cli-notes" name="notes" rows="2"></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save client</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Company</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.name)}${sampleChip(row)}</td>
        <td>${esc(row.contact || "—")}</td>
        <td>${esc(row.email || "—")}</td>
        <td>${esc(row.company || "—")}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No clients yet", "Add a client to start a quote or contract.")}
  `;
  formFrom("[data-add-client]", async (formData) => {
    await api("/api/clients", { method: "POST", body: Object.fromEntries(formData) });
    await viewSales();
  });
}

function renderLeads(panel, data) {
  const rows = data.leads.leads || [];
  const stages = data.leads.stages || ["new", "contacted", "quoted", "won", "lost"];
  panel.innerHTML = `
    ${canWrite("sales") ? `<details class="portal-card"><summary>Add a lead</summary>
      <form class="portal-form" data-add-lead>
        <div class="field"><label for="ld-name">Name</label><input id="ld-name" name="name" required maxlength="120"></div>
        <div class="field"><label for="ld-contact">Contact</label><input id="ld-contact" name="contact" maxlength="80"></div>
        <div class="field"><label for="ld-source">Source</label><input id="ld-source" name="source" placeholder="Walk-in, Facebook, referral"></div>
        <div class="field"><label for="ld-type">Event type</label><input id="ld-type" name="type" placeholder="Wedding"></div>
        <div class="field"><label for="ld-date">Event date</label><input id="ld-date" name="event_date" type="date"></div>
        <div class="field"><label for="ld-venue">Venue</label><select id="ld-venue" name="venue">${venueOptions("")}</select></div>
        <div class="field"><label for="ld-pax">Pax</label><input id="ld-pax" name="pax" type="number" min="0" max="2000"></div>
        <div class="field"><label for="ld-notes">Notes</label><textarea id="ld-notes" name="notes" rows="2"></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save lead</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Name</th><th>Event</th><th>Stage</th><th></th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.name)}${sampleChip(row)}<br><span class="muted tiny">${esc(row.contact || "")}</span></td>
        <td>${esc([row.event_date, row.venue, row.type].filter(Boolean).join(" · ") || "—")}</td>
        <td>${canWrite("sales") ? `<select data-lead-stage data-id="${esc(row.id)}">${stages.map((s) => `<option ${row.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>` : esc(row.status)}</td>
        <td class="row-actions">${isOwner() ? `<a class="btn btn-ghost" href="#/sales?tab=quotes&lead=${esc(row.id)}">Quote</a>` : ""}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No leads yet", "New inquiries will show up here in the pipeline.")}
  `;
  formFrom("[data-add-lead]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (body.pax === "") body.pax = null;
    await api("/api/leads", { method: "POST", body });
    await viewSales();
  });
  panel.querySelectorAll("[data-lead-stage]").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await api(`/api/leads/${select.dataset.id}`, { method: "PATCH", body: { status: select.value } });
      } catch (err) {
        await openModal({ title: "Could not update", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
        await viewSales();
      }
    });
  });
}

function renderPackages(panel, data) {
  const rows = data.packages.packages || [];
  panel.innerHTML = rows.length ? `<div class="card-grid cols-2">${rows.map((row) => `
    <article class="portal-card">
      <p class="kicker">${esc(row.venue || "Any venue")}</p>
      <h2>${esc(row.name)}${sampleChip(row)}</h2>
      <p>${esc(row.description || "")}</p>
      ${isOwner() ? `<p class="stat">${money(row.base_fee)}</p><p class="muted tiny">${row.included_pax ? `Includes ${row.included_pax} pax` : ""}${row.extra_pax_price ? ` · extra pax ${money(row.extra_pax_price)}` : ""}</p>` : `<p class="muted tiny">${row.included_pax ? `${row.included_pax} pax` : ""} ${row.hours ? `· ${row.hours} hours` : ""}</p>`}
      ${row.inclusions ? `<p class="muted tiny">${esc(row.inclusions)}</p>` : ""}
      ${isOwner() ? `<p><a class="btn btn-solid" href="#/sales?tab=quotes&package=${esc(row.id)}">Quote this package</a></p>` : ""}
    </article>`).join("")}</div>` : emptyState("No packages yet", "The owner can add packages to use on quotes.");
}


function printQuote(quote) {
  const lines = quote.lines || [];
  printDocument(quote.number || "Quote", `
    <p class="muted">Quotation</p>
    <h1>${esc(quote.number || "Quote")}</h1>
    <p><strong>${esc(quote.client_name || "")}</strong><br>
    ${esc([quote.event_date, quote.venue].filter(Boolean).join(" · "))}<br>
    Status: ${esc(quote.status || "")}${quote.valid_until ? ` · Valid until ${esc(quote.valid_until)}` : ""}</p>
    <table><thead><tr><th>Item</th><th>Qty</th>${isOwner() || quote.total != null ? "<th>Amount</th>" : ""}</tr></thead>
    <tbody>${lines.map((line) => `<tr><td>${esc(line.label || "")}</td><td>${esc(line.qty ?? 1)}</td>${quote.total != null ? `<td>${money((line.qty || 1) * (line.unit_price || 0))}</td>` : ""}</tr>`).join("")}</tbody></table>
    ${quote.total != null ? `<p class="total">Total: ${money(quote.total)}${quote.discount ? ` (discount ${money(quote.discount)})` : ""}</p>` : ""}
    ${quote.notes ? `<p>${esc(quote.notes)}</p>` : ""}
  `);
}

function printContract(row) {
  printDocument(row.number || "Contract", `
    <p class="muted">Booking contract</p>
    <h1>${esc(row.number || "Contract")}</h1>
    <p>This booking is between <strong>Mi Granja Events and Leisure Inc.</strong> and <strong>${esc(row.client_name || "")}</strong>.</p>
    <p>Event date: ${esc(row.event_date || "TBA")}<br>Venue: ${esc(row.venue || "TBA")}<br>Status: ${esc(row.status || "")}</p>
    ${row.total != null ? `<p class="total">Contract total: ${money(row.total)}<br>Reservation due: ${money(row.deposit_due)}</p>` : ""}
    ${row.terms ? `<p>${esc(row.terms)}</p>` : "<p>Fifty percent reservation, balance due seven days before the event. Terms may be updated in writing.</p>"}
  `);
}

function printReceipt(row) {
  printDocument(row.receipt_no || "Official Receipt", `
    <p class="muted">Official receipt</p>
    <h1>${esc(row.receipt_no || row.or_number || "OR")}</h1>
    <p>Received from <strong>${esc(row.client_name || "")}</strong></p>
    <p>Date: ${esc(String(row.received_at || "").slice(0, 10))}<br>
    Kind: ${esc(row.kind || "")}<br>
    Method: ${esc(row.method || "")}</p>
    <p class="total">Amount: ${money(row.amount)}</p>
    ${row.notes ? `<p>${esc(row.notes)}</p>` : ""}
    ${row.voided_at ? `<p><strong>VOIDED</strong> ${esc(row.voided_at)}</p>` : ""}
  `);
}

function renderQuotes(panel, data) {
  const rows = data.quotes.quotes || [];
  const packages = data.packages.packages || [];
  const clients = data.clients.clients || [];
  const prePackage = params().get("package") || "";
  const preLead = params().get("lead") || "";
  const pkg = packages.find((row) => row.id === prePackage);
  panel.innerHTML = `
    ${isOwner() ? `<details class="portal-card" ${prePackage || preLead ? "open" : ""}><summary>New quote from a package</summary>
      <form class="portal-form" data-add-quote>
        <div class="field"><label for="q-client">Client name</label><input id="q-client" name="client_name" required list="q-client-list"></div>
        <datalist id="q-client-list">${clients.map((c) => `<option value="${esc(c.name)}"></option>`).join("")}</datalist>
        <div class="field"><label for="q-package">Package</label>
          <select id="q-package" name="package_id">${optionList(packages, prePackage, (p) => p.name)}</select>
        </div>
        <div class="field"><label for="q-date">Event date</label><input id="q-date" name="event_date" type="date"></div>
        <div class="field"><label for="q-venue">Venue</label><select id="q-venue" name="venue">${venueOptions(pkg && pkg.venue || "")}</select></div>
        <div class="field"><label for="q-discount">Discount</label><input id="q-discount" name="discount" type="number" min="0" value="0"></div>
        <div class="field"><label for="q-valid">Valid until</label><input id="q-valid" name="valid_until" type="date"></div>
        <div class="field"><label for="q-notes">Notes</label><textarea id="q-notes" name="notes" rows="2"></textarea></div>
        <input type="hidden" name="lead_id" value="${esc(preLead)}">
        <p class="muted tiny">The package fee is used as the first line. You can adjust the discount before sending.</p>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Create quote</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Number</th><th>Client</th><th>Event</th><th>Status</th>${isOwner() ? "<th>Total</th>" : ""}<th></th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.number || "")}${sampleChip(row)}</td>
        <td>${esc(row.client_name || "")}</td>
        <td>${esc([row.event_date, row.venue].filter(Boolean).join(" · ") || "—")}</td>
        <td>${esc(row.status || "")}</td>
        ${isOwner() ? `<td>${money(row.total)}</td>` : ""}
        <td class="row-actions">
          <button class="btn btn-ghost" type="button" data-print-quote="${esc(row.id)}">Print</button>
          ${isOwner() && row.status !== "accepted" && row.status !== "rejected" ? `<button class="btn btn-solid" type="button" data-accept-quote="${esc(row.id)}">Accept</button>` : ""}
        </td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No quotes yet", "Create a quote from a package to send to a client.")}
  `;
  formFrom("[data-add-quote]", async (formData) => {
    const body = Object.fromEntries(formData);
    const chosen = packages.find((row) => row.id === body.package_id);
    if (chosen) {
      body.base_fee = chosen.base_fee;
      body.client_id = (clients.find((c) => c.name === body.client_name) || {}).id || null;
      if (!body.venue) body.venue = chosen.venue || "";
    }
    await api("/api/quotes", { method: "POST", body });
    window.location.hash = "#/sales?tab=quotes";
    await viewSales();
  });
  panel.querySelectorAll("[data-print-quote]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const quote = rows.find((row) => row.id === btn.dataset.printQuote);
      if (quote) printQuote(quote);
    });
  });
  panel.querySelectorAll("[data-accept-quote]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmAction("Accept this quote?", "This can create a contract from the quote.");
      if (!ok) return;
      try {
        await api(`/api/quotes/${btn.dataset.acceptQuote}/accept`, { method: "POST", body: {} });
        await viewSales();
      } catch (err) {
        await openModal({ title: "Could not accept", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
      }
    });
  });
}

function renderContracts(panel, data) {
  const rows = data.contracts.contracts || [];
  const quotes = data.quotes.quotes || [];
  panel.innerHTML = `
    ${isOwner() ? `<details class="portal-card"><summary>New contract</summary>
      <form class="portal-form" data-add-contract>
        <div class="field"><label for="ct-client">Client name</label><input id="ct-client" name="client_name" required></div>
        <div class="field"><label for="ct-date">Event date</label><input id="ct-date" name="event_date" type="date"></div>
        <div class="field"><label for="ct-venue">Venue</label><select id="ct-venue" name="venue">${venueOptions("")}</select></div>
        <div class="field"><label for="ct-total">Total</label><input id="ct-total" name="total" type="number" min="0" required></div>
        <div class="field"><label for="ct-deposit">Reservation due</label><input id="ct-deposit" name="deposit_due" type="number" min="0"></div>
        <div class="field"><label for="ct-quote">From quote</label><select id="ct-quote" name="quote_id"><option value="">None</option>${optionList(quotes, "", (q) => q.number + " · " + (q.client_name || ""))}</select></div>
        <div class="field"><label for="ct-terms">Terms</label><textarea id="ct-terms" name="terms" rows="3">Fifty percent reservation, balance due seven days before the event.</textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save contract</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Number</th><th>Client</th><th>Event</th><th>Status</th>${isOwner() ? "<th>Total</th>" : ""}<th></th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.number || "")}${sampleChip(row)}</td>
        <td>${esc(row.client_name || "")}</td>
        <td>${esc([row.event_date, row.venue].filter(Boolean).join(" · ") || "—")}</td>
        <td>${esc(row.status || "")}</td>
        ${isOwner() ? `<td>${money(row.total)}</td>` : ""}
        <td class="row-actions"><button class="btn btn-ghost" type="button" data-print-contract="${esc(row.id)}">Print</button></td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No contracts yet", "Accepted quotes and new bookings will appear here.")}
  `;
  formFrom("[data-add-contract]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (body.deposit_due === "") delete body.deposit_due;
    if (!body.quote_id) delete body.quote_id;
    await api("/api/contracts", { method: "POST", body });
    await viewSales();
  });
  panel.querySelectorAll("[data-print-contract]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = rows.find((item) => item.id === btn.dataset.printContract);
      if (row) printContract(row);
    });
  });
}

function renderPayments(panel, data) {
  const rows = data.payments.payments || [];
  const kinds = data.payments.kinds || ["reservation", "downpayment", "balance", "security_deposit", "refund"];
  const methods = data.payments.methods || ["cash", "gcash", "maya", "bank", "card", "check"];
  panel.innerHTML = `
    <details class="portal-card"><summary>Record a payment</summary>
      <form class="portal-form" data-add-payment>
        <div class="field"><label for="pay-client">Client name</label><input id="pay-client" name="client_name" required></div>
        <div class="field"><label for="pay-amount">Amount</label><input id="pay-amount" name="amount" type="number" min="1" required></div>
        <div class="field"><label for="pay-kind">Kind</label><select id="pay-kind" name="kind">${kinds.map((k) => `<option>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="pay-method">Method</label><select id="pay-method" name="method">${methods.map((k) => `<option>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="pay-date">Date received</label><input id="pay-date" name="received_at" type="date" value="${todayISO()}"></div>
        <div class="field"><label for="pay-event">Event</label><select id="pay-event" name="event_id"></select></div>
        <div class="field"><label for="pay-notes">Notes</label><textarea id="pay-notes" name="notes" rows="2"></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save payment</button>
      </form></details>
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>OR</th><th>Client</th><th>Kind</th><th>Amount</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.receipt_no || row.or_number || "")}${sampleChip(row)}${row.voided_at ? ' <span class="muted">void</span>' : ""}</td>
        <td>${esc(row.client_name || "")}</td>
        <td>${esc(row.kind || "")} · ${esc(row.method || "")}</td>
        <td>${money(row.amount)}</td>
        <td>${esc(String(row.received_at || "").slice(0, 10))}</td>
        <td class="row-actions">
          <button class="btn btn-ghost" type="button" data-print-or="${esc(row.id)}">Print</button>
          ${!row.voided_at ? `<button class="btn btn-ghost" type="button" data-void-pay="${esc(row.id)}">Void</button>` : ""}
        </td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No payments yet", "Record a reservation or balance payment to issue an official receipt.")}
  `;
  eventOptions("").then((html) => {
    const sel = panel.querySelector("#pay-event");
    if (sel) sel.innerHTML = html;
  });
  formFrom("[data-add-payment]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (!body.event_id) delete body.event_id;
    await api("/api/payments", { method: "POST", body });
    await viewSales();
  });
  panel.querySelectorAll("[data-print-or]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = rows.find((item) => item.id === btn.dataset.printOr);
      if (row) printReceipt(row);
    });
  });
  panel.querySelectorAll("[data-void-pay]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmAction("Void this receipt?", "The official receipt will be marked void. This cannot be undone.");
      if (!ok) return;
      try {
        await api(`/api/payments/${btn.dataset.voidPay}/void`, { method: "POST", body: {} });
        await viewSales();
      } catch (err) {
        await openModal({ title: "Could not void", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
      }
    });
  });
}


export async function viewEventSheet(eventId) {
  const id = eventId || params().get("sheet");
  if (!id) {
    ctx.main.innerHTML = emptyState("Choose an event", "Open an event sheet from the Events list.");
    return;
  }
  const data = await api(`/api/events/${id}/sheet`);
  const ev = data.event || {};
  const details = data.details || {};
  const shifts = data.shifts || [];
  const allocations = data.allocations || [];
  const jobs = data.jobs || [];
  const balance = data.balance;
  const people = ctx.users || [];
  ctx.main.innerHTML = `
    ${pageHead("Event sheet", ev.client || ev.title || "Event", `${formatDate(ev.date, { weekday: "long", month: "long" })} · ${esc(ev.venue || "")} · ${esc(ev.status || "")}${sampleChip(ev)}`)}
    <p><a href="#/events">Back to events</a></p>
    ${balance ? `<div class="card-grid cols-3">
      <article class="portal-card"><p class="kicker">Contract total</p><p class="stat">${money(balance.contract_total)}</p></article>
      <article class="portal-card"><p class="kicker">Paid</p><p class="stat">${money(balance.paid)}</p></article>
      <article class="portal-card"><p class="kicker">Balance</p><p class="stat">${money(balance.balance)}</p></article>
    </div>` : ""}
    <form class="portal-form portal-card" data-save-sheet>
      <div class="field"><label for="es-headcount">Headcount</label><input id="es-headcount" name="headcount" type="number" min="0" max="2000" value="${esc(details.headcount ?? ev.pax ?? "")}"></div>
      <div class="field"><label for="es-coord">Coordinator</label><select id="es-coord" name="coordinator_id">${staffOptions(details.coordinator_id || ev.coordinator_id, true)}</select></div>
      <div class="field"><label for="es-menu">Menu</label><textarea id="es-menu" name="menu" rows="4">${esc(details.menu || "")}</textarea></div>
      <div class="field"><label for="es-setup">Setup</label><textarea id="es-setup" name="setup" rows="4">${esc(details.setup || "")}</textarea></div>
      <div class="field"><label for="es-timeline">Timeline</label><textarea id="es-timeline" name="timeline" rows="4">${esc(details.timeline || "")}</textarea></div>
      <div class="field"><label for="es-notes">Notes</label><textarea id="es-notes" name="notes" rows="3">${esc(details.notes || "")}</textarea></div>
      <div data-form-error></div>
      <button class="btn btn-solid" type="submit">Save event sheet</button>
    </form>
    <div class="card-grid cols-2 stack-gap">
      <section>
        <h2>Staff assignment</h2>
        ${shifts.length ? `<ul class="stack-list">${shifts.map((shift) => `<li class="portal-card"><strong>${esc(shift.staff_name || "Staff")}</strong><p class="muted">${esc(shift.role || "")} · ${esc(shift.start)}–${esc(shift.end)}</p>${sampleChip(shift)}</li>`).join("")}</ul>` : `<p class="muted">No staff assigned yet. Add them in <a href="#/schedule">Schedule</a>.</p>`}
      </section>
      <section>
        <h2>Items reserved</h2>
        ${allocations.length ? `<ul class="stack-list">${allocations.map((row) => `<li class="portal-card"><strong>${esc(row.item_name || "Item")}</strong><p class="muted">${esc(row.qty)} ${esc(row.unit || "")}</p></li>`).join("")}</ul>` : `<p class="muted">No inventory reserved. Assign items in <a href="#/inventory?tab=events">Inventory</a>.</p>`}
      </section>
    </div>
    <section>
      <h2>Housekeeping jobs</h2>
      ${jobs.length ? `<ul class="stack-list">${jobs.map((job) => `<li class="portal-card"><strong>${esc(job.title)}</strong><p class="muted">${esc(job.kind || "")} · ${esc(job.status || "")} · ${esc(job.assigned_name || "Unassigned")}</p></li>`).join("")}</ul>` : `<p class="muted">No cleaning jobs yet. Create them in <a href="#/housekeeping">Housekeeping</a>.</p>`}
    </section>
  `;
  formFrom("[data-save-sheet]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (body.headcount === "") body.headcount = null;
    if (!body.coordinator_id) body.coordinator_id = null;
    await api(`/api/events/${id}/sheet`, { method: "PATCH", body });
    await viewEventSheet(id);
  });
}

export async function viewHousekeeping() {
  const tab = currentTab("jobs");
  const [jobs, areas, templates, tickets] = await Promise.all([
    api("/api/hk/jobs"),
    api("/api/areas"),
    api("/api/hk/templates"),
    api("/api/maintenance")
  ]);
  const tabs = [
    { id: "jobs", label: "Jobs" },
    { id: "areas", label: "Areas" },
    { id: "templates", label: "Checklists" },
    { id: "tickets", label: "Tickets" }
  ];
  ctx.main.innerHTML = `
    ${pageHead("Housekeeping", "Housekeeping and maintenance", "Pre- and post-event cleaning, area setup, and issue tickets.")}
    ${tabBar("housekeeping", tabs, tab)}
    <div data-hk-panel></div>
  `;
  const panel = ctx.main.querySelector("[data-hk-panel]");
  if (tab === "jobs") renderHkJobs(panel, jobs, areas, templates);
  else if (tab === "areas") renderAreas(panel, areas);
  else if (tab === "templates") renderTemplates(panel, templates, areas);
  else renderTickets(panel, tickets, areas);
}

function renderHkJobs(panel, jobsData, areasData, templatesData) {
  const jobs = jobsData.jobs || [];
  const statuses = jobsData.statuses || [];
  const kinds = jobsData.kinds || ["pre", "post", "daily", "deep"];
  const areas = areasData.areas || [];
  const templates = templatesData.templates || [];
  const canCreate = role() !== "staff";
  panel.innerHTML = `
    ${canCreate ? `<details class="portal-card"><summary>New cleaning job</summary>
      <form class="portal-form" data-add-job>
        <div class="field"><label for="job-title">Title</label><input id="job-title" name="title" required maxlength="160"></div>
        <div class="field"><label for="job-kind">Kind</label><select id="job-kind" name="kind">${kinds.map((k) => `<option value="${k}">${k}</option>`).join("")}</select></div>
        <div class="field"><label for="job-due">Due</label><input id="job-due" name="due" type="date"></div>
        <div class="field"><label for="job-area">Area</label><select id="job-area" name="area_id"><option value="">None</option>${optionList(areas, "", (a) => a.name)}</select></div>
        <div class="field"><label for="job-event">Event</label><select id="job-event" name="event_id"></select></div>
        <div class="field"><label for="job-assigned">Assigned to</label><select id="job-assigned" name="assigned_to">${staffOptions("", true)}</select></div>
        <div class="field"><label for="job-tmpl">From template</label><select id="job-tmpl" name="template_id"><option value="">None</option>${optionList(templates, "", (t) => t.name)}</select></div>
        <div class="field"><label for="job-notes">Notes</label><textarea id="job-notes" name="notes" rows="2"></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save job</button>
      </form></details>` : ""}
    ${jobs.length ? jobs.map((job) => `
      <article class="portal-card hk-job">
        <div class="hk-job__head">
          <div>
            <p class="kicker">${esc(job.kind || "")} · ${esc(job.status || "")}${sampleChip(job)}</p>
            <h2>${esc(job.title)}</h2>
            <p class="muted tiny">${esc([job.event_client || job.event_title, job.event_date, job.area_name, job.assigned_name, job.due ? `Due ${job.due}` : ""].filter(Boolean).join(" · ") || "")}</p>
          </div>
          <select data-job-status data-id="${esc(job.id)}">${statuses.map((s) => `<option ${job.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        ${(job.items || []).length ? `<ul class="check-list">${job.items.map((item) => `
          <li><label><input type="checkbox" data-hk-item="${esc(item.id)}" ${item.done ? "checked" : ""}> ${esc(item.label)}</label></li>`).join("")}</ul>` : "<p class='muted tiny'>No checklist items.</p>"}
      </article>`).join("") : emptyState("No housekeeping jobs", "Pre- and post-event cleaning jobs will appear here.")}
  `;
  eventOptions("").then((html) => { const el = panel.querySelector("#job-event"); if (el) el.innerHTML = html; });
  formFrom("[data-add-job]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (!body.event_id) delete body.event_id;
    if (!body.area_id) delete body.area_id;
    if (!body.assigned_to) delete body.assigned_to;
    if (!body.template_id) delete body.template_id;
    await api("/api/hk/jobs", { method: "POST", body });
    await viewHousekeeping();
  });
  panel.querySelectorAll("[data-job-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      try { await api(`/api/hk/jobs/${select.dataset.id}`, { method: "PATCH", body: { status: select.value } }); }
      catch (err) { await openModal({ title: "Could not update", message: err.message, confirmLabel: "OK", cancelLabel: "Close" }); await viewHousekeeping(); }
    });
  });
  panel.querySelectorAll("[data-hk-item]").forEach((box) => {
    box.addEventListener("change", async () => {
      try { await api(`/api/hk/items/${box.dataset.hkItem}`, { method: "PATCH", body: { done: box.checked } }); }
      catch (err) { box.checked = !box.checked; await openModal({ title: "Could not update", message: err.message, confirmLabel: "OK", cancelLabel: "Close" }); }
    });
  });
}

function renderAreas(panel, areasData) {
  const rows = areasData.areas || [];
  const venues = areasData.venues || [];
  const canEdit = role() === "owner" || role() === "admin";
  panel.innerHTML = `
    ${canEdit ? `<details class="portal-card"><summary>Add an area</summary>
      <form class="portal-form" data-add-area>
        <div class="field"><label for="ar-name">Name</label><input id="ar-name" name="name" required maxlength="120"></div>
        <div class="field"><label for="ar-kind">Kind</label><input id="ar-kind" name="kind" placeholder="venue, facility, grounds"></div>
        <div class="field"><label for="ar-venue">Venue</label><select id="ar-venue" name="venue_id"><option value="">None</option>${optionList(venues, "", (v) => v.name)}</select></div>
        <div class="field"><label for="ar-notes">Notes</label><textarea id="ar-notes" name="notes" rows="2"></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save area</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="card-grid cols-2">${rows.map((row) => `<article class="portal-card"><h2>${esc(row.name)}${sampleChip(row)}</h2><p class="muted">${esc([row.kind, row.venue_name].filter(Boolean).join(" · "))}</p>${row.notes ? `<p>${esc(row.notes)}</p>` : ""}</article>`).join("")}</div>` : emptyState("No areas yet", "Areas such as the ballroom, kitchen and restrooms are listed here.")}
  `;
  formFrom("[data-add-area]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (!body.venue_id) delete body.venue_id;
    await api("/api/areas", { method: "POST", body });
    await viewHousekeeping();
  });
}

function renderTemplates(panel, templatesData, areasData) {
  const rows = templatesData.templates || [];
  const areas = (areasData && areasData.areas) || [];
  const kinds = templatesData.kinds || ["pre", "post", "daily", "deep"];
  const canEdit = role() === "owner" || role() === "admin";
  panel.innerHTML = `
    ${canEdit ? `<details class="portal-card"><summary>New checklist template</summary>
      <form class="portal-form" data-add-tmpl>
        <div class="field"><label for="tm-name">Name</label><input id="tm-name" name="name" required></div>
        <div class="field"><label for="tm-kind">Kind</label><select id="tm-kind" name="kind">${kinds.map((k) => `<option>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="tm-area">Area</label><select id="tm-area" name="area_id"><option value="">None</option>${optionList(areas, "", (a) => a.name)}</select></div>
        <div class="field"><label for="tm-items">Checklist items (one per line)</label><textarea id="tm-items" name="items" rows="5" placeholder="Wipe tables&#10;Sweep floor"></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save template</button>
      </form></details>` : ""}
    ${rows.length ? rows.map((row) => `<article class="portal-card"><h2>${esc(row.name)}${sampleChip(row)}</h2><p class="muted tiny">${esc([row.kind, row.area_name].filter(Boolean).join(" · "))}</p><ol>${(row.items || []).map((item) => `<li>${esc(item.label)}</li>`).join("")}</ol></article>`).join("") : emptyState("No templates yet", "Reusable pre- and post-event checklists live here.")}
  `;
  formFrom("[data-add-tmpl]", async (formData) => {
    const body = Object.fromEntries(formData);
    body.items = String(body.items || "").split("\n").map((line) => line.trim()).filter(Boolean);
    if (!body.area_id) delete body.area_id;
    await api("/api/hk/templates", { method: "POST", body });
    await viewHousekeeping();
  });
}

function renderTickets(panel, ticketsData, areasData) {
  const rows = ticketsData.tickets || [];
  const statuses = ticketsData.statuses || ["open", "in_progress", "resolved", "closed"];
  const priorities = ticketsData.priorities || ["low", "normal", "high", "urgent"];
  const areas = (areasData && areasData.areas) || [];
  panel.innerHTML = `
    <details class="portal-card"><summary>Report an issue</summary>
      <form class="portal-form" data-add-ticket>
        <div class="field"><label for="tk-title">Title</label><input id="tk-title" name="title" required maxlength="160"></div>
        <div class="field"><label for="tk-detail">Details</label><textarea id="tk-detail" name="detail" rows="3"></textarea></div>
        <div class="field"><label for="tk-pri">Priority</label><select id="tk-pri" name="priority">${priorities.map((p) => `<option ${p === "normal" ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="field"><label for="tk-area">Area</label><select id="tk-area" name="area_id"><option value="">None</option>${optionList(areas, "", (a) => a.name)}</select></div>
        <div class="field"><label for="tk-event">Event</label><select id="tk-event" name="event_id"></select></div>
        ${role() !== "staff" ? `<div class="field"><label for="tk-assigned">Assign to</label><select id="tk-assigned" name="assigned_to">${staffOptions("", true)}</select></div>` : ""}
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save ticket</button>
      </form></details>
    ${rows.length ? rows.map((row) => `<article class="portal-card">
      <p class="kicker">${esc(row.priority || "")} · ${esc(row.status || "")}${sampleChip(row)}</p>
      <h2>${esc(row.title)}</h2>
      <p>${esc(row.detail || "")}</p>
      <p class="muted tiny">${esc([row.area_name, row.reporter_name, row.assigned_name].filter(Boolean).join(" · "))}</p>
      ${role() !== "staff" || row.assigned_to === ctx.user?.id || row.reported_by === ctx.user?.id ? `<select data-ticket-status data-id="${esc(row.id)}">${statuses.map((s) => `<option ${row.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>` : ""}
    </article>`).join("") : emptyState("No tickets yet", "Maintenance issues and repairs are logged here.")}
  `;
  eventOptions("").then((html) => { const el = panel.querySelector("#tk-event"); if (el) el.innerHTML = html; });
  formFrom("[data-add-ticket]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (!body.area_id) delete body.area_id;
    if (!body.event_id) delete body.event_id;
    if (!body.assigned_to) delete body.assigned_to;
    await api("/api/maintenance", { method: "POST", body });
    await viewHousekeeping();
  });
  panel.querySelectorAll("[data-ticket-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      try { await api(`/api/maintenance/${select.dataset.id}`, { method: "PATCH", body: { status: select.value } }); }
      catch (err) { await openModal({ title: "Could not update", message: err.message, confirmLabel: "OK", cancelLabel: "Close" }); await viewHousekeeping(); }
    });
  });
}


export async function viewInventory() {
  const tab = currentTab("stock");
  const [stock, items, moves, allocations, suppliers] = await Promise.all([
    api("/api/inventory/stock"),
    api("/api/inventory/items"),
    api("/api/inventory/moves"),
    api("/api/inventory/allocations"),
    api("/api/suppliers").catch(() => ({ suppliers: [] }))
  ]);
  const tabs = [
    { id: "stock", label: "Stock" },
    { id: "items", label: "Items" },
    { id: "moves", label: "Movements" },
    { id: "events", label: "Event use" }
  ];
  ctx.main.innerHTML = `
    ${pageHead("Inventory", "Inventory", "Stock on hand, movements, reorder alerts and per-event use.")}
    ${tabBar("inventory", tabs, tab)}
    <div data-inv-panel></div>
  `;
  const panel = ctx.main.querySelector("[data-inv-panel]");
  if (tab === "stock") renderStock(panel, stock, items);
  else if (tab === "items") renderItems(panel, items, stock);
  else if (tab === "moves") renderMoves(panel, moves, items);
  else renderAllocations(panel, allocations, items);
}

function renderStock(panel, stockData, itemsData) {
  const rows = stockData.stock || itemsData.items || [];
  const low = stockData.low || rows.filter((row) => Number(row.qty_on_hand || 0) <= Number(row.reorder_level || 0));
  const canMove = role() === "owner" || role() === "admin" || role() === "staff";
  const kinds = role() === "staff" ? ["issue", "return"] : ["receive", "issue", "return", "adjust", "damage", "loss"];
  panel.innerHTML = `
    ${low.length ? `<div class="portal-card warn-card"><p class="kicker">Reorder alerts</p><ul>${low.map((row) => `<li><strong>${esc(row.name)}</strong> — ${esc(row.qty_on_hand)} ${esc(row.unit || "")} on hand, reorder at ${esc(row.reorder_level)}${sampleChip(row)}</li>`).join("")}</ul></div>` : ""}
    ${canMove ? `<details class="portal-card"><summary>${role() === "staff" ? "Issue or return stock" : "Record a stock movement"}</summary>
      <form class="portal-form" data-add-move>
        <div class="field"><label for="mv-item">Item</label><select id="mv-item" name="item_id" required>${optionList(rows, "", (r) => `${r.name} (${r.qty_on_hand} ${r.unit || ""})`)}</select></div>
        <div class="field"><label for="mv-kind">Type</label><select id="mv-kind" name="kind">${kinds.map((k) => `<option>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="mv-qty">Quantity</label><input id="mv-qty" name="qty" type="number" min="1" required></div>
        <div class="field"><label for="mv-event">Event</label><select id="mv-event" name="event_id"></select></div>
        <div class="field"><label for="mv-notes">Notes</label><input id="mv-notes" name="notes"></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save movement</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Reorder at</th>${isOwner() ? "<th>Unit cost</th>" : ""}</tr></thead>
      <tbody>${rows.map((row) => `<tr class="${Number(row.qty_on_hand || 0) <= Number(row.reorder_level || 0) ? "is-low" : ""}">
        <td>${esc(row.name)}${sampleChip(row)}</td>
        <td>${esc(row.category || "—")}</td>
        <td>${esc(row.qty_on_hand)} ${esc(row.unit || "")}</td>
        <td>${esc(row.reorder_level ?? "—")}</td>
        ${isOwner() ? `<td>${money(row.unit_cost)}</td>` : ""}
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No stock records", "Add inventory items to track linens, chairs, tables and supplies.")}
  `;
  eventOptions("").then((html) => { const el = panel.querySelector("#mv-event"); if (el) el.innerHTML = html; });
  formFrom("[data-add-move]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (!body.event_id) delete body.event_id;
    body.qty = Number(body.qty);
    await api("/api/inventory/moves", { method: "POST", body });
    await viewInventory();
  });
}

function renderItems(panel, itemsData, stockData) {
  const rows = itemsData.items || [];
  const canEdit = role() === "owner" || role() === "admin";
  const locations = (stockData && stockData.locations) || [];
  panel.innerHTML = `
    ${canEdit ? `<details class="portal-card"><summary>Add an item</summary>
      <form class="portal-form" data-add-item>
        <div class="field"><label for="it-name">Name</label><input id="it-name" name="name" required></div>
        <div class="field"><label for="it-cat">Category</label><input id="it-cat" name="category" placeholder="linens, chairs, kitchen" required></div>
        <div class="field"><label for="it-unit">Unit</label><input id="it-unit" name="unit" value="pc"></div>
        <div class="field"><label for="it-qty">Opening quantity</label><input id="it-qty" name="qty_on_hand" type="number" min="0" value="0"></div>
        <div class="field"><label for="it-reorder">Reorder level</label><input id="it-reorder" name="reorder_level" type="number" min="0" value="0"></div>
        ${isOwner() ? `<div class="field"><label for="it-cost">Unit cost</label><input id="it-cost" name="unit_cost" type="number" min="0"></div>` : ""}
        <div class="field"><label for="it-sku">SKU</label><input id="it-sku" name="sku"></div>
        <div class="field"><label for="it-notes">Notes</label><textarea id="it-notes" name="notes" rows="2"></textarea></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save item</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Reorder at</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.name)}${sampleChip(row)}${row.sku ? `<br><span class="muted tiny">${esc(row.sku)}</span>` : ""}</td>
        <td>${esc(row.category || "—")}</td>
        <td>${esc(row.qty_on_hand)} ${esc(row.unit || "")}</td>
        <td>${esc(row.reorder_level ?? "—")}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No items yet", "Add chairs, tables, linens and kitchen supplies.")}
  `;
  formFrom("[data-add-item]", async (formData) => {
    const body = Object.fromEntries(formData);
    body.qty_on_hand = Number(body.qty_on_hand || 0);
    body.reorder_level = Number(body.reorder_level || 0);
    if (body.unit_cost === "") delete body.unit_cost;
    await api("/api/inventory/items", { method: "POST", body });
    window.location.hash = "#/inventory?tab=items";
    await viewInventory();
  });
}

function renderMoves(panel, movesData) {
  const rows = movesData.moves || [];
  panel.innerHTML = rows.length ? `<div class="table-wrap"><table class="data">
    <thead><tr><th>When</th><th>Item</th><th>Type</th><th>Qty</th><th>Event</th></tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td>${esc(String(row.created_at || "").slice(0, 16).replace("T", " "))}</td>
      <td>${esc(row.item_name || "")}${sampleChip(row)}</td>
      <td>${esc(row.kind)}</td>
      <td>${esc(row.signed_qty ?? row.qty)}</td>
      <td>${esc(row.event_client || "—")}</td>
    </tr>`).join("")}</tbody>
  </table></div>` : emptyState("No movements yet", "Issues, returns, damage and deliveries will show here.");
}

function renderAllocations(panel, allocData, itemsData) {
  const rows = allocData.allocations || [];
  const items = (itemsData && itemsData.items) || [];
  const canEdit = role() === "owner" || role() === "admin";
  panel.innerHTML = `
    ${canEdit ? `<details class="portal-card"><summary>Reserve items for an event</summary>
      <form class="portal-form" data-add-alloc>
        <div class="field"><label for="al-event">Event</label><select id="al-event" name="event_id" required></select></div>
        <div class="field"><label for="al-item">Item</label><select id="al-item" name="item_id" required>${optionList(items, "", (i) => i.name)}</select></div>
        <div class="field"><label for="al-qty">Quantity</label><input id="al-qty" name="qty" type="number" min="1" required></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save reservation</button>
      </form></details>` : ""}
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Event</th><th>Item</th><th>Qty</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.event_date || "")} · ${esc(row.event_client || "")}${sampleChip(row)}</td>
        <td>${esc(row.item_name || "")}</td>
        <td>${esc(row.qty)} ${esc(row.unit || "")}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No event reservations", "Reserve chairs, tables and linens for a specific event.")}
  `;
  eventOptions("").then((html) => { const el = panel.querySelector("#al-event"); if (el) el.innerHTML = html.replace('<option value="">None</option>', '<option value="">Pick an event</option>'); });
  formFrom("[data-add-alloc]", async (formData) => {
    const body = Object.fromEntries(formData);
    body.qty = Number(body.qty);
    await api("/api/inventory/allocations", { method: "POST", body });
    await viewInventory();
  });
}

export async function viewAccounting() {
  if (!isOwner()) {
    ctx.main.innerHTML = emptyState("Owner only", "Income, expenses and profit reports are only available to the owner.");
    return;
  }
  const tab = currentTab("expenses");
  const range = params().get("range") || "monthly";
  const [expenses, petty, pnl, cash, profit] = await Promise.all([
    api("/api/expenses"),
    api("/api/petty-cash"),
    api(`/api/accounting/pnl?range=${encodeURIComponent(range)}`),
    api(`/api/accounting/cashflow?range=${encodeURIComponent(range)}`),
    api("/api/accounting/event-profit")
  ]);
  const tabs = [
    { id: "expenses", label: "Expenses" },
    { id: "petty", label: "Petty cash" },
    { id: "pnl", label: "P&L" },
    { id: "cashflow", label: "Cash flow" },
    { id: "profit", label: "Event profit" }
  ];
  ctx.main.innerHTML = `
    ${pageHead("Accounting", "Accounting", "Income, expenses, cash and per-event profit. Sample figures are kept separate.")}
    ${tabBar("accounting", tabs, tab)}
    <div data-acc-panel></div>
  `;
  const panel = ctx.main.querySelector("[data-acc-panel]");
  if (tab === "expenses") renderExpenses(panel, expenses);
  else if (tab === "petty") renderPetty(panel, petty);
  else if (tab === "pnl") renderPnl(panel, pnl, range);
  else if (tab === "cashflow") renderCashflow(panel, cash, range);
  else renderEventProfit(panel, profit);
}

function rangeLinks(route, tab, current) {
  return ["daily", "weekly", "monthly"].map((r) =>
    `<a class="btn btn-ghost" href="#/${route}?tab=${tab}&range=${r}" ${current === r ? 'aria-current="page"' : ""}>${r}</a>`
  ).join("");
}

function renderExpenses(panel, data) {
  const rows = data.expenses || [];
  const categories = data.categories || ["food", "decor", "utilities", "supplies", "labor", "transport", "maintenance", "marketing", "fees", "other"];
  const totals = data.totals || { real: 0, sample: 0 };
  panel.innerHTML = `
    <div class="card-grid cols-2">
      <article class="portal-card"><p class="kicker">Real expenses</p><p class="stat">${money(totals.real)}</p></article>
      <article class="portal-card"><p class="kicker">Sample expenses</p><p class="stat">${money(totals.sample)}</p></article>
    </div>
    <details class="portal-card"><summary>Record an expense</summary>
      <form class="portal-form" data-add-expense>
        <div class="field"><label for="ex-date">Date</label><input id="ex-date" name="date" type="date" value="${todayISO()}" required></div>
        <div class="field"><label for="ex-cat">Category</label><select id="ex-cat" name="category">${categories.map((c) => `<option>${c}</option>`).join("")}</select></div>
        <div class="field"><label for="ex-payee">Payee</label><input id="ex-payee" name="payee"></div>
        <div class="field"><label for="ex-amount">Amount</label><input id="ex-amount" name="amount" type="number" min="1" required></div>
        <div class="field"><label for="ex-method">Method</label><select id="ex-method" name="method"><option>cash</option><option>gcash</option><option>maya</option><option>bank</option><option>card</option><option>check</option></select></div>
        <div class="field"><label for="ex-event">Event</label><select id="ex-event" name="event_id"></select></div>
        <div class="field"><label for="ex-notes">Notes</label><input id="ex-notes" name="notes"></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save expense</button>
      </form></details>
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Date</th><th>Category</th><th>Payee</th><th>Amount</th><th></th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.date)}</td>
        <td>${esc(row.category)}${sampleChip(row)}</td>
        <td>${esc(row.payee || "—")}</td>
        <td>${money(row.amount)}${row.voided_at ? " <span class='muted'>void</span>" : ""}</td>
        <td class="row-actions">${!row.voided_at ? `<button class="btn btn-ghost" type="button" data-void-ex="${esc(row.id)}">Void</button>` : ""}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No expenses yet", "Food, decor, utilities and other costs will appear here.")}
  `;
  eventOptions("").then((html) => { const el = panel.querySelector("#ex-event"); if (el) el.innerHTML = html; });
  formFrom("[data-add-expense]", async (formData) => {
    const body = Object.fromEntries(formData);
    if (!body.event_id) delete body.event_id;
    await api("/api/expenses", { method: "POST", body });
    await viewAccounting();
  });
  panel.querySelectorAll("[data-void-ex]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmAction("Void this expense?", "It will be excluded from totals.");
      if (!ok) return;
      try { await api(`/api/expenses/${btn.dataset.voidEx}/void`, { method: "POST", body: {} }); await viewAccounting(); }
      catch (err) { await openModal({ title: "Could not void", message: err.message, confirmLabel: "OK", cancelLabel: "Close" }); }
    });
  });
}

function renderPetty(panel, data) {
  const rows = data.entries || [];
  const totals = data.totals || { in: 0, out: 0, balance: 0 };
  panel.innerHTML = `
    <div class="card-grid cols-3">
      <article class="portal-card"><p class="kicker">In</p><p class="stat">${money(totals.in)}</p></article>
      <article class="portal-card"><p class="kicker">Out</p><p class="stat">${money(totals.out)}</p></article>
      <article class="portal-card"><p class="kicker">Balance</p><p class="stat">${money(totals.balance)}</p></article>
    </div>
    <details class="portal-card"><summary>New petty cash entry</summary>
      <form class="portal-form" data-add-petty>
        <div class="field"><label for="pc-date">Date</label><input id="pc-date" name="date" type="date" value="${todayISO()}" required></div>
        <div class="field"><label for="pc-kind">Type</label><select id="pc-kind" name="kind"><option value="out">Out</option><option value="in">In</option></select></div>
        <div class="field"><label for="pc-amount">Amount</label><input id="pc-amount" name="amount" type="number" min="1" required></div>
        <div class="field"><label for="pc-reason">Reason</label><input id="pc-reason" name="reason" required></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save entry</button>
      </form></details>
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Date</th><th>Type</th><th>Reason</th><th>Amount</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.date)}</td>
        <td>${esc(row.kind)}${sampleChip(row)}</td>
        <td>${esc(row.reason || "")}</td>
        <td>${money(row.amount)}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No petty cash yet", "Cash in and cash out for small purchases is logged here.")}
  `;
  formFrom("[data-add-petty]", async (formData) => {
    await api("/api/petty-cash", { method: "POST", body: Object.fromEntries(formData) });
    window.location.hash = "#/accounting?tab=petty";
    await viewAccounting();
  });
}

function renderPnl(panel, data, range) {
  panel.innerHTML = `
    <div class="filter-tabs">${rangeLinks("accounting", "pnl", range)}</div>
    <p class="muted">${esc(data.from || "")} to ${esc(data.to || "")}</p>
    <div class="card-grid cols-3">
      <article class="portal-card"><p class="kicker">Income</p><p class="stat">${money(data.income)}</p></article>
      <article class="portal-card"><p class="kicker">Expenses</p><p class="stat">${money(data.expenses)}</p></article>
      <article class="portal-card"><p class="kicker">Net</p><p class="stat">${money(data.net)}</p></article>
    </div>
    ${(data.byCategory || []).length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Category</th><th>Amount</th></tr></thead>
      <tbody>${data.byCategory.map((row) => `<tr><td>${esc(row.category)}</td><td>${money(row.amount)}</td></tr>`).join("")}</tbody>
    </table></div>` : emptyState("No P&L figures", "Income and expenses in this period will appear here.")}
    ${data.sample ? `<p class="muted tiny">Sample income ${money(data.sample.income)} · sample expenses ${money(data.sample.expenses)}</p>` : ""}
  `;
}

function renderCashflow(panel, data, range) {
  const days = data.days || [];
  panel.innerHTML = `
    <div class="filter-tabs">${rangeLinks("accounting", "cashflow", range)}</div>
    <p class="muted">${esc(data.from || "")} to ${esc(data.to || "")}</p>
    <div class="card-grid cols-3">
      <article class="portal-card"><p class="kicker">In</p><p class="stat">${money(data.totals && data.totals.in)}</p></article>
      <article class="portal-card"><p class="kicker">Out</p><p class="stat">${money(data.totals && data.totals.out)}</p></article>
      <article class="portal-card"><p class="kicker">Net</p><p class="stat">${money(data.totals && data.totals.net)}</p></article>
    </div>
    ${days.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Net</th><th>Running</th></tr></thead>
      <tbody>${days.map((row) => `<tr>
        <td>${esc(row.date)}</td><td>${money(row.in)}</td><td>${money(row.out)}</td><td>${money(row.net)}</td><td>${money(row.running)}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No cash flow yet", "Payments, expenses and petty cash will build this report.")}
  `;
}

function renderEventProfit(panel, data) {
  const rows = data.events || [];
  panel.innerHTML = rows.length ? `<div class="table-wrap"><table class="data">
    <thead><tr><th>Date</th><th>Event</th><th>Contract</th><th>Collected</th><th>Direct costs</th><th>Labor</th><th>Margin</th></tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td>${esc(row.date || "")}</td>
      <td>${esc(row.client || row.title || "")}${sampleChip(row)}</td>
      <td>${money(row.contract_total)}</td>
      <td>${money(row.collected)}</td>
      <td>${money(row.direct)}</td>
      <td>${money(row.labor)}</td>
      <td>${money(row.margin)}</td>
    </tr>`).join("")}</tbody>
  </table></div>` : emptyState("No event profit yet", "Once payments and expenses are tied to events, profit will show here.");
}


export async function viewHr() {
  const tab = currentTab(role() === "staff" ? "leave" : "staff");
  if (role() === "staff" && tab !== "leave") {
    window.location.hash = "#/hr?tab=leave";
  }
  const tabs = role() === "staff"
    ? [{ id: "leave", label: "My leave" }]
    : [
        { id: "staff", label: "Staff" },
        { id: "leave", label: "Leave" },
        { id: "payroll", label: "Payroll" },
        { id: "advances", label: "Advances" }
      ];
  const loading = { staff: { staff: [] }, leave: { leave: [] }, payroll: { periods: [] }, advances: { advances: [] } };
  const [staff, leave, payroll, advances] = await Promise.all([
    role() === "staff" ? Promise.resolve(loading.staff) : api("/api/hr/staff"),
    api("/api/hr/leave"),
    (role() === "owner" && (tab === "payroll" || tab === "staff")) ? api("/api/hr/payroll") : Promise.resolve(loading.payroll),
    (isOwner() && tab === "advances") ? api("/api/hr/advances") : Promise.resolve(loading.advances)
  ]);
  ctx.main.innerHTML = `
    ${pageHead("People", "HR", role() === "staff" ? "Request time off and see the status of your leave." : "Staff records, leave, advances and payroll summaries.")}
    ${tabBar("hr", tabs, tab)}
    <div data-hr-panel></div>
  `;
  const panel = ctx.main.querySelector("[data-hr-panel]");
  if (tab === "staff") renderHrStaff(panel, staff);
  else if (tab === "leave") renderLeave(panel, leave, staff);
  else if (tab === "payroll") renderPayroll(panel, payroll);
  else renderAdvances(panel, advances, staff);
}

function renderHrStaff(panel, data) {
  const rows = data.staff || [];
  panel.innerHTML = rows.length ? `<div class="table-wrap"><table class="data">
    <thead><tr><th>Name</th><th>Title</th><th>Type</th>${isOwner() ? "<th>Daily rate</th>" : ""}</tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td>${esc(row.name || "")}${sampleChip(row)}</td>
      <td>${esc(row.title || "")}</td>
      <td>${esc(row.employment || row.employment_type || row.type || "—")}</td>
      ${isOwner() ? `<td>${money(row.daily_rate ?? row.rate)}</td>` : ""}
    </tr>`).join("")}</tbody>
  </table></div>` : emptyState("No staff profiles", "Profiles are created from the Users page and appear here.");
}

function renderLeave(panel, data, staffData) {
  const rows = data.requests || data.leave || [];
  const people = (staffData && staffData.staff) || [];
  const types = data.kinds || data.types || ["vacation", "sick", "emergency", "unpaid", "other"];
  const canManage = role() === "owner" || role() === "admin";
  panel.innerHTML = `
    <details class="portal-card" open><summary>${role() === "staff" ? "Request leave" : "File leave"}</summary>
      <form class="portal-form" data-add-leave>
        ${canManage ? `<div class="field"><label for="lv-staff">Staff</label><select id="lv-staff" name="user_id" required>${optionList(people, "", (p) => p.name)}</select></div>` : ""}
        <div class="field"><label for="lv-type">Type</label><select id="lv-type" name="kind">${types.map((t) => `<option>${t}</option>`).join("")}</select></div>
        <div class="field"><label for="lv-from">From</label><input id="lv-from" name="start_date" type="date" required></div>
        <div class="field"><label for="lv-to">To</label><input id="lv-to" name="end_date" type="date" required></div>
        <div class="field"><label for="lv-reason">Reason</label><input id="lv-reason" name="reason"></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Submit</button>
      </form></details>
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Staff</th><th>Type</th><th>Dates</th><th>Status</th>${canManage ? "<th></th>" : ""}</tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.staff_name || row.name || "")}${sampleChip(row)}</td>
        <td>${esc(row.kind || row.type || "")}</td>
        <td>${esc(row.start_date)} – ${esc(row.end_date)}</td>
        <td><span class="chip">${esc(row.status)}</span></td>
        ${canManage ? `<td class="row-actions">${row.status === "pending" ? `
          <button class="btn btn-solid" type="button" data-leave="${esc(row.id)}" data-status="approved">Approve</button>
          <button class="btn btn-danger" type="button" data-leave="${esc(row.id)}" data-status="denied">Deny</button>` : ""}</td>` : ""}
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No leave requests", role() === "staff" ? "File a request when you need time off." : "Leave requests will appear here.")}
  `;
  formFrom("[data-add-leave]", async (formData) => {
    await api("/api/hr/leave", { method: "POST", body: Object.fromEntries(formData) });
    window.location.hash = "#/hr?tab=leave";
    await viewHr();
  });
  panel.querySelectorAll("[data-leave]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmAction(`${btn.dataset.status === "approved" ? "Approve" : "Deny"} this leave request?`);
      if (!ok) return;
      try {
        await api(`/api/hr/leave/${btn.dataset.leave}`, { method: "PATCH", body: { status: btn.dataset.status } });
        await viewHr();
      } catch (err) {
        await openModal({ title: "Could not update leave", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
      }
    });
  });
}

function renderPayroll(panel, data) {
  if (!isOwner()) {
    panel.innerHTML = emptyState("Owner only", "Payroll summaries are only available to the owner.");
    return;
  }
  const periods = data.periods || [];
  const estimates = data.contributionEstimates;
  panel.innerHTML = `
    ${estimates ? `<p class="muted tiny">Government contributions shown here are estimates (SSS, PhilHealth, Pag-IBIG). Withholding tax is not computed automatically.</p>` : ""}
    <details class="portal-card"><summary>Start a payroll period</summary>
      <form class="portal-form" data-add-pay>
        <div class="field"><label for="pr-from">From</label><input id="pr-from" name="start_date" type="date" required></div>
        <div class="field"><label for="pr-to">To</label><input id="pr-to" name="end_date" type="date" required></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Create period</button>
      </form></details>
    ${periods.length ? periods.map((p) => `
      <article class="portal-card">
        <div class="split-head">
          <div>
            <p class="kicker">${esc(p.status || "draft")}${p.is_sample ? " · SAMPLE" : ""}</p>
            <h3>${esc(p.start_date)} – ${esc(p.end_date)}</h3>
            <p class="muted">${money(p.total_net || p.net)} net · ${esc((p.lines || []).length)} staff</p>
          </div>
          <div class="row-actions">
            ${p.status === "draft" ? `<button class="btn btn-ghost" type="button" data-pay="${esc(p.id)}" data-status="reviewed">Mark reviewed</button>
              <button class="btn btn-solid" type="button" data-pay="${esc(p.id)}" data-status="paid">Mark paid</button>` : ""}
          </div>
        </div>
        ${(p.lines || []).length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>Staff</th><th>Days</th><th>Gross</th><th>Deductions</th><th>Net</th><th></th></tr></thead>
          <tbody>${(p.lines || []).map((line) => `<tr>
            <td>${esc(line.staff_name || line.name || "")}</td>
            <td>${esc(line.days_worked ?? line.days ?? "")}</td>
            <td>${money(line.gross)}</td>
            <td>${money((line.sss || 0) + (line.philhealth || 0) + (line.pagibig || 0) + (line.wtax || 0) + (line.advances || 0))}</td>
            <td>${money(line.net)}</td>
            <td class="row-actions"><button class="btn btn-ghost" type="button" data-payslip="${esc(p.id)}" data-line="${esc(line.id || line.user_id || "")}">Payslip</button></td>
          </tr>`).join("")}</tbody>
        </table></div>` : "<p class='muted'>No lines yet.</p>"}
      </article>
    `).join("") : emptyState("No payroll periods", "Create a date range to compute days worked, advances and net pay.")}
  `;
  formFrom("[data-add-pay]", async (formData) => {
    await api("/api/hr/payroll", { method: "POST", body: Object.fromEntries(formData) });
    window.location.hash = "#/hr?tab=payroll";
    await viewHr();
  });
  panel.querySelectorAll("[data-pay]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmAction(`Mark this payroll as ${btn.dataset.status}?`, btn.dataset.status === "paid" ? "A paid period cannot be changed later." : "");
      if (!ok) return;
      try {
        await api(`/api/hr/payroll/${btn.dataset.pay}`, { method: "PATCH", body: { status: btn.dataset.status } });
        await viewHr();
      } catch (err) {
        await openModal({ title: "Could not update payroll", message: err.message, confirmLabel: "OK", cancelLabel: "Close" });
      }
    });
  });
  panel.querySelectorAll("[data-payslip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const period = periods.find((p) => p.id === btn.dataset.payslip);
      const line = (period && period.lines || []).find((l) => String(l.id || l.user_id) === btn.dataset.line);
      if (!period || !line) return;
      printDocument({
        title: "Payslip",
        kicker: `${period.start_date} to ${period.end_date}`,
        heading: line.staff_name || line.name || "Staff",
        rows: [
          ["Days worked", line.days_worked ?? line.days ?? ""],
          ["Gross", money(line.gross)],
          ["SSS", money(line.sss)],
          ["PhilHealth", money(line.philhealth)],
          ["Pag-IBIG", money(line.pagibig)],
          ["Withholding tax", money(line.wtax)],
          ["Advances", money(line.advances)],
          ["Net pay", money(line.net)]
        ]
      });
    });
  });
}

function renderAdvances(panel, data, staffData) {
  if (!isOwner()) {
    panel.innerHTML = emptyState("Owner only", "Salary advances are only available to the owner.");
    return;
  }
  const rows = data.advances || [];
  const people = (staffData && staffData.staff) || [];
  panel.innerHTML = `
    <details class="portal-card"><summary>Record an advance</summary>
      <form class="portal-form" data-add-adv>
        <div class="field"><label for="ad-staff">Staff</label><select id="ad-staff" name="user_id" required>${optionList(people, "", (p) => p.name)}</select></div>
        <div class="field"><label for="ad-date">Date</label><input id="ad-date" name="date" type="date" value="${todayISO()}" required></div>
        <div class="field"><label for="ad-amount">Amount</label><input id="ad-amount" name="amount" type="number" min="1" required></div>
        <div class="field"><label for="ad-notes">Reason</label><input id="ad-notes" name="reason"></div>
        <div data-form-error></div>
        <button class="btn btn-solid" type="submit">Save advance</button>
      </form></details>
    ${rows.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>Date</th><th>Staff</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${esc(row.date)}</td>
        <td>${esc(row.staff_name || row.name || "")}${sampleChip(row)}</td>
        <td>${money(row.amount)}</td>
        <td>${esc(row.status || (row.deducted_at ? "deducted" : "open"))}</td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("No advances", "Salary advances will be deducted from a later payroll.")}
  `;
  formFrom("[data-add-adv]", async (formData) => {
    await api("/api/hr/advances", { method: "POST", body: Object.fromEntries(formData) });
    window.location.hash = "#/hr?tab=advances";
    await viewHr();
  });
}

export async function viewOpsReports() {
  const range = params().get("range") || "monthly";
  const summary = await api(`/api/reports/summary?range=${encodeURIComponent(range)}`);
  const isOwn = isOwner();
  const tables = [
    { id: "events", label: "Events" },
    { id: "requests", label: "Requests" },
    { id: "attendance", label: "Attendance" },
    ...(isOwn ? [
      { id: "finances", label: "Finances" },
      { id: "leads", label: "Leads" },
      { id: "quotes", label: "Quotes" },
      { id: "payments", label: "Payments" },
      { id: "expenses", label: "Expenses" }
    ] : []),
    { id: "inventory", label: "Inventory" },
    { id: "housekeeping", label: "Housekeeping" }
  ];
  const kpis = { events: summary.events, requests: summary.requests, collected: summary.income ?? summary.collected, expenses: summary.expenses, ...(summary.kpis || {}) };
  ctx.main.innerHTML = `
    ${pageHead("Reports", "Reports", "Daily, weekly and monthly summaries, plus CSV and Excel downloads.")}
    <div class="filter-tabs">${rangeLinks("reports", "", range).replace(/tab=&/g, "")}</div>
    <p class="muted">${esc(summary.from || "")} to ${esc(summary.to || "")}</p>
    <div class="card-grid cols-4">
      <article class="portal-card"><p class="kicker">Events</p><p class="stat">${esc(kpis.events ?? kpis.eventCount ?? "—")}</p></article>
      <article class="portal-card"><p class="kicker">Requests</p><p class="stat">${esc(kpis.requests ?? kpis.requestCount ?? "—")}</p></article>
      ${isOwn ? `<article class="portal-card"><p class="kicker">Collected</p><p class="stat">${money(kpis.collected ?? kpis.revenue ?? kpis.income)}</p></article>
      <article class="portal-card"><p class="kicker">Expenses</p><p class="stat">${money(kpis.expenses)}</p></article>` : ""}
    </div>
    <div class="page-head"><h2>Downloads</h2></div>
    <div class="card-grid cols-2">
      ${tables.map((item) => `
        <article class="portal-card">
          <h3>${esc(item.label)}</h3>
          <div class="row-actions">
            <button class="btn btn-solid" type="button" data-download="${esc(item.id)}" data-format="csv">CSV</button>
            <button class="btn btn-ghost" type="button" data-download="${esc(item.id)}" data-format="xlsx">Excel</button>
          </div>
        </article>
      `).join("")}
    </div>
    <p class="row-actions"><button class="btn btn-ghost" type="button" data-print-summary>Print this summary</button></p>
    ${isOwn ? `<details class="portal-card"><summary>Google Sheets (optional)</summary>
      <p class="muted">A live Sheets mirror is not required. Use the CSV or Excel files above, or a later Apps Script that sends a key in a header, never in the URL. Keep any key in Script Properties only.</p>
    </details>` : ""}
  `;
  ctx.main.querySelectorAll("[data-download]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try { await ctx.downloadReport(btn.dataset.download, btn.dataset.format); }
      catch (err) { await openModal({ title: "Download failed", message: err.message, confirmLabel: "OK", cancelLabel: "Close" }); }
    });
  });
  ctx.main.querySelector("[data-print-summary]")?.addEventListener("click", () => {
    printDocument({
      title: "Period summary",
      kicker: `${summary.from || ""} to ${summary.to || ""} (${range})`,
      heading: "Mi Granja Events",
      rows: [
        ["Events", kpis.events ?? kpis.eventCount ?? ""],
        ["Requests", kpis.requests ?? kpis.requestCount ?? ""],
        ...(isOwn ? [["Collected", money(kpis.collected ?? kpis.revenue ?? kpis.income)], ["Expenses", money(kpis.expenses)]] : [])
      ]
    });
  });
}

export async function viewSettings() {
  if (!isOwner()) {
    ctx.main.innerHTML = emptyState("Owner only", "Settings are only available to the owner.");
    return;
  }
  const sample = await api("/api/sample").catch(() => ({ hasSample: false }));
  ctx.main.innerHTML = `
    ${pageHead("Workspace", "Settings", "Account and sample-data tools.")}
    <article class="portal-card">
      <p class="kicker">Sample data</p>
      <h2>Remove sample data</h2>
      ${sample.hasSample
        ? `<p>This permanently deletes every record marked SAMPLE: events, requests, clients, quotes, payments, housekeeping, inventory, expenses, payroll and sample staff accounts. Your owner account and any real records stay. Type <strong>REMOVE</strong> to confirm.</p>
           <form class="portal-form" data-remove-sample>
             <div class="field"><label for="rm-confirm">Type REMOVE to confirm</label><input id="rm-confirm" name="confirm" autocomplete="off" required></div>
             <div data-form-error></div>
             <button class="btn btn-danger" type="submit">Remove sample data</button>
           </form>`
        : `<p class="muted">There is no sample data in this workspace.</p>`}
    </article>
  `;
  const form = ctx.main.querySelector("[data-remove-sample]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errEl = form.querySelector("[data-form-error]");
    if (errEl) errEl.textContent = "";
    const typed = String(new FormData(form).get("confirm") || "").trim();
    if (typed !== "REMOVE") {
      if (errEl) errEl.textContent = "Type REMOVE in capital letters to confirm.";
      return;
    }
    const ok = await confirmAction("Remove all SAMPLE records?", "This cannot be undone. Your owner account and any real records will stay.");
    if (!ok) return;
    try {
      await api("/api/sample", { method: "DELETE" });
      await viewSettings();
    } catch (err) {
      if (errEl) errEl.textContent = err.message || "Could not remove sample data.";
    }
  });
}

