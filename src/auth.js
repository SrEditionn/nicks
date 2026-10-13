/**
 * Autenticacao Ankoo. Segredos exclusivos do Pages, jamais incluidos no JavaScript publico.
 * Cookie HttpOnly assinado (HMAC SHA-256), SameSite=Strict, Secure.
 * O login de administrador NAO e o codigo antigo de sincronizacao da lista.
 */
const encoder = new TextEncoder();
const SESSION = 'ankoo_admin_session';
const WEEK = 7 * 24 * 60 * 60;
const toB64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromB64 = base64 => {
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
const utf8 = value => encoder.encode(value);
const decode = bytes => new TextDecoder().decode(bytes);
const secureEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
};
const hash = text => crypto.subtle.digest('SHA-256', utf8(text));
const hmacKey = secret => crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const sign = async (secret, message) => crypto.subtle.sign('HMAC', await hmacKey(secret), utf8(message));
// O PIN é o único segredo adicional necessário; a lista KV já usa ANKOO_LIST_CODE.
export const adminConfigured = env =>
  /^\d{4}$/.test(String(env?.ANKOO_ADMIN_PASSWORD ?? '')) &&
  /^[\w-]{6,64}$/.test(String(env?.ANKOO_LIST_CODE ?? '')) && Boolean(env?.LIST);
const sessionKey = env =>
  typeof env.ANKOO_SESSION_SECRET === 'string' && env.ANKOO_SESSION_SECRET.length >= 32
    ? env.ANKOO_SESSION_SECRET
    : `ankoo-session-v5:${env.ANKOO_LIST_CODE}:${env.ANKOO_ADMIN_PASSWORD}`;
export const assertSameOrigin = request => {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
};
export const cookieClear = () => `${SESSION}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
export const cookieMake = async env => {
  const now = Math.floor(Date.now() / 1000);
  const claim = toB64(utf8(JSON.stringify({ exp: now + WEEK, iat: now, nonce: toB64(crypto.getRandomValues(new Uint8Array(12))) })));
  const signature = toB64(await sign(sessionKey(env), claim));
  return `${SESSION}=${claim}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${WEEK}`;
};
export const isAdmin = async (request, env) => {
  if (!adminConfigured(env)) return false;
  const rawCookies = request.headers.get('cookie') || '';
  const token = rawCookies.split(';').map(x => x.trim()).find(x => x.startsWith(`${SESSION}=`))?.slice(SESSION.length + 1);
  if (!token) return false;
  const [claim, signature, excess] = token.split('.');
  if (!claim || !signature || excess || claim.length > 400 || signature.length > 100) return false;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(sessionKey(env)), fromB64(signature), utf8(claim));
    if (!valid) return false;
    const parsed = JSON.parse(decode(fromB64(claim)));
    const now = Math.floor(Date.now() / 1000);
    return Number.isSafeInteger(parsed.exp) && parsed.exp > now && parsed.exp <= now + WEEK &&
      Number.isSafeInteger(parsed.iat) && parsed.iat <= now && parsed.iat > now - WEEK;
  } catch (_) { return false; }
};
export const checkPassword = async (password, env) => {
  if (!adminConfigured(env) || typeof password !== 'string' || !/^[0-9]{4}$/.test(password)) return false;
  const [a, b] = await Promise.all([hash(password), hash(env.ANKOO_ADMIN_PASSWORD)]);
  return secureEqual(new Uint8Array(a), new Uint8Array(b));
};
export const rateKey = async request => {
  const ip = request.headers.get('CF-Connecting-IP') || 'unspecified';
  return `ankoo:login:${toB64(await hash(ip))}`;
};