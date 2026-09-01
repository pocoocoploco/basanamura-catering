const { put, list, del } = require("@vercel/blob");
const { authed, readJsonBody } = require("./_utils.js");

// POST is public (the website's order form); GET and DELETE are admin-only.
// Each inquiry is its own blob under inquiries/ — append-only, no races.
const FIELD_LIMITS = { name: 120, phone: 60, eventDate: 40, pax: 20, message: 2000, lang: 8 };
const MAX_LISTED = 100;

function cleanField(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit);
}

module.exports = async (req, res) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({ ok: false, message: "Storage not configured." });
    return;
  }

  if (req.method === "POST") {
    let payload;
    try {
      payload = await readJsonBody(req, 50_000);
    } catch (error) {
      res.status(400).json({ ok: false, message: "Invalid body." });
      return;
    }
    const inquiry = { createdAt: new Date().toISOString() };
    Object.entries(FIELD_LIMITS).forEach(([field, limit]) => {
      inquiry[field] = cleanField(payload && payload[field], limit);
    });
    if (!inquiry.name && !inquiry.phone) {
      res.status(400).json({ ok: false, message: "Empty inquiry." });
      return;
    }
    await put(`inquiries/${Date.now()}.json`, JSON.stringify(inquiry), {
      access: "public",
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: true,
      cacheControlMaxAge: 60
    });
    res.status(201).json({ ok: true });
    return;
  }

  if (!authed(req)) {
    res.status(401).json({ ok: false, message: "Wrong password." });
    return;
  }

  if (req.method === "GET") {
    const { blobs } = await list({ prefix: "inquiries/" });
    const newest = blobs
      .sort((a, b) => (a.pathname < b.pathname ? 1 : -1))
      .slice(0, MAX_LISTED);
    const inquiries = (
      await Promise.all(
        newest.map(async (blob) => {
          try {
            const response = await fetch(blob.url, { cache: "no-store" });
            if (!response.ok) return null;
            const data = await response.json();
            return { id: blob.pathname, ...data };
          } catch (error) {
            return null;
          }
        })
      )
    ).filter(Boolean);
    res.status(200).json({ ok: true, total: blobs.length, inquiries });
    return;
  }

  if (req.method === "DELETE") {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      res.status(400).json({ ok: false, message: "Invalid body." });
      return;
    }
    const id = String((payload && payload.id) || "");
    if (!/^inquiries\/[A-Za-z0-9._-]+$/.test(id)) {
      res.status(400).json({ ok: false, message: "Invalid id." });
      return;
    }
    const { blobs } = await list({ prefix: "inquiries/" });
    const match = blobs.find((blob) => blob.pathname === id);
    if (!match) {
      res.status(404).json({ ok: false, message: "Not found." });
      return;
    }
    await del(match.url);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, message: "Method not allowed." });
};
