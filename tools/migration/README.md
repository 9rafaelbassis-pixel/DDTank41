# Ferramentas de migração DDTank — Fase 2
O repositório inclui `Database/*.bak` do SQL Server, mas **não é possível convertê-los em tabelas PostgreSQL renomeando os arquivos**.

## Etapa 1: cópias dos backups e catálogo original
1. Restaure uma **cópia** de cada backup no SQL Server/SQL Server Developer em ambiente isolado, pelo SSMS. Valide nomes das bases em `RESTORE HEADERONLY` e nomes de arquivos lógicos em `RESTORE FILELISTONLY`; não use `WITH REPLACE` contra bases existentes.
2. Para o banco que contém `SP_Items_All`, configure `DDTANK_SQL_CONNECTION` no PowerShell local, com usuário de **somente leitura** com permissão de EXECUTE no procedimento:
   `$env:DDTANK_SQL_CONNECTION = 'Server=localhost;Database=Game34;Integrated Security=true;TrustServerCertificate=true'`.
3. Rode `.\tools\migration\Export-DDTankCatalog.ps1` (na raiz do repositório).
4. Os lotes `migration-output/catalog-0001.json` trazem templates reais, não dados de jogadores. Na interface `/admin/catalog`, importe **um lote por vez**.
5. Para inventário de personagens e envio de itens ainda é necessário mapear as tabelas e implementar uma ponte autenticada de escritura. Não use os dados de produção nessa etapa.

## Etapa 2: cliente Flash
Rode `node tools/migration/Audit-Flash.mjs` na raiz após clonar o repositório **com seus arquivos binários**. O relatório `migration-output/flash-report.json` mostra SWF, versão, hashes e assinaturas. Esse é somente diagnóstico: nem valida Ruffle nem converte o jogo para HTML5.
Os arquivos `Source Flash/FlashSV1/Launcher.swf` e `Loading.swf` foram identificados, mas há configurações XML com endereços antigos que precisam ser reescritos. Não publique binários sem verificar direitos/licenças.

## Segurança
- `migration-output/` é ignorado pelo Git e não deve ser publicado.
- Nunca compartilhe connection strings ou imagens da tela contendo senhas.
- NÃO aplique os comandos SQL acima a uma base existente sem backup.
- O painel GM ainda não envia itens ao jogo: a importação aqui é um catálogo **somente leitura**.

## Opção sem SQL Server local: GitHub Actions

O workflow `.github/workflows/sql-backups-lab.yml` usa um contêiner **temporário** do SQL Server na infraestrutura de CI, restaura **cópias** de `Db_Membership.bak`, `Game34.bak` e `Player34.bak`, e tenta executar `SP_Items_All` para extrair o catálogo original. Não exporta senhas, e-mails, jogadores nem o conteúdo de tabelas de personagens.

1. GitHub > Actions > `DDTank SQL backup analysis (ephemeral)` > `Run workflow` (ou acompanhe a execução acionada pelo push inicial).
2. Veja o relatório de execução e baixe o artifact `ddtank-original-item-catalog` gerado pelo workflow.
3. Se `report.json` indicar sucesso e existir `catalog-0001.json`, faça login como admin no Render > `/admin/catalog` e importe o conteúdo **um lote de cada vez**.
4. Caso o arquivo de backup seja incompatível com SQL Server 2022, consulte `report.json`: a restauração não será falsamente marcada como concluída. Pode ser necessário outro mecanismo/versão para recuperar o backup.
5. O SQL Server usado pelo GitHub Actions é descartado ao finalizar a execução. Ele **não** é servidor permanente de jogo; a base original ainda precisa ser portada para infraestrutura durável, e o Render PostgreSQL do portal não contém automaticamente personagens.

**Nota:** os artifacts permanecem no GitHub pelo período configurado no workflow. Como o repositório é público, não execute esse workflow sobre backups privados ou com dados sensíveis que não possam ser processados na infraestrutura de CI sem revisar primeiro o tratamento de dados. Os relatórios extraem apenas o esquema e os modelos de itens.
