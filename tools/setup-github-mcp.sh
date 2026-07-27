#!/usr/bin/env bash
#
# setup-github-mcp.sh — macOS counterpart to setup-github-mcp.ps1
#
# Installs GitHub's official MCP server and registers it with Claude Desktop,
# so Claude can commit directly to GitHub without a local clone.
#
# Create a fine-grained PAT first:
#   https://github.com/settings/personal-access-tokens/new
#     Repository access : Only select repositories -> kenshohtp/creatureator
#     Permissions       : Contents = Read and write
#                         Pull requests = Read and write   (optional)
#
# Usage:
#   chmod +x tools/setup-github-mcp.sh
#   ./tools/setup-github-mcp.sh
#
# Safe to re-run. Backs up the existing config and overwrites only the
# "github" entry.
#
# Note: the token is stored in plaintext in claude_desktop_config.json. That is
# how Claude Desktop reads it. Scope the token to a single repository.

set -euo pipefail

VERSION="${VERSION:-v1.1.2}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG="$CONFIG_DIR/claude_desktop_config.json"

info()  { printf '\033[36m%s\033[0m\n' "$*"; }
dim()   { printf '\033[90m      %s\033[0m\n' "$*"; }
warn()  { printf '\033[33m%s\033[0m\n' "$*"; }
die()   { printf '\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }

command -v jq >/dev/null 2>&1 || die "jq is required. Install with: brew install jq"

printf '\n'
info "GitHub MCP server setup"
echo "----------------------------------------"

# --- 1. Token ---------------------------------------------------------------
TOKEN="${GITHUB_PAT:-}"
if [ -z "$TOKEN" ]; then
  printf '\n'
  warn "Paste your GitHub fine-grained PAT (input hidden):"
  dim "https://github.com/settings/personal-access-tokens/new"
  read -rs TOKEN
  printf '\n'
fi
[ -n "$TOKEN" ] || die "No token supplied."
case "$TOKEN" in
  github_pat_*|ghp_*) ;;
  *) warn "  Warning: that does not look like a GitHub token." ;;
esac

# --- 2. Download ------------------------------------------------------------
case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  *)     ARCH="x86_64" ;;
esac
ASSET="github-mcp-server_Darwin_${ARCH}.tar.gz"
URL="https://github.com/github/github-mcp-server/releases/download/${VERSION}/${ASSET}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

info "[1/4] Downloading $ASSET ($VERSION)..."
curl -fsSL "$URL" -o "$TMP/$ASSET" || die "Download failed: $URL"
dim "$(du -h "$TMP/$ASSET" | cut -f1)"

# --- 3. Install -------------------------------------------------------------
info "[2/4] Installing to $INSTALL_DIR..."
tar -xzf "$TMP/$ASSET" -C "$TMP"
BIN="$(find "$TMP" -name github-mcp-server -type f | head -n1)"
[ -n "$BIN" ] || die "github-mcp-server not found in archive."

if [ -w "$INSTALL_DIR" ]; then
  mv "$BIN" "$INSTALL_DIR/github-mcp-server"
else
  dim "sudo needed to write to $INSTALL_DIR"
  sudo mv "$BIN" "$INSTALL_DIR/github-mcp-server"
fi
EXE="$INSTALL_DIR/github-mcp-server"
chmod +x "$EXE" 2>/dev/null || sudo chmod +x "$EXE"

# Gatekeeper quarantines downloaded binaries; without this macOS silently
# refuses to run it and the MCP server just never appears in Claude.
xattr -d com.apple.quarantine "$EXE" 2>/dev/null || \
  sudo xattr -d com.apple.quarantine "$EXE" 2>/dev/null || true
dim "$EXE"

# --- 4. Merge into Claude Desktop config ------------------------------------
info "[3/4] Updating claude_desktop_config.json..."
mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG" ]; then
  BACKUP="$CONFIG.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$CONFIG" "$BACKUP"
  dim "backed up to $(basename "$BACKUP")"
  jq empty "$CONFIG" 2>/dev/null || die "Existing config is not valid JSON: $CONFIG"
else
  echo '{}' > "$CONFIG"
fi

EXISTING="$(jq -r '(.mcpServers // {}) | keys[]? | select(. != "github")' "$CONFIG" | paste -sd, -)"
[ -n "$EXISTING" ] && dim "preserving existing servers: $EXISTING"

jq --arg exe "$EXE" --arg token "$TOKEN" \
  '.mcpServers //= {} | .mcpServers.github = {
     command: $exe,
     args: ["stdio"],
     env: { GITHUB_PERSONAL_ACCESS_TOKEN: $token }
   }' "$CONFIG" > "$TMP/config.json"

mv "$TMP/config.json" "$CONFIG"
dim "wrote github entry"

# --- 5. Smoke test ----------------------------------------------------------
info "[4/4] Verifying the binary runs..."
dim "$("$EXE" --version 2>&1 | head -n1 || echo 'could not read version (not necessarily fatal)')"

printf '\n\033[32mDone.\033[0m\n'
cat <<EOF

Next:
  1. QUIT Claude Desktop completely (Cmd-Q, not just closing the window) and reopen.
  2. Ask Claude: "list the files in kenshohtp/creatureator"
     If it answers without a folder mounted, the connector is live.

If it does not appear, check:
  ~/Library/Logs/Claude/mcp-server-github.log

EOF
