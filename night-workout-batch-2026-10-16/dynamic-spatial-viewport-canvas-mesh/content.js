/* Content script: injects a canvas viewport grid + rulers + breakpoint
 * markers over the active tab. Honest scope: grid overlay for responsive
 * design analysis — NOT AR, no spatial API exists. Toggle removes it. */
(function () {
  var OVERLAY_ID = '__dsvc_mesh_overlay__';
  var RULER = 28; // px ruler band on top/left

  // Breakpoint presets the mesh marks vertically on the canvas.
  var BREAKPOINTS = [
    { w: 360, label: 'Mobile S' },
    { w: 768, label: 'Tablet' },
    { w: 1024, label: 'Laptop' },
    { w: 1440, label: 'Desktop' }
  ];

  // Remove an existing overlay if present (toggle off).
  var existing = document.getElementById(OVERLAY_ID);
  if (existing) { existing.remove(); window.removeEventListener('resize', onResize); return { toggled: 'off' }; }

  // Build overlay root (fixed, full-viewport, non-interactive, topmost).
  var root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100vw;height:100vh;display:block;opacity:0.85;';
  root.appendChild(canvas);
  document.documentElement.appendChild(root);

  // Device-pixel-ratio aware sizing so lines stay crisp.
  var dpr = window.devicePixelRatio || 1;
  function sizeCanvas() {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    draw();
  }

  // Draw grid, rulers and breakpoint markers.
  function draw() {
    var ctx = canvas.getContext('2d');
    var W = window.innerWidth, H = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var gridMinor = 20, gridMajor = 100;

    // Minor grid lines.
    ctx.strokeStyle = 'rgba(168,85,247,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = RULER; x < W; x += gridMinor) { ctx.moveTo(x + .5, RULER); ctx.lineTo(x + .5, H); }
    for (var y = RULER; y < H; y += gridMinor) { ctx.moveTo(RULER, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();

    // Major grid lines.
    ctx.strokeStyle = 'rgba(168,85,247,0.28)';
    ctx.beginPath();
    for (x = RULER; x < W; x += gridMajor) { ctx.moveTo(x + .5, RULER); ctx.lineTo(x + .5, H); }
    for (y = RULER; y < H; y += gridMajor) { ctx.moveTo(RULER, y + .5); ctx.lineTo(W, y + .5); }
    ctx.stroke();

    // Ruler bands.
    ctx.fillStyle = 'rgba(20,20,28,0.82)';
    ctx.fillRect(0, 0, W, RULER);
    ctx.fillRect(0, 0, RULER, H);
    ctx.fillStyle = 'rgba(232,213,255,0.85)';
    ctx.font = '10px ui-monospace,monospace';
    ctx.textBaseline = 'middle';
    for (x = gridMajor; x < W; x += gridMajor) { ctx.fillText(x + 'px', x + 4, RULER / 2); }
    for (y = gridMajor; y < H; y += gridMajor) { ctx.fillText(y + 'px', 4, y + 8); }

    // Current viewport readout.
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 12px ui-monospace,monospace';
    ctx.fillText(W + ' × ' + H + ' px', RULER + 8, RULER + 16);

    // Breakpoint markers (dashed vertical lines + labels).
    ctx.setLineDash([6, 5]);
    BREAKPOINTS.forEach(function (bp) {
      var bx = RULER + bp.w;
      if (bx > W) return; // only draw markers that fit on screen
      var active = W >= bp.w;
      ctx.strokeStyle = active ? 'rgba(52,211,153,0.9)' : 'rgba(244,114,182,0.55)';
      ctx.lineWidth = active ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(bx + .5, RULER); ctx.lineTo(bx + .5, H); ctx.stroke();
      ctx.fillStyle = active ? '#34d399' : '#f472b6';
      ctx.font = 'bold 11px ui-monospace,monospace';
      ctx.fillText(bp.label + ' ' + bp.w, bx + 6, RULER + 34);
    });
    ctx.setLineDash([]);
  }

  function onResize() { sizeCanvas(); }
  window.addEventListener('resize', onResize);
  sizeCanvas();
  return { toggled: 'on' };
})();
