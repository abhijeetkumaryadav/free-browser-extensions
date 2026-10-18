/* Zero-Knowledge Proof Session Authenticator — EDUCATIONAL DEMO.
 * Simulates a Schnorr-style discrete-log proof locally between a prover
 * panel and a verifier panel. Toy group (p=23, q=11, g=2) — NOT secure,
 * NOT real authentication. For teaching the protocol flow only. */
'use strict';

/* Toy group parameters. g^q = 1 mod p. Clearly insecure by design. */
const P = 23n, Q = 11n, G = 2n;

const $ = (id) => document.getElementById(id);

/* Modular exponentiation (square-and-multiply). */
function modPow(base, exp, mod) {
  let r = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) r = (r * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return r;
}

/* Crypto-strong random integer in [1, Q-1] via WebCrypto. */
function randScalar() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return BigInt((buf[0] % Number(Q - 1n)) + 1);
}

const S = { x: null, y: null, r: null, t: null, c: null, s: null };

function log(msg) {
  const li = document.createElement('li');
  li.textContent = msg;
  $('log').appendChild(li);
  li.scrollIntoView({ block: 'nearest' });
}

function set(id, v) { $(id).textContent = String(v); }

function refreshButtons() {
  $('s1').disabled = S.x !== null;
  $('s2').disabled = S.x === null || S.r !== null;
  $('s3').disabled = S.r === null || S.c !== null;
  $('s4').disabled = S.c === null || S.s !== null;
  $('s5').disabled = S.s === null;
  $('run').disabled = S.x !== null;
}

function step1() {
  S.x = randScalar();
  S.y = modPow(G, S.x, P);
  set('vX', S.x); set('vY', S.y);
  log(`Keygen: prover picks secret x=${S.x}, publishes y=g^x mod p = ${S.y}.`);
  refreshButtons();
}
function step2() {
  S.r = randScalar();
  S.t = modPow(G, S.r, P);
  set('vR', S.r); set('vT', S.t);
  log(`Commit: prover picks random r=${S.r}, sends t=g^r mod p = ${S.t}. (x stays hidden)`);
  refreshButtons();
}
function step3() {
  S.c = randScalar();
  set('vC', S.c);
  log(`Challenge: verifier picks random c=${S.c} and sends it to the prover.`);
  refreshButtons();
}
function step4() {
  S.s = (S.r + S.c * S.x) % Q;
  set('vS', S.s);
  log(`Respond: prover computes s = r + c·x mod q = ${S.s} and sends s.`);
  refreshButtons();
}
function step5() {
  const lhs = modPow(G, S.s, P);            // g^s
  const rhs = (S.t * modPow(S.y, S.c, P)) % P; // t · y^c
  set('vGs', lhs); set('vTyc', rhs);
  const ok = lhs === rhs;
  const el = $('result');
  el.className = 'result ' + (ok ? 'ok' : 'fail');
  el.textContent = ok ? '✓ PROOF VALID — session authenticated (demo)' : '✗ PROOF INVALID';
  log(`Verify: g^s mod p = ${lhs}; t·y^c mod p = ${rhs} → ${ok ? 'MATCH. Verifier convinced, learned nothing about x.' : 'MISMATCH.'}`);
  refreshButtons();
}

function reset() {
  Object.keys(S).forEach((k) => (S[k] = null));
  ['vX','vY','vR','vT','vS','vC','vGs','vTyc'].forEach((id) => set(id, '–'));
  const el = $('result');
  el.className = 'result idle'; el.textContent = 'not run';
  $('log').innerHTML = '';
  refreshButtons();
}

document.addEventListener('DOMContentLoaded', () => {
  set('pP', P); set('pG', G); set('pQ', Q);
  $('s1').addEventListener('click', step1);
  $('s2').addEventListener('click', step2);
  $('s3').addEventListener('click', step3);
  $('s4').addEventListener('click', step4);
  $('s5').addEventListener('click', step5);
  $('run').addEventListener('click', () => { step1(); step2(); step3(); step4(); step5(); });
  $('reset').addEventListener('click', reset);
  refreshButtons();
});
