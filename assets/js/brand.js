// Brand page: fill each swatch with its live hex value for the current theme, copy on click,
// and draw a sample wind dial from the real component.
import { directionDial } from "./site-card.js";

const swatches = [...document.querySelectorAll(".swatch[data-token]")];
const status = document.getElementById("copy-status");

/** Resolve a CSS custom property to #rrggbb (or rgba) by letting the browser compute it. */
function resolve(token) {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  probe.style.display = "none";
  document.body.append(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const m = rgb.match(/[\d.]+/g);
  if (!m) return rgb;
  const [r, g, b, a] = m.map(Number);
  const hex = "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  return a != null && a < 1 ? `${hex} @ ${Math.round(a * 100)}%` : hex;
}

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

function paint() {
  for (const s of swatches) s.querySelector(".hex").textContent = resolve(s.dataset.token);
  document.getElementById("theme-note").textContent = isDark()
    ? "Showing the dark theme. Use the sun button to see light."
    : "Showing the light theme. Use the moon button to see dark.";
}

for (const s of swatches) {
  s.addEventListener("click", async () => {
    const hex = s.querySelector(".hex").textContent.split(" ")[0];
    try {
      await navigator.clipboard.writeText(hex);
      status.textContent = `Copied ${hex} (${s.dataset.token}).`;
    } catch {
      status.textContent = `${s.dataset.token} is ${hex}.`;
    }
  });
}

document.addEventListener("themechange", paint);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint);
paint();

document.getElementById("demo-dial").append(directionDial([[340, 20]]));
