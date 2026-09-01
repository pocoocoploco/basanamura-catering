# Basanamura Catering

Zero-cost marketing site for a Bataknese and Indonesian catering business. It has:

- Frontend landing page, menu, portfolio, and order inquiry form.
- Bilingual interface (English / Bahasa Indonesia) with a header toggle.
- Built-in CMS at `/admin` — edit content and photos with no redeploy.
- Local Node backend for development and saving test inquiries.
- Local JSON data files that act as the first database.
- Static deployment support for free hosting.
- Social-share metadata (Open Graph / Twitter) and a favicon.

## CMS (edit the site without redeploying)

Open **`/admin`** on the site (production: `https://basanamura-catering.vercel.app/admin`),
enter the admin password, and edit:

- **Business details** — name, taglines (EN/ID), phone, WhatsApp, email, hero photo.
- **Menu** — add/remove/reorder dishes, bilingual text, photo upload per dish.
- **Portfolio** — example events, bilingual text.
- **Appearance** — site colours (main, accent, headings, background, footer),
  cards per row for menu/portfolio, and hero text position, with a
  reset-to-original-design button. Defaults live in `data/theme.json`.

Press **Save** and the live site updates within a minute. No redeploy, no Git.

How it works: saves go to Vercel Blob storage via three serverless functions
(`api/content.js`, `api/save.js`, `api/upload.js`). The public site reads
`/api/content` at runtime and falls back to the JSON files in `data/` if Blob
has nothing yet (so the repo files remain the seed/fallback content).
Uploaded photos are stored on Vercel's CDN with cache-friendly unique URLs.

### One-time production setup (Vercel dashboard)

1. Project → **Storage** → **Create Database** → **Blob** → connect it to the
   project. This adds the `BLOB_READ_WRITE_TOKEN` environment variable.
2. Project → **Settings** → **Environment Variables** → add `ADMIN_PASSWORD`
   (Production) with a strong password of your choice.
3. Redeploy once (Deployments → ⋯ → Redeploy) so the functions pick up both
   variables. Until this is done, `/admin` shows a "CMS not configured" message
   and the site simply serves the bundled JSON content.

### Local development

`npm start`, then open `http://localhost:3000/admin` — the local password is
`dev` (or set `ADMIN_PASSWORD`). Locally, saves write straight to the files in
`data/` and photo uploads land in `public/images/uploads/`.

## Languages (English / Bahasa Indonesia)

The site ships in both English and Bahasa Indonesia. Visitors switch with the
**EN / ID** toggle in the header; the choice is remembered in the browser, and
first-time visitors whose browser is set to Indonesian see Bahasa Indonesia by
default.

Where the text lives:

- **Page chrome** (navigation, headings, buttons, form labels, WhatsApp message
  templates) is in the `ui` dictionary at the top of `public/app.js`.
- **Content** (tagline, menu items, portfolio) is in the JSON data files. Any
  translatable field is an object with `en` and `id` keys, for example:

  ```json
  "description": {
    "en": "Golden carp cooked with andaliman and rich Batak spices.",
    "id": "Ikan mas dimasak dengan andaliman dan bumbu Batak yang kaya."
  }
  ```

  A field that is the same in both languages (a dish's proper name, a phone
  number) can stay a plain string — the site shows it as-is.

## Best Free Local Database Choice

For this first market-test website, use JSON files in `data/`.

Why not Excel first:

- Excel is good for private tracking, but a website still needs conversion logic to read it safely.
- Excel files are easier to accidentally break with formatting, merged cells, or renamed columns.
- JSON works directly in the browser and backend, so deployment stays simple and free.

Best path:

1. Start with `data/site.json`, `data/menu.json`, and `data/portfolio.json`.
2. When orders become frequent, move inquiries and menu management to SQLite.
3. When multiple people need admin access, then consider Supabase free tier.

## Run Locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Edit Your Business Data

- Business name, WhatsApp, Instagram, city: `data/site.json`
- Food list and photos: `data/menu.json`
- Event examples: `data/portfolio.json`
- Local inquiry logs from the backend: `data/inquiries.jsonl`

Use your own food photos as soon as possible. Put image files in `public/images/`, then update the image paths in JSON, for example:

```json
"/images/arsik-family-event.jpg"
```

## Zero-Cost Deployment

Recommended: Vercel free Hobby plan.

Deploy as a static site:

- Framework preset: Other
- Build command: `npm run build`
- Output directory: `dist`

Because this is static on deployment, orders go through WhatsApp. The local backend is only for local testing unless you later choose a hosted backend.

The inquiry log (`data/inquiries.jsonl`) is **deliberately excluded** from the static build so customer names and phone numbers are never published.

Live at `https://basanamura-catering.vercel.app/`. If the domain changes, update `og:url`, `og:image`, `twitter:image`, and the `canonical` link in `public/index.html` to match. For the best link previews on WhatsApp and Instagram, host a real ~1200×630 photo and point the `og:image` / `twitter:image` tags at it (they currently use a Wikimedia placeholder).

Free domain options:

- Vercel gives a free `your-project.vercel.app` domain.
- Netlify gives a free `your-project.netlify.app` domain.
- Render gives free static site hosting with a free platform subdomain.

For a serious brand domain like `.com` or `.id`, you usually need to pay later. Start with the free platform subdomain to test demand.

## Image Credits

Current seeded images use Wikimedia Commons examples and should be replaced by your own photos for real marketing.

- Arsik image by Gunawan Kartapranata, CC BY-SA 4.0.
- Other Indonesian food images are linked from Wikimedia Commons placeholders.
