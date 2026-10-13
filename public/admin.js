/* Login separado da sincronizacao. O cookie de sessao e HttpOnly e nunca lido pelo JS. */
(() => {
  'use strict';
  let authenticated = false;
  let configured = false;
  const handlers = new Set();
  const changed = () => { for (const fn of handlers) fn(authenticated, configured); };
  const get = id => document.getElementById(id);
  const session = {
    get authenticated() { return authenticated; },
    get configured() { return configured; },
    onChange(fn) { handlers.add(fn); fn(authenticated, configured); return () => handlers.delete(fn); },
    openLogin() { if (!configured) { alert('Configure ANKOO_ADMIN_PASSWORD e ANKOO_SESSION_SECRET na Cloudflare para liberar a edição.'); return; } get('ankoo-login-dialog')?.showModal(); },
    async logout() {
      try {
        const r = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
        if (!r.ok) throw new Error('Não foi possível sair.');
        authenticated = false; changed();
      } catch (err) { alert(err.message); }
    },
  };
  window.AnkooAdmin = session;
  const anchor = get('admin-anchor');
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
  const title = document.createElement('h2'); title.textContent = 'Acesso de administrador';
  const description = document.createElement('p');description.textContent = 'Sua lista é compartilhada entre os aparelhos. Para adicionar, remover ou reorganizar skins, entre com sua senha de administrador.';
  const label = document.createElement('label'); label.htmlFor = 'ankoo-admin-password'; label.textContent = 'Senha de administrador';
  const input = document.createElement('input');input.id = 'ankoo-admin-password';input.type = 'password';input.autocomplete = 'current-password';input.required = true;input.minLength = 1;
  const status = document.createElement('p');status.className = 'ankoo-login-status';status.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');actions.className = 'ankoo-login-actions';
  const cancel = document.createElement('button');cancel.type = 'button';cancel.textContent = 'Cancelar';cancel.className = 'ankoo-login-cancel';
  const send = document.createElement('button');send.type = 'submit';send.textContent = 'Entrar';send.className = 'ankoo-login-send';
  cancel.onclick = () => dialog.close();
  actions.append(cancel, send);label.append(input);form.append(title,description,label,status,actions);dialog.append(form);document.body.append(dialog);
  dialog.addEventListener('close', () => { input.value = '';status.textContent = ''; });
  loginBtn.onclick = () => authenticated ? session.logout() : session.openLogin();
  form.addEventListener('submit', async e => {
    e.preventDefault();status.textContent = 'Verificando...';send.disabled = true;
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'login', password: input.value }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível autenticar.');
      authenticated = Boolean(data.authenticated);changed();dialog.close();
    } catch (error) { status.textContent = error.message; }
    finally { send.disabled = false; }
  });
  session.onChange((admin, available) => {
    loginBtn.textContent = admin ? 'Sair do modo edição' : available ? 'Entrar para editar' : 'Edição indisponível';
    loginBtn.disabled = !available;
    loginBtn.setAttribute('aria-label', admin ? 'Sair da conta de administrador' : 'Entrar como administrador');
  });
  (async () => {
    try {
      const r = await fetch('/api/auth', { cache: 'no-store' });
      if (!r.ok) throw Error('Status indisponível');
      const data = await r.json();
      authenticated = Boolean(data.authenticated);
      configured = Boolean(data.configured);
    } catch (_) { authenticated = false;configured = false; }
    changed();
  })();
})();