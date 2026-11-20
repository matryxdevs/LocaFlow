# Atualização do LocaFlow CRM 1.0.1 — correção de login na Hostinger

Esta atualização corrige o erro **"Origem inválida — Operação bloqueada por segurança"** que podia aparecer ao clicar em **Acessar meu painel**. Não há mudança de tabelas do banco.

## O que foi corrigido

- O backend agora valida o `Origin` com o `Host` público efetivamente usado pelo navegador, em vez de depender somente de um `APP_ORIGIN` que pode ter sido configurado com outro domínio.
- Se o proxy reverso é explicitamente confiável (`TRUST_PROXY=1`), aceita também o `X-Forwarded-Host` estabelecido pelo proxy.
- O domínio canônico `APP_ORIGIN` continua aceito; se necessário, `APP_ALLOWED_ORIGINS` permite declarar domínios legítimos adicionais (separados por vírgula).
- Requisições cross-site continuam bloqueadas, e **o token CSRF é obrigatório** para login e formulários.

## Atualizar uma instalação existente

1. **Faça backup** dos arquivos publicados e do banco MySQL.
2. Na Hostinger, atualize o código-fonte da aplicação pelo fluxo de upload/deploy usado anteriormente. O pacote contém `package.json` na raiz da pasta `locaflow-crm/`; se a hospedagem exigir o conteúdo na raiz, envie o conteúdo dessa pasta, não a pasta pai.
3. Preserve todas as variáveis do ambiente já configuradas (não substitua `SESSION_SECRET`, `DB_PASSWORD` etc.).
4. Confirme `NODE_ENV=production` e `APP_ORIGIN=https://just-aquamarine-dunlin-37.hostingersite.com` **somente se esse ainda for o seu domínio real de acesso**. Se usar domínio próprio, coloque o domínio próprio.
5. Se a Hostinger executa Node.js por trás de um **proxy reverso HTTPS confiável** que sobrescreve os headers `X-Forwarded-*`, configure `TRUST_PROXY=1`. Isso é necessário para o Express reconhecer a conexão HTTPS e o cookie de sessão `Secure` ser emitido. Se não houver proxy confiável, mantenha `TRUST_PROXY=0` e configure a infraestrutura HTTPS adequadamente.
6. Confira suas variáveis `DB_HOST`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` com os dados **reais** da hospedagem. Não use textos como `HOST_FORNECIDO_PELA_HOSTINGER`.
7. Instale as dependências (`npm install`, se necessário), publique/reinicie a aplicação e verifique `/health`.
8. Abra `/login` em uma **nova janela anônima**, realize o login e confira o redirecionamento: superadmin → `/empresas`; locadora → `/dashboard`.

## Muito importante: preserve os dados existentes

- **Não apague o banco MySQL e não reinicialize as tabelas.** Esta versão não exige reimportar `sql/schema.sql`.
- **Não execute novamente `npm run create-admin`** se já existe a conta de superadministrador.
- **Não troque o `SESSION_SECRET`** ao atualizar. Caso seja alterado, sessões anteriores podem deixar de funcionar.
- **Não publique o `.env` no GitHub.** O projeto inclui apenas modelos com valores fictícios.

## Se persistir algum erro

- `Origem inválida`: compare o `Origin` do POST `/login` no DevTools com o endereço da barra do navegador; normalmente deve ser igual. Se houver proxy, verifique o encaminhamento do `Host` ou `X-Forwarded-Host` e o parâmetro `TRUST_PROXY`.
- `Sessão ou formulário inválido`: acesse `/login` novamente, confira os cookies HTTPS e o `TRUST_PROXY` na implantação com proxy.
- `ENOTFOUND`: `DB_HOST` continua com nome inexistente; confira o hostname MySQL no hPanel.
- `Access denied for user`: credenciais ou permissões do usuário MySQL incorretas.
- `status: unavailable` em `/health`: a consulta de teste ao banco falhou.

A correção foi verificada por testes automatizados de sintaxe e 17 cenários unitários. **Não foi possível testar a conexão com a instância MySQL da sua Hostinger neste ambiente.**
