'use strict';
// ================= ENGINE-START =================
/* Heuristic CEFR-style rater: sentence length + word-rarity bands.
   Bundled common-word list; anything outside counts as "rare". */
const COMMON = new Set((
'the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been has had have has had do does did will shall may might must can could should would ought am an a the of in on at to for by with as from of of'.split(' ')
).concat(
'a able about above accept account across act actually add after again against age ago agree air allow almost alone along already also always am among amount another any anyone around arrive art ask back bad ball bank base be become bed before begin behind believe best better between beyond big bill bird black blue boat body book born both bottom box boy break bring brown build business buy call came can car carry case catch cause center certain change check child choose church city clear close cold come common cost could country course court cover create cross cry cut dark data deal death deep did die differ dinner do does done door doubt down draw dream drink drive drop dry during each early earth eat edge eight either else end enjoy enough enter entire even every evil example except face fact fall fast father fear feel few field fight figure fill film final fine fire first fish five floor fly focus follow food foot force form forth found four free friend from front full fund future gain game garden gave get girl give glass go god gold gone good great green ground group grow guard guess guest guide hair half hand hang happen happy hard hate have he head hear heart heat heaven heavy help here high hill him his hit hold home hope horse hot hour house how however huge human hundred hurry hurt idea if image in inch into iron is issue item its join judge jump just keep key kid kill kind knew know land large last late laugh law lay lead learn least leave left less let level light like limit line list little live local long look lose loss lost loud love low luck lunch machine made make man many map mark market marry match may maybe mean meet member men mere might mile milk mind mine minus minute miss month more morning most mother mount mouth move much music must name nation near neck need never new news next night nine no none nor north note nothing now number nurse obey occur ocean of off offer often oil old once one only open order other ought our out over own pack page pain pair pale paper part pass past path pay peace pen people per pick piece place plain plane plant plate point poor pop port pound power press price pride print prize proof pull push put quick quiet quite race radio rain raise range rate rather reach read ready real reason recall red refer rich ride right ring rise risk river road rock role roll room rose round rule ruler run sad safe said same save say scale scene score sea search season seat second seed seem seen self sell send sense sent serve set seven shade shake shall shape share sharp she sheep sheet shelf shell shift shine shirt shock shoe shoot shop short shot should shoulder shout show side sight sign silent silver since sing sink sir sister sit six size skill skin skirt sky sleep slide slight slip slow small smell smile smoke smooth snake snow so soap social sock soft soil solar sold some song soon sorry sound south space spare speak speed spell spend spoke sport staff stage stair stand star start state stay steal steel step stick still stock stone stood stop store storm story stove straight strange stream street stretch strike string strip style subject such sudden sugar suit summer sun supply sure surface sweet swim table take talk tall taste teach team tear tell ten tend term test text than thank that the their them then there these thick thin thing think third those though thought three throat through throw thumb thus tick tie tight till time tiny tip tired title to today toe told tool tooth top total touch tough tour toward town track trade trail train travel treat tree trend trial tribe trick trip true trust truth try tube turn twice two type under union unit until up upon upper upset urban urge use used usual value vast very vessel video view visit vital voice vote wage wait wake walk wall want war warm warn wash waste watch water wave way we weak wear week well went were west wet what wheel when where whether which while white who whole whom whose why wide wife wild will win wind window wine wing winter wire wise wish with within without woman wonder wood word work world worry worth would wound write wrong wrote yard year yell yellow yes yet yield you young your youth zone'
.split(' ').filter(w=>w.length>1)
));
const ENCODE = s => s.normalize('NFC');

function splitSentences(text){
  const parts = text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);
  return parts.map(p=>p.trim()).filter(p=>p.length>0);
}
function words(s){
  return s.toLowerCase().replace(/[^a-z\s']/g,' ').split(/\s+/).filter(w=>w.length>0);
}
function rareShare(s){
  const ws = words(s);
  if(!ws.length) return 0;
  let rare = 0;
  for(const w of ws){ if(!COMMON.has(w)) rare++; }
  return rare/ws.length;
}
// sentence complexity 0..100 from length + rarity
function sentenceScore(s){
  const ws = words(s);
  const lenScore = Math.min(100, ws.length*4);          // 25 words => 100
  const rare = rareShare(s)*100;
  return Math.round(lenScore*0.55 + rare*0.45);
}
const BANDS = [ ['A1',18], ['A2',36], ['B1',54], ['B2',70], ['C1',84], ['C2',100] ];
function bandOf(score){
  for(const [b,lim] of BANDS){ if(score<=lim) return b; }
  return 'C2';
}
function rateText(text){
  const sents = splitSentences(text);
  const rows = sents.map(s=>{
    const sc = sentenceScore(s);
    return { text:s, score:sc, band:bandOf(sc), words:words(s).length,
             rarePct:Math.round(rareShare(s)*100) };
  });
  const avg = rows.length ? Math.round(rows.reduce((a,r)=>a+r.score,0)/rows.length) : 0;
  return { score:avg, band:bandOf(avg), rows,
           avgLen: rows.length ? (rows.reduce((a,r)=>a+r.words,0)/rows.length).toFixed(1) : '–',
           rareAvg: rows.length ? Math.round(rows.reduce((a,r)=>a+r.rarePct,0)/rows.length)+'%' : '–' };
}
// ================= ENGINE-END =================

(function(){
  const $ = id => document.getElementById(id);
  const ta = $('text'), card=$('resultCard');

  chrome.storage.local.get(['cefrLast'], r=>{
    if(r.cefrLast) ta.value = r.cefrLast;
  });

  $('rate').addEventListener('click', ()=>{
    const text = ta.value.trim();
    if(!text){ alert('Paste some text first.'); return; }
    chrome.storage.local.set({cefrLast: text});
    const res = rateText(text);
    card.classList.remove('hidden');
    $('levelBadge').textContent = res.band;
    $('scoreVal').textContent = res.score+' / 100';
    $('mLen').textContent = res.avgLen;
    $('mRare').textContent = res.rareAvg;
    $('mN').textContent = res.rows.length;
    $('sentList').innerHTML = res.rows.map(r=>
      `<div class="sent"><div class="top"><span class="badge">${r.band}</span><span>${r.score}</span></div><p></p></div>`
    ).join('');
    // escape text safely
    [...$('sentList').querySelectorAll('.sent p')].forEach((p,i)=> p.textContent = res.rows[i].text);
  });
  $('clear').addEventListener('click', ()=>{
    ta.value=''; card.classList.add('hidden');
    chrome.storage.local.remove('cefrLast');
  });
})();
