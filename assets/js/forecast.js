// Forecast page: run-by-run timeline for one site and weekend, plus the latest 14-day outlook.
import {
  addDays, dayMonth, describeTrend, isSample, latestIssued, loadForecasts, loadSites, localToday,
  monthOf, monthsAround, pct, shortDate, toDate, weekendHistory, weekendSaturday, weekendsWithData,
} from "./data.js";
import { el } from "./common.js";
import { renderTimeline, timelineTable } from "./chart.js";
import { siteCard } from "./site-card.js";
import { distanceLabel, getHome } from "./location.js";

const $ = (id) => document.getElementById(id);
const siteSel = $("site"), weekendSel = $("weekend");
const params = new URLSearchParams(location.search);
const today = localToday();
const upcoming = weekendSaturday(today);

let sites = [], rows = [], cleanup = null;

function weekendLabel(sat) {
  const tag = sat === upcoming ? " (this weekend)" : sat === addDays(upcoming, 7) ? " (next weekend)" : "";
  return `${dayMonth(sat)}–${dayMonth(addDays(sat, 1))}${tag}`;
}

function fillWeekends(siteId, wanted) {
  const list = new Set(weekendsWithData(rows, siteId));
  list.add(upcoming);
  const sorted = [...list].sort().reverse();
  weekendSel.replaceChildren(...sorted.map((s) => el("option", { value: s }, weekendLabel(s))));
  weekendSel.value = sorted.includes(wanted) ? wanted : upcoming;
}

function syncURL() {
  const p = new URLSearchParams();
  if (isSample) p.set("sample", "");
  p.set("site", siteSel.value);
  p.set("weekend", weekendSel.value);
  history.replaceState(null, "", `?${p.toString().replace("sample=&", "sample&")}`);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Latest run's 14 days as a Mon–Sun calendar, so weekends always sit in the last two columns. */
function renderStrip(site, selectedSat) {
  const box = $("strip");
  const siteRows = rows.filter((r) => r.site === site.id);
  const latest = latestIssued(siteRows);
  if (!latest) {
    $("strip-sub").textContent = "";
    box.replaceChildren(el("p", { class: "empty" }, "No runs for this site yet."));
    return;
  }
  $("strip-sub").textContent = `Run of ${shortDate(latest)}`;
  const latestRows = siteRows.filter((r) => r.issued === latest).sort((a, b) => (a.target < b.target ? -1 : 1));
  const mondayIndex = (iso) => (toDate(iso).getUTCDay() + 6) % 7;
  const selected = new Set([selectedSat, addDays(selectedSat, 1)]);

  const grid = el("div", { class: "cal", role: "table", "aria-label": `Chance of a flyable day from the run of ${shortDate(latest)}` });
  const head = el("div", { class: "cal-row cal-head", role: "row" },
    ...WEEKDAYS.map((d, i) => el("div", { class: `cal-dow${i >= 5 ? " wknd" : ""}`, role: "columnheader" }, d)));
  grid.append(head);

  let row = el("div", { class: "cal-row", role: "row" });
  for (let i = 0; i < mondayIndex(latestRows[0].target); i++) row.append(el("div", { class: "cal-cell blank", role: "cell" }));
  for (const r of latestRows) {
    if (row.children.length === 7) { grid.append(row); row = el("div", { class: "cal-row", role: "row" }); }
    const dow = mondayIndex(r.target);
    const isWknd = dow >= 5;
    const share = Math.round(r.p * 100);
    const sat = isWknd ? (dow === 5 ? r.target : addDays(r.target, -1)) : null;
    const attrs = {
      class: `cal-cell${isWknd ? " wknd" : ""}${selected.has(r.target) ? " selected" : ""}`,
      role: "cell",
      style: `--share: ${share}%; color: ${r.p > 0.55 ? "#fff" : "var(--text)"}`,
      title: `${shortDate(r.target)}: ${pct(r.p)} (${r.n} members)`,
    };
    const content = [el("span", { class: "cal-date" }, String(Number(r.target.slice(8)))), el("b", {}, pct(r.p))];
    if (sat && [...weekendSel.options].some((o) => o.value === sat)) {
      const btn = el("button", { type: "button", "aria-label": `${shortDate(r.target)}, ${pct(r.p)}. Show this weekend` }, ...content);
      btn.addEventListener("click", () => { weekendSel.value = sat; render(); $("chart-h").scrollIntoView({ behavior: "smooth", block: "start" }); });
      row.append(el("div", attrs, btn));
    } else {
      row.append(el("div", attrs, ...content));
    }
  }
  while (row.children.length < 7) row.append(el("div", { class: "cal-cell blank", role: "cell" }));
  grid.append(row);

  box.replaceChildren(grid,
    el("div", { class: "scale", "aria-hidden": "true" }, "0%",
      el("span", { class: "ramp", style: "background: linear-gradient(90deg, var(--surface-2), var(--sky))" }), "100%",
      el("span", { class: "scale-note" }, "Tap a weekend to chart it")));
}

/** Two tiles: latest value, trend word, and net change for Saturday and Sunday. */
function renderSummary(points, sat) {
  const tiles = [["sat", "Saturday", sat, "var(--series-sat)"], ["sun", "Sunday", addDays(sat, 1), "var(--series-sun)"]]
    .map(([key, name, day, color]) => {
      const values = points.filter((pt) => pt[key]).map((pt) => pt[key].p);
      const last = values[values.length - 1];
      const trend = describeTrend(values);
      let detail;
      if (!values.length) detail = "Not forecast yet";
      else if (!trend) detail = `${values.length} run${values.length === 1 ? "" : "s"} so far`;
      else {
        const pts = Math.round(trend.net * 100);
        detail = `${pts > 0 ? "+" : pts < 0 ? "−" : "±"}${Math.abs(pts)} pts over ${values.length} runs`;
      }
      return el("div", { class: "sum-tile" },
        el("div", { class: "label" }, el("i", { class: "key", style: `background:${color}` }), `${name} ${dayMonth(day)}`),
        el("div", { class: "sum-value" }, values.length ? pct(last) : "–"),
        trend ? el("div", { class: "sum-trend" }, el("span", { "aria-hidden": "true" }, trend.icon), ` ${trend.word}`) : null,
        el("div", { class: "sum-detail" }, detail));
    });
  $("summary").replaceChildren(...tiles);
}

function render() {
  const site = sites.find((s) => s.id === siteSel.value);
  const sat = weekendSel.value;
  if (!site) return;
  syncURL();
  const points = weekendHistory(rows, site.id, sat);
  $("site-title").textContent = site.name;
  document.title = `${site.name} · Forecast timeline | Fly or Fold`;
  $("chart-sub").textContent = points.length
    ? `${points.length} run${points.length === 1 ? "" : "s"}, latest ${shortDate(points[points.length - 1].issued)}`
    : "";
  renderSummary(points, sat);

  cleanup?.();
  const chart = $("chart");
  if (!points.length) {
    cleanup = null;
    chart.replaceChildren(el("div", { class: "empty" },
      el("p", {}, sat > addDays(today, 13)
        ? "This weekend is more than 14 days out, so no run covers it yet."
        : "No runs cover this weekend at this site yet."),
      !isSample && !rows.length ? el("a", { href: "forecast.html?sample" }, "Preview with sample data") : null));
    $("table").replaceChildren();
    $("table-details").hidden = true;
  } else {
    cleanup = renderTimeline(chart, points, sat);
    $("table").replaceChildren(timelineTable(points, sat));
    $("table-details").hidden = false;
  }
  renderStrip(site, sat);
  $("rules").replaceChildren(siteCard(site, { distance: distanceLabel(getHome(), site) }));
}

async function init() {
  const wantedWeekend = /^\d{4}-\d{2}-\d{2}$/.test(params.get("weekend") ?? "")
    ? weekendSaturday(params.get("weekend")) : upcoming;
  const months = new Set(monthsAround(today));
  months.add(monthOf(addDays(wantedWeekend, -13)));
  months.add(monthOf(addDays(wantedWeekend, 1)));
  [sites, rows] = await Promise.all([loadSites(), loadForecasts([...months].sort())]);

  const withData = new Set(rows.map((r) => r.site));
  const choices = sites.filter((s) => s.active || withData.has(s.id));
  siteSel.replaceChildren(...choices.map((s) => el("option", { value: s.id }, s.name)));
  const wantedSite = params.get("site");
  siteSel.value = choices.some((s) => s.id === wantedSite) ? wantedSite : choices[0]?.id ?? "";
  fillWeekends(siteSel.value, wantedWeekend);

  siteSel.addEventListener("change", () => { fillWeekends(siteSel.value, weekendSel.value); render(); });
  weekendSel.addEventListener("change", render);
  render();
}

init().catch((e) => {
  console.error(e);
  $("chart").replaceChildren(el("p", { class: "empty" }, "Forecasts could not be loaded. Try again later."));
});
