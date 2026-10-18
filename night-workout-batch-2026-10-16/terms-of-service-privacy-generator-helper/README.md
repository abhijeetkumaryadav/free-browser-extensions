# Policy Draft Helper

Answer a short wizard about your service and get a plain-language **Terms of Service**
and **Privacy Policy** template draft, ready to copy.

## ⚠️⚠️ NOT LEGAL ADVICE — GET A LAWYER

This extension generates **template starting points only**. The law differs by country
(GDPR, CCPA/CPRA, DPDP Act, consumer-protection rules…), and a template cannot know
your business. **A qualified lawyer in your jurisdiction MUST review and adapt the
draft before you publish it.** Every screen in the extension repeats this reminder.

## What it does

1. Wizard asks: service name, service type, contact email, region, and what data you collect (checkboxes).
2. Generates two drafts with your answers filled in, region guidance notes, and
   cookie/analytics/payment clauses that follow your checkbox answers.
3. Tab between the two drafts, copy to clipboard, edit in your own editor.

## Privacy

- Answers are saved only in `chrome.storage.local` on your device so the wizard
  remembers you next time.
- Zero network calls. No analytics, no tracking.

## Install (development)

1. Open `chrome://extensions` (or Edge `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this folder.

## Files

- `manifest.json` — Manifest V3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — wizard + template builder
- `icons/` — generated PNG icons
