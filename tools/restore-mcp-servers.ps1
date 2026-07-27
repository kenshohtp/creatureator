<#
.SYNOPSIS
  Recover MCP servers lost from claude_desktop_config.json by merging them back
  from a timestamped backup.

.DESCRIPTION
  setup-github-mcp.ps1 originally wrote the config with a UTF-8 BOM (a Windows
  PowerShell 5.1 default). Claude Desktop could not parse that file, and the
  servers configured in it were lost. The backups taken before each run still
  contain them.

  This merges every server found in a backup into the current config, WITHOUT
  overwriting anything currently configured. By default it reads the oldest
  backup, which is the one predating any damage.

  Dry run by default. Pass -Apply to actually write.

.PARAMETER Backup
  Path to a specific backup. Defaults to the oldest .bak-* file found.

.PARAMETER Apply
  Write the merged result. Without this, only reports what would change.

.EXAMPLE
  .\tools\restore-mcp-servers.ps1
  .\tools\restore-mcp-servers.ps1 -Apply

.NOTES
  KEEP THIS FILE PURE ASCII - Windows PowerShell 5.1 decodes .ps1 as ANSI
  unless the file has a UTF-8 BOM.
#>

[CmdletBinding()]
param(
  [string]$Backup,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
function Say($msg, $colour = "White") { Write-Host $msg -ForegroundColor $colour }

function ConvertTo-HashtableDeep($obj) {
  if ($null -eq $obj) { return $null }
  if ($obj -is [string] -or $obj -is [ValueType]) { return $obj }
  if ($obj -is [System.Collections.IDictionary]) {
    $h = @{}; foreach ($k in $obj.Keys) { $h[$k] = ConvertTo-HashtableDeep $obj[$k] }; return $h
  }
  if ($obj -is [System.Management.Automation.PSCustomObject]) {
    $h = @{}; foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = ConvertTo-HashtableDeep $p.Value }; return $h
  }
  if ($obj -is [System.Collections.IEnumerable]) {
    return @(foreach ($item in $obj) { ConvertTo-HashtableDeep $item })
  }
  return $obj
}

function Read-ConfigFile($path) {
  $raw = Get-Content $path -Raw
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
  if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
  return ConvertTo-HashtableDeep ($raw | ConvertFrom-Json)
}

$configDir  = Join-Path $env:APPDATA "Claude"
$configPath = Join-Path $configDir "claude_desktop_config.json"

Say "`nRestore MCP servers from backup" "Cyan"
Say ("-" * 40)

if (-not $Backup) {
  $candidates = Get-ChildItem "$configPath.bak-*" -ErrorAction SilentlyContinue | Sort-Object Name
  if (-not $candidates) { throw "No backups found next to $configPath" }
  Say "`nBackups found:" "Yellow"
  foreach ($c in $candidates) {
    $servers = try { (Read-ConfigFile $c.FullName)["mcpServers"].Keys -join ", " } catch { "<unreadable>" }
    Say ("  {0}  ->  {1}" -f $c.Name, $servers) "DarkGray"
  }
  $Backup = $candidates[0].FullName
  Say "`nUsing oldest: $(Split-Path $Backup -Leaf)" "Yellow"
}

$old = Read-ConfigFile $Backup
$new = if (Test-Path $configPath) { Read-ConfigFile $configPath } else { @{} }

if (-not $old.ContainsKey("mcpServers")) { throw "Backup has no mcpServers block." }
if (-not $new.ContainsKey("mcpServers") -or $null -eq $new["mcpServers"]) { $new["mcpServers"] = @{} }

$restored = @()
foreach ($name in $old["mcpServers"].Keys) {
  if ($new["mcpServers"].ContainsKey($name)) {
    Say "  keeping current : $name" "DarkGray"
  } else {
    $new["mcpServers"][$name] = $old["mcpServers"][$name]
    $restored += $name
    Say "  restoring       : $name" "Green"
  }
}

if ($restored.Count -eq 0) {
  Say "`nNothing to restore - current config already has every server from that backup." "Green"
  Say "Current servers: $(@($new['mcpServers'].Keys) -join ', ')" "White"
  return
}

if (-not $Apply) {
  Say "`nDRY RUN. Would restore: $($restored -join ', ')" "Yellow"
  Say "Re-run with -Apply to write the change." "Yellow"
  return
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $configPath "$configPath.prerestore-$stamp"

# UTF-8 with NO BOM. See setup-github-mcp.ps1 for why this matters.
$json = $new | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$bytes = [System.IO.File]::ReadAllBytes($configPath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  throw "Wrote a BOM - aborting. Restore from $configPath.prerestore-$stamp"
}
[System.Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json | Out-Null

Say "`nRestored: $($restored -join ', ')" "Green"
Say "Servers now configured: $(@($new['mcpServers'].Keys) -join ', ')" "Green"
Say "`nQUIT Claude Desktop completely and reopen for this to take effect.`n" "White"
