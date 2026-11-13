# Estrutura do SQL Server original — inventário de tabelas para integração

Estas tabelas/colunas foram conferidas no artefato gerado ao restaurar **cópias** dos três backups originais no SQL Server de CI. Os backups não devem ser usados para alterar ou criar contas no serviço de produção sem projeto de migração e autorização. Metadados de esquema não contêm dados pessoais.

| Banco restaurado na CI | Tabela | Chave/colunas relevantes | Uso planejado |
| --- | --- | --- | --- |
| `DDTankImportMembership` | `Mem_UserInfo` | `UserId`, `Email`, `PasswordFormat`, `PasswordSalt` | Conta de membro original (não compartilhar hashes com o portal) |
| `DDTankImportPlayer` | `Sys_Users_Detail` | `UserID`, `UserName`, `NickName`, `Grade`, `GP`, `Gold`, `Money` | Personagem, nível, experiência e moedas |
| `DDTankImportPlayer` | `Sys_Users_Goods` | `ItemID`, `UserID`, `TemplateID`, `BagType`, `Place`, `Count`, `StrengthenLevel`, `IsBinds`, `ValidDate` | Itens, equipamentos e slots reais |
| `DDTankImportPlayer` | `User_Messages` | `ID`, `SenderID`, `ReceiverID`, `Title`, `Annex1…5`, `Gold`, `Money`, `GiftToken` | Correio original e entregas GM |
| `DDTankImportPlayer` | `Sys_Users_Pet` | `ID`, `UserID`, `TemplateID`, `Level`, `IsEquip` | Pets |
| `DDTankImportPlayer` | `Server_List` | `ID`, `Name`, `IP`, `Port`, `State`, `Online` | Canais/servidores originais |

**Pontos críticos:**
- As tabelas do portal **não têm a mesma estrutura** que as originais. `portal_characters.legacy_user_id` foi reservado como vínculo, mas não está preenchido automaticamente. Nunca associe por apelido; use identificador verificado e autorizado.
- O catálogo de `Game34` contém os templates originais. Ele não resolve sozinho o inventário de um personagem. `Sys_Users_Goods` também exige posição, mochila, validade, vínculos, reforço, composição e outros atributos.
- O correio original utiliza `Annex1…5`. Não inserir conteúdo manual sem descobrir o formato e os procedimentos de banco usados no código `Bussiness` e `Game.Server`. Escrever diretamente pode gerar itens duplicados ou inválidos.
- Não migrar nem expor os campos de senha, telefone ou e-mail existentes nos backups.
- Banco gratuito do Render e os backups SQL Server **não são intercambiáveis**: a restauração em CI foi temporária. Persistência original exige SQL Server em ambiente adequado.
- Os IPs e segredos históricos em `Web.config` e configurações legadas devem ser rotacionados e substituídos antes de iniciar os serviços.

## Critério para liberar GM original

1. Servidor C# original conectado a um SQL Server de teste isolado.
2. Jogador do portal associado com segurança a `Sys_Users_Detail.UserID`.
3. API GM autenticada e auditada com operações idempotentes; parâmetros validados e transação atômica.
4. Entrega de 1 item de teste, consulta ao inventário do servidor e visualização no cliente Flash original.
5. Verificação de repetição, reconexão e rollback em falha.

Até isso ocorrer, **`/admin/players` modifica somente o inventário do portal**, não o jogo original.
