# Development setup

This project is developed across two machines (a Windows PC and a Mac), neither of
which is reliably on. **The GitHub repo is the source of truth.** Local folders are
disposable working copies.

---

## 1. Why this setup exists

Claude's sandbox cannot reach github.com directly — the proxy blocks git over HTTPS,
and the Anthropic connector registry has no GitHub connector. Without a local MCP
server, Claude can read the repo but never write to it, which makes whichever machine
is switched on the de-facto source of truth. That is backwards.

Running GitHub's official MCP server locally fixes this. Note that "local" only
describes where the *process* runs — it talks to the GitHub API over the network, so
Claude can commit, branch, and open PRs against the repo **without needing a local
clone at all**. Set it up once per machine and the workflow is identical on both.

> GitHub's remote MCP endpoint (`https://api.githubcopilot.com/mcp`) is **not** usable
> here. It requires OAuth via a registered GitHub App, which Claude Desktop's custom
> connector flow does not support. GitHub's own install docs say so explicitly. Don't
> waste time on Settings → Connectors → Add custom connector.

---

## 2. Create a Personal Access Token

Use a **fine-grained** token, not a classic one, so the blast radius is one repo.

1. Go to <https://github.com/settings/personal-access-tokens/new>
2. **Token name:** `creatureator-mcp`
3. **Expiration:** 90 days (calendar a renewal — it will expire mid-project otherwise)
4. **Repository access:** *Only select repositories* → `kenshohtp/creatureator`
5. **Permissions → Repository permissions:**
   - `Contents`: **Read and write** (commits, file changes)
   - `Metadata`: Read-only (auto-enabled, required)
   - `Pull requests`: Read and write (only if you want Claude opening PRs)
   - `Issues`: Read and write (optional)
6. Generate, and copy the token immediately — it is shown once.

The token ends up in a plaintext config file below. Scoping it to a single public
repo with no admin rights keeps that acceptable; a classic token with full `repo`
scope would not be.

---

## 3. Install the server binary

Latest release: **v1.1.2**, from
<https://github.com/github/github-mcp-server/releases>

No Docker required. GitHub's docs lead with Docker, but they also ship plain binaries,
and the Docker route has known compatibility issues with Claude Desktop.

### Windows

Download `github-mcp-server_Windows_x86_64.zip`, then:

```powershell
mkdir C:\Tools\github-mcp-server
# extract the zip into that folder, so you have:
#   C:\Tools\github-mcp-server\github-mcp-server.exe
```

### macOS

Download `github-mcp-server_Darwin_arm64.tar.gz` (Apple Silicon) or
`github-mcp-server_Darwin_x86_64.tar.gz` (Intel), then:

```bash
tar -xzf ~/Downloads/github-mcp-server_Darwin_arm64.tar.gz
sudo mv github-mcp-server /usr/local/bin/
chmod +x /usr/local/bin/github-mcp-server
xattr -d com.apple.quarantine /usr/local/bin/github-mcp-server   # clears Gatekeeper
```

The `xattr` step matters — without it macOS silently refuses to run the downloaded
binary and the MCP server just never appears.

---

## 4. Configure Claude Desktop

Settings → Developer → Edit Config, or edit directly:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows

```json
{
  "mcpServers": {
    "github": {
      "command": "C:\\Tools\\github-mcp-server\\github-mcp-server.exe",
      "args": ["stdio"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### macOS

```json
{
  "mcpServers": {
    "github": {
      "command": "/usr/local/bin/github-mcp-server",
      "args": ["stdio"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

If the file already has an `mcpServers` block, add `"github"` inside it rather than
replacing the whole thing.

**Restart Claude Desktop fully** — quit, don't just close the window.

### Verify

Ask Claude: *"list the files in kenshohtp/creatureator"*. If it answers without
needing a local folder, the server is live.

Logs if it isn't:
- Windows: `%APPDATA%\Claude\logs\`
- macOS: `~/Library/Logs/Claude/mcp-server-github.log`

---

## 5. Second machine: clone, don't sync

Each machine gets its own clone. **Do not** put the working folder inside OneDrive,
Dropbox, or iCloud — a `.git` directory synced between two machines will corrupt
itself the first time both are open at once.

```bash
# macOS
mkdir -p ~/Projects && cd ~/Projects
git clone https://github.com/kenshohtp/creatureator.git
cd creatureator && npm install
```

```powershell
# Windows — note: OUTSIDE OneDrive
mkdir C:\Projects; cd C:\Projects
git clone https://github.com/kenshohtp/creatureator.git
cd creatureator; npm install
```

Then point Cowork at that folder.

> **Migration note.** The current Windows working copy lives at
> `C:\Users\optyh\OneDrive\Documents\Claude\Projects\Creatureator` — inside OneDrive.
> Everything committed so far is safely on GitHub, so the fix is to re-clone to
> `C:\Projects\creatureator`, confirm it matches, and delete the OneDrive copy.

---

## 6. Working agreement

- **The repo is the source of truth.** Anything not pushed does not exist.
- **Start of session:** `git pull` in the local clone, so Cowork's view is current.
- **Claude commits via MCP**, directly to the repo, from either machine.
- **End of session:** `git pull` again to bring local in line with anything Claude
  pushed during the session.
- Local working copies are disposable. If one gets tangled, delete and re-clone.

---

## 7. Regenerating data

```bash
npm run fetch:tables    # GM Core tables -> src/data/creature-tables.ts (committed)
npm run fetch:corpus    # validation fixture (large, gitignored)
npm test
```

`fetch:tables` output is committed so a fresh clone builds offline. Re-run only on
Paizo errata.
