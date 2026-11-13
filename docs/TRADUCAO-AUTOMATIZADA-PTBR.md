# Catálogo PT-BR: tradução automática e revisão

O catálogo original contém **7.638** modelos com nomes parcialmente vietnamitas. Os arquivos originais e os IDs são mantidos sem alterações.

## Automação criada

Workflow opcional: `.github/workflows/catalog-ptbr-translation.yml`.

1. Abra **Actions → DDTank catalog — automated PT-BR translation → Run workflow**.
2. O job baixa o artifact já extraído dos três bancos de dados na execução SQL #43373140020 (os arquivos expirados precisarão de nova extração).
3. Utiliza modelos abertos `Helsinki-NLP/opus-mt-vi-en` e `Helsinki-NLP/opus-mt-en-ROMANCE` para tentar traduzir **cada nome de cada registro** em duas etapas, em CPU.
4. O resultado será entregue como artifact `ddtank-catalogo-ptbr-modelo-ia` contendo `ddtank-catalogo-ptbr-ia-revisao.json`, CSV e relatório.
5. No Render em `/admin/catalog`, o admin pode importar o JSON gerado. O upload atualiza **apenas o nome exibido no painel**; preserva ID e nome original.

## Critérios de qualidade

- As traduções são *sugestões automáticas*, nunca uma localização oficial.
- Nomes que não foram traduzidos ou ainda possuem marcas reconhecíveis de vietnamita recebem rótulo português genérico `Item de jogo #ID` ou categoria semelhante, identificado com `OrigemRotulo=rótulo_genérico_revisar`. **Isso não equivale à tradução verdadeira**; requer revisão humana.
- Os nomes originais ficam no campo `NameOriginal` para manter integridade e facilitar futuras correções pela comunidade.
- Este workflow não traduz ActionScript, bitmaps, SWFs, servidores C# ou textos do cliente. Esses recursos exigem identificação dos arquivos de idioma e revisão separada.
- Os modelos são executados localmente no runner e não recebem cadastros ou dados pessoais. O job usa recursos públicos de inferência/download de modelos.
- Se o job exceder os limites do runner, não há arquivo final garantido; a interface continuará funcionando com o catálogo anterior.

Referências de modelos: https://huggingface.co/Helsinki-NLP/opus-mt-vi-en e https://huggingface.co/Helsinki-NLP/opus-mt-en-ROMANCE .
