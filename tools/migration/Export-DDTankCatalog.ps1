<#
  Exports ONLY item templates from a restored SQL Server DDTank database.
  It NEVER exports player records, passwords or secrets.
  Execute from PowerShell on a Windows computer that can reach SQL Server.
  Example:
    $env:DDTANK_SQL_CONNECTION = 'Server=localhost;Database=Game34;Integrated Security=true;TrustServerCertificate=true'
    .\tools\migration\Export-DDTankCatalog.ps1
  IMPORTANT: Database= must be the game DB after restoring a COPY of your backups.
#>
param([string]$OutputDir = "migration-output")
$ErrorActionPreference = "Stop"
$connectionString = $env:DDTANK_SQL_CONNECTION
if ([string]::IsNullOrWhiteSpace($connectionString)) {
    throw "Configure DDTANK_SQL_CONNECTION no ambiente (nunca no GitHub)."
}
Add-Type -AssemblyName System.Data
$conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
$root = Join-Path (Get-Location).Path $OutputDir
New-Item -ItemType Directory -Path $root -Force | Out-Null
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 120
    # Export only schema metadata, never contents of membership/player tables.
    $cmd.CommandText = "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $schema = New-Object System.Data.DataTable
    [void]$adapter.Fill($schema)
    $schema.Rows | ForEach-Object {
        [pscustomobject]@{ schema = [string]$_["TABLE_SCHEMA"]; table = [string]$_["TABLE_NAME"]; column = [string]$_["COLUMN_NAME"]; dataType = [string]$_["DATA_TYPE"] }
    } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $root "schema-metadata.json") -Encoding UTF8

    $cmd.CommandText = "SELECT name FROM sys.procedures WHERE name = 'SP_Items_All'"
    if ($null -eq $cmd.ExecuteScalar()) { throw "SP_Items_All não encontrado no banco indicado. Confira qual .bak foi restaurado." }
    $cmd.CommandText = "SP_Items_All"
    $cmd.CommandType = [System.Data.CommandType]::StoredProcedure
    $goods = New-Object System.Data.DataTable
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    [void]$adapter.Fill($goods)
    $batch = New-Object System.Collections.ArrayList
    $page = 1; $total = 0
    foreach ($item in $goods.Rows) {
        if (-not $goods.Columns.Contains("TemplateID") -or -not $goods.Columns.Contains("Name")) {
            throw "SP_Items_All retornou um esquema diferente do esperado."
        }
        $result = [ordered]@{}
        foreach ($name in @("TemplateID","Name","CategoryID","Pic","Attack","Defence","Agility","Luck","Quality")) {
            if ($goods.Columns.Contains($name) -and -not $item.IsNull($name)) { $result[$name] = $item[$name] }
        }
        if ($null -eq $result["TemplateID"] -or [string]::IsNullOrWhiteSpace([string]$result["Name"])) { continue }
        [void]$batch.Add([pscustomobject]$result)
        $total++
        if ($batch.Count -ge 75) {
            $file = Join-Path $root ("catalog-{0:0000}.json" -f $page)
            ConvertTo-Json -InputObject @($batch.ToArray()) -Depth 4 | Set-Content -LiteralPath $file -Encoding UTF8
            $page++; $batch.Clear()
        }
    }
    if ($batch.Count -gt 0) {
        $file = Join-Path $root ("catalog-{0:0000}.json" -f $page)
        ConvertTo-Json -InputObject @($batch.ToArray()) -Depth 4 | Set-Content -LiteralPath $file -Encoding UTF8
    }
    Write-Host "Exportados $total templates reais para $root (lotes de ate 75)."
    Write-Host "NUNCA publique dados de jogadores ou a string de conexao no GitHub."
} finally {
    $conn.Dispose()
}
