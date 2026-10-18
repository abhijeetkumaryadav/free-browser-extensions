// FontForce — self-contained injection script (no popup-scope references).
// Injects a stylesheet that overrides the page's font family; fully reversible.
function applyFontOverride(fontStack, extraCSS, strength) {
  var ID = 'fontforce-override-style';
  var old = document.getElementById(ID);
  if (old) old.remove();

  // strength 0 = body + text containers only; 1 = everything
  var selector = strength >= 1
    ? '*'
    : 'body, p, li, h1, h2, h3, h4, h5, h6, span, a, td, th, label, button, input, textarea, select';

  var style = document.createElement('style');
  style.id = ID;
  style.textContent =
    selector + ' { font-family: ' + fontStack + ' !important; }\n' +
    'pre, code, kbd, samp, tt { font-family: ui-monospace, Menlo, Consolas, monospace !important; }\n' +
    (extraCSS || '');
  document.documentElement.appendChild(style);
  return true;
}

function removeFontOverride() {
  var old = document.getElementById('fontforce-override-style');
  if (old) old.remove();
  return true;
}
