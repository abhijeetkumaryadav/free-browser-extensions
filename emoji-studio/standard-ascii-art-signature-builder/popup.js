// SigArt — ASCII Art Signature Builder
// Built-in 5x5 pixel bitmap font, implemented locally (no network, no FIGlet files).
// Renders each character as 5 rows x 5 columns; "#" = filled cell.

"use strict";

/* ---------------- 5x5 bitmap font ---------------- */
// Each glyph: 5 strings of 5 chars. "#" filled, "." empty.
const FONT = {
  "A": [".###.", "#...#", "#####", "#...#", "#...#"],
  "B": ["####.", "#...#", "####.", "#...#", "####."],
  "C": [".####", "#....", "#....", "#....", ".####"],
  "D": ["####.", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "####.", "#....", "#####"],
  "F": ["#####", "#....", "####.", "#....", "#...."],
  "G": [".####", "#....", "#.###", "#...#", ".###."],
  "H": ["#...#", "#...#", "#####", "#...#", "#...#"],
  "I": ["#####", "..#..", "..#..", "..#..", "#####"],
  "J": ["..###", "...#.", "...#.", "#..#.", ".##.."],
  "K": ["#...#", "#..#.", "###..", "#..#.", "#...#"],
  "L": ["#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "####.", "#....", "#...."],
  "Q": [".###.", "#...#", "#...#", "#.#.#", ".##.#"],
  "R": ["####.", "#...#", "####.", "#..#.", "#...#"],
  "S": [".####", "#....", ".###.", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", ".###."],
  "V": ["#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
  "X": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  "Y": ["#...#", ".#.#.", "..#..", "..#..", "..#.."],
  "Z": ["#####", "....#", "...#.", "..#..", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", ".###."],
  "2": [".###.", "....#", "..##.", ".#...", "#####"],
  "3": ["####.", "....#", "..##.", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#####", "...#."],
  "5": ["#####", "#....", "####.", "....#", "####."],
  "6": [".####", "#....", "####.", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#.."],
  "8": [".###.", "#...#", ".###.", "#...#", ".###."],
  "9": [".###.", "#...#", ".####", "....#", "####."],
  " ": [".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", "..#..", "..#.."],
  ",": [".....", ".....", ".....", "..#..", ".#..."],
  "!": ["..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "....#", "...#.", ".....", "..#.."],
  "'": ["..#..", "..#..", ".....", ".....", "....."],
  "-": [".....", ".....", "#####", ".....", "....."],
  "_": [".....", ".....", ".....", ".....", "#####"],
  ":": [".....", "..#..", ".....", "..#..", "....."],
  ";": [".....", "..#..", ".....", "..#..", ".#..."],
  "(": ["...#.", "..#..", "..#..", "..#..", "...#."],
  ")": [".#...", "..#..", "..#..", "..#..", ".#..."],
  "/": ["....#", "...#.", "..#..", ".#...", "#...."],
  "\\": ["#....", ".#...", "..#..", "...#.", "....#"],
  "@": [".###.", "#.#.#", "#.###", "#....", ".###."],
  "#": [".#.#.", "#####", ".#.#.", "#####", ".#.#."],
  "$": ["..#..", ".####", "#.#..", ".####", "..#.."],
  "%": ["##..#", "##.#.", "..#..", ".#.##", "#..##"],
  "&": [".##..", "#..#.", ".#.#.", "#..#.", ".##.#"],
  "*": [".....", ".#.#.", "..#..", ".#.#.", "....."],
  "+": [".....", "..#..", "#####", "..#..", "....."],
  "=": [".....", "#####", ".....", "#####", "....."],
  "<": ["...#.", "..#..", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "..#..", ".#..."],
  "\"": [".#.#.", ".#.#.", ".....", ".....", "....."],
  "|": ["..#..", "..#..", "..#..", "..#..", "..#.."],
};
const BLANK = [".....", ".....", ".....", ".....", "....."];

/* ---------------- rendering ---------------- */

/**
 * Render text as ASCII art.
 * @param {string} text  - text to render (one line)
 * @param {string} fill  - character used for filled cells
 * @param {number} scale - glyph scale (1..3): each cell repeated scale x scale
 * @param {number} spacing - blank columns between glyphs (0..3)
 * @returns {string} multi-line ASCII art
 */
function renderAscii(text, fill, scale, spacing) {
  const f = (fill && fill.length ? fill[0] : "#");
  const rows = ["", "", "", "", ""];
  const chars = text.toUpperCase().split("");
  chars.forEach((ch, ci) => {
    const glyph = FONT[ch] || BLANK;
    for (let r = 0; r < 5; r++) {
      let line = "";
      for (let c = 0; c < 5; c++) {
        const cell = glyph[r][c] === "#" ? f : " ";
        line += cell.repeat(scale);       // horizontal scale
      }
      for (let vr = 0; vr < scale; vr++) {
        rows[r * scale + vr] = (rows[r * scale + vr] || "") + line;
      }
    }
    // letter spacing (skip after last char)
    if (ci < chars.length - 1) {
      for (let r = 0; r < 5 * scale; r++) {
        rows[r] = (rows[r] || "") + " ".repeat(spacing * scale);
      }
    }
  });
  return rows.join("\n");
}

/* ---------------- popup wiring ---------------- */

const textInput = document.getElementById("textInput");
const fillChar = document.getElementById("fillChar");
const scaleEl = document.getElementById("scale");
const scaleVal = document.getElementById("scaleVal");
const spacingEl = document.getElementById("spacing");
const spacingVal = document.getElementById("spacingVal");
const preview = document.getElementById("preview");
const stats = document.getElementById("stats");
const statusEl = document.getElementById("status");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");

const STORE_KEY = "sigart.settings";

function currentSettings() {
  return {
    text: textInput.value,
    fill: fillChar.value || "#",
    scale: Number(scaleEl.value),
    spacing: Number(spacingEl.value),
  };
}

function render() {
  const s = currentSettings();
  scaleVal.textContent = s.scale + "×";
  spacingVal.textContent = s.spacing;
  const lines = s.text.split("\n").map((ln) => renderAscii(ln, s.fill, s.scale, s.spacing));
  const art = lines.join("\n\n");
  preview.textContent = art || " ";
  const w = Math.max(...art.split("\n").map((l) => l.length), 0);
  const h = art.split("\n").length;
  stats.textContent = art.trim() ? `${w} × ${h} chars` : "";
  chrome.storage.local.set({ [STORE_KEY]: s });
  return art;
}

function setStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("ok", !!ok);
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => {
    statusEl.textContent = "Rendered locally with the built-in 5×5 pixel font. No network.";
    statusEl.classList.remove("ok");
  }, 2200);
}

[textInput, fillChar].forEach((el) => el.addEventListener("input", render));
[scaleEl, spacingEl].forEach((el) => el.addEventListener("input", render));

copyBtn.addEventListener("click", async () => {
  const art = render();
  try {
    await navigator.clipboard.writeText(art);
    setStatus("Copied to clipboard ✓", true);
  } catch (e) {
    // Fallback for clipboard denial.
    const ta = document.createElement("textarea");
    ta.value = art;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setStatus("Copied to clipboard ✓", true);
  }
});

downloadBtn.addEventListener("click", () => {
  const art = render();
  const blob = new Blob([art + "\n"], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sigart-signature.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus("Downloaded sigart-signature.txt ✓", true);
});

/* ---------------- init ---------------- */

// Restore last session's settings; prefill a friendly demo on first run.
chrome.storage.local.get([STORE_KEY], (res) => {
  const s = res[STORE_KEY];
  if (s) {
    textInput.value = s.text || "";
    fillChar.value = s.fill || "#";
    scaleEl.value = s.scale || 1;
    spacingEl.value = s.spacing != null ? s.spacing : 1;
  } else {
    textInput.value = "RDX";
  }
  render();
});
