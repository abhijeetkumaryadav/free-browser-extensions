// ============================================================================
// Delta-V Estimator — Tsiolkovsky rocket equation
// Fully local textbook physics. Zero network.
// ============================================================================

// ENGINE-START
const STORE_KEY = 'delta_v_v1';

// delta-v for one stage: dv = Isp * g0 * ln((dry+prop)/dry)
// Returns { dv, massRatio, valid, error }.
function stageDeltaV(dryKg, propKg, ispS, g0) {
  const dry = Number(dryKg), prop = Number(propKg), isp = Number(ispS), g = Number(g0);
  if (![dry, prop, isp, g].every(Number.isFinite)) return { valid: false, error: 'Enter numbers for all fields.' };
  if (dry <= 0) return { valid: false, error: 'Dry mass must be > 0.' };
  if (prop < 0) return { valid: false, error: 'Propellant must be ≥ 0.' };
  if (isp <= 0 || g <= 0) return { valid: false, error: 'Isp and g₀ must be > 0.' };
  const massRatio = (dry + prop) / dry;
  return { valid: true, dv: isp * g * Math.log(massRatio), massRatio };
}

// Multi-stage: each stage's dv computed against the CURRENT stack mass.
// stages: [{ dryKg, propKg, ispS }]; upper stages ride as payload.
// Returns { rows: [{dv, massRatio}], total } or { valid:false, error }.
function multiStageDeltaV(stages, g0) {
  const g = Number(g0);
  if (!Number.isFinite(g) || g <= 0) return { valid: false, error: 'g₀ must be > 0.' };
  const rows = [];
  let total = 0;
  // stackMass = dry+prop of all stages; as stages burn/drop, it shrinks.
  let stackMass = stages.reduce((s, st) => s + Number(st.dryKg || 0) + Number(st.propKg || 0), 0);
  for (const st of stages) {
    const r = stageDeltaV(stackMass - Number(st.propKg || 0), Number(st.propKg || 0), st.ispS, g);
    if (!r.valid) return { valid: false, error: r.error };
    rows.push(r);
    total += r.dv;
    stackMass -= Number(st.dryKg || 0) + Number(st.propKg || 0); // stage dropped
  }
  return { valid: true, rows, total };
}

function fmtDv(v) {
  if (v >= 1000) return (v / 1000).toFixed(2) + ' km/s';
  return Math.round(v) + ' m/s';
}
// ENGINE-END

// --- UI --------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

// --- single stage ---
$('calc').addEventListener('click', () => {
  const r = stageDeltaV($('dry').value, $('prop').value, $('isp').value, $('g0').value);
  const box = $('result');
  box.hidden = false;
  if (!r.valid) {
    $('dvVal').textContent = '—';
    $('dvMeta').textContent = r.error;
    return;
  }
  $('dvVal').textContent = Math.round(r.dv).toLocaleString();
  $('dvMeta').textContent = `Mass ratio ${(r.massRatio).toFixed(2)} · exhaust velocity ≈ ${fmtDv(Number($('isp').value) * Number($('g0').value))}`;
});

// --- multi-stage ---
let stageRows = [{ dryKg: 4000, propKg: 30000, ispS: 311 }, { dryKg: 1000, propKg: 8000, ispS: 348 }];

function renderStages() {
  const wrap = $('stages');
  wrap.innerHTML = '';
  stageRows.forEach((st, i) => {
    const div = document.createElement('div');
    div.className = 'stage';
    div.innerHTML = `
      <label style="font-size:11px;color:var(--muted)">Dry kg<input type="number" min="0" step="any" value="${st.dryKg}"></label>
      <label style="font-size:11px;color:var(--muted)">Prop kg<input type="number" min="0" step="any" value="${st.propKg}"></label>
      <label style="font-size:11px;color:var(--muted)">Isp s<input type="number" min="0" step="any" value="${st.ispS}"></label>
      <button title="Remove stage">×</button>
    `;
    const [d, p, s] = div.querySelectorAll('input');
    d.addEventListener('input', () => (stageRows[i].dryKg = d.value));
    p.addEventListener('input', () => (stageRows[i].propKg = p.value));
    s.addEventListener('input', () => (stageRows[i].ispS = s.value));
    div.querySelector('button').addEventListener('click', () => {
      if (stageRows.length > 1) { stageRows.splice(i, 1); renderStages(); }
    });
    wrap.appendChild(div);
  });
}

$('addStage').addEventListener('click', () => {
  if (stageRows.length < 6) { stageRows.push({ dryKg: 0, propKg: 0, ispS: 311 }); renderStages(); }
});

$('calcStages').addEventListener('click', () => {
  const r = multiStageDeltaV(stageRows, $('g0').value);
  const box = $('stageResult');
  box.innerHTML = '';
  if (!r.valid) {
    box.innerHTML = `<div class="meta">${r.error}</div>`;
    return;
  }
  r.rows.forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'stage-row';
    div.innerHTML = `<span>Stage ${i + 1}</span><b>${fmtDv(row.dv)}</b>`;
    box.appendChild(div);
  });
  const tot = document.createElement('div');
  tot.className = 'total';
  tot.innerHTML = `<span>Total Δv</span><b>${fmtDv(r.total)}</b>`;
  box.appendChild(tot);
});

renderStages();
