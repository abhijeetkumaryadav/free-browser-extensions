// content.js — read-only lint engine injected on click only. Page is never modified.
// The exported function is serialized into the tab via chrome.scripting.executeScript.
// ENGINE-START
function lintPage() {
  const issues = [];
  const add = (rule, severity, detail) => issues.push({ rule, severity, detail });

  // 1. <html> lang attribute
  if (!document.documentElement.getAttribute("lang")) {
    add("missing-lang", "warn", "<html> has no lang attribute (helps screen readers & search).");
  }
  // 2. <title>
  const title = document.querySelector("head > title");
  if (!title || !title.textContent.trim()) {
    add("missing-title", "warn", "No <title> found in <head>.");
  }
  // 3. <meta charset>
  if (!document.querySelector('meta[charset]')) {
    add("missing-charset", "warn", "No <meta charset> declared.");
  }
  // 4. images without alt
  const imgs = [...document.images];
  const noAlt = imgs.filter((i) => !i.hasAttribute("alt"));
  if (noAlt.length) {
    add("img-no-alt", "err", noAlt.length + " <img> element(s) missing alt text (first: " +
      (noAlt[0].src || noAlt[0].outerHTML.slice(0, 60)) + ").");
  }
  // 5. duplicate ids
  const seen = new Map();
  const dupes = new Set();
  document.querySelectorAll("[id]").forEach((el) => {
    const id = el.id;
    if (seen.has(id)) dupes.add(id); else seen.set(id, 1);
  });
  if (dupes.size) {
    add("duplicate-id", "err", "Duplicate id(s): " + [...dupes].slice(0, 5).join(", ") +
      (dupes.size > 5 ? " (+" + (dupes.size - 5) + " more)" : ""));
  }
  // 6. nested interactive elements (a inside a, button inside a/button)
  let nested = 0;
  document.querySelectorAll("a a, button a, a button, button button").forEach(() => nested++);
  if (nested) {
    add("nested-interactive", "err", nested + " nested interactive element(s) (e.g. <a> inside <a>).");
  }
  // 7. <li> outside a list
  let strayLi = 0;
  document.querySelectorAll("li").forEach((li) => {
    if (!li.closest("ul, ol, menu")) strayLi++;
  });
  if (strayLi) {
    add("stray-li", "warn", strayLi + " <li> element(s) outside <ul>/<ol>.");
  }
  // 8. empty headings
  const emptyH = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter((h) => !h.textContent.trim()).length;
  if (emptyH) {
    add("empty-heading", "warn", emptyH + " empty heading element(s).");
  }
  return issues;
}
// ENGINE-END
