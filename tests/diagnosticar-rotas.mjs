const base='https://ankoo.pages.dev';
const paths=['/','/amigos/','/amigos','/amigos/?user=8550700071','/amigos?user=8550700071','/amigos/index.html?user=8550700071','/api/auth'];
for(const path of paths){
 try{ const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{accept:'text/html,application/json'}});
 console.log(JSON.stringify({path,status:r.status,redirect:r.headers.get('location'),type:r.headers.get('content-type'),size:r.headers.get('content-length')}));
 }catch(e){console.log(JSON.stringify({path,error:String(e.message)}));}
}

const origins=['https://ankoo.pages.dev','https://fdb34fbd.ankoo.pages.dev'];
const targets=['/index.html','/main.js','/minimal.css','/amigos/index.html','/amigos/app.js','/amigos/style.css','/amigos/?user=8550700071'];
for(const origin of origins)for(const path of targets){
 try{const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/155.0.0.0','sec-fetch-dest':'document','sec-fetch-mode':'navigate'}});
 console.log(JSON.stringify({origin,path,status:r.status,loc:r.headers.get('location'),type:r.headers.get('content-type'),server:r.headers.get('server'),cfCache:r.headers.get('cf-cache-status'),cfRay:r.headers.get('cf-ray')}));
 }catch(e){console.log(JSON.stringify({origin,path,error:e.message}))}
}
