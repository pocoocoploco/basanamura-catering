const KEY_STORE = "adminKey";

const content = { site: {}, menu: [], portfolio: [] };

const $ = (selector, scope = document) => scope.querySelector(selector);

function adminKey() {
  return localStorage.getItem(KEY_STORE) || "";
}

function setStatus(el, message, ok) {
  el.textContent = message;
  el.className = `status ${ok ? "ok" : "err"}`;
  if (ok) setTimeout(() => { if (el.textContent === message) el.textContent = ""; }, 6000);
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

function wireUpload(fileInput, statusEl, onDone) {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    setStatus(statusEl, "Uploading photo…", true);
    try {
      const url = await uploadImage(file);
      onDone(url);
      setStatus(statusEl, "Photo uploaded. Remember to press Save.", true);
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
    });
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

function moveItem(name, index, delta) {
  const items = name === "menu" ? collectMenu() : collectPortfolio();
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  content[name] = items;
  (name === "menu" ? renderMenu : renderPortfolio)();
}

function removeItem(name, index) {
  const items = name === "menu" ? collectMenu() : collectPortfolio();
  items.splice(index, 1);
  content[name] = items;
  (name === "menu" ? renderMenu : renderPortfolio)();
}

// ---- Site form ----

const siteFields = ["businessName", "city", "phoneDisplay", "whatsappNumber", "email", "instagram", "heroImage"];

function fillSite() {
  const site = content.site;
  siteFields.forEach((field) => {
    $(`#site-${field}`).value = site[field] == null ? "" : site[field];
  });
  $("#site-minimumPax").value = site.minimumPax ?? "";
  $("#site-maxPax").value = site.maxPax ?? "";
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

// ---- Save ----

async function save(name, data, statusEl) {
  try {
    await api("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data })
    });
    content[name] = data;
    setStatus(statusEl, "Saved ✓ — the live site updates within a minute.", true);
  } catch (error) {
    setStatus(statusEl, error.message, false);
    if (error.status === 401) showLocked("Session expired — enter the password again.");
  }
}

// ---- Lock / unlock ----

function showUnlocked() {
  $("#editor").hidden = false;
  $("#passwordInput").hidden = true;
  $("#unlockBtn").hidden = true;
  $("#lockBtn").hidden = false;
  setStatus($("#lockStatus"), "Unlocked.", true);
}

function showLocked(message) {
  $("#editor").hidden = true;
  $("#passwordInput").hidden = false;
  $("#unlockBtn").hidden = false;
  $("#lockBtn").hidden = true;
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

async function loadContent() {
  let remote = {};
  try {
    const response = await fetch("/api/content", { cache: "no-store" });
    if (response.ok) remote = await response.json();
  } catch (error) { /* fall back below */ }

  const orFallback = async (value, path) => value || (await fetch(path)).json();
  content.site = await orFallback(remote.site, "/data/site.json");
  content.menu = await orFallback(remote.menu, "/data/menu.json");
  content.portfolio = await orFallback(remote.portfolio, "/data/portfolio.json");
}

async function init() {
  await loadContent();
  fillSite();
  renderMenu();
  renderPortfolio();

  $("#unlockBtn").addEventListener("click", () => {
    const value = $("#passwordInput").value;
    if (!value) return;
    localStorage.setItem(KEY_STORE, value);
    tryUnlock();
  });
  $("#passwordInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("#unlockBtn").click();
  });
  $("#lockBtn").addEventListener("click", () => {
    localStorage.removeItem(KEY_STORE);
    $("#passwordInput").value = "";
    showLocked("Signed out.");
  });

  $("#saveSite").addEventListener("click", () => save("site", collectSite(), $("#siteStatus")));
  $("#saveMenu").addEventListener("click", () => {
    const menu = collectMenu();
    const missing = menu.findIndex((item) => !biVal(item.name).en);
    if (missing !== -1) {
      setStatus($("#menuStatus"), `Dish ${missing + 1} needs a name.`, false);
      return;
    }
    save("menu", menu, $("#menuStatus"));
  });
  $("#savePortfolio").addEventListener("click", () => save("portfolio", collectPortfolio(), $("#portfolioStatus")));

  $("#addMenu").addEventListener("click", () => {
    content.menu = collectMenu();
    content.menu.push({ name: "", category: "", description: "", serving: "", image: "" });
    renderMenu();
  });
  $("#addPortfolio").addEventListener("click", () => {
    content.portfolio = collectPortfolio();
    content.portfolio.push({ event: "", pax: "", menu: "", note: "" });
    renderPortfolio();
  });

  wireUpload($("#heroUpload"), $("#siteStatus"), (url) => {
    $("#site-heroImage").value = url;
    $("#heroPreview").src = url;
  });
  $("#site-heroImage").addEventListener("change", (event) => {
    $("#heroPreview").src = event.target.value;
  });

  if (adminKey()) tryUnlock();
}

init();
