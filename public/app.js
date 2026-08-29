const dataFallbacks = {
  site: "/data/site.json",
  menu: "/data/menu.json",
  portfolio: "/data/portfolio.json"
};

const SUPPORTED_LANGS = ["en", "id"];

// UI chrome strings. Content (menu, portfolio, tagline) is translated in the JSON data files.
const ui = {
  en: {
    nav_menu: "Menu",
    nav_portfolio: "Portfolio",
    nav_order: "Order",
    hero_eyebrow: "Bataknese and Indonesian catering",
    hero_order_btn: "Order via WhatsApp",
    hero_menu_btn: "View menu",
    stats_pax: "pax capacity",
    stats_batak_label: "Batak",
    stats_batak_sub: "Arsik, Tombur, Naniura",
    stats_custom_label: "Custom",
    stats_custom_sub: "Indonesian menu requests",
    menu_eyebrow: "Menu",
    menu_title: "Food people remember after the event ends",
    why_eyebrow: "Why customers call",
    why_title: "Made for Bataknese families, flexible for every Indonesian event",
    why_p1: "Specialty Bataknese dishes for family gatherings, weddings, arisan, church/community events, and office meals.",
    why_p2: "Orders can scale from small family trays to large service up to {maxPax} pax.",
    why_p3: "Tell us your date, headcount, and budget — we tailor the menu to your event.",
    portfolio_eyebrow: "Portfolio",
    portfolio_title: "Recent catering scenarios",
    order_eyebrow: "Order inquiry",
    order_title: "Send your date, pax, and menu idea",
    order_desc: "Fastest route: WhatsApp. Send us your event details and we will reply with options and a quote.",
    contact_whatsapp: "WhatsApp",
    contact_instagram: "Instagram",
    contact_email: "Email",
    form_name: "Name",
    form_phone: "Phone / WhatsApp",
    form_eventdate: "Event date",
    form_pax: "Pax",
    form_message: "Message",
    form_message_ph: "Example: I need Arsik and Indonesian buffet for 150 pax in Jakarta.",
    form_submit: "Send inquiry",
    status_preparing: "Preparing your message...",
    status_opening: "Opening WhatsApp with your inquiry.",
    wa_generic: "Hello Basanamura Catering, I want to ask about catering. Event date: ____. Pax: ____. Menu idea: ____.",
    wa_intro: "Hello Basanamura Catering, I want to ask about catering.",
    wa_name: "Name",
    wa_phone: "Phone",
    wa_eventdate: "Event date",
    wa_pax: "Pax",
    wa_message: "Message",
    lang_label: "Language"
  },
  id: {
    nav_menu: "Menu",
    nav_portfolio: "Portofolio",
    nav_order: "Pesan",
    hero_eyebrow: "Katering Batak dan Indonesia",
    hero_order_btn: "Pesan via WhatsApp",
    hero_menu_btn: "Lihat menu",
    stats_pax: "kapasitas orang",
    stats_batak_label: "Batak",
    stats_batak_sub: "Arsik, Tombur, Naniura",
    stats_custom_label: "Khusus",
    stats_custom_sub: "Permintaan menu Indonesia",
    menu_eyebrow: "Menu",
    menu_title: "Masakan yang dikenang setelah acara usai",
    why_eyebrow: "Mengapa pelanggan memilih kami",
    why_title: "Dibuat untuk keluarga Batak, fleksibel untuk setiap acara Indonesia",
    why_p1: "Hidangan khas Batak untuk acara keluarga, pernikahan, arisan, acara gereja/komunitas, dan makan siang kantor.",
    why_p2: "Pesanan bisa mulai dari nampan keluarga kecil hingga pelayanan besar sampai {maxPax} orang.",
    why_p3: "Beri tahu kami tanggal, jumlah tamu, dan anggaran Anda — kami sesuaikan menu dengan acara Anda.",
    portfolio_eyebrow: "Portofolio",
    portfolio_title: "Contoh acara katering",
    order_eyebrow: "Permintaan pesanan",
    order_title: "Kirim tanggal, jumlah orang, dan ide menu Anda",
    order_desc: "Cara tercepat: WhatsApp. Kirimkan detail acara Anda dan kami akan membalas dengan pilihan menu dan penawaran harga.",
    contact_whatsapp: "WhatsApp",
    contact_instagram: "Instagram",
    contact_email: "Email",
    form_name: "Nama",
    form_phone: "Telepon / WhatsApp",
    form_eventdate: "Tanggal acara",
    form_pax: "Jumlah orang",
    form_message: "Pesan",
    form_message_ph: "Contoh: Saya butuh Arsik dan prasmanan Indonesia untuk 150 orang di Jakarta.",
    form_submit: "Kirim permintaan",
    status_preparing: "Menyiapkan pesan Anda...",
    status_opening: "Membuka WhatsApp dengan permintaan Anda.",
    wa_generic: "Halo Basanamura Catering, saya ingin bertanya tentang katering. Tanggal acara: ____. Jumlah orang: ____. Ide menu: ____.",
    wa_intro: "Halo Basanamura Catering, saya ingin bertanya tentang katering.",
    wa_name: "Nama",
    wa_phone: "Telepon",
    wa_eventdate: "Tanggal acara",
    wa_pax: "Jumlah orang",
    wa_message: "Pesan",
    lang_label: "Bahasa"
  }
};

let currentLang = "en";
let siteData = {};
let menuData = [];
let portfolioData = [];

function detectLang() {
  const saved = localStorage.getItem("lang");
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  const browser = (navigator.language || "en").toLowerCase();
  return browser.startsWith("id") ? "id" : "en";
}

// Returns the value for the current language. Plain strings pass through unchanged;
// { en, id } objects resolve to the active language (falling back to English).
function pick(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[currentLang] ?? value.en ?? Object.values(value)[0] ?? "";
  }
  return value;
}

function t(key) {
  const value = ui[currentLang][key] ?? ui.en[key] ?? "";
  return value.replace(/\{(\w+)\}/g, (_, name) => (siteData[name] !== undefined ? siteData[name] : `{${name}}`));
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

// Live content comes from /api/content (Blob storage in production, local JSON
// in development). Any key it cannot provide falls back to the JSON files
// bundled with the site, so the page always renders.
async function loadContent() {
  let remote = {};
  try {
    const response = await fetch("/api/content", { cache: "no-store" });
    if (response.ok) remote = await response.json();
  } catch (error) {
    // Static fallback below.
  }

  const orFallback = (value, fallbackPath) =>
    value ? Promise.resolve(value) : fetchJson(fallbackPath);

  return Promise.all([
    orFallback(remote.site, dataFallbacks.site),
    orFallback(remote.menu, dataFallbacks.menu),
    orFallback(remote.portfolio, dataFallbacks.portfolio)
  ]);
}

function whatsappUrl(message) {
  return `https://wa.me/${siteData.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
}

function setSiteText(site) {
  document.querySelectorAll("[data-site]").forEach((element) => {
    const value = pick(site[element.dataset.site]);
    if (value !== undefined && value !== "") element.textContent = value;
  });

  document.querySelectorAll("[data-site-img]").forEach((element) => {
    const url = site[element.dataset.siteImg];
    // Only assign when the URL actually changes, so toggling language never
    // forces the (external) image to re-download and flash blank.
    if (url && element.getAttribute("src") !== url) element.src = url;
  });

  document.querySelectorAll("[data-site-link]").forEach((element) => {
    if (site[element.dataset.siteLink]) element.href = site[element.dataset.siteLink];
  });

  const generic = whatsappUrl(t("wa_generic"));
  document.querySelectorAll("[data-whatsapp-link]").forEach((element) => {
    element.href = generic;
  });

  document.querySelectorAll("[data-email-link]").forEach((element) => {
    element.href = `mailto:${site.email}`;
  });
}

// Build the card shells once (images load a single time), then update only the
// text on each render so a language switch never recreates the DOM or reloads
// images — which would lose scroll-reveal state and flash the photos blank.
function renderMenu(items) {
  const grid = document.querySelector("#menuGrid");
  if (grid.children.length !== items.length) {
    grid.innerHTML = items
      .map(
        (item, index) => `
        <article class="menu-card" style="--reveal-delay: ${index * 80}ms">
          <img alt="" loading="lazy">
          <div class="menu-card-body">
            <span class="category" data-field="category"></span>
            <h3 data-field="name"></h3>
            <p data-field="description"></p>
            <div class="serving" data-field="serving"></div>
          </div>
        </article>
      `
      )
      .join("");
    grid.querySelectorAll(".menu-card img").forEach((img, i) => {
      img.src = pick(items[i].image);
    });
  }

  grid.querySelectorAll(".menu-card").forEach((card, i) => {
    const item = items[i];
    card.querySelector("img").alt = pick(item.name);
    card.querySelectorAll("[data-field]").forEach((node) => {
      node.textContent = pick(item[node.dataset.field]);
    });
  });
}

function renderPortfolio(items) {
  const grid = document.querySelector("#portfolioGrid");
  if (grid.children.length !== items.length) {
    grid.innerHTML = items
      .map(
        (item, index) => `
        <article class="portfolio-card" style="--reveal-delay: ${index * 90}ms">
          <h3 data-field="event"></h3>
          <strong data-field="pax"></strong>
          <p data-field="menu"></p>
          <p data-field="note"></p>
        </article>
      `
      )
      .join("");
  }

  grid.querySelectorAll(".portfolio-card").forEach((card, i) => {
    const item = items[i];
    card.querySelectorAll("[data-field]").forEach((node) => {
      node.textContent = pick(item[node.dataset.field]);
    });
  });
}

function updateLangSwitch() {
  document.querySelectorAll("[data-set-lang]").forEach((button) => {
    const active = button.dataset.setLang === currentLang;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = "en";
  currentLang = lang;
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang;
  applyI18n();
  setSiteText(siteData);
  renderMenu(menuData);
  renderPortfolio(portfolioData);
  updateLangSwitch();
}

function setupLangSwitch() {
  document.querySelectorAll("[data-set-lang]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.setLang));
  });
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setupForm() {
  const form = document.querySelector("#inquiryForm");
  const status = document.querySelector("#formStatus");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formToObject(form);
    status.textContent = t("status_preparing");

    const message = [
      t("wa_intro"),
      `${t("wa_name")}: ${data.name}`,
      `${t("wa_phone")}: ${data.phone}`,
      `${t("wa_eventdate")}: ${data.eventDate || "-"}`,
      `${t("wa_pax")}: ${data.pax || "-"}`,
      `${t("wa_message")}: ${data.message || "-"}`
    ].join("\n");

    fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).catch(() => {});

    status.textContent = t("status_opening");
    window.location.href = whatsappUrl(message);
  });
}

function setupScrollExperience() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  const revealItems = [
    ...document.querySelectorAll(
      ".reveal-section, .reveal-group > *, .menu-card, .portfolio-card, .order-copy, .inquiry-form"
    )
  ];

  if (reduceMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    document.documentElement.style.setProperty("--scroll-progress", "1");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.16
    }
  );

  revealItems.forEach((item) => observer.observe(item));

  function updateScrollMotion() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(scrollTop / scrollable, 1) : 0;
    const heroHeight = hero ? hero.offsetHeight : 1;
    const heroProgress = Math.min(scrollTop / heroHeight, 1);

    document.documentElement.style.setProperty("--scroll-progress", progress.toFixed(4));
    document.documentElement.style.setProperty("--hero-parallax", (heroProgress * 72).toFixed(2));
    document.documentElement.style.setProperty("--hero-content-shift", (heroProgress * -26).toFixed(2));
    document.documentElement.style.setProperty("--hero-content-opacity", String(Math.max(1 - heroProgress * 1.35, 0)));
    header.classList.toggle("is-scrolled", scrollTop > 24);
  }

  updateScrollMotion();
  window.addEventListener("scroll", updateScrollMotion, { passive: true });
  window.addEventListener("resize", updateScrollMotion);
}

async function init() {
  currentLang = detectLang();
  document.documentElement.lang = currentLang;

  [siteData, menuData, portfolioData] = await loadContent();

  document.title = siteData.businessName;
  document.querySelector("#year").textContent = new Date().getFullYear();

  setupLangSwitch();
  setupForm();
  setLanguage(currentLang);
  setupScrollExperience();
}

init();
