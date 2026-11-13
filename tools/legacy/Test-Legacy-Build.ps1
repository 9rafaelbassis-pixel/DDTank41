# Diagnóstico de compilação do backend original Windows/.NET Framework 4.8
# Não inicia servidores, não usa SQL de produção nem publica binários de jogo.
$ErrorActionPreference = 'Stop'
$projects = @(
    'Center.Service/Center.Service.csproj',
    'Fighting.Service/Fighting.Service.csproj',
    'Road.Service/Road.Service.csproj'
)
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$results = [System.Collections.Generic.List[object]]::new()
$logs = Join-Path $env:RUNNER_TEMP 'ddtank-build-logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
foreach ($item in $projects) {
    $project = Join-Path $root $item
    $name = [IO.Path]::GetFileNameWithoutExtension($project)
    $log = Join-Path $logs "$name.log"
    Write-Host "Diagnosticando projeto $name"
    & msbuild.exe $project '/restore' '/t:Build' '/p:Configuration=Release' '/p:Platform=AnyCPU' '/verbosity:quiet' '/nologo' *> $log
    $exitCode = $LASTEXITCODE
    $results.Add([pscustomobject]@{
        Projeto = $name
        Status = $(if ($exitCode -eq 0) { 'COMPILOU' } else { 'BLOQUEADO' })
        CodigoDeSaida = $exitCode
        # Logs podem conter caminhos e dados do código antigo; não expor arquivos no artifact.
    })
}
$table = @('## Compilação real dos serviços .NET Framework', '',
    '| Serviço | Resultado | Código |', '| --- | --- | --- |')
foreach ($result in $results) {
    $table += "| $($result.Projeto) | $($result.Status) | $($result.CodigoDeSaida) |"
}
$table += ''
$table += 'Esta ação **não inicia o servidor** e **não publica executáveis**.'
$table -join "`n" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
$results | Format-Table -AutoSize | Out-String | Write-Host
if ($results.Where({ $_.CodigoDeSaida -ne 0 }).Count -gt 0) {
    Write-Host 'Há serviços que não compilam no runner Windows; veja a etapa de build (sem expor logs de segredo).'
    exit 1
}
Write-Host 'Todos os serviços compilaram. Isso ainda NÃO comprova inicialização ou batalha real.'
