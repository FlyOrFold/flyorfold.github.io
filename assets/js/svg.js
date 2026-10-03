// Tiny SVG element helper shared by the chart, sparklines and wind dials.

export const SVG_NS = "http://www.w3.org/2000/svg";

/** Create an SVG element with attributes. Text goes in via textContent by the caller. */
export function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
