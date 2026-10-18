/* CiteIt — APA 7th / MLA 9th citation builder for web pages. All on-device. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    authors: $("authors"), title: $("title"), site: $("site"),
    pubDate: $("pubDate"), url: $("url"),
    citation: $("citation"), copy: $("copy"), save: $("save"),
    copied: $("copied"), autofill: $("autofill"),
    tabs: [...document.querySelectorAll(".tab")],
    library: $("library"), libEmpty: $("libEmpty"),
    libCount: $("libCount"), export: $("export")
  };

  let style = "apa";

  /* ============ author parsing ============
   * Input: "Smith, John; Doe, Jane" → [{last, first}, ...]          */
  function parseAuthors(raw) {
    return raw.split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
      const parts = s.split(",").map((p) => p.trim());
      return { last: parts[0] || "", first: parts[1] || "" };
    }).filter((a) => a.last);
  }

  const initials = (first) =>
    first.split(/[\s-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + ".").join(" ");

  function apaAuthors(authors) {
    if (!authors.length) return "";
    const formatted = authors.map((a) => a.first ? `${a.last}, ${initials(a.first)}` : a.last);
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
    return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
  }

  function mlaAuthors(authors) {
    if (!authors.length) return "";
    if (authors.length === 1) {
      const a = authors[0];
      return a.first ? `${a.last}, ${a.first}` : a.last;
    }
    if (authors.length === 2) {
      const [a, b] = authors;
      const first = a.first ? `${a.last}, ${a.first}` : a.last;
      const second = b.first ? `${b.first} ${b.last}` : b.last;
      return `${first}, and ${second}`;
    }
    const a = authors[0];
    const first = a.first ? `${a.last}, ${a.first}` : a.last;
    return `${first}, et al.`;
  }

  /* ============ date handling ============ */
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const MONTHS_SHORT = ["Jan.","Feb.","Mar.","Apr.","May","June","July","Aug.","Sept.","Oct.","Nov.","Dec."];

  function parseDate(raw) {
    if (!raw || !raw.trim()) return null;
    const d = new Date(raw.trim());
    return isNaN(d.getTime()) ? null : d;
  }

  /* ============ formatters ============ */
  function formatAPA() {
    const authors = parseAuthors(els.authors.value);
    const title = els.title.value.trim();
    const site = els.site.value.trim();
    const url = els.url.value.trim();
    const d = parseDate(els.pubDate.value);

    if (!title && !authors.length && !url) return "";

    let out = "";
    const a = apaAuthors(authors);
    if (a) out += a + " ";
    out += d ? `(${d.getFullYear()}, ${MONTHS[d.getMonth()]} ${d.getDate()}). ` : "(n.d.). ";
    out += title ? `${title}. ` : "[Untitled]. ";
    if (site) out += `${site}. `;
    if (url) out += url;
    return out.trim();
  }

  function formatMLA() {
    const authors = parseAuthors(els.authors.value);
    const title = els.title.value.trim();
    const site = els.site.value.trim();
    const url = els.url.value.trim();
    const d = parseDate(els.pubDate.value);

    if (!title && !authors.length && !url) return "";

    let out = "";
    const a = mlaAuthors(authors);
    if (a) out += a.replace(/\.$/, "") + ". ";
    out += title ? `"${title}." ` : "";
    if (site) out += `${site}, `;
    if (d) out += `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, `;
    if (url) out += url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return out.trim().replace(/\.$/, "") + ".";
  }

  function render() {
    const text = style === "apa" ? formatAPA() : formatMLA();
    if (text) {
      els.citation.textContent = text;
      els.citation.classList.remove("empty-note");
    } else {
      els.citation.textContent = "Fill in the fields above to generate a citation.";
      els.citation.classList.add("empty-note");
    }
  }

  /* ============ auto-fill from active tab ============ */
  function extractMetadata() {
    // Runs in the page (isolated world is fine — DOM is readable).
    const meta = (name) => {
      const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return el ? (el.getAttribute("content") || "").trim() : "";
    };
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const title = ((ogTitle && ogTitle.getAttribute("content")) || document.title || "").trim();
    const author = meta("author") || meta("article:author") || "";
    const site = meta("og:site_name")
      || document.querySelector('meta[name="application-name"]')?.content || "";
    const pub = meta("article:published_time") || meta("date") || meta("publish_date") || "";
    return { title, author, site, pub };
  }

  els.autofill.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) return;
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractMetadata
      });
      if (result) {
        if (result.title && !els.title.value) els.title.value = result.title;
        if (result.author && !els.authors.value) {
          // "John Smith" → "Smith, John"
          const parts = result.author.split(/\s+/);
          els.authors.value = parts.length > 1
            ? `${parts.slice(1).join(" ")}, ${parts[0]}`
            : result.author;
        }
        if (result.site && !els.site.value) els.site.value = result.site;
        if (result.pub && !els.pubDate.value) els.pubDate.value = result.pub.slice(0, 10);
        if (tab.url && !els.url.value) els.url.value = tab.url;
        render();
      }
    } catch {
      // e.g. chrome:// pages — user can type fields manually.
      els.citation.textContent = "Could not read this tab (browser pages are restricted). Type the fields manually.";
      els.citation.classList.add("empty-note");
    }
  });

  /* ============ copy / save / library ============ */
  els.copy.addEventListener("click", async () => {
    const text = els.citation.textContent;
    if (!text || els.citation.classList.contains("empty-note")) return;
    try {
      await navigator.clipboard.writeText(text);
      els.copied.classList.remove("hidden");
      setTimeout(() => els.copied.classList.add("hidden"), 1600);
    } catch { /* clipboard may be blocked; text remains selectable */ }
  });

  async function getLibrary() {
    const { citeit } = await chrome.storage.local.get("citeit");
    return (citeit && citeit.library) || [];
  }
  async function setLibrary(library) {
    await chrome.storage.local.set({ citeit: { library } });
  }

  function renderLibrary(items) {
    els.library.innerHTML = "";
    els.libCount.textContent = String(items.length);
    els.libEmpty.style.display = items.length ? "none" : "";
    items.forEach((item, i) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.className = "text";
      span.textContent = `[${item.style.toUpperCase()}] ${item.text}`;
      const del = document.createElement("button");
      del.className = "del";
      del.title = "Delete";
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
      del.addEventListener("click", async () => {
        const lib = await getLibrary();
        lib.splice(i, 1);
        await setLibrary(lib);
        renderLibrary(lib);
      });
      li.append(span, del);
      els.library.appendChild(li);
    });
  }

  els.save.addEventListener("click", async () => {
    const text = els.citation.textContent;
    if (!text || els.citation.classList.contains("empty-note")) return;
    const lib = await getLibrary();
    lib.unshift({ style, text, savedAt: new Date().toISOString() });
    await setLibrary(lib.slice(0, 200));
    renderLibrary(await getLibrary());
  });

  els.export.addEventListener("click", async () => {
    const lib = await getLibrary();
    if (!lib.length) return;
    const body = lib.map((c, i) => `${i + 1}. [${c.style.toUpperCase()}]\n${c.text}\n`).join("\n");
    const blob = new Blob([`CiteIt export — ${new Date().toLocaleDateString()}\n\n${body}`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "citeit-citations.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

  /* ============ tabs & live render ============ */
  els.tabs.forEach((t) => t.addEventListener("click", () => {
    style = t.dataset.style;
    els.tabs.forEach((x) => x.classList.toggle("active", x === t));
    render();
  }));
  [els.authors, els.title, els.site, els.pubDate, els.url].forEach((f) =>
    f.addEventListener("input", render));

  (async () => {
    render();
    renderLibrary(await getLibrary());
  })();
})();
