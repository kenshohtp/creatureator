# Handoff: evaluate a Mac mini as a home development server

**Purpose of this document.** Start a fresh conversation with this as context, so the
infrastructure question can be explored properly without derailing Creatureator
development. Paste or attach this file to begin.

---

## Who and what

Dan (`optyhtp@gmail.com`) is a **non-software-engineer project lead** building
Creatureator, a FoundryVTT module for Pathfinder 2e creature building
(<https://github.com/kenshohtp/creatureator>). He co-builds with Claude rather than
writing code solo, and reviews decisions before they're committed.

Explanations should assume competence but not deep sysadmin knowledge. Prefer concrete
commands over conceptual overviews.

## The machines

| Machine | Role | Notes |
|---|---|---|
| Windows PC | Secondary | **Off during the day.** Currently has the working clone. |
| Mac (laptop?) | Primary? | Model, chip, and macOS version unconfirmed |
| Mac mini | Candidate server | **Already owned.** Model, chip, RAM, macOS all unconfirmed |

Confirm the actual hardware early — the mini's age and RAM change what's realistic.

## The problem that prompted this

Neither working machine is reliably on, so "whichever computer is awake" kept becoming
the de-facto source of truth. That's backwards. The stated requirement:

> "I need the repo to be the source of truth, and I need you to be able to push
> content from either source."

An always-on Mac mini could be the fixed point that both clients connect to.

## Hard constraints — established, do not re-litigate

1. **OneDrive is banned.** Dan's words: "I NEVER want to use OneDrive - its awful."
   Independently, a `.git` directory synced across two machines corrupts. Any proposal
   involving consumer file-sync for source code is a non-starter. Dropbox and iCloud
   Drive are out for the same reason.
2. **Claude's sandbox cannot reach github.com.** The proxy blocks git over HTTPS
   (`HTTP 403 on CONNECT`). Read access via web fetch works; writes do not.
3. **No GitHub connector exists** in the Anthropic registry, and the plugin catalogue
   has zero GitHub matches. Both were checked directly.
4. **GitHub's remote MCP endpoint is unusable from Claude Desktop.** It requires OAuth
   through a registered GitHub App, which Desktop's custom connector flow doesn't
   support — per GitHub's own install docs.
5. **The local MCP server binary was tried and does not work for Cowork.** The
   binary installs and runs, but Cowork does not surface MCP servers configured in
   `claude_desktop_config.json` — after a clean install and full restart, neither the
   new `github` server nor the pre-existing `aon` server was available. See the status
   banner at the top of `docs/DEV-SETUP.md`. Do not re-propose this without new
   information.

   Unknown: whether those servers work in a *regular* Claude Desktop chat rather than
   Cowork. Possibly, but untested and not obviously useful.

**Current reality:** git runs on the developer's machine. Claude writes files into the
local clone; Dan commits and pushes. This works reliably. Any proposal should be
measured against it rather than against the assumption that Claude can push.

## The question to explore

Does an always-on Mac mini improve on "MCP server binary installed per client
machine", and if so, in what configuration?

Worth noting the MCP-per-machine approach already solves the *git* problem — it needs
no local clone and works from anywhere. So the mini has to earn its place on something
else. Candidates:

### Likely the strongest argument: Foundry hosting

Dan runs FoundryVTT. A Mac mini could host the Foundry server itself — always on,
reachable by players, no dependence on a laptop staying awake. That may be a bigger
practical win than anything development-related, and it changes the calculus because
the mini would be earning its keep regardless.

**Investigate:** Foundry v14 on macOS as a persistent service (launchd), port
forwarding vs. a tunnel, whether Dan wants players connecting from outside the LAN,
backup of the Foundry data directory.

### Other angles

- **Remote development.** VS Code Remote-SSH or similar, so both clients edit on the
  mini and there is exactly one working copy. Removes "which machine has the latest"
  entirely.
- **Long-running tasks.** The Creatureator validation corpus fetch is slow and got
  abandoned mid-run at least once because the machine was in use. A server just
  finishes it.
- **CI without the cloud.** Running `npm test` on push, locally.
- **Network access.** Tailscale is likely the right answer for reaching the mini from
  anywhere without exposing ports. Confirm before recommending alternatives.
- **Does Cowork/Claude Desktop help here?** Claude Desktop runs on the *client*, not
  the server. Understand what that means for a remote-first workflow before designing
  around it — this may be the deciding constraint.

### Push back if warranted

If per-machine MCP plus a plain git clone already covers the actual need, say so. A
home server is real ongoing maintenance — updates, backups, certificates, debugging
when it breaks — and Dan is not looking for a sysadmin hobby. The mini is already
owned, so there's no purchase to justify, but there is still a time cost.

## Open questions for Dan

1. Which Mac mini — model year, chip, RAM? Currently doing anything?
2. Is the other Mac a laptop, and is it the primary dev machine?
3. Does Foundry currently run on a laptop? Do players connect remotely?
4. Comfort level with a terminal on macOS?
5. Is the goal "always-on Foundry", "one canonical working copy", or both?

## Current Creatureator state — for context only

Do not do Creatureator work in the new thread; it continues in the original one.

- Repo live, 5 commits, `main` at `b4d26c7`
- Foundry v14 / PF2e 8.2 target, ApplicationV2
- GM Core creature-building tables pipeline working (12 tables generated from AoN)
- Band classification/re-emission engine written, **tests never run** (`npm install`
  not yet executed)
- No Foundry UI yet
- ORC attribution in `NOTICE.md` drafted but **unverified** — flagged for checking
  against paizo.com/orclicense before any public release
