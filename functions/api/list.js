import { isAdmin, adminConfigured, assertSameOrigin } from '../../src/auth.js';
/**
 * Lista compartilhada do Ankoo.
 * Vincule ao Pages o MESMO namespace KV "LIST" utilizado pelo Worker antigo.
 * Configure o segredo ANKOO_LIST_CODE com o código de sincronização ANTIGO.
 * GET publico. POST protegido: somente sessao de administrador assinada pode editar.
 * O codigo de sincronizacao antigo NUNCA e enviado ao navegador.
 */
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers });
const idOk = id => typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id);
const clean = (u) => ({
  id: String(u?.id ?? ''),
  name: String(u?.name ?? '').slice(0, 100),
  img: String(u?.img ?? '').slice(0, 800),
  body: String(u?.body ?? '').slice(0, 800),
});
const normalize = (raw) => {
  if (!Array.isArray(raw)) return [];
  const ids = new Set();
  const out = [];
  for (const item of raw) {
    const u = clean(item);
    if (!idOk(u.id) || ids.has(u.id)) continue;
    ids.add(u.id);
    out.push(u);
  }
  return out;
};
function configured(env) {
  if (!env?.LIST || !/^[\w-]{6,64}$/.test(String(env.ANKOO_LIST_CODE || ''))) return null;
  return `l:${env.ANKOO_LIST_CODE}`;
}
async function load(env, key) {
  const raw = await env.LIST.get(key);
  if (raw === null) return null;
  try { return normalize(JSON.parse(raw)); } catch (_) { throw new Error('O conteúdo da lista KV não é JSON válido.'); }
}
export async function onRequestGet({ env }) {
  const key = configured(env);
  if (!key) return reply({ error: 'Sincronização não configurada. Configure LIST e ANKOO_LIST_CODE no projeto Pages.' }, 503);
  try {
    const list = await load(env, key);
    if (list === null) return reply({ error: 'Lista antiga não encontrada no KV. Confira LIST e ANKOO_LIST_CODE antes de salvar novos dados.' }, 409);
    return reply({ list, count: list.length, configured: true });
  } catch (_) {
    return reply({ error: 'Não foi possível ler a lista na Cloudflare.' }, 502);
  }
}
export async function onRequestPost({ request, env }) {
  if (!adminConfigured(env)) return reply({ error: 'A autenticação de administrador não foi configurada.' }, 503);
  if (!assertSameOrigin(request)) return reply({ error: 'Origem não autorizada.' }, 403);
  if (!await isAdmin(request, env)) return reply({ error: 'Entre como administrador para editar esta lista.' }, 401);
  const key = configured(env);
  if (!key) return reply({ error: 'Sincronização não configurada. Configure LIST e ANKOO_LIST_CODE no projeto Pages.' }, 503);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply({ error: 'Envie JSON válido.' }, 415);
  const text = await request.text();
  if (text.length > 110000) return reply({ error: 'Requisição grande demais.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch (_) { return reply({ error: 'JSON inválido.' }, 400); }
  if (!body || typeof body !== 'object') return reply({ error: 'Operação inválida.' }, 400);
  try {
    const list = await load(env, key);
    if (list === null) return reply({ error: 'Lista original não encontrada. Operação bloqueada para proteger os nicks existentes.' }, 409);
    let changed = false;
    let added = 0;
    let exists = 0;
    if (body.action === 'add') {
      if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return reply({ error: 'Adicione de 1 a 100 perfis.' }, 400);
      const present = new Set(list.map(x => x.id));
      const incoming = [];
      for (const raw of body.items) {
        const u = clean(raw);
        if (!idOk(u.id)) return reply({ error: 'ID de perfil inválido.' }, 400);
        if (present.has(u.id)) { exists++; continue; }
        present.add(u.id);
        incoming.push(u);
        added++;
      }
      if (incoming.length) {
        // Cada lote vai ao início sem inverter a ordem fornecida.
        list.unshift(...incoming);
        changed = true;
      }
    } else if (body.action === 'remove') {
      if (!idOk(body.id)) return reply({ error: 'ID inválido.' }, 400);
      const idx = list.findIndex(u => u.id === body.id);
      if (idx !== -1) { list.splice(idx, 1); changed = true; }
    } else if (body.action === 'move') {
      if (!idOk(body.id) || !Number.isInteger(body.toIndex)) return reply({ error: 'Movimento inválido.' }, 400);
      const idx = list.findIndex(u => u.id === body.id);
      if (idx === -1) return reply({ error: 'Perfil não encontrado.' }, 404);
      const [u] = list.splice(idx, 1);
      const to = Math.max(0, Math.min(body.toIndex, list.length));
      list.splice(to, 0, u);
      changed = idx !== to;
    } else if (body.action === 'update') {
      if (!Array.isArray(body.items) || body.items.length > 100) return reply({ error: 'Lote inválido.' }, 400);
      const indexes = new Map(list.map((u, i) => [u.id, i]));
      for (const raw of body.items) {
        const u = clean(raw);
        const idx = indexes.get(u.id);
        if (idx === undefined) continue;
        const curr = list[idx];
        for (const field of ['name', 'img', 'body']) {
          if (u[field] && curr[field] !== u[field]) { curr[field] = u[field]; changed = true; }
        }
      }
    } else return reply({ error: 'Ação desconhecida.' }, 400);
    if (list.length > 4000 || JSON.stringify(list).length >= 380000) return reply({ error: 'O banco de nicks atingiu o limite de armazenamento configurado.' }, 413);
    if (changed) await env.LIST.put(key, JSON.stringify(list));
    return reply({ list, added, exists, changed, count: list.length });
  } catch (_) {
    return reply({ error: 'Falha ao salvar a lista. Nenhuma operação foi confirmada.' }, 502);
  }
}