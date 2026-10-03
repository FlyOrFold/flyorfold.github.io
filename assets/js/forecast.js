// Forecast page: run-by-run timeline for one site and weekend, plus the latest 14-day outlook.
import {
  addDays, dayMonth, isSample, latestIssued, loadForecasts, loadSites, localToday, monthOf,
  monthsAround, pct, shortDate, toDate, weekdayShort, weekendHistory, weekendSaturday, weekendsWithData,
} from "./data.js";
import { el } from "./common.js";
import { renderTimeline, timelineTable } from "./chart.js";
import { siteCard } from "./site-card.js";

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

function renderStrip(site) {
  const box = $("strip");
  const siteRows = rows.filter((r) => r.site === site.id);
  const latest = latestIssued(siteRows);
  if (!latest) {
    $("strip-sub").textContent = "";
    box.replaceChildren(el("p", { class: "empty" }, "No runs for this site yet."));
    return;
  }
  $("strip-sub").textContent = `From the run of ${shortDate(latest)}. Darker means a higher chance of a flyable day. Weekends are outlined.`;
  const latestRows = siteRows.filter((r) => r.issued === latest).sort((a, b) => (a.target < b.target ? -1 : 1));
  const cells = latestRows.map((r) => {
    const dow = toDate(r.target).getUTCDay();
    const share = Math.round(r.p * 100);
    return el("div", {
      class: `cell${dow === 0 || dow === 6 ? " weekend" : ""}`,
      style: `background: color-mix(in oklab, var(--sky) ${share}%, var(--surface-2)); color: ${r.p > 0.55 ? "#fff" : "var(--text)"}`,
      title: `${shortDate(r.target)}: ${pct(r.p)} (${r.n} members)`,
    }, `${weekdayShort(r.target)} ${Number(r.target.slice(8))}`, el("b", {}, pct(r.p)));
  });
  box.replaceChildren(
    el("div", { class: "strip", role: "list", "aria-label": "Chance of a flyable day, next 14 days" },
      ...cells.map((c) => { c.setAttribute("role", "listitem"); return c; })),
    el("div", { class: "scale", "aria-hidden": "true" }, "0%",
      el("span", { class: "ramp", style: "background: linear-gradient(90deg, var(--surface-2), var(--sky))" }), "100%"));
}

function render() {
  const site = sites.find((s) => s.id === siteSel.value);
  const sat = weekendSel.value;
  if (!site) return;
  syncURL();
  const points = weekendHistory(rows, site.id, sat);
  $("chart-h").textContent = `${site.name}`;
  $("chart-sub").textContent = points.length
    ? `Saturday ${dayMonth(sat)} and Sunday ${dayMonth(addDays(sat, 1))} · ${points.length} run${points.length === 1 ? "" : "s"}, latest ${shortDate(points[points.length - 1].issued)}`
    : `Saturday ${dayMonth(sat)} and Sunday ${dayMonth(addDays(sat, 1))}`;

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
  renderStrip(site);
  $("rules").replaceChildren(siteCard(site));
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
