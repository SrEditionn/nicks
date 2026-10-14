const {CLOUDFLARE_API_TOKEN: token,CLOUDFLARE_ACCOUNT_ID: account,CLOUDFLARE_PAGES_PROJECT:project}=process.env;
if(!token||!account||!project)throw Error('Credenciais Cloudflare indisponíveis.');
const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+encodeURIComponent(project);
async function query(method,body){
  const response=await fetch(url,{method,headers:{authorization:'Bearer '+token,accept:'application/json',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
  const j=await response.json();
  if(!response.ok||!j.success)throw Error('Falha API Cloudflare '+response.status+' codigos '+(j.errors||[]).map(e=>e.code).join(','));
  return j.result;
}
const current=await query('GET');
if(current.name!==project||current.source?.type!=='github'||current.source?.config?.repo_name!=='nicks'||current.production_branch!=='main')
  throw Error('Identidade do projeto não corresponde; nenhuma alteração aplicada.');
const dest=current.build_config?.destination_dir??'';
if(dest==='public'){console.log('Diretório de saída já está definido como public.');process.exit(0)}
if(dest!==''&&dest!=='/')throw Error('Diretório inesperado: '+dest+'; nenhuma alteração aplicada.');
await query('PATCH',{build_config:{destination_dir:'public'}});
const verified=await query('GET');
if(verified.build_config?.destination_dir!=='public')throw Error('Não foi possível confirmar a configuração após atualização.');
console.log(JSON.stringify({success:true,project:verified.name,source:verified.source?.type,destination_dir:verified.build_config.destination_dir,production_branch:verified.production_branch}));
