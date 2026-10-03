// Shared page behavior: theme toggle, sample-data badge, small DOM helpers.
import { isSample } from "./data.js";

/** Create an element. Text content is always set with textContent, never innerHTML. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Carry ?sample across internal links so sample mode stays on while browsing. */
export function withSample(href) {
  if (!isSample || /[?&]sample\b/.test(href)) return href;
  const [path, hash] = href.split("#");
  return path + (path.includes("?") ? "&" : "?") + "sample" + (hash != null ? "#" + hash : "");
}

function setupTheme() {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  const root = document.documentElement;
  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const current = () => root.dataset.theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const paint = () => {
    const dark = current() === "dark";
    btn.innerHTML = dark ? sun : moon; // static icon markup only
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage unavailable */ }
    paint();
    document.dispatchEvent(new CustomEvent("themechange"));
  });
  paint();
}

function setupSampleMode() {
  if (!isSample) return;
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (/^\/?([a-z]+\.html)?$/.test(href)) a.setAttribute("href", withSample(href));
  }
  const header = document.querySelector(".site-header .brand");
  header?.after(el("span", { class: "badge sample", title: "Showing made-up sample data, not real forecasts" }, "Sample data"));
}

setupTheme();
setupSampleMode();
