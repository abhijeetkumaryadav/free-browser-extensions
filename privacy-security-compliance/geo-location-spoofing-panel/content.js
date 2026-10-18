/* Geo Location Spoofing Panel — content script (isolated world, document_start).
 *
 * Reads the user's spoof settings from storage and, when spoofing is active
 * for this site, injects a small page-world script that overrides
 * navigator.geolocation with the user-chosen coordinates. Injection is the
 * only way to affect the page's own scripts; the isolated world cannot
 * touch them directly. Nothing is sent anywhere — all config stays local.
 */

(async function () {
  const host = location.hostname;

  const settings = await chrome.storage.local.get({
    masterEnabled: true,
    latitude: 51.5074,    // London default
    longitude: -0.1278,
    accuracy: 100,
    disabledHosts: []
  });

  // Respect the master switch and the per-site toggle.
  if (!settings.masterEnabled) return;
  if (Array.isArray(settings.disabledHosts) && settings.disabledHosts.includes(host)) return;

  const config = {
    latitude: Number(settings.latitude),
    longitude: Number(settings.longitude),
    accuracy: Number(settings.accuracy)
  };
  if (!Number.isFinite(config.latitude) || !Number.isFinite(config.longitude)) return;

  // Build the page-world spoof code with the config baked in.
  const code = `
    (function (cfg) {
      'use strict';
      function makePosition() {
        return {
          coords: {
            latitude: cfg.latitude,
            longitude: cfg.longitude,
            accuracy: cfg.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            // Newer spec fields (may be undefined in some browsers)
            toJSON: function () {
              return {
                latitude: cfg.latitude, longitude: cfg.longitude,
                accuracy: cfg.accuracy, altitude: null,
                altitudeAccuracy: null, heading: null, speed: null
              };
            }
          },
          timestamp: Date.now()
        };
      }
      function asyncCall(cb, pos) {
        // Mimic the async behaviour of the real API.
        setTimeout(function () { try { cb(pos); } catch (e) {} }, 0);
      }
      const spoofed = {
        getCurrentPosition: function (success, error) {
          if (typeof success === 'function') asyncCall(success, makePosition());
        },
        watchPosition: function (success, error) {
          if (typeof success === 'function') asyncCall(success, makePosition());
          // Return a fake watch id; watchers get a single fix, like a static location.
          return Math.floor(Math.random() * 1e9);
        },
        clearWatch: function () { /* no-op: static spoofed fix */ }
      };
      try {
        Object.defineProperty(navigator, 'geolocation', {
          value: spoofed, configurable: true, writable: false
        });
      } catch (e) {
        try { navigator.geolocation = spoofed; } catch (e2) {}
      }
    })(${JSON.stringify(config)});
  `;

  const script = document.createElement('script');
  script.textContent = code;

  // document_start: documentElement usually exists; fall back to a watcher.
  const root = document.documentElement;
  if (root) {
    root.appendChild(script);
    script.remove();
  } else {
    new MutationObserver(function (mutations, obs) {
      if (document.documentElement) {
        document.documentElement.appendChild(script);
        script.remove();
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  }
})();
