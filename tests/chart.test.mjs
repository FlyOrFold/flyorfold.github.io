// Line segmentation in assets/js/chart.js: where the timeline must break.
import { test } from "node:test";
import assert from "node:assert/strict";
import { segments } from "../assets/js/chart.js";

const pt = (issued, sat, version = 1) => ({ issued, sat: sat == null ? null : { p: sat, version }, sun: null, version });
const issuedOf = (segs) => segs.map((seg) => seg.map((p) => p.issued));

test("consecutive daily runs form one line", () => {
  const pts = [pt("2026-09-28", 0.1), pt("2026-09-29", 0.2), pt("2026-09-30", 0.3)];
  assert.deepEqual(issuedOf(segments(pts, "sat")), [["2026-09-28", "2026-09-29", "2026-09-30"]]);
});

test("a missed day breaks the line", () => {
  const pts = [pt("2026-09-28", 0.1), pt("2026-09-30", 0.3), pt("2026-10-01", 0.4)];
  assert.deepEqual(issuedOf(segments(pts, "sat")), [["2026-09-28"], ["2026-09-30", "2026-10-01"]]);
});

test("a criteria_version change breaks the line", () => {
  const pts = [pt("2026-09-28", 0.1, 1), pt("2026-09-29", 0.2, 2), pt("2026-09-30", 0.3, 2)];
  assert.deepEqual(issuedOf(segments(pts, "sat")), [["2026-09-28"], ["2026-09-29", "2026-09-30"]]);
});

test("runs without that day's value are skipped, not drawn", () => {
  const pts = [pt("2026-09-28", null), pt("2026-09-29", 0.2)];
  assert.deepEqual(issuedOf(segments(pts, "sat")), [["2026-09-29"]]);
  assert.deepEqual(segments([], "sat"), []);
});
