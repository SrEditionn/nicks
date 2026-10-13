export default {
  async fetch(req, env) {
    const H = {
      'Access-Control-Allow-Origin': '*',
      'content-type': 'application/json',
      'cache-control': 'no-store'
    };
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { ...H, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    }
    if (url.pathname === '/list') {
      const code = url.searchParams.get('code') || '';
      if (!env.LIST || !/^[\w-]{6,64}$/.test(code)) return new Response('{"error":"config"}', { status: 400, headers: H });
      const key = 'l:' + code;
      if (req.method === 'POST') {
        const txt = await req.text();
        let ok = false;
        try { ok = Array.isArray(JSON.parse(txt)) && txt.length < 400000; } catch (e) {}
        if (!ok) return new Response('{"error":"invalid"}', { status: 400, headers: H });
        await env.LIST.put(key, txt);
        return new Response('{"ok":true}', { headers: H });
      }
      const v = await env.LIST.get(key);
      return new Response(JSON.stringify({ list: v ? JSON.parse(v) : null }), { headers: H });
    }
    const ids = (url.searchParams.get('ids') || '')
      .split(',').filter(x => /^\d+$/.test(x)).slice(0, 100);
    if (!ids.length) return new Response('{}', { headers: H });
    const q = ids.join(',');
    const get = u => fetch(u).then(r => r.json()).catch(() => ({}));
    const UA = { 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' };

    const [users, body, head] = await Promise.all([
      fetch('https://users.roblox.com/v1/users', {
        method: 'POST',
        headers: { ...UA, 'content-type': 'application/json' },
        body: JSON.stringify({ userIds: ids.map(Number), excludeBannedUsers: false })
      }).then(r => r.json()).catch(() => ({})),
      get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${q}&size=420x420&format=Png&isCircular=false`),
      get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${q}&size=150x150&format=Png&isCircular=false`)
    ]);

    const out = {};
    ids.forEach(id => out[id] = {});
    (users.data || []).forEach(u => { if (out[u.id]) out[u.id].name = u.name; });

    // Plano B: busca o nick de cada um separadamente (limite de 50 chamadas por requisição)
    let budget = 45;
    for (const host of ['users.roblox.com', 'users.roproxy.com']) {
      const missing = ids.filter(id => !out[id].name).slice(0, budget);
      if (!missing.length) break;
      budget -= missing.length;
      await Promise.all(missing.map(async id => {
        try {
          const r = await fetch(`https://${host}/v1/users/${id}`, { headers: UA });
          if (r.ok) { const j = await r.json(); if (j.name) out[id].name = j.name; }
        } catch (e) {}
      }));
    }

    (body.data || []).forEach(t => { if (out[t.targetId]) { out[t.targetId].body = t.imageUrl || ''; if (t.state === 'Pending') out[t.targetId].pending = true; } });
    (head.data || []).forEach(t => { if (out[t.targetId]) { out[t.targetId].img = t.imageUrl || ''; if (t.state === 'Pending') out[t.targetId].pending = true; } });
    return new Response(JSON.stringify(out), { headers: H });
  }
};