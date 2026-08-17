import { promessas } from "./promessas.js";

const root = document.documentElement;
const $ = (selector) => document.querySelector(selector);

const elements = {
  themeToggle: $("#theme-toggle"),
  themeColor: $('meta[name="theme-color"]'),
  ritual: $("#opening-ritual"),
  card: $("#promise-card"),
  text: $("#promise-text"),
  reference: $("#promise-reference"),
  translation: $("#translation-note"),
  newPromise: $("#new-promise"),
  save: $("#save-promise"),
  share: $("#share-promise"),
  readBible: $("#read-bible"),
  openSaved: $("#open-saved"),
  closeSaved: $("#close-saved"),
  savedBackdrop: $("#saved-backdrop"),
  savedPanel: $("#saved-panel"),
  savedList: $("#saved-list"),
  savedCount: $("#saved-count"),
  toast: $("#toast"),
  shareCanvas: $("#share-canvas")
};

const STORAGE = {
  theme: "vereda-promessas-theme",
  saved: "vereda-promessas-saved-v1",
  seen: "vereda-promessas-seen-v1"
};

const BIBLE_BASE_URL = "https://biblia.midasstudio.com.br";
const activePromises = promessas.filter((item) => item.ativo);
let currentPromise = null;
let transitionLocked = false;
let toastTimer = null;

function readJSON(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* armazenamento indisponível */ }
}

function emitEvent(name, data = {}) {
  window.dispatchEvent(new CustomEvent("vereda:event", { detail: { name, ...data } }));
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.classList.remove("show");
  elements.toast.textContent = message;
  void elements.toast.offsetWidth;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2300);
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  root.dataset.theme = isDark ? "dark" : "light";
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeColor.setAttribute("content", isDark ? "#101b18" : "#f6f1e7");
}

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE.theme);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function randomIndex(length) {
  if (length <= 1) return 0;
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function getSeenIds() {
  return readJSON(sessionStorage, STORAGE.seen, []);
}

function choosePromise() {
  if (!activePromises.length) return null;
  let seen = getSeenIds();
  let pool = activePromises.filter((item) => !seen.includes(item.id) && item.id !== currentPromise?.id);

  if (!pool.length) {
    seen = currentPromise ? [currentPromise.id] : [];
    pool = activePromises.filter((item) => item.id !== currentPromise?.id);
  }

  if (!pool.length) pool = activePromises;
  const next = pool[randomIndex(pool.length)];
  const nextSeen = [...seen.filter((id) => id !== next.id), next.id].slice(-Math.max(8, activePromises.length));
  writeJSON(sessionStorage, STORAGE.seen, nextSeen);
  return next;
}

function getSavedIds() {
  return readJSON(localStorage, STORAGE.saved, []);
}

function setSavedIds(ids) {
  writeJSON(localStorage, STORAGE.saved, ids);
  updateSavedUI();
}

function isSaved(id) {
  return getSavedIds().includes(id);
}

function renderPromise(promise) {
  if (!promise) return;
  currentPromise = promise;
  elements.text.textContent = promise.texto;
  elements.reference.textContent = promise.referencia;
  elements.translation.textContent = `${promise.traducao} · domínio público`;
  elements.save.classList.toggle("active", isSaved(promise.id));
  elements.save.querySelector("span").textContent = isSaved(promise.id) ? "Guardado" : "Guardar";
}

function updateSavedUI() {
  const ids = getSavedIds();
  elements.savedCount.textContent = ids.length;
  elements.savedCount.hidden = ids.length === 0;
  if (currentPromise) {
    const active = ids.includes(currentPromise.id);
    elements.save.classList.toggle("active", active);
    elements.save.querySelector("span").textContent = active ? "Guardado" : "Guardar";
  }
}

function toggleSave() {
  if (!currentPromise) return;
  const ids = getSavedIds();
  const exists = ids.includes(currentPromise.id);
  const next = exists ? ids.filter((id) => id !== currentPromise.id) : [currentPromise.id, ...ids];
  setSavedIds(next);
  showToast(exists ? "Removido das guardadas" : "Promessa guardada");
  emitEvent(exists ? "promessa_removida" : "promessa_guardada", { promiseId: currentPromise.id });
  if (!elements.savedPanel.hidden) renderSavedList();
}

function renderSavedList() {
  const ids = getSavedIds();
  const items = ids.map((id) => activePromises.find((item) => item.id === id)).filter(Boolean);

  if (!items.length) {
    elements.savedList.innerHTML = '<div class="empty-state"><strong>Nenhuma promessa guardada ainda.</strong><span>Quando uma Palavra tocar você, toque em Guardar.</span></div>';
    return;
  }

  elements.savedList.innerHTML = items.map((item) => `
    <article class="saved-card" data-saved-id="${item.id}">
      <blockquote>${escapeHTML(item.texto)}</blockquote>
      <div class="saved-card-footer">
        <strong>${escapeHTML(item.referencia)}</strong>
        <button type="button" data-remove-saved="${item.id}">Remover</button>
      </div>
    </article>
  `).join("");
}

function openSavedPanel() {
  renderSavedList();
  elements.savedPanel.hidden = false;
  document.body.classList.add("panel-open");
  requestAnimationFrame(() => elements.closeSaved.focus());
}

function closeSavedPanel() {
  elements.savedPanel.hidden = true;
  document.body.classList.remove("panel-open");
  elements.openSaved.focus();
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function nextPromise() {
  if (transitionLocked || activePromises.length < 2) return;
  transitionLocked = true;
  elements.newPromise.disabled = true;
  elements.card.classList.remove("is-entering");
  elements.card.classList.add("is-leaving");

  setTimeout(() => {
    const next = choosePromise();
    renderPromise(next);
    elements.card.classList.remove("is-leaving");
    void elements.card.offsetWidth;
    elements.card.classList.add("is-entering");
    emitEvent("nova_promessa", { promiseId: next?.id });
  }, 230);

  setTimeout(() => {
    elements.card.classList.remove("is-entering");
    elements.newPromise.disabled = false;
    transitionLocked = false;
  }, 650);
}

function bibleURL(promise) {
  if (!promise?.bookId || !promise?.capitulo) return `${BIBLE_BASE_URL}/#/inicio`;
  const verse = promise.versiculoInicial ? `/${promise.versiculoInicial}` : "";
  return `${BIBLE_BASE_URL}/#/leitura/${promise.bookId}/${promise.capitulo}${verse}`;
}

function readInBible() {
  if (!currentPromise) return;
  emitEvent("ler_na_biblia", { promiseId: currentPromise.id, reference: currentPromise.referencia });
  window.location.href = bibleURL(currentPromise);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function createShareBlob(promise) {
  return new Promise((resolve) => {
    const canvas = elements.shareCanvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#f6f1e7";
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(160, 80, 20, 160, 80, 500);
    glow.addColorStop(0, "rgba(175,130,50,.18)");
    glow.addColorStop(1, "rgba(175,130,50,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, 620);

    ctx.fillStyle = "#1e493c";
    roundRect(ctx, 88, 82, 86, 96, 18);
    ctx.fill();
    ctx.fillStyle = "#fffdf8";
    ctx.font = "700 48px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("†", 131, 147);

    ctx.textAlign = "left";
    ctx.fillStyle = "#af8232";
    ctx.font = "800 25px Arial";
    ctx.fillText("VEREDA", 205, 118);
    ctx.fillStyle = "#18342c";
    ctx.font = "700 37px Georgia";
    ctx.fillText("Promessas de Deus", 205, 162);

    ctx.fillStyle = "#fffdf8";
    ctx.strokeStyle = "#ded8cc";
    ctx.lineWidth = 2;
    roundRect(ctx, 88, 250, 904, 820, 46);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#af8232";
    ctx.textAlign = "center";
    ctx.font = "800 22px Arial";
    ctx.fillText("PROMESSA", w / 2, 350);

    ctx.fillStyle = "#18342c";
    ctx.font = "46px Georgia";
    const lines = wrapCanvasText(ctx, promise.texto, 720);
    const lineHeight = 68;
    const textHeight = lines.length * lineHeight;
    let y = 560 - Math.min(80, textHeight / 5);
    lines.forEach((line) => {
      ctx.fillText(line, w / 2, y);
      y += lineHeight;
    });

    ctx.fillStyle = "#18342c";
    ctx.font = "700 28px Arial";
    ctx.fillText(promise.referencia, w / 2, 950);
    ctx.fillStyle = "#718078";
    ctx.font = "22px Arial";
    ctx.fillText("João Ferreira de Almeida", w / 2, 992);

    ctx.fillStyle = "#af8232";
    ctx.font = "800 21px Arial";
    ctx.fillText("UMA EXPERIÊNCIA VEREDA · MIDAS", w / 2, 1195);
    ctx.fillStyle = "#718078";
    ctx.font = "20px Georgia";
    ctx.fillText("A Palavra mais perto de você.", w / 2, 1240);

    canvas.toBlob(resolve, "image/png", .94);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

async function sharePromise() {
  if (!currentPromise) return;
  elements.share.disabled = true;
  const text = `“${currentPromise.texto}”\n\n${currentPromise.referencia}\n\nVEREDA · Promessas de Deus`;

  try {
    const blob = await createShareBlob(currentPromise);
    const file = blob ? new File([blob], "vereda-promessa.png", { type: "image/png" }) : null;

    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "VEREDA | Promessas de Deus", text: currentPromise.referencia, files: [file] });
      showToast("Promessa compartilhada");
    } else if (navigator.share) {
      await navigator.share({ title: "VEREDA | Promessas de Deus", text });
      showToast("Promessa compartilhada");
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast("Promessa copiada para compartilhar");
    } else {
      showToast("Compartilhamento indisponível neste navegador");
      return;
    }
    emitEvent("promessa_compartilhada", { promiseId: currentPromise.id });
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Não foi possível compartilhar agora");
  } finally {
    elements.share.disabled = false;
  }
}

function startRitual() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    elements.ritual.remove();
    emitEvent("promessa_aberta", { promiseId: currentPromise?.id });
    return;
  }
  setTimeout(() => elements.ritual.classList.add("finished"), 1510);
  setTimeout(() => {
    elements.ritual.remove();
    emitEvent("promessa_aberta", { promiseId: currentPromise?.id });
  }, 1870);
}

applyTheme(getInitialTheme());
renderPromise(choosePromise());
updateSavedUI();
startRitual();

elements.themeToggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE.theme, next);
  applyTheme(next);
});

elements.newPromise.addEventListener("click", nextPromise);
elements.save.addEventListener("click", toggleSave);
elements.share.addEventListener("click", sharePromise);
elements.readBible.addEventListener("click", readInBible);
elements.openSaved.addEventListener("click", openSavedPanel);
elements.closeSaved.addEventListener("click", closeSavedPanel);
elements.savedBackdrop.addEventListener("click", closeSavedPanel);

elements.savedList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-saved]");
  if (!button) return;
  const id = button.dataset.removeSaved;
  setSavedIds(getSavedIds().filter((savedId) => savedId !== id));
  renderSavedList();
  showToast("Removido das guardadas");
  emitEvent("promessa_removida", { promiseId: id });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.savedPanel.hidden) closeSavedPanel();
});
