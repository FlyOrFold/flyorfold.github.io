// Sites page: map of every site, viewer-set starting point for distances, and site cards.
import { loadSites } from "./data.js";
import { el } from "./common.js";
import { siteCard, siteRow } from "./site-card.js";
import { PRESETS, clearHome, distanceLabel, getHome, setPreset, useMyLocation } from "./location.js";

const $ = (id) => document.getElementById(id);
let sites = [];

function renderLists() {
  const home = getHome();
  const active = sites.filter((s) => s.active);
  const pending = sites.filter((s) => !s.active);
  $("sites-count").textContent =
    `${active.length} site${active.length === 1 ? "" : "s"} forecast daily, ${pending.length} waiting on limits.`;
  $("active-sites").replaceChildren(...active.map((s) =>
    siteCard(s, { heading: "h3", distance: distanceLabel(home, s), forecastLink: true })));
  $("pending-sites").replaceChildren(...pending.map((s) => siteRow(s, { distance: distanceLabel(home, s) })));
}

function focusSite(id) {
  const node = document.getElementById(id);
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  node.classList.remove("flash");
  void node.offsetWidth; // restart the highlight animation
  node.classList.add("flash");
  node.focus({ preventScroll: true });
}

// ---- Map (Leaflet, loaded with `defer` before this module runs) ----

let map = null, homeMarker = null;

function initMap() {
  if (!window.L) { $("map").replaceChildren(el("p", { class: "empty" }, "The map could not be loaded.")); return; }
  const L = window.L;
  map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.5 });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const placed = sites.filter((s) => s.lat != null && s.lon != null);
  // Inactive first so forecast pins draw on top.
  for (const s of [...placed].sort((a, b) => Number(a.active) - Number(b.active))) {
    const m = L.circleMarker([s.lat, s.lon], {
      radius: s.active ? 8 : 6, weight: 2, className: s.active ? "pin pin-active" : "pin",
      keyboard: true, title: s.name,
    }).addTo(map);
    m.bindTooltip(el("span", {}, s.name), { direction: "top", offset: [0, -6] }); // DOM node, not an HTML string
    m.on("click", () => focusSite(s.id));
  }
  fit();
  drawHome();
}

function fit() {
  const pts = sites.filter((s) => s.lat != null).map((s) => [s.lat, s.lon]);
  const home = getHome();
  if (home) pts.push([home.lat, home.lon]);
  if (pts.length) map.fitBounds(pts, { padding: [28, 28], maxZoom: 9 });
}

function drawHome() {
  if (!map) return;
  const L = window.L;
  const home = getHome();
  homeMarker?.remove();
  homeMarker = null;
  if (home) {
    homeMarker = L.circleMarker([home.lat, home.lon], { radius: 7, weight: 3, className: "pin pin-home", interactive: false }).addTo(map);
  }
  fit();
}

// ---- Starting point controls ----

function renderHomeControls() {
  const home = getHome();
  $("home-status").textContent = home
    ? `Distances from ${home.label}.`
    : "Set a starting point to see distances.";
  $("clear-home").hidden = !home;
  $("home-key").hidden = !home;
  $("home-key-label").textContent = home ? (home.label === "your location" ? "You" : home.label) : "";
  $("preset").value = home && PRESETS.some((p) => p.label === home.label) ? home.label : "";
}

function setupHomeControls() {
  $("preset").append(...PRESETS.map((p) => el("option", { value: p.label }, p.label)));
  $("preset").addEventListener("change", (e) => {
    const p = PRESETS.find((x) => x.label === e.target.value);
    if (p) setPreset(p);
  });
  $("use-location").addEventListener("click", async () => {
    const btn = $("use-location");
    btn.disabled = true;
    btn.textContent = "Finding you…";
    try { await useMyLocation(); }
    catch (err) { $("home-status").textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = "Use my location"; }
  });
  $("clear-home").addEventListener("click", clearHome);
  document.addEventListener("homechange", () => { renderHomeControls(); renderLists(); drawHome(); });
  renderHomeControls();
}

loadSites().then((list) => {
  sites = list;
  renderLists();
  setupHomeControls();
  initMap();
  if (location.hash) focusSite(location.hash.slice(1));
}).catch((e) => {
  console.error(e);
  $("active-sites").replaceChildren(el("p", { class: "muted" }, "The site list could not be loaded. Try again later."));
});
