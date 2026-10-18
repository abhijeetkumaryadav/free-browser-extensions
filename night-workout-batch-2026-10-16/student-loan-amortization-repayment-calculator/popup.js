// Loan Repay Planner — amortization math + extra-payment scenario comparison.
// Educational estimates only; assumes fixed APR and on-time monthly payments.

"use strict";

/* ---------- math ---------- */

/** Monthly payment for a fixed-rate amortizing loan. */
function monthlyPayment(balance, apr, months) {
  if (months <= 0) return 0;
  const r = apr / 100 / 12;
  if (r === 0) return balance / months;
  const f = Math.pow(1 + r, months);
  return (balance * r * f) / (f - 1);
}

/**
 * Amortize a loan. `extra` = additional principal paid each month.
 * Returns { schedule: [{year, principal, interest, endBalance}], totalInterest, monthsUsed }.
 */
function amortize(balance, apr, months, extra) {
  const r = apr / 100 / 12;
  const base = monthlyPayment(balance, apr, months);
  let bal = balance, totalInterest = 0, monthsUsed = 0;
  const yearly = {};
  while (bal > 0.005 && monthsUsed < 600) {
    monthsUsed++;
    const interest = bal * r;
    let payment = base + extra;
    if (payment > bal + interest) payment = bal + interest; // final payment
    const principal = Math.min(payment - interest, bal);
    totalInterest += interest;
    bal -= principal;
    const yr = Math.ceil(monthsUsed / 12);
    yearly[yr] = yearly[yr] || { year: yr, principal: 0, interest: 0, endBalance: 0 };
    yearly[yr].principal += principal;
    yearly[yr].interest += interest;
    yearly[yr].endBalance = Math.max(bal, 0);
  }
  return {
    schedule: Object.values(yearly),
    totalInterest,
    monthsUsed,
  };
}

/* ---------- ui ---------- */

const $ = (id) => document.getElementById(id);

function fmt(n) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

function payoffDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function saveInputs(v) {
  chrome.storage.local.set({ loanInputs: v });
}

function loadInputs() {
  chrome.storage.local.get("loanInputs", (res) => {
    const v = res.loanInputs;
    if (!v) return;
    $("balance").value = v.balance ?? "";
    $("rate").value = v.rate ?? "";
    $("years").value = v.years ?? "";
    $("extra").value = v.extra ?? "";
  });
}

function calculate() {
  const balance = parseFloat($("balance").value) || 0;
  const rate = parseFloat($("rate").value) || 0;
  const years = parseInt($("years").value, 10) || 0;
  const extra = parseFloat($("extra").value) || 0;

  if (balance <= 0 || years <= 0) {
    $("results").classList.add("hidden");
    return;
  }
  const months = years * 12;
  const mPay = monthlyPayment(balance, rate, months);
  const base = amortize(balance, rate, months, 0);
  const withExtra = extra > 0 ? amortize(balance, rate, months, extra) : null;

  saveInputs({ balance, rate, years, extra });

  $("mPay").textContent = fmt(mPay);
  $("tInt").textContent = fmt(base.totalInterest);
  $("pDate").textContent = payoffDate(base.monthsUsed);
  if (withExtra) {
    const saved = base.totalInterest - withExtra.totalInterest;
    const mos = base.monthsUsed - withExtra.monthsUsed;
    $("xSav").textContent = fmt(saved) + " · −" + mos + " mo";
  } else {
    $("xSav").textContent = "Add extra $ to compare";
  }

  const total = balance + base.totalInterest;
  $("barPrin").style.width = (balance / total * 100) + "%";
  $("barInt").style.width = (base.totalInterest / total * 100) + "%";

  const rows = (withExtra || base).schedule.map((y) =>
    `<div class="row"><span class="yr">Year ${y.year}</span>` +
    `<span>Principal ${fmt(y.principal)}</span><span>Interest ${fmt(y.interest)}</span></div>`
  ).join("");
  $("sched").innerHTML = rows || "<div class='row'><span></span><span>No schedule</span><span></span></div>";

  $("results").classList.remove("hidden");
}

$("calc").addEventListener("click", calculate);
["balance", "rate", "years", "extra"].forEach((id) =>
  $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") calculate(); })
);
loadInputs();
