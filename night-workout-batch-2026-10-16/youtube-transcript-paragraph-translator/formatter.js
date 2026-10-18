/* formatter.js — dependency-free transcript parsing logic (unit-testable) */
'use strict';

/**
 * Parse raw pasted transcript text into timestamped paragraphs.
 * Handles: "00:14 text", "00:00 text" style lines, and plain prose
 * (plain prose lines are grouped into one paragraph).
 * @param {string} raw
 * @returns {Array<{timestamp: string|null, text: string}>}
 */
function parseTranscript(raw) {
  const paragraphs = [];
  let buffer = []; // plain lines without timestamps

  function flushBuffer() {
    if (buffer.length) {
      const text = buffer.join(' ').trim();
      if (text) paragraphs.push({ timestamp: null, text });
      buffer = [];
    }
  }

  const tsRe = /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?)[\s\-–—:|]+(.*)$/;

  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) { flushBuffer(); return; }

    const m = trimmed.match(tsRe);
    if (m) {
      flushBuffer();
      const ts = normaliseTimestamp(m[1]);
      const text = (m[2] || '').trim();
      const prev = paragraphs[paragraphs.length - 1];
      // Merge continuation lines that share the same timestamp
      if (prev && prev.timestamp === ts) {
        prev.text += ' ' + text;
      } else {
        paragraphs.push({ timestamp: ts, text });
      }
    } else {
      buffer.push(trimmed);
    }
  });
  flushBuffer();

  // Drop empty entries
  return paragraphs.filter((p) => p.text.length > 0);
}

/** Normalise "0:14" -> "00:14", keep "01:02:03" as-is. */
function normaliseTimestamp(ts) {
  const parts = ts.split(':').map((p) => p.padStart(2, '0'));
  return parts.join(':');
}

/**
 * Render parsed paragraphs to plain text (for copy / export).
 * Notes are appended per paragraph when present.
 * @param {Array} paragraphs
 * @param {Object<string,string>} notes — map index -> note text
 * @returns {string}
 */
function renderPlainText(paragraphs, notes) {
  return paragraphs
    .map((p, i) => {
      const head = p.timestamp ? '[' + p.timestamp + '] ' : '';
      const note = notes && notes[String(i)] ? '\n  Note: ' + notes[String(i)] : '';
      return head + p.text + note;
    })
    .join('\n\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseTranscript, normaliseTimestamp, renderPlainText };
}
