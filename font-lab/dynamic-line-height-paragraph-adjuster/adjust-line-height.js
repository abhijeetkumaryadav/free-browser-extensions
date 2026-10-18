// LineEase — self-contained injection script (no popup-scope references).
// Sets paragraph line-height via a single <style> tag; fully reversible.
function applyLineHeight(value) {
  var ID = 'lineease-override-style';
  var old = document.getElementById(ID);
  if (old) old.remove();

  var v = Math.min(2.5, Math.max(1.0, Number(value) || 1.5));
  var style = document.createElement('style');
  style.id = ID;
  style.textContent =
    'body p, body li, body dd, body dt, body figcaption, body blockquote, body article { ' +
    'line-height: ' + v.toFixed(2) + ' !important; }';
  document.documentElement.appendChild(style);
  return true;
}

function removeLineHeight() {
  var old = document.getElementById('lineease-override-style');
  if (old) old.remove();
  return true;
}
