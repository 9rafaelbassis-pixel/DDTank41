# Tradução PT-BR dos 7.638 itens — versão preliminar

O arquivo foi criado a partir do catálogo real exportado de `Game34.bak`. Esta versão preserva **TemplateID**, nome original (`Name` e `NameOriginal`), categoria e atributos. Os campos adicionais são:
- `NamePTBR`: nome sugerido em português, ou o original quando não houve tradução;
- `StatusTraducao`: `manual_sugestao`, `automatica_parcial`, `original_nao_traduzido` e, futuramente, `revisado_comunidade`.

**Não é a tradução oficial.** As sugestões parciais podem conter palavras vietnamitas ou construções incorretas. O catálogo requer revisão por pessoas que conheçam os nomes brasileiros clássicos do DDTank.

## Como aplicar no painel do Render

1. Faça login como administrador no Render.
2. Abra `/admin/catalog`.
3. Em "Importação completa em um arquivo JSON", escolha o arquivo `ddtank-catalogo-ptbr-v1-revisao.json` disponibilizado nesta conversa.
4. Clique para importar e acompanhe os lotes.
5. A tabela exibirá os nomes em português, lado a lado com os originais, e indicará sugestões automáticas que precisam ser revisadas.

O backend adiciona duas colunas novas à tabela do portal sem sobrescrever os nomes originais. Reimportar o JSON antigo sem `NamePTBR` **não apaga** as traduções já cadastradas.

O mecanismo de envio de equipamentos para jogadores **ainda não foi conectado**. A tradução altera apenas os nomes visíveis no catálogo administrativo do portal, não os recursos nem o cliente Flash.

## Referências comunitárias

- https://ddtanktl.blogspot.com/p/id-de-items-do-painel.html — alguns IDs em português (não representa os 7.638)
- https://ddt-maniacos.blogspot.com/p/armas-do-ddtank.html — nomes clássicos de armas (sem mapa completo de IDs)

Não existe ainda um mapeamento comunitário completo, verificado e compatível com este banco. Não importar traduções de fontes desconhecidas diretamente em tabelas reais de personagens.
