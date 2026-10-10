// Loads site definitions and the forecast log from the public FlyOrFold/forecast-log repo.
// Schema: see that repo's README ("Data"). Adding columns at the end is safe; renames are not.

const LIVE_BASE = "https://raw.githubusercontent.com/FlyOrFold/forecast-log/main/";
const SAMPLE_BASE = "/sample/";

// Columns a sites.csv row needs before forecast-log scores it (mirrors forecast_log/sites.py).
const REQUIRED = ["lat", "lon", "dir_ranges", "speed_min", "speed_max", "gust_max",
  "rain_mm_max", "fly_start", "fly_end", "min_hours"];

// ?sample in the URL switches to sample data: the bundled site list and generated forecasts.
// Never silent: pages show a badge.
export const isSample = typeof location !== "undefined" && new URLSearchParams(location.search).has("sample");
const BASE = isSample ? SAMPLE_BASE : LIVE_BASE;

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, quoted = false;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, j) => [h.trim(), (r[j] ?? "").trim()])));
}

async function fetchText(path) {
  const res = await fetch(BASE + path, { cache: "no-cache" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

/** "340-20; 255-285" -> [[340,20],[255,285]] */
export function parseDirRanges(s) {
  if (!s) return [];
  return s.split(";").map((part) => part.trim()).filter(Boolean)
    .map((part) => part.split("-").map((n) => Number(n.trim())));
}

// Optional link columns. Anything that isn't a site number or an http(s) URL is dropped, not linked.
const pgeId = (s) => (/^\d+$/.test(s ?? "") ? s : null);
const webUrl = (s) => (/^https?:\/\//i.test(s ?? "") ? s : null);

export async function loadSites() {
  const text = await fetchText("sites.csv");
  if (text == null) throw new Error("sites.csv not found");
  return parseCSV(text).map((r) => {
    const missing = REQUIRED.filter((k) => r[k] === "");
    const skipped = r.skip.toLowerCase() === "yes";
    const num = (k) => (r[k] === "" ? null : Number(r[k]));
    return {
      id: r.id,
      name: r.name || r.id,
      lat: num("lat"),
      lon: num("lon"),
      timezone: r.timezone || null,
      dirRanges: parseDirRanges(r.dir_ranges),
      speedMin: num("speed_min"),
      speedMax: num("speed_max"),
      gustMax: num("gust_max"),
      rainMax: num("rain_mm_max"),
      flyStart: num("fly_start"),
      flyEnd: num("fly_end"),
      minHours: num("min_hours"),
      notes: r.notes,
      pgeUrl: pgeId(r.pge_id) && `https://www.paraglidingearth.com/?site=${r.pge_id}`,
      infoUrl: webUrl(r.info_url),
      skipped,
      missing,
      active: !skipped && missing.length === 0,
    };
  });
}

/**
 * Load forecast rows for the given "YYYY-MM" months (by issued date). Missing months are skipped.
 * In ?sample mode the rows are generated for the forecast sites, relative to today (sample.js).
 */
export async function loadForecasts(months) {
  if (isSample) {
    const [{ sampleRows }, sites] = await Promise.all([import("./sample.js"), loadSites()]);
    const wanted = new Set(months);
    return sampleRows(sites.filter((s) => s.active).map((s) => s.id), localToday())
      .filter((r) => wanted.has(monthOf(r.issued)));
  }
  const texts = await Promise.all(months.map((m) => fetchText(`data/forecasts/${m}.csv`)));
  const rows = [];
  for (const t of texts) {
    if (t == null) continue;
    for (const r of parseCSV(t)) {
      rows.push({
        issued: r.issued_date,
        site: r.site,
        target: r.target_date,
        p: Number(r.p_flyable),
        n: Number(r.n_members),
        version: Number(r.criteria_version),
      });
    }
  }
  return rows;
}

// ---- Date helpers. All dates are "YYYY-MM-DD" strings handled as UTC midnights. ----

export const toDate = (s) => new Date(s + "T00:00:00Z");
export const toISO = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const monthOf = (s) => s.slice(0, 7);

/** Today's date in the viewer's local time zone. */
export function localToday() {
  const d = new Date();
  return toISO(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

/** True for a real calendar date written "YYYY-MM-DD" (so "2026-02-30" is rejected). */
export function isISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = toDate(s);
  return !Number.isNaN(d.getTime()) && toISO(d) === s;
}

// The days the pages show: a few days back (their last forecast) and the rest ahead, 14 in all.
export const DAYS_BEFORE = 3;
export const DAYS_AFTER = 10;

/** The 14 target days around `today`, oldest first: today − 3 through today + 10. */
export function dayWindow(today) {
  return Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) => addDays(today, i - DAYS_BEFORE));
}

/** Months needed to cover every run (lead 0–13) for the days around `today`, plus the previous month. */
export function monthsAround(today) {
  const set = new Set([monthOf(addDays(today, -40)), monthOf(addDays(today, -14)), monthOf(today)]);
  return [...set].sort();
}

const fmt = (opts) => new Intl.DateTimeFormat(undefined, { timeZone: "UTC", ...opts });
const fmtShort = fmt({ weekday: "short", month: "short", day: "numeric" });
const fmtDay = fmt({ month: "short", day: "numeric" });
export const shortDate = (s) => fmtShort.format(toDate(s));
export const dayMonth = (s) => fmtDay.format(toDate(s));
export const weekdayShort = (s) => fmt({ weekday: "short" }).format(toDate(s));

export const pct = (p) => (p == null || Number.isNaN(p) ? "–" : `${Math.round(p * 100)}%`);

/** A change in probability as signed percentage points: "+3 pts", "−13 pts" (true minus), "±0 pts". */
export function signedPts(delta) {
  const n = Math.round(delta * 100);
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)} pts`;
}

/** Latest issued date in the rows, or null. */
export function latestIssued(rows) {
  let best = null;
  for (const r of rows) if (!best || r.issued > best) best = r.issued;
  return best;
}

/**
 * Per-run history for one site and target day, plus an optional second day to compare:
 * one point per issued date, with `a` (the day) and `b` (the compared day) rows, either may be missing.
 */
export function dayHistory(rows, siteId, day, compare = null) {
  const byIssued = new Map();
  for (const r of rows) {
    if (r.site !== siteId) continue;
    const key = r.target === day ? "a" : compare && r.target === compare ? "b" : null;
    if (!key) continue;
    const pt = byIssued.get(r.issued) ?? { issued: r.issued, a: null, b: null, version: r.version };
    pt[key] = r;
    pt.version = r.version;
    byIssued.set(r.issued, pt);
  }
  return [...byIssued.values()].sort((a, b) => (a.issued < b.issued ? -1 : 1));
}

/** The newest forecast row for each target day at one site, as a Map of target date to row. */
export function latestByTarget(rows, siteId) {
  const out = new Map();
  for (const r of rows) {
    if (r.site !== siteId) continue;
    const cur = out.get(r.target);
    if (!cur || r.issued > cur.issued) out.set(r.target, r);
  }
  return out;
}

/**
 * Describe how one day's chance moved across runs, in plain words. Descriptive only:
 * never a recommendation. `values` are probabilities 0–1 in run order.
 *   Unsettled: two or more direction reversals with real size (>= 8 pts each way)
 *   Rising / Falling: net change of 15 pts or more since the first run
 *   Steady: anything else
 * Returns null with fewer than three runs, since two points can't show a trend.
 */
export function describeTrend(values) {
  if (values.length < 3) return null;
  const steps = values.slice(1).map((v, i) => v - values[i]).filter((d) => Math.abs(d) >= 0.08);
  let reversals = 0;
  for (let i = 1; i < steps.length; i++) if (Math.sign(steps[i]) !== Math.sign(steps[i - 1])) reversals++;
  const net = values[values.length - 1] - values[0];
  if (reversals >= 2) return { word: "Unsettled", icon: "≈", net };
  if (net >= 0.15) return { word: "Rising", icon: "↗", net };
  if (net <= -0.15) return { word: "Falling", icon: "↘", net };
  return { word: "Steady", icon: "→", net };
}
