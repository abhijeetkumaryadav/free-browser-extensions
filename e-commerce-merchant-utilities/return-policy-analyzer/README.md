# Return Policy Analyzer v1.0.0

**Return-policy analyzer.** On any store or product page, scan the
visible text for return-policy signals — return window in days, free
vs paid returns, restocking fees, final-sale flags, exchange-only
terms — and render a summary card with a 0–100 generosity score
(Generous / Fair / Strict / Harsh), the exact phrases found, and a
link to the store's full return policy when one is detectable.

Best-effort on-device heuristic; always check the store's full
policy before buying.

## Try it
1. Unzip `return-policy-analyzer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open any product page → click the icon → **Analyze**.

## Permissions
- `activeTab` + `scripting` — reads the text of the page you analyze,
  only when you click Analyze. No background scanning.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. Edge: free. Firefox: free.
- No network calls, no storage, no analytics. Everything on-device.
