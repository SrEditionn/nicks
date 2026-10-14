// Confere se o deploy automático do commit atual está atendendo URLs diretas.
const {CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_PAGES_PROJECT:project,GITHUB_SHA:commit}=process.env;
if(!token||!account||!project||!commit){console.log('Verificação de produção indisponível neste ambiente.');process.exit(0)}
const api='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+encodeURIComponent(project);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let deployed=false;
for(let attempt=0;attempt<24;attempt++){
  const response=await fetch(api,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  const deploy=result.result?.latest_deployment;
  const deployedHash=deploy?.deployment_trigger?.metadata?.commit_hash;
  if(deployedHash===commit&&deploy.latest_stage?.name==='deploy'&&deploy.latest_stage?.status==='success'){
    deployed=true;
    console.log('Cloudflare concluiu build do commit '+commit.slice(0,8));break;
  }
  await pause(5000);
}
if(!deployed)throw Error('Cloudflare não confirmou a implantação automática deste commit.');
const urls=['/','/main.js','/amigos/','/amigos/?user=8550700071','/amigos/app.js','/api/auth'];
let ok=false;
for(let attempt=0;attempt<10;attempt++){
  const responses=await Promise.all(urls.map(async path=>{
    try{const r=await fetch('https://ankoo.pages.dev'+path,{redirect:'follow',signal:AbortSignal.timeout(9000),headers:{accept:'text/html,application/javascript,application/json,*/*'}});return {path,status:r.status}}
    catch(e){return {path,error:String(e.message)}}
  }));
  console.log('Teste '+(attempt+1)+': '+JSON.stringify(responses));
  if(responses.every(x=>x.status===200)){ok=true;break;}
  await pause(5000);
}
if(!ok)throw Error('Uma ou mais rotas continuam indisponíveis no domínio principal.');
console.log('URLs diretas, atualização e página de amigos acessíveis.');
