// Writes made-up forecast-log CSVs to sample/data/forecasts/ for previewing the site with ?sample.
// Same schema as FlyOrFold/forecast-log. Not real forecasts.
// Usage: node sample/generate.mjs [YYYY-MM-DD last issued date, default today UTC]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITES = ["lake-erie-cleveland", "tennessee-cliff", "canaan-valley"];
const DAYS_OF_RUNS = 35;
const N = 31;

const out = join(dirname(fileURLToPath(import.meta.url)), "data", "forecasts");
const last = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

// Deterministic PRNG so reruns with the same date give the same file.
let seed = 42;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// A hidden "true" chance per site and day; forecasts start near climatology and converge on it.
const truth = new Map();
const truthFor = (site, day) => {
  const k = site + day;
  if (!truth.has(k)) truth.set(k, Math.min(1, Math.max(0, rand() ** 1.6 * 1.1)));
  return truth.get(k);
};
const noise = new Map();

const byMonth = new Map();
for (let i = DAYS_OF_RUNS - 1; i >= 0; i--) {
  const issued = add(last, -i);
  for (const site of SITES) {
    for (let lead = 0; lead < 14; lead++) {
      const target = add(issued, lead);
      const t = truthFor(site, target);
      const k = site + target;
      const prev = noise.get(k) ?? (rand() - 0.5) * 0.6;
      const drift = prev * 0.8 + (rand() - 0.5) * 0.12 * (lead / 13 + 0.2);
      noise.set(k, drift);
      const w = lead / 13;
      const p = Math.min(1, Math.max(0, (1 - w) * t + w * 0.3 + drift * w));
      const count = Math.round(p * N);
      const row = [issued, site, target, (count / N).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""), N, 1].join(",");
      const m = issued.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(row);
    }
  }
}

mkdirSync(out, { recursive: true });
for (const [m, rows] of byMonth) {
  writeFileSync(join(out, `${m}.csv`), "issued_date,site,target_date,p_flyable,n_members,criteria_version\n" + rows.join("\n") + "\n");
  console.log(`${m}.csv: ${rows.length} rows`);
}
