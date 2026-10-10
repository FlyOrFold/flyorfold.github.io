// Timeline chart: how the forecast for one day (and optionally a second, compared day) changed
// run by run. Plain SVG, no dependencies.
import { addDays, daysBetween, dayMonth, pct, shortDate, weekdayShort } from "./data.js";
import { el } from "./common.js";
import { svgEl } from "./svg.js";

const REF = 0.7;

/** The chart's series for a day and an optional compared day: Sky first, Canopy second. */
export function seriesFor(day, compare = null) {
  return [
    { key: "a", day, label: shortDate(day), short: weekdayShort(day), color: "var(--series-a)" },
    compare ? { key: "b", day: compare, label: shortDate(compare), short: weekdayShort(compare), color: "var(--series-b)" } : null,
  ].filter(Boolean);
}

/**
 * Split one series into connected runs. A line breaks where a run is missing
 * (a gap of more than one day) or where criteria_version changes, because
 * probabilities from different criteria are not comparable.
 */
export function segments(points, key) {
  const out = [];
  let cur = [];
  let prev = null;
  for (const pt of points) {
    const r = pt[key];
    if (!r) continue;
    if (prev && (daysBetween(prev.issued, pt.issued) > 1 || prev[key].version !== r.version)) {
      out.push(cur); cur = [];
    }
    cur.push(pt); prev = pt;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Render into `container`. `points` come from dayHistory(); `series` from seriesFor().
 * The x axis runs from 13 days before the earliest target to the latest one, so a day still
 * ahead shows how many runs are still to come. Returns a cleanup function.
 */
export function renderTimeline(container, points, series, today) {
  container.replaceChildren();
  const days = series.map((s) => s.day).sort();
  const first = points.length ? points[0].issued : addDays(days[0], -13);
  const start = first < addDays(days[0], -13) ? first : addDays(days[0], -13);
  const end = days.at(-1);
  const span = Math.max(1, daysBetween(start, end));

  const wrap = el("div", { class: "chart" });
  container.append(wrap);
  const tip = el("div", { class: "tooltip", hidden: true, role: "status", "aria-live": "polite" });
  wrap.append(tip);

  let svg;
  let active = -1;

  function draw() {
    const W = Math.max(300, wrap.clientWidth || 600);
    const H = Math.round(Math.min(340, Math.max(230, W * 0.55)));
    const m = { l: 40, r: 64, t: 26, b: 40 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = (iso) => m.l + (daysBetween(start, iso) / span) * iw;
    const y = (p) => m.t + (1 - p) * ih;

    svg?.remove();
    svg = svgEl("svg", {
      viewBox: `0 0 ${W} ${H}`, width: W, height: H, tabindex: 0, role: "img",
      "aria-label": `Chance of a flyable day for ${series.map((s) => s.label).join(" and ")}, by forecast run. Use left and right arrow keys to step through runs.`,
    });
    wrap.prepend(svg);

    // Target-day bands, tinted with their series colour.
    const dayW = iw / span;
    for (const s of series) {
      const bx = Math.max(m.l, x(s.day) - dayW / 2);
      svg.append(svgEl("rect", {
        x: bx, y: m.t, width: Math.min(m.l + iw, x(s.day) + dayW / 2) - bx, height: ih,
        style: `fill: color-mix(in srgb, ${s.color} 14%, transparent)`,
      }));
    }
    // Band labels, only when they have room (otherwise the legend carries them).
    const bandXs = series.map((s) => x(s.day));
    if (bandXs.length < 2 || Math.abs(bandXs[0] - bandXs[1]) >= 46) {
      for (const s of series) {
        const t = svgEl("text", { x: x(s.day), y: m.t - 8, "text-anchor": "middle", style: "fill: var(--muted); font-size: 11px" });
        t.textContent = dayMonth(s.day);
        svg.append(t);
      }
    }

    // Y grid and ticks.
    for (let v = 0; v <= 1.0001; v += 0.2) {
      const yy = y(v);
      svg.append(svgEl("line", { x1: m.l, x2: m.l + iw, y1: yy, y2: yy, style: "stroke: var(--grid); stroke-width: 1" }));
      const t = svgEl("text", { x: m.l - 8, y: yy + 4, "text-anchor": "end", style: "fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums" });
      t.textContent = `${Math.round(v * 100)}%`;
      svg.append(t);
    }

    // 70% reference line.
    svg.append(svgEl("line", {
      x1: m.l, x2: m.l + iw, y1: y(REF), y2: y(REF),
      style: "stroke: var(--ref); stroke-width: 1; stroke-dasharray: 4 3",
    }));
    const refT = svgEl("text", { x: m.l + 4, y: y(REF) - 5, style: "fill: var(--muted); font-size: 11px" });
    refT.textContent = "70%";
    svg.append(refT);

    // X ticks: every day gets a hairline tick; labels thin out on small screens.
    const every = iw / span < 26 ? (iw / span < 14 ? 4 : 2) : 1;
    for (let i = 0; i <= span; i++) {
      const iso = addDays(start, i);
      const xx = x(iso);
      svg.append(svgEl("line", { x1: xx, x2: xx, y1: m.t + ih, y2: m.t + ih + 4, style: "stroke: var(--line)" }));
      const back = daysBetween(iso, end);
      if (back % every !== 0 && iso !== today) continue;
      // Today's run is the newest there can be: label it so the empty days after it read as "not yet".
      const isToday = iso === today;
      const ink = isToday ? "fill: var(--text); font-weight: 700" : "fill: var(--muted)";
      const t1 = svgEl("text", { x: xx, y: m.t + ih + 17, "text-anchor": "middle", style: `${ink}; font-size: 11px` });
      t1.textContent = isToday ? "Today" : weekdayShort(iso);
      const t2 = svgEl("text", { x: xx, y: m.t + ih + 30, "text-anchor": "middle", style: `${ink}; font-size: 10px; font-variant-numeric: tabular-nums` });
      t2.textContent = iso.slice(8).replace(/^0/, "");
      svg.append(t1, t2);
    }
    svg.append(svgEl("line", { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, style: "stroke: var(--line); stroke-width: 1" }));

    // Criteria-version changes.
    for (let i = 1; i < points.length; i++) {
      if (points[i].version === points[i - 1].version) continue;
      const xx = (x(points[i].issued) + x(points[i - 1].issued)) / 2;
      svg.append(svgEl("line", { x1: xx, x2: xx, y1: m.t, y2: m.t + ih, style: "stroke: var(--ref); stroke-width: 1" }));
      const t = svgEl("text", { x: xx + 4, y: m.t + ih - 6, style: "fill: var(--muted); font-size: 10px" });
      t.textContent = "criteria changed";
      svg.append(t);
    }

    // Crosshair (behind the data).
    const cross = svgEl("line", { y1: m.t, y2: m.t + ih, style: "stroke: var(--text-2); stroke-width: 1; opacity: .5", visibility: "hidden" });
    svg.append(cross);

    // Lines and markers.
    const ends = [];
    for (const s of series) {
      for (const seg of segments(points, s.key)) {
        if (seg.length > 1) {
          const d = seg.map((pt, i) => `${i ? "L" : "M"}${x(pt.issued).toFixed(1)},${y(pt[s.key].p).toFixed(1)}`).join("");
          svg.append(svgEl("path", { d, fill: "none", style: `stroke: ${s.color}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round` }));
        }
        for (const pt of seg) {
          svg.append(svgEl("circle", {
            cx: x(pt.issued), cy: y(pt[s.key].p), r: 4,
            style: `fill: ${s.color}; stroke: var(--surface); stroke-width: 2`,
          }));
        }
      }
      const last = [...points].reverse().find((pt) => pt[s.key]);
      if (last) ends.push({ s, x: x(last.issued), y: y(last[s.key].p), p: last[s.key].p });
    }

    // Direct end labels, only when they don't collide (otherwise the legend carries identity).
    if (ends.length && (ends.length < 2 || Math.abs(ends[0].y - ends[1].y) >= 14)) {
      for (const e of ends) {
        const t = svgEl("text", { x: e.x + 8, y: e.y + 4, style: "fill: var(--text-2); font-size: 11px; font-weight: 600" });
        t.textContent = `${e.s.short} ${pct(e.p)}`;
        svg.append(t);
      }
    }

    // Hover layer.
    const xs = points.map((pt) => x(pt.issued));
    const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    svg.append(hit);

    const show = (i) => {
      active = i;
      if (i < 0 || !points[i]) { cross.setAttribute("visibility", "hidden"); tip.hidden = true; return; }
      const pt = points[i];
      cross.setAttribute("x1", xs[i]); cross.setAttribute("x2", xs[i]);
      cross.setAttribute("visibility", "visible");
      tip.replaceChildren(el("div", { class: "tt-head" }, `Run of ${shortDate(pt.issued)}`));
      for (const s of series) {
        const r = pt[s.key];
        tip.append(el("div", { class: "tt-row" },
          el("i", { style: `background: ${s.color}` }), el("b", {}, r ? pct(r.p) : "–"),
          el("span", {}, `${s.label} · ${r ? `${leadWords(daysBetween(pt.issued, s.day))} · ${r.n} members` : "no forecast"}`)));
      }
      tip.hidden = false;
      const scale = wrap.clientWidth / W;
      const left = xs[i] * scale;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(0, left + 12 + tw > wrap.clientWidth ? left - tw - 12 : left + 12), Math.max(0, wrap.clientWidth - tw))}px`;
      // Keep the tooltip off the marks it describes: top of the plot, or bottom when they sit high.
      const highest = Math.min(...series.map((s) => (pt[s.key] ? y(pt[s.key].p) : Infinity)));
      tip.style.top = highest < m.t + ih / 2
        ? `${Math.max(0, (m.t + ih) * scale - tip.offsetHeight - 4)}px`
        : `${m.t * scale}px`;
    };
    const nearest = (evt) => {
      const r = svg.getBoundingClientRect();
      const px = ((evt.clientX - r.left) / r.width) * W;
      let best = -1, bd = Infinity;
      xs.forEach((xx, i) => { const d = Math.abs(xx - px); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    svg.addEventListener("pointermove", (e) => show(nearest(e)));
    svg.addEventListener("pointerdown", (e) => show(nearest(e)));
    svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") show(-1); });
    svg.addEventListener("blur", () => show(-1));
    svg.addEventListener("keydown", (e) => {
      if (!points.length) return;
      if (e.key === "ArrowRight") { show(Math.min(points.length - 1, active + 1)); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { show(Math.max(0, active < 0 ? points.length - 1 : active - 1)); e.preventDefault(); }
      else if (e.key === "Escape") show(-1);
    });
    if (active >= 0) show(active);
  }

  draw();
  let raf = 0;
  const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
  ro.observe(wrap);
  return () => ro.disconnect();
}

/** "5 days before", "1 day before", "same day". */
export function leadWords(lead) {
  return lead === 0 ? "same day" : `${lead} day${lead === 1 ? "" : "s"} before`;
}

/** Data table equivalent of the chart, for screen readers and anyone who prefers numbers. */
export function timelineTable(points, series) {
  const tbody = el("tbody");
  for (const pt of points) {
    tbody.append(el("tr", {},
      el("td", {}, shortDate(pt.issued)),
      ...series.flatMap((s) => [
        el("td", { class: "num" }, pt[s.key] ? pct(pt[s.key].p) : "–"),
        el("td", { class: "num" }, String(daysBetween(pt.issued, s.day)))]),
      el("td", { class: "num" }, String(pt.version))));
  }
  return el("div", { class: "table-wrap" }, el("table", {},
    el("thead", {}, el("tr", {},
      el("th", {}, "Run"),
      ...series.flatMap((s) => [el("th", { class: "num" }, s.label), el("th", { class: "num" }, "Days before")]),
      el("th", { class: "num" }, "Criteria version"))),
    tbody));
}
