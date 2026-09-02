const { put } = require("@vercel/blob");
const { readJsonBody } = require("./_utils.js");

// Public, cookie-free analytics beacon. Stores one small JSON blob per event
// under analytics/<day>/. No IP addresses are stored; the country comes from
// Vercel's geo header and the visitor id is a random value the browser keeps
// in localStorage.
const KINDS = new Set(["view", "whatsapp_click", "inquiry"]);

function clean(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(204).end();
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req, 4_000);
  } catch (error) {
    res.status(204).end();
    return;
  }

  const kind = clean(payload && payload.kind, 20);
  if (!KINDS.has(kind)) {
    res.status(204).end();
    return;
  }

  const userAgent = String(req.headers["user-agent"] || "");
  const now = new Date();
  const record = {
    ts: now.toISOString(),
    kind,
    vid: clean(payload.vid, 32),
    lang: clean(payload.lang, 8),
    ref: clean(payload.ref, 100),
    dev: /Mobi|Android|iPhone|iPad/i.test(userAgent) ? "mobile" : "desktop",
    ctry: clean(req.headers["x-vercel-ip-country"], 8)
  };

  const day = record.ts.slice(0, 10);
  try {
    await put(`analytics/${day}/${Date.now()}.json`, JSON.stringify(record), {
      access: "public",
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: true,
      cacheControlMaxAge: 60
    });
  } catch (error) {
    // Analytics must never break the site; swallow storage errors.
  }
  res.status(204).end();
};
