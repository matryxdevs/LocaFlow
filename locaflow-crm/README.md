# LocaFlow CRM — gestão B2B de locação de veículos

**Versão 1.0.1 — correção de “Origem inválida” no login (Hostinger).** Veja `ATUALIZACAO-HOSTINGER.md` se o sistema já estiver publicado.

Projeto **Node.js + Express + MySQL 8+** com interface responsiva em português e arquitetura multiempresa. Uma instância atende diversas locadoras, preservando os dados por `company_id`.

## Funcionalidades entregues

- **Superadministrador**: cadastra locadoras e o primeiro gestor; visualiza a lista de empresas e pode suspender/reativar o acesso.
- **Gestor da locadora**: gerencia equipe, altera acesso de operadores e redefine senhas.
- **Gestor/operador**: painel de indicadores, cadastro/edição/exclusão de clientes, veículos e leads; registro de locações, controle de status e proteção contra choque de datas.
- **Segurança implementada**: senhas com bcrypt (custo 12), sesssões no MySQL com cookie HttpOnly/SameSite/Secure em produção, proteção CSRF, Helmet/CSP, limitação de tentativas de login, verificação de papel e locadora em todas as operações, queries SQL parametrizadas, logs mínimos de auditoria, invalidação de sessões após troca de senha.
- **Compatibilidade**: renderização no servidor via EJS; CSS e JavaScript locais, sem dependência de CDN. Inicialização com `npm start` / `process.env.PORT` / `0.0.0.0`.

> Este é um **MVP funcional de código-fonte**, não uma garantia de invulnerabilidade. Antes da operação comercial com dados reais, realize testes com MySQL, revisão de segurança, pentest, política LGPD, backup, monitoramento, autenticação multifator e procedimentos de resposta a incidentes.

## Requisitos

- Node.js 22.13+ (preferencialmente uma versão LTS disponível na hospedagem).
- MySQL 8.0+ ou serviço compatível, com InnoDB e charset `utf8mb4`.
- HTTPS obrigatório em produção.
- Serviço de hospedagem que execute aplicação Node.js **continuamente**. Hospedagem apenas PHP/HTML não executa o CRM.

## Instalação local

1. Extraia o projeto e execute no terminal:

   ```bash
   npm install
   ```

2. Crie um banco MySQL vazio chamado `locaflow` (ou outro nome) e **importe o arquivo `sql/schema.sql` no banco selecionado** pelo phpMyAdmin ou cliente MySQL:

   ```bash
   mysql -u seu_usuario -p locaflow < sql/schema.sql
   ```

3. Copie `.env.example` para `.env` e configure host, porta, banco, usuário, senha e chave de sessão:

   ```bash
   cp .env.example .env
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   Copie o resultado do último comando para `SESSION_SECRET`. Não publique `.env` no GitHub.

4. Para criar **uma única conta principal** (a senha inicial deve ser forte), adicione **temporariamente** as três linhas no `.env`:

   ```ini
   ADMIN_EMAIL=admin@seudominio.com.br
   ADMIN_PASSWORD=CrieUmaSenha#Forte12345
   ADMIN_NAME=Administrador
   ```

   Em seguida rode:

   ```bash
   npm run create-admin
   ```

   **Remova** `ADMIN_PASSWORD`, `ADMIN_EMAIL` e `ADMIN_NAME` do `.env` após executar. Também é possível fornecer as variáveis apenas no ambiente de execução.

5. Inicie o projeto:

   ```bash
   npm start
   ```

   Acesse `http://localhost:3000` e entre com o administrador. Cadastre a primeira locadora em **Empresas**. O gestor cadastrado poderá acessar a própria conta, criar usuários e registrar a frota.

## Deploy na Hostinger (Node.js)

1. Confirme que o seu plano **suporta Node.js**, com uma aplicação backend em execução. Caso não suporte, use VPS ou hospedagem compatível.
2. Crie um banco **MySQL** e usuário, anote host, banco, usuário, senha e porta. Importe `sql/schema.sql` pelo phpMyAdmin, **selecionando esse banco**.
3. Envie o projeto pelo GitHub (crie repositório privado; **nunca inclua `.env`**). Faça deploy da pasta raiz que contém `package.json`.
4. Configure a aplicação com o comando de inicialização `npm start` e a versão Node.js suportada (22.13 ou superior).
5. No painel de variáveis de ambiente, configure `NODE_ENV=production`, `APP_ORIGIN=https://crm.seudominio.com.br` (domínio público real), `SESSION_SECRET` forte, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Na Hostinger com **proxy reverso HTTPS confiável que reescreva os headers encaminhados**, configure `TRUST_PROXY=1` para que o Express reconheça requisições HTTPS e emita o cookie de sessão Secure. Não defina `PORT` manualmente se a hospedagem já fornecer.
6. Ative o certificado SSL e configure o domínio/subdomínio HTTPS. Verifique o `/health` (retorna `{"status":"ok"}` sem expor dados) e faça login.
7. Execute `npm run create-admin` **uma única vez** via terminal da hospedagem, com `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME` definidos temporariamente. Caso o plano não ofereça terminal, crie o administrador em ambiente confiável apontado ao banco permitido pelo provedor; não disponibilize rota pública de criação de administrador.
8. Desative acesso remoto público do banco, sempre que possível, e proteja o painel de administração da hospedagem com MFA.

### Variáveis de ambiente

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `NODE_ENV` | Sim em produção | `production` |
| `PORT` | Fornecida pelo host ou opcional | `3000` |
| `APP_ORIGIN` | Sim em produção | `https://crm.seudominio.com.br` |
| `APP_ALLOWED_ORIGINS` | Não | URLs alternativas explicitamente permitidas, separadas por vírgula |
| `SESSION_SECRET` | Sim | 96+ caracteres hex aleatórios |
| `DB_HOST` | Sim | host privado do banco |
| `DB_PORT` | Sim | `3306` |
| `DB_NAME` | Sim | `locaflow` |
| `DB_USER` | Sim | usuário próprio do CRM |
| `DB_PASSWORD` | Sim | senha forte |
| `DB_SSL` | Não | `false` ou `true` |
| `DB_SSL_CA_PATH` | Se `DB_SSL=true` | caminho do arquivo CA confiável |
| `TRUST_PROXY` | Conforme a arquitetura | `0` ou `1` |

**Observação TLS do banco:** habilite `DB_SSL=true` somente com o certificado CA configurado pelo provedor (`DB_SSL_CA_PATH`) para validar o servidor; a opção não aceita certificado não confiável. Para serviços em redes externas, use TLS ou túnel privado.

## Estrutura

```text
locaflow-crm/
  src/
    server.js        # middlewares, sessão, login, superadmin, conta
    origin.js        # validação de origem compatível com proxy HTTPS
    crm.js           # clientes, veículos, leads, locações, equipe
    auth.js          # autenticação, permissões e auditoria
    db.js            # conexão MySQL
    validators.js    # validação de entradas
  views/             # templates EJS do painel
  public/            # CSS, JS, favicon locais
  sql/schema.sql     # tabelas / chaves estrangeiras / índices
  scripts/create-admin.js
  tests/validators.test.js
  tests/origin.test.js
  ATUALIZACAO-HOSTINGER.md
  hostinger.env.example
  .env.example
  package.json
```

## Regras de negócio e permissões

- `superadmin` **somente** administra as locadoras; não acessa diretamente seus dados comerciais.
- `company_admin` administra **apenas** sua empresa, equipe e dados do CRM.
- `agent` consulta e gerencia **apenas** registros da empresa onde está cadastrado.
- `company_id` é inserido com base **na sessão**, nunca aceito do formulário. As FKs compostas de locações impedem atrelar veículos/clientes de outra locadora.
- Cada reserva exige cliente e veículo da mesma empresa, valida datas e bloqueia sobreposição com reservas ou locações ativas. Reservas encerradas ou canceladas não bloqueiam novos períodos.
- **Fim exclusivo:** retirada `10/12`, devolução `12/12` corresponde a duas diárias.
- Valores de receita exibidos no dashboard são **previsões baseadas nas reservas e locações**, não representam pagamentos confirmados.
- Os formulários do MVP **não processam cobranças e não emitem contratos fiscais**.

## Segurança e conformidade: checklist de entrada em produção

1. Mantenha Node.js e dependências atualizadas; rode `npm audit` e controle vulnerabilidades conhecidas. Gere e versione `package-lock.json` via `npm install` no ambiente com internet.
2. Use HTTPS, HSTS, cookies Secure e proxy confiável; não exponha a porta interna Node à internet se o proxy não for confiável.
3. Configure backup automatizado criptografado do MySQL e teste a restauração. Estabeleça RPO/RTO.
4. Restrinja o usuário de banco a `SELECT, INSERT, UPDATE, DELETE` nas tabelas do CRM após importar o esquema. O código de execução não exige CREATE TABLE (`user_sessions` já existe no SQL).
5. Implemente MFA, auditoria centralizada, alertas de autenticação, WAF, política de retenção, consentimentos/bases legais apropriadas e canal de atendimento a titulares (LGPD) antes de disponibilizar para múltiplos clientes reais.
6. Formalize testes de isolamento entre locadoras, análise de vulnerabilidades e testes de penetração antes do lançamento.
7. Não conceda credenciais de superadministrador a outras locadoras. Envie credenciais iniciais por canal seguro e exija troca de senha no primeiro acesso (funcionalidade **a ser adicionada**).

## Testes

```bash
npm run check
```

Verifica sintaxe JavaScript, testes unitários de validação e verificações de origem para formulários. Não substitui testes de integração em banco real ou testes de segurança. A integração completa depende de instalar dependências Node e disponibilizar um MySQL de testes.

## Evoluções recomendadas

- Gestão de propostas, contratos digitais e vistorias por veículo.
- Registro de pagamentos e inadimplência, cobrança recorrente, repasse e emissão de documentos fiscais via serviços compatíveis.
- Agenda de reservas com calendário, alertas de vencimento e manutenção preventiva.
- API de captura de leads do site/WhatsApp por webhook autenticado; **não** coletar ou publicar tokens no frontend.
- MFA, renovação de senha obrigatória no primeiro login e provisionamento seguro.
- Paginação SQL, relatórios exportáveis (LGPD), observabilidade, backups com testes periódicos.

---

**Aviso importante:** este repositório entrega código pronto para configurar e executar, mas não inclui conexão a serviços reais, credenciais ou implantação automática. Nenhum sistema conectado à internet pode ser considerado imune a invasões; adote defesa em camadas e validação independente.
