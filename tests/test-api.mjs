import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const src = await fs.readFile(new URL('../functions/api/roblox.js', import.meta.url), 'utf8');
const {onRequestGet} = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(src)}`);
const calls = [];
globalThis.fetch = async (url, options={}) => {
  const u = new URL(url);
  calls.push(u.pathname);
  if(u.hostname === 'avatar.roblox.com') {
    if(u.pathname === '/v1/users/12345/avatar') return Response.json({
      assets:[{id:17},{id:29}],bodyColors:{headColorId:1},scales:{height:1},playerAvatarType:'R15'
    });
    if(u.pathname === '/v2/avatar/users/12345/outfits') return Response.json({data:[{id:654321}]});
    if(u.pathname === '/v3/outfits/654321/details') return Response.json({
      assets:[{id:29},{id:17}],bodyColors:{headColorId:1},scales:{height:1},playerAvatarType:'R15'
    });
    if(u.pathname === '/v1/users/67890/avatar') return Response.json({
      assets:[{id:999}],bodyColors:{headColorId:1},scales:{height:1},playerAvatarType:'R15'
    });
    if(u.pathname === '/v2/avatar/users/67890/outfits') return Response.json({data:[{id:765432}]});
    if(u.pathname === '/v3/outfits/765432/details') return Response.json({
      assets:[{id:999}],bodyColors:{headColorId:9},scales:{height:1},playerAvatarType:'R15'
    });
    throw Error('Unexpected Avatar API: '+url);
  }
  if(u.hostname === 'friends.roblox.com') {
    if (u.pathname === '/v1/users/98765/friends/find') return new Response('{}', {status:401});
    if (u.pathname === '/v1/users/98765/friends') return Response.json({data:[{id:20},{id:21}]});
    if (u.pathname === '/v1/users/87654/friends/find' || u.pathname === '/v1/users/87654/friends') return new Response('{}', {status:401});
    assert(u.pathname === '/v1/users/12345/friends/find');
    assert.equal(u.searchParams.has('userSort'), false);
    const cursor=u.searchParams.get('cursor');
    return Response.json(cursor ? {PageItems:[{id:3}],NextCursor:null}:{PageItems:[{id:1},{id:2}],NextCursor:'next'});
  }
  if(u.hostname === 'users.roblox.com'){
    if(u.pathname === '/v1/users/12345') return Response.json({id:12345,name:'SampleOwner',displayName:'Owner'});
    if(u.pathname === '/v1/users') {
      const ids=JSON.parse(options.body).userIds;
      return Response.json({data:ids.map(id=>({id,name:`name${id}`,displayName:`display${id}`}))});
    }
  }
  if(u.hostname === 'thumbnails.roblox.com'){
    if(u.pathname === '/v1/users/outfits')return Response.json({data:[{targetId:654321,state:'Completed',imageUrl:'https://tr.rbxcdn.com/neutral.png'}]});
    assert.equal(u.searchParams.get('format'), 'Png', 'A imagem deve ser PNG estático');
    assert(!u.pathname.includes('-3d'), 'Não usar a API 3D');
    return Response.json({data:u.searchParams.get('userIds').split(',').map(x=>({targetId:Number(x),state:'Completed',imageUrl:`https://tr.rbxcdn.com/${x}`}))});
  }
  throw Error('Unmocked: '+url);
};
const get=async url => {
 const resp=await onRequestGet({request:new Request('https://ankoo.pages.dev'+url)});
 return {status:resp.status,body:await resp.json()};
};
assert.deepEqual((await get('/api/roblox?action=profile&userId=12345')).body,{id:'12345',name:'SampleOwner',displayName:'Owner'});
const first=await get('/api/roblox?action=friends&userId=12345');
assert.equal(first.status,200);
assert.deepEqual(first.body.friends.map(x=>x.name), ['name1','name2']);
assert.equal(first.body.nextCursor,'next');
const second=await get('/api/roblox?action=friends&userId=12345&cursor=next');
assert.deepEqual(second.body.friends.map(x=>x.id),['3']);
assert.equal(second.body.nextCursor,null);
const fallback=await get('/api/roblox?action=friends&userId=98765');
assert.equal(fallback.status,200);
assert.deepEqual(fallback.body.friends.map(x=>x.id),['20','21']);
assert.equal(fallback.body.limited,true);
assert.equal(fallback.body.nextCursor,null);
const rejected=await get('/api/roblox?action=friends&userId=87654');
assert.equal(rejected.status,403);
assert.match(rejected.body.error,/duas consultas públicas/);
const fullBody=await get('/api/roblox?action=thumbnails&ids=1,2&type=body');
assert.equal(fullBody.body.images.length,2);
assert(calls.includes('/v1/users/avatar'), 'Precisa usar imagem de corpo inteiro 2D');
const detail=await get('/api/roblox?action=details&ids=1,2');
assert.equal(Object.keys(detail.body.profiles).length,2);
const stand=await get('/api/roblox?action=neutral&userId=12345');
assert.equal(stand.status,200);
assert.equal(stand.body.available,true);
assert.equal(stand.body.imageUrl,'https://tr.rbxcdn.com/neutral.png');
const mismatch=await get('/api/roblox?action=neutral&userId=67890');
assert.equal(mismatch.status,200);
assert.equal(mismatch.body.available,false);
assert.equal((await get('/api/roblox?action=neutral&userId=invalid')).status,400);
const thumb=await get('/api/roblox?action=thumbnails&ids=1,2&type=head');
assert.equal(thumb.body.images.length,2);
assert.equal((await get('/api/roblox?action=friends&userId=x')).status,400);
assert.equal((await get('/api/roblox?action=thumbnails&ids=1,abc&type=head')).status,400);
console.log('API testada: perfil, amigos (paginação), nomes, miniaturas, validação.');