// popup.js — stats display, sound preference, open the full-page game.
(function () {
  "use strict";

  var totalEl = document.getElementById("totalPops");
  var streakEl = document.getElementById("bestStreak");
  var soundToggle = document.getElementById("soundToggle");
  var openBtn = document.getElementById("openBtn");

  // Load stored stats and preferences.
  chrome.storage.local.get({ totalPops: 0, bestStreak: 0, sound: true }, function (res) {
    totalEl.textContent = res.totalPops.toLocaleString();
    streakEl.textContent = res.bestStreak.toLocaleString();
    soundToggle.setAttribute("aria-checked", String(res.sound));
  });

  soundToggle.addEventListener("click", function () {
    var on = soundToggle.getAttribute("aria-checked") !== "true";
    soundToggle.setAttribute("aria-checked", String(on));
    chrome.storage.local.set({ sound: on });
  });

  openBtn.addEventListener("click", function () {
    chrome.tabs.create({ url: chrome.runtime.getURL("game.html") });
  });
})();
