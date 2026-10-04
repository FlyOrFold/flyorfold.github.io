// A site's limits as a card (forecast sites) or a compact row (sites not forecast yet),
// with a compass dial of its allowed wind directions.
import { el, withSample } from "./common.js";
import { svgEl } from "./svg.js";

/** Compass dial. Degrees are where the wind blows FROM, N = 0, clockwise. Ranges may wrap north. */
export function directionDial(ranges) {
  const c = 48, r = 40;
  const pt = (deg, rad) => [c + rad * Math.sin((deg * Math.PI) / 180), c - rad * Math.cos((deg * Math.PI) / 180)];
  const svg = svgEl("svg", { viewBox: "0 0 96 96", role: "img", class: "dial-svg" });
  svg.setAttribute("aria-label", ranges.length
    ? `Allowed wind directions: ${ranges.map(([a, b]) => `${a}° to ${b}°`).join(", ")}`
    : "Wind directions not set");
  svg.append(svgEl("circle", { cx: c, cy: c, r, style: "fill: var(--surface-2); stroke: var(--line)" }));
  for (let deg = 0; deg < 360; deg += 45) {
    const [x1, y1] = pt(deg, r - 4), [x2, y2] = pt(deg, r);
    svg.append(svgEl("line", { x1, y1, x2, y2, style: "stroke: var(--muted); stroke-width: 1" }));
  }
  for (const [lo, hi] of ranges) {
    const sweep = ((hi - lo) % 360 + 360) % 360 || 360;
    const [x1, y1] = pt(lo, r), [x2, y2] = pt(lo + sweep, r);
    const d = sweep >= 360
      ? `M${c},${c - r}A${r},${r} 0 1 1 ${c - 0.01},${c - r}Z`
      : `M${c},${c}L${x1},${y1}A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2},${y2}Z`;
    svg.append(svgEl("path", { d, style: "fill: var(--sky); fill-opacity: .35; stroke: var(--sky); stroke-width: 1.5" }));
  }
  for (const [lab, deg] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const [x, y] = pt(deg, r - 12);
    const t = svgEl("text", { x, y: y + 4, "text-anchor": "middle", style: "fill: var(--text-2); font-size: 10px; font-weight: 700" });
    t.textContent = lab;
    svg.append(t);
  }
  svg.append(svgEl("circle", { cx: c, cy: c, r: 2.5, style: "fill: var(--text-2)" }));
  return svg;
}

const hh = (h) => `${String(h).padStart(2, "0")}:00`;
const human = (k) => k.replaceAll("_", " ").replace("dir ranges", "wind directions").replace("rain mm max", "rain limit");

function limits(site) {
  const rows = [
    ["Wind from", site.dirRanges.length ? site.dirRanges.map(([a, b]) => `${a}°–${b}°`).join(", ") : null],
    ["Speed", site.speedMin == null || site.speedMax == null ? null : `${site.speedMin}–${site.speedMax} mph`],
    ["Gusts", site.gustMax == null ? null : `up to ${site.gustMax} mph`],
    ["Rain", site.rainMax == null ? null : `up to ${site.rainMax} mm/h`],
    ["Window", site.flyStart == null ? null : `${hh(site.flyStart)}–${hh(site.flyEnd)}`],
    ["Needs", site.minHours == null ? null : `${site.minHours} h in a row`],
  ];
  return el("dl", { class: "limits" }, ...rows.flatMap(([k, v]) => [
    el("dt", {}, k), el("dd", { class: v == null ? "unset" : null }, v ?? "not set")]));
}

function badges(site, distance) {
  return el("div", { class: "meta" },
    site.active
      ? el("span", { class: "badge ok" }, "✓ Forecast daily")
      : el("span", { class: "badge off" }, site.skipped ? "○ Skipped" : "○ Not forecast yet"),
    el("span", { class: "badge warn", title: "Limits have not been confirmed with the site's club" }, "⚠ Unverified"),
    distance ? el("span", { class: "distance", title: "Straight-line distance, not driving distance" }, `${distance} straight line`) : null);
}

function mapLink(site) {
  if (site.lat == null || site.lon == null) return null;
  return el("a", { href: `https://www.openstreetmap.org/?mlat=${site.lat}&mlon=${site.lon}#map=13/${site.lat}/${site.lon}` }, "Open in map");
}

/** Map, Paragliding Earth and local site info links; blank ones are left out. */
function siteLinks(site) {
  return [
    mapLink(site),
    site.pgeUrl ? el("a", { href: site.pgeUrl }, "Paragliding Earth") : null,
    site.infoUrl ? el("a", { href: site.infoUrl }, "Local site info") : null,
  ].filter(Boolean);
}

/** Full card for a forecast site. */
export function siteCard(site, { heading = "h3", distance = null, forecastLink = false } = {}) {
  const actions = [
    forecastLink ? el("a", { class: "btn small-btn", href: withSample(`forecast.html?site=${encodeURIComponent(site.id)}`) }, "See forecast") : null,
    ...siteLinks(site),
  ].filter(Boolean);
  return el("article", { class: "card site-card", id: site.id, tabindex: "-1" },
    el(heading, {}, site.name),
    badges(site, distance),
    el("div", { class: "site-body" }, el("div", { class: "dial" }, directionDial(site.dirRanges)), limits(site)),
    site.notes ? el("p", { class: "site-notes" }, el("b", {}, "Sources and notes: "), site.notes) : null,
    actions.length ? el("div", { class: "site-actions" }, ...actions) : null);
}

/** Compact row for a site that is not forecast yet. */
export function siteRow(site, { distance = null } = {}) {
  const missing = site.skipped ? "Marked skip in the site list." : `Missing: ${site.missing.map(human).join(", ")}.`;
  return el("li", { class: "site-row", id: site.id, tabindex: "-1" },
    el("div", { class: "dial small" }, directionDial(site.dirRanges)),
    el("div", { class: "site-row-body" },
      el("h3", {}, site.name),
      badges(site, distance),
      el("p", { class: "small muted", style: "margin:0 0 4px" }, missing),
      site.notes ? el("details", { class: "site-row-notes" }, el("summary", {}, "Sources and notes"), el("p", {}, site.notes)) : null,
      el("div", { class: "site-links" }, ...siteLinks(site))));
}
