# OpcodeLens — EVM Bytecode Disassembler (v1.0.0)

Paste Ethereum Virtual Machine bytecode and get a human-readable opcode disassembly, 4-byte function selector extraction, and a heuristic guess at the token standard — all offline, on your device.

**Honest scope:** this is a *disassembler* plus a selector-matching heuristic. It is **not** a decompiler — it does not reconstruct Solidity source, control-flow graphs, or storage layouts. Selector extraction uses the common `PUSH4` dispatcher pattern and can miss selectors in unusual compilers.

## Features
- Full EVM opcode table (incl. PUSH0, MCOPY, BLOBHASH) → disassembly with program counters
- 4-byte function selector extraction with hit counts
- ~30 well-known selectors labeled (ERC-20, ERC-721, Uniswap, WETH, Safe…)
- "Likely ERC-20 / ERC-721" heuristic verdict
- Sample bytecode loader, input persisted locally

## Install
1. Unzip `smart-contract-bytecode-abi-decompiler.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

## Permissions
- `storage` — remembers your last pasted bytecode. Nothing else.

No network calls are made, ever. Works in Chrome, Edge, Opera; Firefox via temporary add-on load.

## Publishing notes
- No remote code, no data collection → store-friendly.
- Do not market it as a "decompiler" — listing copy must say "disassembler".
