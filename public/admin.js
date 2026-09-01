const KEY_STORE = "adminKey";

const content = { site: {}, menu: [], portfolio: [], theme: {} };

const DEFAULT_THEME = {
  brand: "#d71920",
  accent: "#ffd400",
  deep: "#8f1116",
  paper: "#fffaf0",
  footer: "#3157a4",
  menuColumns: 3,
  portfolioColumns: 3,
  heroAlign: "left"
};

const $ = (selector, scope = document) => scope.querySelector(selector);

function adminKey() {
  return localStorage.getItem(KEY_STORE) || "";
}

function setStatus(el, message, ok, persist) {
  if (!el) return;
  el.textContent = message;
  el.className = `status ${ok ? "ok" : "err"}`;
  if (ok && !persist) setTimeout(() => { if (el.textContent === message) el.textContent = ""; }, 6000);
}

// Save buttons light up ("— unsaved!") whenever their section has changes
// that have not been published yet; the sidebar shows a dot on that view.
const BTN_VIEW = { saveSite: "site", saveMenu: "menu", savePortfolio: "portfolio", saveTheme: "appearance" };

function navItemFor(saveBtn) {
  const view = saveBtn && BTN_VIEW[saveBtn.id];
  return view ? $(`.side-nav button[data-view="${view}"]`) : null;
}

function flagUnsaved(saveBtn) {
  if (!saveBtn) return;
  saveBtn.classList.add("needs-save");
  const navItem = navItemFor(saveBtn);
  if (navItem) navItem.classList.add("has-unsaved");
}

function clearUnsaved(saveBtn) {
  if (!saveBtn) return;
  saveBtn.classList.remove("needs-save");
  const navItem = navItemFor(saveBtn);
  if (navItem) navItem.classList.remove("has-unsaved");
}

// ---- View navigation (left sidebar) ----

const VIEW_TITLES = {
  site: "Business details",
  menu: "Menu",
  portfolio: "Portfolio",
  appearance: "Appearance",
  inquiries: "Inquiries"
};

function setView(view) {
  document.querySelectorAll("section[data-view]").forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  document.querySelectorAll(".side-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  $("#viewTitle").textContent = VIEW_TITLES[view] || "";
  closeDrawer();
  if (view === "inquiries" && !inquiriesLoaded) loadInquiries();
}

function openDrawer() {
  $("#sidebar").classList.add("open");
  $("#backdrop").classList.add("show");
}

function closeDrawer() {
  $("#sidebar").classList.remove("open");
  $("#backdrop").classList.remove("show");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "x-admin-key": adminKey(), ...(options.headers || {}) }
  });
  let body = {};
  try { body = await response.json(); } catch (error) { /* keep {} */ }
  if (!response.ok) {
    const message = body.message || `Request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return body;
}

// ---- Bilingual helpers: values are plain strings or { en, id } objects ----

function biVal(value) {
  if (value && typeof value === "object") return { en: value.en || "", id: value.id || "" };
  return { en: value == null ? "" : String(value), id: "" };
}

function biOut(en, id) {
  en = en.trim();
  id = id.trim();
  if (!id || id === en) return en;
  return { en, id };
}

// ---- Photo upload ----

async function uploadImage(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Only JPG, PNG, or WebP images are allowed.");
  if (file.size > 4_000_000) throw new Error("Image must be under 4 MB.");
  const query = `filename=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type)}`;
  const result = await api(`/api/upload?${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file
  });
  return result.url;
}

function wireUpload(fileInput, statusEl, onDone, saveBtn) {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    setStatus(statusEl, "Uploading photo…", true);
    try {
      const url = await uploadImage(file);
      onDone(url);
      flagUnsaved(saveBtn);
      setStatus(statusEl, "Photo uploaded ✓ — now press Save to publish it.", true, true);
    } catch (error) {
      setStatus(statusEl, error.message, false);
    }
    fileInput.value = "";
  });
}

// ---- Generic bilingual card builder ----

function addField(parent, labelText, value, field, multiline) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement(multiline ? "textarea" : "input");
  input.dataset.f = field;
  input.value = value;
  label.appendChild(input);
  parent.appendChild(label);
}

function addBiFields(card, title, value, field, multiline) {
  const pair = biVal(value);
  const grid = document.createElement("div");
  grid.className = "grid2";
  addField(grid, `${title} (English)`, pair.en, `${field}.en`, multiline);
  addField(grid, `${title} (Indonesian)`, pair.id, `${field}.id`, multiline);
  card.appendChild(grid);
}

function cardHead(card, label, actions) {
  const head = document.createElement("div");
  head.className = "item-head";
  const title = document.createElement("strong");
  title.textContent = label;
  const wrap = document.createElement("div");
  wrap.className = "item-actions";
  for (const [text, handler] of actions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "small ghost";
    btn.textContent = text;
    btn.addEventListener("click", handler);
    wrap.appendChild(btn);
  }
  head.appendChild(title);
  head.appendChild(wrap);
  card.appendChild(head);
}

function readBi(card, field) {
  return biOut($(`[data-f="${field}.en"]`, card).value, $(`[data-f="${field}.id"]`, card).value);
}

// ---- Menu editor ----

function renderMenu() {
  const list = $("#menuList");
  list.innerHTML = "";
  content.menu.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "item-card";
    cardHead(card, `Dish ${index + 1}`, [
      ["↑", () => moveItem("menu", index, -1)],
      ["↓", () => moveItem("menu", index, 1)],
      ["Remove", () => removeItem("menu", index)]
    ]);

    const imgRow = document.createElement("div");
    imgRow.className = "img-row";
    const thumb = document.createElement("img");
    thumb.alt = "";
    thumb.src = item.image || "";
    const controls = document.createElement("div");
    addField(controls, "Photo URL", item.image || "", "image", false);
    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "gold small upload-btn";
    uploadBtn.textContent = "Upload photo";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp";
    uploadBtn.appendChild(fileInput);
    controls.appendChild(uploadBtn);
    imgRow.appendChild(thumb);
    imgRow.appendChild(controls);
    card.appendChild(imgRow);

    wireUpload(fileInput, $("#menuStatus"), (url) => {
      $(`[data-f="image"]`, card).value = url;
      thumb.src = url;
    }, $("#saveMenu"));
    $(`[data-f="image"]`, card).addEventListener("change", (event) => {
      thumb.src = event.target.value;
    });

    addBiFields(card, "Name", item.name, "name", false);
    addBiFields(card, "Category", item.category, "category", false);
    addBiFields(card, "Description", item.description, "description", true);
    addBiFields(card, "Serving info", item.serving, "serving", false);
    list.appendChild(card);
  });
}

function collectMenu() {
  return [...$("#menuList").children].map((card) => ({
    name: readBi(card, "name"),
    category: readBi(card, "category"),
    description: readBi(card, "description"),
    serving: readBi(card, "serving"),
    image: $(`[data-f="image"]`, card).value.trim()
  }));
}

// ---- Portfolio editor ----

function renderPortfolio() {
  const list = $("#portfolioList");
  list.innerHTML = "";
  content.portfolio.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "item-card";
    cardHead(card, `Event ${index + 1}`, [
      ["↑", () => moveItem("portfolio", index, -1)],
      ["↓", () => moveItem("portfolio", index, 1)],
      ["Remove", () => removeItem("portfolio", index)]
    ]);
    addBiFields(card, "Event name", item.event, "event", false);
    addBiFields(card, "Guests (e.g. 120 pax)", item.pax, "pax", false);
    addBiFields(card, "Menu served", item.menu, "menu", true);
    addBiFields(card, "Note", item.note, "note", true);
    list.appendChild(card);
  });
}

function collectPortfolio() {
  return [...$("#portfolioList").children].map((card) => ({
    event: readBi(card, "event"),
    pax: readBi(card, "pax"),
    menu: readBi(card, "menu"),
    note: readBi(card, "note")
  }));
}

function saveBtnFor(name) {
  return $(name === "menu" ? "#saveMenu" : "#savePortfolio");
}

function moveItem(name, index, delta) {
  const items = name === "menu" ? collectMenu() : collectPortfolio();
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  content[name] = items;
  (name === "menu" ? renderMenu : renderPortfolio)();
  flagUnsaved(saveBtnFor(name));
}

function removeItem(name, index) {
  const items = name === "menu" ? collectMenu() : collectPortfolio();
  items.splice(index, 1);
  content[name] = items;
  (name === "menu" ? renderMenu : renderPortfolio)();
  flagUnsaved(saveBtnFor(name));
}

// ---- Site form ----

const siteFields = ["businessName", "city", "phoneDisplay", "whatsappNumber", "email", "instagram", "heroImage"];

function fillSite() {
  const site = content.site;
  siteFields.forEach((field) => {
    $(`#site-${field}`).value = site[field] == null ? "" : site[field];
  });
  $("#site-minimumPax").value = site.minimumPax == null ? "" : site.minimumPax;
  $("#site-maxPax").value = site.maxPax == null ? "" : site.maxPax;
  const tagline = biVal(site.tagline);
  $("#site-tagline-en").value = tagline.en;
  $("#site-tagline-id").value = tagline.id;
  $("#heroPreview").src = site.heroImage || "";
}

function collectSite() {
  const site = { ...content.site };
  siteFields.forEach((field) => {
    site[field] = $(`#site-${field}`).value.trim();
  });
  site.minimumPax = Number($("#site-minimumPax").value) || content.site.minimumPax || 1;
  site.maxPax = Number($("#site-maxPax").value) || content.site.maxPax || 1;
  site.tagline = biOut($("#site-tagline-en").value, $("#site-tagline-id").value);
  return site;
}

// ---- Appearance form ----

const THEME_COLOR_FIELDS = ["brand", "accent", "deep", "paper", "footer"];

function fillTheme(theme) {
  const merged = { ...DEFAULT_THEME, ...(theme || {}) };
  THEME_COLOR_FIELDS.forEach((field) => {
    const value = /^#[0-9a-fA-F]{6}$/.test(String(merged[field])) ? merged[field] : DEFAULT_THEME[field];
    $(`#theme-${field}`).value = value;
  });
  $("#theme-heroAlign").value = merged.heroAlign === "center" ? "center" : "left";
  $("#theme-menuColumns").value = String([2, 3, 4].includes(Number(merged.menuColumns)) ? merged.menuColumns : 3);
  $("#theme-portfolioColumns").value = String([2, 3].includes(Number(merged.portfolioColumns)) ? merged.portfolioColumns : 3);
}

function collectTheme() {
  const theme = {};
  THEME_COLOR_FIELDS.forEach((field) => {
    theme[field] = $(`#theme-${field}`).value;
  });
  theme.heroAlign = $("#theme-heroAlign").value;
  theme.menuColumns = Number($("#theme-menuColumns").value);
  theme.portfolioColumns = Number($("#theme-portfolioColumns").value);
  return theme;
}

// ---- Inquiries (read-only list of submitted order forms) ----

let inquiriesLoaded = false;

function formatWhen(iso) {
  const date = new Date(iso);
  if (isNaN(date)) return String(iso || "");
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function waLinkFor(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  // Indonesian local numbers (08…) become international (628…).
  if (digits.charAt(0) === "0") digits = "62" + digits.slice(1);
  return `https://wa.me/${digits}`;
}

// All inquiry values are customer-submitted: only ever rendered via
// textContent, never innerHTML.
function renderInquiries(items) {
  const listEl = $("#inquiriesList");
  listEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No inquiries yet. New submissions from the website form will appear here.";
    listEl.appendChild(empty);
    return;
  }

  const scroll = document.createElement("div");
  scroll.className = "inq-scroll";
  const table = document.createElement("table");
  table.className = "inq-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Submitted", "Name", "Phone", "Event date", "Pax", "Message", ""].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  items.forEach((item) => {
    const row = document.createElement("tr");
    const cell = (className) => {
      const td = document.createElement("td");
      if (className) td.className = className;
      row.appendChild(td);
      return td;
    };

    const whenCell = cell("inq-when");
    whenCell.textContent = formatWhen(item.createdAt);
    if (item.lang === "id" || item.lang === "en") {
      const tag = document.createElement("span");
      tag.className = "lang-tag";
      tag.textContent = item.lang.toUpperCase();
      whenCell.appendChild(tag);
    }

    cell().textContent = item.name || "—";

    const phoneCell = cell();
    const waLink = waLinkFor(item.phone);
    if (item.phone && waLink) {
      const link = document.createElement("a");
      link.href = waLink;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = item.phone;
      phoneCell.appendChild(link);
    } else {
      phoneCell.textContent = item.phone || "—";
    }

    cell().textContent = item.eventDate || "—";
    cell().textContent = item.pax || "—";
    cell("inq-msg").textContent = item.message || "—";

    const actionCell = cell();
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small ghost";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!window.confirm("Delete this inquiry permanently?")) return;
      remove.disabled = true;
      try {
        await api("/api/inquiries", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id })
        });
        row.remove();
        if (!tbody.children.length) renderInquiries([]);
      } catch (error) {
        remove.disabled = false;
        setStatus($("#inquiriesStatus"), error.message, false);
      }
    });
    actionCell.appendChild(remove);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  listEl.appendChild(scroll);
}

async function loadInquiries() {
  const status = $("#inquiriesStatus");
  setStatus(status, "Loading…", true);
  try {
    const result = await api("/api/inquiries");
    const inquiries = result.inquiries || [];
    renderInquiries(inquiries);
    setStatus(status, inquiries.length === 1 ? "1 inquiry." : `${inquiries.length} inquiries.`, true, true);
    inquiriesLoaded = true;
  } catch (error) {
    setStatus(status, error.message, false);
    if (error.status === 401) showLocked("Session expired — enter the password again.");
  }
}

// ---- Save ----

async function save(name, data, statusEl, saveBtn) {
  try {
    await api("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data })
    });
    content[name] = data;
    clearUnsaved(saveBtn);
    setStatus(statusEl, "Saved ✓ — the live site updates within a minute.", true);
  } catch (error) {
    setStatus(statusEl, error.message, false);
    if (error.status === 401) showLocked("Session expired — enter the password again.");
  }
}

// ---- Lock / unlock ----

function showUnlocked() {
  const login = $("#loginView");
  const shell = $("#appShell");
  if (login) login.hidden = true;
  if (shell) shell.hidden = false;
}

function showLocked(message) {
  const login = $("#loginView");
  const shell = $("#appShell");
  if (shell) shell.hidden = true;
  if (login) login.hidden = false;
  if (message) setStatus($("#lockStatus"), message, false);
}

async function tryUnlock() {
  const status = $("#lockStatus");
  setStatus(status, "Checking…", true);
  try {
    await api("/api/save"); // GET = password check
    showUnlocked();
  } catch (error) {
    localStorage.removeItem(KEY_STORE);
    showLocked(error.message);
  }
}

// ---- Boot ----

// Never throws: a failed source falls back to the bundled JSON, and a failed
// fallback still leaves usable defaults so the portal keeps working.
async function loadContent() {
  let remote = {};
  try {
    const response = await fetch("/api/content", { cache: "no-store" });
    if (response.ok) remote = await response.json();
  } catch (error) { /* fall back below */ }

  const orFallback = async (value, path, defaultValue) => {
    if (value) return value;
    try {
      const response = await fetch(path);
      if (response.ok) return await response.json();
    } catch (error) { /* use default */ }
    return defaultValue;
  };
  content.site = await orFallback(remote.site, "/data/site.json", {});
  content.menu = await orFallback(remote.menu, "/data/menu.json", []);
  content.portfolio = await orFallback(remote.portfolio, "/data/portfolio.json", []);
  content.theme = await orFallback(remote.theme, "/data/theme.json", {});
}

const EDIT_BUTTONS = ["#saveSite", "#saveMenu", "#savePortfolio", "#addMenu", "#addPortfolio", "#saveTheme", "#resetTheme"];

function setEditingEnabled(enabled) {
  EDIT_BUTTONS.forEach((selector) => {
    const button = $(selector);
    if (button) button.disabled = !enabled;
  });
}

// Attach a listener only if the element exists, so one stale cached file can
// never leave the whole page dead.
function on(selector, eventName, handler) {
  const element = $(selector);
  if (element) element.addEventListener(eventName, handler);
}

// All wiring is synchronous — no network request happens before the controls
// respond.
function wireUi() {
  on("#unlockBtn", "click", () => {
    const value = $("#passwordInput").value;
    if (!value) {
      setStatus($("#lockStatus"), "Please enter the password first.", false);
      return;
    }
    localStorage.setItem(KEY_STORE, value);
    tryUnlock();
  });
  on("#passwordInput", "keydown", (event) => {
    if (event.key === "Enter") $("#unlockBtn").click();
  });
  on("#lockBtn", "click", () => {
    localStorage.removeItem(KEY_STORE);
    $("#passwordInput").value = "";
    showLocked();
    setStatus($("#lockStatus"), "Signed out.", true, true);
  });

  document.querySelectorAll(".side-nav button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  on("#menuToggle", "click", openDrawer);
  on("#backdrop", "click", closeDrawer);

  on("#saveSite", "click", () => save("site", collectSite(), $("#siteStatus"), $("#saveSite")));
  on("#saveMenu", "click", () => {
    const menu = collectMenu();
    const missing = menu.findIndex((item) => !biVal(item.name).en);
    if (missing !== -1) {
      setStatus($("#menuStatus"), `Dish ${missing + 1} needs a name.`, false);
      return;
    }
    save("menu", menu, $("#menuStatus"), $("#saveMenu"));
  });
  on("#savePortfolio", "click", () => save("portfolio", collectPortfolio(), $("#portfolioStatus"), $("#savePortfolio")));

  on("#addMenu", "click", () => {
    content.menu = collectMenu();
    content.menu.push({ name: "", category: "", description: "", serving: "", image: "" });
    renderMenu();
    flagUnsaved($("#saveMenu"));
  });
  on("#addPortfolio", "click", () => {
    content.portfolio = collectPortfolio();
    content.portfolio.push({ event: "", pax: "", menu: "", note: "" });
    renderPortfolio();
    flagUnsaved($("#savePortfolio"));
  });

  on("#refreshInquiries", "click", loadInquiries);

  on("#saveTheme", "click", () => save("theme", collectTheme(), $("#themeStatus"), $("#saveTheme")));
  on("#resetTheme", "click", () => {
    fillTheme(DEFAULT_THEME);
    flagUnsaved($("#saveTheme"));
    setStatus($("#themeStatus"), "Original design restored — press Save appearance to publish it.", true, true);
  });

  // Any typing inside a section lights up that section's Save button.
  on("#sectionSite", "input", () => flagUnsaved($("#saveSite")));
  on("#sectionMenu", "input", () => flagUnsaved($("#saveMenu")));
  on("#sectionPortfolio", "input", () => flagUnsaved($("#savePortfolio")));
  on("#sectionTheme", "input", () => flagUnsaved($("#saveTheme")));
  on("#sectionTheme", "change", () => flagUnsaved($("#saveTheme")));

  const heroUpload = $("#heroUpload");
  if (heroUpload) {
    wireUpload(heroUpload, $("#siteStatus"), (url) => {
      $("#site-heroImage").value = url;
      $("#heroPreview").src = url;
    }, $("#saveSite"));
  }
  on("#site-heroImage", "change", (event) => {
    $("#heroPreview").src = event.target.value;
  });

  // Surface any unexpected script error on the login card instead of failing
  // silently, and tell the load watchdog in admin.html that we are alive.
  window.addEventListener("error", (event) => {
    setStatus($("#lockStatus"), `Something went wrong: ${event.message || "script error"}. Refresh the page.`, false);
  });
  window.__adminReady = true;
}

async function init() {
  // Controls first: the Sign in button must respond instantly, even while
  // content is still loading from the server.
  wireUi();
  setEditingEnabled(false);

  // Returning session: show the portal immediately (no login flash); the key
  // is still verified against the server and we drop back to the login screen
  // if it no longer works.
  if (adminKey()) {
    showUnlocked();
    tryUnlock();
  }

  // Editing buttons stay disabled until this completes, so an early Save can
  // never publish an empty page.
  await loadContent();
  fillSite();
  renderMenu();
  renderPortfolio();
  fillTheme(content.theme);
  setEditingEnabled(true);
}

init();
