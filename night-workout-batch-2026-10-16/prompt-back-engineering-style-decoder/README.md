# Prompt Style Analyzer

**Paste a prompt and get a heuristic style breakdown.** Describes surface
patterns: instruction density, role framing, listed constraints, and
structural elements (lists, quotes, code blocks, headers).

## What it does

- **Instruction density:** imperative/instruction words per 100 words
- **Role framing:** detects "you are a…", "act as…", persona patterns
- **Constraints:** counts numbered/bulleted list items (often constraints)
- **Structure flags:** numbered lists, bullets, quoted examples, code
  blocks, markdown sections — each with a plain-language note
- **Your notes:** private field for what you notice, autosaved locally

## Honest scope

- **Heuristic only — not decoding.** It cannot decode anyone's intent,
  recover a system prompt, or tell you what a prompt "really does".
- Patterns are surface-level; a "highly structured" label is about the
  text's shape, not its quality or power.
- Fully local: no network, nothing uploaded.

## Technical

- Manifest V3, permission: `storage` only (session + notes)
- Pure-JS engine between `// ENGINE-START` / `// ENGINE-END` markers
- 380px deep-dark glassmorphism popup, single cyan accent, Lucide-style
  outline icons
- Headless engine tests: 19/19 pass
