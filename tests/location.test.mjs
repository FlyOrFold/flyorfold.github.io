// Distances and the viewer's stored starting point in assets/js/location.js.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { milesBetween, distanceLabel, getHome, setPreset, clearHome, PRESETS } from "../assets/js/location.js";

// Minimal browser stand-ins: localStorage and the document event the page listens for.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const events = [];
globalThis.document = { dispatchEvent: (e) => events.push(e.type) };
beforeEach(() => { store.clear(); events.length = 0; });

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
  setPreset(PRESETS[0]);
  assert.deepEqual(getHome(), { label: "Columbus, OH", lat: 39.96, lon: -83.0 });
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
