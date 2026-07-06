const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "config", "extensions.json");
const templateDir = path.join(repoRoot, "src", "extension-template");
const outputRoot = path.join(repoRoot, "extensions");
const textFilePattern = /\.(css|html|js|json|md|txt)$/i;
const iconSizes = [16, 24, 32, 48, 128];
const digitSegments = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"]
};

function parseArgs(argv) {
  const args = {
    count: null,
    prune: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--prune") {
      args.prune = true;
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
  const count = overrides.count || config.count;

  if (!Number.isInteger(count) || count < 1 || count > 64) {
    throw new Error("Extension count must be an integer between 1 and 64.");
  }

  if (!Number.isInteger(config.start) || config.start < 1) {
    throw new Error("Config start must be a positive integer.");
  }

  return {
    ...config,
    count
  };
}

function writeConfig(config) {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function formatTemplate(template, values) {
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

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function colorFromHsl(hue, saturation, lightness) {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  const channels = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x]
  ][Math.floor(hue / 60) % 6];

  return channels.map((channel) => clampColor((channel + m) * 255));
}

function hashString(value) {
  return [...value].reduce((hash, character) => {
    return ((hash << 5) - hash + character.charCodeAt(0)) >>> 0;
  }, 0);
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || x >= size || y < 0 || y >= size) {
    return;
  }

  const offset = (y * size + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3] ?? 255;
}

function fillRect(pixels, size, left, top, width, height, color) {
  const startX = Math.max(0, Math.floor(left));
  const startY = Math.max(0, Math.floor(top));
  const endX = Math.min(size, Math.ceil(left + width));
  const endY = Math.min(size, Math.ceil(top + height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      setPixel(pixels, size, x, y, color);
    }
  }
}

function drawSegmentDigit(pixels, size, digit, left, top, width, height, color) {
  const active = new Set(digitSegments[digit] || digitSegments["0"]);
  const thickness = Math.max(1, Math.round(width * 0.18));
  const midY = top + Math.round((height - thickness) / 2);
  const bottomY = top + height - thickness;
  const rightX = left + width - thickness;
  const halfHeight = Math.round(height / 2);

  if (active.has("a")) fillRect(pixels, size, left + thickness, top, width - thickness * 2, thickness, color);
  if (active.has("g")) fillRect(pixels, size, left + thickness, midY, width - thickness * 2, thickness, color);
  if (active.has("d")) fillRect(pixels, size, left + thickness, bottomY, width - thickness * 2, thickness, color);
  if (active.has("f")) fillRect(pixels, size, left, top + thickness, thickness, halfHeight - thickness, color);
  if (active.has("b")) fillRect(pixels, size, rightX, top + thickness, thickness, halfHeight - thickness, color);
  if (active.has("e")) fillRect(pixels, size, left, midY + thickness, thickness, bottomY - midY - thickness, color);
  if (active.has("c")) fillRect(pixels, size, rightX, midY + thickness, thickness, bottomY - midY - thickness, color);
}

function buildIconPixels(size, shortcut) {
  const pixels = Buffer.alloc(size * size * 4);
  const label = shortcut.defaultUrl || shortcut.name || String(shortcut.digit);
  const hue = hashString(label) % 360;
  const start = colorFromHsl(hue, 0.62, 0.46);
  const end = colorFromHsl((hue + 42) % 360, 0.68, 0.28);
  const radius = size * 0.22;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x < radius ? radius - x : x > size - radius ? x - (size - radius) : 0;
      const dy = y < radius ? radius - y : y > size - radius ? y - (size - radius) : 0;
      const alpha = dx * dx + dy * dy > radius * radius ? 0 : 255;
      const mix = (x + y) / Math.max(1, (size - 1) * 2);
      const color = [
        start[0] + (end[0] - start[0]) * mix,
        start[1] + (end[1] - start[1]) * mix,
        start[2] + (end[2] - start[2]) * mix,
        alpha
      ];
      setPixel(pixels, size, x, y, color.map(clampColor));
    }
  }

  fillRect(pixels, size, 0, 0, size, Math.max(1, Math.round(size * 0.38)), [255, 255, 255, 28]);

  const digit = padDigit(shortcut.digit);
  const digitWidth = Math.max(4, Math.round(size * 0.27));
  const digitHeight = Math.max(8, Math.round(size * 0.58));
  const gap = Math.max(1, Math.round(size * 0.07));
  const top = Math.round((size - digitHeight) / 2);
  const left = Math.round((size - digitWidth * 2 - gap) / 2);
  const textColor = [255, 255, 255, 245];

  drawSegmentDigit(pixels, size, digit[0], left, top, digitWidth, digitHeight, textColor);
  drawSegmentDigit(pixels, size, digit[1], left + digitWidth + gap, top, digitWidth, digitHeight, textColor);

  return pixels;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = size * 4;
  const scanlines = Buffer.alloc((stride + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const scanlineOffset = y * (stride + 1);
    scanlines[scanlineOffset] = 0;
    pixels.copy(scanlines, scanlineOffset + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function writeIconFiles(outputDir, shortcut) {
  const iconDir = path.join(outputDir, "icons");
  ensureWithin(outputRoot, iconDir);
  fs.mkdirSync(iconDir, { recursive: true });

  for (const size of iconSizes) {
    const iconPath = path.join(iconDir, `icon-${size}.png`);
    fs.writeFileSync(iconPath, encodePng(size, buildIconPixels(size, shortcut)));
  }
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
  return JSON.stringify(value).slice(1, -1);
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
  manifest.key = manifestKey;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeShortcut(config, digit) {
  const shortcut = getShortcutValues(config, digit);
  const outputDir = path.join(outputRoot, shortcut.directoryName);
  ensureWithin(outputRoot, outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  copyTemplateDirectory(templateDir, outputDir, shortcut);
  writeIconFiles(outputDir, shortcut);
  applyManifestKey(path.join(outputDir, "manifest.json"), shortcut.manifestKey);
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
  const generatedDirs = [];

  for (let offset = 0; offset < config.count; offset += 1) {
    generatedDirs.push(writeShortcut(config, config.start + offset));
  }

  const pruned = options.prune ? pruneExtensions(generatedDirs) : [];

  return {
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
