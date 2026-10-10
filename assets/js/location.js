// The viewer's own reference point for distances. Kept only in this browser's localStorage:
// never sent to a server, never put in a URL. Every point (geolocation, a map pick or typed
// coordinates) is rounded to 0.1° (about 10 km). There is deliberately no place-name search:
// that would send what the viewer typed to a geocoding service.

const KEY = "flyorfold.home";

export function getHome() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && Number.isFinite(v.lat) && Number.isFinite(v.lon) && typeof v.label === "string") return v;
  } catch { /* storage blocked or bad value */ }
  return null;
}

function save(home) {
  try { localStorage.setItem(KEY, JSON.stringify(home)); } catch { /* storage blocked: works for this visit only */ }
  document.dispatchEvent(new CustomEvent("homechange", { detail: home }));
  return home;
}

const round = (n) => Math.round(n * 10) / 10;

/** "40.1° N, 82.9° W" */
export function formatCoords(lat, lon) {
  return `${Math.abs(lat).toFixed(1)}° ${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(1)}° ${lon < 0 ? "W" : "E"}`;
}

/**
 * Typed coordinates to { lat, lon }, or null. Accepts "40.1, -82.9", "40.1 -82.9",
 * "40.1N 82.9W" and "40.1° N, 82.9° W". Latitude comes first.
 */
export function parseCoords(text) {
  const num = "(\\d+(?:\\.\\d*)?|\\.\\d+)";
  const part = `([-+]?)\\s*${num}\\s*°?\\s*`;
  const re = new RegExp(`^${part}([NS])?\\s*[,;\\s]\\s*${part}([EW])?$`, "i");
  const m = String(text ?? "").trim().replace(/\u2212/g, "-").match(re);
  if (!m) return null;
  const [, latSign, latN, ns, lonSign, lonN, ew] = m;
  if ((ns && latSign) || (ew && lonSign)) return null; // "-40 S" is ambiguous
  const lat = Number(latN) * (latSign === "-" || /s/i.test(ns ?? "") ? -1 : 1);
  const lon = Number(lonN) * (lonSign === "-" || /w/i.test(ew ?? "") ? -1 : 1);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  return { lat, lon };
}

/** Store any point as the starting point, rounded to 0.1° and labelled by its coordinates. */
export function setPoint({ lat, lon }, label = null) {
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new RangeError(`Not a point: ${lat}, ${lon}`);
  const r = { lat: round(lat), lon: round(lon) };
  return save({ label: label ?? formatCoords(r.lat, r.lon), ...r });
}

export function clearHome() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent("homechange", { detail: null }));
}

/** Ask the browser for the viewer's position, round it, and store it. */
export function useMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This browser can't share its location.")); return; }
    // Messages say what went wrong; each page adds what to do instead.
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(setPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude }, "your location")),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? "Location permission was declined."
        : "Couldn't get your location.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600000 });
  });
}

/** Great-circle distance in miles. */
export function milesBetween(a, b) {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Sites nearest first from `home`; sites without coordinates keep their order at the end. No home: unchanged. */
export function byDistance(home, sites) {
  if (!home) return [...sites];
  const d = (s) => (s.lat == null || s.lon == null ? Infinity : milesBetween(home, s));
  return sites.map((s, i) => ({ s, i, d: d(s) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.s);
}

/** "≈ 130 mi" rounded to 5 (or 10 past 100), or null when either point is missing. */
export function distanceLabel(home, site) {
  if (!home || site.lat == null || site.lon == null) return null;
  const mi = milesBetween(home, site);
  const step = mi >= 100 ? 10 : 5;
  return `≈ ${Math.max(step, Math.round(mi / step) * step)} mi`;
}
