import { promessas } from './promessas.js';

const root = document.documentElement;
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const ritual = document.querySelector('#opening-ritual');
const quickTheme = document.querySelector('#quick-theme');
const themeToggle = document.querySelector('#theme-toggle');
const shareSheet = document.querySelector('#share-sheet');
const settingsSheet = document.querySelector('#settings-sheet');
const sharePreview = document.querySelector('#share-preview');
const shareCanvas = document.querySelector('#share-canvas');
const navButtons = [...document.querySelectorAll('[data-nav]')];

const STORAGE = {
  theme: 'vereda-promessas-theme',
  saved: 'vereda-promessas-saved-v3',
  seen: 'vereda-promessas-seen-v3',
  ritual: 'vereda-promessas-ritual-v2'
};
const BIBLE_URL = 'https://biblia.midasstudio.com.br';
const categoryNames = { paz:'Paz', refugio:'Refúgio', confianca:'Confiança', descanso:'Descanso', protecao:'Proteção', consolo:'Consolo', presenca:'Presença' };
const activePromises = promessas.filter((item) => item.ativo);
let currentPromise = null;
let currentView = 'inicio';
let locked = false;
let audioContext = null;
let toastTimer = null;

const readJSON = (storage, key, fallback) => { try { const value = storage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const writeJSON = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); } catch {} };
const escapeHTML = (value='') => { const d=document.createElement('div'); d.textContent=value; return d.innerHTML; };
const categoryLabel = (promise) => categoryNames[promise?.categoria] || 'Promessa';
const leafSVG = (cls='') => `<svg class="${cls}" viewBox="0 0 40 28" aria-hidden="true"><path d="M7 23C16 19 20 12 22 4M12 19C9 14 8 10 9 6c5 0 9 2 12 6M18 14c0-5 2-9 6-12 4 3 5 7 4 12M20 18c5-3 10-4 15-2-1 5-5 8-12 8"/></svg>`;

function emit(name, data={}) { window.dispatchEvent(new CustomEvent('vereda:event',{detail:{name,...data}})); }
function showToast(message){ clearTimeout(toastTimer); toast.textContent=message; toast.classList.add('visible'); toastTimer=setTimeout(()=>toast.classList.remove('visible'),2100); }
function getTheme(){ const saved=localStorage.getItem(STORAGE.theme); if(saved==='light'||saved==='dark')return saved; return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'; }
function applyTheme(theme){ const dark=theme==='dark'; root.dataset.theme=dark?'dark':'light'; themeToggle.checked=dark; document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#071713':'#f6f1e7'); }
function toggleTheme(){ const next=root.dataset.theme==='dark'?'light':'dark'; localStorage.setItem(STORAGE.theme,next); applyTheme(next); }
function savedIds(){ return readJSON(localStorage,STORAGE.saved,[]); }
function seenIds(){ return readJSON(sessionStorage,STORAGE.seen,[]); }
function isSaved(id){ return savedIds().includes(id); }

function choosePromise(){
  if(!activePromises.length)return null;
  let seen=seenIds();
  let pool=activePromises.filter((p)=>!seen.includes(p.id)&&p.id!==currentPromise?.id);
  if(!pool.length){ seen=currentPromise?[currentPromise.id]:[]; pool=activePromises.filter((p)=>p.id!==currentPromise?.id); }
  if(!pool.length)pool=activePromises;
  const next=pool[Math.floor(Math.random()*pool.length)];
  writeJSON(sessionStorage,STORAGE.seen,[...seen,next.id].slice(-activePromises.length));
  return next;
}

function cardHTML(promise){
  return `<article class="promise-card" id="promise-card" aria-live="polite">
    <div class="card-brand">${leafSVG('leaf-mark')}<strong>VEREDA</strong><small>PROMESSAS DE DEUS</small></div>
    <div class="category-line">${escapeHTML(categoryLabel(promise))}</div>
    <blockquote>${escapeHTML(promise.texto)}</blockquote>
    <p class="promise-reference">${escapeHTML(promise.referencia)}</p>
    <p class="translation-note">${escapeHTML(promise.traducao)}</p>
    <div class="card-landscape" aria-hidden="true"><i></i><i></i><i></i></div>
    ${leafSVG('card-leaf')}
  </article>`;
}

function objectHTML(promise){
  return `<div class="promise-scene">
    <div class="scene-aura"></div>
    <svg class="branch left" viewBox="0 0 100 220" aria-hidden="true"><path d="M78 212C62 164 48 108 47 18M52 155c-26-8-39-23-42-43 24-1 42 8 50 26M48 106c22-12 33-30 34-54-23 2-38 13-43 34M48 70c-18-9-28-23-31-41 20 0 34 8 41 23"/></svg>
    <svg class="branch right" viewBox="0 0 100 220" aria-hidden="true"><path d="M78 212C62 164 48 108 47 18M52 155c-26-8-39-23-42-43 24-1 42 8 50 26M48 106c22-12 33-30 34-54-23 2-38 13-43 34M48 70c-18-9-28-23-31-41 20 0 34 8 41 23"/></svg>
    <div class="keepsake">
      <div class="box-lid"></div>
      ${cardHTML(promise)}
      <div class="ribbon-left"></div><div class="ribbon-right"></div>
      <div class="box-rim"></div>
      <div class="box-front">${leafSVG()}</div>
    </div>
  </div>`;
}

function actionsHTML(saved){
  return `<div class="promise-actions" aria-label="Ações da promessa">
    <button class="promise-action ${saved?'active':''}" id="save-promise" type="button"><span class="action-icon"><svg class="bookmark-icon" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4V3Z"></path></svg></span><span>${saved?'Guardado':'Guardar'}</span></button>
    <button class="promise-action" id="share-promise" type="button"><span class="action-icon"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2"></circle><circle cx="6" cy="12" r="2"></circle><circle cx="18" cy="19" r="2"></circle><path d="m8 11 8-5M8 13l8 5"></path></svg></span><span>Compartilhar</span></button>
    <button class="promise-action" id="read-bible" type="button"><span class="action-icon"><svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"></path><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path></svg></span><span>Ler na Bíblia</span></button>
  </div>`;
}

function footerHTML(){ return `<div class="ornament-divider">${leafSVG()}</div><footer class="app-footer"><strong>VEREDA · MIDAS</strong><span>Texto bíblico: João Ferreira de Almeida · domínio público.</span></footer>`; }

function renderHome(){
  currentView='inicio';
  if(!currentPromise)currentPromise=choosePromise();
  app.innerHTML=`<section class="page promise-page">${objectHTML(currentPromise)}${actionsHTML(isSaved(currentPromise.id))}<button class="button primary new-promise" id="new-promise" type="button"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"></path></svg>Receber outra promessa</button>${footerHTML()}</section>`;
  setActiveNav('inicio');
  document.querySelector('#save-promise').addEventListener('click',()=>toggleSaved(currentPromise));
  document.querySelector('#share-promise').addEventListener('click',openShareSheet);
  document.querySelector('#read-bible').addEventListener('click',readBible);
  document.querySelector('#new-promise').addEventListener('click',nextPromise);
}

function toggleSaved(promise){
  const ids=savedIds(); const exists=ids.includes(promise.id);
  writeJSON(localStorage,STORAGE.saved,exists?ids.filter((id)=>id!==promise.id):[promise.id,...ids]);
  showToast(exists?'Promessa removida das guardadas':'Promessa guardada');
  emit(exists?'promessa_removida':'promessa_guardada',{promiseId:promise.id});
  currentView==='inicio'?renderHome():renderSaved();
}

function renderSaved(){
  currentView='guardadas';
  const items=savedIds().map((id)=>activePromises.find((p)=>p.id===id)).filter(Boolean);
  app.innerHTML=`<section class="page promise-page"><div class="page-heading"><h1>Promessas guardadas</h1><p>Palavras que você escolheu guardar.</p></div><div class="saved-list">${items.length?items.map((p)=>`<article class="saved-card"><span class="saved-mark"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4V3Z"></path></svg></span><div class="saved-copy"><small>${escapeHTML(categoryLabel(p))}</small><p>${escapeHTML(p.texto)}</p><strong>${escapeHTML(p.referencia)}</strong></div><button class="saved-remove" type="button" data-remove="${p.id}" aria-label="Remover">×</button></article>`).join(''):`<div class="empty-state"><strong>Nenhuma promessa guardada.</strong><span>Quando uma Palavra tocar você, use Guardar.</span></div>`}</div>${footerHTML()}</section>`;
  setActiveNav('guardadas');
  app.querySelectorAll('[data-remove]').forEach((b)=>b.addEventListener('click',()=>{const p=activePromises.find((item)=>item.id===b.dataset.remove);if(p)toggleSaved(p);}));
}

function setActiveNav(name){ navButtons.forEach((b)=>b.classList.toggle('active',b.dataset.nav===name)); }

function playPaper(){
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const duration=.5,count=Math.floor(audioContext.sampleRate*duration),buffer=audioContext.createBuffer(1,count,audioContext.sampleRate),data=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<count;i++){const t=i/count;const n=Math.random()*2-1;const scrape=n-last*.84;last=n;const env=Math.sin(Math.PI*t)*(1-t*.25);data[i]=scrape*env*.25;}
    const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
    filter.type='bandpass';filter.frequency.value=1450;filter.Q.value=.5;gain.gain.setValueAtTime(.0001,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.075,audioContext.currentTime+.03);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);source.buffer=buffer;source.connect(filter).connect(gain).connect(audioContext.destination);source.start();
  }catch{}
}

function nextPromise(){
  if(locked||activePromises.length<2)return;
  locked=true; const card=document.querySelector('#promise-card'); const button=document.querySelector('#new-promise'); button.disabled=true; playPaper(); card.classList.add('is-leaving');
  setTimeout(()=>{ currentPromise=choosePromise(); renderHome(); const next=document.querySelector('#promise-card'); next.classList.add('is-entering'); emit('nova_promessa',{promiseId:currentPromise.id}); setTimeout(()=>{next.classList.remove('is-entering');locked=false;},520); },290);
}

function bibleURL(p){return `${BIBLE_URL}/#/leitura/${p.bookId}/${p.capitulo}/${p.versiculoInicial}`;}
function readBible(){emit('ler_na_biblia',{promiseId:currentPromise.id});window.location.href=bibleURL(currentPromise);}
function previewHTML(p){return `<div class="share-mini-card"><div class="mini-brand">VEREDA</div><div class="mini-sub">PROMESSAS DE DEUS</div><div class="mini-cat">${escapeHTML(categoryLabel(p).toUpperCase())}</div><blockquote>${escapeHTML(p.texto)}</blockquote><p class="mini-ref">${escapeHTML(p.referencia)}</p></div>`;}
function openShareSheet(){sharePreview.innerHTML=previewHTML(currentPromise);shareSheet.showModal();}
function shareText(){return `“${currentPromise.texto}”\n\n${currentPromise.referencia}\n\nVEREDA · Promessas de Deus`;}
async function nativeShare(){try{if(navigator.share){await navigator.share({title:'VEREDA | Promessas de Deus',text:shareText()});}else{await navigator.clipboard.writeText(shareText());showToast('Promessa copiada para compartilhar');}emit('promessa_compartilhada',{promiseId:currentPromise.id});}catch(e){if(e?.name!=='AbortError')showToast('Não foi possível compartilhar agora');}}

function startRitual(){
  if(!ritual||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){ritual?.remove();return;}
  if(sessionStorage.getItem(STORAGE.ritual)){ritual.remove();return;}
  sessionStorage.setItem(STORAGE.ritual,'1');
  setTimeout(()=>ritual.classList.add('finishing'),1550);setTimeout(()=>{ritual.remove();emit('promessa_aberta',{promiseId:currentPromise?.id});},1900);
}

applyTheme(getTheme());
currentPromise=choosePromise();
renderHome();
startRitual();
quickTheme.addEventListener('click',toggleTheme);
themeToggle.addEventListener('change',()=>{const next=themeToggle.checked?'dark':'light';localStorage.setItem(STORAGE.theme,next);applyTheme(next);});
document.querySelector('#brand-home').addEventListener('click',renderHome);
navButtons.forEach((button)=>button.addEventListener('click',()=>{const nav=button.dataset.nav;if(nav==='inicio')renderHome();if(nav==='guardadas')renderSaved();if(nav==='compartilhar')openShareSheet();if(nav==='biblia')window.location.href=`${BIBLE_URL}/#/inicio`;if(nav==='ajustes')settingsSheet.showModal();}));
document.querySelectorAll('[data-close-dialog]').forEach((button)=>button.addEventListener('click',()=>button.closest('dialog')?.close()));
document.querySelector('#native-share').addEventListener('click',nativeShare);
document.querySelector('#copy-share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(shareText());showToast('Texto da promessa copiado');}catch{showToast('Não foi possível copiar agora');}});
