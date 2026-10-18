# PromptShield — AI Injection Heuristic Scanner

A browser extension that scans pasted prompt text for common prompt-injection
patterns: instruction overrides, role-play jailbreaks, prompt-leak probes,
fake system delimiters, hidden/deceptive unicode, base64 payload blobs,
exfiltration attempts, encoding evasion, token-smuggling separators, and
hypothetical framing.

**Important: this is a heuristic scanner, NOT a security guarantee.**
A clean result does not mean the text is safe, and flagged items are signals
to review — not proof of malice. Always review suspicious content yourself.

## Install

**Chrome / Edge**
1. Download and unzip `ai-prompt-injection-payload-shield.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder. (Temporary until signed
   via AMO for permanent install.)

## Usage

1. Click the PromptShield toolbar icon.
2. Paste the prompt or user-supplied input into the text box.
3. Press **Scan** (or Ctrl/Cmd+Enter).
4. Review the risk score (0–100), verdict (SAFE / CAUTION / RISKY), and each
   finding with severity level, explanation, and matched excerpts.
5. **Clear** wipes the input and the locally saved draft.

## How the scoring works

- High-severity finding: +25 · Medium: +12 · Low: +5 (capped at 100)
- 0 → SAFE · 1–39 → CAUTION · 40+ → RISKY
- Findings are sorted by severity. Each card shows why the pattern is
  suspicious and the exact matched excerpts.

## Permissions

- `storage` — remembers your last pasted draft locally so it survives the
  popup closing. Nothing else is stored or transmitted.

## Privacy

100% on-device. No network calls, no analytics, no data leaves your browser.
The scan engine is a set of regular expressions and unicode checks in
`popup.js`.

## Publishing notes

- Manifest V3, no remote code, no deprecated APIs.
- Single accent color (#ef4444); all other UI is neutral dark.
- Firefox: `storage` and MV3 are fully supported; submit to AMO for signing.
