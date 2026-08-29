const crypto = require("crypto");

// Constant-time comparison of the admin key header against ADMIN_PASSWORD.
function authed(req) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const given = String(req.headers["x-admin-key"] || "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Vercel parses JSON bodies for us; fall back to reading the stream so the
// same handlers also work behind any runtime that does not pre-parse.
async function readRawBody(req, maxBytes) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("body-too-large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req, maxBytes = 400_000) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw =
    typeof req.body === "string"
      ? Buffer.from(req.body, "utf8")
      : await readRawBody(req, maxBytes);
  return JSON.parse(raw.toString("utf8"));
}

module.exports = { authed, readRawBody, readJsonBody };
