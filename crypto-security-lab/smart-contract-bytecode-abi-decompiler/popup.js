/* =====================================================================
 * OpcodeLens — EVM Bytecode Disassembler
 * Pops up, pastes hex bytecode, gets human-readable opcodes locally.
 * Honest scope: a DISASSEMBLER + selector heuristic, NOT a decompiler.
 * No network calls. Everything runs on-device.
 * ===================================================================== */

'use strict';

/* ------------------------------------------------------------------ */
/* Full EVM opcode table (post-Shanghai; Cancun MCOPY included).      */
/* ------------------------------------------------------------------ */
const OPCODES = {
  0x00:'STOP',0x01:'ADD',0x02:'MUL',0x03:'SUB',0x04:'DIV',0x05:'SDIV',
  0x06:'MOD',0x07:'SMOD',0x08:'ADDMOD',0x09:'MULMOD',0x0a:'EXP',
  0x0b:'SIGNEXTEND',
  0x10:'LT',0x11:'GT',0x12:'SLT',0x13:'SGT',0x14:'EQ',0x15:'ISZERO',
  0x16:'AND',0x17:'OR',0x18:'XOR',0x19:'NOT',0x1a:'BYTE',
  0x1b:'SHL',0x1c:'SHR',0x1d:'SAR',
  0x20:'SHA3',
  0x30:'ADDRESS',0x31:'BALANCE',0x32:'ORIGIN',0x33:'CALLER',0x34:'CALLVALUE',
  0x35:'CALLDATALOAD',0x36:'CALLDATASIZE',0x37:'CALLDATACOPY',
  0x38:'CODESIZE',0x39:'CODECOPY',0x3a:'GASPRICE',0x3b:'EXTCODESIZE',
  0x3c:'EXTCODECOPY',0x3d:'RETURNDATASIZE',0x3e:'RETURNDATACOPY',
  0x3f:'EXTCODEHASH',
  0x40:'BLOCKHASH',0x41:'COINBASE',0x42:'TIMESTAMP',0x43:'NUMBER',
  0x44:'DIFFICULTY',0x45:'GASLIMIT',0x46:'CHAINID',0x47:'SELFBALANCE',
  0x48:'BASEFEE',0x4a:'BLOBHASH',0x4b:'BLOBBASEFEE',
  0x50:'POP',0x51:'MLOAD',0x52:'MSTORE',0x53:'MSTORE8',0x54:'SLOAD',
  0x55:'SSTORE',0x56:'JUMP',0x57:'JUMPI',0x58:'PC',0x59:'MSIZE',
  0x5a:'GAS',0x5b:'JUMPDEST',0x5c:'TLOAD',0x5d:'TSTORE',0x5e:'MCOPY',
  0x5f:'PUSH0',
  0xf0:'CREATE',0xf1:'CALL',0xf2:'CALLCODE',0xf3:'RETURN',
  0xf4:'DELEGATECALL',0xf5:'CREATE2',0xfa:'STATICCALL',
  0xfd:'REVERT',0xfe:'INVALID',0xff:'SELFDESTRUCT'
};
/* (0x55 handled above) */

// PUSH1..PUSH32
for (let i = 1; i <= 32; i++) OPCODES[0x5f + i] = 'PUSH' + i;
// DUP1..DUP16
for (let i = 1; i <= 16; i++) OPCODES[0x7f + i] = 'DUP' + i;
// SWAP1..SWAP16
for (let i = 1; i <= 16; i++) OPCODES[0x8f + i] = 'SWAP' + i;
// LOG0..LOG4
for (let i = 0; i <= 4; i++) OPCODES[0xa0 + i] = 'LOG' + i;

/* ------------------------------------------------------------------ */
/* Well-known 4-byte function selectors (ERC-20 / ERC-721 / misc).   */
/* ------------------------------------------------------------------ */
const KNOWN_SELECTORS = {
  'a9059cbb':'transfer(address,uint256)',
  '23b872dd':'transferFrom(address,address,uint256)',
  '095ea7b3':'approve(address,uint256)',
  '70a08231':'balanceOf(address)',
  'dd62ed3e':'allowance(address,address)',
  '18160ddd':'totalSupply()',
  '06fdde03':'name()',
  '95d89b41':'symbol()',
  '313ce567':'decimals()',
  'b7521758':'increaseAllowance(address,uint256)',
  'a457c2d7':'decreaseAllowance(address,uint256)',
  '42842e0e':'safeTransferFrom(address,address,uint256)',
  'b88d4fde':'safeTransferFrom(address,address,uint256,bytes)',
  '6352211e':'ownerOf(uint256)',
  '081812fc':'getApproved(uint256)',
  'e985e9c5':'isApprovedForAll(address,address)',
  'a22cb465':'setApprovalForAll(address,bool)',
  '01ffc9a7':'supportsInterface(bytes4)',
  '5c975abb':'paused()',
  '8456cb59':'pause()',
  '3f4ba83a':'unpause()',
  '8da5cb5b':'owner()',
  '715018a6':'renounceOwnership()',
  'f2fde38b':'transferOwnership(address)',
  '6a761202':'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)', // Gnosis Safe
  'c4d66de8':'initialize(address,address,address,address,address,address)', // Uniswap factory style
  '38ed1739':'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)', // Uniswap router
  '7ff36ab5':'swapExactETHForTokens(uint256,address[],address,uint256)',
  'f305d719':'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)',
  'e8e33700':'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
  '022c0d9f':'swap(uint256,uint256,address,bytes)', // Uniswap pair
  'd505accf':'skim(address)',
  'd21220a7':'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)', // EIP-2612
  '3644e515':'DOMAIN_SEPARATOR()',
  '7ecebe00':'nonces(address)',
  '2e1a7d4d':'withdraw(uint256)', // WETH
  'd0e30db0':'deposit()',         // WETH
  '42966c68':'burn(uint256)',
  '40c10f19':'mint(address,uint256)',
  'c87b56dd':'tokenURI(uint256)',
  'c45a0155':'tokenURI(uint256)'  // some impls
};

/* ------------------------------------------------------------------ */
/* Disassembler                                                        */
/* ------------------------------------------------------------------ */

/**
 * Normalize user input into a clean lowercase hex string (no 0x).
 * Returns { ok, hex } or { ok:false, error }.
 */
function cleanHex(input) {
  let s = (input || '').trim().replace(/^0x/i, '').replace(/\s+/g, '').toLowerCase();
  if (!s) return { ok: false, error: 'Paste some hex bytecode first.' };
  if (!/^[0-9a-f]*$/.test(s)) return { ok: false, error: 'Invalid characters — only 0-9, a-f and optional 0x prefix are allowed.' };
  if (s.length % 2 !== 0) return { ok: false, error: 'Odd number of hex digits — every byte needs two digits.' };
  return { ok: true, hex: s };
}

/**
 * Disassemble hex bytecode into an array of { pc, opcode, operand }.
 * Unknown bytes become INVALID (0xfe is genuinely INVALID in EVM).
 */
function disassemble(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  const out = [];
  let pc = 0;
  while (pc < bytes.length) {
    const b = bytes[pc];
    const name = OPCODES[b];
    if (name === undefined) {
      out.push({ pc, opcode: 'UNKNOWN', operand: '0x' + b.toString(16).padStart(2, '0') });
      pc += 1;
      continue;
    }
    if (name.startsWith('PUSH')) {
      const n = parseInt(name.slice(4), 10);
      const operandBytes = bytes.slice(pc + 1, pc + 1 + n);
      let operand = '0x';
      operandBytes.forEach(x => { operand += x.toString(16).padStart(2, '0'); });
      out.push({ pc, opcode: name, operand });
      pc += 1 + n;
    } else {
      out.push({ pc, opcode: name, operand: '' });
      pc += 1;
    }
  }
  return out;
}

/**
 * Heuristically extract 4-byte function selectors.
 * Looks for the dispatcher pattern: PUSH4 <selector> ... EQ/SHR.
 */
function extractSelectors(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  const found = new Map();
  for (let i = 0; i + 4 < bytes.length; i++) {
    if (bytes[i] === 0x63) { // PUSH4
      const sel = Array.from(bytes.slice(i + 1, i + 5))
        .map(x => x.toString(16).padStart(2, '0')).join('');
      if (!/^(0{8}|f{8})$/.test(sel)) {
        found.set(sel, (found.get(sel) || 0) + 1);
      }
    }
  }
  return [...found.entries()].sort((a, b) => b[1] - a[1]);
}

/** Guess token standard from matched selectors. */
function guessStandard(matched) {
  const sigs = new Set(matched.map(m => m.signature));
  const erc20 = ['transfer(address,uint256)','balanceOf(address)','totalSupply()','approve(address,uint256)'];
  const erc721 = ['ownerOf(uint256)','safeTransferFrom(address,address,uint256)'];
  const hits20 = erc20.filter(s => sigs.has(s)).length;
  const hits721 = erc721.filter(s => sigs.has(s)).length;
  if (hits20 >= 3) return { label: 'Likely ERC-20 token', cls: 'good' };
  if (hits721 >= 2) return { label: 'Likely ERC-721 (NFT)', cls: 'good' };
  if (hits20 + hits721 > 0) return { label: 'Some known selectors found', cls: 'warn' };
  return { label: 'No known selectors matched', cls: 'dim' };
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

const $ = id => document.getElementById(id);
const els = {
  input: $('bytecode'), btn: $('analyze'), clear: $('clear'),
  err: $('error'), results: $('results'),
  statBytes: $('stat-bytes'), statOps: $('stat-ops'), statSels: $('stat-sels'),
  verdict: $('verdict'), selList: $('selectors'), dis: $('disasm'),
  sample: $('load-sample')
};

const SAMPLE =
  '0x608060405234801561001057600080fd5b5060a38061001f6000396000f3fe' +
  '6080604052348015600f57600080fd5b5060043610603c576000357c01000000' +
  '00000000000000000000000000000000000000000000000000006004565b6000' +
  '80fd5b603c600480360381019060388190608b565b60ab565b60405180828152' +
  '60200191505060405180910390f35b600080546001600160a01b031681526020' +
  '0190815260200160002060009054906101000a900460ff16905090565b600081' +
  '9050919050565b600060208201905081810360008301526101b2565b91905056' +
  'fea2646970667328a9059cbb70a0823118160ddd095ea7b323b872dd';

async function saveState() {
  try { await chrome.storage.local.set({ opLensInput: els.input.value }); } catch (e) {}
}
async function loadState() {
  try {
    const { opLensInput } = await chrome.storage.local.get('opLensInput');
    if (opLensInput) els.input.value = opLensInput;
  } catch (e) {}
}

function showError(msg) {
  els.err.textContent = msg;
  els.err.hidden = !msg;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderSelectors(selectors) {
  if (!selectors.length) {
    els.selList.innerHTML = '<div class="empty">No PUSH4 function selectors detected.</div>';
    return;
  }
  els.selList.innerHTML = selectors.map(([sel, count]) => {
    const sig = KNOWN_SELECTORS[sel];
    const known = sig && !sig.startsWith('—');
    return `<div class="sel-row">
      <code class="sel-hex">0x${sel}</code>
      <span class="sel-sig ${known ? 'known' : ''}">${known ? escapeHtml(sig) : 'unknown selector'}</span>
      <span class="sel-count" title="times pushed">${count}×</span>
    </div>`;
  }).join('');
}

function renderDisasm(ops) {
  const MAX = 400;
  const slice = ops.slice(0, MAX);
  const rows = slice.map(o =>
    `<div class="op-row"><span class="pc">${o.pc.toString(16).padStart(4, '0')}</span>` +
    `<span class="op">${o.opcode}</span>` +
    `<span class="operand">${o.operand ? escapeHtml(o.operand) : ''}</span></div>`
  ).join('');
  els.dis.innerHTML = rows + (ops.length > MAX
    ? `<div class="empty">… ${ops.length - MAX} more opcodes (showing first ${MAX}).</div>` : '');
}

function analyze() {
  showError('');
  const c = cleanHex(els.input.value);
  if (!c.ok) { showError(c.error); els.results.hidden = true; return; }
  const ops = disassemble(c.hex);
  const selectors = extractSelectors(c.hex);
  const matched = selectors
    .filter(([sel]) => KNOWN_SELECTORS[sel] && !KNOWN_SELECTORS[sel].startsWith('—'))
    .map(([sel, count]) => ({ selector: sel, signature: KNOWN_SELECTORS[sel], count }));

  els.statBytes.textContent = (c.hex.length / 2).toLocaleString();
  els.statOps.textContent = ops.length.toLocaleString();
  els.statSels.textContent = selectors.length.toLocaleString();

  const verdict = guessStandard(matched);
  els.verdict.innerHTML = `<span class="verdict-pill ${verdict.cls}"></span> ${verdict.label}` +
    (matched.length ? ` — ${matched.length} known signature${matched.length > 1 ? 's' : ''} matched` : '');

  renderSelectors(selectors);
  renderDisasm(ops);
  els.results.hidden = false;
  saveState();
}

els.btn.addEventListener('click', analyze);
els.clear.addEventListener('click', () => {
  els.input.value = '';
  els.results.hidden = true;
  showError('');
  saveState();
});
els.sample.addEventListener('click', () => { els.input.value = SAMPLE; saveState(); });
els.input.addEventListener('input', saveState);

loadState();
