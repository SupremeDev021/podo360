param(
  [string]$BaseUrl = "http://localhost:5173"
)

$ErrorActionPreference = "Stop"

function Add-NodeToPath {
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
  $localNode = Join-Path $repoRoot ".tools\node\node.exe"
  $codexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue

  if ($nodeCommand) {
    return
  }

  if (Test-Path $localNode) {
    $env:PATH = (Split-Path $localNode) + ";" + $env:PATH
    return
  }

  if (Test-Path $codexNode) {
    $env:PATH = (Split-Path $codexNode) + ";" + $env:PATH
    return
  }

  throw "Node.js nao foi encontrado no PATH. Instale Node.js ou execute o teste pelo ambiente Codex com Node empacotado."
}

function Read-RequiredValue([string]$Prompt, [switch]$Secret) {
  if ($Secret) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }

  return Read-Host -Prompt $Prompt
}

$env:PLAYWRIGHT_USER_A_EMAIL = Read-RequiredValue "Usuario A email"
$env:PLAYWRIGHT_USER_A_PASSWORD = Read-RequiredValue "Usuario A senha" -Secret
$env:PLAYWRIGHT_USER_B_EMAIL = Read-RequiredValue "Usuario B email"
$env:PLAYWRIGHT_USER_B_PASSWORD = Read-RequiredValue "Usuario B senha" -Secret
$env:PLAYWRIGHT_BASE_URL = $BaseUrl

Add-NodeToPath
Write-Host "Credenciais carregadas somente neste processo. Executando Playwright..."
& .\node_modules\.bin\playwright.cmd test tests\e2e\podo360-critical-flows.spec.ts
