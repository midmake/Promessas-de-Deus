import { promessas } from './promessas.js';

const root = document.documentElement;
const active = promessas.filter(p => p.ativo);
const byId = id => document.getElementById(id);
const categoryNames = { paz:'Paz', refugio:'Refúgio', confianca:'Confiança', descanso:'Descanso', protecao:'Proteção', consolo:'Consolo', presenca:'Presença' };
const BIBLE = 'https://biblia.midasstudio.com.br';
const KEYS = { saved:'vereda-promessas-saved-v50', seen:'vereda-promessas-seen-v50', current:'vereda-promessas-current-v50', theme:'vereda-promessas-theme' };
let locked = false;
let toastTimer;
let audioContext;

function read(storage,key,fallback){try{const v=storage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}}
function write(storage,key,value){try{storage.setItem(key,JSON.stringify(value))}catch{}}
function savedIds(){return read(localStorage,KEYS.saved,[])}
function seenIds(){return read(sessionStorage,KEYS.seen,[])}
function category(p){return categoryNames[p?.categoria]||'Promessa'}
function currentFromSession(){const id=sessionStorage.getItem(KEYS.current);return active.find(p=>p.id===id)||active.find(p=>p.id==='psa-121-7')||active[0]}
let current = currentFromSession();

function showToast(text){const el=byId('toast');clearTimeout(toastTimer);el.textContent=text;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),1900)}
function applyTheme(theme){root.dataset.theme=theme;localStorage.setItem(KEYS.theme,theme);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#071713':'#173d31')}
function toggleTheme(){applyTheme(root.dataset.theme==='dark'?'light':'dark')}

function renderPromise(){
  byId('promise-category').textContent=category(current).toUpperCase();
  byId('promise-text').textContent=current.texto;
  byId('promise-reference').textContent=current.referencia;
  byId('promise-translation').textContent=current.traducao;
  byId('save-state').classList.toggle('active',savedIds().includes(current.id));
  fitText();
}

function fitText(){
  const el=byId('promise-text');
  const n=current.texto.length;
  let vw=3.25;
  if(n>110)vw=2.75;
  if(n>145)vw=2.35;
  if(n>180)vw=2.05;
  el.style.fontSize=`clamp(15px, ${vw}vw, 50px)`;
}

function nextPromise(){
  if(locked||active.length<2)return;
  locked=true;
  const paper=byId('dynamic-paper');
  const glint=byId('paper-glint');
  playPaper();
  paper.classList.add('out');
  setTimeout(()=>{
    let seen=seenIds();
    let pool=active.filter(p=>p.id!==current.id&&!seen.includes(p.id));
    if(!pool.length){seen=[current.id];pool=active.filter(p=>p.id!==current.id)}
    current=pool[Math.floor(Math.random()*pool.length)]||active[0];
    write(sessionStorage,KEYS.seen,[...seen,current.id].slice(-active.length));
    sessionStorage.setItem(KEYS.current,current.id);
    paper.classList.remove('out');
    renderPromise();
    void paper.offsetWidth;
    paper.classList.add('in');
    glint.classList.remove('run');void glint.offsetWidth;glint.classList.add('run');
    setTimeout(()=>{paper.classList.remove('in');locked=false},600);
    window.dispatchEvent(new CustomEvent('vereda:event',{detail:{name:'nova_promessa',promiseId:current.id}}));
  },300);
}

function playPaper(){
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const duration=.48,count=Math.floor(audioContext.sampleRate*duration),buffer=audioContext.createBuffer(1,count,audioContext.sampleRate),data=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<count;i++){const t=i/count,n=Math.random()*2-1,s=n-last*.86;last=n;data[i]=s*Math.sin(Math.PI*t)*(1-t*.22)*.24}
    const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
    filter.type='bandpass';filter.frequency.value=1380;filter.Q.value=.48;gain.gain.setValueAtTime(.0001,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.07,audioContext.currentTime+.035);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);source.buffer=buffer;source.connect(filter).connect(gain).connect(audioContext.destination);source.start();
  }catch{}
}

function toggleSave(){
  const ids=savedIds(),exists=ids.includes(current.id);
  write(localStorage,KEYS.saved,exists?ids.filter(id=>id!==current.id):[current.id,...ids]);
  byId('save-state').classList.toggle('active',!exists);
  showToast(exists?'Promessa removida':'Promessa guardada');
}

function renderSaved(){
  const list=byId('saved-list');
  const items=savedIds().map(id=>active.find(p=>p.id===id)).filter(Boolean);
  list.innerHTML=items.length?items.map(p=>`<article class="saved-card"><small>${category(p)}</small><p>${p.texto}</p><strong>${p.referencia}</strong><button class="saved-remove" data-remove="${p.id}" type="button" aria-label="Remover">×</button></article>`).join(''):'<div class="empty-state">Nenhuma promessa guardada ainda.</div>';
  list.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{write(localStorage,KEYS.saved,savedIds().filter(id=>id!==btn.dataset.remove));renderSaved();renderPromise()}));
  byId('saved-sheet').showModal();
}

function shareText(){return `“${current.texto}”\n\n${current.referencia}\n\nVEREDA · Promessas de Deus`}
function openShare(){byId('share-card').innerHTML=`<div class="mini">VEREDA · PROMESSAS DE DEUS</div><blockquote>${current.texto}</blockquote><strong>${current.referencia}</strong>`;byId('share-sheet').showModal()}
async function nativeShare(){try{if(navigator.share)await navigator.share({title:'VEREDA | Promessas de Deus',text:shareText()});else{await navigator.clipboard.writeText(shareText());showToast('Promessa copiada')}}catch(e){if(e?.name!=='AbortError')showToast('Não foi possível compartilhar agora')}}
function readBible(){window.location.href=`${BIBLE}/#/leitura/${current.bookId}/${current.capitulo}/${current.versiculoInicial}`}

applyTheme(localStorage.getItem(KEYS.theme)==='dark'?'dark':'light');
renderPromise();

byId('theme-toggle').addEventListener('click',toggleTheme);
byId('setting-theme').addEventListener('click',toggleTheme);
byId('save-promise').addEventListener('click',toggleSave);
byId('share-promise').addEventListener('click',openShare);
byId('read-bible').addEventListener('click',readBible);
byId('new-promise').addEventListener('click',nextPromise);
byId('native-share').addEventListener('click',nativeShare);
byId('copy-share').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(shareText());showToast('Texto copiado')}catch{showToast('Não foi possível copiar')}});

document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>byId(btn.dataset.close)?.close()));
document.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{
  const nav=btn.dataset.nav;
  if(nav==='inicio')return;
  if(nav==='guardadas')renderSaved();
  if(nav==='compartilhar')openShare();
  if(nav==='biblia')window.location.href=`${BIBLE}/#/inicio`;
  if(nav==='ajustes')byId('settings-sheet').showModal();
}));

setTimeout(()=>byId('opening-veil')?.remove(),1800);
