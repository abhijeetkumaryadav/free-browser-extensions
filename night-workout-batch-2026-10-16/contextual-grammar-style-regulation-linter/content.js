/* Style Lint — content helper.
   Returns the text of the currently focused editable element.
   The last evaluated expression is returned to the popup via
   chrome.scripting.executeScript. Read-only: never modifies the page. */
(() => {
  const el = document.activeElement;
  if (!el) return "";
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value || "";
  }
  if (el.isContentEditable) {
    return el.innerText || "";
  }
  return "";
})();
