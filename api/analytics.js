const { list } = require("@vercel/blob");
const { authed } = require("./_utils.js");

// Admin-only: aggregates the analytics/<day>/ beacons into dashboard numbers.
const MAX_BLOBS_PER_DAY = 2000;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function aggregate(records, dayKeys) {
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
    const day = String(record.ts || "").slice(0, 10);
    const row = byDay.get(day);
    if (!row) continue;

    if (record.kind === "view") {
      row.views += 1;
      totals.views += 1;
      if (record.vid) {
        uniqueSets.get(day).add(record.vid);
        allVids.add(record.vid);
      }
      if (record.lang) langs[record.lang] = (langs[record.lang] || 0) + 1;
      if (record.dev) devices[record.dev] = (devices[record.dev] || 0) + 1;
      if (record.ctry) countries[record.ctry] = (countries[record.ctry] || 0) + 1;
      const ref = record.ref || "(direct)";
      referrers[ref] = (referrers[ref] || 0) + 1;
    } else if (record.kind === "whatsapp_click") {
      row.waClicks += 1;
      totals.waClicks += 1;
    } else if (record.kind === "inquiry") {
      row.inquiries += 1;
      totals.inquiries += 1;
    }
  }

  perDay.forEach((row) => {
    row.uniques = uniqueSets.get(row.day).size;
  });
  totals.uniques = allVids.size;

  const top = (obj, n) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);

  return {
    totals,
    perDay,
    langs,
    devices,
    countries: top(countries, 6),
    referrers: top(referrers, 6)
  };
}

module.exports = async (req, res) => {
  if (!process.env.ADMIN_PASSWORD || !process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({ ok: false, message: "CMS not configured." });
    return;
  }
  if (!authed(req)) {
    res.status(401).json({ ok: false, message: "Wrong password." });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, message: "Method not allowed." });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  let days = Number(url.searchParams.get("days")) || 7;
  if (![7, 30].includes(days)) days = 7;

  const dayKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    dayKeys.push(dayKey(new Date(Date.now() - i * 86_400_000)));
  }

  const records = [];
  await Promise.all(
    dayKeys.map(async (day) => {
      try {
        const { blobs } = await list({ prefix: `analytics/${day}/`, limit: MAX_BLOBS_PER_DAY });
        await Promise.all(
          blobs.map(async (blob) => {
            try {
              const response = await fetch(blob.url, { cache: "no-store" });
              if (response.ok) records.push(await response.json());
            } catch (error) {
              // Skip unreadable beacon.
            }
          })
        );
      } catch (error) {
        // Skip day on list failure.
      }
    })
  );

  res.status(200).json({
    ok: true,
    days,
    from: dayKeys[0],
    to: dayKeys[dayKeys.length - 1],
    ...aggregate(records, dayKeys)
  });
};
