const { CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_PAGES_PROJECT:project }=process.env;
if(!token||!account||!project){console.log('Credenciais de diagnostico nao configuradas.');process.exit(0);}
const request=async suffix=>{
 const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+encodeURIComponent(project)+suffix,{
 headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
 const data=await res.json();return {status:res.status,success:data.success,result:data.result,errors:data.errors?.map(e=>e.code)};
};
const projectData=await request('');
const p=projectData.result||{};
const d=p.latest_deployment||{};
console.log(JSON.stringify({query:'project',status:projectData.status,success:projectData.success,name:p.name,subdomain:p.subdomain,production_branch:p.production_branch,latest:{id:d.id,url:d.url,environment:d.environment,created_on:d.created_on,branch:d.deployment_trigger?.metadata?.branch,stage:d.latest_stage?.name,stageStatus:d.latest_stage?.status},errors:projectData.errors}));
const list=await request('/deployments?per_page=8');
console.log(JSON.stringify({query:'deployments',status:list.status,success:list.success,items:(Array.isArray(list.result)?list.result:[]).map(d=>({id:d.id,url:d.url,environment:d.environment,branch:d.deployment_trigger?.metadata?.branch,created_on:d.created_on,stage:d.latest_stage?.name,status:d.latest_stage?.status})),errors:list.errors}));

console.log(JSON.stringify({query:'build',sourceType:p.source?.type,sourceRepo:p.source?.config?.repo_name,sourceBranch:p.source?.config?.production_branch,buildDestination:p.build_config?.destination_dir,buildCommand:p.build_config?.build_command,buildRoot:p.build_config?.root_dir,buildOutput:p.build_config?.build_output_dir,deploymentsEnabled:p.source?.config?.deployments_enabled,prComments:p.source?.config?.pr_comments_enabled}));
