from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path(__file__).resolve().parents[1]
main_html=(root/'public/index.html').read_text()
main_js=(root/'public/main.js').read_text()
admin_js=(root/'public/admin.js').read_text()
friend_html=(root/'public/amigos/index.html').read_text()
friend_js=(root/'public/amigos/app.js').read_text()
mock='''
window.__items = [{id:'111',name:'OldNick',body:'',img:''},{id:'222',name:'Second',body:'',img:''}];
window.__isAdmin = false;
window.fetch = async function(url, options){
 url=String(url);
 if(url.includes('/api/auth')) {
  if(!options?.method)return new Response(JSON.stringify({authenticated:window.__isAdmin,configured:true}),{status:200});
  const p=JSON.parse(options.body);
  if(p.action==='logout')window.__isAdmin=false;
  else if(p.password==='4826')window.__isAdmin=true;
  else return new Response(JSON.stringify({error:'Senha incorreta.'}),{status:401});
  return new Response(JSON.stringify({authenticated:window.__isAdmin}),{status:200});
 }
 if(url.includes('/api/list')) {
   if(!options || !options.method) return new Response(JSON.stringify({list:window.__items}),{status:200});
   if(!window.__isAdmin)return new Response(JSON.stringify({error:'Somente administrador'}),{status:401});
   const p=JSON.parse(options.body);let added=0,exists=0;
   if(p.action==='add') for(const entry of [...p.items].reverse()) {
     if(window.__items.find(x=>x.id===entry.id))exists++;
     else { window.__items.unshift(entry);added++;}
   }
   if(p.action==='remove') window.__items=window.__items.filter(u=>u.id!==p.id);
   if(p.action==='move'){
      const idx=window.__items.findIndex(u=>u.id===p.id);window.__items.splice(p.toIndex,0,window.__items.splice(idx,1)[0]);
   }
   if(p.action==='update'){}
   return new Response(JSON.stringify({list:window.__items,added,exists}),{status:200});
 }
 if(url.includes('user.ankoo.workers.dev'))return new Response('{}',{status:503});
 if(url.includes('/api/roblox')){
   const q=new URL(url,'https://example.test').searchParams;
   if(q.get('action')==='details')return new Response(JSON.stringify({profiles:Object.fromEntries(q.get('ids').split(',').map(id=>[id,{name:'nick'+id}]))}));
   if(q.get('action')==='profile')return new Response(JSON.stringify({id:'12345',name:'Owner',displayName:'Owner Display'}));
   if(q.get('action')==='friends')return new Response(JSON.stringify({friends:[{id:'888',name:'Friend',displayName:'A Friend'}],nextCursor:null}));
   if(q.get('action')==='thumbnails')return new Response(JSON.stringify({images:[]}));
 }
 return new Response('{}',{status:404});
};
'''

def signin(page):
 page.locator('.ankoo-admin-toggle').wait_for()
 page.wait_for_function("document.querySelector('.ankoo-admin-toggle').disabled===false")
 page.locator('.ankoo-admin-toggle').click()
 page.locator('#ankoo-admin-password').fill('4826')
 page.locator('.ankoo-login-send').click()
 page.wait_for_function('window.AnkooAdmin.authenticated===true')

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 pg=b.new_page(); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.goto('about:blank');pg.set_content(main_html.replace('<script src="/main.js" defer></script>','').replace('<script src="/admin.js" defer></script>',''))
 pg.evaluate(mock);pg.add_script_tag(content=admin_js);pg.add_script_tag(content=main_js)
 pg.locator('.card').nth(1).wait_for()
 assert pg.locator('.card').count()==2
 assert pg.locator('#cod').count()==0 and pg.locator('#srv').count()==0
 assert pg.locator('#add').is_hidden() and pg.locator('#in').is_hidden(), 'Guest cannot mutate'
 assert pg.locator('.tools button[title="Remover da lista"]').count()==2
 assert pg.locator('.tools button[title="Remover da lista"]').first.is_hidden()
 signin(pg)
 assert pg.locator('#add').is_visible() and pg.locator('#in').is_visible()
 pg.locator('#in').fill('https://www.roblox.com/pt/users/12345/profile');pg.locator('#add').click()
 pg.locator('.card').nth(2).wait_for()
 assert pg.locator('.card').first.get_attribute('data-id')=='12345'
 pg.locator('#in').fill('12345');pg.locator('#add').click()
 assert pg.locator('.card').count()==3
 pg.evaluate("document.body.style.minHeight = '3500px'")
 pg.evaluate("""const card=document.querySelector('.card');const dt=new DataTransfer();
 card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
 document.dispatchEvent(new DragEvent('dragover',{bubbles:true,clientY:innerHeight-3,dataTransfer:dt}));""")
 pg.wait_for_timeout(250)
 assert pg.evaluate('scrollY') > 0, 'A rolagem não começou'
 pg.evaluate("document.dispatchEvent(new DragEvent('dragend',{bubbles:true}))")
 pg.locator('.ankoo-admin-toggle').click()
 assert pg.locator('#add').is_hidden(), 'Signout disables edit'
 assert not errs,errs
 print('Navegador: pagina inicial publica somente leitura, login, novos no topo, deduplicação, arrastar e sair OK')

 pg2=b.new_page();err2=[];pg2.on('pageerror',lambda e:err2.append(str(e)))
 pg2.goto('about:blank');pg2.set_content(friend_html.replace('<script src="./app.js" defer></script>','').replace('<script src="/admin.js" defer></script>',''))
 pg2.evaluate(mock);pg2.evaluate('history.replaceState=()=>{}')
 pg2.add_script_tag(content=admin_js);pg2.add_script_tag(content=friend_js)
 pg2.locator('#profile-url').fill('https://www.roblox.com/pt/users/12345/profile');pg2.locator('#submit-button').click()
 pg2.locator('.friend-card').first.wait_for(timeout=5000)
 pg2.wait_for_function("document.querySelector('#storage-status').textContent.includes('conectada')")
 assert pg2.locator('.save-button').count()==1
 assert 'Entrar' in pg2.locator('.save-button').first.inner_text()
 pg2.locator('.save-button').first.click()
 assert pg2.locator('#ankoo-login-dialog').evaluate('(el)=>el.open')
 pg2.locator('#ankoo-admin-password').fill('4826');pg2.locator('.ankoo-login-send').click()
 pg2.wait_for_function('window.AnkooAdmin.authenticated===true')
 pg2.locator('.save-button').first.click()
 pg2.get_by_text('✓ Adicionado').first.wait_for(timeout=5000)
 assert pg2.evaluate('window.__items[0].id')=='888'
 assert not err2,err2
 print('Navegador: amigos publicos, pedir login, adicionar apos autenticacao e confirmar OK')
 b.close()