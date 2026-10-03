// The viewer's own reference point for distances. Kept only in this browser's localStorage:
// never sent to a server, never put in a URL. Geolocation is rounded to 0.1° (about 10 km).

const KEY = "flyorfold.home";

export const PRESETS = [
  { label: "Columbus, OH", lat: 39.96, lon: -83.0 },
  { label: "Cleveland, OH", lat: 41.5, lon: -81.69 },
  { label: "Cincinnati, OH", lat: 39.1, lon: -84.51 },
  { label: "Dayton, OH", lat: 39.76, lon: -84.19 },
  { label: "Toledo, OH", lat: 41.65, lon: -83.54 },
  { label: "Pittsburgh, PA", lat: 40.44, lon: -80.0 },
];

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

export const setPreset = (p) => save({ label: p.label, lat: p.lat, lon: p.lon });

export function clearHome() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent("homechange", { detail: null }));
}

/** Ask the browser for the viewer's position, round it, and store it. */
export function useMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This browser can't share its location.")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const round = (n) => Math.round(n * 10) / 10;
        resolve(save({ label: "your location", lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) }));
      },
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED
        ? "Location permission was declined. Pick a city instead."
        : "Couldn't get your location. Pick a city instead.")),
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

/** "≈ 130 mi" rounded to 5 (or 10 past 100), or null when either point is missing. */
export function distanceLabel(home, site) {
  if (!home || site.lat == null || site.lon == null) return null;
  const mi = milesBetween(home, site);
  const step = mi >= 100 ? 10 : 5;
  return `≈ ${Math.max(step, Math.round(mi / step) * step)} mi`;
}
