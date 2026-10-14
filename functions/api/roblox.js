/**
 * Cloudflare Pages Function — /api/roblox?action=profile|friends|thumbnails
 * Uses only public Roblox endpoints. No Roblox cookie or API key required.
 * Put this file in PROJECT_ROOT/functions/api/roblox.js (NOT dist/functions).
 */
const FRIENDS = 'https://friends.roblox.com';
const USERS = 'https://users.roblox.com';
const THUMBNAILS = 'https://thumbnails.roblox.com';

class ApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const json = (data, status = 200, extras = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extras,
  },
});

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value);

async function readRoblox(url, init = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(14000) });
    } catch (error) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 320 * (attempt + 1)));
        continue;
      }
      throw new ApiError('Não foi possível conectar à API do Roblox. Tente novamente.', 502);
    }

    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 420 * (attempt + 1)));
      continue;
    }
    if (response.status === 429) {
      throw new ApiError('O Roblox está limitando as consultas. Tente novamente em alguns instantes.', 429);
    }
    if (response.status === 401) {
      throw new ApiError('O Roblox exigiu autenticação para acessar as amizades. Não foi possível consultar publicamente esse perfil.', 401);
    }
    if (response.status === 403) {
      throw new ApiError('O Roblox não permitiu acessar esses dados. As amizades podem estar restritas.', 403);
    }
    if (response.status === 404) {
      throw new ApiError('Usuário não encontrado no Roblox.', 404);
    }
    if (!response.ok) {
      throw new ApiError(`A API do Roblox retornou erro ${response.status}.`, 502);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new ApiError('A API do Roblox retornou uma resposta inválida.', 502);
    }
  }
}

export async function onRequestGet({ request }) {
  try {
    const query = new URL(request.url).searchParams;
    const action = query.get('action');
    const userId = query.get('userId');

    if (action === 'profile') {
      if (!validId(userId)) throw new ApiError('Informe um ID de usuário válido.', 400);
      const user = await readRoblox(`${USERS}/v1/users/${userId}`, {}, 1);
      return json({ id: String(user.id), name: user.name || '', displayName: user.displayName || user.name || '' });
    }

    if (action === 'friends') {
      if (!validId(userId)) throw new ApiError('Informe um ID de usuário válido.', 400);
      const cursor = query.get('cursor');
      if (cursor !== null && (cursor.length > 512 || /[\x00-\x1f]/.test(cursor))) {
        throw new ApiError('Cursor de paginação inválido.', 400);
      }

      // For unauthenticated lookups do not force FriendScore (primarily meant for
      // the account's own friends). Roblox defaults to a suitable public sort.
      // /friends/find paginates at 50; public /friends can return at most 200.
      const url = new URL(`${FRIENDS}/v1/users/${userId}/friends/find`);
      url.searchParams.set('limit', '50');
      if (cursor) url.searchParams.set('cursor', cursor);
      let entries, nextCursor = null, limited = false;
      try {
        const page = await readRoblox(url.toString());
        if (!Array.isArray(page.PageItems)) throw new ApiError('Resposta de amizades inválida.', 502);
        entries = page.PageItems;
        nextCursor = typeof page.NextCursor === 'string' && page.NextCursor ? page.NextCursor : null;
      } catch (findError) {
        // A denied first page may still be readable via the older public route.
        // Never replace a subsequent paginated page with the first 200 entries.
        if (cursor || ![400, 401, 403].includes(findError.status)) throw findError;
        try {
          const fallback = await readRoblox(`${FRIENDS}/v1/users/${userId}/friends`, {}, 1);
          if (!Array.isArray(fallback.data)) throw new ApiError('Resposta de amizades inválida.', 502);
          entries = fallback.data;
          limited = true;
        } catch (fallbackError) {
          if ([401, 403].includes(fallbackError.status)) {
            throw new ApiError('O Roblox recusou as duas consultas públicas de amizades (acesso não autorizado). Este perfil pode exigir autenticação ou ter amizades restritas.', 403);
          }
          throw fallbackError;
        }
      }

      const ids = [...new Set(entries.map((entry) => String(entry?.id ?? '')).filter(validId))];
      let details = new Map();
      if (ids.length) {
        try {
          const users = await readRoblox(`${USERS}/v1/users`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ userIds: ids.map(Number), excludeBannedUsers: false }),
          }, 1);
          details = new Map((users.data || []).map((user) => [String(user.id), user]));
        } catch (_) {
          // Usernames are optional. Retain the complete set of friends if name lookup fails.
        }
      }
      return json({
        friends: ids.map((id) => ({
          id,
          name: details.get(id)?.name || `ID ${id}`,
          displayName: details.get(id)?.displayName || details.get(id)?.name || `ID ${id}`,
        })),
        nextCursor,
        limited,
        ...(limited ? { note: 'O Roblox liberou apenas a consulta de até 200 amigos. A lista pode estar incompleta.' } : {}),
      });
    }

    if (action === 'details') {
      const ids = [...new Set((query.get('ids') || '').split(',').map(id => id.trim()))];
      if (!ids.length || ids.length > 50 || !ids.every(validId)) throw new ApiError('Informe entre 1 e 50 IDs válidos.', 400);
      const q = ids.join(',');
      const [profiles, bodies, heads] = await Promise.all([
        readRoblox(`${USERS}/v1/users`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({userIds:ids.map(Number),excludeBannedUsers:false})}, 1),
        readRoblox(`${THUMBNAILS}/v1/users/avatar?userIds=${q}&size=420x420&format=Png&isCircular=false`, {}, 1),
        readRoblox(`${THUMBNAILS}/v1/users/avatar-headshot?userIds=${q}&size=150x150&format=Png&isCircular=false`, {}, 1),
      ]);
      const out = Object.fromEntries(ids.map(id => [id, {}]));
      for (const user of profiles.data || []) if (out[String(user.id)]) out[String(user.id)].name = user.name;
      for (const image of bodies.data || []) if (out[String(image.targetId)]) out[String(image.targetId)].body = image.imageUrl || '';
      for (const image of heads.data || []) if (out[String(image.targetId)]) out[String(image.targetId)].img = image.imageUrl || '';
      return json({ profiles: out });
    }

    if (action === 'thumbnails') {
      const rawIds = query.get('ids') || '';
      const ids = [...new Set(rawIds.split(',').map((id) => id.trim()))];
      if (!ids.length || ids.length > 50 || !ids.every(validId)) {
        throw new ApiError('Informe entre 1 e 50 IDs válidos.', 400);
      }
      const type = query.get('type');
      if (type !== 'body' && type !== 'head') throw new ApiError('Tipo de imagem inválido.', 400);
      const url = new URL(`${THUMBNAILS}/v1/users/${type === 'body' ? 'avatar' : 'avatar-headshot'}`);
      url.searchParams.set('userIds', ids.join(','));
      url.searchParams.set('size', type === 'body' ? '420x420' : '150x150');
      url.searchParams.set('format', 'Png');
      url.searchParams.set('isCircular', 'false');
      const result = await readRoblox(url.toString());
      return json({ images: (result.data || []).map((item) => ({
        id: String(item.targetId),
        url: typeof item.imageUrl === 'string' && /^https:\/\//.test(item.imageUrl) ? item.imageUrl : null,
        state: item.state || 'Unknown',
      })) });
    }

    throw new ApiError('Ação desconhecida.', 400);
  } catch (error) {
    return json({ error: error instanceof ApiError ? error.message : 'Erro interno ao consultar o Roblox.' }, error instanceof ApiError ? error.status : 500);
  }
}