// Popup logic: toggle/redraw the grid overlay, list breakpoints, show viewport.
var BREAKPOINTS = [
  { w: 360, label: 'Mobile S' },
  { w: 768, label: 'Tablet' },
  { w: 1024, label: 'Laptop' },
  { w: 1440, label: 'Desktop' }
];

// Inject the content script into the active tab and return its result.
function inject(files) {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    var tab = tabs[0];
    if (!tab || !/^https?:|^file:|^ftp:/.test(tab.url || '')) {
      throw new Error('off-limits');
    }
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: files });
  });
}

// Show which breakpoints fit inside the current viewport width.
function renderBreakpoints(viewportW) {
  var ul = document.getElementById('bps');
  ul.innerHTML = '';
  BREAKPOINTS.forEach(function (bp) {
    var li = document.createElement('li');
    var fits = viewportW >= bp.w;
    li.innerHTML = '<span>' + bp.label + ' (' + bp.w + 'px)</span>' +
      '<span class="' + (fits ? 'on' : 'off') + '">' + (fits ? 'fits' : 'too wide') + '</span>';
    ul.appendChild(li);
  });
}

document.getElementById('toggle').addEventListener('click', function () {
  inject(['content.js']).then(function () { window.close(); })
    .catch(function (e) {
      document.getElementById('vp').textContent =
        e.message === 'off-limits' ? 'Not allowed on this page.' : 'Could not inject.';
    });
});

// Redraw = remove then re-add (script toggles on removal, so inject twice).
document.getElementById('recalc').addEventListener('click', function () {
  inject(['content.js']).then(function () { return inject(['content.js']); })
    .then(function () { window.close(); })
    .catch(function () { document.getElementById('vp').textContent = 'Could not redraw.'; });
});

// Display the current tab's viewport size and breakpoint fit.
chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
  var tab = tabs[0];
  if (tab && /^https?:|^file:|^ftp:/.test(tab.url || '')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () { return { w: window.innerWidth, h: window.innerHeight }; }
    }).then(function (results) {
      var v = results[0].result;
      document.getElementById('vp').textContent = v.w + ' × ' + v.h + ' px';
      renderBreakpoints(v.w);
    });
  } else {
    document.getElementById('vp').textContent = 'Not allowed on this page.';
  }
});
