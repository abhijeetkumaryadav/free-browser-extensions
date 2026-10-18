/* Schema Doc Generator — field-list parsing, type classification,
   Markdown generation. Everything runs on-device. */

'use strict';

/* ---------- Field-type classification ----------
   Maps common Airtable-ish type names to badge categories. */
const TYPE_MAP = [
  { cat: 'text',   label: 'Text',    re: /single.?line|long.?text|text|rich.?text|string/i },
  { cat: 'number', label: 'Number',  re: /number|currency|percent|duration|autonumber|count|rating/i },
  { cat: 'select', label: 'Select',  re: /select|multiple.?select|single.?select/i },
  { cat: 'date',   label: 'Date',    re: /date|created.?time|last.?modified|time/i },
  { cat: 'check',  label: 'Checkbox',re: /checkbox|boolean/i },
  { cat: 'link',   label: 'Link',    re: /link|lookup|email|url|phone|collaborator|user/i },
  { cat: 'media',  label: 'Media',   re: /attachment|barcode/i },
  { cat: 'formula',label: 'Formula', re: /formula|rollup/i },
];

function classify(typeStr) {
  const t = (typeStr || '').trim();
  for (const entry of TYPE_MAP) {
    if (entry.re.test(t)) return { cat: entry.cat, label: entry.label };
  }
  return { cat: 'other', label: t || 'Custom' };
}

/* ---------- Parsing ----------
   Accepts "Name | Type" lines, "Name, Type" CSV lines, or bare "Name" lines. */
function parseFields(text) {
  const fields = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let name = line, type = '';
    if (line.includes('|')) {
      const parts = line.split('|');
      name = parts[0].trim(); type = parts.slice(1).join('|').trim();
    } else if (line.includes(',')) {
      const parts = line.split(',');
      name = parts[0].trim().replace(/^"|"$/g, '');
      type = parts.slice(1).join(',').trim().replace(/^"|"$/g, '');
    }
    if (!name) continue;
    if (fields.some(f => f.name === name)) continue; // de-dupe
    const { cat, label } = classify(type);
    fields.push({ name, type: type || '—', cat, label });
  }
  return fields;
}

/* ---------- Markdown generation ---------- */
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildMarkdown(tableName, fields) {
  const title = tableName || 'Untitled Table';
  const L = [];
  L.push('# ' + title);
  L.push('');
  L.push(`_Schema documentation generated locally · ${fields.length} field${fields.length === 1 ? '' : 's'}_`);
  L.push('');
  L.push('## Contents');
  L.push('');
  fields.forEach(f => L.push(`- [${f.name}](#${slugify(f.name)})`));
  L.push('');
  L.push('## Fields');
  L.push('');
  L.push('| Field | Type |');
  L.push('|---|---|');
  fields.forEach(f => L.push(`| ${f.name} | ${f.type} |`));
  L.push('');
  fields.forEach(f => {
    L.push(`### ${f.name}`);
    L.push('');
    L.push(`- **Type:** ${f.type}`);
    L.push('');
  });
  return L.join('\n');
}

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const tableNameInput = $('tableName'), fieldInput = $('fieldInput');
const outputPanel = $('outputPanel'), preview = $('preview'), fieldCount = $('fieldCount');

let lastMarkdown = '', lastFields = [], lastTable = '';

const SAMPLE =
`Name | Single line text
Email | Email
Phone | Phone number
Status | Single select
Priority | Single select
Due date | Date
Done | Checkbox
Assignee | Collaborator
Project | Link to another record
Notes | Long text
Attachments | Attachment
Total | Rollup
Days open | Formula
Created | Created time`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPreview(tableName, fields) {
  fieldCount.textContent = fields.length + (fields.length === 1 ? ' field' : ' fields');
  let html = '<h3>' + escapeHtml(tableName || 'Untitled Table') + '</h3>';
  html += '<h4>Contents</h4><ul class="toc">';
  fields.forEach(f => { html += '<li>' + escapeHtml(f.name) + '</li>'; });
  html += '</ul><h4>Fields</h4>';
  fields.forEach(f => {
    html += '<div class="field-row"><span class="field-name">' + escapeHtml(f.name) +
      '</span><span class="type-badge type-' + f.cat + '">' + escapeHtml(f.label) + '</span></div>';
  });
  preview.innerHTML = html;
}

function generate() {
  const fields = parseFields(fieldInput.value);
  if (fields.length === 0) {
    alert('Paste at least one field name to generate docs.');
    return;
  }
  lastTable = tableNameInput.value.trim();
  lastFields = fields;
  lastMarkdown = buildMarkdown(lastTable, fields);
  renderPreview(lastTable, fields);
  outputPanel.classList.remove('hidden');
  chrome.storage.local.set({
    lastDoc: { table: lastTable, input: fieldInput.value }
  }).catch(() => {});
}

/* ---------- Events ---------- */
$('generateBtn').addEventListener('click', generate);
$('loadSample').addEventListener('click', () => {
  fieldInput.value = SAMPLE;
  tableNameInput.value = 'Customers';
});
$('clearInput').addEventListener('click', () => {
  fieldInput.value = '';
  tableNameInput.value = '';
  lastMarkdown = '';
  outputPanel.classList.add('hidden');
});
$('copyMd').addEventListener('click', async () => {
  if (!lastMarkdown) return;
  try {
    await navigator.clipboard.writeText(lastMarkdown);
    $('copyMd').textContent = 'Copied!';
    setTimeout(() => { $('copyMd').textContent = 'Copy Markdown'; }, 1500);
  } catch { alert('Copy failed — try Download instead.'); }
});
$('downloadMd').addEventListener('click', () => {
  if (!lastMarkdown) return;
  const blob = new Blob([lastMarkdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (slugify(lastTable) || 'schema') + '-schema.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

/* Restore last session. */
chrome.storage.local.get('lastDoc').then(r => {
  if (r.lastDoc) {
    tableNameInput.value = r.lastDoc.table || '';
    fieldInput.value = r.lastDoc.input || '';
    if (fieldInput.value.trim()) generate();
  }
}).catch(() => {});
