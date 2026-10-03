// One day's chance of a flyable day as a tile. Used by the home outlook (compact, with a
// sparkline of every run), the forecast summary (large, with a trend word) and the Brand page.
import { pct } from "./data.js";
import { el } from "./common.js";
import { svgEl } from "./svg.js";

/**
 * Sparkline of one day's chance across runs, on a fixed 0–100% scale so tiles compare.
 * Stretches to the tile width; strokes stay 2px via non-scaling-stroke.
 */
export function sparkline(values, color, label) {
  const W = 120, H = 30, pad = 3;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", class: "spark", role: "img", "aria-label": label });
  const x = (i) => (values.length < 2 ? W : (i / (values.length - 1)) * W);
  const y = (p) => pad + (1 - p) * (H - 2 * pad);
  const add = (tag, attrs) => svg.append(svgEl(tag, { ...attrs, "vector-effect": "non-scaling-stroke" }));
  add("line", { x1: 0, x2: W, y1: y(0), y2: y(0), style: "stroke: var(--line); stroke-width: 1" });
  if (values.length > 1) {
    add("path", {
      d: values.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(""),
      fill: "none", style: `stroke: ${color}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round`,
    });
  }
  // End dot: a zero-length round-capped stroke stays circular when the viewBox stretches.
  const last = values.length - 1;
  add("path", { d: `M${x(last)},${y(values[last])}h0`, style: `stroke: ${color}; stroke-width: 7; stroke-linecap: round` });
  return svg;
}

/**
 * @param {object} o
 * @param {"compact"|"large"} [o.size]
 * @param {string} o.label     e.g. "Sat Oct 3"
 * @param {string} o.color     series colour, e.g. "var(--series-sat)"
 * @param {number|null} o.value  latest probability 0–1, or null when not forecast
 * @param {{icon: string, word: string}|null} [o.trend]  from describeTrend()
 * @param {number[]|null} [o.spark]  every run's probability, for a sparkline
 * @param {string} o.detail   the small line at the bottom
 */
export function dayTile({ size = "compact", label, color, value, trend = null, spark = null, detail }) {
  return el("div", { class: `day-tile ${size}` },
    el("div", { class: "label" }, el("i", { class: "key", style: `background:${color}` }), label),
    el("div", { class: "value" }, value == null ? "–" : pct(value)),
    spark?.length ? sparkline(spark, color, `${label}, by run: ${spark.map(pct).join(", ")}`) : null,
    trend ? el("div", { class: "trend" }, el("span", { "aria-hidden": "true" }, trend.icon), ` ${trend.word}`) : null,
    el("div", { class: "detail" }, detail));
}
