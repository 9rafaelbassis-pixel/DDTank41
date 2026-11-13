# Preflight do servidor original DDTank em Windows.
# Não cria contas, não restaura backups e não abre portas no firewall.
# Uso seguro: powershell -File tools/legacy/Check-Legacy-Runtime.ps1
# Para iniciar em VM isolada, explicitamente:
# $env:DDTANK_LEGACY_OFFLINE_APPROVED = "SIM"
# powershell -File tools/legacy/Check-Legacy-Runtime.ps1 -Start
param([switch]$Start)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$apps = @(
    @{ Name = 'Central'; Location = 'Center.Service/bin/Release/net48/Center.Service.exe'; Port = 9202 },
    @{ Name = 'Batalhas'; Location = 'Fighting.Service/bin/Release/net48/Fighting.Service.exe'; Port = 9208 },
    @{ Name = 'Jogo'; Location = 'Road.Service/bin/Release/net48/Road.Service.exe'; Port = 9500 }
)
if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
    throw "Este script precisa ser executado em Windows, com .NET Framework 4.8."
}
Write-Host "DDTank original - preflight da VM Windows"
$missing = @()
foreach ($app in $apps) {
    $full = Join-Path $root $app.Location
    if (Test-Path -LiteralPath $full) {
        Write-Host "OK: $($app.Name) - executavel encontrado"
    } else {
        Write-Host "FALTANDO: $($app.Name) - compile primeiro no Windows"
        $missing += $app.Name
    }
}
if ($missing.Count) {
    throw "Nao iniciar sem os executaveis: $($missing -join ', ')"
}
if (-not $Start) {
    Write-Host "Modo verificacao somente. Nenhum servidor foi iniciado."
    Write-Host "Antes de habilitar -Start: restaure SQL Server em VM isolada, revise App.config e IPs, configure logins seguros."
    return
}
if ($env:DDTANK_LEGACY_OFFLINE_APPROVED -ne "SIM") {
    throw "Inicio bloqueado por seguranca. Exige DDTANK_LEGACY_OFFLINE_APPROVED=SIM apos revisao de configuracoes."
}
if (-not (Get-Service -Name 'MSSQL*' -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running')) {
    throw "Nenhum servico MSSQL ativo encontrado. Inicie SQL Server antes de iniciar os processos."
}
foreach ($app in $apps) {
    $full=Join-Path $root $app.Location
    $workingDir=Split-Path $full -Parent
    Write-Host "Iniciando $($app.Name) em modo local..."
    $process=Start-Process -FilePath $full -ArgumentList '--start' -WorkingDirectory $workingDir -PassThru
    Start-Sleep -Seconds 4
    if ($process.HasExited) {
        throw "$($app.Name) encerrou imediatamente (ExitCode $($process.ExitCode)). Verifique logs locais."
    }
    Write-Host "Processo iniciado (PID $($process.Id))."
}
Write-Host "Processos foram iniciados. Valide porta TCP, conexoes SQL e logs no host privado."
Write-Host "Este script NAO confirma que o jogo, as batalhas e a autenticacao funcionam."
