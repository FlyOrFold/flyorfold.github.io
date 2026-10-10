// Home page, per site: a today tile (latest value, a line of every run, change since the last run)
// and a two-week strip of each day's newest forecast; each day links to its timeline.
import {
  dayHistory, dayMonth, dayWindow, isSample, latestByTarget, latestIssued, loadForecasts, loadSites, localToday,
  monthsAround, shortDate, signedPts,
} from "./data.js";
import { el, withSample } from "./common.js";
import { dayTile } from "./day-tile.js";
import { dayStrip, stripScale } from "./day-strip.js";

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

const outlook = document.getElementById("outlook");
const meta = document.getElementById("outlook-meta");

async function renderOutlook() {
  const today = localToday();
  const days = dayWindow(today);
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

  meta.textContent = `${dayMonth(days[0])}–${dayMonth(days.at(-1))} · latest run ${shortDate(latest)}`;

  const siteIds = new Set(rows.filter((r) => r.issued === latest).map((r) => r.site));
  const shown = sites.filter((s) => siteIds.has(s.id));
  const link = (s, day) => withSample(`forecast.html?site=${encodeURIComponent(s.id)}&day=${day}`);
  for (const s of shown) {
    outlook.append(el("article", { class: "card outlook-card" },
      el("h3", {}, el("a", { href: link(s, today) }, s.name)),
      el("div", { class: "muted small" }, "Chance of a flyable day"),
      todayTile(rows, s.id, today),
      dayStrip({
        days, latest: latestByTarget(rows, s.id), today, mini: true,
        label: `Newest chance of a flyable day at ${s.name}`, href: (day) => link(s, day),
      })));
  }
  if (shown.length) outlook.after(stripScale("Tap a day to see how its forecast changed"));
  else outlook.append(el("p", { class: "muted" }, "No sites in the latest run."));
}

renderOutlook().catch((e) => {
  console.error(e);
  outlook.replaceChildren(el("p", { class: "muted" }, "Forecasts could not be loaded. Try again later."));
});
