/* CarbonShip — freight CO2e estimator. 100% local, zero network.
   Emission factors are REPRESENTATIVE values in g CO2e per tonne-km,
   in the spirit of DEFRA/BEIS freight factors (see README for the exact
   table and caveats). Clearly labeled as estimates everywhere. */

// Representative emission factors: grams CO2e per tonne-km.
// Cited in README as estimates; real-world values vary by vehicle,
// load factor, fuel, and route.
const FACTORS = {
  air:  { gPerTkm: 500, label: 'Air freight (long-haul)',  note: '~500 g CO₂e/t·km — air is by far the most carbon-intensive.' },
  road: { gPerTkm: 62,  label: 'Road (HGV, avg. laden)',  note: '~62 g CO₂e/t·km — typical articulated HGV, average load.' },
  rail: { gPerTkm: 22,  label: 'Rail (diesel freight)',   note: '~22 g CO₂e/t·km — diesel freight rail, average load.' },
  sea:  { gPerTkm: 12,  label: 'Sea (container ship)',    note: '~12 g CO₂e/t·km — large container vessel, average load.' },
};

// Equivalents (representative)
const CAR_G_PER_KM = 192;   // avg petrol car, ~192 g CO2e/km
const TREE_KG_PER_YEAR = 21; // one tree absorbs ~21 kg CO2/year

const $ = (id) => document.getElementById(id);
let selectedMode = 'road';

// ---- Mode selection ----
document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
  });
});

// ---- Calculation ----
function calculate(weightKg, distanceKm, mode, roundTrip) {
  const factor = FACTORS[mode];
  const totalKm = roundTrip ? distanceKm * 2 : distanceKm;
  const tonneKm = (weightKg / 1000) * totalKm;
  const kgCO2e = (tonneKm * factor.gPerTkm) / 1000;
  return {
    kgCO2e,
    tonnes: kgCO2e / 1000,
    carKm: kgCO2e / (CAR_G_PER_KM / 1000),
    trees: kgCO2e / TREE_KG_PER_YEAR,
    factorNote: factor.note,
    modeLabel: factor.label,
  };
}

function fmt(n) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

$('calcBtn').addEventListener('click', async () => {
  const weight = Number($('weight').value);
  const distance = Number($('distance').value);
  if (!(weight > 0) || !(distance > 0)) {
    $('resultPanel').hidden = true;
    return;
  }
  const roundTrip = $('roundTrip').checked;
  const r = calculate(weight, distance, selectedMode, roundTrip);

  $('co2kg').textContent = fmt(r.kgCO2e);
  $('co2tonnes').textContent = `≈ ${fmt(r.tonnes)} tonnes CO₂e`;
  $('carKm').textContent = `${fmt(r.carKm)}`;
  $('trees').textContent = `${fmt(r.trees)}`;
  $('factorNote').textContent = `${r.modeLabel}: ${r.factorNote} Estimate — actual emissions vary by vehicle, load factor, fuel and route.`;
  $('resultPanel').hidden = false;

  // Persist last calculation locally
  await chrome.storage.local.set({ csLast: { weight, distance, mode: selectedMode, roundTrip, kgCO2e: r.kgCO2e } });
});

// ---- Restore last calculation ----
(async () => {
  const { csLast } = await chrome.storage.local.get('csLast');
  if (!csLast) {
    document.querySelector('.mode[data-mode="road"]').classList.add('active');
    return;
  }
  $('weight').value = csLast.weight;
  $('distance').value = csLast.distance;
  $('roundTrip').checked = !!csLast.roundTrip;
  selectedMode = csLast.mode || 'road';
  document.querySelectorAll('.mode').forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === selectedMode));
  $('calcBtn').click();
})();
