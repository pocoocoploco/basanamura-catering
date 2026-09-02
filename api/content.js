const { list } = require("@vercel/blob");
const { blobStoreHost } = require("./_utils.js");

// Public read endpoint: returns { site, menu, portfolio, theme } from Blob
// storage. Any key that has never been saved via the admin comes back null and
// the frontend falls back to the JSON files bundled with the site.
//
// Reads go straight to the store's CDN host (derived from the token) — free
// data transfer instead of a metered list() operation per page view. list()
// remains only as a fallback if the direct host ever stops resolving.
const KEYS = ["site", "menu", "portfolio", "theme", "gallery"];

async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const out = { site: null, menu: null, portfolio: null, theme: null, gallery: null };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(200).json(out);
    return;
  }

  const host = blobStoreHost();
  if (host) {
    await Promise.all(
      KEYS.map(async (name) => {
        out[name] = await fetchJson(`https://${host}/content/${name}.json`);
      })
    );
  }

  // Fallback: if nothing resolved via the direct host (wrong host or token
  // format change), locate the blobs the old way.
  if (KEYS.every((name) => out[name] === null)) {
    try {
      const { blobs } = await list({ prefix: "content/" });
      await Promise.all(
        KEYS.map(async (name) => {
          const blob = blobs.find((b) => b.pathname === `content/${name}.json`);
          if (blob) out[name] = await fetchJson(blob.url);
        })
      );
    } catch (error) {
      // Serve nulls; the frontend uses its bundled fallback data.
    }
  }

  res.status(200).json(out);
};
