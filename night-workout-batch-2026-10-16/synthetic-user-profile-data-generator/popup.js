// Test Profile Generator — generates CLEARLY-FAKE dev test data only.
// All values are fictional: @example.test emails, 555-01XX phones, "Test User-XXXX" names.
// ENGINE-START
const FIRST = ["Testy","Quix","Fable","Mock","Dummy","Trial","Zany","Proto"];
const LAST = ["Tester","McTestface","Faketson","Sampleson","Demoite","Trialsson"];
const STREETS = ["123 Null Lane","456 Void Street","789 Example Ave","101 Test Blvd"];
const CITIES = ["Testville","Mock City","Sampletown"];
const COMPANIES = ["Acme Test Labs","Example Corp","Dummy Industries","Nullsoft Labs"];

function rand(arr, r) { return arr[Math.floor(r() * arr.length)]; }
function randInt(min, max, r) { return Math.floor(r() * (max - min + 1)) + min; }
function pad(n, w) { return String(n).padStart(w, "0"); }

// mulberry32 PRNG for deterministic-ish generation
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genProfile(fields, r) {
  const code = pad(randInt(1000, 9999, r), 4) + ["A","B","C","D"][randInt(0,3,r)];
  const p = {};
  if (fields.has("name"))  p.name = `Test User-${code}`;
  if (fields.has("email")) p.email = `test.user.${code.toLowerCase()}@example.test`;
  if (fields.has("phone")) p.phone = `555-01${pad(randInt(0,99,r),2)}`;
  if (fields.has("address")) p.address = `${rand(STREETS,r)}, ${rand(CITIES,r)}, ST 00000`;
  if (fields.has("company")) p.company = `${rand(COMPANIES,r)} (TEST)`;
  if (fields.has("dob")) p.dob = `${randInt(1970,2000,r)}-${pad(randInt(1,12,r),2)}-${pad(randInt(1,28,r),2)}`;
  p._testOnly = true;
  return p;
}
// ENGINE-END

let lastProfiles = [];

document.getElementById("generate").addEventListener("click", () => {
  const qty = Math.min(20, Math.max(1, parseInt(document.getElementById("qty").value, 10) || 3));
  const fields = new Set(
    [...document.querySelectorAll("#fields input:checked")].map(el => el.dataset.f)
  );
  if (fields.size === 0) { setStatus("Select at least one field."); return; }

  const r = makeRng(Date.now());
  lastProfiles = Array.from({ length: qty }, () => genProfile(fields, r));
  render(lastProfiles);
  document.getElementById("copyAll").disabled = false;
  setStatus(`${qty} fake profile${qty > 1 ? "s" : ""} generated — TEST DATA ONLY`);
});

function render(profiles) {
  const box = document.getElementById("results");
  box.innerHTML = "";
  for (const p of profiles) {
    const div = document.createElement("div");
    div.className = "profile";
    for (const [k, v] of Object.entries(p)) {
      if (k === "_testOnly") continue;
      const row = document.createElement("div");
      row.className = "row";
      const kk = document.createElement("span"); kk.className = "k"; kk.textContent = k;
      const vv = document.createElement("span"); vv.className = "v"; vv.textContent = v;
      row.append(kk, vv); div.appendChild(row);
    }
    box.appendChild(div);
  }
}

document.getElementById("copyAll").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastProfiles, null, 2));
    setStatus("Copied as JSON.");
  } catch { setStatus("Copy failed — select and copy manually."); }
});

function setStatus(msg) { document.getElementById("status").textContent = msg; }
