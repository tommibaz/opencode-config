# opencode-config

A fierce, security-hardened [OpenCode](https://opencode.ai) configuration altogether. Supply chain protection, custom Semgrep rules, env file guarding, and secret scanning -- the whole lot.

## What's in the box

### Env Protection Plugin

`plugins/env-protection.ts` -- Stops the agent dead from ever reading `.env` files, so your secrets don't end up in logs or context. Grand for keeping things tight.

- Blocks `read`, `edit`, `write`, `patch` on any `.env` file
- Blocks `bash` commands that `cat`/`head`/`tail`/`source` `.env` files
- Blocks `grep` targeting `.env` file patterns
- Lets `.env.example`, `.env.sample`, `.env.template` through, no bother
- Throws a clear error telling you why and what to use instead

### Supply Chain Guard Plugin

`plugins/supply-chain-guard.ts` -- An OpenCode plugin that gives `node_modules` a good once-over after any package install or update.

- Intercepts `npm/pnpm/yarn/bun install|add|ci|update|upgrade` via `tool.execute.before/after` hooks
- Runs Semgrep with custom security recipes against `node_modules`
- Smart caching: hashes the lockfile and recipe files, skips the scan if nothing's changed
- Persistent cache survives restarts (`.supply-chain-guard-cache.json`)
- Groups findings by rule, shows details inline in the agent's output

### Semgrep Security Recipes

`semgrep/recipes/` -- 36 custom rules for giving npm dependencies a proper audit:

| File | Rules | What it's after |
|---|---|---|
| `outbound-network-inventory.yaml` | 23 | Outbound network calls (fetch, axios, WebSocket, http/net/tls/dns, child_process, dynamic imports, eval, new Function) |
| `npm-backdoor-detection.yaml` | 13 | Supply chain backdoor patterns (env exfiltration, eval+base64, reverse shells, DNS exfil, obfuscated require/exec, curl/wget in postinstall) |

### Pre-Push Secret Scanning

`.husky/pre-push` -- A git hook that has a good rummage through your tracked files for leaked secrets before you push. Uses ripgrep.

- Catches API keys, tokens, passwords, credentials, private keys
- Only scans git-tracked files (what actually gets pushed, like)
- Reports `file:line:column` for each match
- All output to stderr so it doesn't make a hames of the OpenCode TUI
- Bypass with `git push --no-verify` if you're sure of yourself

### Agent Guidelines

`AGENTS.md` -- System-wide instructions for coding agents, so they don't go off making a bags of things:

- DRY-first approach (reuse > libraries > conventions > new code)
- Security protocol: run semgrep on `node_modules` when first working with a project
- Mode-specific guidelines (analyse, build, plan, brainstorm, creative, wild)

## Setup

You'll be needing [OpenCode](https://opencode.ai), [Semgrep](https://semgrep.dev), and [ripgrep](https://github.com/BurntSushi/ripgrep).

### Option A: Replace your global config

If you haven't got an existing OpenCode config you're attached to, you can clone straight into the default location:

```bash
# Back up any existing config, just to be safe
mv ~/.config/opencode ~/.config/opencode.bak

# Clone and install
git clone https://github.com/the-commits/opencode-config.git ~/.config/opencode
cd ~/.config/opencode && npm install
```

### Option B: Keep your existing config (recommended)

If you've already got a config you'd rather not disturb, clone this into a separate directory and point OpenCode at it using `OPENCODE_CONFIG_DIR`. This loads plugins, agents, tools, and recipes from the custom directory on top of your existing setup.

```bash
# Clone into a dedicated directory
git clone https://github.com/the-commits/opencode-config.git ~/.config/opencode-hardened
cd ~/.config/opencode-hardened && npm install

# Tell OpenCode to load from it (add to your .bashrc/.zshrc)
export OPENCODE_CONFIG_DIR=~/.config/opencode-hardened
```

With this approach your existing `~/.config/opencode/opencode.json` stays untouched. The `OPENCODE_CONFIG_DIR` directory is loaded after the global config, so its plugins, agents, and tools are merged in -- and can override if needed.

### Option C: Cherry-pick what you want

You can also just grab the bits you fancy:

```bash
# Copy only the plugins into your existing setup
cp plugins/*.ts ~/.config/opencode/plugins/

# Or just the semgrep recipes
cp -r semgrep/ ~/.config/opencode/semgrep/
```

---

The plugins fire up automatically at startup. Semgrep recipes are referenced by the supply chain guard plugin at runtime.

## Manual scan

Run the recipes directly against any project's `node_modules` yourself:

```bash
semgrep --config ~/.config/opencode/semgrep/recipes/ \
  --no-git-ignore \
  --exclude='!node_modules' \
  node_modules/
```

Key flags:
- `--no-git-ignore` -- otherwise `.gitignore` excludes `node_modules`
- `--exclude='!node_modules'` -- overrides Semgrep's built-in `.semgrepignore` which skips `node_modules`

## Licence

[MIT](LICENSE)
