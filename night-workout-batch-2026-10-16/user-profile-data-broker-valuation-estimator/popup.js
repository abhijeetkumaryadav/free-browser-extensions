/* popup.js — Data Broker Value Estimator
 * Renders the questionnaire, computes the illustrative estimate live,
 * and persists answers locally. No network, no tracking.
 */
(function () {
  "use strict";

  const listEl = document.getElementById("question-list");
  const resultsEl = document.getElementById("results");
  const totalEl = document.getElementById("total");
  const tierEl = document.getElementById("tier");
  const tierBlurbEl = document.getElementById("tier-blurb");
  const breakdownEl = document.getElementById("breakdown");
  const resetBtn = document.getElementById("reset-btn");

  const STORAGE_KEY = "dbve_answers_v1";
  let answers = {};

  // ---- render questionnaire ----
  function renderQuestions() {
    listEl.innerHTML = "";
    for (const key of Object.keys(QUESTIONS)) {
      const q = QUESTIONS[key];
      const row = document.createElement("div");
      row.className = "q-row";

      const info = document.createElement("div");
      info.className = "q-info";
      const label = document.createElement("label");
      label.textContent = q.label;
      label.htmlFor = "q-" + key;
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = q.hint;
      info.appendChild(label);
      info.appendChild(hint);
      row.appendChild(info);

      if (q.kind === "toggle") {
        const sw = document.createElement("label");
        sw.className = "switch";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = "q-" + key;
        input.checked = answers[key] === 1;
        input.addEventListener("change", () => {
          answers[key] = input.checked ? 1 : 0;
          persist(); update();
        });
        const slider = document.createElement("span");
        slider.className = "slider";
        sw.appendChild(input);
        sw.appendChild(slider);
        row.appendChild(sw);
      } else {
        const input = document.createElement("input");
        input.type = "number";
        input.id = "q-" + key;
        input.min = "0";
        input.max = String(q.max);
        input.value = answers[key] || 0;
        input.addEventListener("input", () => {
          answers[key] = sanitizeAnswer(key, input.value);
          input.value = answers[key];
          persist(); update();
        });
        row.appendChild(input);
      }
      listEl.appendChild(row);
    }
  }

  // ---- compute + render results ----
  function update() {
    const { total, lines } = estimateValue(answers, DEFAULT_RATES);
    const anyInput = Object.values(answers).some((v) => Number(v) > 0);
    resultsEl.classList.toggle("hidden", !anyInput);
    if (!anyInput) return;

    totalEl.innerHTML = "$" + total.toFixed(2) + "<span>/yr</span>";
    const tier = tierFor(total);
    tierEl.textContent = tier.name;
    tierBlurbEl.textContent = tier.blurb;

    breakdownEl.innerHTML = "";
    const max = Math.max(...lines.map((l) => l.amount), 0.01);
    for (const line of lines) {
      if (line.amount <= 0) continue;
      const wrap = document.createElement("div");
      wrap.className = "line";
      const top = document.createElement("div");
      top.className = "line-top";
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = line.label;
      const amt = document.createElement("span");
      amt.className = "amt";
      amt.textContent = "$" + line.amount.toFixed(2);
      top.appendChild(lbl);
      top.appendChild(amt);
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("i");
      fill.style.width = Math.max(2, (line.amount / max) * 100) + "%";
      bar.appendChild(fill);
      wrap.appendChild(top);
      wrap.appendChild(bar);
      breakdownEl.appendChild(wrap);
    }
  }

  // ---- persistence ----
  function persist() {
    try { chrome.storage.local.set({ [STORAGE_KEY]: answers }); } catch (e) { /* noop */ }
  }
  function restore(done) {
    try {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        answers = (res && res[STORAGE_KEY]) || {};
        done();
      });
    } catch (e) { answers = {}; done(); }
  }

  resetBtn.addEventListener("click", () => {
    answers = {};
    persist();
    renderQuestions();
    update();
  });

  restore(() => { renderQuestions(); update(); });
})();
