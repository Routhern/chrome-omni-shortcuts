const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFile } = require("child_process");

const {
  readConfig,
  writeConfig,
  generateExtensions,
  listGeneratedExtensions
} = require("./generate-extensions");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 8151;

const managerRoot = path.resolve(__dirname, "..", "src", "manager");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const urlPattern = /^https?:\/\//i;
const extensionIdPattern = /^[a-p]{32}$/;
const strictBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const manifestKeyModes = new Set(["omit", "include"]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1024 * 1024) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function readJsonBody(request, fallback = {}) {
  const raw = await readBody(request);

  if (!raw.trim()) {
    return fallback;
  }

  const parsed = JSON.parse(raw);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }

  return parsed;
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

function extensionIdFromKey(spkiDer) {
  const hash = crypto.createHash("sha256").update(spkiDer).digest();

  return [...hash.subarray(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .replace(/./g, (hex) => "abcdefghijklmnop"[parseInt(hex, 16)]);
}

function normalizeManifestKeyInput(key) {
  return typeof key === "string" ? key.trim().replace(/\s+/g, "") : "";
}

function parseManifestKey(key, context) {
  const normalizedKey = normalizeManifestKeyInput(key);

  if (!normalizedKey) {
    throw new Error(`${context}: key is empty.`);
  }

  if (extensionIdPattern.test(normalizedKey)) {
    throw new Error(
      `${context}: looks like a 32-character extension ID. ` +
        "Manifest key must be a base64 public key (SPKI)."
    );
  }

  if (!strictBase64Pattern.test(normalizedKey)) {
    throw new Error(`${context}: key must be canonical base64.`);
  }

  let spkiDer;
  let keyObject;

  try {
    spkiDer = Buffer.from(normalizedKey, "base64");
    keyObject = crypto.createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  } catch (error) {
    throw new Error(`${context}: key is not a valid DER(SPKI) public key.`);
  }

  if (keyObject.asymmetricKeyType !== "rsa") {
    throw new Error(`${context}: key must be RSA public key (SPKI).`);
  }

  const modulusLength = keyObject.asymmetricKeyDetails?.modulusLength ?? null;

  if (modulusLength !== null && modulusLength < 2048) {
    throw new Error(`${context}: RSA key length must be at least 2048 bits.`);
  }

  return {
    spkiDer,
    normalizedKey: spkiDer.toString("base64"),
    id: extensionIdFromKey(spkiDer),
    modulusLength
  };
}

function assertValidManifestKey(key, context) {
  return parseManifestKey(key, context);
}

function generateManifestKey() {
  const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const spkiDer = publicKey.export({ type: "spki", format: "der" });

  return {
    key: spkiDer.toString("base64"),
    id: extensionIdFromKey(spkiDer)
  };
}

function validateShortcuts(shortcuts, options = {}) {
  if (typeof shortcuts !== "object" || shortcuts === null || Array.isArray(shortcuts)) {
    throw new Error("shortcuts must be an object keyed by digit.");
  }

  const requireValidKeys = normalizeManifestKeyMode(options.manifestKeyMode) === "include";
  const sanitized = {};

  for (const [digit, entry] of Object.entries(shortcuts)) {
    if (!/^\d+$/.test(digit)) {
      throw new Error(`Invalid shortcut digit: ${digit}`);
    }

    const label = typeof entry?.label === "string" ? entry.label.trim() : "";
    const url = typeof entry?.url === "string" ? entry.url.trim() : "";
    const key = typeof entry?.key === "string" ? normalizeManifestKeyInput(entry.key) : "";

    if (url && !urlPattern.test(url)) {
      throw new Error(`Shortcut ${digit}: URL must start with http:// or https://`);
    }

    if (key && requireValidKeys) {
      const parsed = assertValidManifestKey(key, `Shortcut ${digit}`);
      sanitized[digit] = { label, url, key: parsed.normalizedKey };
      continue;
    }

    sanitized[digit] = { label, url, key };
  }

  return sanitized;
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

function buildKeyAudit(config, options = {}) {
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
      const parsed = parseManifestKey(key, `Shortcut ${digit}`);
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

function autoFixManifestKeys(config, options = {}) {
  const scope = options.scope === "all" ? "all" : "active";

  if (isLocalSafeMode(config)) {
    return {
      config,
      updated: [],
      audit: buildKeyAudit(config, { scope })
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
        parsed = parseManifestKey(normalizedKey, `Shortcut ${digit}`);
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
      generated = generateManifestKey();
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
    audit: buildKeyAudit(nextConfig, { scope })
  };
}

function applyConfigUpdate(update) {
  const config = readConfig();

  if (update.manifestKeyMode !== undefined) {
    config.manifestKeyMode = normalizeManifestKeyMode(update.manifestKeyMode);
  } else {
    config.manifestKeyMode = normalizeManifestKeyMode(config.manifestKeyMode);
  }

  if (update.count !== undefined) {
    const count = Number(update.count);

    if (!Number.isInteger(count) || count < 1 || count > 64) {
      throw new Error("count must be an integer between 1 and 64.");
    }

    config.count = count;
  }

  if (update.shortcuts !== undefined) {
    config.shortcuts = validateShortcuts(update.shortcuts, { manifestKeyMode: config.manifestKeyMode });
  }

  writeConfig(config);
  return config;
}

function assertKeyAuditClean(config) {
  const audit = buildKeyAudit(config, { scope: "active" });

  if (audit.summary.actionNeeded > 0) {
    throw new Error(
      "Manifest key issues must be fixed before generating in fixed ID mode. " +
        `Missing: ${audit.summary.missing}, invalid: ${audit.summary.invalid}, duplicate: ${audit.summary.duplicate}.`
    );
  }
}

function serveStatic(requestPath, response) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(managerRoot, relativePath);

  if (!filePath.startsWith(managerRoot + path.sep) && filePath !== path.join(managerRoot, "index.html")) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/state" && request.method === "GET") {
    sendJson(response, 200, {
      config: readConfig(),
      generated: listGeneratedExtensions()
    });
    return;
  }

  if (pathname === "/api/config" && request.method === "PUT") {
    const body = await readJsonBody(request);
    const config = applyConfigUpdate(body);
    sendJson(response, 200, { config });
    return;
  }

  if (pathname === "/api/generate" && request.method === "POST") {
    const body = await readJsonBody(request);
    const config = readConfig();
    const manifestKeyMode = body.noManifestKey === true ? "omit" : normalizeManifestKeyMode(body.manifestKeyMode ?? config.manifestKeyMode);

    if (manifestKeyMode === "include") {
      assertKeyAuditClean({ ...config, manifestKeyMode });
    }

    const result = generateExtensions({ prune: body.prune === true, manifestKeyMode });
    sendJson(response, 200, result);
    return;
  }

  if (pathname === "/api/key-audit" && request.method === "GET") {
    sendJson(response, 200, { audit: buildKeyAudit(readConfig(), { scope: "active" }) });
    return;
  }

  if (pathname === "/api/key-autofix" && request.method === "POST") {
    const body = await readJsonBody(request);
    const fixed = autoFixManifestKeys(readConfig(), { scope: body.scope === "all" ? "all" : "active" });
    writeConfig(fixed.config);
    sendJson(response, 200, {
      config: fixed.config,
      updated: fixed.updated,
      audit: fixed.audit
    });
    return;
  }

  if (pathname === "/api/keygen" && request.method === "POST") {
    sendJson(response, 200, generateManifestKey());
    return;
  }

  sendJson(response, 404, { error: "Unknown API endpoint" });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], () => {});
    return;
  }

  if (process.platform === "darwin") {
    execFile("open", [url], () => {});
    return;
  }

  execFile("xdg-open", [url], () => {});
}

function main() {
  const port = Number(process.env.OMNI_MANAGER_PORT) || DEFAULT_PORT;

  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, `http://${HOST}`).pathname;

    try {
      if (pathname.startsWith("/api/")) {
        await handleApi(request, response, pathname);
        return;
      }

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      serveStatic(pathname, response);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });

  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`;
    console.log(`Omni-Shortcut Manager running at ${url}`);
    console.log("Press Ctrl+C to stop.");

    if (!process.argv.includes("--no-open")) {
      openBrowser(url);
    }
  });
}

main();
