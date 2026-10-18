/* Wireframe Converter — popup logic.
 * Injects content.js on demand, receives the generated wireframe HTML,
 * shows stats, and downloads the standalone file.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let lastHtml = "";

  function setStatus(text) {
    const el = $("status");
    el.textContent = text;
    el.classList.remove("hidden");
  }

  $("convert").addEventListener("click", async () => {
    const btn = $("convert");
    btn.disabled = true;
    $("download").classList.add("hidden");
    $("stats").classList.add("hidden");
    setStatus("Analyzing page layout…");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const res = await chrome.tabs.sendMessage(tab.id, { type: "WF_BUILD" });

      if (!res || res.error) throw new Error(res && res.error ? res.error : "no response");
      if (!res.blocks) {
        setStatus("No visible layout blocks found — the page may be empty or heavily scripted.");
        return;
      }

      lastHtml = res.html;
      const kb = (res.bytes / 1024).toFixed(1);
      $("stats").innerHTML =
        '<div class="stat"><b>' + res.blocks + '</b><span>placeholder blocks</span></div>' +
        '<div class="stat"><b>' + kb + ' KB</b><span>wireframe file</span></div>';
      $("stats").classList.remove("hidden");
      $("download").classList.remove("hidden");
      setStatus("Wireframe ready — structural sketch with placeholder boxes.");
    } catch (e) {
      setStatus(
        "Could not access this page (" + (e.message || e) + "). " +
        "Open a normal web page (not a chrome:// or store page) and try again."
      );
    } finally {
      btn.disabled = false;
    }
  });

  $("download").addEventListener("click", () => {
    const blob = new Blob([lastHtml], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wireframe.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
})();
