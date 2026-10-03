// A site's limits as a card, with a compass dial of its allowed wind directions.
import { el } from "./common.js";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** Compass dial. Degrees are where the wind blows FROM, N = 0, clockwise. Ranges may wrap north. */
export function directionDial(ranges) {
  const c = 48, r = 38;
  const pt = (deg, rad) => [c + rad * Math.sin((deg * Math.PI) / 180), c - rad * Math.cos((deg * Math.PI) / 180)];
  const svg = svgEl("svg", { viewBox: "0 0 96 96", role: "img" });
  svg.setAttribute("aria-label", ranges.length
    ? `Allowed wind directions: ${ranges.map(([a, b]) => `${a}° to ${b}°`).join(", ")}`
    : "Wind directions not set");
  svg.append(svgEl("circle", { cx: c, cy: c, r, style: "fill: var(--surface-2); stroke: var(--line)" }));
  for (const [lo, hi] of ranges) {
    const sweep = ((hi - lo) % 360 + 360) % 360 || 360;
    const [x1, y1] = pt(lo, r), [x2, y2] = pt(lo + sweep, r);
    const d = sweep >= 360
      ? `M${c},${c - r}A${r},${r} 0 1 1 ${c - 0.01},${c - r}Z`
      : `M${c},${c}L${x1},${y1}A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2},${y2}Z`;
    svg.append(svgEl("path", { d, style: "fill: var(--sky); fill-opacity: .35; stroke: var(--sky); stroke-width: 1.5" }));
  }
  for (const [lab, deg] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const [x, y] = pt(deg, r - 9);
    const t = svgEl("text", { x, y: y + 4, "text-anchor": "middle", style: "fill: var(--text-2); font-size: 10px; font-weight: 600" });
    t.textContent = lab;
    svg.append(t);
  }
  svg.append(svgEl("circle", { cx: c, cy: c, r: 2, style: "fill: var(--text-2)" }));
  return svg;
}

const hh = (h) => `${String(h).padStart(2, "0")}:00`;
const orUnset = (v, fmt = (x) => x) => (v == null ? "not set" : fmt(v));

export function siteCard(site, { heading = "h3" } = {}) {
  const status = site.active
    ? el("span", { class: "badge ok" }, "✓ Forecast daily")
    : el("span", { class: "badge off", title: site.skipped ? "Marked skip in the site list" : `Missing: ${site.missing.join(", ")}` },
      "○ Not forecast");
  const reason = !site.active && !site.skipped
    ? el("p", { class: "small muted", style: "margin:0 0 8px" }, `Not forecast until these are filled in: ${site.missing.join(", ").replaceAll("_", " ")}.`)
    : null;

  const dl = el("dl", {},
    el("dt", {}, "Wind from"), el("dd", {}, site.dirRanges.length ? site.dirRanges.map(([a, b]) => `${a}°–${b}°`).join(", ") : "not set"),
    el("dt", {}, "Speed"), el("dd", {}, site.speedMin == null || site.speedMax == null ? "not set" : `${site.speedMin}–${site.speedMax} mph`),
    el("dt", {}, "Gusts up to"), el("dd", {}, orUnset(site.gustMax, (v) => `${v} mph`)),
    el("dt", {}, "Rain up to"), el("dd", {}, orUnset(site.rainMax, (v) => `${v} mm/h`)),
    el("dt", {}, "Window"), el("dd", {}, site.flyStart == null ? "not set" : `${hh(site.flyStart)}–${hh(site.flyEnd)} local`),
    el("dt", {}, "Needs"), el("dd", {}, orUnset(site.minHours, (v) => `${v} qualifying hours in a row`)));

  const links = [];
  if (site.lat != null && site.lon != null) {
    links.push(el("a", { href: `https://www.openstreetmap.org/?mlat=${site.lat}&mlon=${site.lon}#map=13/${site.lat}/${site.lon}` }, "Map"));
  }

  return el("article", { class: "card site-card", id: site.id },
    el(heading, {}, site.name),
    el("div", { class: "meta" }, status, el("span", { class: "badge warn", title: "Limits have not been confirmed with the site's club" }, "⚠ Unverified")),
    reason,
    el("div", { class: "site-body" }, el("div", { class: "dial" }, directionDial(site.dirRanges)), dl),
    site.notes ? el("p", { class: "site-notes" }, el("b", {}, "Sources and notes: "), site.notes) : null,
    links.length ? el("p", { class: "small", style: "margin:8px 0 0" }, ...links) : null);
}
