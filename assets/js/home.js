// Home page: this weekend's outlook per site from the latest run, plus recent news.
import {
  addDays, dayMonth, isSample, latestIssued, loadForecasts, loadSites, localToday,
  monthsAround, pct, shortDate, weekendSaturday,
} from "./data.js";
import { el, loadNews, renderNews, withSample } from "./common.js";

const outlook = document.getElementById("outlook");
const meta = document.getElementById("outlook-meta");

function dayTile(label, color, row, prevRow) {
  let delta = "No earlier run";
  if (row && prevRow) {
    const d = Math.round((row.p - prevRow.p) * 100);
    delta = d === 0 ? "No change since last run" : `${d > 0 ? "▲ +" : "▼ "}${d} pts since last run`;
  }
  return el("div", { class: "day" },
    el("div", { class: "label" }, el("i", { class: "key", style: `background:${color}` }), label),
    el("div", { class: "value" }, row ? pct(row.p) : "–"),
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
    const href = withSample(`forecast.html?site=${encodeURIComponent(s.id)}&weekend=${sat}`);
    outlook.append(el("article", { class: "card outlook-card" },
      el("h3", {}, el("a", { href }, s.name)),
      el("div", { class: "muted small" }, "Chance of a flyable day"),
      el("div", { class: "days" },
        dayTile(`Sat ${dayMonth(sat)}`, "var(--series-sat)", find(latest, s.id, sat), prevIssued && find(prevIssued, s.id, sat)),
        dayTile(`Sun ${dayMonth(sun)}`, "var(--series-sun)", find(latest, s.id, sun), prevIssued && find(prevIssued, s.id, sun))),
      el("p", { class: "small", style: "margin:10px 0 0" }, el("a", { href }, "How this forecast has changed"))));
  }
  if (!shown.length) outlook.append(el("p", { class: "muted" }, "No sites in the latest run."));
}

renderOutlook().catch((e) => {
  console.error(e);
  outlook.replaceChildren(el("p", { class: "muted" }, "Forecasts could not be loaded. Try again later."));
});

const news = document.getElementById("news");
loadNews().then((items) => renderNews(news, items.slice(0, 3)))
  .catch(() => { news.textContent = "News could not be loaded."; });
