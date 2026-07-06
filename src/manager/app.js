const THEMES = ["auto", "light", "dark"];
const LANGUAGES = ["en", "ko"];

class I18n {
  constructor() {
    this.language = localStorage.getItem("manager.language") || "en";
    this.messages = {};
  }

  async load(language) {
    this.language = LANGUAGES.includes(language) ? language : "en";
    localStorage.setItem("manager.language", this.language);

    const response = await fetch(`i18n/${this.language}.json`);
    this.messages = await response.json();

    document.documentElement.lang = this.language;
    this.applyToDom();
  }

  t(key, values = {}) {
    const template = this.messages[key] || key;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
    );
  }

  applyToDom() {
    for (const element of document.querySelectorAll("[data-i18n]")) {
      element.textContent = this.t(element.dataset.i18n);
    }

    for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
      element.placeholder = this.t(element.dataset.i18nPlaceholder);
    }
  }
}

class ThemeManager {
  constructor(button, i18n) {
    this.button = button;
    this.i18n = i18n;
    this.theme = localStorage.getItem("manager.theme") || "auto";
  }

  apply() {
    if (this.theme === "auto") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = this.theme;
    }

    this.button.dataset.i18n = `theme.${this.theme}`;
    this.button.textContent = this.i18n.t(`theme.${this.theme}`);
  }

  cycle() {
    this.theme = THEMES[(THEMES.indexOf(this.theme) + 1) % THEMES.length];
    localStorage.setItem("manager.theme", this.theme);
    this.apply();
  }
}

class ManagerApp {
  constructor() {
    this.i18n = new I18n();
    this.theme = new ThemeManager(document.getElementById("theme-toggle"), this.i18n);
    this.countInput = document.getElementById("count-input");
    this.pruneCheckbox = document.getElementById("prune-checkbox");
    this.generateButton = document.getElementById("generate-button");
    this.saveShortcutsButton = document.getElementById("save-shortcuts-button");
    this.shortcutList = document.getElementById("shortcut-list");
    this.statusMessage = document.getElementById("status-message");
    this.generatedStatus = document.getElementById("generated-status");
    this.rowTemplate = document.getElementById("shortcut-row-template");
    this.languageSelect = document.getElementById("language-select");

    this.config = null;
    this.generated = [];
  }

  async start() {
    this.languageSelect.value = this.i18n.language;
    await this.i18n.load(this.i18n.language);
    this.theme.apply();

    this.languageSelect.addEventListener("change", async () => {
      await this.i18n.load(this.languageSelect.value);
      this.theme.apply();
      this.render();
    });

    document.getElementById("theme-toggle").addEventListener("click", () => this.theme.cycle());
    this.generateButton.addEventListener("click", () => this.saveAndGenerate());
    this.saveShortcutsButton.addEventListener("click", () => this.saveShortcuts());

    const importFile = document.getElementById("import-file");
    document.getElementById("export-button").addEventListener("click", () => this.exportConfig());
    document.getElementById("import-button").addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", () => {
      if (importFile.files.length > 0) {
        this.importConfig(importFile.files[0]);
        importFile.value = "";
      }
    });

    await this.refreshState();
  }

  async refreshState() {
    const response = await fetch("/api/state");
    const state = await response.json();
    this.config = state.config;
    this.generated = state.generated;
    this.render();
  }

  render() {
    this.countInput.value = this.config.count;
    this.generatedStatus.textContent = this.i18n.t("count.generatedStatus", {
      generated: this.generated.length
    });
    this.renderShortcuts();
  }

  renderShortcuts() {
    this.shortcutList.replaceChildren();
    const start = this.config.start;
    const shortcuts = this.config.shortcuts || {};

    for (let offset = 0; offset < this.config.count; offset += 1) {
      const digit = String(start + offset);
      const entry = shortcuts[digit] || { label: "", url: "", key: "" };
      this.shortcutList.appendChild(this.buildRow(digit, entry));
    }

    this.i18n.applyToDom();
  }

  buildRow(digit, entry) {
    const row = this.rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.digit = digit;
    const paddedDigit = digit.padStart(2, "0");

    const badge = row.querySelector(".shortcut-generated-badge");
    const favicon = row.querySelector(".shortcut-favicon");
    const labelInput = row.querySelector(".shortcut-label");
    const urlInput = row.querySelector(".shortcut-url");
    const keyInput = row.querySelector(".shortcut-key");
    const openLink = row.querySelector(".shortcut-open");
    const urlFeedback = row.querySelector(".url-feedback");
    const keyFeedback = row.querySelector(".key-feedback");

    row.querySelector(".shortcut-digit").textContent = paddedDigit;
    labelInput.value = entry.label;
    urlInput.value = entry.url;
    keyInput.value = entry.key;

    const isGenerated = this.generated.includes(`shortcut-${paddedDigit}`);
    badge.textContent = this.i18n.t(isGenerated ? "shortcuts.generated" : "shortcuts.notGenerated");
    badge.classList.toggle("is-generated", isGenerated);

    const applyUrlPreview = (url) => {
      openLink.href = url || "#";
      openLink.classList.toggle("is-disabled", !url);
      this.updateFavicon(favicon, url);
    };

    row.querySelector(".validate-url").addEventListener("click", () => {
      const result = this.validateUrl(urlInput.value.trim());
      urlFeedback.textContent = result.message;
      urlFeedback.classList.toggle("is-error", !result.ok);
      applyUrlPreview(result.ok ? urlInput.value.trim() : "");
    });

    row.querySelector(".verify-key").addEventListener("click", async () => {
      const result = await this.verifyKey(keyInput.value.trim());
      keyFeedback.textContent = result.message;
      keyFeedback.classList.toggle("is-error", !result.ok);
    });

    row.querySelector(".generate-key").addEventListener("click", async () => {
      try {
        const response = await fetch("/api/keygen", { method: "POST" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || response.statusText);
        }

        keyInput.value = payload.key;
        keyFeedback.textContent = this.i18n.t("validate.keyOk", { id: payload.id });
        keyFeedback.classList.remove("is-error");
      } catch (error) {
        keyFeedback.textContent = this.i18n.t("status.error", { message: error.message });
        keyFeedback.classList.add("is-error");
      }
    });

    applyUrlPreview(entry.url);
    return row;
  }

  validateUrl(url) {
    if (!url) {
      return { ok: false, message: this.i18n.t("validate.urlEmpty") };
    }

    try {
      const parsed = new URL(url);

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, message: this.i18n.t("validate.urlScheme") };
      }

      if (!parsed.hostname) {
        return { ok: false, message: this.i18n.t("validate.urlInvalid") };
      }

      return { ok: true, message: this.i18n.t("validate.urlOk") };
    } catch (error) {
      return { ok: false, message: this.i18n.t("validate.urlInvalid") };
    }
  }

  async verifyKey(key) {
    if (!key) {
      return { ok: false, message: this.i18n.t("validate.keyEmpty") };
    }

    if (/^[a-p]{32}$/.test(key)) {
      return { ok: false, message: this.i18n.t("validate.keyIsExtensionId") };
    }

    if (!/^[A-Za-z0-9+/=]+$/.test(key)) {
      return { ok: false, message: this.i18n.t("validate.keyInvalid") };
    }

    try {
      const raw = atob(key);
      const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));

      // 확장 ID 등 임의의 base64 문자열을 걸러내기 위해 실제 SPKI 공개키인지 확인한다.
      await crypto.subtle.importKey(
        "spki",
        bytes,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        true,
        ["verify"]
      );

      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      const extensionId = [...hash.slice(0, 16)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .replace(/./g, (hex) => "abcdefghijklmnop"[parseInt(hex, 16)]);

      return { ok: true, message: this.i18n.t("validate.keyOk", { id: extensionId }) };
    } catch (error) {
      return { ok: false, message: this.i18n.t("validate.keyInvalid") };
    }
  }

  updateFavicon(image, url) {
    if (!url) {
      image.removeAttribute("src");
      image.style.visibility = "hidden";
      return;
    }

    const params = new URLSearchParams({
      client: "SOCIAL",
      type: "FAVICON",
      fallback_opts: "TYPE,SIZE,URL",
      url,
      size: "32"
    });

    image.src = `https://t0.gstatic.com/faviconV2?${params.toString()}`;
    image.style.visibility = "visible";
  }

  collectShortcuts() {
    const shortcuts = { ...(this.config.shortcuts || {}) };

    for (const row of this.shortcutList.querySelectorAll(".shortcut-row")) {
      shortcuts[row.dataset.digit] = {
        label: row.querySelector(".shortcut-label").value.trim(),
        url: row.querySelector(".shortcut-url").value.trim(),
        key: row.querySelector(".shortcut-key").value.trim()
      };
    }

    return shortcuts;
  }

  async putConfig(update) {
    const response = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update)
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || response.statusText);
    }

    this.config = payload.config;
  }

  async saveShortcuts() {
    try {
      await this.putConfig({ shortcuts: this.collectShortcuts() });
      this.showStatus(this.i18n.t("status.saved"), true);
      this.render();
    } catch (error) {
      this.showStatus(this.i18n.t("status.error", { message: error.message }), false);
    }
  }

  async saveAndGenerate() {
    const count = Number(this.countInput.value);
    const confirmKey = this.pruneCheckbox.checked ? "confirm.generatePrune" : "confirm.generate";

    if (!window.confirm(this.i18n.t(confirmKey, { count }))) {
      return;
    }

    this.generateButton.setAttribute("aria-busy", "true");

    try {
      await this.putConfig({
        count: Number(this.countInput.value),
        shortcuts: this.collectShortcuts()
      });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prune: this.pruneCheckbox.checked })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || response.statusText);
      }

      let message = this.i18n.t("status.generated", { count: result.generated.length });

      if (result.pruned.length > 0) {
        message += this.i18n.t("status.pruned", { pruned: result.pruned.join(", ") });
      }

      this.showStatus(message, true);
      await this.refreshState();
    } catch (error) {
      this.showStatus(this.i18n.t("status.error", { message: error.message }), false);
    } finally {
      this.generateButton.removeAttribute("aria-busy");
    }
  }

  exportConfig() {
    const payload = {
      count: this.config.count,
      shortcuts: this.collectShortcuts()
    };

    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "omni-shortcut-config.json";
    link.click();
    URL.revokeObjectURL(url);
    this.showStatus(this.i18n.t("status.exported"), true);
  }

  async importConfig(file) {
    try {
      const parsed = JSON.parse(await file.text());

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(this.i18n.t("status.invalidImport"));
      }

      const update = {};

      if (parsed.count !== undefined) {
        update.count = parsed.count;
      }

      if (parsed.shortcuts !== undefined) {
        update.shortcuts = parsed.shortcuts;
      }

      if (update.count === undefined && update.shortcuts === undefined) {
        throw new Error(this.i18n.t("status.invalidImport"));
      }

      await this.putConfig(update);
      this.showStatus(this.i18n.t("status.imported"), true);
      await this.refreshState();
    } catch (error) {
      this.showStatus(this.i18n.t("status.error", { message: error.message }), false);
    }
  }

  showStatus(message, success) {
    this.statusMessage.textContent = message;
    this.statusMessage.classList.toggle("is-error", !success);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ManagerApp().start();
});
