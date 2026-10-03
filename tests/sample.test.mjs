// Generated sample data in assets/js/sample.js (used by ?sample mode).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleRows } from "../assets/js/sample.js";
import { addDays, daysBetween, weekendSaturday, weekendHistory } from "../assets/js/data.js";

const SITES = ["lake-erie-cleveland", "tennessee-cliff", "canaan-valley"];
const TODAY = "2026-10-02";

test("rows have the forecast-log shape and valid values", () => {
  const rows = sampleRows(SITES, TODAY);
  const keys = new Set();
  for (const r of rows) {
    const lead = daysBetween(r.issued, r.target);
    assert.ok(lead >= 0 && lead <= 13, `lead ${lead}`);
    assert.ok(r.p >= 0 && r.p <= 1, `p ${r.p}`);
    assert.equal(r.n, 31);
    assert.equal(r.version, 1);
    const k = `${r.issued}|${r.site}|${r.target}`;
    assert.ok(!keys.has(k), `duplicate ${k}`);
    keys.add(k);
  }
  // 35 runs x 14 leads x 3 sites
  assert.equal(rows.length, 35 * 14 * 3);
  assert.equal(rows.at(-1).issued, TODAY);
  assert.equal(rows[0].issued, addDays(TODAY, -34));
});

test("deterministic: same inputs give identical rows", () => {
  assert.deepEqual(sampleRows(SITES, TODAY), sampleRows(SITES, TODAY));
});

test("past runs never change as days go by, like the real append-only log", () => {
  const key = (r) => `${r.issued}|${r.site}|${r.target}`;
  const later = new Map(sampleRows(SITES, addDays(TODAY, 5)).map((r) => [key(r), r.p]));
  for (const r of sampleRows(SITES, TODAY)) {
    if (later.has(key(r))) assert.equal(later.get(key(r)), r.p, key(r));
  }
});

test("whatever the date, this weekend has runs for every site", () => {
  for (const today of ["2026-10-02", "2026-12-31", "2027-03-14", "2027-07-04"]) {
    const sat = weekendSaturday(today);
    const rows = sampleRows(SITES, today);
    for (const site of SITES) {
      const h = weekendHistory(rows, site, sat);
      assert.ok(h.length >= 8, `${today} ${site}: ${h.length} runs`);
      assert.ok(h.some((pt) => pt.sat) && h.some((pt) => pt.sun), `${today} ${site}`);
    }
  }
});

test("values vary: not a flat or constant series", () => {
  const ps = sampleRows(SITES, TODAY).map((r) => r.p);
  assert.ok(new Set(ps).size > 20);
  assert.ok(Math.min(...ps) < 0.15 && Math.max(...ps) > 0.7);
});
