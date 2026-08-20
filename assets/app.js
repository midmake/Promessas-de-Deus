import { promessas } from './promessas.js';

const $ = (id) => document.getElementById(id);
const screen = $('screen');
const content = $('promise-content');
const linesGroup = $('promise-lines');
const categoryText = $('promise-category');
const referenceText = $('promise-reference');
const translationText = $('promise-translation');
const savedRing = $('saved-ring');
const toast = $('toast');
const toastText = $('toast-text');
const savedPanel = $('saved-panel');
const savedItems = $('saved-items');

const BIBLE = 'https://biblia.midasstudio.com.br';
const KEYS = {
  current: 'vereda-promessas-current-v90',
  seen: 'vereda-promessas-seen-v90',
  saved: 'vereda-promessas-saved-v90'
};

const categoryNames = {
  paz: 'PAZ', refugio: 'REFÚGIO', confianca: 'CONFIANÇA', descanso: 'DESCANSO',
  protecao: 'PROTEÇÃO', consolo: 'CONSOLO', presenca: 'PRESENÇA'
};

const active = promessas.filter((p) => p.ativo);
let current = getCurrent();
let locked = false;
let toastTimer = 0;
let audioContext;

function resize() {
  const scale = Math.min(window.innerWidth / 941, window.innerHeight / 1672);
  screen.setAttribute('width', Math.floor(941 * scale));
  screen.setAttribute('height', Math.floor(1672 * scale));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

function read(storage, key, fallback) {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function write(storage, key, value) { try { storage.setItem(key, JSON.stringify(value)); } catch {} }
function getCurrent() {
  const id = sessionStorage.getItem(KEYS.current);
  return active.find((p) => p.id === id) || active.find((p) => p.id === 'psa-121-7') || active[0];
}
function savedIds() { return read(localStorage, KEYS.saved, []); }
function seenIds() { return read(sessionStorage, KEYS.seen, []); }
function isSaved(id) { return savedIds().includes(id); }

function chooseNext() {
  let seen = seenIds();
  let pool = active.filter((p) => p.id !== current.id && !seen.includes(p.id));
  if (!pool.length) {
    seen = [current.id];
    pool = active.filter((p) => p.id !== current.id);
  }
  const next = pool[Math.floor(Math.random() * pool.length)] || active[0];
  write(sessionStorage, KEYS.seen, [...seen, next.id].slice(-active.length));
  return next;
}

function measureLines(text, maxWidth, fontSize) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `500 ${fontSize}px Georgia`;
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function verseLayout(text) {
  const maxWidth = 520;
  for (const fontSize of [43, 40, 37, 34, 31, 29]) {
    const lines = measureLines(text, maxWidth, fontSize);
    if (lines.length <= 4) return { fontSize, lines };
  }
  return { fontSize: 27, lines: measureLines(text, maxWidth, 27).slice(0, 5) };
}

function renderPromise() {
  const { fontSize, lines } = verseLayout(current.texto);
  linesGroup.replaceChildren();
  const lineHeight = fontSize * 1.22;
  const total = lineHeight * lines.length;
  const centerY = 575;
  const startY = centerY - total / 2 + fontSize * .82;

  lines.forEach((line, index) => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', '470.5');
    t.setAttribute('y', String(startY + index * lineHeight));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#183b31');
    t.setAttribute('font-family', 'Georgia, Times New Roman, serif');
    t.setAttribute('font-size', String(fontSize));
    t.setAttribute('font-weight', '500');
    t.textContent = line;
    linesGroup.appendChild(t);
  });

  categoryText.textContent = categoryNames[current.categoria] || 'PROMESSA';
  referenceText.textContent = current.referencia;
  translationText.textContent = current.traducao;
  savedRing.setAttribute('opacity', isSaved(current.id) ? '1' : '0');
}

function animateGroup(out, done) {
  const start = performance.now();
  const duration = out ? 220 : 360;
  function step(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = out ? p : 1 - Math.pow(1 - p, 3);
    content.setAttribute('opacity', String(out ? 1 - p : p));
    content.setAttribute('transform', `translate(0 ${out ? p * 24 : (1 - eased) * 24})`);
    if (p < 1) requestAnimationFrame(step); else done?.();
  }
  requestAnimationFrame(step);
}

function nextPromise() {
  if (locked || active.length < 2) return;
  locked = true;
  playPaper();
  animateGroup(true, () => {
    current = chooseNext();
    sessionStorage.setItem(KEYS.current, current.id);
    renderPromise();
    animateGroup(false, () => {
      content.removeAttribute('transform');
      content.setAttribute('opacity', '1');
      locked = false;
    });
  });
}

function toggleSave() {
  const ids = savedIds();
  const exists = ids.includes(current.id);
  write(localStorage, KEYS.saved, exists ? ids.filter((id) => id !== current.id) : [current.id, ...ids]);
  savedRing.setAttribute('opacity', exists ? '0' : '1');
  showToast(exists ? 'Promessa removida' : 'Promessa guardada');
}

function shareText() { return `“${current.texto}”\n\n${current.referencia}\n\nVEREDA · Promessas de Deus`; }
async function sharePromise() {
  try {
    if (navigator.share) await navigator.share({ title: 'VEREDA | Promessas de Deus', text: shareText() });
    else { await navigator.clipboard.writeText(shareText()); showToast('Promessa copiada'); }
  } catch (error) { if (error?.name !== 'AbortError') showToast('Não foi possível compartilhar agora'); }
}
function readBible() { window.location.href = `${BIBLE}/#/leitura/${current.bookId}/${current.capitulo}/${current.versiculoInicial}`; }

function playPaper() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const duration = .46;
    const count = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, count, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const white = Math.random() * 2 - 1;
      const scrape = white - previous * .86;
      previous = white;
      data[i] = scrape * Math.sin(Math.PI * t) * (1 - t * .25) * .23;
    }
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    filter.type = 'bandpass'; filter.frequency.value = 1450; filter.Q.value = .5;
    gain.gain.setValueAtTime(.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.075, audioContext.currentTime + .03);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    source.buffer = buffer; source.connect(filter).connect(gain).connect(audioContext.destination); source.start();
  } catch {}
}

function showToast(message) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toast.setAttribute('visibility', 'visible');
  toast.setAttribute('opacity', '1');
  toastTimer = setTimeout(() => {
    toast.setAttribute('opacity', '0');
    setTimeout(() => toast.setAttribute('visibility', 'hidden'), 180);
  }, 1600);
}

function openSaved() {
  const items = savedIds().map((id) => active.find((p) => p.id === id)).filter(Boolean);
  savedItems.replaceChildren();
  if (!items.length) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', '470.5'); t.setAttribute('y', '520'); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#6d7b76'); t.setAttribute('font-family', 'Arial, Helvetica, sans-serif'); t.setAttribute('font-size', '19');
    t.textContent = 'Nenhuma promessa guardada ainda.'; savedItems.appendChild(t);
  } else {
    items.slice(0, 5).forEach((p, i) => {
      const y = 390 + i * 155;
      const card = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '120'); rect.setAttribute('y', String(y - 48)); rect.setAttribute('width', '700'); rect.setAttribute('height', '125'); rect.setAttribute('rx', '20'); rect.setAttribute('fill', '#f5ead6'); rect.setAttribute('stroke', '#dec79d');
      const ref = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ref.setAttribute('x', '150'); ref.setAttribute('y', String(y - 12)); ref.setAttribute('fill', '#b58531'); ref.setAttribute('font-family', 'Arial, Helvetica, sans-serif'); ref.setAttribute('font-size', '15'); ref.setAttribute('font-weight', '700'); ref.textContent = p.referencia;
      const copy = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      copy.setAttribute('x', '150'); copy.setAttribute('y', String(y + 24)); copy.setAttribute('fill', '#183b31'); copy.setAttribute('font-family', 'Georgia, Times New Roman, serif'); copy.setAttribute('font-size', '20'); copy.textContent = p.texto.length > 62 ? `${p.texto.slice(0, 59)}…` : p.texto;
      card.append(rect, ref, copy);
      card.addEventListener('click', () => { current = p; sessionStorage.setItem(KEYS.current, current.id); renderPromise(); closeSaved(); showToast('Promessa aberta'); });
      savedItems.appendChild(card);
    });
  }
  savedPanel.setAttribute('visibility', 'visible');
}
function closeSaved() { savedPanel.setAttribute('visibility', 'hidden'); }

function activate(id, fn) {
  const el = $(id);
  el.addEventListener('click', fn);
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fn(); }
  });
}

activate('hit-save', toggleSave);
activate('hit-share', sharePromise);
activate('hit-bible', readBible);
activate('hit-new', nextPromise);
activate('nav-home', () => {});
activate('nav-saved', openSaved);
activate('nav-share', sharePromise);
activate('nav-bible', () => { window.location.href = `${BIBLE}/#/inicio`; });
activate('nav-settings', () => showToast('VEREDA · MIDAS'));
activate('saved-close', closeSaved);

renderPromise();
