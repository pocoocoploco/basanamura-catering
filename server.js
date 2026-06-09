const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = __dirname;
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const port = process.env.PORT || 3000;
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function readJson(fileName) {
  return fs.readFileSync(path.join(dataDir, fileName), "utf8");
}

function serveFile(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
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

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

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

  if (req.method === "POST" && url.pathname === "/api/inquiries") {
    try {
      const payload = JSON.parse(await collectBody(req));
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
});
