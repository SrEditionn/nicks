from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / 'public/index.html').read_text(encoding='utf-8')
main = (root / 'public/main.js').read_text(encoding='utf-8')
friends = (root / 'public/amigos/app.js').read_text(encoding='utf-8')
assert 'href="/amigos/"' in html
assert 'id="srv"' not in html and 'id="cod"' not in html
assert 'id="drag-hint"' in html
assert 'roblox_nicks_v1' in main
assert 'user.ankoo.workers.dev' in main
assert 'scrollWhileDragging' in main
assert 'action:\'add\'' in main and 'unshift' in (root / 'functions/api/list.js').read_text()
assert 'saveProfile' in friends and 'is-saved' in friends
assert (root / 'functions/api/list.js').exists()
assert (root / 'functions/api/auth.js').exists()
assert (root / 'src/auth.js').exists()
assert (root / 'public/admin.js').exists() and (root / 'public/admin.css').exists()
assert 'isAdmin(request, env)' in (root / 'functions/api/list.js').read_text()
assert 'id="admin-anchor"' in html
assert 'id="admin-anchor"' in (root / 'public/amigos/index.html').read_text()
assert 'ANKOO_ADMIN_PASSWORD' in (root / 'src/auth.js').read_text()

assert 'friends/find' in (root / 'functions/api/roblox.js').read_text()
assert 'env.LIST' in (root / 'worker-original/worker.js').read_text()
print('Arquivos conferidos: autenticação, KV original, botões removidos, amigos, reordenação e rolagem.')