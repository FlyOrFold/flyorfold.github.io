// Home page: this weekend's outlook per site from the latest run, with a trend line of every run.
import {
  addDays, dayMonth, isSample, latestIssued, loadForecasts, loadSites, localToday,
  monthsAround, shortDate, signedPts, weekendHistory, weekendSaturday,
} from "./data.js";
import { el, withSample } from "./common.js";
import { dayTile } from "./day-tile.js";

const outlook = document.getElementById("outlook");
const meta = document.getElementById("outlook-meta");

/** Compact tile: latest value, a sparkline of every run, and the change since the previous run. */
function outlookTile(label, color, row, prevRow, history) {
  let detail = "Not forecast";
  if (row && !prevRow) detail = "No earlier run";
  else if (row) {
    const d = row.p - prevRow.p;
    detail = Math.round(d * 100) === 0 ? "No change since last run" : `${d > 0 ? "▲" : "▼"} ${signedPts(d)} since last run`;
  }
  return dayTile({ size: "compact", label, color, value: row ? row.p : null, spark: history, detail });
}

async function renderOutlook() {
  const today = localToday();
  const sat = weekendSaturday(today);
  const sun = addDays(sat, 1);
  const [sites, rows] = await Promise.all([loadSites(), loadForecasts(monthsAround(today))]);
  const latest = latestIssued(rows);
  outlook.replaceChildren();

  if (!latest) {
    meta.textContent = "";
    outlook.append(el("div", { class: "card empty" },
      el("p", {}, "The forecast log has no runs yet. The daily job writes its first rows soon."),
      isSample ? null : el("a", { href: "index.html?sample" }, "Preview with sample data")));
    return;
  }

  const issuedDates = [...new Set(rows.map((r) => r.issued))].sort();
  const prevIssued = issuedDates[issuedDates.length - 2];
  meta.textContent = `${dayMonth(sat)}–${dayMonth(sun)} · latest run ${shortDate(latest)}`;

  const find = (issued, site, target) => rows.find((r) => r.issued === issued && r.site === site && r.target === target);
  const siteIds = new Set(rows.filter((r) => r.issued === latest).map((r) => r.site));
  const shown = sites.filter((s) => siteIds.has(s.id));
  for (const s of shown) {
    const hist = weekendHistory(rows, s.id, sat);
    const series = (key) => hist.filter((pt) => pt[key]).map((pt) => pt[key].p);
    const href = withSample(`forecast.html?site=${encodeURIComponent(s.id)}&weekend=${sat}`);
    outlook.append(el("article", { class: "card outlook-card" },
      el("h3", {}, el("a", { href }, s.name)),
      el("div", { class: "muted small" }, "Chance of a flyable day"),
      el("div", { class: "days" },
        outlookTile(`Sat ${dayMonth(sat)}`, "var(--series-sat)", find(latest, s.id, sat), prevIssued && find(prevIssued, s.id, sat), series("sat")),
        outlookTile(`Sun ${dayMonth(sun)}`, "var(--series-sun)", find(latest, s.id, sun), prevIssued && find(prevIssued, s.id, sun), series("sun"))),
      el("p", { class: "small", style: "margin:10px 0 0" }, el("a", { href }, "How this forecast has changed"))));
  }
  if (!shown.length) outlook.append(el("p", { class: "muted" }, "No sites in the latest run."));
}

renderOutlook().catch((e) => {
  console.error(e);
  outlook.replaceChildren(el("p", { class: "muted" }, "Forecasts could not be loaded. Try again later."));
});

