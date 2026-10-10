// The home page's site selection in assets/js/home-sites.js.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { chooseHomeSites, getHomeSites, setHomeSite, byName, HOME_SITES_KEY } from "../assets/js/home-sites.js";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const events = [];
globalThis.document = { dispatchEvent: (e) => events.push(e.type) };
beforeEach(() => { store.clear(); events.length = 0; });

const site = (id, name, lat, lon) => ({ id, name, lat, lon });
const sites = [
  site("tn", "Tennessee cliff", 35.0, -85.4),
  site("erie", "lake Erie ridge", 41.5, -81.7), // lower-case: name sort ignores case
  site("canaan", "Canaan Valley", 39.1, -79.4),
  site("nopos", "Bald Knob", null, null),
];
const cleveland = { lat: 41.5, lon: -81.69 };
const ids = (r) => r.sites.map((s) => s.id);

test("picked sites all show, nearest first with a starting point, else by name", () => {
  const picked = new Set(["tn", "canaan"]);
  assert.deepEqual(chooseHomeSites(sites, picked, cleveland, 1), { sites: [sites[2], sites[0]], mode: "picked" });
  assert.deepEqual(ids(chooseHomeSites(sites, picked, null, 1)), ["canaan", "tn"]);
});

test("no picks: the n nearest with a starting point, sites without coordinates last", () => {
  const r = chooseHomeSites(sites, new Set(), cleveland, 3);
  assert.equal(r.mode, "nearest");
  assert.deepEqual(ids(r), ["erie", "canaan", "tn"]);
});

test("no picks and no starting point: the first n by name", () => {
  const r = chooseHomeSites(sites, new Set(), null, 2);
  assert.equal(r.mode, "default");
  assert.deepEqual(ids(r), ["nopos", "canaan"]);
});

test("picks that are no longer forecast fall back to the default", () => {
  assert.equal(chooseHomeSites(sites, new Set(["gone"]), null, 2).mode, "default");
});

test("byName ignores case", () => {
  assert.deepEqual([...sites].sort(byName).map((s) => s.id), ["nopos", "canaan", "erie", "tn"]);
});

test("picks round-trip through localStorage; the last one removed clears the key", () => {
  assert.equal(getHomeSites().size, 0);
  setHomeSite("tn", true);
  setHomeSite("erie", true);
  assert.deepEqual([...getHomeSites()].sort(), ["erie", "tn"]);
  setHomeSite("tn", false);
  setHomeSite("erie", false);
  assert.equal(store.has(HOME_SITES_KEY), false);
  assert.deepEqual(events, Array(4).fill("homesiteschange"));
});

test("a corrupt stored value is ignored", () => {
  store.set(HOME_SITES_KEY, "{nope");
  assert.equal(getHomeSites().size, 0);
  store.set(HOME_SITES_KEY, JSON.stringify(["ok", 3, null]));
  assert.deepEqual([...getHomeSites()], ["ok"]);
});
