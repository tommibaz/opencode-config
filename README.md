# opencode-config

An opinionated [OpenCode](https://opencode.ai) configuration with security baked in. Plugins, Semgrep rules, env file guarding, secret scanning, and agent guidelines -- the whole lot.

> **Quick start** -- see [Setup](#setup) to get going in two minutes.

## What's in the box

### Env Protection Plugin

`plugins/env-protection.ts` -- Stops the agent dead from ever reading `.env` files, so your secrets don't end up in logs or context. Grand for keeping things tight.

- Blocks `read`, `edit`, `write`, `patch` on any `.env` file
- Blocks `bash` commands that `cat`/`head`/`tail`/`source` `.env` files
- Blocks `grep` targeting `.env` file patterns
- Lets `.env.example`, `.env.sample`, `.env.template` through, no bother
- Throws a clear error telling you why and what to use instead

### Supply Chain Guard Plugin

`plugins/supply-chain-guard.ts` -- Automatically scans your project after any package install or update. Covers nine ecosystems, scanning both vendor directories and your own source code.

| Ecosystem | Package Managers | Scans |
|---|---|---|
| **JS/TS** | npm, pnpm, yarn, bun | `node_modules/` + project source |
| **PHP** | composer | `vendor/` + project source |
| **Ruby** | bundler, gem | `vendor/bundle/` + project source |
| **C#/.NET** | dotnet, nuget | project source |
| **Java** | maven (mvn), gradle | project source |
| **Python** | pip, pip3, poetry, pipenv, uv | project source |
| **Rust** | cargo | project source |
| **Go** | go modules | project source |
| **C/C++** | conan, vcpkg | project source |

How it works:
- Intercepts install/update commands via `tool.execute.before/after` hooks
- Runs Semgrep with custom security recipes against the appropriate targets
- Smart caching: hashes the lockfile and recipe files, skips the scan if nothing's changed
- Persistent cache survives restarts (`.supply-chain-guard-cache.json`)
- Groups findings by rule, shows details inline in the agent's output

### Semgrep Security Recipes

`semgrep/recipes/` -- 254 custom rules across 11 recipe files covering JS/TS, PHP, C#, Ruby, Java, Python, Rust, Go, and C/C++:

| File | Rules | What it's after |
|---|---|---|
| `outbound-network-inventory.yaml` | 23 | JS/TS outbound network calls (fetch, axios, WebSocket, http/net/tls/dns, child_process, dynamic imports, eval, new Function) |
| `php-outbound-network-inventory.yaml` | 29 | PHP outbound network calls (cURL, file_get_contents, fopen, sockets, Guzzle, Symfony HttpClient, WordPress HTTP API, SoapClient, DNS, mail, header redirects) |
| `npm-backdoor-detection.yaml` | 13 | JS/TS supply chain backdoor patterns (env exfiltration, eval+base64, reverse shells, DNS exfil, obfuscated require/exec, curl/wget in postinstall) |
| `php-backdoor-detection.yaml` | 14 | PHP backdoor patterns (eval+base64, webshell writes, shell_exec, proc_open, dynamic include/require, variable functions) |
| `csharp-backdoor-detection.yaml` | 24 | C# outbound + backdoors (HttpClient, WebClient, TcpClient, Socket, Assembly.Load, BinaryFormatter, PowerShell launch, download+execute) |
| `ruby-backdoor-detection.yaml` | 29 | Ruby outbound + backdoors (Net::HTTP, HTTParty, Faraday, RestClient, TCPSocket, Marshal.load, YAML.load, eval+base64) + Rails (constantize, render inline) |
| `java-backdoor-detection.yaml` | 26 | Java outbound + backdoors (HttpClient, OkHttp, Socket, RestTemplate, WebClient, ObjectInputStream, JNDI lookup, ScriptEngine, URLClassLoader) |
| `python-backdoor-detection.yaml` | 32 | Python outbound + backdoors (requests, urllib, httpx, aiohttp, socket, pickle, eval+base64, exec+compile, env exfil, ctypes) |
| `rust-backdoor-detection.yaml` | 16 | Rust outbound + suspicious (reqwest, hyper, TcpStream, Command, unsafe blocks, FFI, dynamic library loading) |
| `go-backdoor-detection.yaml` | 24 | Go outbound + backdoors (net/http, net.Dial, gRPC, DNS, init() abuse, download+exec, env exfil, plugin.Open, CGo) |
| `c-cpp-backdoor-detection.yaml` | 24 | C/C++ outbound + suspicious (socket, libcurl, getaddrinfo, system, execve, dlopen, mmap, VirtualAlloc, Boost.Asio) |

### Chrome DevTools MCP

`opencode.jsonc` -- Configured to run [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp). Allows the agent to control a headless Chrome instance or connect to a running one via debug port (9222) for advanced web tasks.

- Runs via `npx` (requires Node.js)
- Can inspect DOM, network, console, and run audits

### Pre-Push Secret Scanning

`.husky/pre-push` -- A git hook that scans your tracked files for leaked secrets before you push. Two-pass approach using ripgrep:

1. **Keyword-context scan** -- catches `api_key = "..."`, `password: "..."`, and similar assignment patterns
2. **Prefix-based scan** -- catches secrets by their distinctive format (AWS `AKIA*`, GitHub `ghp_*`, Stripe `sk_live_*`, private key headers, JWTs, and 40+ other provider prefixes)

The prefix patterns live in `secrets/secret-patterns.txt` (44 patterns covering AWS, GCP, OpenAI, Anthropic, Stripe, GitHub, GitLab, Slack, SendGrid, npm, PyPI, Hugging Face, Fly.io, Vault, and more). See [Third-party attribution](#third-party-attribution) for sources.

- Only scans git-tracked files (what actually gets pushed)
- Reports `file:line:column` for each match
- All output to stderr so it doesn't interfere with the OpenCode TUI
- Bypass with `git push --no-verify` if you're sure of yourself

### Agent Guidelines

`AGENTS.md` -- System-wide instructions for coding agents, so they don't go off making a bags of things:

- DRY-first approach (reuse > libraries > conventions > new code)
- Security protocol: run semgrep on `node_modules` when first working with a project
- Mode-specific guidelines (analyse, build, plan, brainstorm, creative, wild)

## Setup

You'll be needing [OpenCode](https://opencode.ai), [Semgrep](https://semgrep.dev), and [ripgrep](https://github.com/BurntSushi/ripgrep).

### Fork or clone (recommended)

Fork or clone the repo, check out a release tag, and install. Updates come through git.

```bash
# Fork on GitHub first, then:
git clone https://github.com/<you>/opencode-config.git ~/.config/opencode-config
cd ~/.config/opencode-config

# Check out the latest release
git checkout v1.2.0

# Install dependencies
npm install

# Tell OpenCode to use this config
# bash/zsh: add to ~/.bashrc or ~/.zshrc
export OPENCODE_CONFIG=~/.config/opencode-config/opencode.jsonc

# fish: add to ~/.config/fish/config.fish
set -gx OPENCODE_CONFIG ~/.config/opencode-config/opencode.jsonc

# Windows PowerShell: add to your $PROFILE
$env:OPENCODE_CONFIG = "$env:USERPROFILE\.config\opencode-config\opencode.jsonc"
```

If you've no existing config, you can clone straight into `~/.config/opencode` instead -- no `OPENCODE_CONFIG` needed.

#### Updating

Pull new releases from upstream and check out the tag:

```bash
cd ~/.config/opencode-config
git fetch --tags
git checkout v1.2.0
npm install
```

### Cherry-pick what you want

You can also just grab the bits you fancy:

```bash
# Copy only the plugins into your existing setup
cp plugins/*.ts ~/.config/opencode/plugins/

# Or just the semgrep recipes
cp -r semgrep/ ~/.config/opencode/semgrep/

# Or the secret scanning patterns + hook
cp -r secrets/ ~/.config/opencode/secrets/
cp .husky/pre-push ~/.config/opencode/.husky/pre-push
```

---

The plugins fire up automatically at startup. Semgrep recipes are referenced by the supply chain guard plugin at runtime.

## Manual scan

Run the recipes directly against any project yourself:

```bash
# JS/TS - node_modules (requires bypassing gitignore + semgrepignore)
semgrep --config ~/.config/opencode/semgrep/recipes/ \
  --no-git-ignore \
  --exclude='!node_modules' \
  node_modules/

# PHP - vendor
semgrep --config ~/.config/opencode/semgrep/recipes/ \
  --no-git-ignore \
  --exclude='!vendor' \
  vendor/

# Ruby - vendor/bundle
semgrep --config ~/.config/opencode/semgrep/recipes/ \
  --no-git-ignore \
  --exclude='!vendor' \
  vendor/bundle/

# Project source (all ecosystems)
semgrep --config ~/.config/opencode/semgrep/recipes/ .
```

Key flags:
- `--no-git-ignore` -- otherwise `.gitignore` excludes vendor dirs
- `--exclude='!node_modules'` / `--exclude='!vendor'` -- overrides Semgrep's built-in `.semgrepignore` which skips these

## Third-party attribution

The pre-push secret scanning patterns in `secrets/secret-patterns.txt` were derived from and validated against:

- **[gitleaks](https://github.com/gitleaks/gitleaks)** (MIT licence, pinned to v8.30.1) -- the leading open-source secret detection tool. Run `scripts/fetch-gitleaks-config.sh` to download the full `gitleaks.toml` for reference.
- **[GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning)** -- GitHub's documentation on supported secret scanning patterns and partner integrations.

See `secrets/ATTRIBUTION.md` for full details.

## Licence

[MIT](LICENSE)
