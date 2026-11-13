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
