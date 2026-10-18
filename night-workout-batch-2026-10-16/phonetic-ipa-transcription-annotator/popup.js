'use strict';
(function(){
  const $ = id => document.getElementById(id);
  const wordIn = $('word'), ipaIn = $('ipa'), list = $('pairList'), status = $('status');
  let pairs = [];

  function save(){ chrome.storage.local.set({ipaPairs: pairs}); }
  function render(){
    list.innerHTML = '';
    if(!pairs.length){ list.innerHTML = '<div class="pair" style="justify-content:center;color:var(--dim)">No pairs yet</div>'; return; }
    pairs.forEach((p,i)=>{
      const d = document.createElement('div'); d.className='pair';
      const s = document.createElement('span'); s.textContent = p.word+'  →  /'+p.ipa+'/';
      const b = document.createElement('button'); b.className='del'; b.textContent='✕';
      b.addEventListener('click', ()=>{ pairs.splice(i,1); save(); render(); });
      d.append(s,b); list.appendChild(d);
    });
  }
  function addPair(){
    const w = wordIn.value.trim(), i = ipaIn.value.trim();
    if(!w || !i){ status.textContent = 'Enter both a word and its IPA.'; return; }
    if(pairs.some(p=>p.word.toLowerCase()===w.toLowerCase())){ status.textContent = 'That word already has a pair.'; return; }
    pairs.push({word:w, ipa:i}); wordIn.value=''; ipaIn.value='';
    save(); render(); status.textContent = '';
  }
  $('add').addEventListener('click', addPair);
  ipaIn.addEventListener('keydown', e=>{ if(e.key==='Enter') addPair(); });
  $('clearAll').addEventListener('click', ()=>{
    if(!pairs.length || confirm('Delete all pairs?')){ pairs=[]; save(); render(); }
  });

  async function activeTab(){
    const [t] = await chrome.tabs.query({active:true, currentWindow:true});
    return t;
  }
  async function ensureInjected(tab){
    await chrome.scripting.executeScript({target:{tabId:tab.id}, files:['content.js']});
  }
  $('annotate').addEventListener('click', async ()=>{
    if(!pairs.length){ status.textContent = 'Add at least one pair first.'; return; }
    const tab = await activeTab();
    if(!tab || /^chrome:|^edge:|^about:/.test(tab.url||'')){ status.textContent = 'Cannot annotate internal pages.'; return; }
    try{
      await ensureInjected(tab);
      const res = await chrome.tabs.sendMessage(tab.id, {type:'IPA_ANNOTATE', pairs});
      status.textContent = res && res.count ? `Annotated ${res.count} match${res.count>1?'es':''}.` : 'No matches found on this page.';
    }catch(e){ status.textContent = 'Annotation failed: '+(e.message||e); }
  });
  $('remove').addEventListener('click', async ()=>{
    const tab = await activeTab();
    if(!tab || /^chrome:|^edge:|^about:/.test(tab.url||'')){ status.textContent = 'Cannot touch internal pages.'; return; }
    try{
      await ensureInjected(tab);
      const res = await chrome.tabs.sendMessage(tab.id, {type:'IPA_REMOVE'});
      status.textContent = res && res.removed ? `Removed ${res.removed} annotation${res.removed>1?'s':''}.` : 'Nothing to remove.';
    }catch(e){ status.textContent = 'Removal failed: '+(e.message||e); }
  });

  chrome.storage.local.get(['ipaPairs'], r=>{
    pairs = Array.isArray(r.ipaPairs) ? r.ipaPairs : [];
    render();
  });
})();
