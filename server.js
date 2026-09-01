const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const root = __dirname;
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const uploadsDir = path.join(publicDir, "images", "uploads");
const port = process.env.PORT || 3000;
const host = process.env.HOST || "127.0.0.1";

// Local development password for the /admin page. Production uses the
// ADMIN_PASSWORD environment variable set in Vercel.
const adminPassword = process.env.ADMIN_PASSWORD || "dev";

const imageTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const maxUploadBytes = 4_000_000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value));
}

function readJson(fileName) {
  return fs.readFileSync(path.join(dataDir, fileName), "utf8");
}

function authed(req) {
  const given = String(req.headers["x-admin-key"] || "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

function serveFile(res, pathname) {
  let safePath = pathname === "/" ? "/index.html" : pathname;
  if (safePath === "/admin") safePath = "/admin.html";
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, contents, mimeTypes[ext] || "application/octet-stream");
  });
}

function collectBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("body-too-large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ---- Content API (mirrors api/content.js in production) ----
  if (req.method === "GET" && url.pathname === "/api/content") {
    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 200, {
      site: JSON.parse(readJson("site.json")),
      menu: JSON.parse(readJson("menu.json")),
      portfolio: JSON.parse(readJson("portfolio.json")),
      theme: JSON.parse(readJson("theme.json"))
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/site") {
    send(res, 200, readJson("site.json"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/menu") {
    send(res, 200, readJson("menu.json"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/portfolio") {
    send(res, 200, readJson("portfolio.json"));
    return;
  }

  // ---- Admin save API (mirrors api/save.js; writes the local JSON files) ----
  if (url.pathname === "/api/save") {
    if (!authed(req)) {
      sendJson(res, 401, { ok: false, message: "Wrong password." });
      return;
    }
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, message: "Method not allowed." });
      return;
    }
    try {
      const { name, data } = JSON.parse((await collectBody(req)).toString("utf8"));
      const valid =
        (["site", "theme"].includes(name) && data && typeof data === "object" && !Array.isArray(data)) ||
        (["menu", "portfolio"].includes(name) && Array.isArray(data));
      if (!valid) {
        sendJson(res, 400, { ok: false, message: "Invalid content payload." });
        return;
      }
      fs.writeFileSync(path.join(dataDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 400, { ok: false, message: "Invalid JSON body." });
    }
    return;
  }

  // ---- Admin upload API (mirrors api/upload.js; saves under public/images/uploads) ----
  if (req.method === "POST" && url.pathname === "/api/upload") {
    if (!authed(req)) {
      sendJson(res, 401, { ok: false, message: "Wrong password." });
      return;
    }
    const type = url.searchParams.get("type") || "";
    const ext = imageTypes[type];
    if (!ext) {
      sendJson(res, 400, { ok: false, message: "Only JPG, PNG, or WebP images are allowed." });
      return;
    }
    try {
      const body = await collectBody(req, maxUploadBytes);
      if (!body.length) {
        sendJson(res, 400, { ok: false, message: "Empty upload." });
        return;
      }
      const base =
        (url.searchParams.get("filename") || "photo")
          .toLowerCase()
          .replace(/\.[a-z0-9]+$/, "")
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "photo";
      const name = `${base}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, name), body);
      sendJson(res, 200, { ok: true, url: `/images/uploads/${name}` });
    } catch (error) {
      sendJson(res, 400, { ok: false, message: "Image must be under 4 MB." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/inquiries") {
    try {
      const payload = JSON.parse((await collectBody(req)).toString("utf8"));
      const inquiry = {
        createdAt: new Date().toISOString(),
        name: String(payload.name || "").trim(),
        phone: String(payload.phone || "").trim(),
        eventDate: String(payload.eventDate || "").trim(),
        pax: String(payload.pax || "").trim(),
        message: String(payload.message || "").trim()
      };

      fs.appendFileSync(path.join(dataDir, "inquiries.jsonl"), `${JSON.stringify(inquiry)}\n`);
      send(res, 201, JSON.stringify({ ok: true }));
    } catch (error) {
      send(res, 400, JSON.stringify({ ok: false, message: "Invalid inquiry" }));
    }
    return;
  }

  if (req.method === "GET") {
    serveFile(res, url.pathname);
    return;
  }

  send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
});

server.listen(port, host, () => {
  console.log(`Catering site running at http://${host}:${port}`);
  console.log(`Admin page at http://${host}:${port}/admin (local password: ${process.env.ADMIN_PASSWORD ? "from ADMIN_PASSWORD" : '"dev"'})`);
});
