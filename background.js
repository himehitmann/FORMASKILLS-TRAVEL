/* Service worker MV3 — ouvre l'application dans un onglet au clic sur l'icone.
   Toute la logique de scraping est pilotee depuis la page de l'app (qui, en
   tant que page d'extension, a acces a chrome.tabs / chrome.scripting). */
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("index.html");
  try {
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find(t => t.url && t.url.startsWith(url));
    if (existing) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url });
    }
  } catch (e) {
    await chrome.tabs.create({ url });
  }
});
