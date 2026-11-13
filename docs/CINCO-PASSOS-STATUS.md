# DDTank41 — implantação em cinco etapas (status verificável)

**Regra principal:** o portal Node/PostgreSQL já existe e aceita contas. O motor antigo DDTank 4.1 (.NET Framework, ASP.NET/IIS, SQL Server, Flash TCP) NÃO foi migrado e não executa no Render. Não confundir recursos do portal com jogo final.

## 1. Personagens

- **Implementado** em `render-web/characters.js`: um personagem por conta do portal; nome único sem distinção de caixa; sexo; nível e moedas persistidos em PostgreSQL.
- URL `/character`. Dados associados à tabela `portal_users`.
- **Ainda falta**: vinculação auditável ao `Sys_Users_Detail.UserID` do SQL Server original; hash de senha legado não deve ser reaproveitado de forma insegura. A coluna `legacy_user_id` permanece NULL até haver ponte real.

## 2. Inventário e equipamentos

- **Implementado no portal**: `/inventory`, itens do catálogo `legacy_item_templates` importado do SQL original; botão equipar/desequipar para categorias básicas 1–9; slots simplificados sem pretender corresponder aos slots do DDTank.
- **Ainda falta**: espelhar `Sys_Users_Goods`, tipo de mochila/slot real, fortalecer (+), validade, atributos de composição, efeitos e assets; integrar visual no cliente original.

## 3. Cliente Flash

- **Implementado para diagnóstico**: `/admin/client-preview` e SWFs originais via Ruffle auto-hospedado no Render, com rede desativada.
- **Ainda falta**: descobrir e disponibilizar todos os SWFs/assets do cliente, alterar URLs antigas (configurações apontam para 127.0.0.1 e fornecedores antigos), ter autorização para publicar ativos, reproduzir autenticação e tráfego via `socketProxy`. Configurar `socketProxy` sem um servidor do protocolo original NÃO faz o jogo funcionar.

## 4. Multiplayer e batalhas

- **Implementado**: salas WebSocket de 2 contas reais do portal (`/lobby`), nomes dos personagens, bate-papo, experimento 1×1 com ângulo/força, trajetória, dano e turnos.
- **Ainda falta**: motor real `Center.Server` / `Game.Server` / `Fighting.Server` e protocol packets binários, mapas, cenas, regras e física original. Protótipo não salva histórico nem concede prêmios e não usa mapas originais. Precisaremos portar ou reimplementar o servidor sob HTTPS/WebSocket.

## 5. Painel GM

- **Implementado no portal**: `/admin/players` mostra personagens do portal e entrega itens reais por **TemplateID** ou ouro/cupons virtuais do portal, com transações SQL, idempotência via UUID e `admin_audit`.
- **Ainda falta**: envio via `User_Messages` e `Sys_Users_Goods` original, operação online contra `Game.Server`, sincronização do cliente Flash e conformidade da estrutura dos atributos. Nenhuma transação atual modifica jogadores do servidor legado.

## Como validar após deploy Live no Render

1. Faça login em duas contas diferentes e, em cada uma, crie um personagem em `https://ddtank-web.onrender.com/character`.
2. Na conta admin, abra `https://ddtank-web.onrender.com/admin/players`: copie o ID do personagem de teste, forneça um `TemplateID` válido de `/admin/catalog`, envie 1 unidade.
3. Faça login como o personagem e abra `/inventory`; o item deve aparecer e permitir equipar apenas quando categoria 1–9 (regra simplificada do portal).
4. Crie duas sessões e entre com ambas na sala `TESTE01` de `/lobby`. O painel exibe turnos e disparos (protótipo).
5. Para nomes: acompanhe o workflow `DDTank catalog — automated PT-BR translation` em Actions. Quando houver artifact bem-sucedido, baixe o JSON, revise exemplos e importe via `/admin/catalog`. Tradução automática não é tradução oficial nem garante correção sem revisão.

## Endurecimento antes da produção

- PostgreSQL free do Render tem expiração e não tem backups gerenciados; migre para armazenamento durável e configure cópias antes de abrir ao público.
- Rotacione credenciais hardcoded nos arquivos antigos. Não exponha backups com PII.
- Valide autenticação, rate limits, CSRF, jogos simultâneos, filas, reconexão e auditoria.
- Mantenha os testes do GitHub Actions obrigatórios antes de publicar.
- Não anuncie “DDTank 4.1 original online” enquanto o cliente Flash e o servidor C# não comunicarem e enquanto o combate original não funcionar ponta a ponta.
