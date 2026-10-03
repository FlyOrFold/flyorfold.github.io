// Home page: this weekend's outlook per site from the latest run, with a trend line of every run.
import {
  addDays, dayMonth, isSample, latestIssued, loadForecasts, loadSites, localToday,
  monthsAround, pct, shortDate, weekendHistory, weekendSaturday,
} from "./data.js";
import { el, withSample } from "./common.js";

const NS = "http://www.w3.org/2000/svg";

/**
 * Sparkline of one day's chance across runs, on a fixed 0–100% scale so tiles compare.
 * Stretches to the tile width; strokes stay 2px via non-scaling-stroke.
 */
function sparkline(values, color, label) {
  const W = 120, H = 30, pad = 3;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "spark");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  const x = (i) => (values.length < 2 ? W : (i / (values.length - 1)) * W);
  const y = (p) => pad + (1 - p) * (H - 2 * pad);
  const add = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    n.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(n);
  };
  add("line", { x1: 0, x2: W, y1: y(0), y2: y(0), style: "stroke: var(--line); stroke-width: 1" });
  if (values.length > 1) {
    add("path", {
      d: values.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(""),
      fill: "none", style: `stroke: ${color}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round`,
    });
  }
  // End dot: a zero-length round-capped stroke stays circular when the viewBox stretches.
  const last = values.length - 1;
  add("path", { d: `M${x(last)},${y(values[last])}h0`, style: `stroke: ${color}; stroke-width: 7; stroke-linecap: round` });
  return svg;
}

const outlook = document.getElementById("outlook");
const meta = document.getElementById("outlook-meta");

function dayTile(label, color, row, prevRow, history) {
  let delta = "No earlier run";
  if (row && prevRow) {
    const d = Math.round((row.p - prevRow.p) * 100);
    delta = d === 0 ? "No change since last run" : `${d > 0 ? "▲ +" : "▼ "}${d} pts since last run`;
  }
  return el("div", { class: "day" },
    el("div", { class: "label" }, el("i", { class: "key", style: `background:${color}` }), label),
    el("div", { class: "value" }, row ? pct(row.p) : "–"),
    history.length ? sparkline(history, color, `${label}, by run: ${history.map(pct).join(", ")}`) : null,
    el("div", { class: "delta" }, row ? delta : "Not forecast"));
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
        dayTile(`Sat ${dayMonth(sat)}`, "var(--series-sat)", find(latest, s.id, sat), prevIssued && find(prevIssued, s.id, sat), series("sat")),
        dayTile(`Sun ${dayMonth(sun)}`, "var(--series-sun)", find(latest, s.id, sun), prevIssued && find(prevIssued, s.id, sun), series("sun"))),
      el("p", { class: "small", style: "margin:10px 0 0" }, el("a", { href }, "How this forecast has changed"))));
  }
  if (!shown.length) outlook.append(el("p", { class: "muted" }, "No sites in the latest run."));
}

renderOutlook().catch((e) => {
  console.error(e);
  outlook.replaceChildren(el("p", { class: "muted" }, "Forecasts could not be loaded. Try again later."));
});

