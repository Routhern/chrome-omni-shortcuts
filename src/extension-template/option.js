class OptionsManager {
  constructor() {
    this.targetUrlInput = document.getElementById("target-url");
    this.saveButton = document.getElementById("save-button");
    this.status = document.getElementById("status");

    this.initializeEventListeners();
    this.loadSavedUrl();
  }

  initializeEventListeners() {
    this.saveButton.addEventListener("click", () => this.saveTargetUrl());
  }

  loadSavedUrl() {
    chrome.storage.sync.get(["targetUrl"], (data) => {
      if (data.targetUrl) {
        this.targetUrlInput.value = data.targetUrl;
      }
    });
  }

  async saveTargetUrl() {
    const validation = UrlPolicy.normalize(this.targetUrlInput.value);

    if (!validation.ok) {
      this.showStatus(validation.message, false);
      return;
    }

    try {
      const targetUrl = validation.url;
      const iconData = await FaviconManager.getIconData(targetUrl);
      await this.saveUrlAndIcon(targetUrl, iconData);
      this.targetUrlInput.value = targetUrl;
      this.showStatus("URL and Icon saved!", true);
    } catch (error) {
      console.error(error);
      this.showStatus("Failed to fetch or set the icon.", false);
    }
  }

  saveUrlAndIcon(targetUrl, iconData) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = iconData;
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 32, 32);
        
        const imageData = ctx.getImageData(0, 0, 32, 32);
        
        chrome.storage.sync.set(
          { targetUrl, iconData: canvas.toDataURL() }, 
          () => {
            chrome.action.setIcon({ imageData });
            resolve();
          }
        );
      };
    });
  }

  showStatus(message, isSuccess) {
    this.status.textContent = message;
    this.status.style.color = isSuccess ? 'green' : 'red';
    
    setTimeout(() => {
      this.status.textContent = '';
      this.status.style.color = '';
    }, 2000);
  }
}

class FaviconManager {
  static async getIconData(targetUrl) {
    try {
      const iconData = await this.fetchIcon(this.getGoogleFaviconUrl(targetUrl));
      await this.assertImageLoads(iconData);
      return iconData;
    } catch (error) {
      console.warn("Favicon fetch failed. Using fallback icon:", error);
      return this.createFallbackIcon(targetUrl);
    }
  }

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

  static async fetchIcon(iconUrl) {
    const response = await fetch(iconUrl, {
      credentials: "omit",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch favicon");
    }

    const blob = await response.blob();

    if (!this.isSupportedImageBlob(blob, iconUrl)) {
      throw new Error("Favicon response is not an image");
    }

    return this.blobToDataUrl(blob);
  }

  static isSupportedImageBlob(blob, iconUrl) {
    if (blob.type.startsWith("image/")) {
      return true;
    }

    const urlPath = new URL(iconUrl).pathname.toLowerCase();

    return !blob.type && /\.(ico|png|jpg|jpeg|gif|webp|svg)$/.test(urlPath);
  }

  static blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  static assertImageLoads(iconData) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = () => reject(new Error("Favicon image could not be loaded"));
      img.src = iconData;
    });
  }

  static createFallbackIcon(targetUrl) {
    const parsedUrl = new URL(targetUrl);
    const label = this.getFallbackLabel(parsedUrl.hostname);
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;

    const ctx = canvas.getContext("2d");
    const hue = this.hashString(parsedUrl.hostname) % 360;
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

    return canvas.toDataURL();
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
}

class UrlPolicy {
  static normalize(input) {
    const rawValue = input.trim();

    if (!rawValue) {
      return {
        ok: false,
        message: "Please enter a URL."
      };
    }

    if (/\s/.test(rawValue)) {
      return {
        ok: false,
        message: "URLs cannot contain spaces."
      };
    }

    const candidateUrl = this.addDefaultProtocol(rawValue);

    try {
      const parsedUrl = new URL(candidateUrl);

      if (!this.isAllowedProtocol(parsedUrl.protocol)) {
        return {
          ok: false,
          message: "Only http:// and https:// URLs are supported."
        };
      }

      if (!parsedUrl.hostname) {
        return {
          ok: false,
          message: "Please enter a complete URL."
        };
      }

      if (parsedUrl.username || parsedUrl.password) {
        return {
          ok: false,
          message: "URLs with usernames or passwords are not supported."
        };
      }

      return {
        ok: true,
        url: parsedUrl.href
      };
    } catch (error) {
      return {
        ok: false,
        message: "Please enter a valid URL."
      };
    }
  }

  static addDefaultProtocol(value) {
    if (value.startsWith("//")) {
      return `https:${value}`;
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      return value;
    }

    if (this.looksLikeSchemeWithoutSlashes(value)) {
      return value;
    }

    return `https://${value}`;
  }

  static isAllowedProtocol(protocol) {
    return protocol === "http:" || protocol === "https:";
  }

  static looksLikeSchemeWithoutSlashes(value) {
    const schemeMatch = value.match(/^([a-z][a-z0-9+.-]*):/i);

    if (!schemeMatch) {
      return false;
    }

    const scheme = schemeMatch[1];
    const hostPortPattern = /^[^/?#@:\s]+:\d+($|[/?#])/;

    return !scheme.includes(".") && !hostPortPattern.test(value);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new OptionsManager();
});
