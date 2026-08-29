const { put } = require("@vercel/blob");
const { authed, readRawBody } = require("./_utils.js");

// Real mime type travels in the ?type= query param; the admin page sends the
// body as application/octet-stream so no runtime tries to parse it.
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4_000_000;

module.exports = async (req, res) => {
  if (!process.env.ADMIN_PASSWORD || !process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({
      ok: false,
      message:
        "CMS not configured. In Vercel: create a Blob store (Storage tab) and set the ADMIN_PASSWORD environment variable, then redeploy."
    });
    return;
  }

  if (!authed(req)) {
    res.status(401).json({ ok: false, message: "Wrong password." });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed." });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const type = url.searchParams.get("type") || "";
  const ext = TYPES[type];
  if (!ext) {
    res.status(400).json({ ok: false, message: "Only JPG, PNG, or WebP images are allowed." });
    return;
  }

  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BYTES) {
    res.status(400).json({ ok: false, message: "Image must be under 4 MB." });
    return;
  }

  let body;
  try {
    body = await readRawBody(req, MAX_BYTES);
  } catch (error) {
    res.status(400).json({ ok: false, message: "Image must be under 4 MB." });
    return;
  }
  if (!body.length) {
    res.status(400).json({ ok: false, message: "Empty upload." });
    return;
  }

  const base =
    (url.searchParams.get("filename") || "photo")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "photo";

  const blob = await put(`images/${base}.${ext}`, body, {
    access: "public",
    contentType: type,
    addRandomSuffix: true,
    cacheControlMaxAge: 31536000
  });

  res.status(200).json({ ok: true, url: blob.url });
};
