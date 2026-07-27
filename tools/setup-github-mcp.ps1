<#
.SYNOPSIS
  Installs GitHub's official MCP server and registers it with Claude Desktop.

.DESCRIPTION
  Downloads the github-mcp-server binary, extracts it, and merges an entry into
  claude_desktop_config.json - preserving any MCP servers already configured.

  Once this is done and Claude Desktop is restarted, Claude can commit directly
  to GitHub from either machine, with no local clone required.

  Safe to re-run: it backs up the existing config, and overwrites only the
  "github" entry.

.PARAMETER Token
  A GitHub fine-grained personal access token. Omit to be prompted.

  Create one at https://github.com/settings/personal-access-tokens/new
    Repository access : Only select repositories -> kenshohtp/creatureator
    Permissions       : Contents = Read and write
                        Pull requests = Read and write   (optional)
                        Metadata = Read-only             (automatic)

.PARAMETER Version
  Release tag to install. Defaults to the latest known good version.

.EXAMPLE
  .\tools\setup-github-mcp.ps1

.NOTES
  The token is stored in plaintext in claude_desktop_config.json. That is how
  Claude Desktop reads it and there is no supported alternative. Scoping the
  token to a single repository with no admin rights keeps the blast radius
  small - do not use a classic token with full repo scope here.

  KEEP THIS FILE PURE ASCII.

  Windows PowerShell 5.1 decodes .ps1 files as ANSI (Windows-1252) unless they
  carry a UTF-8 BOM. A UTF-8 em-dash then arrives as three CP1252 characters,
  the last of which PowerShell treats as a closing quote - which silently ends
  a string early and produces parser errors pointing at unrelated lines.

  Rather than depend on the file's encoding, use ASCII only: "-" not an
  em-dash, "->" not an arrow, plain quotes not typographic ones.
#>

[CmdletBinding()]
param(
  [string]$Token,
  [string]$Version = "v1.1.2",
  [string]$InstallDir = "C:\Tools\github-mcp-server"
)

$ErrorActionPreference = "Stop"

function Say($msg, $colour = "White") { Write-Host $msg -ForegroundColor $colour }

<#
  Recursively convert ConvertFrom-Json output into plain hashtables.

  Windows PowerShell 5.1 has no `ConvertFrom-Json -AsHashtable` (that arrived in
  PowerShell 6), so it returns PSCustomObject graphs instead. Doing this by hand
  keeps the script working on both 5.1 and 7+, which matters because 5.1 is what
  ships with Windows.
#>
function ConvertTo-HashtableDeep($obj) {
  if ($null -eq $obj) { return $null }
  if ($obj -is [string] -or $obj -is [ValueType]) { return $obj }
  if ($obj -is [System.Collections.IDictionary]) {
    $h = @{}
    foreach ($k in $obj.Keys) { $h[$k] = ConvertTo-HashtableDeep $obj[$k] }
    return $h
  }
  if ($obj -is [System.Management.Automation.PSCustomObject]) {
    $h = @{}
    foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = ConvertTo-HashtableDeep $p.Value }
    return $h
  }
  if ($obj -is [System.Collections.IEnumerable]) {
    return @(foreach ($item in $obj) { ConvertTo-HashtableDeep $item })
  }
  return $obj
}

Say "`nGitHub MCP server setup" "Cyan"
Say ("-" * 40)

# --- 1. Token ---------------------------------------------------------------
if (-not $Token) {
  Say "`nPaste your GitHub fine-grained PAT (input hidden):" "Yellow"
  Say "  Create one at https://github.com/settings/personal-access-tokens/new" "DarkGray"
  Say "  Repo access: kenshohtp/creatureator | Contents: Read and write" "DarkGray"
  $secure = Read-Host -AsSecureString
  $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

if ([string]::IsNullOrWhiteSpace($Token)) { throw "No token supplied." }
if ($Token -notmatch '^(github_pat_|ghp_)') {
  Say "  Warning: that does not look like a GitHub token (expected github_pat_ or ghp_ prefix)." "Yellow"
}

# --- 2. Download ------------------------------------------------------------
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x86_64" }
$asset = "github-mcp-server_Windows_$arch.zip"
$url   = "https://github.com/github/github-mcp-server/releases/download/$Version/$asset"
$tmp   = Join-Path $env:TEMP $asset

Say "`n[1/4] Downloading $asset ($Version)..." "Cyan"
Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
Say "      $([math]::Round((Get-Item $tmp).Length / 1MB, 1)) MB" "DarkGray"

# --- 3. Extract -------------------------------------------------------------
Say "[2/4] Extracting to $InstallDir..." "Cyan"
if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }
Expand-Archive -Path $tmp -DestinationPath $InstallDir -Force
Remove-Item $tmp -Force

$exe = Join-Path $InstallDir "github-mcp-server.exe"
if (-not (Test-Path $exe)) {
  $found = Get-ChildItem $InstallDir -Recurse -Filter "github-mcp-server.exe" | Select-Object -First 1
  if (-not $found) { throw "github-mcp-server.exe not found after extraction." }
  $exe = $found.FullName
}
Say "      $exe" "DarkGray"

# --- 4. Merge into Claude Desktop config ------------------------------------
$configDir  = Join-Path $env:APPDATA "Claude"
$configPath = Join-Path $configDir "claude_desktop_config.json"

Say "[3/4] Updating $configPath..." "Cyan"
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }

$config = @{}
if (Test-Path $configPath) {
  $backup = "$configPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $configPath $backup
  Say "      backed up existing config to $(Split-Path $backup -Leaf)" "DarkGray"
  $raw = Get-Content $configPath -Raw
  # Strip a UTF-8 BOM if present; ConvertFrom-Json chokes on it in 5.1.
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }

  if (-not [string]::IsNullOrWhiteSpace($raw)) {
    try {
      $parsed = $raw | ConvertFrom-Json
    } catch {
      # Report what actually went wrong rather than assuming it was the JSON.
      throw "Could not parse $configPath`n  $($_.Exception.Message)`n  A backup is at $backup"
    }
    $config = ConvertTo-HashtableDeep $parsed
  }
}

if ($config -isnot [System.Collections.IDictionary]) { $config = @{} }

if (-not $config.ContainsKey("mcpServers") -or $null -eq $config["mcpServers"]) {
  $config["mcpServers"] = @{}
}

$existing = @($config["mcpServers"].Keys) -ne "github"
if ($existing.Count -gt 0) {
  Say "      preserving existing servers: $($existing -join ', ')" "DarkGray"
}

$config["mcpServers"]["github"] = @{
  command = $exe
  args    = @("stdio")
  env     = @{ GITHUB_PERSONAL_ACCESS_TOKEN = $Token }
}

# Write UTF-8 WITHOUT a byte-order mark.
#
# `Set-Content -Encoding UTF8` emits a BOM on Windows PowerShell 5.1 (PowerShell
# 7 changed this default). A leading BOM makes strict JSON parsers reject the
# whole file, which silently disables *every* configured MCP server, not just
# the one being added. Use .NET directly so the behaviour is identical on both.
$json = $config | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Say "      wrote github entry" "DarkGray"

# Verify what actually landed on disk, rather than trusting the write.
$bytes = [System.IO.File]::ReadAllBytes($configPath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  throw "Config was written with a BOM - Claude Desktop will not parse it."
}
try {
  [System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json | Out-Null
} catch {
  throw "Config is not valid JSON after writing: $($_.Exception.Message)"
}
$serverList = @($config["mcpServers"].Keys) -join ", "
Say "      verified: no BOM, valid JSON, servers = $serverList" "DarkGray"

# --- 5. Smoke test ----------------------------------------------------------
Say "[4/4] Verifying the binary runs..." "Cyan"
try {
  $v = & $exe --version 2>&1 | Select-Object -First 1
  Say "      $v" "DarkGray"
} catch {
  Say "      could not read version (not necessarily fatal)" "Yellow"
}

Say "`nDone." "Green"
Say "Servers now configured: $serverList" "Green"
Say @"

Next:
  1. QUIT Claude Desktop completely (not just close the window) and reopen it.
  2. Ask Claude: "list the files in kenshohtp/creatureator"
     If it answers without a folder mounted, the connector is live.

If it does not appear, check the logs at:
  $env:APPDATA\Claude\logs\

"@ "White"
