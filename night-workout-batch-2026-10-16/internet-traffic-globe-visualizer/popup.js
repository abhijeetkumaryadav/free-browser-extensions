// Internet Traffic Globe — simulated canvas visualization.
// Zero network: every arc is randomly generated locally.

// ENGINE-START
'use strict';

const TAU = Math.PI * 2;

// City markers (name, lat, lon in degrees) — purely decorative.
const CITIES = [
  { name: 'New York',  lat: 40.7, lon: -74.0 },
  { name: 'London',    lat: 51.5, lon: -0.1 },
  { name: 'Tokyo',     lat: 35.7, lon: 139.7 },
  { name: 'Sydney',    lat: -33.9, lon: 151.2 },
  { name: 'São Paulo', lat: -23.5, lon: -46.6 },
  { name: 'Lagos',     lat: 6.5, lon: 3.4 },
  { name: 'Mumbai',    lat: 19.1, lon: 72.9 },
  { name: 'Singapore', lat: 1.4, lon: 103.8 },
  { name: 'Moscow',    lat: 55.8, lon: 37.6 },
  { name: 'Cape Town', lat: -33.9, lon: 18.4 },
  { name: 'San Francisco', lat: 37.8, lon: -122.4 },
  { name: 'Paris',     lat: 48.9, lon: 2.4 }
];

/** Convert lat/lon degrees to a unit 3D vector. */
function latLonToVec(lat, lon) {
  const la = lat * Math.PI / 180;
  const lo = lon * Math.PI / 180;
  return {
    x: Math.cos(la) * Math.cos(lo),
    y: Math.sin(la),
    z: Math.cos(la) * Math.sin(lo)
  };
}

/** Rotate a vector around the Y axis by `angle` radians. */
function rotateVec(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/** Orthographic projection: positive z faces the viewer. */
function project(v, cx, cy, r) {
  return { x: cx + v.x * r, y: cy - v.y * r, front: v.z > 0 };
}

/** Deterministic pseudo-random generator (mulberry32). */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick `count` distinct unordered city index pairs, no self-loops.
 * Deterministic for a given seed so tests are repeatable.
 */
function pickPairs(cityCount, count, seed) {
  const rnd = seededRandom(seed);
  const pairs = [];
  const seen = new Set();
  const maxTries = count * 40;
  let tries = 0;
  while (pairs.length < count && tries < maxTries) {
    tries++;
    const a = Math.floor(rnd() * cityCount);
    const b = Math.floor(rnd() * cityCount);
    if (a === b) continue;
    const key = a < b ? a + ':' + b : b + ':' + a;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ a, b });
  }
  return pairs;
}

/**
 * Points along a lifted arc between two cities.
 * `rot` rotates the whole scene; returns n+1 projected points.
 */
function arcPoints(cityA, cityB, cx, cy, r, rot, n) {
  const va = latLonToVec(cityA.lat, cityA.lon);
  const vb = latLonToVec(cityB.lat, cityB.lon);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Linear blend then renormalize (close enough to slerp for a doodle).
    let x = va.x + (vb.x - va.x) * t;
    let y = va.y + (vb.y - va.y) * t;
    let z = va.z + (vb.z - va.z) * t;
    const len = Math.hypot(x, y, z) || 1;
    // Altitude bump so arcs hop off the surface.
    const lift = 0.28 * Math.sin(Math.PI * t);
    const k = (1 + lift) / len;
    const v = rotateVec({ x: x * k, y: y * k, z: z * k }, rot);
    pts.push(project(v, cx, cy, r));
  }
  return pts;
}
// ENGINE-END

/* ------------------------------------------------------------------ */
/* UI: draws the globe, cities, arcs, and animated packet dots.        */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('globe');
const ctx = canvas.getContext('2d');
const CX = canvas.width / 2, CY = canvas.height / 2, R = 88;
const ACCENT = '#22d3ee';

let rotation = 0, speed = 1, playing = true;
let routes = [];
let packets = [];       // {route, t}
let delivered = 0;
let seedCounter = 7;

const elArcs = document.getElementById('stat-arcs');
const elPackets = document.getElementById('stat-packets');
const elHops = document.getElementById('stat-hops');

function regenRoutes() {
  const pairs = pickPairs(CITIES.length, 6, seedCounter);
  seedCounter += 13;
  routes = pairs.map((p, i) => ({
    a: CITIES[p.a], b: CITIES[p.b],
    hue: i,
    pts: null
  }));
  packets = routes.map(r => ({ route: r, t: Math.random() }));
  elArcs.textContent = routes.length;
  elHops.textContent = CITIES.length;
}

function drawSphere() {
  // Ocean disc.
  const g = ctx.createRadialGradient(CX - 20, CY - 30, 10, CX, CY, R);
  g.addColorStop(0, '#16233d');
  g.addColorStop(1, '#0b1224');
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();

  // Graticule.
  ctx.strokeStyle = 'rgba(120,160,220,0.16)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {           // latitude bands
    const la = (-60 + i * 24) * Math.PI / 180;
    const rr = R * Math.cos(la);
    const yy = CY - R * Math.sin(la);
    ctx.beginPath();
    ctx.ellipse(CX, yy, rr, Math.max(1.5, rr * 0.32), 0, 0, TAU);
    ctx.stroke();
  }
  for (let k = 0; k < 6; k++) {           // longitude ellipses
    const a = rotation + k * Math.PI / 3;
    ctx.beginPath();
    ctx.ellipse(CX, CY, Math.abs(Math.cos(a)) * R, R, 0, 0, TAU);
    ctx.stroke();
  }

  // Rim.
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.strokeStyle = 'rgba(34,211,238,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCities() {
  for (const c of CITIES) {
    const v = rotateVec(latLonToVec(c.lat, c.lon), rotation);
    const p = project(v, CX, CY, R);
    if (!p.front) continue;
    const depth = Math.min(1, Math.max(0, (v.z + 0.2) / 1.2));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5 + depth * 2, 0, TAU);
    ctx.fillStyle = 'rgba(34,211,238,' + (0.35 + depth * 0.65).toFixed(2) + ')';
    ctx.fill();
  }
}

function drawRoutes() {
  routes.forEach((r, idx) => {
    r.pts = arcPoints(r.a, r.b, CX, CY, R, rotation, 40);
    ctx.beginPath();
    r.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = 'rgba(34,211,238,' + (0.18 + 0.06 * (idx % 3)).toFixed(2) + ')';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
}

function drawPackets(dt) {
  packets.forEach(pk => {
    pk.t += dt * 0.25 * speed;
    if (pk.t >= 1) { pk.t = 0; delivered++; }
    const pts = pk.route.pts;
    if (!pts) return;
    const idx = Math.min(pts.length - 1, Math.floor(pk.t * (pts.length - 1)));
    const p = pts[idx];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, TAU);
    ctx.fillStyle = '#a5f3fc';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, TAU);
    ctx.strokeStyle = 'rgba(34,211,238,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  elPackets.textContent = delivered;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    rotation += dt * 0.25 * speed;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSphere();
    drawRoutes();
    drawCities();
    drawPackets(dt);
  }
  requestAnimationFrame(frame);
}

document.getElementById('btn-pause').addEventListener('click', (e) => {
  playing = !playing;
  e.currentTarget.textContent = playing ? 'Pause' : 'Play';
});
document.getElementById('btn-new').addEventListener('click', regenRoutes);
document.getElementById('speed').addEventListener('input', (e) => {
  speed = parseFloat(e.target.value);
});

regenRoutes();
requestAnimationFrame(frame);
