// Distances and the viewer's stored starting point in assets/js/location.js.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fakeBrowser } from "./helpers.mjs";
import { milesBetween, distanceLabel, byDistance, getHome, setPoint, clearHome, parseCoords, formatCoords } from "../assets/js/location.js";

const { store, events, reset } = fakeBrowser();
beforeEach(reset);

const columbus = { lat: 39.96, lon: -83.0 };
const cleveland = { lat: 41.5, lon: -81.69 };

test("milesBetween: Columbus to Cleveland is about 126 miles straight line", () => {
  const mi = milesBetween(columbus, cleveland);
  assert.ok(mi > 120 && mi < 132, `got ${mi}`);
  assert.equal(milesBetween(columbus, columbus), 0);
});

test("distanceLabel rounds to 5 under 100 mi, 10 above, and never says 0", () => {
  assert.equal(distanceLabel(columbus, cleveland), "≈ 130 mi");
  assert.equal(distanceLabel(columbus, { lat: 40.2, lon: -83.0 }), "≈ 15 mi");
  assert.equal(distanceLabel(columbus, columbus), "≈ 5 mi");
});

test("distanceLabel is null without a starting point or site coordinates", () => {
  assert.equal(distanceLabel(null, cleveland), null);
  assert.equal(distanceLabel(columbus, { lat: null, lon: null }), null);
});

test("starting point round-trips through localStorage and announces changes", () => {
  assert.equal(getHome(), null);
  setPoint({ lat: 39.96, lon: -83.04 });
  assert.deepEqual(getHome(), { label: "40.0° N, 83.0° W", lat: 40, lon: -83 });
  clearHome();
  assert.equal(getHome(), null);
  assert.deepEqual(events, ["homechange", "homechange"]);
});

test("a corrupt or tampered stored value is ignored", () => {
  store.set("flyorfold.home", "{not json");
  assert.equal(getHome(), null);
  store.set("flyorfold.home", JSON.stringify({ label: "x", lat: "39", lon: -83 }));
  assert.equal(getHome(), null);
});

test("setPoint rounds any point to 0.1° and keeps a given label", () => {
  setPoint({ lat: -33.8688, lon: 151.2093 });
  assert.deepEqual(getHome(), { label: "33.9° S, 151.2° E", lat: -33.9, lon: 151.2 });
  setPoint({ lat: 46.0261, lon: 7.7491 }, "your location");
  assert.deepEqual(getHome(), { label: "your location", lat: 46, lon: 7.7 });
});

test("setPoint refuses a missing or out-of-range coordinate instead of storing it", () => {
  assert.throws(() => setPoint({ lat: 40.1, lon: undefined }), RangeError);
  assert.throws(() => setPoint({ lat: 91, lon: 0 }), RangeError);
  assert.equal(getHome(), null);
});

test("parseCoords: signed decimals, hemisphere letters, degree signs, and separators", () => {
  const cases = {
    "40.1, -82.9": { lat: 40.1, lon: -82.9 },
    "40.1 -82.9": { lat: 40.1, lon: -82.9 },
    "  40.1,-82.9 ": { lat: 40.1, lon: -82.9 },
    "40.1N 82.9W": { lat: 40.1, lon: -82.9 },
    "40.1° N, 82.9° W": { lat: 40.1, lon: -82.9 },
    "33.87 s; 151.21 e": { lat: -33.87, lon: 151.21 },
    "−12.5, +130": { lat: -12.5, lon: 130 }, // U+2212 minus, as some sites copy it
    "0, 0": { lat: 0, lon: 0 },
  };
  for (const [text, want] of Object.entries(cases)) assert.deepEqual(parseCoords(text), want, text);
});

test("parseCoords rejects out-of-range, ambiguous and non-coordinate input", () => {
  for (const bad of ["", "Columbus", "40.1", "91, 0", "0, 181", "-40 S, 10 E", "40 W, 80 N", "40.1-82.9", null]) {
    assert.equal(parseCoords(bad), null, String(bad));
  }
});

test("formatCoords", () => {
  assert.equal(formatCoords(40.1, -82.9), "40.1° N, 82.9° W");
  assert.equal(formatCoords(-0, 0), "0.0° N, 0.0° E");
});

test("byDistance: nearest first, sites without coordinates last in their order, unchanged without a home", () => {
  const sites = [
    { id: "far", lat: 35.0, lon: -85.4 },
    { id: "nocoords-1", lat: null, lon: null },
    { id: "near", ...cleveland },
    { id: "nocoords-2", lat: null, lon: null },
    { id: "mid", lat: 39.1, lon: -79.4 },
  ];
  assert.deepEqual(byDistance(cleveland, sites).map((s) => s.id), ["near", "mid", "far", "nocoords-1", "nocoords-2"]);
  assert.deepEqual(byDistance(null, sites).map((s) => s.id), sites.map((s) => s.id));
  assert.notEqual(byDistance(null, sites), sites); // a copy, never the caller's array
});
