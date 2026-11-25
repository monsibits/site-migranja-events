import { api, formatDate, todayISO } from "./api.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthLabel(year, month) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month, 1));
}

export function shiftMonth(year, month, delta) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export async function loadMonthDays(year, month) {
  const data = await api(`/api/calendar?year=${year}&month=${month + 1}`);
  return data.days || {};
}

export function renderCalendar(container, { year, month, days, selected, onSelect }) {
  const today = todayISO();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdayRow = WEEKDAYS.map((day) => `<span>${day}</span>`).join("");
  const cells = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push(`<span class="cal__day is-empty" aria-hidden="true"></span>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = days[iso] || "available";
    const isPast = iso < today;
    const isToday = iso === today;
    const isSelected = selected === iso;
    const canPick = status === "available" && !isPast;
    const classes = [
      "cal__day",
      `is-${status}`,
      isPast && status === "available" ? "is-past" : "",
      isToday ? "is-today" : "",
      isSelected ? "is-selected" : ""
    ].filter(Boolean).join(" ");

    let tag = "";
    let statusLabel = "PAST";
    if (!isPast && status === "available") { tag = "OPEN"; statusLabel = "OPEN"; }
    else if (status === "booked") { tag = "BOOKED"; statusLabel = "BOOKED"; }
    else if (status === "pending") { tag = "PENDING"; statusLabel = "PENDING"; }
    const visible = tag ? `${day} ${tag}` : String(day);
    const label = `${visible}, ${formatDate(iso, { weekday: "long" })}, ${statusLabel}`;

    cells.push(`
      <button
        type="button"
        class="${classes}"
        data-date="${iso}"
        aria-label="${label}"
        aria-pressed="${isSelected ? "true" : "false"}"
        ${canPick ? "" : "disabled"}
      >
        <span class="num">${day}</span>
        <span class="tag" aria-hidden="true">${tag}</span>
      </button>
    `);
  }

  container.innerHTML = `
    <div class="cal">
      <div class="cal__weekdays">${weekdayRow}</div>
      <div class="cal__days">${cells.join("")}</div>
    </div>
  `;

  if (!container.dataset.calBound) {
    container.dataset.calBound = "1";
    container.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-date]");
      if (!button || button.disabled) return;
      if (typeof container._onSelectDate === "function") container._onSelectDate(button.dataset.date);
    });
  }
  container._onSelectDate = onSelect;
}
