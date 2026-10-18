/* Canvas Poisoning Protector — MAIN world injector.
 * Runs in the page's own JS world (document_start) so it can wrap canvas
 * prototypes BEFORE page scripts or trackers read them. It does nothing
 * until the isolated-world companion hands it the user's settings.
 */
(function () {
  'use strict';

  // Ask the isolated-world companion for the current settings.
  function requestConfig() {
    window.dispatchEvent(new CustomEvent('cpp-request-config'));
  }

  // Install invisible random noise into every canvas readback path.
  // Perturbation is ±2 on sampled pixels: visually imperceptible, but it
  // makes any canvas fingerprint unstable across reloads.
  function installPoisoning() {
    var NOISE = 2;

    function rand(n) {
      return Math.floor(Math.random() * n);
    }

    // Add sparse noise to an ImageData object (in place).
    function poisonPixels(imageData) {
      var d = imageData.data;
      for (var i = 0; i < d.length; i += 28) { // touch ~1 in 7 pixels
        var delta = rand(NOISE * 2 + 1) - NOISE;
        d[i] = Math.max(0, Math.min(255, d[i] + delta));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + delta));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + delta));
      }
      return imageData;
    }

    // Poison a canvas in place via its 2d context (best-effort; tainted
    // canvases throw and are simply left alone).
    function poisonCanvas(canvas) {
      try {
        var ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
        }
      } catch (e) { /* tainted or unavailable — leave it */ }
    }

    try {
      // 1) 2D pixel reads — the classic fingerprint vector.
      var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh) {
        var rest = Array.prototype.slice.call(arguments, 4);
        var data = origGetImageData.apply(this, [sx, sy, sw, sh].concat(rest));
        return poisonPixels(data);
      };

      // 2) toDataURL — poison the canvas just before serializing.
      var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function () {
        poisonCanvas(this);
        return origToDataURL.apply(this, arguments);
      };

      // 3) toBlob — same treatment.
      var origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb) {
        poisonCanvas(this);
        return origToBlob.apply(this, arguments);
      };

      // 4) WebGL readPixels — perturb the destination buffer.
      function wrapReadPixels(proto) {
        if (!proto || !proto.readPixels || proto.readPixels.__cppWrapped) return;
        var orig = proto.readPixels;
        var wrapped = function () {
          var result = orig.apply(this, arguments);
          try {
            var pixels = arguments[6]; // last arg is the destination array
            if (pixels && pixels.length) {
              for (var i = 0; i < pixels.length; i += 29) {
                var delta = rand(NOISE * 2 + 1) - NOISE;
                pixels[i] = Math.max(0, Math.min(255, pixels[i] + delta));
              }
            }
          } catch (e) { /* ignore */ }
          return result;
        };
        wrapped.__cppWrapped = true;
        proto.readPixels = wrapped;
      }
      wrapReadPixels(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
      wrapReadPixels(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
    } catch (e) {
      /* prototype locked down — leave page untouched */
    }

    window.__cppInstalled = true;
  }

  // The companion replies with { enabled: true/false }.
  window.addEventListener('cpp-config', function (e) {
    if (e.detail && e.detail.enabled && !window.__cppInstalled) {
      installPoisoning();
    }
  });

  requestConfig();
  // Re-ask shortly after in case the companion script wasn't ready yet.
  setTimeout(requestConfig, 60);
})();
