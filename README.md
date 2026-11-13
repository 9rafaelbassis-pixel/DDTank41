# DDTank 4.1 — Projeto de integração em português (Brasil)

Este repositório reúne o **código original do servidor DDTank**, o cliente Flash, os backups SQL Server e um portal moderno para cadastro, personagens e testes. O objetivo é restaurar o jogo com sua aparência original, **sem confundir os testes do portal com uma versão completa e jogável**.

## Estado atual

| Módulo | Situação |
| --- | --- |
| Portal Node.js/PostgreSQL no Render | Cadastro, login, personagens e painel GM do portal implementados |
| Catálogo de itens | 7.638 modelos originais importáveis, nomes PT-BR ainda sujeitos a revisão |
| Cliente Flash / Ruffle | Launcher original abre; tradução externa PT-BR experimental |
| Multiplayer do portal | Salas e demonstração de tiro 1×1, **não** o combate original |
| Serviços C# originais | Compilação Windows validada na GitHub Action, **não hospedados ainda** |
| Integração Flash → Game.Server | Pendente: autenticação e protocolo original |
| GM no inventário do jogo original | Pendente: necessita backend e banco original |

## Testar o portal

- Portal: https://ddtank-web.onrender.com
- Cliente Flash: https://ddtank-web.onrender.com/game-client
- Admin — integração do jogo: https://ddtank-web.onrender.com/admin/integration
- Salas de teste: https://ddtank-web.onrender.com/lobby

Os recursos novos dependem de a atualização mais recente estar publicada como **Live** no Render.

## Documentação técnica em PT-BR

- [Plano em cinco marcos](docs/IMPLEMENTACAO-CINCO-MARCOS.md)
- [Compilação e execução Windows do servidor original](tools/legacy/Check-Legacy-Runtime.ps1)
- [Mapeamento real dos bancos originais](docs/BANCO-LEGADO-MAPEAMENTO-REAL.md)
- [Carregador Flash](docs/CLIENTE-FLASH-ETAPA-4.md)
- [Localização PT-BR do cliente](docs/FLASH-IDIOMA-PTBR.md)

**Segurança:** não use credenciais encontradas no histórico deste repositório. Troque senhas e chaves antigas antes de hospedar SQL Server, IIS e servidores C#. Não abra as portas TCP legadas para a internet sem firewall e autenticação. Verifique direitos de uso de arquivos e recursos do jogo.

## Comunidade e referências do repositório original

- [Discord](https://discord.gg/cyrusteam)
- [Canal no YouTube](https://www.youtube.com/@pnkl1999)

Contribuições e sugestões de correções PT-BR podem ser propostas por *Pull Request*. Este projeto é independente e ainda está em fase de integração técnica.
