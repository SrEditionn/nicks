import { adminConfigured, assertSameOrigin, cookieClear, cookieMake, isAdmin, checkPassword, rateKey } from '../../src/auth.js';
const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const reply = (json, status = 200, cookie = null) => new Response(JSON.stringify(json), { status, headers: cookie ? { ...H, 'set-cookie': cookie } : H });

export async function onRequestGet({ request, env }) {
  return reply({ authenticated: await isAdmin(request, env), configured: adminConfigured(env) });
}
export async function onRequestPost({ request, env }) {
  if (!assertSameOrigin(request)) return reply({ error: 'Origem não autorizada.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply({ error: 'Envie JSON.' }, 415);
  const text = await request.text();
  if (text.length > 1024) return reply({ error: 'Requisição inválida.' }, 413);
  let input;
  try { input = JSON.parse(text); } catch (_) { return reply({ error: 'JSON inválido.' }, 400); }
  if (input?.action === 'logout') return reply({ authenticated: false }, 200, cookieClear());
  if (input?.action !== 'login') return reply({ error: 'Ação inválida.' }, 400);
  if (!adminConfigured(env)) return reply({ error: 'Acesso de administrador ainda não configurado na Cloudflare.' }, 503);

  // Limite aproximado por IP, armazenado sob chave DIFERENTE das listas antigas.
  // KV e eventual; também é recomendável configurar uma regra de rate limit no WAF.
  let key;
  try {
    key = await rateKey(request);
    const previous = await env.LIST?.get(key);
    const attempts = Math.max(0, Math.min(100, Number(JSON.parse(previous || '{}')?.attempts) || 0));
    if (attempts >= 8) return reply({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    if (!await checkPassword(input.password, env)) {
      await env.LIST?.put(key, JSON.stringify({ attempts: attempts + 1 }), { expirationTtl: 900 });
      return reply({ error: 'Senha incorreta.' }, 401);
    }
    await env.LIST?.delete(key);
  } catch (_) { return reply({ error: 'Verificação temporariamente indisponível.' }, 503); }
  return reply({ authenticated: true }, 200, await cookieMake(env));
}