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
