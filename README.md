# opencode-config

An opinionated [OpenCode](https://opencode.ai) configuration with security baked in. Plugins, Semgrep rules, env file guarding, secret scanning, and agent guidelines -- the whole lot.

## What's in the box

### Env Protection Plugin

`plugins/env-protection.ts` -- Stops the agent dead from ever reading `.env` files, so your secrets don't end up in logs or context. Grand for keeping things tight.

- Blocks `read`, `edit`, `write`, `patch` on any `.env` file
- Blocks `bash` commands that `cat`/`head`/`tail`/`source` `.env` files
- Blocks `grep` targeting `.env` file patterns
- Lets `.env.example`, `.env.sample`, `.env.template` through, no bother
- Throws a clear error telling you why and what to use instead

### Supply Chain Guard Plugin

`plugins/supply-chain-guard.ts` -- An OpenCode plugin that gives your dependency directories a good once-over after any package install or update. Supports nine ecosystems.

- **JS/TS**: npm, pnpm, yarn, bun -- scans `node_modules/`
- **PHP**: composer -- scans `vendor/`
- **C#/.NET**: dotnet, nuget -- scans project source
- **Ruby**: bundler, gem -- scans `vendor/bundle/`
- **Java**: maven (mvn), gradle -- scans project source
- **Python**: pip, pip3, poetry, pipenv, uv -- scans project source
- **Rust**: cargo -- scans project source
- **Go**: go modules -- scans project source
- **C/C++**: conan, vcpkg -- scans project source

How it works:
- Intercepts install/update commands via `tool.execute.before/after` hooks
- Runs Semgrep with custom security recipes against the appropriate target
- Smart caching: hashes the lockfile and recipe files, skips the scan if nothing's changed
- Persistent cache survives restarts (`.supply-chain-guard-cache.json`)
- Groups findings by rule, shows details inline in the agent's output

### Semgrep Security Recipes

`semgrep/recipes/` -- 234 custom rules across 10 recipe files covering JS/TS, PHP, C#, Ruby, Java, Python, Rust, Go, and C/C++:

| File | Rules | What it's after |
|---|---|---|
| `outbound-network-inventory.yaml` | 23 | JS/TS outbound network calls (fetch, axios, WebSocket, http/net/tls/dns, child_process, dynamic imports, eval, new Function) |
| `npm-backdoor-detection.yaml` | 13 | JS/TS supply chain backdoor patterns (env exfiltration, eval+base64, reverse shells, DNS exfil, obfuscated require/exec, curl/wget in postinstall) |
| `php-backdoor-detection.yaml` | 23 | PHP outbound (cURL, file_get_contents, fsockopen, Guzzle) + backdoors (eval+base64, webshell writes, shell_exec, proc_open) |
| `csharp-backdoor-detection.yaml` | 24 | C# outbound (HttpClient, WebClient, TcpClient, Socket) + backdoors (Assembly.Load, BinaryFormatter, PowerShell launch, download+execute) |
| `ruby-backdoor-detection.yaml` | 29 | Ruby outbound (Net::HTTP, HTTParty, Faraday, RestClient, TCPSocket) + backdoors (Marshal.load, YAML.load, eval+base64) + Rails (constantize, render inline) |
| `java-backdoor-detection.yaml` | 26 | Java outbound (HttpClient, OkHttp, Socket, RestTemplate, WebClient) + backdoors (ObjectInputStream, JNDI lookup, ScriptEngine, URLClassLoader) |
| `python-backdoor-detection.yaml` | 32 | Python outbound (requests, urllib, httpx, aiohttp, socket) + backdoors (pickle, eval+base64, exec+compile, env exfil, ctypes) |
| `rust-backdoor-detection.yaml` | 16 | Rust outbound (reqwest, hyper, TcpStream) + suspicious (Command, unsafe blocks, FFI, dynamic library loading) |
| `go-backdoor-detection.yaml` | 24 | Go outbound (net/http, net.Dial, gRPC, DNS) + backdoors (init() abuse, download+exec, env exfil, plugin.Open, CGo) |
| `c-cpp-backdoor-detection.yaml` | 24 | C/C++ outbound (socket, libcurl, getaddrinfo) + suspicious (system, execve, dlopen, mmap, VirtualAlloc, Boost.Asio) |

### Pre-Push Secret Scanning

`.husky/pre-push` -- A git hook that has a good rummage through your tracked files for leaked secrets before you push. Uses ripgrep.

- Catches API keys, tokens, passwords, credentials, private keys
- Only scans git-tracked files (what actually gets pushed, like)
- Reports `file:line:column` for each match
- All output to stderr so it doesn't make a hames of the OpenCode TUI
- Bypass with `git push --no-verify` if you're sure of yourself

### GPG Commit Signing

All commits are GPG-signed. The git config is set globally:

```bash
git config --global user.signingkey <your-key-id>
git config --global commit.gpgsign true
git config --global tag.gpgSign true
```

Don't forget to add your public key to GitHub under Settings → SSH and GPG keys.

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
git checkout v1.0.1

# Install dependencies
npm install

# Tell OpenCode to load from it
# bash/zsh: add to ~/.bashrc or ~/.zshrc
export OPENCODE_CONFIG_DIR=~/.config/opencode-config

# fish: add to ~/.config/fish/config.fish
set -gx OPENCODE_CONFIG_DIR ~/.config/opencode-config

# Windows PowerShell: add to your $PROFILE
$env:OPENCODE_CONFIG_DIR = "$env:USERPROFILE\.config\opencode-config"
```

If you've no existing config, you can clone straight into `~/.config/opencode` instead -- no `OPENCODE_CONFIG_DIR` needed.

#### Updating

Pull new releases from upstream and check out the tag:

```bash
cd ~/.config/opencode-config
git fetch --tags
git checkout v1.0.1
npm install
```

### Cherry-pick what you want

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

# All other ecosystems (Python, Java, C#, Go, Rust, C/C++)
# Deps live in global caches, so scan project source:
semgrep --config ~/.config/opencode/semgrep/recipes/ .
```

Key flags:
- `--no-git-ignore` -- otherwise `.gitignore` excludes vendor dirs
- `--exclude='!node_modules'` / `--exclude='!vendor'` -- overrides Semgrep's built-in `.semgrepignore` which skips these

## Licence

[MIT](LICENSE)
