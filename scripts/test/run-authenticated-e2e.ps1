param(
  [string]$BaseUrl = "http://localhost:5173"
)

$ErrorActionPreference = "Stop"

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

Write-Host "Credenciais carregadas somente neste processo. Executando Playwright..."
& .\node_modules\.bin\playwright.cmd test tests\e2e\podo360-critical-flows.spec.ts
