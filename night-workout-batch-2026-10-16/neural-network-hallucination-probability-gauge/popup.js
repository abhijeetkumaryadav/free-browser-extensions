'use strict';
/* ============================================================
   Hallucination Risk Gauge — heuristic risk-signal scanner
   Heuristic signals only: NOT a real hallucination probability.
   Pure engine between ENGINE-START / ENGINE-END (headless-testable).
   ============================================================ */

// ENGINE-START
const HALLUCINATION_SIGNALS = [
  { id:'hedge', name:'Hedge words',
    desc:'Models hedge where they lack grounded facts.',
    check(t){ const pats=[/\bmay\b/i,/\bmight\b/i,/\bcould\b/i,/\blikely\b/i,/\bpossibly\b/i,/\bperhaps\b/i,/some (experts|studies) (say|suggest|claim|believe)/i,/it is (believed|thought) that/i];
      const m=pats.filter(p=>p.test(t)); return m.length?{hit:true,weight:6*m.length,note:m.length+' hedge phrase(s)'}:{hit:false}; } },
  { id:'citation', name:'Citation-shaped text',
    desc:'Looks like a citation but may be fabricated — verify it.',
    check(t){ const pats=[/[A-Z][a-z]+ et al\.,?\s*\d{4}/,/according to (a|recent|one) stud(y|ies)/i,/(a|the) 20\d{2} (study|paper|report)/i,/\[\d+\]/,/published in (the )?[A-Z][A-Za-z ]+ (Journal|Review)/];
      const m=pats.filter(p=>p.test(t)); return m.length?{hit:true,weight:20*m.length,note:m.length+' citation-shaped phrase(s)'}:{hit:false}; } },
  { id:'absolute', name:'Overconfident absolutes',
    desc:'Confident language on shaky ground.',
    check(t){ const pats=[/\balways\b/i,/\bnever\b/i,/100% (guaranteed|accurate|true|certain)/i,/\bproven beyond doubt\b/i,/undeniably/i,/without (a )?doubt/i,/\beveryone knows\b/i];
      const m=pats.filter(p=>p.test(t)); return m.length?{hit:true,weight:10*m.length,note:m.length+' absolute phrase(s)'}:{hit:false}; } },
  { id:'precision', name:'Unsourced precision',
    desc:'Exact figures, dates, or stats with no source attached.',
    check(t){ const nums=(t.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:%|percent|million|billion)?/g)||[]).length;
      const dates=(t.match(/\b(?:in|on|by)\s+\d{4}\b/g)||[]).length;
      const n=nums+dates;
      return n>=3?{hit:true,weight:Math.min(20,5*n),note:n+' precise figure(s), check sources'}:{hit:false}; } },
  { id:'vague', name:'Vague attribution',
    desc:'"Sources say", "researchers found" — who, exactly?',
    check(t){ const pats=[/sources (say|claim|report)/i,/researchers (found|say|believe)/i,/experts (agree|say|believe)/i,/studies (show|indicate|suggest)/i];
      const m=pats.filter(p=>p.test(t)); return m.length?{hit:true,weight:12*m.length,note:m.length+' vague attribution(s)'}:{hit:false}; } },
  { id:'novelty', name:'Too-good specificity',
    desc:'Named entities + numbers together without references.',
    check(t){ const names=(t.match(/\b[A-Z][a-z]+ (Institute|University|Laboratory|Corporation)\b/g)||[]).length;
      return names>=2?{hit:true,weight:8*names,note:names+' named institution(s) to verify'}:{hit:false}; } },
];

function scanHallucinationSignals(text){
  if(typeof text!=='string' || !text.trim()) return {score:0, verdict:'Empty', signals:[]};
  let score=0; const signals=[];
  for(const s of HALLUCINATION_SIGNALS){
    let r; try{ r=s.check(text); }catch(e){ continue; }
    if(r && r.hit){ score+=r.weight; signals.push({name:s.name, desc:s.desc, note:r.note}); }
  }
  score=Math.min(100, Math.round(score));
  return {score, verdict:verdictForHallucination(score), signals};
}
function verdictForHallucination(score){
  if(score<=15) return 'Low risk signals';
  if(score<=40) return 'Moderate risk signals';
  if(score<=70) return 'High risk signals';
  return 'Very high risk signals';
}
// ENGINE-END

/* ---------- popup wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const input=document.getElementById('input');
  const notes=document.getElementById('notes');
  const card=document.getElementById('resultCard');
  chrome.storage.local.get(['halLastText','halNotes'], r => {
    if(r.halLastText) input.value=r.halLastText;
    if(r.halNotes) notes.value=r.halNotes;
  });
  notes.addEventListener('input', () => chrome.storage.local.set({halNotes:notes.value}));
  document.getElementById('scan').addEventListener('click', () => {
    const t=input.value;
    chrome.storage.local.set({halLastText:t});
    const {score, verdict, signals}=scanHallucinationSignals(t);
    card.classList.remove('hidden');
    document.getElementById('riskScore').textContent=score+' / 100';
    document.getElementById('needle').style.transform='translateX(-50%) rotate('+(-90+score*1.8)+'deg)';
    document.getElementById('verdict').textContent=verdict;
    document.getElementById('verdictSub').textContent=signals.length+' signal'+(signals.length===1?'':'s')+' found — verify each claim against primary sources';
    const ul=document.getElementById('signals');
    ul.innerHTML=signals.length?signals.map(s=>'<li><b>'+escapeHtml(s.name)+'</b> — '+escapeHtml(s.note)+'<br><span style="color:var(--muted)">'+escapeHtml(s.desc)+'</span></li>').join(''):'<li>No strong risk signals in this text.</li>';
  });
});
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
