// Brand page: fill each swatch with its live hex value for the current theme, copy on click,
// and render sample day tiles and a wind dial with the real components.
import { directionDial } from "./site-card.js";
import { dayTile } from "./day-tile.js";

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

const isDark = () => document.documentElement.dataset.scheme === "dark";

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
paint();

document.getElementById("demo-dial").append(directionDial([[340, 20]]));

document.getElementById("demo-tiles").append(
  dayTile({ size: "large", label: "Saturday Oct 3", color: "var(--series-sat)", value: 0.94,
    trend: { icon: "↗", word: "Rising" }, detail: "+52 pts over 13 runs" }),
  dayTile({ size: "compact", label: "Sun Oct 4", color: "var(--series-sun)", value: 0.16,
    spark: [0.29, 0.26, 0.29, 0.29, 0.26, 0.29, 0.23, 0.19, 0.19, 0.19, 0.16, 0.16], detail: "No change since last run" }));
