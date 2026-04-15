# Developing opencode-config

This document contains specific instructions for AI agents and developers working on the `opencode-config` repository itself.

## Project Architecture
- `plugins/supply-chain-guard/` - Core supply chain scanning plugin. Follows Single Responsibility Principle (SRP).
- `semgrep/recipes/` - Custom Semgrep YAML rules for various ecosystems.
- `secrets/secret-patterns.txt` - Curated regex patterns for the pre-push secret scanner.
- `opencode.jsonc` - The main global configuration template.
- `AGENTS.md` - The global agent guidelines template.

## Development Rules
- **Code Quality**: No empty statements (like empty `catch` blocks). **Absolutely no dead code** -- no unused functions, no unused variables, no unreachable branches, no type-only overloads that serve no runtime purpose. If code is not called, delete it. Always handle errors appropriately and log them if necessary.
- **Commits**: You must use GRANULAR, focused commits (one logical change per commit).
- **SemVer**: We strictly follow [Semantic Versioning](https://semver.org/). On every release/push that warrants a new tag, you MUST ensure that `package.json`, `README.md` (e.g. checkout instructions), and any other files referencing the git tag version are updated accordingly.
- **Testing**: Use `bun test` for unit tests. Run E2E tests with `bun test tests/supply-chain-guard/e2e.test.ts`. Tests must pass before committing. When working on CI workflows (GitHub Actions), always validate locally with `act` before pushing. Use `act -n` for dry-run validation and `act push` or `act pull_request` to run workflows with a local Docker runner.
- **Supply Chain Guard**: If adding a new ecosystem, update `ecosystems.ts`, add the corresponding semgrep recipes in `semgrep/recipes/`, and update the `README.md`.
- **Secret Patterns**: When adding to `secrets/secret-patterns.txt`, ensure patterns are prefix-based to work efficiently with `ripgrep` in the `.husky/pre-push` hook. Run the regex validation script if you modify patterns.
- **Commit Format**: Use conventional commits (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `build(deps):`).
- **Dependencies & Tools**: Use `npm` for dependency management (`package.json`, `package-lock.json`). When creating OpenCode tools, do **not** add `zod` as an external dependency. Use `tool.schema` provided natively by `@opencode-ai/plugin` instead.

## Context
When modifying this repository, remember that you are modifying the *global* configuration that will be distributed to all users. Keep `AGENTS.md` general enough for all projects, and keep `opencode.jsonc` clean.