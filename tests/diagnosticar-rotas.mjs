const base='https://ankoo.pages.dev';
const paths=['/','/amigos/','/amigos','/amigos/?user=8550700071','/amigos?user=8550700071','/amigos/index.html?user=8550700071','/api/auth'];
for(const path of paths){
 try{ const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{accept:'text/html,application/json'}});
 console.log(JSON.stringify({path,status:r.status,redirect:r.headers.get('location'),type:r.headers.get('content-type'),size:r.headers.get('content-length')}));
 }catch(e){console.log(JSON.stringify({path,error:String(e.message)}));}
}
