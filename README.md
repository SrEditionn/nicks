# ANKOO v4 · Interface unificada + login com diagnóstico

Versão baseada nos arquivos `index.html` e `worker.js` originais fornecidos pelo proprietário. **Código-fonte do repositório GitHub `SrEditionn/nicks`. A publicação na Cloudflare é manual, pelo GitHub Actions.** Os arquivos originais são mantidos em `worker-original/` para referência.

## O que faz

- **`/` (público, leitura):** exibe a lista de nicks (`@username`), corpo 2D e rosto, atualiza as miniaturas ao abrir ou retornar à aba e permite copiar nickname/abrir perfis. Lista compartilhada carregada automaticamente via Pages KV; não há botões Servidor ou Sincronizar.
- **Administrador:** o botão **Entrar para editar** abre o login. Autenticado, pode adicionar, remover e reorganizar perfis; novos entram no topo, sem duplicatas. Arrastar perto da parte superior/inferior rola a página automaticamente. Pode sair do modo edição. A sessão é válida por **7 dias neste navegador** (ou até sair).
- **`/amigos/`:** qualquer visitante pode pesquisar até 1.000 amizades públicas de um perfil Roblox e visualizar corpo 2D e miniatura. Visitantes copiam URLs ou abrem perfis; administradores adicionam perfis pesquisados ou amigos diretamente à lista principal. Os botões de adicionar solicitam login se necessário.
- **`/api/roblox`:** consultas públicas ao Roblox.
- **`GET /api/list`:** lista pública; **`POST /api/list`:** apenas administrador com cookie assinado.
- **`GET /api/auth` e `POST /api/auth`:** consulta de sessão, login e logout. A senha fica exclusivamente em segredo da Cloudflare; o navegador recebe um cookie `HttpOnly`, `Secure`, `SameSite=Strict`, assinado por HMAC e válido por 7 dias. O navegador **nunca recebe** o código de sincronização antigo. Há um limite aproximado de tentativas de login por IP no KV (também é recomendável proteção WAF).

**Atenção:** ter a senha de administrador equivale a ter permissão de edição. Não divulgue a senha; outras pessoas com ela também poderão editar. O Worker original ainda aceita a chave de sincronização antiga, então esse código também deve continuar secreto. Após validar a migração, considere bloquear a rota de escrita `/list` no Worker antigo, para não existir outro caminho de edição.

## Visual e diagnóstico de login (v4)

A página principal `/` usa agora o **mesmo tema** da página `/amigos/`: cabeçalho, fundo escuro, cores lilás, cartões com a skin grande e foto de rosto, tamanhos configuráveis e filtro por nick/ID. O botão de copiar continua copiando exclusivamente o @nick. A lista e o Worker original não foram alterados.

Se **Entrar para editar** não funcionar, clique nele: em vez de desativar o botão, o site mostra quais configurações do administrador faltam. O endpoint `GET /api/auth` responde algo como `{ "authenticated": false, "configured": false, "missing": ["ANKOO_ADMIN_PASSWORD"] }`, sem revelar nenhuma senha. Corrija a variável no ambiente **Produção** do Cloudflare Pages, como **Secret**, com nome exato. `ANKOO_ADMIN_PASSWORD` exige no mínimo 12 caracteres; `ANKOO_SESSION_SECRET`, 32. Clique em **Verificar novamente**. Se o erro persistir, confira se a vinculação e os segredos estão associados ao mesmo projeto Pages em produção e faça nova implantação, se necessário.

## Como manter os nicks já existentes

O Worker ORIGINAL `https://user.ankoo.workers.dev` usa o binding `LIST` do Cloudflare KV, com chave `l:CÓDIGO_ANTIGO`. **Não substitua esse Worker e não crie um novo KV.** A nova Pages Function acessará o mesmo KV e a mesma chave. A API bloqueia alterações se a lista antiga não for encontrada.

No projeto Cloudflare Pages já existente (identifique o nome exato no painel), antes de publicar:

1. Em **Configurações → Bindings**, adicione o namespace KV já utilizado pelo Worker original (geralmente `nicks-lista`) com o nome de binding **`LIST`**.
2. Em **Configurações → Variables and Secrets**, cadastre **três segredos** no ambiente de **Production** (marque a opção de criptografar/Encrypt):

   | Nome | Valor a configurar | Nunca publicar no GitHub |
   |---|---|---|
   | `ANKOO_LIST_CODE` | Código de sincronização antigo (mínimo 6, sem prefixo `l:`) | Sim |
   | `ANKOO_ADMIN_PASSWORD` | **Nova senha de administrador**, forte, pelo menos 12 caracteres | Sim |
   | `ANKOO_SESSION_SECRET` | **Segredo aleatório independente**, pelo menos 32 caracteres | Sim |

   Para gerar `ANKOO_SESSION_SECRET` com segurança, abra o Console do navegador e execute **localmente**:

   ```js
   Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('')
   ```

   Copie somente para a Cloudflare. **Nunca envie o resultado no chat ou em commits.**

3. Confirme a sincronização antes do deploy: no PC onde você costumava sincronizar, abra `https://ankoo.pages.dev` e use `F12 → Application/Aplicativo → Local Storage → rn_code` para consultar **localmente** o código usado no botão antigo. Copie o valor somente para `ANKOO_LIST_CODE`.
4. Verifique que o segredo antigo aponta para a lista certa, sem apagar o KV. Execute a implantação via Wrangler.

Se qualquer segredo administrativo faltar, a lista pode ser exibida, mas as edições ficam **bloqueadas**. A senha de edição é separada da chave antiga de sincronização; o usuário não precisa fornecer códigos de sincronização em novos dispositivos. Para editar em outro dispositivo, basta fazer login uma vez nele.

## Como implantar preservando `ankoo.pages.dev`

Projetos Pages criados com upload direto não são convertidos automaticamente para Git Integration. Para **manter o projeto atual e seu domínio**, guarde este código no GitHub e use o workflow manual `.github/workflows/publicar-cloudflare.yml`, que executa Wrangler.

1. Use este repositório `SrEditionn/nicks`, com os arquivos nas pastas da raiz. Como ele é público, nunca adicione segredos em commits.
2. No repositório → **Settings → Secrets and variables → Actions**, adicione os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` e a variável `CLOUDFLARE_PAGES_PROJECT` com o **nome exato** do projeto original no painel Cloudflare Pages.
3. Configure o binding `LIST` e os **três segredos** no Pages conforme descrito acima **antes** de publicar.
4. GitHub → **Actions → Publicar no Cloudflare Pages (manual) → Run workflow**. Os arquivos de `public/` são enviados ao Pages; as Functions de `functions/` são empacotadas pelo Wrangler.
5. Valide a lista antiga no endereço `https://ankoo.pages.dev/api/list`, a visualização pública em `/`, o login de administrador e a adição de perfis em `/amigos/`.

**Nunca envie** o valor de segredos, capturas contendo senhas, tokens Cloudflare ou um backup do KV para o GitHub. O workflow só publica após acionamento manual.

## Arquivos importantes

```text
public/index.html                   Pagina de nicks (publico + modo edicao)
public/main.js                      Lista, atualizacao, ordenacao, botoes
public/admin.js + admin.css         Modal de login compartilhado
public/amigos/index.html            Busca amizades
public/amigos/app.js + style.css     Cards e adicionar pela pagina de amigos
functions/api/auth.js               Login e logout
src/auth.js                         Assinatura/validacao HMAC, verificacao de senha
functions/api/list.js               GET publico, POST autenticado, Cloudflare KV
functions/api/roblox.js             Integracao Roblox
worker-original/                    Backups dos dois arquivos originais
.github/workflows/                  Deploy manual do GitHub no Pages existente
tests/                              Testes locais
```

## Testar antes de implantar

```bash
node tests/test-auth.mjs
node tests/test-list.mjs
node tests/test-api.mjs
python tests/verificar_arquivos.py
python tests/test-ui-dom.py  # requer Playwright e Chromium instalados
```

Esses testes usam KV, sessão e respostas Roblox simulados; a integração real só pode ser validada após configurar o Pages. O Workers KV tem consistência eventual e não garante atualização instantânea entre dispositivos; gravações simultâneas em alta frequência podem precisar de um Durable Object no futuro.
