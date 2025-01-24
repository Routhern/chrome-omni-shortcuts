chrome.action.onClicked.addListener(() => {
  chrome.storage.sync.get("targetUrl", (data) => {
    const targetUrl = data.targetUrl || "chrome://newtab";
    chrome.tabs.update({ url: targetUrl });
  });
});