// Free Learning Logbook — popup logic. 100% local; only official free links.
// NEVER bypasses paywalls: entries are links the user saves themselves.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Bundled starter list: well-known, officially free educational resources.
  const STARTERS = [
    { title: "Khan Academy", url: "https://www.khanacademy.org", topic: "general", type: "course", rating: 5, starter: true },
    { title: "MIT OpenCourseWare", url: "https://ocw.mit.edu", topic: "general", type: "course", rating: 5, starter: true },
    { title: "MDN Web Docs", url: "https://developer.mozilla.org", topic: "web dev", type: "docs", rating: 5, starter: true },
    { title: "freeCodeCamp", url: "https://www.freecodecamp.org", topic: "web dev", type: "course", rating: 5, starter: true },
    { title: "Project Gutenberg", url: "https://www.gutenberg.org", topic: "books", type: "book", rating: 4, starter: true },
    { title: "OpenStax textbooks", url: "https://openstax.org", topic: "textbooks", type: "book", rating: 5, starter: true },
    { title: "CrashCourse (YouTube)", url: "https://www.youtube.com/user/crashcourse", topic: "general", type: "video", rating: 4, starter: true },
    { title: "CS50 (Harvard, edX)", url: "https://cs50.harvard.edu", topic: "cs", type: "course", rating: 5, starter: true }
  ];

  async function load() {
    const { resources } = await chrome.storage.local.get({ resources: null });
    if (resources === null) {
      await chrome.storage.local.set({ resources: STARTERS });
      return STARTERS;
    }
    return resources;
  }
  const save = r => chrome.storage.local.set({ resources: r });

  function render(list, q, topic) {
    const el = $("list");
    const ql = q.trim().toLowerCase();
    const shown = list.filter(r => {
      if (topic && r.topic !== topic) return false;
      if (!ql) return true;
      return (r.title + " " + r.topic + " " + r.type + " " + r.url).toLowerCase().includes(ql);
    });
    if (!shown.length) { el.innerHTML = '<div class="empty">No resources match. Add your own above ↑</div>'; return; }
    el.innerHTML = shown.map(r => {
      const i = list.indexOf(r);
      const stars = r.rating ? "★".repeat(r.rating) : "";
      return `<div class="card">
        <div class="t"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></div>
        <div class="meta"><span class="tag">${esc(r.topic)}</span><span>${esc(r.type)}</span><span>${stars}</span>
        <button class="del" data-i="${i}" title="Remove">×</button></div>
      </div>`;
    }).join("");
    el.querySelectorAll(".del").forEach(b => b.addEventListener("click", async () => {
      const all = await load();
      all.splice(+b.dataset.i, 1);
      await save(all);
      sync();
    }));
  }

  async function sync() {
    const list = await load();
    const topics = [...new Set(list.map(r => r.topic))].sort();
    const f = $("topicFilter");
    const cur = f.value;
    f.innerHTML = '<option value="">All topics</option>' + topics.map(t => `<option${t === cur ? " selected" : ""}>${esc(t)}</option>`).join("");
    render(list, $("q").value, f.value);
  }

  $("q").addEventListener("input", sync);
  $("topicFilter").addEventListener("change", sync);

  $("save").addEventListener("click", async () => {
    const title = $("fTitle").value.trim();
    let url = $("fUrl").value.trim();
    if (!title || !url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const list = await load();
    list.unshift({ title, url, topic: $("fTopic").value.trim() || "general", type: $("fType").value, rating: +$("fRating").value });
    await save(list);
    ["fTitle", "fUrl", "fTopic"].forEach(id => $(id).value = "");
    $("fRating").value = "0";
    sync();
  });

  sync();
})();
