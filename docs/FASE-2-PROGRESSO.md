# Fase 2 — Entrega incremental no GitHub + Render

Data: 2026-11-13. **Não confundir a fundação técnica com um servidor DDTank 4.1 completo.**

## Status implementado neste pacote

| Etapa solicitada | Implementação efetiva | Limitação restante |
| --- | --- | --- |
| 1. Banco original | `tools/migration/Export-DDTankCatalog.ps1` identifica `SP_Items_All`, exporta metadados de esquema e itens em JSON em lotes. `/admin/catalog` aceita lotes e os guarda em PostgreSQL com auditoria. | Os backups `.bak` não foram restaurados neste ambiente. O operador precisa de SQL Server local para extrair registros reais. As bases de personagens ainda não estão conectadas. |
| 2. Cliente Flash | `Audit-Flash.mjs` inventaria SWFs; `/admin/client-preview` testa os SWFs originais via Ruffle, sem permitir chamadas de rede externas. | Ruffle não foi validado para o jogo completo e o conteúdo legado precisa de recursos e comunicação de jogo. |
| 3. Multiplayer | `/lobby` e `/ws/lobby` permitem até **2 usuários autenticados** por sala, com presença e mensagens em tempo real via WebSocket; protege o upgrade com a sessão do portal, confere origem e faz ping/pong. | Salas ainda não executam combate, física, mapas ou comandos do protocolo DDTank. Memória temporária em uma instância; estado some após deploy. |
| 4. Painel GM | `/admin/catalog` lista modelos importados do SQL Server, pesquisa e audita importações; continua com a lista de usuários do portal. | Ainda não lê jogadores do banco antigo nem envia itens, presentes ou moedas ao servidor. |

## Como validar

1. Verifique no Render que o commit desta fase foi publicado como **Live**.
2. Faça login como administrador em `/login`; na tela `/admin` use os botões **Catálogo de itens originais** e **Testar cliente Flash**.
3. Para WebSocket abra `/lobby` em duas contas diferentes, em navegadores ou perfis separados. Entre na mesma sala `TESTE01` e troque mensagens. A sala é um teste de rede **real**, não uma batalha.
4. Para catálogo, instale/restaure **cópias** dos bancos SQL Server localmente; execute `tools/migration/Export-DDTankCatalog.ps1` conforme README; cole cada lote JSON no formulário do admin.
5. Não publique `migration-output`, logs de SQL Server, dados pessoais ou credenciais. O script lê somente templates e metadata do esquema.

## Próximos marcos necessários para jogo original

- Mapear e portar armazenamento de jogadores a partir de `Player34.bak` e `Db_Membership.bak`, com testes de integridade e senha.
- Recriar endpoints do `Tank.Request` compatíveis com o cliente.
- Fazer a ponte entre o protocolo TCP original (`Center.Server`, `Game.Server`, `Fighting.Server`) e o WebSocket suportado no Render ou portar o backend para runtime novo.
- Validar pipeline de batalha original e resultados duráveis; somente então habilitar inventário e operações GM (com limites, permissões e trilha de auditoria).
- Confirmar direitos de uso dos arquivos de jogo e substituir IPs/segredos antigos.

## Segurança e hospedagem

- Nunca publique os backups SQL Server ou credentials SQL no site. O exportador não inclui dados pessoais de jogadores.
- Interface GM deve ficar protegida; **não** altere o controle de acesso de `/admin/catalog` e `/admin/client-preview`.
- A conta admin do Render é definida pelas variáveis privadas `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- PostgreSQL gratuito do Render expira após **30 dias**, não tem backup gerenciado e não deve ser considerado persistente para um servidor público (https://render.com/docs/free).
- Não confundir o lobby WebSocket com um proxy do protocolo binário do cliente Flash. Ainda é necessário trabalhar autenticação, mensagens e regras de batalha.
