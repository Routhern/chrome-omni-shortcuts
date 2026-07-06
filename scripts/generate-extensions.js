const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "config", "extensions.json");
const templateDir = path.join(repoRoot, "src", "extension-template");
const outputRoot = path.join(repoRoot, "extensions");
const textFilePattern = /\.(css|html|js|json|md|txt)$/i;

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

function readConfig(args) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const count = args.count || config.count;

  if (!Number.isInteger(count) || count < 1 || count > 99) {
    throw new Error("Extension count must be an integer between 1 and 99.");
  }

  if (!Number.isInteger(config.start) || config.start < 1) {
    throw new Error("Config start must be a positive integer.");
  }

  return {
    ...config,
    count
  };
}

function formatTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`Unknown template token: ${match}`);
    }

    return values[key];
  });
}

function getShortcutValues(config, digit) {
  const values = {
    digit: String(digit)
  };

  return {
    digit,
    directoryName: formatTemplate(config.directoryTemplate, values),
    name: formatTemplate(config.nameTemplate, values),
    description: formatTemplate(config.descriptionTemplate, values),
    actionTitle: formatTemplate(config.actionTitleTemplate, values),
    optionPageTitle: formatTemplate(config.optionPageTitleTemplate, values),
    optionHeading: formatTemplate(config.optionHeadingTemplate, values),
    manifestKey: config.manifestKeys?.[String(digit)] || ""
  };
}

function replacePlaceholders(content, shortcut) {
  return content
    .replaceAll("__SHORTCUT_DIGIT__", String(shortcut.digit))
    .replaceAll("__SHORTCUT_NAME__", shortcut.name)
    .replaceAll("__SHORTCUT_DESCRIPTION__", shortcut.description)
    .replaceAll("__SHORTCUT_ACTION_TITLE__", shortcut.actionTitle)
    .replaceAll("__SHORTCUT_OPTION_PAGE_TITLE__", shortcut.optionPageTitle)
    .replaceAll("__SHORTCUT_OPTION_HEADING__", shortcut.optionHeading);
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
  applyManifestKey(path.join(outputDir, "manifest.json"), shortcut.manifestKey);
  return outputDir;
}

function pruneExtensions(config, generatedDirs) {
  const generated = new Set(generatedDirs.map((dir) => path.resolve(dir)));

  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^shortcut-\d+$/.test(entry.name)) {
      continue;
    }

    const candidate = path.resolve(outputRoot, entry.name);
    ensureWithin(outputRoot, candidate);

    if (!generated.has(candidate)) {
      fs.rmSync(candidate, { recursive: true, force: true });
      console.log(`Pruned ${path.relative(repoRoot, candidate)}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readConfig(args);
  const generatedDirs = [];

  for (let offset = 0; offset < config.count; offset += 1) {
    generatedDirs.push(writeShortcut(config, config.start + offset));
  }

  if (args.prune) {
    pruneExtensions(config, generatedDirs);
  }

  console.log(`Generated ${generatedDirs.length} extension package(s).`);
}

main();
