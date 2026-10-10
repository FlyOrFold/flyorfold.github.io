// Which sites the home page shows. The viewer's picks live only in this browser's localStorage.
// With no picks (or none still forecast), the home page shows the N nearest sites, or N by name
// when no starting point is set.
import { byDistance } from "./location.js";

export const HOME_SITES_KEY = "flyorfold.homeSites";
export const HOME_SITE_COUNT = 6; // sites.html says "6" too

/** Site ids picked for the home page, as a Set (empty when none or storage is blocked). */
export function getHomeSites() {
  try {
    const v = JSON.parse(localStorage.getItem(HOME_SITES_KEY));
    if (Array.isArray(v)) return new Set(v.filter((id) => typeof id === "string"));
  } catch { /* storage blocked or bad value */ }
  return new Set();
}

/** Add or remove one site, and announce the change. */
export function setHomeSite(id, on) {
  const ids = getHomeSites();
  if (on) ids.add(id); else ids.delete(id);
  try {
    if (ids.size) localStorage.setItem(HOME_SITES_KEY, JSON.stringify([...ids].sort()));
    else localStorage.removeItem(HOME_SITES_KEY);
  } catch { /* storage blocked: the pick isn't kept */ }
  document.dispatchEvent(new CustomEvent("homesiteschange", { detail: ids }));
  return ids;
}

export const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/**
 * The sites to show and why. `sites` are the ones with forecasts; `picked` a Set of ids;
 * `home` the starting point or null. Picked sites all show (nearest first, else by name);
 * otherwise the `n` nearest, or the first `n` by name.
 * @returns {{ sites: object[], mode: "picked" | "nearest" | "default" }}
 */
export function chooseHomeSites(sites, picked, home, n = HOME_SITE_COUNT) {
  const named = [...sites].sort(byName);
  const chosen = named.filter((s) => picked.has(s.id));
  if (chosen.length) return { sites: byDistance(home, chosen), mode: "picked" };
  if (home) return { sites: byDistance(home, named).slice(0, n), mode: "nearest" };
  return { sites: named.slice(0, n), mode: "default" };
}
