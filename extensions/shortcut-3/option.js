document.addEventListener("DOMContentLoaded", () => {
  const targetUrlInput = document.getElementById("target-url");
  const saveButton = document.getElementById("save-button");
  const status = document.getElementById("status");

  // 설정 불러오기
  chrome.storage.sync.get(["targetUrl"], (data) => {
    if (data.targetUrl) {
      targetUrlInput.value = data.targetUrl;
    }
  });

  // URL 저장 및 아이콘 설정
  saveButton.addEventListener("click", () => {
    const targetUrl = targetUrlInput.value.trim();
    if (targetUrl) {
      const faviconUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${targetUrl}&size=32`;
      fetch(faviconUrl)
        .then((response) => {
          if (!response.ok) throw new Error("Failed to fetch favicon.");
          return response.blob();
        })
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.src = reader.result; // Base64 데이터
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = 32; // 아이콘 크기 (32x32)
              canvas.height = 32;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, 32, 32);
              const imageData = ctx.getImageData(0, 0, 32, 32);
              chrome.storage.sync.set({ targetUrl }, () => {
                chrome.action.setIcon({ imageData });
                status.textContent = "URL and Icon saved!";
                setTimeout(() => (status.textContent = ""), 2000);
              });
            };
          };
          reader.readAsDataURL(blob);
        })
        .catch((error) => {
          console.error(error);
          status.textContent = "Failed to fetch or set the icon.";
          setTimeout(() => (status.textContent = ""), 2000);
        });
    } else {
      status.textContent = "Please enter a valid URL.";
      setTimeout(() => (status.textContent = ""), 2000);
    }
  });
});
