/* floating-subtitle-srt-auto-generator — srt.js
   Pure SRT logic, dependency-free: timestamp parsing/formatting,
   cue sorting, and .srt serialization. Unit-tested via node. */
'use strict';

function parseTimestamp(str) {
  // Accepts "HH:MM:SS,mmm", "MM:SS,mmm", "SS,mmm", "HH:MM:SS.mmm", or plain seconds.
  if (typeof str !== 'string') return null;
  var s = str.trim().replace(',', '.');
  if (!s) return null;
  var parts = s.split(':');
  var ms = 0;
  try {
    if (parts.length === 3) {
      ms = (parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2])) * 1000;
    } else if (parts.length === 2) {
      ms = (parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000;
    } else if (parts.length === 1) {
      ms = parseFloat(s) * 1000;
    } else {
      return null;
    }
  } catch (e) { return null; }
  if (!isFinite(ms) || ms < 0) return null;
  return Math.round(ms);
}

function formatTimestamp(ms) {
  ms = Math.max(0, Math.round(ms));
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  var sec = Math.floor((ms % 60000) / 1000);
  var mss = ms % 1000;
  function p(n, l) { var s = String(n); while (s.length < l) s = '0' + s; return s; }
  return p(h, 2) + ':' + p(m, 2) + ':' + p(sec, 2) + ',' + p(mss, 3);
}

function sortCues(cues) {
  return cues.slice().sort(function (a, b) { return a.start - b.start || a.end - b.end; });
}

function validateCue(cue) {
  var errors = [];
  if (cue.start == null) errors.push('Start time is invalid.');
  if (cue.end == null) errors.push('End time is invalid.');
  if (cue.start != null && cue.end != null && cue.end <= cue.start) {
    errors.push('End time must be after start time.');
  }
  if (!cue.text || !cue.text.trim()) errors.push('Subtitle text is empty.');
  return errors;
}

function toSrt(cues) {
  var sorted = sortCues(cues);
  var blocks = sorted.map(function (cue, i) {
    return (i + 1) + '\n' +
      formatTimestamp(cue.start) + ' --> ' + formatTimestamp(cue.end) + '\n' +
      cue.text.trim().replace(/\r\n/g, '\n') + '\n';
  });
  return blocks.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseTimestamp: parseTimestamp, formatTimestamp: formatTimestamp,
    sortCues: sortCues, validateCue: validateCue, toSrt: toSrt };
}
