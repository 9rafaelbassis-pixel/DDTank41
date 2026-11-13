# PT-BR experimental no cliente Flash do DDTank

Origem: arquivo original `Source Flash/FlashSV1/ui/vietnam/language.txt` — 3.530 linhas, preservando **todas as chaves, placeholders e marcas HTML**.

A tradução automática foi gerada no GitHub Actions e aprovada quanto à integridade dos marcadores, não quanto à fidelidade linguística. Alguns termos foram revisados manualmente no script `tools/migration/Prepare-Flash-Locale-PTBR.py`.

## Implantação sem alterar o arquivo original

Quando o arquivo `render-web/locale/flash-ui-language.ptbr.txt` estiver presente, a rota autenticada `/game-client/files/ui/vietnam/language.txt` devolverá a versão PT-BR experimental **somente para usuários do portal**. O caminho **continua** `ui/vietnam` por requisito técnico da versão original; o conteúdo passa a estar em português. O arquivo vietnamita original permanece intacto no repositório, disponível via `?original=1`.

O carregador só substitui texto externo. **Textos desenhados no próprio SWF** — como a primeira tela de login vietnamita — não serão modificados por esse arquivo. É necessário editar/localizar o SWF ou substituí-lo por um fluxo autenticado seguro para eliminar todas as palavras vietnamitas dessa tela.

## Controles

- O arquivo é opcional: o portal deve continuar iniciando mesmo sem ele.
- Para desativar a tradução experimental no Render, defina `DDTANK_FLASH_PTBR=false`.
- `/game-client/status` indica `translatedLocaleAvailable` e `translatedLocaleActive`.
- `X-DDTank-Translation: pt-BR-experimental` é enviado quando o arquivo PT-BR é servido.
- O script de preparação **rejeita qualquer mudança** em chaves, ordem, número de linhas, marcadores ou tags HTML.
- A Action `Publish PT-BR Flash language candidate to review branch` copia o artifact validado para uma **nova branch**, não para a `main`. Abrir e integrar o PR após verificar resultado e testes. A validação de placeholders não garante tradução natural e precisa.

## Limite de integração

Esta localização não resolve a API de login `127.0.0.1`, o servidor `.NET Framework`, o protocolo de batalha nem os bancos do jogo original. A única autenticação funcional até a migração é a conta do portal Node/PostgreSQL.
