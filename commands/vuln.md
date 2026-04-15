---
description: Start a vulnerability handling session (CVE/CWE)
agent: analyze
---

Load the vulnerability-handling skill and begin an interactive vulnerability
handling session. The CVE or vulnerability is: $ARGUMENTS

If no CVE or CWE was provided, attempt to discover vulnerabilities automatically:
1. **GitHub repos** — check for Dependabot PRs/alerts (`gh api`), SARIF results
   from CodeQL/Semgrep, and SBOM data via `gh api repos/{owner}/{repo}/dependency-graph/sbom`
2. **Local projects** — look for SBOM files (e.g. `sbom.json`, `bom.json`,
   `*.cdx.json`) or run `npm audit` / `composer audit` / `pip audit` as appropriate
3. If nothing is found automatically, ask the user which vulnerability they need
   to handle

Present any discovered vulnerabilities to the user and let them pick which one
to work on.

Follow the complete workflow from the skill: identify and classify (analyze mode),
assess risk (plan mode), then write tests, fix, version-lock, document, and
verify in CI (build mode). Switch modes as indicated at each step.
