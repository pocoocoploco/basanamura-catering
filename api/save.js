const { put } = require("@vercel/blob");
const { authed, readJsonBody } = require("./_utils.js");

const NAMES = new Set(["site", "menu", "portfolio"]);
const MAX_CHARS = 300_000;

function validShape(name, data) {
  if (name === "site") {
    return data && typeof data === "object" && !Array.isArray(data);
  }
  return Array.isArray(data);
}

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

  // GET is used by the admin page as a cheap "is my password right?" check.
  if (req.method === "GET") {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, message: "Method not allowed." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    res.status(400).json({ ok: false, message: "Invalid JSON body." });
    return;
  }

  const { name, data } = payload || {};
  if (!NAMES.has(name) || !validShape(name, data)) {
    res.status(400).json({ ok: false, message: "Invalid content payload." });
    return;
  }

  const body = JSON.stringify(data, null, 2);
  if (body.length > MAX_CHARS) {
    res.status(400).json({ ok: false, message: "Content is too large." });
    return;
  }

  await put(`content/${name}.json`, body, {
    access: "public",
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60
  });

  res.status(200).json({ ok: true });
};
