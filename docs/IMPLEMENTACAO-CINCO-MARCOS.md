# DDTank original — cinco marcos e critérios de aceite

Atualizado em 13/11/2026. **Importante:** o portal Node.js e o PostgreSQL do Render não são o servidor original do DDTank.

## 1) Servidor original em Windows isolado

**Implementado nesta entrega:** GitHub Action `DDTank - Validar servidor legado Windows` tenta compilar os executáveis C# originais `Center.Service`, `Fighting.Service` e `Road.Service` usando MSBuild do Windows; gera resumo dos resultados sem divulgar credenciais nem publicar binários. Um script `tools/legacy/Check-Legacy-Runtime.ps1` confere executáveis e só tenta iniciar em VM Windows explicitamente autorizada e com SQL Server ativo.

**Bloqueio:** a implantação real em uma VM Windows (ou a migração do runtime .NET Framework) e o SQL Server permanente exigem infraestrutura adequada. GitHub Actions Windows é efêmero e não é hospedagem de jogo. O serviço público do Render permite HTTPS/WSS, não expõe livremente TCP 9500 ao navegador.

**Critério de aceite:** serviços originais iniciam com bancos de teste restaurados, logs sem falhas, portas 9202/9208/9500 acessíveis **apenas dentro da rede confiável** e conexões SQL verificadas. Não usar as credenciais embutidas em arquivos históricos.

## 2) Login entre portal e servidor real

**Implementado nesta entrega:** `render-web/game-tickets.js` gera tickets aleatórios de 256 bits, válidos por 120 segundos, vinculados a um personagem do portal. Só um servidor com chave privada de integração pode resgatar, e o resgate é atômico/uso único. O portal não compartilha e-mail, senha ou papel admin com o backend.

- Endpoint do jogador: `POST /game-access/ticket` exige sessão de portal **e CSRF**.
- Endpoint do backend: `POST /internal/game-auth/redeem` exige `X-DDTank-Game-Secret` igual ao segredo configurado no servidor. A chave deve ter pelo menos 32 caracteres aleatórios.
- **Ambos desativados por padrão**, até `DDTANK_GAME_AUTH_SECRET` existir somente no ambiente privado e um backend confiável ser conectado.
- `GET /game-access` explica o estado sem exibir segredos.
- O resgate devolve identificador e apelido do personagem do portal. **Não** cria ou valida automaticamente `Sys_Users_Detail` / `Mem_UserInfo` e não autoriza combate.
- Os handlers ASP.NET legados tiveram removida uma condição `if (true)` que pulava validação de login. `CreateLogin.aspx.cs` voltou a exigir `LoginIP` explicitamente configurado.

**Bloqueio:** ainda falta mapear o contrato real do Launcher e sincronizar jogador no SQL Server/Center.Server. Não inserir a chave de integração no HTML/Flash; somente o backend confiável deve conhecê-la.

## 3) Rede entre Ruffle e servidor original

**Já existia:** `render-web/legacy-bridge.js` fornece relay WSS→TCP binário, com sessão autenticada, verificação de origem e destino fixo por variáveis de ambiente. Ele continua desligado até existir servidor compatível.

**Bloqueio:** o `Launcher.swf` atualmente requer APIs HTTP antigas, e a ponte TCP não substitui essas APIs nem o protocolo da versão Flash. Habilitar `DDTANK_TCP_BRIDGE_ENABLED=true` sem servidor confiável não resolve nada.

**Critério de aceite:** o Flash obtém um ticket válido, recebe lista real de servidores, abre socket por Ruffle/WSS e autentica contra `Game.Server` original, com reconexão segura.

## 4) Batalha real 1×1

**Já existia:** `/lobby` aceita duas contas e um protótipo próprio de tiros. **Isso não é** a lógica do DDTank 4.1.

**Bloqueio:** precisa executar `Game.Server`/`Fighting.Server`, enviar pacotes binários reais, carregar mapas, físicas, armas, resultados, pontuação e persistir em SQL Server com testes.

**Critério de aceite:** duas contas diferentes entram na mesma partida via Launcher original, jogam uma batalha até o final, saem, entram novamente e encontram resultado/inventário sem duplicação.

## 5) PT-BR e painel GM original

**Já existia:** catálogo de 7.638 TemplateIDs e arquivo Flash externo com 3.530 linhas PT-BR **experimentais**, com fallback para vietnamita; o GM gerencia personagens **do portal** e tem auditoria. Esta entrega acrescenta `/admin/integration`, diagnóstico em português das dependências (sem expor chaves), tickets ativos e últimas ações GM.

**Bloqueio:** nomes traduzidos automaticamente ainda requerem revisão; o Launcher tem texto vietnamita embutido nos próprios SWFs. Enviar itens ao jogo real exige descobrir campos de `Sys_Users_Goods`/`User_Messages` e integração autorizada com backend legado, sem writes cegos nos backups.

## Segurança crítica

O repositório histórico contém códigos antigos com **credenciais e chaves embutidas**. O arquivo `Source Launcher/api/config.php` foi convertido para usar variáveis de ambiente, mas isso **não apaga os segredos do histórico Git nem de outros arquivos**. Antes de hospedar serviços originais, rotacione todas as senhas, chaves de pagamento, tokens e credenciais SQL, revise `Tank.Request/Web.config` e outros arquivos de configuração e trate valores antigos como comprometidos.

**Jamais configure SQL Server ou portas 9202/9208/9500 publicamente sem firewall e isolamento.** Não ponha o backend C# em produção até concluir autorização, revisão e testes.

## Checklist de implantação para o operador

1. GitHub Actions → `DDTank - Validar servidor legado Windows`: confira se os 3 serviços C# compilam (e quais erros aparecem).
2. Em VM **Windows isolada** sob seu controle, instale SQL Server, restaure cópias dos backups e configure `App.config`/conexões privadas com credenciais novas. Não copie senhas do histórico.
3. Execute `tools/legacy/Check-Legacy-Runtime.ps1` para conferir pré-requisitos. Não use `-Start` até revisar os serviços e a configuração dos IPs.
4. Na conta admin do portal, acesse `/admin/integration` e veja quais dependências estão pendentes. Na conta jogador, `/game-access` indica status da integração.
5. Somente depois de o servidor C# estar pronto, configure chave de integração exclusiva de 32+ bytes e o destino TCP confiável, teste tickets e os pacotes do cliente Flash; **nunca habilite por tentativa e erro**.

### Links técnicos

- Render Web Services: https://render.com/docs/web-services
- Render WebSockets: https://render.com/docs/websocket
- Ruffle URL Rewrite: https://ruffle.rs/js-docs/master/interfaces/Config.URLLoadOptions.html

## Protocolo real localizado no C#

`Game.Base/Packets/StreamProcessor.cs` e `Game.Base/Packets/GSPacketIn.cs` definem o enquadramento original dos pacotes, incluindo:

- Marcador big-endian `29099` (`0x71AB`);
- Comprimento e cabeçalho de 20 bytes;
- Código do pacote, identificador do cliente e dois parâmetros `Int32`;
- Checksum calculado pelo código original;
- Criptografia/chave de sessão variável após autenticação (`m_client.Encryted`).

Foi criado `render-web/legacy-packets.js` para **decodificar apenas o cabeçalho de pacotes não cifrados**, com testes de tamanhos e campos. Não registra payloads, não captura senhas e **não altera os bytes** da ponte WSS↔TCP. Pacotes criptografados ou o handshake completo exigem execução do backend e análise em ambiente isolado. Não confundir este decodificador com um servidor de batalhas.

Também foi acrescentado teste de ponta a ponta do transporte WSS↔TCP usando serviço TCP local de eco no CI, e teste de emissão/resgate de tickets em PostgreSQL 16 temporário. Nenhum desses testes finge que o `Fighting.Server` está online.

## Configuração protegida dos serviços legados

Por segurança, esta entrega deixa **vazios no GitHub** os campos `conString`, `crosszoneString`, `privateKey`, `LoginKey`, `ChargeKey` e `SentRewardKey` nas configurações originais que os continham. Links externos antigos também foram neutralizados em `Tank.Request/Web.config`.

**Isso é intencional:** as aplicações C# podem compilar, porém não devem conseguir se autenticar no banco nem iniciar corretamente até receber novas configurações por uma implantação privada, separada do repositório público. Não recrie esses valores em commits, PRs, logs ou screenshots. Use exclusivamente um gerenciador de segredos, arquivos privados no host e credenciais novas/rotacionadas.

As credenciais publicadas anteriormente **continuam acessíveis no histórico do Git**; a alteração do commit atual não revoga senhas nem APIs de terceiros. Faça a rotação fora do GitHub e avalie a limpeza do histórico com cautela (reescrever histórico pode afetar forks e clones, e não revoga credenciais que já vazaram).

Por isso, **não habilite `-Start` em `Check-Legacy-Runtime.ps1`** antes de configurar SQL Server e os endpoints privados com novos segredos.
