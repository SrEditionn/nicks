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

## Consulta de amigos: erro 401

A API primeiro tenta a paginação oficial do Roblox `/v1/users/{id}/friends/find`, sem forçar `FriendScore` (permite até 1.000 amigos quando autorizado). Se a primeira página retornar 400, 401 ou 403, tenta `/v1/users/{id}/friends`, que retorna no máximo 200 amigos. A interface informa quando os resultados são parciais. Se os dois endpoints recusarem acesso, apresenta uma mensagem clara; não utiliza cookies de login Roblox nem contorna restrições de privacidade. A correção foi testada com respostas simuladas: acesso normal, recusa 401 e fallback parcial. O funcionamento com Roblox real deve ser validado após a publicação.

## Abrir as amizades de um perfil ao adicioná-lo

Na página `/amigos/`, clicar em **Adicionar** num amigo ou no perfil de origem
salva o usuário na coleção principal e abre outra guia em `/amigos/?user=ID`.
A nova página já inicia a consulta por esse ID; a consulta da guia original
permanece aberta. O navegador determina se a guia recém-criada será
colocada em primeiro plano. Se bloquear pop-ups, a lista ainda é salva e o
site informa que é preciso autorizar novas guias para o Ankoo.


## Miniaturas de avatar 2D

As duas páginas exibem apenas **miniaturas raster estáticas** do Roblox: corpo inteiro por `/v1/users/avatar` em PNG 420×420 e rosto por `/v1/users/avatar-headshot` em PNG 150×150. Não usam `/v1/users/avatar-3d`, vídeo, modelo 3D ou visualizador animado. URLs GIF/APNG, endpoints de objetos 3D e miniaturas animadas antigas são ignorados na interface. As imagens de corpo inteiro são atualizadas pelo Worker original, que também solicita PNG 2D, com fallback no Pages.

**Limitação:** o próprio Roblox decide a pose usada na miniatura PNG. Uma pose diferente de pé reto ainda é uma **imagem 2D parada**, não um modelo 3D animado. Esta alteração não controla nem altera a pose do personagem.