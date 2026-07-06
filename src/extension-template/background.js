class IconManager {
  static async setIconFromBase64(base64Data) {
    try {
      const offscreenCanvas = new OffscreenCanvas(32, 32);
      const ctx = offscreenCanvas.getContext("2d");

      const response = await fetch(base64Data);
      if (!response.ok) throw new Error("Failed to fetch icon data");

      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      
      ctx.drawImage(bitmap, 0, 0, 32, 32);
      const imageData = ctx.getImageData(0, 0, 32, 32);
      
      chrome.action.setIcon({ imageData });
    } catch (error) {
      console.error("Error setting icon:", error);
    }
  }
}

class StorageManager {
  static async getTargetUrl() {
    return new Promise((resolve) => {
      chrome.storage.sync.get("targetUrl", (data) => {
        resolve(data.targetUrl || "chrome://newtab");
      });
    });
  }
}

class TabManager {
  static async openTargetUrl() {
    const targetUrl = await StorageManager.getTargetUrl();
    chrome.tabs.update({ url: targetUrl });
  }
}

// Extension Listeners
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get(["iconData"], (data) => {
    if (data.iconData) {
      IconManager.setIconFromBase64(data.iconData);
    }
  });
});

chrome.action.onClicked.addListener(() => {
  TabManager.openTargetUrl();
});