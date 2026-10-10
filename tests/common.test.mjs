// Link helpers in assets/js/common.js (outside ?sample mode, as in Node).
import { test } from "node:test";
import assert from "node:assert/strict";
import { forecastHref } from "../assets/js/common.js";

test("forecastHref: site only, site and day, and an id that needs escaping", () => {
  assert.equal(forecastHref("lake-erie"), "forecast.html?site=lake-erie");
  assert.equal(forecastHref("lake-erie", "2026-10-14"), "forecast.html?site=lake-erie&day=2026-10-14");
  assert.equal(forecastHref("a&b c"), "forecast.html?site=a%26b%20c");
});
