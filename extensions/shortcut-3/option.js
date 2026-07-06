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
      const iconData = await this.fetchFavicon(targetUrl);
      await this.saveUrlAndIcon(targetUrl, iconData);
      this.targetUrlInput.value = targetUrl;
      this.showStatus("URL and Icon saved!", true);
    } catch (error) {
      console.error(error);
      this.showStatus("Failed to fetch or set the icon.", false);
    }
  }

  async fetchFavicon(url) {
    const faviconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=32`;
    
    const response = await fetch(faviconUrl);
    if (!response.ok) throw new Error("Failed to fetch favicon");
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
