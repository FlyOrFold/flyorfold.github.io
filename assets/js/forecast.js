// Forecast page: run-by-run timeline for one site and day (plus an optional compared day),
// the two-week strip of each day's newest forecast, and the site's limits.
import {
  addDays, dayHistory, daysBetween, dayMonth, dayWindow, describeTrend, isISODate, isSample, latestByTarget,
  latestIssued, loadForecasts, loadSites, localToday, monthOf, monthsAround, shortDate, signedPts,
} from "./data.js";
import { dayTile } from "./day-tile.js";
import { dayStrip, stripScale } from "./day-strip.js";
import { el } from "./common.js";
import { renderTimeline, seriesFor, timelineTable } from "./chart.js";
import { siteCard } from "./site-card.js";
import { distanceLabel, getHome } from "./location.js";

const $ = (id) => document.getElementById(id);
const siteSel = $("site"), daySel = $("day"), compareSel = $("compare");
const params = new URLSearchParams(location.search);
const today = localToday();
const windowDays = dayWindow(today);

let sites = [], rows = [], cleanup = null;

function dayLabel(day) {
  const n = daysBetween(today, day);
  const tag = n === 0 ? " (today)" : n === 1 ? " (tomorrow)" : n === -1 ? " (yesterday)" : "";
  return `${shortDate(day)}${tag}`;
}

/** Day options: the two-week window, plus any day from the URL that falls outside it. */
function fillDays(wanted, extra = []) {
  const list = [...new Set([...windowDays, wanted, ...extra])].sort();
  daySel.replaceChildren(...list.map((d) => el("option", { value: d }, dayLabel(d))));
  daySel.value = wanted;
}

/** Compare options: every day option except the charted one. */
function fillCompare(wanted) {
  const list = [...daySel.options].map((o) => o.value).filter((d) => d !== daySel.value);
  compareSel.replaceChildren(el("option", { value: "" }, "None"),
    ...list.map((d) => el("option", { value: d }, dayLabel(d))));
  compareSel.value = list.includes(wanted) ? wanted : "";
}

function syncURL() {
  const p = new URLSearchParams();
  if (isSample) p.set("sample", "");
  p.set("site", siteSel.value);
  p.set("day", daySel.value);
  if (compareSel.value) p.set("compare", compareSel.value);
  history.replaceState(null, "", `?${p.toString().replace("sample=&", "sample&")}`);
}

function pickDay(day) {
  const keep = compareSel.value !== day ? compareSel.value : "";
  daySel.value = day;
  fillCompare(keep);
  render();
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
  $("strip-sub").textContent = `Newest forecast for each day · latest run ${shortDate(latest)}`;
  box.replaceChildren(
    dayStrip({
      days: windowDays, latest: latestByTarget(siteRows, site.id), today,
      label: `Newest chance of a flyable day at ${site.name}, ${dayMonth(windowDays[0])} to ${dayMonth(windowDays.at(-1))}`,
      selected: daySel.value, compare: compareSel.value || null,
      onPick: (day) => { pickDay(day); $("chart-h").scrollIntoView({ behavior: "smooth", block: "start" }); },
    }),
    stripScale("Tap a day to chart it"));
}

/** One large tile per charted day: latest value, trend word, and net change. */
function renderSummary(points, series) {
  $("summary").replaceChildren(...series.map((s) => {
    const values = points.filter((pt) => pt[s.key]).map((pt) => pt[s.key].p);
    const trend = describeTrend(values);
    const detail = !values.length ? "Not forecast yet"
      : !trend ? `${values.length} run${values.length === 1 ? "" : "s"} so far`
      : `${signedPts(trend.net)} over ${values.length} runs`;
    return dayTile({ size: "large", label: dayLabel(s.day), color: s.color, value: values.at(-1) ?? null, trend, detail });
  }));
}

function renderLegend(series) {
  $("legend").replaceChildren(
    ...series.map((s) => el("span", {}, el("i", { style: `background: ${s.color}` }), s.label)),
    el("span", {}, el("i", { class: "ref" }), "70% reference"));
}

function render() {
  const site = sites.find((s) => s.id === siteSel.value);
  const day = daySel.value;
  if (!site) return;
  syncURL();
  const series = seriesFor(day, compareSel.value || null);
  const points = dayHistory(rows, site.id, day, compareSel.value || null);
  $("site-title").textContent = site.name;
  document.title = `${site.name} · Forecast timeline | Fly or Fold`;
  $("chart-sub").textContent = points.length
    ? `${points.length} run${points.length === 1 ? "" : "s"}, latest ${shortDate(points[points.length - 1].issued)}`
    : "";
  renderSummary(points, series);
  renderLegend(series);

  cleanup?.();
  const chart = $("chart");
  if (!points.length) {
    cleanup = null;
    chart.replaceChildren(el("div", { class: "empty" },
      el("p", {}, day > addDays(today, 13)
        ? "This day is more than 14 days out, so no run covers it yet."
        : "No runs cover this day at this site yet."),
      !isSample && !rows.length ? el("a", { href: "forecast.html?sample" }, "Preview with sample data") : null));
    $("table").replaceChildren();
    $("table-details").hidden = true;
  } else {
    cleanup = renderTimeline(chart, points, series, today);
    $("table").replaceChildren(timelineTable(points, series));
    $("table-details").hidden = false;
  }
  renderStrip(site);
  $("rules").replaceChildren(siteCard(site, { distance: distanceLabel(getHome(), site) }));
}

async function init() {
  // ?weekend= is the old link format: open that day (its Saturday).
  const asked = params.get("day") ?? params.get("weekend");
  const wantedDay = isISODate(asked) ? asked : today;
  const wantedCompare = isISODate(params.get("compare")) ? params.get("compare") : "";
  const months = new Set(monthsAround(today));
  for (const d of [wantedDay, wantedCompare].filter(Boolean)) {
    months.add(monthOf(addDays(d, -13)));
    months.add(monthOf(d));
  }
  [sites, rows] = await Promise.all([loadSites(), loadForecasts([...months].sort())]);

  const withData = new Set(rows.map((r) => r.site));
  const choices = sites.filter((s) => s.active || withData.has(s.id));
  siteSel.replaceChildren(...choices.map((s) => el("option", { value: s.id }, s.name)));
  const wantedSite = params.get("site");
  siteSel.value = choices.some((s) => s.id === wantedSite) ? wantedSite : choices[0]?.id ?? "";
  fillDays(wantedDay, wantedCompare ? [wantedCompare] : []);
  fillCompare(wantedCompare);

  siteSel.addEventListener("change", render);
  daySel.addEventListener("change", () => pickDay(daySel.value));
  compareSel.addEventListener("change", render);
  render();
}

init().catch((e) => {
  console.error(e);
  $("chart").replaceChildren(el("p", { class: "empty" }, "Forecasts could not be loaded. Try again later."));
});
