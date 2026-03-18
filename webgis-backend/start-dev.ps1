$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonCandidates = @(
  "C:\Users\Murilo Tavares\AppData\Local\Programs\Python\Python313\python.exe",
  "C:\Program Files\QGIS 3.40.5\bin\python.exe"
)

$pythonExe = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $pythonExe) {
  throw "Nenhum interpretador Python local compativel foi encontrado."
}

Write-Host "Usando Python em $pythonExe" -ForegroundColor Cyan
& $pythonExe (Join-Path $projectRoot "dev_app.py")
