const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "config", "extensions.json");
const templateDir = path.join(repoRoot, "src", "extension-template");
const outputRoot = path.join(repoRoot, "extensions");
const textFilePattern = /\.(css|html|js|json|md|txt)$/i;
const extensionIdPattern = /^[a-p]{32}$/;
const strictBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const manifestKeyModes = new Set(["omit", "include"]);

function parseArgs(argv) {
  const args = {
    count: null,
    noManifestKey: false,
    manifestKeyMode: null,
    prune: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--prune") {
      args.prune = true;
      continue;
    }

    if (arg === "--no-manifest-key") {
      args.noManifestKey = true;
      args.manifestKeyMode = "omit";
      continue;
    }

    if (arg === "--with-manifest-key") {
      args.noManifestKey = false;
      args.manifestKeyMode = "include";
      continue;
    }

    if (arg === "--manifest-key-mode") {
      args.manifestKeyMode = argv[index + 1];
      args.noManifestKey = args.manifestKeyMode === "omit";
      index += 1;
      continue;
    }

    if (arg.startsWith("--manifest-key-mode=")) {
      args.manifestKeyMode = arg.slice("--manifest-key-mode=".length);
      args.noManifestKey = args.manifestKeyMode === "omit";
      continue;
    }

    if (arg === "--count") {
      args.count = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--count=")) {
      args.count = Number(arg.slice("--count=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function readConfig(overrides = {}) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const count = overrides.count ?? config.count;
  const manifestKeyMode = normalizeManifestKeyMode(overrides.manifestKeyMode ?? config.manifestKeyMode);

  if (!Number.isInteger(count) || count < 1 || count > 64) {
    throw new Error("Extension count must be an integer between 1 and 64.");
  }

  if (!Number.isInteger(config.start) || config.start < 1) {
    throw new Error("Config start must be a positive integer.");
  }

  return {
    ...config,
    count,
    manifestKeyMode
  };
}

function writeConfig(config) {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
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

function normalizeManifestKeyMode(mode) {
  if (mode === undefined || mode === null || mode === "") {
    return "omit";
  }

  if (!manifestKeyModes.has(mode)) {
    throw new Error("manifestKeyMode must be either omit or include.");
  }

  return mode;
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

function ensureWithin(parent, child) {
  const relative = path.relative(parent, child);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe output path: ${child}`);
  }
}

function copyTemplateFile(sourcePath, outputPath, shortcut) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (textFilePattern.test(sourcePath)) {
    const content = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(outputPath, replacePlaceholders(content, shortcut));
    return;
  }

  fs.copyFileSync(sourcePath, outputPath);
}

function copyTemplateDirectory(sourceDir, outputDir, shortcut) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputPath = path.join(outputDir, entry.name);

    if (entry.isDirectory()) {
      copyTemplateDirectory(sourcePath, outputPath, shortcut);
      continue;
    }

    copyTemplateFile(sourcePath, outputPath, shortcut);
  }
}

function applyManifestKey(manifestPath, manifestKey) {
  if (!manifestKey) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const parsed = parseManifestKey(manifestKey, manifestPath);
  manifest.key = manifestKey;
  manifest.key = parsed.normalizedKey;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
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
    throw new Error(`${context}: manifest key is empty.`);
  }

  if (extensionIdPattern.test(normalizedKey)) {
    throw new Error(`${context}: manifest key looks like a 32-character extension ID, not a base64 public key.`);
  }

  if (!strictBase64Pattern.test(normalizedKey)) {
    throw new Error(`${context}: manifest key must be canonical base64.`);
  }

  let spkiDer;
  let keyObject;

  try {
    spkiDer = Buffer.from(normalizedKey, "base64");
    keyObject = crypto.createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  } catch (error) {
    throw new Error(`${context}: manifest key is not a valid DER(SPKI) public key.`);
  }

  if (keyObject.asymmetricKeyType !== "rsa") {
    throw new Error(`${context}: manifest key must be an RSA public key.`);
  }

  const modulusLength = keyObject.asymmetricKeyDetails?.modulusLength ?? null;

  if (modulusLength !== null && modulusLength < 2048) {
    throw new Error(`${context}: manifest key must be at least 2048 bits.`);
  }

  return {
    normalizedKey: spkiDer.toString("base64"),
    id: extensionIdFromKey(spkiDer)
  };
}

function validateActiveManifestKeys(config) {
  const ids = new Map();

  for (let offset = 0; offset < config.count; offset += 1) {
    const digit = config.start + offset;
    const shortcut = getShortcutValues(config, digit);
    const parsed = parseManifestKey(shortcut.manifestKey, `shortcut-${padDigit(digit)}`);

    if (ids.has(parsed.id)) {
      throw new Error(
        `shortcut-${padDigit(digit)} duplicates extension ID ${parsed.id} with shortcut-${padDigit(ids.get(parsed.id))}.`
      );
    }

    ids.set(parsed.id, digit);
  }
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

function validateGeneratedManifest(manifestPath, options) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
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
    parseManifestKey(manifest.key, manifestPath);
  }
}

function writeShortcut(config, digit, options = {}) {
  const shortcut = getShortcutValues(config, digit);
  const outputDir = path.join(outputRoot, shortcut.directoryName);
  ensureWithin(outputRoot, outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  copyTemplateDirectory(templateDir, outputDir, shortcut);

  if (!options.noManifestKey) {
    applyManifestKey(path.join(outputDir, "manifest.json"), shortcut.manifestKey);
  }

  if (!fs.existsSync(path.join(outputDir, "icon.svg"))) {
    throw new Error(`${outputDir}: icon.svg is missing.`);
  }

  validateGeneratedManifest(path.join(outputDir, "manifest.json"), options);

  return outputDir;
}

function pruneExtensions(generatedDirs) {
  const generated = new Set(generatedDirs.map((dir) => path.resolve(dir)));
  const pruned = [];

  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^shortcut-\d+$/.test(entry.name)) {
      continue;
    }

    const candidate = path.resolve(outputRoot, entry.name);
    ensureWithin(outputRoot, candidate);

    if (!generated.has(candidate)) {
      fs.rmSync(candidate, { recursive: true, force: true });
      pruned.push(path.relative(repoRoot, candidate));
    }
  }

  return pruned;
}

function listGeneratedExtensions() {
  if (!fs.existsSync(outputRoot)) {
    return [];
  }

  return fs
    .readdirSync(outputRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^shortcut-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
}

function generateExtensions(options = {}) {
  const config = readConfig(options);
  const manifestKeyMode = options.noManifestKey === true ? "omit" : normalizeManifestKeyMode(options.manifestKeyMode ?? config.manifestKeyMode);
  const generationOptions = {
    ...options,
    noManifestKey: manifestKeyMode === "omit",
    manifestKeyMode
  };
  const generatedDirs = [];

  if (!generationOptions.noManifestKey) {
    validateActiveManifestKeys(config);
  }

  for (let offset = 0; offset < config.count; offset += 1) {
    generatedDirs.push(writeShortcut(config, config.start + offset, generationOptions));
  }

  const pruned = generationOptions.prune ? pruneExtensions(generatedDirs) : [];

  return {
    manifestKeyMode,
    generated: generatedDirs.map((dir) => path.relative(repoRoot, dir).replaceAll(path.sep, "/")),
    pruned: pruned.map((dir) => dir.replaceAll(path.sep, "/"))
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = generateExtensions(args);

  for (const dir of result.pruned) {
    console.log(`Pruned ${dir}`);
  }

  console.log(`Generated ${result.generated.length} extension package(s).`);

  if (result.manifestKeyMode === "omit") {
    console.log("Manifest key fields were omitted for local Chrome profile compatibility.");
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  repoRoot,
  configPath,
  readConfig,
  writeConfig,
  generateExtensions,
  listGeneratedExtensions
};
