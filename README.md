# ANKOO v5 · Minimalista + PIN de 4 dígitos

A versão v5 mantém o KV e os dados existentes, o explorador de amigos e a edição por sessão. As páginas / e /amigos/ usam o mesmo visual minimalista com cartões maiores.

## Como ativar edição

No Cloudflare Pages (projeto `anko` → Configurações → Variáveis e segredos → Produção), cadastre **somente um novo segredo:** `ANKOO_ADMIN_PASSWORD`, com **exatamente quatro números** (exemplo de formato `0123`, não use esse exemplo como senha). Não publique o PIN no GitHub. O binding KV `LIST` e o segredo `ANKOO_LIST_CODE` já precisam estar configurados — são os mesmos da lista existente.

`ANKOO_SESSION_SECRET` passa a ser **opcional**. Se já existir, o sistema continua usando-o para assinar cookies. Caso contrário, o servidor usa os segredos existentes do banco junto do PIN para assinar sessões; nada disso é enviado ao navegador. O PIN de 4 números não oferece segurança forte contra pessoas que tentem adivinhá-lo. Existe um limite básico de tentativas de login por IP pelo KV, mas esse controle não é proteção infalível. Não exponha o PIN.

A sessão utiliza cookie HttpOnly, Secure e SameSite=Strict. O antigo Worker ainda aceita o código original de sincronização; mantenha-o secreto.

## Publicação

Repositório: https://github.com/SrEditionn/nicks — executar manualmente a Action **Publicar no Cloudflare Pages (manual)** para enviar a atualização ao projeto existente. Para trocar o PIN, atualize a variável de produção e execute nova implantação se necessário. O site atual não é alterado até a execução do workflow.

## Arquivos

`public/index.html`, `public/amigos/index.html`: telas minimalistas. `public/minimal.css`: CSS compartilhado. `public/main.js`, `public/amigos/app.js`: funcionalidades originais mantidas. `functions/api/auth.js` e `src/auth.js`: autenticação por PIN.

## Testes

`node tests/test-auth.mjs`, `node tests/test-list.mjs`, `node tests/test-api.mjs`, `python tests/verificar_arquivos.py`.