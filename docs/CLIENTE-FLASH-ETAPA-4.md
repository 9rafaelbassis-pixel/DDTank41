# Etapa 4 — Carregador seguro do cliente Flash original (GitHub + Render)

**Status:** carregador e diagnósticos implementados; servidor original de jogo **não conectado**. Não é uma migração do jogo DDTank 4.1 concluída.

## Descobertas verificadas no repositório

- `Source Flash/FlashSV1/` contém **256 arquivos**; **249** deles estão na lista de recursos permitidos (`.swf`, `.xml`, `.png`, `.jpg`, `.txt` etc.), totalizando ~75 MB de recursos originais.
- São **120 arquivos SWF** em `FlashSV1`, incluindo `Launcher.swf`, `Loading.swf`, `DDT_Loading.swf` e `ui/vietnam/swf/_corei.swf`.
- O cliente tem arquivo `config.xml` referenciando `127.0.0.1`, servidores comerciais antigos e pastas com o nome vietnamita `ui/vietnam`; esse nome de pasta é um identificador técnico e **precisa permanecer** por compatibilidade, mesmo quando o conteúdo textual for traduzido.
- O servidor antigo usa TCP: `Game.Server` tem `Port=9500`, `Center.Server` usa `9202` e `Fighting.Server` usa `9208`. Nenhum desses serviços `net472/net48` está executando no Render atual.
- `ui/vietnam/language.txt` tem cerca de 3.520 linhas. A tradução do texto requer manter nomes de chaves, marcadores `{0}` e etiquetas HTML.

## O que esta atualização faz

1. Página `/game-client` visível **apenas a usuários autenticados**.
2. Usa Ruffle instalado no serviço Node, sem carregar scripts de terceiros.
3. Serve recursos permitidos em `/game-client/files/*`, a partir de um **manifesto fixado por hash Git**, conferindo comprimento e SHA1 Git de cada arquivo baixado.
4. Proxy não oferece acesso a `.bak`, `Web.config`, códigos-fonte ou caminhos arbitrários.
5. Reescreve o `config.xml` legado em memória para caminhos do mesmo domínio HTTPS, remove referências a URLs remotas antigas e políticas Flash inseguras. **Não altera o original no GitHub**.
6. Inclui política CSP só da página de teste para impedir scripts e conexões externas e usa configurações Ruffle `allowNetworking:internal` / `openUrlMode:deny`.
7. Expõe `/game-client/status` com indicação explícita de que a autenticação Flash e o protocolo de batalha original ainda não foram integrados.
8. Verifica manifestos, hashes e JavaScript na suíte `npm test`.

## Tradução PT-BR do cliente

Foi criada a Action `DDTank Flash language PT-BR`, para gerar `language.txt` preservando chaves e placeholders. Resultado é **tradução automática para revisão**, não localização oficial. O carregador ainda não substitui a língua até a versão PT-BR ser produzida, inspecionada e vinculada ao caminho antigo; o nome de pasta `vietnam` continua por necessidade técnica.

## Teste após deploy

1. No Render, confirme o novo commit como **Live** antes de acessar.
2. Faça login no portal em `/login` e visite `/game-client`.
3. Clique em **Conferir arquivos**: deve retornar HTTP 200 com tamanho do SWF.
4. Selecione `Launcher.swf` e clique em **Abrir o cliente original**.
5. Se travar, verifique **Console / Network** no navegador e envie erros (sem credenciais). O carregador pode exibir apenas a tela inicial porque não há um servidor legado disponível.
6. Use `/game-client/status` para confirmar o estágio, sem confundir com multiplayer real.
7. Se houver erro 502 nos recursos, verifique os logs do Render e a conectividade com GitHub raw. O serviço usa cache em memória limitado a 24MB; não salva recursos em disco.

## Caminho para jogo completo

- Identificar e restaurar/portar o serviço de autenticação `Tank.Request` e dados reais de personagens.
- Construir uma ponte WS ↔ TCP binário **somente após** haver um `Game.Server` confiável acessível na rede privada. Ruffle suporta `socketProxy` com `{host,port,proxyUrl}`, mas isso **não cria** um servidor de jogo.
- Portar `Center.Server`, `Game.Server` e `Fighting.Server` para runtime compatível ou hospedar o legado em ambiente autorizado adequado e conectá-lo por uma ponte segura.
- Integrar pacotes de sala, mapa, tiro, resultado, inventário e correio do jogo original com testes de regressão e controle administrativo.
- Contratar armazenamento permanente para dados de jogadores antes de permitir progressão pública; o PostgreSQL Free do Render é temporário e não tem backups gerenciados.

Referências de tecnologia:
- https://ruffle.rs/js-docs/master/interfaces/Config.SocketProxy.html
- https://render.com/docs/websocket

## Ponte opcional WS ↔ TCP (código implementado, desativado)

A rota `/game-client/socket` agora contém um **relay binário** que entrega bytes de Ruffle WebSocket a um destino TCP fixado pelo operador. A ponte valida sessão do portal, origem do navegador, tamanho de mensagens e limite de conexões. Não permite que o usuário escolha destinos TCP arbitrários.

Por padrão, a ponte está **desativada**. Ativá-la exige **um servidor original compatível já executando** e configurado em ambiente apropriado. Ela não cria o `Game.Server`, não converte a física e não autentica o protocolo legado.

Configuração necessária no ambiente do serviço, **somente depois de existir servidor confiável**:
- `DDTANK_TCP_BRIDGE_ENABLED=true` (padrão implícito `false`)
- `DDTANK_TCP_HOST=ddtank-game.internal` — host privado confiável, acessível pelo serviço Render (exemplo, não é um host existente)
- `DDTANK_TCP_PORT=9500` — porta real do `Game.Server`
- `DDTANK_FLASH_SOCKET_HOST=127.0.0.1` — **host requisitado pelo próprio SWF**, precisa ser verificado antes de usar
- `DDTANK_FLASH_SOCKET_PORT=9500` — porta requisitada pelo SWF
- `PUBLIC_ORIGIN=https://ddtank-web.onrender.com`

O Ruffle só recebe `socketProxy=[{host,port,proxyUrl}]` se **todas as variáveis forem válidas** e a chave de habilitação estiver ligada. Do contrário, não tenta encaminhar conexões externas. O relay só manipula bytes, não conhece contas, itens, pacotes de batalha nem o conteúdo da aplicação.

**Não habilite a ponte apontando para IPs desconhecidos encontrados no código antigo.** O host `ddtank-game.internal` acima é apenas ilustrativo. O Render hospeda WebSockets públicos na mesma porta do serviço HTTP e não publica portas TCP arbitrárias para o navegador. Fonte: https://render.com/docs/websocket .
