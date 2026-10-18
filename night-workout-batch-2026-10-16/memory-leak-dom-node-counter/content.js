// content.js — counts DOM nodes on the page. Boot-once guard.
(() => {
  if (window.__domNodeCounterLoaded) return;
  window.__domNodeCounterLoaded = true;

  function snapshot() {
    const counts = Object.create(null);
    const els = document.getElementsByTagName("*");
    for (let i = 0; i < els.length; i++) {
      const tag = els[i].tagName.toLowerCase();
      counts[tag] = (counts[tag] || 0) + 1;
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, n]) => ({ tag, n }));
    return { total: els.length, top, at: Date.now() };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg && msg.type === "DOMNODE_SNAPSHOT") respond(snapshot());
  });
})();
