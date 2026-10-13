(() => {
'use strict';
const $ = id => document.getElementById(id);
const KEY = 'roblox_nicks_v1';
const WORKER = 'https://user.ankoo.workers.dev';
let data = [];
let ready = false;
let lastRefresh = 0;
let refreshing = false;
let working = false;
let adminSession = false;
let dragId = null;
let dragY = null;
let scrollFrame = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function status(text) { $('st').textContent = text; }
function cache() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {} }
function profileUrl(id) { return `https://www.roblox.com/pt/users/${id}/profile`; }
async function request(payload) {
  const init = payload ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } : undefined;
  const r = await fetch('/api/list', init);
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || `Erro do servidor (${r.status})`);
  return json;
}
function adopt(list) {
  data = (Array.isArray(list) ? list : []).filter(u => /^\d+$/.test(String(u.id))).map(u => ({
    id: String(u.id), name: String(u.name || ''), img: String(u.img || ''), body: String(u.body || '')
  }));
  cache();
  render();
}
async function pull(silent = false) {
  if (working || dragId) return false;
  if (!silent) status('Sincronizando lista...');
  try {
    const response = await request();
    adopt(response.list);
    ready = true;
    if (!silent) status(`${data.length} perfis sincronizados • Cloudflare`);
    return true;
  } catch (error) {
    ready = false;
    // Visualize cached profiles, but never overwrite the KV when offline.
    if (!data.length) {
      try { adopt(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (_) { /* no cache */ }
    }
    status(`Falha na sincronização: ${error.message}. Edição bloqueada para proteger sua lista.`);
    return false;
  }
}
async function mutate(payload) {
  if (!adminSession) { window.AnkooAdmin.openLogin(); return null; }
  if (!ready) { status('O servidor não está conectado. Nenhuma alteração foi feita.'); return null; }
  if (working) return null;
  working = true;
  try {
    const result = await request(payload);
    adopt(result.list);
    status(`${data.length} perfis • lista salva na Cloudflare`);
    return result;
  } catch (e) {
    status(`Não foi possível salvar: ${e.message}`);
    return null;
  } finally { working = false; }
}
function copy(value, btn) {
  if (!value) return;
  const done = () => { const before=btn.textContent; btn.textContent='Copiado!'; setTimeout(() => btn.textContent=before, 1300); };
  const fallback = () => {
    const temp=document.createElement('textarea');temp.value=value;document.body.append(temp);temp.select();
    const success=document.execCommand('copy');temp.remove();if(success)done();
  };
  if (navigator.clipboard) navigator.clipboard.writeText(value).then(done, fallback); else fallback();
}
function el(tag, className, text) {
  const element=document.createElement(tag);
  if (className) element.className=className;
  if (text !== undefined) element.textContent=text;
  return element;
}
function applyFilter() {
  const input = $('filter');
  const needle = (input?.value || '').trim().toLocaleLowerCase('pt-BR');
  let visible = 0;
  for (const card of $('list').children) {
    const match = (card.dataset.search || '').includes(needle);
    card.hidden = !match;
    if (match) visible++;
  }
  $('total-count').textContent = data.length.toLocaleString('pt-BR');
  $('visible-count').textContent = `${visible.toLocaleString('pt-BR')} visíveis`;
  $('empty-filter').classList.toggle('is-hidden', visible !== 0 || data.length === 0);
}
function render() {
  const list = $('list');
  const fragment = document.createDocumentFragment();
  data.forEach((u, i) => {
    const card = el('article', 'card');
    card.draggable = adminSession;
    card.dataset.id = u.id;
    card.dataset.search = `${u.name} ${u.id}`.toLocaleLowerCase('pt-BR');
    card.style.cursor = adminSession ? 'grab' : 'default';
    card.ondragstart = e => {
      if (!adminSession) { e.preventDefault(); return; }
      dragId = u.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', u.id);
      card.classList.add('drag');
      $('drag-hint').hidden = false;
    };
    card.ondragend = stopDrag;
    card.ondragover = e => {
      if (!adminSession) return;
      e.preventDefault();
      card.classList.add('over');
    };
    card.ondragleave = () => card.classList.remove('over');
    card.ondrop = e => {
      if (!adminSession) return;
      e.preventDefault();
      const source = dragId || e.dataTransfer.getData('text/plain');
      const newIndex = data.findIndex(x => x.id === u.id);
      stopDrag();
      moveTo(source, newIndex);
    };

    const stage = el('div', 'stage');
    if (u.body) {
      const image = el('img', 'fullbody');
      image.src = u.body;
      image.alt = `Avatar de ${u.name || u.id}`;
      image.loading = 'lazy';
      stage.append(image);
    } else {
      stage.append(el('div', 'avatar-placeholder', '?'));
    }
    if (u.img) {
      const image = el('img', 'headshot');
      image.src = u.img;
      image.alt = `Miniatura de ${u.name || u.id}`;
      image.loading = 'lazy';
      stage.append(image);
    }

    const content = el('div', 'card-content');
    content.append(
      el('div', 'card-display', u.name ? `@${u.name}` : 'Carregando...'),
      el('div', 'card-username', `ID ${u.id}`),
    );
    const buttons = el('div', 'card-buttons');
    const copyButton = el('button', 'copy-button', 'Copiar nick');
    copyButton.type = 'button';
    copyButton.title = 'Copiar apenas o nickname';
    copyButton.onclick = () => copy(u.name, copyButton);
    const open = el('a', 'open-button', 'Abrir ↗');
    open.href = profileUrl(u.id);
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.title = 'Abrir perfil Roblox em outra aba';
    buttons.append(copyButton, open);
    content.append(buttons);

    const top = el('div', 'tools');
    const left = el('button', null, '‹');
    left.type = 'button';
    left.title = 'Mover para trás';
    left.onclick = () => moveTo(u.id, i - 1);
    const right = el('button', null, '›');
    right.type = 'button';
    right.title = 'Mover para frente';
    right.onclick = () => moveTo(u.id, i + 1);
    const remove = el('button', 'remove-btn', '×');
    remove.type = 'button';
    remove.title = 'Remover da lista';
    remove.onclick = () => mutate({ action: 'remove', id: u.id });
    left.hidden = !adminSession;
    right.hidden = !adminSession;
    remove.hidden = !adminSession;
    top.append(left, right, remove);
    card.append(stage, content, top);
    fragment.append(card);
  });
  list.replaceChildren(fragment);
  applyFilter();
}
async function moveTo(id,toIndex) {
  if (!adminSession || !id || toIndex < 0 || toIndex >= data.length) return;
  const previous=data.findIndex(x=>x.id===id);
  if (previous < 0 || previous === toIndex) return;
  await mutate({action:'move',id,toIndex});
}
function stopDrag() {
  document.querySelectorAll('.card.over,.card.drag').forEach(c=>c.classList.remove('over','drag'));
  $('drag-hint').hidden=true;
  dragY=null;
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame=0;
  // dragId is cleared on the next event tick to preserve it for drop.
  setTimeout(()=>dragId=null,0);
}
function scrollWhileDragging() {
  if (dragY===null || !dragId) {scrollFrame=0;return;}
  const edge=105;
  let speed=0;
  if(dragY > innerHeight-edge) speed= 3+Math.round((dragY-(innerHeight-edge))/edge*19);
  else if (dragY < edge) speed= -(3+Math.round((edge-dragY)/edge*19));
  if(speed) window.scrollBy(0,speed);
  scrollFrame=requestAnimationFrame(scrollWhileDragging);
}
document.addEventListener('dragover',e=>{
  if (!dragId) return;
  e.preventDefault();
  dragY=e.clientY;
  if (!scrollFrame) scrollFrame=requestAnimationFrame(scrollWhileDragging);
});
document.addEventListener('drop',()=>stopDrag());
document.addEventListener('dragend',()=>stopDrag());

$('add').onclick=async () => {
  if (!adminSession) { window.AnkooAdmin.openLogin();return; }
  const ids=[...new Set(($('in').value.match(/\d{3,19}/g) || []).filter(x=>/^[1-9]\d{2,18}$/.test(x)))];
  if (!ids.length) {status('Cole pelo menos um link/ID Roblox válido.');return;}
  let totalAdded=0, totalExists=0;
  // Send batches backwards so pasted input order stays intact at the top.
  for(let end=ids.length;end>0;end-=100) {
    const batch=ids.slice(Math.max(0,end-100),end).map(id=>({id}));
    const result=await mutate({action:'add',items:batch});
    if (!result) return;
    totalAdded+=result.added;
    totalExists+=result.exists;
  }
  $('in').value='';
  status(`${totalAdded} novo(s) no topo${totalExists?` • ${totalExists} já estava(m) cadastrado(s)`:''}`);
  if (totalAdded) refresh();
};
$('ref').onclick=async()=>{if(await pull())await refresh()};

async function details(ids) {
  try {
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),14000);
    try {
      const r=await fetch(`${WORKER}?ids=${ids.join(',')}`,{signal:ctrl.signal});
      if(!r.ok)throw Error('Worker indisponível');
      const j=await r.json();
      if (!j || typeof j!=='object' || !Object.values(j).some(x=>x?.name))throw Error('Worker sem dados');
      return j;
    } finally {clearTimeout(timer);}
  } catch (_) {
    const r=await fetch(`/api/roblox?action=details&ids=${ids.join(',')}`);
    if(!r.ok)throw Error('O Worker e a API de reserva não responderam.');
    const j=await r.json();return j.profiles || {};
  }
}
async function refresh() {
  if(refreshing || !ready || !data.length)return;
  refreshing=true;lastRefresh=Date.now();
  const ids=data.map(x=>x.id);
  const latest=new Map();let successful=0;
  status(`Atualizando ${ids.length} avatares...`);
  const chunks=[];for(let i=0;i<ids.length;i+=50)chunks.push(ids.slice(i,i+50));
  try {
    for(let i=0;i<chunks.length;i+=3) {
      const result=await Promise.allSettled(chunks.slice(i,i+3).map(ids=>details(ids)));
      result.forEach(group=>{
        if(group.status!=='fulfilled')return;
        for(const [id,u] of Object.entries(group.value||{})) {
          if(!u || typeof u!=='object')continue;
          latest.set(id,u);
          if(u.name)successful++;
        }
      });
      for(const u of data){
        const value=latest.get(u.id);if(!value)continue;
        if(value.name)u.name=value.name;
        if(value.body)u.body=value.body;
        if(value.img)u.img=value.img;
      }
      cache();render();
      status(`Atualizando skins... ${Math.min(i+3,chunks.length)}/${chunks.length} lotes`);
    }
    // Atualizações parciais não substituem a ordem ou outros IDs no KV.
    const updates=data.filter(u=>latest.has(u.id)).map(u=>({id:u.id,name:u.name,img:u.img,body:u.body}));
    for(let i=0;adminSession && i<updates.length;i+=100) {
      const response=await request({action:'update',items:updates.slice(i,i+100)});
      if(!response)break;
    }
    status(`Atualizado às ${new Date().toLocaleTimeString('pt-BR')} (${successful}/${ids.length}) • servidor fixo`);
  } catch (e) {
    status(`Avatares parcialmente atualizados: ${e.message}`);
  } finally { refreshing=false; }
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  if(Date.now()-lastRefresh > 30000)pull(true).then(ok=>{if(ok)refresh()});
});
setInterval(()=>{if(!document.hidden && !working && !refreshing && !dragId)pull(true);},60000);

window.AnkooAdmin.onChange(auth => {
  adminSession = auth;
  $('add').hidden = !auth;
  $('in').hidden = !auth;
  $('edit-panel').classList.toggle('is-viewer', !auth);
  $('edit-help').textContent = auth
    ? 'Cole um ou vários links/IDs. Novos perfis entram no topo, sem duplicatas. Arraste os cartões para mudar a ordem.'
    : 'Entre como administrador para adicionar, remover ou reorganizar os perfis.';
  $('drag-hint').hidden = true;
  render();
});
$('filter').addEventListener('input', applyFilter);
$('size-select').addEventListener('change', () => {
  const gallery = $('list');
  gallery.classList.toggle('large', $('size-select').value === 'large');
  gallery.classList.toggle('compact', $('size-select').value === 'compact');
});
render();
pull().then(ok=>{if(ok)refresh()});
})();
