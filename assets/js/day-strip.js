// The 14-day strip: each day's newest forecast as a shaded cell, two rows of seven.
// Full size on the forecast page (cells are buttons that chart the day), mini on the home page
// (cells link to the forecast page). Days before today are hatched: their last forecast, not an outcome.
import { pct, shortDate, weekdayShort } from "./data.js";
import { el } from "./common.js";

/**
 * @param {object} o
 * @param {string[]} o.days       target dates, oldest first (dayWindow())
 * @param {Map} o.latest          target date -> newest row (latestByTarget())
 * @param {string} o.today
 * @param {string} o.label        accessible name for the grid
 * @param {string|null} [o.selected]  charted day (solid outline)
 * @param {string|null} [o.compare]   compared day (dashed outline)
 * @param {(day: string) => void} [o.onPick]  makes cells buttons
 * @param {(day: string) => string} [o.href]  makes cells links
 * @param {boolean} [o.mini]
 */
export function dayStrip({ days, latest, today, label, selected = null, compare = null, onPick = null, href = null, mini = false }) {
  const grid = el("div", { class: `cal${mini ? " mini" : ""}`, role: "table", "aria-label": label });
  grid.append(el("div", { class: "cal-row cal-head", role: "row" },
    ...days.slice(0, 7).map((d) => el("div", { class: "cal-dow", role: "columnheader" }, weekdayShort(d)))));

  let row = null;
  days.forEach((day, i) => {
    if (i % 7 === 0) { row = el("div", { class: "cal-row", role: "row" }); grid.append(row); }
    const r = latest.get(day);
    const share = r ? Math.round(r.p * 100) : 0;
    // Above 55% the Sky shading is dark enough to need light text.
    const cls = ["cal-cell", r && r.p > 0.55 && "strong", day < today && "past", day === today && "today",
      day === selected && "selected", day === compare && "compare"].filter(Boolean).join(" ");
    const when = day === today ? "Today" : String(Number(day.slice(8)));
    const content = [el("span", { class: "cal-date" }, when), el("b", {}, r ? pct(r.p) : "–")];
    const title = `${shortDate(day)}: ${r ? `${pct(r.p)} (run of ${shortDate(r.issued)})` : "no forecast"}`;
    const attrs = {
      class: cls, role: "cell", title,
      style: `--share: ${share}%`,
    };
    const name = `${shortDate(day)}${day === today ? " (today)" : ""}, ${r ? pct(r.p) : "no forecast"}`;
    if (onPick) {
      const btn = el("button", { type: "button", "aria-label": `${name}. Chart this day`, "aria-pressed": String(day === selected) }, ...content);
      btn.addEventListener("click", () => onPick(day));
      row.append(el("div", attrs, btn));
    } else if (href) {
      row.append(el("div", attrs, el("a", { href: href(day), "aria-label": `${name}. See how this forecast changed` }, ...content)));
    } else {
      row.append(el("div", attrs, ...content));
    }
  });
  return grid;
}

/** Colour ramp key under a strip, with an optional note on the right. */
export function stripScale(note = null) {
  return el("div", { class: "scale", "aria-hidden": "true" }, "0%",
    el("span", { class: "ramp", style: "background: linear-gradient(90deg, var(--surface-2), var(--sky))" }), "100%",
    el("span", { class: "scale-past" }, el("i", { class: "past-key" }), "Past: last forecast made"),
    note ? el("span", { class: "scale-note" }, note) : null);
}
