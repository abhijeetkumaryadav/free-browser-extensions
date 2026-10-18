/* Origami Mesh Folder — harmless visual toy.
   Only INLINE STYLES on existing elements are changed (transforms); the DOM
   structure is never touched. unfold() restores every saved style exactly. */
(() => {
  if (window.__origamiToy) return; // guard against double injection

  const ACCENT = 'rgba(167,139,250,0.85)';
  const saved = new Map();   // element -> saved inline styles
  let rootSaved = null;      // saved documentElement inline styles
  let folded = false;

  const STYLE_PROPS = ['transform', 'transformOrigin', 'boxShadow', 'transition'];

  function snapshot(el) {
    if (saved.has(el)) return;
    const s = {};
    for (const p of STYLE_PROPS) s[p] = el.style[p];
    saved.set(el, s);
  }

  function collectTargets(max) {
    const out = [];
    const els = document.body ? document.body.children : [];
    // walk a couple of levels deep for nicer block coverage
    const queue = [...els];
    while (queue.length && out.length < max) {
      const el = queue.shift();
      let r;
      try { r = el.getBoundingClientRect(); } catch { continue; }
      if (r.width > 60 && r.height > 24 && r.bottom > 0 && r.top < innerHeight + 200) {
        out.push(el);
      }
      if (el.children && el.children.length && el.children.length < 12) {
        queue.push(...el.children);
      }
    }
    return out.slice(0, max);
  }

  function targetTransform(style, depth, i) {
    const d = depth; // 20..100
    if (style === 'crane') {
      return { t: `perspective(900px) rotateX(${-d}deg) scale(${1 - d / 400})`, origin: '50% 100%' };
    }
    if (style === 'accordion') { // alternating zebra fold
      const up = i % 2 === 0;
      return {
        t: `perspective(900px) rotateX(${up ? -d : d * 0.7}deg)`,
        origin: up ? '50% 100%' : '50% 0%'
      };
    }
    // spiral
    return {
      t: `perspective(900px) rotateY(${d * 1.8}deg) scale(${Math.max(0.35, 1 - d / 160)})`,
      origin: '50% 50%'
    };
  }

  function fold(cfg) {
    if (folded) unfold(true);
    cfg = { style: 'crane', depth: 75, delay: 25, ...cfg };

    // 3D depth context on the root (inline style, saved & restored)
    rootSaved = {
      perspective: document.documentElement.style.perspective,
      transformStyle: document.documentElement.style.transformStyle
    };
    document.documentElement.style.perspective = '1200px';

    const targets = collectTargets(40);
    targets.forEach((el, i) => {
      snapshot(el);
      const { t, origin } = targetTransform(cfg.style, cfg.depth, i);
      el.style.transformOrigin = origin;
      el.style.transition = 'none';
      const delay = i * cfg.delay * 10;
      const anim = el.animate(
        [{ transform: getComputedStyle(el).transform }, { transform: t }],
        { duration: 700, delay, easing: 'cubic-bezier(.34,1.3,.5,1)', fill: 'forwards' }
      );
      anim.onfinish = () => {
        el.style.boxShadow = `inset 0 -4px 0 ${ACCENT}, inset 0 0 0 1px ${ACCENT}`;
      };
    });
    folded = true;
  }

  function unfold(silent) {
    if (!folded && !silent) return;
    for (const [el, s] of saved) {
      try {
        // play a quick reverse before restoring inline styles
        const back = el.animate(
          [{ transform: getComputedStyle(el).transform }, { transform: s.transform || 'none' }],
          { duration: 350, easing: 'ease-out', fill: 'forwards' }
        );
        back.onfinish = () => {
          back.cancel();
          for (const p of STYLE_PROPS) el.style[p] = s[p];
        };
      } catch {
        for (const p of STYLE_PROPS) el.style[p] = s[p];
      }
    }
    saved.clear();
    if (rootSaved) {
      document.documentElement.style.perspective = rootSaved.perspective;
      document.documentElement.style.transformStyle = rootSaved.transformStyle;
      rootSaved = null;
    }
    folded = false;
  }

  window.__origamiToy = { fold, unfold };
})();
