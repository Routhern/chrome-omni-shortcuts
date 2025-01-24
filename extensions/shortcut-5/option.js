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
    const targetUrl = this.targetUrlInput.value.trim();
    
    if (!targetUrl) {
      this.showStatus("Please enter a valid URL.", false);
      return;
    }

    try {
      const iconData = await this.fetchFavicon(targetUrl);
      await this.saveUrlAndIcon(targetUrl, iconData);
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

document.addEventListener("DOMContentLoaded", () => {
  new OptionsManager();
});