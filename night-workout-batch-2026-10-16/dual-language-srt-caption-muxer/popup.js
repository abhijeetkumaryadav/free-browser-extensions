// Dual-Language SRT Muxer — parses two SRT files and merges them cue-by-cue.
// 100% local: FileReader only, no network.

// --- SRT parsing ------------------------------------------------------------
// Parse SRT text into [{ index, start, end, text }]
function parseSrt(text) {
  const cues = [];
  // Normalize newlines, split on blank lines
  const blocks = text.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;
    // First line may be the numeric index, second the timestamp line
    let i = 0;
    if (/^\d+$/.test(lines[0].trim()) && lines[1] && lines[1].includes('-->')) i = 1;
    const timeLine = lines[i];
    if (!timeLine || !timeLine.includes('-->')) continue;
    const [start, end] = timeLine.split('-->').map(s => s.trim());
    if (!start || !end) continue;
    const textLines = lines.slice(i + 1).filter(l => l.trim() !== '');
    if (textLines.length === 0) continue;
    cues.push({ start, end, text: textLines.join('\n') });
  }
  return cues;
}

// Match cues across the two tracks by time overlap (not just index),
// so files with slightly different cue splits still pair sensibly.
function toMs(ts) {
  const m = ts.match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return null;
  return ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000 + (+m[4].padEnd(3, '0').slice(0, 3));
}

// Pair cues: for each cue in A, find the cue in B with the largest time overlap.
function pairCues(a, b) {
  const used = new Set();
  return a.map(ca => {
    const sa = toMs(ca.start), ea = toMs(ca.end);
    let best = null, bestOverlap = 0;
    b.forEach((cb, j) => {
      if (used.has(j)) return;
      const sb = toMs(cb.start), eb = toMs(cb.end);
      if (sa == null || ea == null || sb == null || eb == null) return;
      const overlap = Math.min(ea, eb) - Math.max(sa, sb);
      if (overlap > bestOverlap) { bestOverlap = overlap; best = j; }
    });
    if (best != null) used.add(best);
    return { a: ca, b: best != null ? b[best] : null };
  });
}

function buildSrt(pairs, order, separator, renumber) {
  return pairs.map((p, idx) => {
    const top = order === 'AB' ? p.a.text : (p.b ? p.b.text : '');
    const bottom = order === 'AB' ? (p.b ? p.b.text : '') : p.a.text;
    const body = bottom ? top + separator + bottom : top;
    const num = renumber ? idx + 1 : p.a.index ?? idx + 1;
    return `${num}\n${p.a.start} --> ${p.a.end}\n${body}`;
  }).join('\n\n') + '\n';
}

// --- UI ----------------------------------------------------------------------
const $ = id => document.getElementById(id);
let textA = null, textB = null, merged = null, pairs = [];

async function readFile(file) {
  return await file.text();
}

$('fileA').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  textA = await readFile(f);
  $('fileAName').textContent = f.name;
  refresh();
});
$('fileB').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  textB = await readFile(f);
  $('fileBName').textContent = f.name;
  refresh();
});

function refresh() {
  $('merge').disabled = !(textA && textB);
}

$('merge').addEventListener('click', () => {
  const a = parseSrt(textA);
  const b = parseSrt(textB);
  if (a.length === 0 || b.length === 0) {
    $('stats').hidden = false;
    $('stats').textContent = 'Could not parse one or both files — is this valid SRT?';
    return;
  }
  pairs = pairCues(a, b);
  const order = $('order').value;
  const sep = $('separator').value;
  const renumber = $('renumber').checked;
  merged = buildSrt(pairs, order, sep, renumber);
  const unmatched = pairs.filter(p => !p.b).length;
  $('stats').hidden = false;
  $('stats').textContent = `Track A: ${a.length} cues · Track B: ${b.length} cues · Paired: ${pairs.length - unmatched}${unmatched ? ` (${unmatched} unpaired)` : ''}`;
  $('preview').hidden = false;
  $('preview').textContent = merged.split('\n').slice(0, 24).join('\n') + (merged.split('\n').length > 24 ? '\n…' : '');
  $('download').disabled = false;
});

$('download').addEventListener('click', () => {
  if (!merged) return;
  const blob = new Blob([merged], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dual-language.srt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

$('reset').addEventListener('click', () => {
  textA = textB = merged = null; pairs = [];
  $('fileA').value = ''; $('fileB').value = '';
  $('fileAName').textContent = 'Choose first SRT (e.g. original)';
  $('fileBName').textContent = 'Choose second SRT (e.g. translation)';
  $('stats').hidden = true; $('preview').hidden = true;
  $('merge').disabled = true; $('download').disabled = true;
});
