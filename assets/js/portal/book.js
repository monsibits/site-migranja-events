import { api, formatDate, todayISO } from "./api.js";
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

const EVENT_TYPES = ["Wedding", "Debut", "Birthday", "Christening", "Corporate", "Other"];
const VENUES = ["Any", "Ballroom", "The Nook", "Amore Garden"];

async function draw() {
  monthTitle.textContent = monthLabel(year, month);
  try {
    days = await loadMonthDays(year, month);
  } catch (err) {
    days = {};
    panel.innerHTML = `<div class="portal-card"><p class="form-error">${escape(err.message)}</p></div>`;
  }
  renderCalendar(calendarRoot, {
    year,
    month,
    days,
    selected,
    onSelect: (iso) => {
      selected = iso;
      draw();
    }
  });
  renderPanel();
}

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
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
        <p class="muted">This calendar shows only whether a date is available, booked, or pending. Client names, packages, and prices stay private.</p>
      </div>
    `;
    return;
  }

  if (statusOf(selected) !== "available" || selected < today) {
    panel.innerHTML = `
      <div class="portal-card">
        <p class="kicker">${formatDate(selected, { weekday: "long" })}</p>
        <h2>This date is not open</h2>
        <p class="muted">Please pick another available date.</p>
      </div>
    `;
    return;
  }

  const typeOptions = EVENT_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("");
  const venueOptions = VENUES.map((venue) => `<option value="${venue}">${venue}</option>`).join("");

  panel.innerHTML = `
    <div class="portal-card">
      <p class="kicker">Available</p>
      <h2>Request ${formatDate(selected, { weekday: "long" })}</h2>
      <p class="muted tiny">Send a request and we will get back to you to confirm the date. Submitting this holds the date as pending until we approve or decline it.</p>
      <form class="portal-form" data-book-form>
        <input type="hidden" name="date" value="${selected}">
        <div class="field">
          <label for="name">Your name</label>
          <input id="name" name="name" type="text" autocomplete="name" required maxlength="80">
        </div>
        <div class="field">
          <label for="contact">Mobile or email</label>
          <input id="contact" name="contact" type="text" autocomplete="tel" required maxlength="80">
        </div>
        <div class="field">
          <label for="type">Event type</label>
          <select id="type" name="type" required>${typeOptions}</select>
        </div>
        <div class="field">
          <label for="pax">Estimated guests</label>
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
        <p class="form-error" data-error hidden></p>
        <button class="btn btn-solid" type="submit">Send request</button>
      </form>
    </div>
  `;

  const form = panel.querySelector("[data-book-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const error = panel.querySelector("[data-error]");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    error.hidden = true;
    try {
      const date = String(data.get("date"));
      await api("/api/requests", {
        method: "POST",
        body: {
          date,
          name: String(data.get("name") || "").trim(),
          contact: String(data.get("contact") || "").trim(),
          type: String(data.get("type") || "").trim(),
          pax: Number(data.get("pax")) || 0,
          venue: String(data.get("venue") || "Any"),
          notes: String(data.get("notes") || "").trim()
        }
      });
      selected = date;
      await draw();
      panel.innerHTML = `
        <div class="portal-card form-success">
          <p class="kicker">Request received</p>
          <h2>Thank you</h2>
          <p>${formatDate(date, { weekday: "long" })} is now marked as pending. Our team will be in touch to confirm.</p>
        </div>
      `;
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message;
      button.disabled = false;
      await draw();
    }
  });
}

document.querySelectorAll("[data-month-shift]").forEach((button) => {
  button.addEventListener("click", async () => {
    const next = shiftMonth(year, month, Number(button.dataset.monthShift));
    year = next.year;
    month = next.month;
    await draw();
  });
});

draw();
