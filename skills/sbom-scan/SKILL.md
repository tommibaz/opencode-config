---
name: sbom-scan
description: >-
  Set up SBOM vulnerability scanning with Trivy in GitHub Actions CI.
  Use when the user wants to add SBOM scanning, supply chain security,
  Trivy CI, vulnerability scanning, SPDX generation, or SARIF reporting
  to their GitHub project. Detects GitHub repos, generates workflow files,
  and automates setup via gh CLI when available.
compatibility: opencode
metadata:
  audience: developers
  workflow: security
---

# SBOM Vulnerability Scanning Setup

This skill sets up automated SBOM (Software Bill of Materials) vulnerability scanning using Trivy in a GitHub Actions CI pipeline.

## What it does

1. **Detects** if the current project is a GitHub repository
2. **Generates** a GitHub Actions workflow that:
   - Creates an SPDX SBOM on every push, PR, and daily schedule
   - Scans with Trivy for CRITICAL/HIGH/MEDIUM vulnerabilities (blocks the build)
   - Reports LOW-severity findings to GitHub Security > Code scanning via SARIF
3. **Automates** commit, push, and first workflow trigger via `gh` CLI if available
4. **Provides** clear manual instructions if `gh` CLI is not available

## Usage

Call the `sbom-scan` tool. It will:

- Check if the current directory is a GitHub repo
- Write `.github/workflows/sbom-scan.yml`
- Detect `gh` CLI and automate the setup if possible
- Fall back to manual instructions otherwise

## Severity levels

| Severity | CVSS | Action |
|---|---|---|
| CRITICAL | 9.0-10.0 | Blocks build |
| HIGH | 7.0-8.9 | Blocks build |
| MEDIUM | 4.0-6.9 | Blocks build |
| LOW | 0.1-3.9 | Reported to Security tab (informational) |

## Requirements

- A GitHub repository with a remote pointing to github.com
- Optional: `gh` CLI for automated commit/push/trigger
- Optional: GitHub MCP for future editor-integrated automation

## Local scanning

For local SBOM scanning without CI, install Trivy and run:

```bash
trivy fs --format spdx-json --output sbom.spdx.json .
trivy sbom sbom.spdx.json
```
