/* CodeVault — page scanner (injected on demand into the MAIN world).
 * Finds <pre><code> and bare <pre> blocks, extracts language hints and code text.
 * Must stay self-contained: it is serialized into the page, so no outside refs.
 */
function codeVaultScan() {
  const blocks = [];
  const seen = new Set();

  // Normalize common aliases to canonical language names
  function canon(lang) {
    const l = lang.toLowerCase();
    return { js: 'javascript', ts: 'typescript', 'c++': 'cpp', 'c#': 'csharp',
             md: 'markdown', yml: 'yaml', sh: 'bash' }[l] || l;
  }

  // Language hint from class names like "language-python", "lang-js", "hljs python"
  function detectLanguage(el) {
    const classes = (el.className || '').toString().split(/\s+/);
    for (const c of classes) {
      const m = c.match(/^(?:language|lang)-([\w+#-]+)/i);
      if (m) return canon(m[1]);
      if (/^hljs$/i.test(c)) continue;
      // bare token like "python" in highlight.js markup
      if (/^(python|javascript|js|typescript|ts|java|c|cpp|c\+\+|csharp|c#|go|rust|ruby|php|swift|kotlin|sql|bash|sh|shell|powershell|html|css|scss|json|yaml|yml|xml|markdown|md|dockerfile|lua|perl|r|scala|dart|haskell|elixir|clojure)$/i.test(c)) {
        return canon(c);
      }
    }
    // data attributes some sites use
    const dataLang = el.getAttribute('data-language') || el.getAttribute('data-lang');
    if (dataLang) return dataLang.toLowerCase();
    return 'text';
  }

  function pushBlock(el) {
    if (seen.has(el)) return;
    seen.add(el);
    const text = (el.innerText || el.textContent || '').replace(/\n+$/, '');
    if (!text.trim() || text.trim().length < 2) return;
    // Skip absurdly large dumps (>200KB) to keep messages small
    const code = text.length > 200000 ? text.slice(0, 200000) + '\n…[truncated]' : text;
    blocks.push({
      language: detectLanguage(el),
      code,
      lines: code.split('\n').length,
      preview: code.split('\n').slice(0, 3).join('\n').slice(0, 160)
    });
  }

  // Prefer <pre><code>, fall back to bare <pre>
  document.querySelectorAll('pre code').forEach(pushBlock);
  document.querySelectorAll('pre').forEach((pre) => {
    if (!pre.querySelector('code')) pushBlock(pre);
  });

  return blocks;
}
