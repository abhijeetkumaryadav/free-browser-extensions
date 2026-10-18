// ============================================================================
// scan.js — content script (injected on demand). READ-ONLY: walks style sheets
// and the DOM to inventory animations/transitions. Never modifies the page.
// ============================================================================
(() => {
  // Property cost classification: composite < paint < layout
  const LAYOUT_PROPS = new Set([
    "width", "height", "min-width", "max-width", "min-height", "max-height",
    "top", "left", "right", "bottom", "margin", "margin-top", "margin-left",
    "margin-right", "margin-bottom", "padding", "padding-top", "padding-left",
    "padding-right", "padding-bottom", "border-width", "font-size", "line-height",
    "display", "float", "clear", "position", "overflow", "flex", "flex-basis",
    "flex-grow", "flex-shrink", "grid-template-columns", "grid-template-rows",
    "inset", "inset-block", "inset-inline"
  ]);
  const PAINT_PROPS = new Set([
    "color", "background", "background-color", "background-image", "border-color",
    "box-shadow", "text-shadow", "outline", "outline-color", "fill", "stroke",
    "border-radius", "visibility", "background-position", "opacity" // opacity is composite actually, handled below
  ]);
  const COMPOSITE_PROPS = new Set(["transform", "opacity", "rotate", "scale", "translate", "filter"]);

  function classify(prop) {
    const p = prop.toLowerCase().trim();
    if (COMPOSITE_PROPS.has(p)) return "cheap";
    if (LAYOUT_PROPS.has(p)) return "expensive";
    if (PAINT_PROPS.has(p)) return "paint";
    // Shorthand or unknown: treat border*/background* as paint, anything else unknown -> paint (cautious)
    if (/^(border|background|box-shadow|text-shadow)/.test(p)) return "paint";
    return "paint";
  }

  function severityOf(props) {
    if (props.some(p => classify(p) === "expensive")) return "bad";
    if (props.some(p => classify(p) === "paint")) return "warn";
    return "good";
  }

  const TIPS = {
    good: "Compositor-only animation — transform/opacity run on the GPU and stay at 60fps. No changes needed.",
    warn: "Paint-triggering properties force repaints. Prefer animating transform and opacity where possible.",
    bad: "Layout-triggering properties force reflow of the whole page on every frame. Rewrite with transform/opacity (e.g. translateX instead of left) for smooth motion."
  };

  // -- Collect @keyframes rules (same-origin sheets only; cross-origin throws -> skipped) --
  const keyframes = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin stylesheet
    if (!rules) continue;
    for (const rule of rules) {
      if (rule.type === CSSRule.KEYFRAMES_RULE) {
        const props = new Set();
        for (const kf of rule.cssRules) {
          for (let i = 0; i < kf.style.length; i++) props.add(kf.style[i]);
        }
        keyframes.push({ name: rule.name, props: [...props] });
      }
    }
  }

  // -- Collect elements with animations / transitions (sample up to 200 nodes) --
  const animations = [];
  const transitions = [];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
  let count = 0;
  const MAX_NODES = 4000;
  while (walker.nextNode() && count < MAX_NODES) {
    count++;
    const el = walker.currentNode;
    const cs = getComputedStyle(el);
    const animNames = cs.animationName.split(",").map(s => s.trim()).filter(s => s && s !== "none");
    const transProps = cs.transitionProperty.split(",").map(s => s.trim()).filter(s => s && s !== "none");
    if (animNames.length) {
      const tag = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : "");
      animations.push({
        selector: tag,
        names: animNames,
        duration: cs.animationDuration,
        props: [] // resolved against keyframes below
      });
    }
    if (transProps.length) {
      const tag = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
      transitions.push({ selector: tag, props: transProps, duration: cs.transitionDuration });
    }
    if (animations.length + transitions.length > 200) break;
  }

  // Resolve animated properties per animation from keyframes
  for (const a of animations) {
    const set = new Set();
    for (const n of a.names) {
      const kf = keyframes.find(k => k.name === n);
      if (kf) kf.props.forEach(p => set.add(p));
    }
    a.props = [...set];
  }

  // Attach severity + tips
  function decorate(items) {
    return items.map(it => {
      const sev = severityOf(it.props);
      return { ...it, severity: sev, tip: TIPS[sev] };
    });
  }

  return {
    keyframes: keyframes.map(k => ({ ...k, severity: severityOf(k.props), tip: TIPS[severityOf(k.props)] })),
    animations: decorate(animations).slice(0, 60),
    transitions: decorate(transitions).slice(0, 60)
  };
})();
