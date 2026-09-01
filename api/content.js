const { list } = require("@vercel/blob");

// Public read endpoint: returns { site, menu, portfolio } from Blob storage.
// Any key that has never been saved via the admin comes back null and the
// frontend falls back to the JSON files bundled with the site.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const out = { site: null, menu: null, portfolio: null, theme: null };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(200).json(out);
    return;
  }

  try {
    const { blobs } = await list({ prefix: "content/" });
    await Promise.all(
      Object.keys(out).map(async (name) => {
        const blob = blobs.find((b) => b.pathname === `content/${name}.json`);
        if (!blob) return;
        const response = await fetch(blob.url, { cache: "no-store" });
        if (response.ok) out[name] = await response.json();
      })
    );
  } catch (error) {
    // Serve nulls; the frontend uses its bundled fallback data.
  }

  res.status(200).json(out);
};
