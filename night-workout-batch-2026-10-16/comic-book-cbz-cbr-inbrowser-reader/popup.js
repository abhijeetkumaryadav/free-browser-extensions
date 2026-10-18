// CBZ Reader popup — opens the full-tab reader page.
document.getElementById('open').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
});
