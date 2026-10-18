# Prompt Injection Awareness — Privacy Shield Guide

An educational guide to prompt-injection attacks with a defense checklist and a personal safe-prompting notes log.

> **Educational only — not protection.** This extension does not detect, block, or filter prompt-injection attacks. It explains the concept, shows example attack patterns, offers a defense checklist, and lets you keep personal notes. Nothing leaves your browser; everything is stored locally.

## Features

- **Guide tab** — plain-language explanation of prompt injection, common attack patterns (direct injection, indirect injection via web pages/files, jailbreak roles, data exfiltration), and defense-in-depth ideas (least privilege, human-in-the-loop, content delimitation, output validation, no secrets in prompts).
- **Defense Checklist tab** — 8-item interactive checklist with a live progress bar; progress persists in `chrome.storage.local`.
- **My Notes tab** — personal safe-prompting notes log (title + body), newest-first, with delete. Fully local.

## Privacy

- Permissions: `storage` only.
- No network requests. No analytics. No remote code.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable "Developer mode".
3. Click "Load unpacked" and select this folder.

## Limitations

This is an awareness/educational tool. It cannot protect you from prompt injection — no browser extension can reliably do that today. Treat every AI output and every untrusted input with caution.
