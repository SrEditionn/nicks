(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const form = $('#search-form');
  const input = $('#profile-url');
  const results = $('#results');
  const notice = $('#notice');
  const submitButton = $('#submit-button');
  const gallery = $('#gallery');
  const filter = $('#filter');
  const sizeSelect = $('#size-select');
  const progress = $('#progress-wrap');
  const progressText = $('#progress-text');
  const progressFill = $('#progress-fill');
  const toast = $('#toast');
  const sourceAdd = $('#source-add');
  let savedIds = new Set();
  let adminSession = false;
  let listReady = false;
  let listError = '';
  let sourceProfile = null;

  let activeController = null;
  let generation = 0;
  let users = new Map();
  let cards = new Map();
  let pages = 0;
  let toastTimer;

  const profileUrl = (id) => `https://www.roblox.com/pt/users/${id}/profile`;

  function extractUserId(value) {
    const raw = String(value).trim();
    if (/^[1-9]\d{0,18}$/.test(raw)) return raw;
    try {
      const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const u = new URL(normalized);
      if (!['roblox.com', 'www.roblox.com', 'web.roblox.com'].includes(u.hostname.toLowerCase())) return null;
      const match = u.pathname.match(/\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?users\/([1-9]\d{0,18})(?:\/|$)/i);
      return match ? match[1] : null;
    } catch (_) { return null; }
  }

  function setNotice(message, info = false) {
    notice.textContent = message;
    notice.classList.toggle('is-hidden', !message);
    notice.classList.toggle('info', Boolean(info));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2100);
  }

  async function fetchApi(params, signal) {
    const query = new URLSearchParams(params);
    const response = await fetch(`/api/roblox?${query}`, { signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Erro HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function saveProfile(user, button) {
    if (!adminSession) { window.AnkooAdmin.openLogin(); return; }
    if (!listReady) { showToast(listError || 'Lista compartilhada indisponível.'); return; }
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = 'Salvando...';
    try {
      const card = cards.get(user.id);
      const body = card?.querySelector('.fullbody')?.src || '';
      const img = card?.querySelector('.headshot')?.src || (user.img || '');
      const response = await fetch('/api/list', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'add', items: [{ id: user.id, name: user.name, img, body }] }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Falha ao salvar.');
      savedIds = new Set((result.list || []).map(x => String(x.id)));
      updateSaveButtons();
      showToast(result.added ? `@${user.name} adicionado à página inicial!` : 'Este perfil já está na sua lista.');
    } catch (error) {
      button.disabled = false;
      button.textContent = previous;
      showToast(error.message || 'Erro ao adicionar perfil.');
    }
  }

  function updateSaveButtons() {
    for (const [id, card] of cards) {
      const button = card.querySelector('.save-button');
      if (!button) continue;
      const saved = savedIds.has(id);
      button.textContent = saved ? '✓ Adicionado' : adminSession ? '+ Adicionar' : '🔒 Entrar para adicionar';
      button.classList.toggle('is-saved', saved);
      button.disabled = !listReady || saved;
      button.title = !listReady ? listError : saved ? 'Já existe na página inicial' : adminSession ? 'Adicionar à página inicial' : 'Entre para adicionar';
    }
    sourceAdd.disabled = !listReady || !sourceProfile || savedIds.has(sourceProfile.id);
    sourceAdd.textContent = sourceProfile && savedIds.has(sourceProfile.id) ? '✓ Já está na lista' : adminSession ? '+ Adicionar perfil à lista' : '🔒 Entrar para adicionar';
  }

  async function loadSavedIds() {
    try {
      const response = await fetch('/api/list', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Falha ao consultar lista.');
      savedIds = new Set((result.list || []).map(x => String(x.id)));
      listReady = true;
      listError = '';
      $('#storage-status').textContent = `${savedIds.size} skins salvas${adminSession ? ' · edição' : ''}`;
    } catch (error) {
      listReady = false;
      listError = `Sincronização indisponível: ${error.message}`;
      $('#storage-status').textContent = listError;
      console.warn(listError);
    }
    updateSaveButtons();
  }

  function makeCard(user) {
    const card = document.createElement('article');
    card.className = 'friend-card';
    card.dataset.search = `${user.id} ${user.name} ${user.displayName}`.toLocaleLowerCase('pt-BR');
    const art = document.createElement('div');
    art.className = 'avatar-area';
    const skeleton = document.createElement('div');
    skeleton.className = 'avatar-placeholder';
    skeleton.textContent = '?';
    art.append(skeleton);

    const content = document.createElement('div');
    content.className = 'card-content';
    const displayName = document.createElement('div');
    displayName.className = 'card-display';
    displayName.title = user.displayName;
    displayName.textContent = user.displayName;
    const name = document.createElement('div');
    name.className = 'card-username';
    name.title = user.name;
    name.textContent = `@${user.name}`;

    const buttons = document.createElement('div');
    buttons.className = 'card-buttons';
    const copy = document.createElement('button');
    copy.className = 'copy-button';
    copy.type = 'button';
    copy.textContent = 'Copiar URL';
    copy.setAttribute('aria-label', `Copiar URL de ${user.name}`);
    copy.addEventListener('click', async () => {
      const url = profileUrl(user.id);
      try {
        await navigator.clipboard.writeText(url);
        showToast('URL do perfil copiada!');
      } catch (_) {
        // Old browser / clipboard permission fallback.
        const field = document.createElement('textarea');
        field.value = url;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        showToast(copied ? 'URL do perfil copiada!' : 'Não foi possível copiar automaticamente.');
      }
    });
    const open = document.createElement('a');
    open.className = 'open-button';
    open.textContent = 'Abrir ↗';
    open.href = profileUrl(user.id);
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.setAttribute('aria-label', `Abrir perfil de ${user.name} em nova aba`);
    const save = document.createElement('button');
    save.className = 'save-button';
    save.type = 'button';
    save.textContent = savedIds.has(user.id) ? '✓ Adicionado' : adminSession ? '+ Adicionar' : '🔒 Entrar para adicionar';
    save.disabled = !listReady || savedIds.has(user.id);
    save.title = !listReady ? (listError || 'Conectando lista...') : adminSession ? 'Adicionar à página inicial' : 'Entre para adicionar';
    save.addEventListener('click', () => saveProfile(user, save));
    buttons.append(copy, open, save);
    content.append(displayName, name, buttons);
    card.append(art, content);
    return card;
  }

  function updateCount() {
    $('#friends-count').textContent = users.size.toLocaleString('pt-BR');
    $('#pages-count').textContent = String(pages);
    applyFilter();
  }

  function applyFilter() {
    const needle = filter.value.trim().toLocaleLowerCase('pt-BR');
    let visible = 0;
    for (const card of cards.values()) {
      const found = card.dataset.search.includes(needle);
      card.hidden = !found;
      if (found) visible++;
    }
    $('#visible-count').textContent = `${visible.toLocaleString('pt-BR')} visíveis`;
    $('#empty-filter').classList.toggle('is-hidden', visible !== 0 || users.size === 0);
  }

  function reset(id) {
    activeController?.abort();
    activeController = new AbortController();
    generation++;
    users = new Map();
    cards = new Map();
    pages = 0;
    gallery.replaceChildren();
    filter.value = '';
    setNotice('');
    results.classList.remove('is-hidden');
    progress.classList.remove('is-hidden');
    progressFill.style.width = '2%';
    progressText.textContent = 'Iniciando a busca...';
    submitButton.disabled = true;
    submitButton.textContent = 'Carregando...';
    $('#source-name').textContent = `ID ${id}`;
    sourceProfile = null;
    updateSaveButtons();
    $('#source-link').href = profileUrl(id);
    $('#source-avatar').replaceChildren();
    const letter = document.createElement('span');
    letter.textContent = 'R';
    $('#source-avatar').append(letter);
    updateCount();
  }

  function addUsers(friends) {
    const fresh = [];
    const fragment = document.createDocumentFragment();
    for (const user of friends) {
      if (!user || !/^[1-9]\d{0,18}$/.test(String(user.id))) continue;
      const id = String(user.id);
      if (users.has(id)) continue;
      const cleaned = { id, name: String(user.name || `ID ${id}`), displayName: String(user.displayName || user.name || `ID ${id}`) };
      users.set(id, cleaned);
      const card = makeCard(cleaned);
      cards.set(id, card);
      fragment.append(card);
      fresh.push(cleaned);
    }
    gallery.append(fragment);
    updateCount();
    return fresh;
  }

  async function loadThumbnailType(idList, type, signal, myGeneration, attempt = 0) {
    const response = await fetchApi({ action: 'thumbnails', ids: idList.join(','), type }, signal);
    if (myGeneration !== generation) return;
    const pending = [];
    for (const item of response.images || []) {
      if (item.state === 'Pending') pending.push(item.id);
      if (!item.url || !cards.has(item.id)) continue;
      const card = cards.get(item.id);
      const area = card.querySelector('.avatar-area');
      if (type === 'body') {
        if (area.querySelector('.fullbody')) continue;
        const img = document.createElement('img');
        img.className = 'fullbody';
        img.alt = `Skin 2D de ${users.get(item.id)?.name || item.id}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = item.url;
        area.append(img);
        area.querySelector('.avatar-placeholder')?.remove();
      } else {
        if (area.querySelector('.headshot')) continue;
        const img = document.createElement('img');
        img.className = 'headshot';
        img.alt = `Miniatura de ${users.get(item.id)?.name || item.id}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = item.url;
        area.append(img);
      }
    }
    if (pending.length && attempt < 2 && !signal.aborted && myGeneration === generation) {
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      await loadThumbnailType(pending, type, signal, myGeneration, attempt + 1);
    }
  }

  async function loadSource(id, signal, myGeneration) {
    try {
      const [profile, thumbnail] = await Promise.all([
        fetchApi({ action: 'profile', userId: id }, signal),
        fetchApi({ action: 'thumbnails', ids: id, type: 'head' }, signal).catch(() => null),
      ]);
      if (myGeneration !== generation) return;
      $('#source-name').textContent = `${profile.displayName} (@${profile.name})`;
      sourceProfile = profile;
      updateSaveButtons();
      const url = thumbnail?.images?.[0]?.url;
      if (url) {
        sourceProfile.img = url;
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Miniatura de ${profile.name}`;
        $('#source-avatar').replaceChildren(img);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && myGeneration === generation) {
        setNotice(error.message || 'Não foi possível carregar o perfil.');
      }
    }
  }

  async function loadAll(id) {
    reset(id);
    const signal = activeController.signal;
    const myGeneration = generation;
    loadSource(id, signal, myGeneration);
    let cursor = null;
    let reason = 'complete';
    let imageQueue = Promise.resolve();
    const seenCursors = new Set();
    try {
      for (let i = 0; i < 25 && users.size < 1000; i++) {
        if (signal.aborted || myGeneration !== generation) return;
        let data;
        try {
          const q = { action: 'friends', userId: id };
          if (cursor) q.cursor = cursor;
          data = await fetchApi(q, signal);
        } catch (error) {
          reason = 'error';
          throw error;
        }
        if (signal.aborted || myGeneration !== generation) return;
        pages++;
        const fresh = addUsers(data.friends || []);
        // Load image batches in a serial queue while pagination continues.
        if (fresh.length) {
          const ids = fresh.map((user) => user.id);
          imageQueue = imageQueue.then(() => Promise.allSettled([
            loadThumbnailType(ids, 'body', signal, myGeneration),
            loadThumbnailType(ids, 'head', signal, myGeneration),
          ])).catch(() => {});
        }
        progressFill.style.width = `${Math.min(97, 5 + users.size / 1000 * 92)}%`;
        progressText.textContent = `${users.size.toLocaleString('pt-BR')} amigos encontrados · ${pages} página(s) consultada(s)...`;
        if (!data.nextCursor) break;
        if (seenCursors.has(data.nextCursor)) {
          reason = 'error';
          throw new Error('O Roblox repetiu um cursor de paginação. A lista foi interrompida para evitar duplicatas.');
        }
        seenCursors.add(data.nextCursor);
        cursor = data.nextCursor;
        // Small pause reduces rate-limit spikes without delaying image painting.
        await new Promise((resolve) => setTimeout(resolve, 90));
      }
      if (users.size >= 1000 || pages >= 25) reason = 'limit';
      await imageQueue;
      if (signal.aborted || myGeneration !== generation) return;
      progressFill.style.width = '100%';
      if (users.size === 0) {
        progressText.textContent = 'Nenhuma amizade pública encontrada.';
        setNotice('Não há amizades disponíveis para esse perfil. O usuário pode não ter amigos ou o Roblox pode restringir a visualização.', true);
      } else {
        progressText.textContent = `Concluído · ${users.size.toLocaleString('pt-BR')} amigos encontrados`;
        if (reason === 'limit') setNotice('Consulta finalizada no limite de 1.000 perfis.', true);
      }
    } catch (error) {
      if (signal.aborted || myGeneration !== generation || error.name === 'AbortError') return;
      progressText.textContent = users.size ? `Busca interrompida · ${users.size} amigos encontrados` : 'Não foi possível carregar as amizades.';
      setNotice(`${error.message || 'Falha na consulta.'} ${users.size ? 'Os perfis já carregados continuam disponíveis.' : ''}`);
    } finally {
      if (myGeneration === generation) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Buscar amigos <span aria-hidden="true">→</span>';
      }
    }
  }

  window.AnkooAdmin.onChange(admin => {
    adminSession = admin;
    updateSaveButtons();
    if (listReady) $('#storage-status').textContent = `${savedIds.size} skins salvas${admin ? ' · edição' : ''}`;
  });
  sourceAdd.addEventListener('click', () => { if (sourceProfile) saveProfile(sourceProfile, sourceAdd); });
  loadSavedIds();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = extractUserId(input.value);
    if (!id) {
      setNotice('Cole uma URL válida de perfil do Roblox, como https://www.roblox.com/pt/users/123456/profile, ou digite um ID numérico.');
      return;
    }
    history.replaceState(null, '', `?user=${encodeURIComponent(id)}`);
    loadAll(id);
  });
  filter.addEventListener('input', applyFilter);
  sizeSelect.addEventListener('change', () => {
    gallery.classList.toggle('large', sizeSelect.value === 'large');
    gallery.classList.toggle('compact', sizeSelect.value === 'compact');
  });

  // Direct-link support: /amigos/?user=12345
  const fromUrl = new URLSearchParams(location.search).get('user');
  if (fromUrl && /^[1-9]\d{0,18}$/.test(fromUrl)) {
    input.value = profileUrl(fromUrl);
    loadAll(fromUrl);
  }
})();