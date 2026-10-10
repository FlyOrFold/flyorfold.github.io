// Home page, one card per chosen site (see home-sites.js), nearest first once the viewer sets a
// starting point: distance, a today tile (latest value, a line of every run, change since the last
// run) and a two-week strip of each day's newest forecast; each day links to its timeline.
import {
  dayHistory, dayMonth, dayWindow, isSample, latestByTarget, latestIssued, loadForecasts, loadSites, localToday,
  monthsAround, shortDate, signedPts,
} from "./data.js";
import { el, withSample } from "./common.js";
import { dayTile } from "./day-tile.js";
import { dayStrip, stripScale } from "./day-strip.js";
import { clearHome, distanceLabel, getHome, useMyLocation } from "./location.js";
import { HOME_SITES_KEY, HOME_SITE_COUNT, chooseHomeSites, getHomeSites } from "./home-sites.js";

/** Compact tile for today: newest value, a sparkline of every run, and the change since the run before. */
function todayTile(rows, siteId, today) {
  const hist = dayHistory(rows, siteId, today).filter((pt) => pt.a);
  const [prev, last] = [hist.at(-2)?.a, hist.at(-1)?.a];
  let detail = "Not forecast";
  if (last && !prev) detail = "No earlier run";
  else if (last) {
    const d = last.p - prev.p;
    detail = Math.round(d * 100) === 0 ? "No change since last run" : `${d > 0 ? "▲" : "▼"} ${signedPts(d)} since last run`;
  }
  return dayTile({
    size: "compact", label: `Today, ${dayMonth(today)}`, color: "var(--series-a)",
    value: last ? last.p : null, spark: hist.map((pt) => pt.a.p), detail,
  });
}

const $ = (id) => document.getElementById(id);
const outlook = $("outlook");
const meta = $("outlook-meta");
const today = localToday();
const days = dayWindow(today);

/**
 * Cards for the sites in the latest run: the ones picked on the Sites page, else the
 * HOME_SITE_COUNT nearest, else the first HOME_SITE_COUNT by name.
 */
function renderCards(sites, rows) {
  const home = getHome();
  const { sites: shown } = chooseHomeSites(sites, getHomeSites(), home, HOME_SITE_COUNT);
  const link = (s, day) => withSample(`forecast.html?site=${encodeURIComponent(s.id)}&day=${day}`);
  outlook.replaceChildren(...shown.map((s) => {
    const distance = distanceLabel(home, s);
    return el("article", { class: "card outlook-card" },
      el("div", { class: "outlook-head" },
        el("h3", {}, el("a", { href: link(s, today) }, s.name)),
        distance ? el("span", { class: "distance", title: "Straight-line distance, not driving distance" }, distance) : null),
      todayTile(rows, s.id, today),
      dayStrip({
        days, latest: latestByTarget(rows, s.id), today, mini: true,
        label: `Newest chance of a flyable day at ${s.name}`, href: (day) => link(s, day),
      }));
  }));
}

// ---- Starting point: only "Use my location", in the hero. The Sites page has the map pick,
// typed coordinates and the privacy note. ----

let outlookMeta = "";

function renderHomeControls() {
  const home = getHome();
  $("use-location").hidden = !!home;
  $("clear-home").hidden = !home;
  $("home-status").textContent = "";
  meta.textContent = outlookMeta;
}

function setupHomeControls() {
  $("use-location").addEventListener("click", async () => {
    const btn = $("use-location");
    btn.disabled = true;
    btn.textContent = "Finding you…";
    try { await useMyLocation(); }
    catch (err) {
      $("home-status").replaceChildren(`${err.message} `,
        el("a", { href: withSample("sites.html#home-controls") }, "Set a starting point on the Sites page"), ".");
    }
    finally { btn.disabled = false; btn.textContent = "Use my location"; }
  });
  $("clear-home").addEventListener("click", clearHome);
  document.addEventListener("homechange", renderHomeControls);
  renderHomeControls();
}

async function renderOutlook() {
  const [sites, rows] = await Promise.all([loadSites(), loadForecasts(monthsAround(today))]);
  const latest = latestIssued(rows);

  if (!latest) {
    meta.textContent = "";
    $("outlook-sub").hidden = true;
    outlook.replaceChildren(el("div", { class: "card empty" },
      el("p", {}, "The forecast log has no runs yet. The daily job writes its first rows soon."),
      isSample ? null : el("a", { href: "index.html?sample" }, "Preview with sample data")));
    return;
  }

  outlookMeta = `${dayMonth(days[0])}–${dayMonth(days.at(-1))} · latest run ${shortDate(latest)}`;
  renderHomeControls();

  const siteIds = new Set(rows.filter((r) => r.issued === latest).map((r) => r.site));
  const shown = sites.filter((s) => siteIds.has(s.id));
  if (!shown.length) {
    outlook.replaceChildren(el("p", { class: "muted" }, "No sites in the latest run."));
    return;
  }
  renderCards(shown, rows);
  outlook.after(stripScale("Tap a day to see how its forecast changed"));
  document.addEventListener("homechange", () => renderCards(shown, rows));
  // Picks made on the Sites page in another tab.
  window.addEventListener("storage", (e) => { if (e.key === HOME_SITES_KEY) renderCards(shown, rows); });
}

setupHomeControls();
renderOutlook().catch((e) => {
  console.error(e);
  outlook.replaceChildren(el("p", { class: "muted" }, "Forecasts could not be loaded. Try again later."));
});
