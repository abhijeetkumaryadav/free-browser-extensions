# Address Permutation Verifier v1.0.0

Seller fraud/duplicate tool: paste shipping addresses (one per block,
blank-line separated), it normalizes them (lowercase, St→Street,
Ave→Avenue, Rd→Road, etc., punctuation and extra spaces stripped) and
flags likely duplicates with a similarity score (hybrid token-Jaccard +
Levenshtein), grouped by union-find. Adjustable sensitivity 70–100%.

## Try it
1. Unzip `address-permutation-verifier.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Paste addresses → **Analyze addresses**.

## Publishing notes
- Permissions: `storage` only (remembers your last pasted input). All analysis on-device.
- Chrome Web Store: $5 one-time dev fee.
