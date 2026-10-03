// Small DOM helpers shared by the page scripts. No side effects on import (startup is in boot.js).
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
