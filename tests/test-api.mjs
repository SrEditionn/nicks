import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const src = await fs.readFile(new URL('../functions/api/roblox.js', import.meta.url), 'utf8');
const {onRequestGet} = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(src)}`);
const calls = [];
globalThis.fetch = async (url, options={}) => {
  const u = new URL(url);
  calls.push(u.pathname);
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
const thumb=await get('/api/roblox?action=thumbnails&ids=1,2&type=head');
assert.equal(thumb.body.images.length,2);
assert.equal((await get('/api/roblox?action=friends&userId=x')).status,400);
assert.equal((await get('/api/roblox?action=thumbnails&ids=1,abc&type=head')).status,400);
console.log('API testada: perfil, amigos (paginação), nomes, miniaturas, validação.');