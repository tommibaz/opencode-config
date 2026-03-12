# opencode-config

Security-hardened [OpenCode](https://opencode.ai) configuration with supply chain protection, custom Semgrep rules, and secret scanning.

## What's in the box

### Supply Chain Guard Plugin

`plugins/supply-chain-guard.ts` -- An OpenCode plugin that automatically scans `node_modules` after any package install/update command.

- Intercepts `npm/pnpm/yarn/bun install|add|ci|update|upgrade` via `tool.execute.before/after` hooks
- Runs Semgrep with custom security recipes against `node_modules`
- Smart caching: hashes lockfile + recipe files, skips scan when nothing changed
- Persistent cache survives restarts (`.supply-chain-guard-cache.json`)
- Groups findings by rule, shows details inline in the agent's output

### Semgrep Security Recipes

`semgrep/recipes/` -- 36 custom rules for auditing npm dependencies:

| File | Rules | Purpose |
|---|---|---|
| `outbound-network-inventory.yaml` | 23 | Detect outbound network calls (fetch, axios, WebSocket, http/net/tls/dns, child_process, dynamic imports, eval, new Function) |
| `npm-backdoor-detection.yaml` | 13 | Detect supply chain backdoor patterns (env exfiltration, eval+base64, reverse shells, DNS exfil, obfuscated require/exec, curl/wget in postinstall) |

### Pre-Push Secret Scanning

`.husky/pre-push` -- Git hook that scans for leaked secrets before push using ripgrep:

- Catches API keys, tokens, passwords, credentials, private keys
- Scans dotfiles (`--hidden`) and ignores nothing (`--no-ignore`)
- Excludes `node_modules`, `package-lock.json`, `.git`, `.husky`
- Bypass with `git push --no-verify`

### Agent Guidelines

`AGENTS.md` -- System-wide instructions for coding agents:

- DRY-first approach (reuse > libraries > conventions > new code)
- Security protocol: run semgrep on `node_modules` when first working with a project
- Mode-specific guidelines (analyze, build, plan, brainstorm, creative, wild)

## Setup

Requires [OpenCode](https://opencode.ai), [Semgrep](https://semgrep.dev), and [ripgrep](https://github.com/BurntSushi/ripgrep).

```bash
# Clone into your OpenCode config directory
git clone <your-remote> ~/.config/opencode

# Install dependencies (triggers husky setup via prepare script)
cd ~/.config/opencode && npm install
```

The plugin is registered in `opencode.jsonc` and activates automatically. Semgrep recipes are referenced by the plugin at runtime.

## Manual scan

Run the recipes directly against any project's `node_modules`:

```bash
semgrep --config ~/.config/opencode/semgrep/recipes/ \
  --no-git-ignore \
  --exclude='!node_modules' \
  node_modules/
```

Key flags:
- `--no-git-ignore` -- otherwise `.gitignore` excludes `node_modules`
- `--exclude='!node_modules'` -- overrides Semgrep's built-in `.semgrepignore` which skips `node_modules`

## License

[MIT](LICENSE)
