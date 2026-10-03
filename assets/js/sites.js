// Sites page: every row of the site list, forecast ones first.
import { loadSites } from "./data.js";
import { el } from "./common.js";
import { siteCard } from "./site-card.js";

const box = document.getElementById("sites");
loadSites().then((sites) => {
  sites.sort((a, b) => Number(b.active) - Number(a.active));
  box.replaceChildren(...sites.map((s) => siteCard(s, { heading: "h2" })));
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}).catch((e) => {
  console.error(e);
  box.replaceChildren(el("p", { class: "muted" }, "The site list could not be loaded. Try again later."));
});
