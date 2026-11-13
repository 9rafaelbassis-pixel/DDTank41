# DDTank41 — Render Web Foundation (fase 1)

**Importante:** este componente é um portal web **separado** do servidor DDTank original. Registro e login aqui **não** criam contas no DDTank legado. O painel lista apenas contas do portal; ainda não envia itens, moedas ou comandos ao jogo.

## Recursos implementados
- Site responsivo, cadastro e login com scrypt
- Sessões persistidas no PostgreSQL (token salvo somente como hash)
- Painel administrativo com listagem de contas do portal
- Dashboard com status da integração original explicitamente **offline**
- Health check /health, limites de requisições, cabeçalhos de segurança
- Blueprint `render.yaml` para Render Node + PostgreSQL

## Deploy pelo Render
1. Revise o PR e faça merge quando estiver satisfeito.
2. Render Dashboard > New > Blueprint > conecte `9rafaelbassis-pixel/DDTank41`.
3. Configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` com senha longa e exclusiva (NÃO coloque no GitHub).
4. Aplique o Blueprint. A API ficará em `https://<nome-do-servico>.onrender.com`.
5. Para verificação, abra `/health`; ele retorna JSON com estado do banco.

O primeiro boot cria as tabelas do **portal** e a conta administradora somente se não existir. O valor de ADMIN_PASSWORD é lido nessa inicialização; mudar a variável depois **não redefine** a senha existente.

## Desenvolvimento
```sh
cd render-web
npm install
cp .env.example .env
# Configure DATABASE_URL e a senha somente no .env local
npm start
```

## Limitações do jogo original (fase 2, ainda pendente)
- `Game.Server` depende de .NET Framework 4.7.2, e `GameAdmin` de ASP.NET 4.6/IIS.
- Banco original contém backups `.bak` de SQL Server; **não são** compatíveis diretamente com PostgreSQL.
- O protocolo multiplayer possui portas TCP próprias. Render Web Services expõem HTTP/HTTPS, não essas portas TCP públicas.
- O cliente Flash precisa de análise específica com Ruffle ou de reimplementação autorizada.
- Para rodar **tudo** no Render será necessária portabilidade profunda do jogo, persistência e protocolo de comunicação (ex.: WebSocket), não apenas um Dockerfile.
- Nenhuma dessas funcionalidades legadas está implementada neste PR.

## Segurança
O repositório original contém segredos hardcoded em configurações legadas. Não reutilize essas credenciais, troque-as no banco original e retire segredos do histórico se forem ativos. Não exponha SQL Server à internet. Antes de conectar o painel ao jogo, definir API autenticada, controle de acesso e trilha de auditoria.

## Recuperação de acesso administrativo

A conta administradora é criada pelo `ADMIN_EMAIL` e `ADMIN_PASSWORD` do Render, **não** pela tela pública `/register`. O formulário público cria somente contas `player`. `/admin` redireciona para `/login` quando não há sessão; contas `player` recebem 403 ao entrar.

Se esqueceu a senha do admin já existente:
1. Render > serviço `ddtank-web` > Environment: confirme o `ADMIN_EMAIL` correto.
2. Atualize `ADMIN_PASSWORD` com **nova senha forte** (12+ caracteres), mantendo-a somente nas variáveis privadas do Render.
3. Adicione `ADMIN_RESET_PASSWORD_ON_BOOT=true` e salve com redeploy.
4. Após o deploy, faça login em `/login` com o e-mail e a **nova senha**. Então abra `/admin`.
5. Volte à Environment e **remova** `ADMIN_RESET_PASSWORD_ON_BOOT` (ou altere para `false`) para evitar redefinições em futuros reinícios.

Essa operação só redefine uma conta que **já possui role `admin`** com o mesmo e-mail, e invalida sessões anteriores. Por segurança, nunca promove uma conta `player` automaticamente. Caso `ADMIN_EMAIL` já pertença a uma conta comum, escolha um endereço de e-mail *ainda não cadastrado* para provisionar uma nova conta admin (ou execute migração administrativa autenticada posteriormente). Não compartilhe senha nem strings de conexão em prints ou commits.
