# Etapa 2 — transformar o DDTank Portal em jogo real (GitHub + Render)

**Situação atual (13/11/2026):** o Render hospeda apenas o portal Node.js e sua base PostgreSQL; o login admin foi demonstrado funcionando. O DDTank original **não** está integrado, executando ou migrado. Este documento é um inventário e um roteiro técnico, não uma implementação do multiplayer.

## Inventário técnico verificado neste repositório

| Subsistema original | Código encontrado | Restrições de execução |
|---|---|---|
| Servidor central | `Center.Server/` — `Center.Server.csproj` usa `net472` | .NET Framework, bibliotecas Windows e TCP (porta padrão **9202** conforme `CenterServerConfig.cs`) |
| Servidor de canal | `Game.Server/` — `Game.Server.csproj` usa `net472` | Dependências de `System.ServiceModel`, IPs embutidos no código de configuração |
| Batalhas | `Fighting.Server/` — `Fighting.Server.csproj` usa `net472` | Porta padrão **9208** conforme `FightServerConfig.cs`, protocolo de rede legado |
| Serviço de jogo | `Road.Service/` — `Road.Service.csproj` usa `net48` | Usa `System.ServiceProcess` e componentes de serviço Windows |
| Endpoints do jogo | `Tank.Request/` — `Tank.Request.csproj` usa `v4.7.2`, páginas `.aspx`/`.ashx` | ASP.NET Web Forms/handlers legados: precisam de adaptação |
| GM/Admin legado | `GameAdmin/` — `AdminGunny.csproj` usa `v4.6` | ASP.NET Web Forms e IIS, sem compatibilidade direta com o serviço Node atual |
| Base original | `Database/Db_Membership.bak`, `Game34.bak`, `Player34.bak` | Backups binários SQL Server, **não** são scripts PostgreSQL |
| Cliente Flash | `Source Flash/`, `Tank.Flash/`, `Road.Flash/` | Precisa identificar SWF de entrada, recursos dependentes e API de rede; execução no Ruffle **não validada** |
| Launcher | `Source Launcher/` | Cliente Windows legado, não roda como página web |

## Restrições de hospedagem Render

- Render publica **HTTP(S) e WebSocket** em um único porto público para Web Services.
- Conexões TCP legadas da base DDTank não ficam automaticamente acessíveis de fora como se o Render fosse uma VPS com portas 9202 e 9208 expostas.
- O código `net472/net48` e o Web Forms não passam a funcionar em Linux apenas adicionando `render.yaml` ou Dockerfile.
- PostgreSQL do portal guarda `portal_users`/`portal_sessions` **separados** da base do DDTank. Não tentar renomear as tabelas do portal como se fossem tabelas originais do jogo.

Documentação oficial: https://render.com/docs/web-services e https://render.com/docs/websocket

## Critérios de aceite — implementar por fases

### Fase 2A: recuperar e documentar o modelo do jogo
- [ ] Restaurar **cópia** dos 3 backups `.bak` em SQL Server isolado, sem expor acesso de rede; inspecionar tabelas e tipos de dados.
- [ ] Identificar esquema real de contas, personagens, template de itens, inventário e mensagens.
- [ ] Construir scripts versionados de migração somente após descobrir o esquema (sem dados pessoais de jogadores).
- [ ] Validar compatibilidade de armazenamento e autorização por personagem.
- [ ] Remover credenciais antigas e IPs externos hardcoded antes de qualquer produção.

### Fase 2B: primeiro cliente real
- [ ] Localizar o SWF de entrada e todos os recursos do cliente.
- [ ] Executar experimento de compatibilidade com Ruffle sob HTTPS (pode não suportar API de socket exigida).
- [ ] Escolher entre adaptar cliente/protocolo ou reimplementar cliente web, mantendo regras/ativos autorizados.
- [ ] Estabelecer protocolo de login de jogo com sessão de curta duração, separado do token de sessão admin.

### Fase 2C: servidor multiplayer compatível com Render
- [ ] Migrar/reescrever componentes necessários do `Center.Server`, `Game.Server` e `Fighting.Server` para runtime multiplataforma.
- [ ] Implementar gateway WebSocket (`wss://.../game`) para conexões externas, com autenticação, validação de mensagens e limite de taxa.
- [ ] Permitir dois usuários reais em uma sala; sincronizar ações de turno, trajetória/projétil, danos e resultado.
- [ ] Salvar resultado, inventário e moedas sem perda ou duplicação após reinício.
- [ ] Testar ciclos de reconexão e deploy no Render.

### Fase 2D: painel GM ligado ao jogo real
- [ ] Consultar personagens/inventário **reais** em read-only primeiro.
- [ ] Criar catálogo de itens baseado nas tabelas originais.
- [ ] Enviar itens com permissão admin e registro de auditoria, evitando duplicatas e itens inexistentes.
- [ ] Testar crédito de moedas e presentes em uma conta de teste, sem alterar jogadores involuntariamente.

## Próxima unidade de trabalho executável

**Prioridade:** extração do esquema dos backups SQL Server e identificação do SWF de entrada. O repositório contém as fontes, mas falta confirmar se os backups restauram e se existe cliente executável compatível com browser. Esses dois passos determinam a arquitetura real do jogo. Não declarar que multiplayer ou painel GM de itens funcionam até passar nos testes de aceite.

## Segurança

O código legado contém configurações com possíveis credenciais. Não usar senhas encontradas em arquivos públicos. Não expor SQL Server ou interfaces GM à internet sem autenticação, e nunca compartilhar senha em prints. Confirmar licenças/autorização de uso de ativos antes da publicação.
