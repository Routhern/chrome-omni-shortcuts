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

function extensionIdFromKey(spkiDer) {
  const hash = crypto.createHash("sha256").update(spkiDer).digest();

  return [...hash.subarray(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .replace(/./g, (hex) => "abcdefghijklmnop"[parseInt(hex, 16)]);
}

function assertValidManifestKey(key, context) {
  // Chrome manifest key는 base64로 인코딩된 DER(SPKI) 공개키여야 한다.
  // 32자리 확장 ID(a-p 문자열)도 base64 문자 집합에 걸리므로 실제 디코딩까지 검증한다.
  if (!/^[A-Za-z0-9+/=]+$/.test(key)) {
    throw new Error(`${context}: key must be a base64 manifest key.`);
  }

  let spkiDer;

  try {
    spkiDer = Buffer.from(key, "base64");
    crypto.createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  } catch (error) {
    throw new Error(
      `${context}: key is not a valid base64 public key (SPKI). ` +
        "Note: a 32-character extension ID is not a manifest key."
    );
  }

  return spkiDer;
}

function generateManifestKey() {
  const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const spkiDer = publicKey.export({ type: "spki", format: "der" });

  return {
    key: spkiDer.toString("base64"),
    id: extensionIdFromKey(spkiDer)
  };
}

function validateShortcuts(shortcuts) {
  if (typeof shortcuts !== "object" || shortcuts === null || Array.isArray(shortcuts)) {
    throw new Error("shortcuts must be an object keyed by digit.");
  }

  const sanitized = {};

  for (const [digit, entry] of Object.entries(shortcuts)) {
    if (!/^\d+$/.test(digit)) {
      throw new Error(`Invalid shortcut digit: ${digit}`);
    }

    const label = typeof entry?.label === "string" ? entry.label.trim() : "";
    const url = typeof entry?.url === "string" ? entry.url.trim() : "";
    const key = typeof entry?.key === "string" ? entry.key.trim() : "";

    if (url && !urlPattern.test(url)) {
      throw new Error(`Shortcut ${digit}: URL must start with http:// or https://`);
    }

    if (key) {
      assertValidManifestKey(key, `Shortcut ${digit}`);
    }

    sanitized[digit] = { label, url, key };
  }

  return sanitized;
}

function applyConfigUpdate(update) {
  const config = readConfig();

  if (update.count !== undefined) {
    const count = Number(update.count);

    if (!Number.isInteger(count) || count < 1 || count > 64) {
      throw new Error("count must be an integer between 1 and 64.");
    }

    config.count = count;
  }

  if (update.shortcuts !== undefined) {
    config.shortcuts = validateShortcuts(update.shortcuts);
  }

  writeConfig(config);
  return config;
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
    const body = JSON.parse(await readBody(request));
    const config = applyConfigUpdate(body);
    sendJson(response, 200, { config });
    return;
  }

  if (pathname === "/api/generate" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)) || "{}");
    const result = generateExtensions({ prune: body.prune === true });
    sendJson(response, 200, result);
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
