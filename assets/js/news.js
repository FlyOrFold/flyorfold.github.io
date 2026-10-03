// News page: filter the timeline by topic. Without JS every item shows and the buttons stay hidden.
const filter = document.getElementById("topic-filter");
const buttons = [...filter.querySelectorAll("button")];
const groups = [...document.querySelectorAll(".tl-month-group")];
const empty = document.getElementById("topic-empty");

function apply(topic) {
  for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.topic === topic));
  let shown = 0;
  for (const g of groups) {
    let inGroup = 0;
    for (const item of g.querySelectorAll(".tl-item")) {
      const match = !topic || item.dataset.topic === topic;
      item.hidden = !match;
      if (match) inGroup++;
    }
    g.hidden = inGroup === 0;
    shown += inGroup;
  }
  empty.hidden = shown > 0 || !groups.length;
  const url = new URL(location.href);
  if (topic) url.searchParams.set("topic", topic); else url.searchParams.delete("topic");
  history.replaceState(null, "", url);
}

for (const b of buttons) b.addEventListener("click", () => apply(b.dataset.topic));
filter.hidden = false;
const initial = new URLSearchParams(location.search).get("topic") ?? "";
apply(buttons.some((b) => b.dataset.topic === initial) ? initial : "");
