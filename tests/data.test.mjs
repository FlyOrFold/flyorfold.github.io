// Pure logic in assets/js/data.js. Run all tests with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCSV, parseDirRanges, addDays, daysBetween, weekendSaturday, monthsAround, latestIssued,
  weekendHistory, weekendsWithData, describeTrend, pct, signedPts, loadSites, loadForecasts,
} from "../assets/js/data.js";

test("parseCSV: quoted commas, doubled quotes, CRLF, blank lines, trimmed headers", () => {
  const text = ' id , name ,notes\r\na,"Ridge, Cleveland","He said ""hi"""\r\n\r\nb,Cliff,\r\n';
  assert.deepEqual(parseCSV(text), [
    { id: "a", name: "Ridge, Cleveland", notes: 'He said "hi"' },
    { id: "b", name: "Cliff", notes: "" },
  ]);
});

test("parseCSV: quoted newline stays in the field; missing trailing newline is fine", () => {
  assert.deepEqual(parseCSV('k,v\n1,"two\nlines"'), [{ k: "1", v: "two\nlines" }]);
});

test("parseCSV: empty input and header-only input give no rows", () => {
  assert.deepEqual(parseCSV(""), []);
  assert.deepEqual(parseCSV("a,b\n"), []);
});

test("parseDirRanges: single, multiple, wrap through north, blank", () => {
  assert.deepEqual(parseDirRanges("340-20"), [[340, 20]]);
  assert.deepEqual(parseDirRanges("255-285; 300-320"), [[255, 285], [300, 320]]);
  assert.deepEqual(parseDirRanges(""), []);
});

test("date helpers cross month and year ends", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-09-20", "2026-10-04"), 14);
  // Across the US DST change: dates are UTC midnights, so no 23- or 25-hour days.
  assert.equal(daysBetween("2026-10-31", "2026-11-02"), 2);
});

test("weekendSaturday: Mon–Fri give the coming Saturday, Sat and Sun give this one", () => {
  const expected = {
    "2026-09-28": "2026-10-03", // Mon
    "2026-10-02": "2026-10-03", // Fri
    "2026-10-03": "2026-10-03", // Sat
    "2026-10-04": "2026-10-03", // Sun
    "2026-10-05": "2026-10-10", // Mon
  };
  for (const [day, sat] of Object.entries(expected)) assert.equal(weekendSaturday(day), sat, day);
});

test("monthsAround covers the 14-day lead window and the year boundary", () => {
  assert.deepEqual(monthsAround("2026-10-02"), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(monthsAround("2027-01-05"), ["2026-11", "2026-12", "2027-01"]);
});

const row = (issued, site, target, p, version = 1) => ({ issued, site, target, p, n: 31, version });

test("latestIssued", () => {
  assert.equal(latestIssued([]), null);
  assert.equal(latestIssued([row("2026-09-30", "a", "2026-10-03", 0.1), row("2026-10-02", "a", "2026-10-03", 0.2)]), "2026-10-02");
});

test("weekendHistory: one point per run, Sat and Sun merged, other sites and days ignored, sorted", () => {
  const rows = [
    row("2026-10-01", "a", "2026-10-04", 0.4),
    row("2026-09-30", "a", "2026-10-03", 0.1),
    row("2026-10-01", "a", "2026-10-03", 0.2),
    row("2026-10-01", "b", "2026-10-03", 0.9),
    row("2026-10-01", "a", "2026-10-05", 0.9),
  ];
  const h = weekendHistory(rows, "a", "2026-10-03");
  assert.deepEqual(h.map((pt) => [pt.issued, pt.sat?.p ?? null, pt.sun?.p ?? null]), [
    ["2026-09-30", 0.1, null],
    ["2026-10-01", 0.2, 0.4],
  ]);
});

test("weekendsWithData maps both Saturday and Sunday targets to their Saturday", () => {
  const rows = [row("2026-10-01", "a", "2026-10-04", 0.4), row("2026-10-01", "a", "2026-10-10", 0.4), row("2026-10-01", "a", "2026-10-07", 0.4)];
  assert.deepEqual(weekendsWithData(rows, "a"), ["2026-10-03", "2026-10-10"]);
  assert.deepEqual(weekendsWithData(rows, "other"), []);
});

test("describeTrend: needs three runs; Rising, Falling, Steady, Unsettled", () => {
  assert.equal(describeTrend([0.4, 0.9]), null);
  assert.equal(describeTrend([0.42, 0.5, 0.6, 0.94]).word, "Rising");
  assert.equal(describeTrend([0.8, 0.6, 0.4]).word, "Falling");
  assert.equal(describeTrend([0.29, 0.26, 0.2, 0.16]).word, "Steady");
  assert.equal(describeTrend([0.3, 0.6, 0.3, 0.6]).word, "Unsettled");
  // Small wiggles under 8 pts don't count as reversals.
  assert.equal(describeTrend([0.5, 0.55, 0.5, 0.55, 0.5]).word, "Steady");
  assert.ok(Math.abs(describeTrend([0.2, 0.3, 0.5]).net - 0.3) < 1e-9);
});

test("pct and signedPts formatting", () => {
  assert.equal(pct(0.936), "94%");
  assert.equal(pct(null), "–");
  assert.equal(signedPts(0.52), "+52 pts");
  assert.equal(signedPts(-0.13), "−13 pts"); // U+2212 minus, not a hyphen
  assert.equal(signedPts(0.004), "±0 pts");
});

// ---- Loaders, with fetch stubbed so no network is touched ----

function stubFetch(files) {
  globalThis.fetch = async (url) => {
    const key = Object.keys(files).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => files[key] };
  };
}

test("loadSites: active only when every required column is set and skip isn't yes", async () => {
  const header = "id,name,lat,lon,timezone,dir_ranges,speed_min,speed_max,gust_max,rain_mm_max,fly_start,fly_end,min_hours,skip,notes";
  stubFetch({
    "sites.csv": [header,
      'full,"Full, site",41.5,-81.7,America/New_York,340-20,5,15,18,0.1,10,18,2,,ok',
      "nogust,No gust,41,-81,,180-270,0,15,,0.1,10,18,2,,",
      "skipped,Skipped,41,-81,,180-270,0,15,18,0.1,10,18,2,YES,",
    ].join("\n"),
  });
  const sites = await loadSites();
  assert.deepEqual(sites.map((s) => [s.id, s.active, s.skipped, s.missing]), [
    ["full", true, false, []],
    ["nogust", false, false, ["gust_max"]],
    ["skipped", false, true, []],
  ]);
  assert.equal(sites[0].name, "Full, site");
  assert.deepEqual(sites[0].dirRanges, [[340, 20]]);
  assert.equal(sites[1].timezone, null);
  assert.equal(sites[1].gustMax, null);
});

test("loadForecasts: parses numbers and skips months that don't exist yet", async () => {
  stubFetch({
    "data/forecasts/2026-10.csv": "issued_date,site,target_date,p_flyable,n_members,criteria_version\n2026-10-02,a,2026-10-03,0.62,31,1\n",
  });
  const rows = await loadForecasts(["2026-09", "2026-10"]);
  assert.deepEqual(rows, [{ issued: "2026-10-02", site: "a", target: "2026-10-03", p: 0.62, n: 31, version: 1 }]);
});

test("the bundled sample sites.csv parses, with the three forecast sites active", async () => {
  const { readFile } = await import("node:fs/promises");
  stubFetch({ "sites.csv": await readFile(new URL("../sample/sites.csv", import.meta.url), "utf8") });
  const active = (await loadSites()).filter((s) => s.active).map((s) => s.id);
  assert.deepEqual(active, ["lake-erie-cleveland", "tennessee-cliff", "canaan-valley"]);
});
