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

  // ---- Analytics (mirrors api/track.js + api/analytics.js; local .jsonl) ----
  const analyticsFile = path.join(dataDir, "analytics.jsonl");

  if (req.method === "POST" && url.pathname === "/api/track") {
    try {
      const payload = JSON.parse((await collectBody(req, 4000)).toString("utf8"));
      const kinds = ["view", "whatsapp_click", "inquiry"];
      if (!kinds.includes(payload.kind)) {
        res.writeHead(204).end();
        return;
      }
      const ua = String(req.headers["user-agent"] || "");
      const record = {
        ts: new Date().toISOString(),
        kind: payload.kind,
        vid: String(payload.vid || "").slice(0, 32),
        lang: String(payload.lang || "").slice(0, 8),
        ref: String(payload.ref || "").slice(0, 100),
        dev: /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
        ctry: "ID"
      };
      fs.appendFileSync(analyticsFile, `${JSON.stringify(record)}\n`);
    } catch (error) {
      // Analytics must never break the site.
    }
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/analytics") {
    if (!authed(req)) {
      sendJson(res, 401, { ok: false, message: "Wrong password." });
      return;
    }
    let days = Number(url.searchParams.get("days")) || 7;
    if (![7, 30].includes(days)) days = 7;
    const dayKeys = [];
    for (let i = days - 1; i >= 0; i--) {
      dayKeys.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }
    const records = fs.existsSync(analyticsFile)
      ? fs.readFileSync(analyticsFile, "utf8").split("\n").filter(Boolean).map((line) => {
          try { return JSON.parse(line); } catch (error) { return null; }
        }).filter(Boolean)
      : [];

    const perDay = dayKeys.map((day) => ({ day, views: 0, uniques: 0, waClicks: 0, inquiries: 0 }));
    const byDay = new Map(perDay.map((row) => [row.day, row]));
    const uniqueSets = new Map(dayKeys.map((day) => [day, new Set()]));
    const allVids = new Set();
    const langs = {};
    const devices = {};
    const countries = {};
    const referrers = {};
    const totals = { views: 0, uniques: 0, waClicks: 0, inquiries: 0 };
    for (const record of records) {
      const row = byDay.get(String(record.ts || "").slice(0, 10));
      if (!row) continue;
      if (record.kind === "view") {
        row.views += 1;
        totals.views += 1;
        if (record.vid) { uniqueSets.get(row.day).add(record.vid); allVids.add(record.vid); }
        if (record.lang) langs[record.lang] = (langs[record.lang] || 0) + 1;
        if (record.dev) devices[record.dev] = (devices[record.dev] || 0) + 1;
        if (record.ctry) countries[record.ctry] = (countries[record.ctry] || 0) + 1;
        const ref = record.ref || "(direct)";
        referrers[ref] = (referrers[ref] || 0) + 1;
      } else if (record.kind === "whatsapp_click") { row.waClicks += 1; totals.waClicks += 1; }
      else if (record.kind === "inquiry") { row.inquiries += 1; totals.inquiries += 1; }
    }
    perDay.forEach((row) => { row.uniques = uniqueSets.get(row.day).size; });
    totals.uniques = allVids.size;
    const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
    sendJson(res, 200, {
      ok: true, days, from: dayKeys[0], to: dayKeys[dayKeys.length - 1],
      totals, perDay, langs, devices, countries: top(countries, 6), referrers: top(referrers, 6)
    });
    return;
  }

  // ---- Inquiries (mirrors api/inquiries.js; local storage is a .jsonl file) ----
  if (url.pathname === "/api/inquiries") {
    const inquiriesFile = path.join(dataDir, "inquiries.jsonl");
    const readInquiries = () => {
      if (!fs.existsSync(inquiriesFile)) return [];
      return fs
        .readFileSync(inquiriesFile, "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean);
    };

    if (req.method === "POST") {
      try {
        const payload = JSON.parse((await collectBody(req)).toString("utf8"));
        const inquiry = {
          createdAt: new Date().toISOString(),
          name: String(payload.name || "").trim().slice(0, 120),
          phone: String(payload.phone || "").trim().slice(0, 60),
          eventDate: String(payload.eventDate || "").trim().slice(0, 40),
          pax: String(payload.pax || "").trim().slice(0, 20),
          message: String(payload.message || "").trim().slice(0, 2000),
          lang: String(payload.lang || "").trim().slice(0, 8)
        };
        if (!inquiry.name && !inquiry.phone) {
          sendJson(res, 400, { ok: false, message: "Empty inquiry." });
          return;
        }
        fs.appendFileSync(inquiriesFile, `${JSON.stringify(inquiry)}\n`);
        sendJson(res, 201, { ok: true });
      } catch (error) {
        sendJson(res, 400, { ok: false, message: "Invalid inquiry" });
      }
      return;
    }

    if (!authed(req)) {
      sendJson(res, 401, { ok: false, message: "Wrong password." });
      return;
    }

    if (req.method === "GET") {
      const inquiries = readInquiries()
        .map((item) => ({ id: item.createdAt, ...item }))
        .reverse();
      sendJson(res, 200, { ok: true, total: inquiries.length, inquiries });
      return;
    }

    if (req.method === "DELETE") {
      try {
        const { id } = JSON.parse((await collectBody(req)).toString("utf8"));
        const kept = readInquiries().filter((item) => item.createdAt !== id);
        fs.writeFileSync(inquiriesFile, kept.map((item) => JSON.stringify(item)).join("\n") + (kept.length ? "\n" : ""));
        sendJson(res, 200, { ok: true });
      } catch (error) {
        sendJson(res, 400, { ok: false, message: "Invalid body." });
      }
      return;
    }

    sendJson(res, 405, { ok: false, message: "Method not allowed." });
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
