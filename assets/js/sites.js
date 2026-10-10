// Sites page: map of every site, viewer-set starting point for distances, and site cards.
import { loadSites } from "./data.js";
import { el } from "./common.js";
import { siteCard, siteRow } from "./site-card.js";
import { clearHome, distanceLabel, getHome, parseCoords, setPoint, useMyLocation } from "./location.js";

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

let map = null, homeMarker = null, picking = false;
const fromLatLng = (ll) => ({ lat: ll.lat, lon: ll.lng }); // Leaflet calls it lng

function initMap() {
  if (!window.L) {
    $("map").replaceChildren(el("p", { class: "empty" }, "The map could not be loaded."));
    $("pick-on-map").hidden = true;
    return;
  }
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
      keyboard: true, title: s.name, bubblingMouseEvents: false,
    }).addTo(map);
    m.bindTooltip(el("span", {}, s.name), { direction: "top", offset: [0, -6] }); // DOM node, not an HTML string
    m.on("click", () => (picking ? setPoint(fromLatLng(m.getLatLng())) : focusSite(s.id)));
  }
  map.on("click", (e) => { if (picking) setPoint(fromLatLng(e.latlng.wrap())); });
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
}

/** "Pick on map" arms the next click on the map; Escape or a second press cancels. */
function setPicking(on) {
  picking = on && !!map;
  const btn = $("pick-on-map");
  btn.setAttribute("aria-pressed", String(picking));
  btn.textContent = picking ? "Cancel" : "Pick on map";
  $("map").classList.toggle("picking", picking);
  if (picking) $("home-status").textContent = "Click or tap the map to set your starting point.";
  else renderHomeControls();
}

function setupHomeControls() {
  $("pick-on-map").addEventListener("click", () => setPicking(!picking));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && picking) setPicking(false); });
  $("coords-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pt = parseCoords($("coords").value);
    if (!pt) { $("home-status").textContent = "Type latitude then longitude, like 40.1, -82.9."; return; }
    $("coords").value = "";
    setPoint(pt);
  });
  $("use-location").addEventListener("click", async () => {
    const btn = $("use-location");
    btn.disabled = true;
    btn.textContent = "Finding you…";
    try { await useMyLocation(); }
    catch (err) { $("home-status").textContent = `${err.message} Pick a point on the map or type coordinates instead.`; }
    finally { btn.disabled = false; btn.textContent = "Use my location"; }
  });
  $("clear-home").addEventListener("click", clearHome);
  document.addEventListener("homechange", () => { setPicking(false); renderLists(); drawHome(); });
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
