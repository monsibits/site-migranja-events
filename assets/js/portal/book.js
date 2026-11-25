import { api, formatDate, todayISO, isValidContact, TURNSTILE_SITE_KEY, escapeHtml as esc } from "./api.js";
import { loadMonthDays, monthLabel, renderCalendar, shiftMonth } from "./calendar-ui.js";

const calendarRoot = document.querySelector("[data-calendar]");
const panel = document.querySelector("[data-panel]");
const monthTitle = document.querySelector("[data-month-title]");
const today = todayISO();
const start = new Date(`${today}T00:00:00`);
let year = start.getFullYear();
let month = start.getMonth();
let selected = null;
let days = {};
let turnstileWidget = null;

const EVENT_TYPES = ["Wedding", "Debut", "Birthday", "Christening", "Corporate", "Other"];
const VENUES = ["Any", "Ballroom", "The Nook", "Amore Garden"];

function loadTurnstileScript() {
  if (document.getElementById("cf-turnstile-api")) return;
  const script = document.createElement("script");
  script.id = "cf-turnstile-api";
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  document.head.append(script);
}

function renderTurnstile(host) {
  const startWidget = () => {
    if (!window.turnstile || !host) return;
    if (turnstileWidget !== null) {
      try { window.turnstile.remove(turnstileWidget); } catch { /* ignore */ }
      turnstileWidget = null;
    }
    turnstileWidget = window.turnstile.render(host, { sitekey: TURNSTILE_SITE_KEY });
  };
  if (window.turnstile) startWidget();
  else window.addEventListener("load", startWidget, { once: true });
  const timer = window.setInterval(() => {
    if (window.turnstile) {
      window.clearInterval(timer);
      startWidget();
    }
  }, 200);
  window.setTimeout(() => window.clearInterval(timer), 8000);
}

async function draw() {
  monthTitle.textContent = monthLabel(year, month);
  try {
    days = await loadMonthDays(year, month);
  } catch (err) {
    days = {};
    panel.innerHTML = `<div class="portal-card"><p class="form-error">${esc(err.message)}</p><p><button class="btn btn-solid" type="button" data-retry-cal>Try again</button></p></div>`;
    panel.querySelector("[data-retry-cal]")?.addEventListener("click", () => draw());
  }
  renderCalendar(calendarRoot, {
    year,
    month,
    days,
    selected,
    onSelect: (iso) => {
      selected = iso;
      renderPanel();
      renderCalendar(calendarRoot, { year, month, days, selected, onSelect: (next) => { selected = next; renderPanel(); } });
    }
  });
  renderPanel();
}

function statusOf(iso) {
  return days[iso] || "available";
}

function renderPanel() {
  if (!selected) {
    panel.innerHTML = `
      <div class="portal-card">
        <p class="kicker">Booking request</p>
        <h2>Pick an open date</h2>
        <p class="muted">This calendar shows only whether a date is available or booked. Client names, packages, and prices stay private.</p>
      </div>
    `;
    return;
  }

  if (statusOf(selected) !== "available" || selected < today) {
    panel.innerHTML = `
      <div class="portal-card">
        <p class="kicker">${esc(formatDate(selected, { weekday: "long" }))}</p>
        <h2>This date is not open</h2>
        <p class="muted">Please pick another available date.</p>
      </div>
    `;
    return;
  }

  const typeOptions = EVENT_TYPES.map((type) => `<option value="${esc(type)}">${esc(type)}</option>`).join("");
  const venueOptions = VENUES.map((venue) => `<option value="${esc(venue)}">${esc(venue)}</option>`).join("");

  panel.innerHTML = `
    <div class="portal-card">
      <p class="kicker">Available</p>
      <h2>Request ${esc(formatDate(selected, { weekday: "long" }))}</h2>
      <p class="muted tiny">Send a request and we will get back to you to confirm the date. Submitting this does not lock the date until we approve it.</p>
      <form class="portal-form" data-book-form novalidate>
        <input type="hidden" name="date" value="${esc(selected)}">
        <div class="hp" aria-hidden="true">
          <label for="company">Company</label>
          <input id="company" name="company" tabindex="-1" autocomplete="off">
        </div>
        <div class="field">
          <label for="name">Your name <span class="req">required</span></label>
          <input id="name" name="name" type="text" autocomplete="name" required maxlength="80">
        </div>
        <div class="field">
          <label for="contact">Mobile or email <span class="req">required</span></label>
          <input id="contact" name="contact" type="text" autocomplete="tel" required maxlength="80">
          <p class="tiny muted">Use a Philippine mobile number (09… or +639…) or an email address.</p>
        </div>
        <div class="field">
          <label for="type">Event type <span class="req">required</span></label>
          <select id="type" name="type" required>${typeOptions}</select>
        </div>
        <div class="field">
          <label for="pax">Estimated guests <span class="req">required</span></label>
          <input id="pax" name="pax" type="number" min="1" max="500" required value="80">
        </div>
        <div class="field">
          <label for="venue">Preferred space</label>
          <select id="venue" name="venue">${venueOptions}</select>
        </div>
        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes" maxlength="500"></textarea>
        </div>
        <div class="field">
          <div data-turnstile></div>
        </div>
        <p class="form-error" data-error hidden></p>
        <button class="btn btn-solid" type="submit">Send request</button>
      </form>
    </div>
  `;

  loadTurnstileScript();
  renderTurnstile(panel.querySelector("[data-turnstile]"));

  const form = panel.querySelector("[data-book-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const error = panel.querySelector("[data-error]");
    const button = form.querySelector("button[type=submit]");
    const name = String(data.get("name") || "").trim();
    const contact = String(data.get("contact") || "").trim();
    const type = String(data.get("type") || "").trim();
    const pax = Number(data.get("pax"));
    const messages = [];
    if (!name) messages.push("Please enter your name.");
    if (!contact) messages.push("Please enter a mobile number or email.");
    else if (!isValidContact(contact)) messages.push("Please enter a valid email or Philippine mobile number.");
    if (!type) messages.push("Please choose an event type.");
    if (!Number.isInteger(pax) || pax < 1 || pax > 500) messages.push("Please enter the number of guests.");
    const token = window.turnstile && turnstileWidget !== null
      ? window.turnstile.getResponse(turnstileWidget)
      : "";
    if (!token) messages.push("Please confirm you are not a robot.");
    if (messages.length) {
      error.hidden = false;
      error.textContent = messages.join(" ");
      return;
    }
    button.disabled = true;
    button.textContent = "Sending…";
    error.hidden = true;
    try {
      const date = String(data.get("date"));
      await api("/api/requests", {
        method: "POST",
        body: {
          date,
          name,
          contact,
          type,
          pax,
          venue: String(data.get("venue") || "Any"),
          notes: String(data.get("notes") || "").trim(),
          company: String(data.get("company") || ""),
          turnstileToken: token
        }
      });
      selected = date;
      await draw();
      panel.innerHTML = `
        <div class="portal-card form-success">
          <p class="kicker">Request received</p>
          <h2>Thank you</h2>
          <p>We received your request for ${esc(formatDate(date, { weekday: "long" }))}. Our team will be in touch to confirm the date.</p>
        </div>
      `;
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message;
      button.disabled = false;
      button.textContent = "Send request";
      if (window.turnstile && turnstileWidget !== null) window.turnstile.reset(turnstileWidget);
    }
  });
}

document.querySelectorAll("[data-month-shift]").forEach((button) => {
  button.addEventListener("click", async () => {
    const next = shiftMonth(year, month, Number(button.dataset.monthShift));
    year = next.year;
    month = next.month;
    selected = null;
    await draw();
  });
});

loadTurnstileScript();
draw();
