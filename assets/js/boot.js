// Runs on every page: system theme tracking and the sample-data badge.
import { isSample } from "./data.js";
import { el, withSample } from "./common.js";

/**
 * Theme: follows the system setting.
 * data-scheme always holds the theme in use, for the few things CSS light-dark() can't cover.
 * Fires "themechange" whenever it changes.
 */
function setupTheme() {
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    root.dataset.scheme = system.matches ? "dark" : "light";
    document.dispatchEvent(new CustomEvent("themechange"));
  };
  system.addEventListener("change", sync);
  sync();
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
