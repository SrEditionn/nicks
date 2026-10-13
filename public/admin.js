/* Login de edição independente da sincronização. Senhas não são expostas ao navegador. */
(() => {
  'use strict';
  let authenticated = false;
  let configured = false;
  let missing = [];
  let checkError = '';
  const listeners = new Set();
  const changed = () => { for (const fn of listeners) fn(authenticated, configured); };
  const byId = id => document.getElementById(id);

  async function checkStatus() {
    try {
      const response = await fetch('/api/auth', { cache: 'no-store' });
      if (!response.ok) throw new Error(`API de autenticação retornou HTTP ${response.status}`);
      const data = await response.json();
      authenticated = Boolean(data.authenticated);
      configured = Boolean(data.configured);
      missing = Array.isArray(data.missing) ? data.missing.filter(v => typeof v === 'string') : [];
      checkError = '';
    } catch (err) {
      authenticated = false;
      configured = false;
      missing = [];
      checkError = err.message || 'Não foi possível consultar o servidor.';
    }
    changed();
    updateLoginDialog();
  }

  const session = {
    get authenticated() { return authenticated; },
    get configured() { return configured; },
    onChange(fn) { listeners.add(fn); fn(authenticated, configured); return () => listeners.delete(fn); },
    openLogin() {
      updateLoginDialog();
      byId('ankoo-login-dialog')?.showModal();
    },
    async recheck() { await checkStatus(); },
    async logout() {
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'logout' }),
        });
        if (!response.ok) throw new Error('Não foi possível sair.');
        authenticated = false;
        changed();
      } catch (error) { alert(error.message); }
    },
  };
  window.AnkooAdmin = session;
  const anchor = byId('admin-anchor');
  if (!anchor) return;

  const loginBtn = document.createElement('button');
  loginBtn.className = 'ankoo-admin-toggle';
  loginBtn.type = 'button';
  loginBtn.textContent = 'Entrar para editar';
  anchor.append(loginBtn);

  const dialog = document.createElement('dialog');
  dialog.id = 'ankoo-login-dialog';
  dialog.className = 'ankoo-login-dialog';
  const form = document.createElement('form');
  form.className = 'ankoo-login-form';
  const title = document.createElement('h2');
  title.textContent = 'Entrar para editar';
  const description = document.createElement('p');
  description.textContent = 'Digite seu PIN de 4 dígitos.';
  const label = document.createElement('label');
  label.htmlFor = 'ankoo-admin-password';
  label.textContent = 'PIN de 4 dígitos';
  const input = document.createElement('input');
  input.id = 'ankoo-admin-password';
  input.type = 'password';
  input.autocomplete = 'current-password';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]{4}';
  input.maxLength = 4;
  input.minLength = 4;
  input.placeholder = '••••';
  input.required = true;
  label.append(input);
  const status = document.createElement('p');
  status.className = 'ankoo-login-status';
  status.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  actions.className = 'ankoo-login-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancelar';
  cancel.className = 'ankoo-login-cancel';
  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = 'Entrar';
  send.className = 'ankoo-login-send';
  cancel.onclick = () => dialog.close();
  actions.append(cancel, send);
  form.append(title, description, label, status, actions);

  // Mensagem de configuração que continua visível mesmo se a API falhar.
  const setup = document.createElement('div');
  setup.className = 'ankoo-setup';
  const setupTitle = document.createElement('h2');
  setupTitle.textContent = 'Ativar edição';
  const setupText = document.createElement('p');
  setupText.className = 'ankoo-setup-text';
  const setupActions = document.createElement('div');
  setupActions.className = 'ankoo-login-actions';
  const closeSetup = document.createElement('button');
  closeSetup.type = 'button';
  closeSetup.textContent = 'Fechar';
  closeSetup.onclick = () => dialog.close();
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'ankoo-retry';
  retry.textContent = 'Verificar novamente';
  retry.onclick = async () => {
    retry.disabled = true;
    retry.textContent = 'Verificando...';
    await checkStatus();
    retry.disabled = false;
    retry.textContent = 'Verificar novamente';
  };
  setupActions.append(closeSetup, retry);
  setup.append(setupTitle, setupText, setupActions);
  dialog.append(form, setup);
  document.body.append(dialog);

  function updateLoginDialog() {
    form.hidden = !configured;
    setup.hidden = configured;
    if (configured) return;
    if (checkError) {
      setupText.textContent = `Não foi possível consultar /api/auth: ${checkError}. Confira a implantação e tente novamente.`;
    } else if (missing.length) {
      setupText.textContent = `Configuração pendente: ${missing.join(', ')}. Cadastre seu PIN de 4 números em ANKOO_ADMIN_PASSWORD nas variáveis secretas de Produção da Cloudflare e toque em Verificar novamente.`;
    } else {
      setupText.textContent = 'Cadastre ANKOO_ADMIN_PASSWORD como PIN de 4 dígitos nas variáveis secretas de Produção da Cloudflare e verifique novamente.';
    }
  }

  dialog.addEventListener('close', () => { input.value = ''; status.textContent = ''; });
  loginBtn.onclick = () => authenticated ? session.logout() : session.openLogin();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!/^[0-9]{4}$/.test(input.value)) { status.textContent = 'Digite exatamente 4 números.'; return; }
    status.textContent = 'Verificando...';
    send.disabled = true;
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'login', password: input.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível autenticar.');
      authenticated = Boolean(data.authenticated);
      changed();
      dialog.close();
    } catch (error) {
      status.textContent = error.message || 'Falha ao entrar.';
    } finally { send.disabled = false; }
  });

  session.onChange(admin => {
    loginBtn.textContent = admin ? 'Sair do modo edição' : 'Entrar para editar';
    loginBtn.setAttribute('aria-label', admin ? 'Sair da conta de administrador' : 'Entrar como administrador');
    loginBtn.title = !configured && !admin ? 'Clique para verificar o acesso de edição' : '';
  });
  checkStatus();
})();