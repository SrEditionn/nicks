// Diagnóstico público do Roblox; nenhuma conta, cookie ou segredo utilizado.
const userId = '3206729645';
const endpoints = [
  ['avatar_atual_v1', 'https://avatar.roblox.com/v1/users/' + userId + '/avatar'],
  ['avatar_atual_v4', 'https://avatar.roblox.com/v4/avatar/users/' + userId],
  ['roupas_salvas_v2', 'https://avatar.roblox.com/v2/avatar/users/' + userId + '/outfits?itemsPerPage=10&outfitType=Avatar&page=1'],
];
for (const [name, url] of endpoints) {
  try {
    const r = await fetch(url, {signal: AbortSignal.timeout(9500)});
    const raw = await r.text();
    let json = null;
    try { json=JSON.parse(raw); } catch {}
    const obj = json && typeof json==='object' ? json : {};
    console.log(JSON.stringify({
      name, status:r.status, ok:r.ok,
      keys:Object.keys(obj).slice(0,15),
      savedOutfits:Array.isArray(obj.data)?obj.data.length:undefined,
      currentAssets:Array.isArray(obj.assets)?obj.assets.length:undefined,
      errorCode:obj.code??obj.errors?.[0]?.code??null,
      errorMessage:String(obj.errors?.[0]?.message??obj.message??'').slice(0,150)
    }));
  } catch(e) {console.log(JSON.stringify({name,error:String(e.message).slice(0,160)}));}
}

const get=async url=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(9000)});return {status:r.status,j:await r.json()}}catch(e){return {status:0,j:{}}}};
const api='https://avatar.roblox.com';
const avatar=(await get(api+'/v1/users/'+userId+'/avatar')).j;
const saved=(await get(api+'/v2/avatar/users/'+userId+'/outfits?itemsPerPage=10&outfitType=Avatar&page=1')).j;
const aSig=x=>Array.isArray(x?.assets)?x.assets.map(a=>String(a.id)).sort().join(','):'';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
for(const outfit of (saved.data||[]).slice(0,10)){
 const info=await get(api+'/v3/outfits/'+outfit.id+'/details');
 const data=info.j;
 console.log(JSON.stringify({outfit:outfit.id,status:info.status,keys:Object.keys(data).slice(0,16),assets:data.assets?.length,equalAssets:aSig(avatar)===aSig(data),colors:!!data.bodyColors,scales:!!data.scales,equalScales:eq(avatar.scales,data.scales),equalColors:eq(avatar.bodyColors,data.bodyColors),type:avatar.playerAvatarType===data.playerAvatarType}));
}
