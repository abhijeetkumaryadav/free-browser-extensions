/* Zero Knowledge Sync Vault — client-side AES-256-GCM notes vault.
 * Crypto: PBKDF2-SHA256 (120k iterations) -> AES-GCM 256. The password is
 * never stored and never transmitted; only salt + ciphertext live in storage.
 * Honest scope: local-only vault (no server sync). Portable via export/import. */
"use strict";

/* ---------- Crypto helpers ---------- */
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Derive an AES-GCM key from password + salt via PBKDF2. */
async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a notes array; returns { salt, iv, data } as base64. */
async function encryptVault(password, notes) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(notes))
  );
  return {
    salt: b64encode(salt.buffer),
    iv: b64encode(iv.buffer),
    data: b64encode(ct),
  };
}

/** Decrypt a vault blob with password; throws on wrong password. */
async function decryptVault(password, blob) {
  const key = await deriveKey(password, b64decode(blob.salt));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64decode(blob.iv)) },
    key,
    b64decode(blob.data)
  );
  return JSON.parse(dec.decode(pt));
}

/* ---------- State (in-memory only; password/key never touch disk) ---------- */
let masterPassword = null; // session only — cleared on lock
let notes = [];
let editingId = null;

/* ---------- Storage ---------- */
async function loadBlob() {
  const { vaultBlob } = await chrome.storage.local.get("vaultBlob");
  return vaultBlob || null;
}
async function saveBlob(blob) {
  await chrome.storage.local.set({ vaultBlob: blob });
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const lockScreen = $("lockScreen"), vaultScreen = $("vaultScreen");
const lockCopy = $("lockCopy"), lockHint = $("lockHint"), lockError = $("lockError");
const passwordInput = $("passwordInput"), confirmInput = $("confirmInput");
const unlockBtn = $("unlockBtn");
const notesList = $("notesList"), emptyState = $("emptyState");
const editor = $("editor"), noteTitle = $("noteTitle"), noteBody = $("noteBody");

function showError(msg) {
  lockError.textContent = msg;
  lockError.classList.remove("hidden");
}
function clearError() {
  lockError.classList.add("hidden");
  lockError.textContent = "";
}

/* ---------- Lock screen ---------- */
async function initLockScreen() {
  const blob = await loadBlob();
  const isFirstRun = !blob;
  if (isFirstRun) {
    lockCopy.textContent = "Create your vault password.";
    lockHint.textContent =
      "First run: choose a strong password. It is never stored anywhere — lose it and your notes are unrecoverable.";
    confirmInput.classList.remove("hidden");
    unlockBtn.textContent = "Create vault";
  } else {
    lockCopy.textContent = "Enter your password to unlock the vault.";
    lockHint.textContent = "Your password is never stored or transmitted.";
    confirmInput.classList.add("hidden");
    unlockBtn.textContent = "Unlock vault";
  }
  lockScreen.classList.remove("hidden");
  vaultScreen.classList.add("hidden");
  passwordInput.value = "";
  confirmInput.value = "";
  clearError();
  passwordInput.focus();
}

async function handleUnlock() {
  clearError();
  const pw = passwordInput.value;
  if (!pw) return showError("Please enter a password.");
  const blob = await loadBlob();

  if (!blob) {
    // First run: create vault
    if (pw !== confirmInput.value) return showError("Passwords do not match.");
    if (pw.length < 8) return showError("Use at least 8 characters.");
    masterPassword = pw;
    notes = [];
    await saveBlob(await encryptVault(masterPassword, notes));
    openVault();
    return;
  }

  try {
    notes = await decryptVault(pw, blob);
    masterPassword = pw;
    openVault();
  } catch (e) {
    showError("Wrong password. Try again.");
  }
}

function openVault() {
  lockScreen.classList.add("hidden");
  vaultScreen.classList.remove("hidden");
  renderNotes();
}

function lockVault() {
  masterPassword = null;
  notes = [];
  editingId = null;
  editor.classList.add("hidden");
  initLockScreen();
}

/* ---------- Notes ---------- */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderNotes() {
  notesList.innerHTML = "";
  const sorted = [...notes].sort((a, b) => b.updated - a.updated);
  emptyState.classList.toggle("hidden", sorted.length > 0);

  for (const n of sorted) {
    const div = document.createElement("div");
    div.className = "note";
    const date = new Date(n.updated).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
    div.innerHTML =
      '<div class="note-head">' +
        '<span class="note-title">' + escapeHtml(n.title || "Untitled") + "</span>" +
        '<span class="note-date">' + date + "</span>" +
        '<div class="note-actions">' +
          '<button class="icon-btn" data-act="edit" title="Edit">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>' +
          '<button class="icon-btn danger" data-act="del" title="Delete">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        "</div>" +
      "</div>" +
      '<div class="note-preview">' + escapeHtml((n.body || "").slice(0, 90)) + "</div>";
    div.querySelector('[data-act="edit"]').addEventListener("click", () => startEdit(n.id));
    div.querySelector('[data-act="del"]').addEventListener("click", () => deleteNote(n.id));
    notesList.appendChild(div);
  }
}

function startEdit(id) {
  editingId = id || null;
  const n = id ? notes.find((x) => x.id === id) : null;
  noteTitle.value = n ? n.title : "";
  noteBody.value = n ? n.body : "";
  editor.classList.remove("hidden");
  noteTitle.focus();
}

function cancelEdit() {
  editingId = null;
  editor.classList.add("hidden");
}

async function saveNote() {
  const title = noteTitle.value.trim();
  const body = noteBody.value;
  if (!title && !body.trim()) { cancelEdit(); return; }
  const now = Date.now();
  if (editingId) {
    const n = notes.find((x) => x.id === editingId);
    if (n) { n.title = title; n.body = body; n.updated = now; }
  } else {
    notes.push({ id: "n" + now + Math.floor(Math.random() * 1e6), title, body, updated: now });
  }
  await saveBlob(await encryptVault(masterPassword, notes));
  editingId = null;
  editor.classList.add("hidden");
  renderNotes();
}

async function deleteNote(id) {
  notes = notes.filter((x) => x.id !== id);
  await saveBlob(await encryptVault(masterPassword, notes));
  renderNotes();
}

/* ---------- Export / import (portable encrypted blob) ---------- */
function downloadJson(filename, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportVault() {
  const blob = await loadBlob();
  if (!blob) return;
  downloadJson("vault-export-" + new Date().toISOString().slice(0, 10) + ".json", blob);
}

function importVaultFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const blob = JSON.parse(reader.result);
      if (!blob.salt || !blob.iv || !blob.data) throw new Error("bad blob");
      // Validate the blob decrypts with the CURRENT session password before replacing
      await decryptVault(masterPassword, blob);
      await saveBlob(blob);
      notes = await decryptVault(masterPassword, blob);
      renderNotes();
    } catch (e) {
      alert("Import failed: file is not a valid vault, or it was encrypted with a different password.");
    }
  };
  reader.readAsText(file);
}

/* ---------- Wire up ---------- */
unlockBtn.addEventListener("click", handleUnlock);
passwordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleUnlock(); });
confirmInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleUnlock(); });
$("addNoteBtn").addEventListener("click", () => startEdit(null));
$("cancelEditBtn").addEventListener("click", cancelEdit);
$("saveNoteBtn").addEventListener("click", saveNote);
$("lockBtn").addEventListener("click", lockVault);
$("exportBtn").addEventListener("click", exportVault);
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", (e) => {
  if (e.target.files[0]) importVaultFile(e.target.files[0]);
  e.target.value = "";
});

initLockScreen();
