// Injected by scripts/generate-extensions.js from config/extensions.json shortcuts[digit].url
const DEFAULT_TARGET_URL = "";

class StorageManager {
  static async getTargetUrl() {
    if (DEFAULT_TARGET_URL) {
      return DEFAULT_TARGET_URL;
    }

    // Legacy fallback: URLs saved through the removed options page.
    const data = await chrome.storage.sync.get("targetUrl");
    return data.targetUrl || "chrome://newtab";
  }

  static async getCachedIcon() {
    const data = await chrome.storage.local.get(["iconUrl", "iconPixels"]);

    if (data.iconUrl && Array.isArray(data.iconPixels) && data.iconPixels.length === 32 * 32 * 4) {
      return data;
    }

    return null;
  }

  static async setCachedIcon(iconUrl, imageData) {
    await chrome.storage.local.set({
      iconUrl,
      iconPixels: Array.from(imageData.data)
    });
  }
}

class FaviconManager {
  static getGoogleFaviconUrl(targetUrl) {
    const params = new URLSearchParams({
      client: "SOCIAL",
      type: "FAVICON",
      fallback_opts: "TYPE,SIZE,URL",
      url: targetUrl,
      size: "32"
    });

    return `https://t0.gstatic.com/faviconV2?${params.toString()}`;
  }

  static async fetchIconBitmap(targetUrl) {
    const response = await fetch(this.getGoogleFaviconUrl(targetUrl), {
      credentials: "omit",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch favicon");
    }

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      throw new Error("Favicon response is not an image");
    }

    return createImageBitmap(blob);
  }

  static drawFallbackIcon(ctx, targetUrl) {
    const hostname = new URL(targetUrl).hostname;
    const label = this.getFallbackLabel(hostname);
    const hue = this.hashString(hostname) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 32, 32);

    gradient.addColorStop(0, `hsl(${hue}, 70%, 42%)`);
    gradient.addColorStop(1, `hsl(${(hue + 35) % 360}, 68%, 28%)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(0, 0, 32, 14);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 16, 17);
  }

  static getFallbackLabel(hostname) {
    return hostname
      .replace(/^www\./i, "")
      .charAt(0)
      .toUpperCase() || "?";
  }

  static hashString(value) {
    return [...value].reduce((hash, character) => {
      return ((hash << 5) - hash + character.charCodeAt(0)) >>> 0;
    }, 0);
  }

  static async renderIcon(targetUrl) {
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext("2d");

    try {
      const bitmap = await this.fetchIconBitmap(targetUrl);
      ctx.drawImage(bitmap, 0, 0, 32, 32);
    } catch (error) {
      console.warn("Favicon fetch failed. Using fallback icon:", error);
      this.drawFallbackIcon(ctx, targetUrl);
    }

    return ctx.getImageData(0, 0, 32, 32);
  }
}

class IconManager {
  static async refreshIcon() {
    try {
      const targetUrl = await StorageManager.getTargetUrl();

      if (!/^https?:\/\//i.test(targetUrl)) {
        return;
      }

      const cached = await StorageManager.getCachedIcon();

      if (cached && cached.iconUrl === targetUrl) {
        this.applyPixels(cached.iconPixels);
        return;
      }

      const imageData = await FaviconManager.renderIcon(targetUrl);
      chrome.action.setIcon({ imageData });
      await StorageManager.setCachedIcon(targetUrl, imageData);
    } catch (error) {
      console.error("Error refreshing icon:", error);
    }
  }

  static applyPixels(iconPixels) {
    const imageData = new ImageData(new Uint8ClampedArray(iconPixels), 32, 32);
    chrome.action.setIcon({ imageData });
  }
}

class TabManager {
  static async openTargetUrl() {
    const targetUrl = await StorageManager.getTargetUrl();
    chrome.tabs.update({ url: targetUrl });
  }
}

// Extension Listeners
chrome.runtime.onInstalled.addListener(() => {
  IconManager.refreshIcon();
});

chrome.runtime.onStartup.addListener(() => {
  IconManager.refreshIcon();
});

chrome.action.onClicked.addListener(() => {
  TabManager.openTargetUrl();
});
