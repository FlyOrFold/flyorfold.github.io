// Made-up forecast rows for ?sample mode, generated relative to today so sample mode never goes stale.
// Same shape as loadForecasts() rows. Not real forecasts; pages show a "Sample data" badge.
//
// Every value is a hash of (site, target day, run day), so it is deterministic and a past run never
// changes as days go by, like the real append-only log. A day's forecast starts near a 30% climate
// guess and drifts toward a hidden "true" chance as the day gets closer.
import { addDays } from "./data.js";

const LEADS = 14;   // lead 0..13, like forecast-log
const RUNS = 35;    // days of run history
const MEMBERS = 31; // gfs_seamless ensemble size

/** Deterministic number in [0, 1) from a string key (FNV-1a, then a final mix). */
function rand(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** One target day's chance at each lead, from 13 days out to the day itself. */
function runsFor(site, target) {
  const truth = Math.min(1, rand(`${site}|${target}|truth`) ** 1.6 * 1.1);
  let drift = (rand(`${site}|${target}|start`) - 0.5) * 0.6;
  const out = [];
  for (let lead = LEADS - 1; lead >= 0; lead--) {
    const issued = addDays(target, -lead);
    drift = drift * 0.8 + (rand(`${site}|${target}|${issued}`) - 0.5) * 0.12 * (lead / 13 + 0.2);
    const w = lead / 13;
    const p = Math.min(1, Math.max(0, (1 - w) * truth + w * 0.3 + drift * w));
    out.push({ issued, p: Math.round(Math.round(p * MEMBERS) / MEMBERS * 1000) / 1000 });
  }
  return out;
}

/** Rows for every run from `today` − 34 through `today`, for each site id. */
export function sampleRows(siteIds, today) {
  const first = addDays(today, -(RUNS - 1));
  const rows = [];
  for (const site of siteIds) {
    for (let t = first; t <= addDays(today, LEADS - 1); t = addDays(t, 1)) {
      for (const { issued, p } of runsFor(site, t)) {
        if (issued < first || issued > today) continue;
        rows.push({ issued, site, target: t, p, n: MEMBERS, version: 1 });
      }
    }
  }
  return rows.sort((a, b) => (a.issued < b.issued ? -1 : a.issued > b.issued ? 1 : 0));
}
