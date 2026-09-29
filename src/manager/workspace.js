// 브라우저 표준 API만으로 설정과 확장 패키지를 관리한다.
const manifestKeyModes = new Set(["omit", "include"]);
const strictBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
async function parseManifestKey(key, context = "Key") {
  const normalizedKey = normalizeManifestKeyInput(key);
  if (!normalizedKey || !strictBase64Pattern.test(normalizedKey)) throw new Error(`${context}: 올바른 base64 공개키가 필요합니다.`);
  const bytes = Uint8Array.from(atob(normalizedKey), c => c.charCodeAt(0));
  if (btoa(String.fromCharCode(...bytes)) !== normalizedKey) throw new Error(`${context}: canonical base64가 필요합니다.`);
  const publicKey = await crypto.subtle.importKey("spki", bytes, {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, true, ["verify"]);
  if (publicKey.algorithm.modulusLength < 2048) throw new Error(`${context}: RSA 2048비트 이상이어야 합니다.`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const id = [...hash.slice(0,16)].map(b => "abcdefghijklmnop"[b >> 4] + "abcdefghijklmnop"[b & 15]).join("");
  return {normalizedKey, id};
}
async function generateManifestKey() {
  const pair = await crypto.subtle.generateKey({name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256"}, true, ["sign", "verify"]);
  const bytes = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const key = btoa(String.fromCharCode(...bytes));
  return {key, id: (await parseManifestKey(key)).id};
}
function normalizeManifestKeyMode(mode) {
  if (mode === undefined || mode === null || mode === "") {
    return "omit";
  }

  if (!manifestKeyModes.has(mode)) {
    throw new Error("manifestKeyMode must be either omit or include.");
  }

  return mode;
}

function isLocalSafeMode(config) {
  return normalizeManifestKeyMode(config?.manifestKeyMode) === "omit";
}

function normalizeManifestKeyInput(key) {
  return typeof key === "string" ? key.trim().replace(/\s+/g, "") : "";
}

function getActiveDigits(config) {
  const digits = [];

  for (let offset = 0; offset < config.count; offset += 1) {
    digits.push(config.start + offset);
  }

  return digits;
}

function getManagedDigits(config, scope = "active") {
  if (scope === "all") {
    const all = new Set(getActiveDigits(config));

    for (const digit of Object.keys(config.shortcuts || {})) {
      if (/^\d+$/.test(digit)) {
        all.add(Number(digit));
      }
    }

    return [...all].sort((a, b) => a - b);
  }

  return getActiveDigits(config);
}

async function buildKeyAudit(config, options = {}) {
  const scope = options.scope === "all" ? "all" : "active";
  const localSafeMode = isLocalSafeMode(config);
  const digits = getManagedDigits(config, scope);
  const items = [];
  const idToIndexes = new Map();

  for (const digit of digits) {
    const digitKey = String(digit);
    const entry = config.shortcuts?.[digitKey] || {};
    const key = normalizeManifestKeyInput(entry.key || "");
    const item = {
      digit: digitKey,
      paddedDigit: digitKey.padStart(2, "0"),
      label: typeof entry.label === "string" ? entry.label : "",
      hasKey: Boolean(key),
      isValid: false,
      issueCode: "MISSING_KEY",
      issue: "Missing manifest key.",
      extensionId: "",
      duplicateWith: []
    };

    if (localSafeMode) {
      item.isValid = true;
      item.issueCode = "OMITTED";
      item.issue = "Manifest key is omitted in local safe mode.";
      items.push(item);
      continue;
    }

    if (!key) {
      items.push(item);
      continue;
    }

    try {
      const parsed = await parseManifestKey(key, `Shortcut ${digit}`);
      item.isValid = true;
      item.issueCode = "OK";
      item.issue = "OK";
      item.extensionId = parsed.id;
      item.key = parsed.normalizedKey;

      if (!idToIndexes.has(parsed.id)) {
        idToIndexes.set(parsed.id, []);
      }

      idToIndexes.get(parsed.id).push(items.length);
    } catch (error) {
      item.issueCode = "INVALID_KEY";
      item.issue = error.message;
    }

    items.push(item);
  }

  for (const indexes of idToIndexes.values()) {
    if (indexes.length < 2) {
      continue;
    }

    const duplicateDigits = indexes.map((index) => items[index].digit);

    for (const index of indexes) {
      const item = items[index];
      item.isValid = false;
      item.issueCode = "DUPLICATE_ID";
      item.duplicateWith = duplicateDigits.filter((digit) => digit !== item.digit);
      item.issue = `Duplicate extension ID with shortcut(s): ${item.duplicateWith.join(", ")}.`;
    }
  }

  const summary = {
    scope,
    checked: items.length,
    ok: items.filter((item) => item.issueCode === "OK").length,
    missing: items.filter((item) => item.issueCode === "MISSING_KEY").length,
    invalid: items.filter((item) => item.issueCode === "INVALID_KEY").length,
    duplicate: items.filter((item) => item.issueCode === "DUPLICATE_ID").length
  };

  summary.omitted = items.filter((item) => item.issueCode === "OMITTED").length;
  summary.actionNeeded = localSafeMode ? 0 : summary.missing + summary.invalid + summary.duplicate;

  return { summary, items };
}

async function autoFixManifestKeys(config, options = {}) {
  const scope = options.scope === "all" ? "all" : "active";

  if (isLocalSafeMode(config)) {
    return {
      config,
      updated: [],
      audit: await buildKeyAudit(config, { scope })
    };
  }

  const digits = getManagedDigits(config, scope);
  const shortcuts = { ...(config.shortcuts || {}) };
  const usedIds = new Set();
  const updated = [];

  for (const digit of digits) {
    const digitKey = String(digit);
    const original = shortcuts[digitKey] || {};
    const label = typeof original.label === "string" ? original.label.trim() : "";
    const url = typeof original.url === "string" ? original.url.trim() : "";
    const normalizedKey = normalizeManifestKeyInput(original.key || "");

    let replacementReason = "";
    let parsed = null;

    if (!normalizedKey) {
      replacementReason = "missing_key";
    } else {
      try {
        parsed = await parseManifestKey(normalizedKey, `Shortcut ${digit}`);
      } catch (error) {
        replacementReason = "invalid_key";
      }
    }

    if (!replacementReason && parsed && usedIds.has(parsed.id)) {
      replacementReason = "duplicate_id";
    }

    if (!replacementReason && parsed) {
      shortcuts[digitKey] = { label, url, key: parsed.normalizedKey };
      usedIds.add(parsed.id);

      if (parsed.normalizedKey !== normalizedKey) {
        updated.push({ digit: digitKey, id: parsed.id, reason: "normalized_key" });
      }

      continue;
    }

    let generated;

    do {
      generated = await generateManifestKey();
    } while (usedIds.has(generated.id));

    shortcuts[digitKey] = { label, url, key: generated.key };
    usedIds.add(generated.id);
    updated.push({ digit: digitKey, id: generated.id, reason: replacementReason || "replaced" });
  }

  const nextConfig = {
    ...config,
    shortcuts
  };

  return {
    config: nextConfig,
    updated,
    audit: await buildKeyAudit(nextConfig, { scope })
  };
}

function formatTemplate(template, values) {
  if (typeof template !== "string") {
    throw new Error("Template value must be a string.");
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`Unknown template token: ${match}`);
    }

    return values[key];
  });
}

function getShortcutEntry(config, digit) {
  const entry = config.shortcuts?.[String(digit)] || {};

  return {
    label: typeof entry.label === "string" ? entry.label : "",
    url: typeof entry.url === "string" ? entry.url : "",
    key: typeof entry.key === "string" ? entry.key : ""
  };
}

function padDigit(digit) {
  return String(digit).padStart(2, "0");
}

function getShortcutValues(config, digit) {
  const values = {
    digit: padDigit(digit)
  };
  const entry = getShortcutEntry(config, digit);

  return {
    digit,
    directoryName: formatTemplate(config.directoryTemplate, values),
    name: formatTemplate(config.nameTemplate, values),
    description: formatTemplate(config.descriptionTemplate, values),
    actionTitle: formatTemplate(config.actionTitleTemplate, values),
    defaultUrl: entry.url,
    manifestKey: entry.key
  };
}

function escapeForJsString(value) {
  return JSON.stringify(typeof value === "string" ? value : "").slice(1, -1);
}

function replacePlaceholders(content, shortcut) {
  return content
    .replaceAll("__SHORTCUT_DIGIT__", padDigit(shortcut.digit))
    .replaceAll("__SHORTCUT_NAME__", shortcut.name)
    .replaceAll("__SHORTCUT_DESCRIPTION__", shortcut.description)
    .replaceAll("__SHORTCUT_ACTION_TITLE__", shortcut.actionTitle)
    .replaceAll("__SHORTCUT_DEFAULT_URL__", escapeForJsString(shortcut.defaultUrl));
}

function assertObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function validateManifestIconMap(map, label) {
  assertObject(map, label);

  for (const size of ["16", "24", "32", "48", "128"]) {
    if (map[size] !== "icon.svg") {
      throw new Error(`${label}.${size} must point to icon.svg.`);
    }
  }
}

async function validateGeneratedManifest(manifest, options) {
  const manifestPath = "manifest.json";
  assertObject(manifest, manifestPath);

  if (manifest.manifest_version !== 3) {
    throw new Error(`${manifestPath}: manifest_version must be 3.`);
  }

  for (const field of ["name", "description", "version"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
      throw new Error(`${manifestPath}: ${field} must be a non-empty string.`);
    }
  }

  if (manifest.background?.service_worker !== "background.js") {
    throw new Error(`${manifestPath}: background.service_worker must be background.js.`);
  }

  if (typeof manifest.action?.default_title !== "string" || !manifest.action.default_title.trim()) {
    throw new Error(`${manifestPath}: action.default_title must be a non-empty string.`);
  }

  validateManifestIconMap(manifest.icons, `${manifestPath}: icons`);
  validateManifestIconMap(manifest.action.default_icon, `${manifestPath}: action.default_icon`);

  if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes("storage") || !manifest.permissions.includes("tabs")) {
    throw new Error(`${manifestPath}: permissions must include storage and tabs.`);
  }

  if (!Array.isArray(manifest.host_permissions) || !manifest.host_permissions.includes("https://t0.gstatic.com/*")) {
    throw new Error(`${manifestPath}: host_permissions must include https://t0.gstatic.com/*.`);
  }

  if (options.noManifestKey && Object.prototype.hasOwnProperty.call(manifest, "key")) {
    throw new Error(`${manifestPath}: manifest key must be omitted in local safe mode.`);
  }

  if (!options.noManifestKey) {
    await parseManifestKey(manifest.key, manifestPath);
  }
}

async function validateConfig(config) {
  assertObject(config, "설정");
  if (!Number.isInteger(config.count) || config.count < 1 || config.count > 64) throw new Error("개수는 1~64 정수여야 합니다.");
  if (!Number.isSafeInteger(config.start) || config.start < 1 || !Number.isSafeInteger(config.start + config.count)) throw new Error("시작 번호가 올바르지 않습니다.");
  config.manifestKeyMode = normalizeManifestKeyMode(config.manifestKeyMode);
  assertObject(config.shortcuts ?? {}, "shortcuts");
  const shortcuts = {};
  for (const [digit, entry] of Object.entries(config.shortcuts || {})) {
    if (!/^\d+$/.test(digit)) throw new Error(`올바르지 않은 번호: ${digit}`);
    assertObject(entry, `Shortcut ${digit}`);
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    const key = normalizeManifestKeyInput(entry.key);
    if (url) {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error(`Shortcut ${digit}: http/https URL이 필요합니다.`);
    }
    shortcuts[digit] = {label, url, key};
  }
  config.shortcuts = shortcuts;
  const names = new Set();
  for (const digit of getActiveDigits(config)) {
    const shortcut = getShortcutValues(config, digit);
    // 폴더 핸들의 직접 자식만 허용하여 경로 탈출과 출력 충돌을 막는다.
    if (!/^shortcut-\d+$/.test(shortcut.directoryName) || names.has(shortcut.directoryName)) throw new Error("출력 폴더는 서로 다른 shortcut-숫자 형식이어야 합니다.");
    names.add(shortcut.directoryName);
  }
  return config;
}

async function readText(directory, name) {
  return (await (await directory.getFileHandle(name)).getFile()).text();
}
async function writeFile(directory, name, content) {
  const handle = await directory.getFileHandle(name, {create: true});
  const writable = await handle.createWritable();
  try {
    await writable.write(content);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
}
async function readTemplate(directory, prefix = []) {
  const files = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === "directory") files.push(...await readTemplate(handle, [...prefix, name]));
    else files.push({path: [...prefix, name], file: await handle.getFile()});
  }
  return files;
}

class Workspace {
  async select() {
    const root = await window.showDirectoryPicker({mode: "readwrite", id: "omni-shortcuts"});
    const configDir = await root.getDirectoryHandle("config");
    const config = await validateConfig(JSON.parse(await readText(configDir, "extensions.json")));
    const src = await root.getDirectoryHandle("src");
    const template = await src.getDirectoryHandle("extension-template");
    await template.getFileHandle("manifest.json");
    await template.getFileHandle("background.js");
    await template.getFileHandle("icon.svg");
    this.root = root;
    this.configDir = configDir;
    this.template = template;
    return config;
  }
  async config() {
    if (!this.root) throw new Error("프로젝트 폴더를 먼저 선택하세요.");
    return validateConfig(JSON.parse(await readText(this.configDir, "extensions.json")));
  }
  async save(config) {
    await validateConfig(config);
    if (config.manifestKeyMode === "include") {
      for (const entry of Object.values(config.shortcuts)) if (entry.key) await parseManifestKey(entry.key);
    }
    await writeFile(this.configDir, "extensions.json", `${JSON.stringify(config, null, 2)}\n`);
    return config;
  }
  async generated() {
    let directory;
    try { directory = await this.root.getDirectoryHandle("extensions"); }
    catch (error) { if (error.name === "NotFoundError") return []; throw error; }
    const names = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind === "directory" && /^shortcut-\d+$/.test(name)) names.push(name);
    }
    return names.sort((a,b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
  }
  async generate(options = {}) {
    const config = await this.config();
    config.manifestKeyMode = normalizeManifestKeyMode(options.manifestKeyMode ?? config.manifestKeyMode);
    const audit = await buildKeyAudit(config);
    if (audit.summary.actionNeeded) throw new Error("누락·오류·중복 키를 먼저 복구하세요.");
    const templateFiles = await readTemplate(this.template);
    for (const name of ["manifest.json", "background.js", "icon.svg"]) {
      if (!templateFiles.some(file => file.path.length === 1 && file.path[0] === name)) throw new Error(`템플릿 파일이 없습니다: ${name}`);
    }
    const packages = [];
    // 모든 생성물을 검증한 뒤 디스크에 쓰기 시작한다.
    for (const digit of getActiveDigits(config)) {
      const shortcut = getShortcutValues(config, digit);
      const files = [];
      for (const source of templateFiles) {
        const name = source.path.at(-1);
        let content = source.file;
        if (source.path.length === 1 && name === "manifest.json") {
          const original = JSON.parse(await source.file.text());
          const replace = value => typeof value === "string" ? replacePlaceholders(value, shortcut) : Array.isArray(value) ? value.map(replace) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k, replace(v)])) : value;
          const manifest = replace(original);
          delete manifest.key;
          if (config.manifestKeyMode === "include") manifest.key = (await parseManifestKey(shortcut.manifestKey)).normalizedKey;
          await validateGeneratedManifest(manifest, {noManifestKey: config.manifestKeyMode === "omit"});
          content = `${JSON.stringify(manifest, null, 2)}\n`;
        } else if (/\.(css|html|js|json|md|txt)$/i.test(name)) {
          content = replacePlaceholders(await source.file.text(), shortcut);
        }
        files.push({path: source.path, content});
      }
      packages.push({name: shortcut.directoryName, files});
    }
    const output = await this.root.getDirectoryHandle("extensions", {create: true});
    for (const pkg of packages) {
      const directory = await output.getDirectoryHandle(pkg.name, {create: true});
      for (const file of pkg.files) {
        let parent = directory;
        for (const segment of file.path.slice(0,-1)) parent = await parent.getDirectoryHandle(segment, {create: true});
        await writeFile(parent, file.path.at(-1), file.content);
      }
    }
    const generatedNames = new Set(packages.map(pkg => pkg.name));
    const pruned = [];
    if (options.prune === true) {
      for (const name of await this.generated()) {
        if (!generatedNames.has(name)) {
          await output.removeEntry(name, {recursive: true});
          pruned.push(`extensions/${name}`);
        }
      }
    }
    return {manifestKeyMode: config.manifestKeyMode, generated: packages.map(pkg => `extensions/${pkg.name}`), pruned};
  }
  // 기존 UI 응답 형식을 유지하되 네트워크 요청 없이 직접 처리한다.
  async request(path, options = {}) {
    try {
      const body = JSON.parse(options.body || "{}");
      let payload;
      if (path === "/api/state") payload = {config: await this.config(), generated: await this.generated()};
      else if (path === "/api/config") {
        const config = await this.config();
        for (const key of ["count", "manifestKeyMode", "shortcuts"]) if (body[key] !== undefined) config[key] = body[key];
        payload = {config: await this.save(config)};
      } else if (path === "/api/generate") payload = await this.generate(body);
      else if (path === "/api/keygen") payload = await generateManifestKey();
      else if (path === "/api/key-audit") payload = {audit: await buildKeyAudit(await this.config())};
      else if (path === "/api/key-autofix") {
        const config = await this.config();
        if (body.shortcuts) config.shortcuts = body.shortcuts;
        if (body.manifestKeyMode) config.manifestKeyMode = body.manifestKeyMode;
        await validateConfig(config);
        payload = await autoFixManifestKeys(config, body);
        await this.save(payload.config);
      } else throw new Error(`알 수 없는 작업: ${path}`);
      return {ok: true, json: async () => payload};
    } catch (error) {
      return {ok: false, json: async () => ({error: error.message})};
    }
  }
}
const workspace = new Workspace();
