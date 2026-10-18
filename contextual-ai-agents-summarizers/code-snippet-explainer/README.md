# Code Snippet Explainer v1.0.0

Scan any page for code blocks (`<pre>`/`<code>`), then click one to
get an **on-device structural explanation**: detected language,
line/function/class/comment counts, and a plain-language summary of
the code's shape. Analysis is template-based heuristics — clearly
labeled in the UI, **not AI**. Copy the explanation with one click;
recent explanations are kept on-device.

## Try it
1. Unzip `code-snippet-explainer.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select folder.
3. Open a docs page, GitHub, or Stack Overflow → click the icon → **Scan page** → click a block.

## Permissions
- `activeTab` + `scripting` — collect code blocks from the page you are viewing. Nothing else is read.
- `storage` — recent explanations saved on-device. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee. No remote code, no network calls.
- Firefox: no changes needed (MV3 compatible).
