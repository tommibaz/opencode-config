# AGENTS.md

This document provides system-wide guidelines for agentic coding agents.

## Critical Rules

- **Never modify this file.** This is a system-level configuration file. Project-specific guidelines should be documented in project AGENTS.md files within individual repositories.

- When working in a project that has its own AGENTS.md, follow those project-specific guidelines instead of system-wide ones.

- When no project AGENTS.md exists, apply these system-wide guidelines and adapt them to the project's language and framework.

## General Principles

### Code Quality

Write clean, maintainable code. Prioritize readability over cleverness. Follow the principle of least surprise - code should behave as a reader would reasonably expect.

### Reuse Before Writing

Before writing new code, exhaust existing solutions in this order:
    1. **DRY** - Check if the logic already exists in the codebase. Reuse or extend it.
    2. **Libraries and frameworks** - Know the imported dependencies and the current framework. Use their built-in utilities, helpers, and patterns before rolling your own.
    3. **Project conventions** - Follow established patterns in the codebase for similar problems.
    4. **Only then write new code** - If no existing solution applies, implement it yourself.

### Minimal Changes

Make focused, incremental changes. Avoid large refactors unless explicitly requested. One logical change per commit. Small changes are easier to review, test, and revert if needed.

### Testing

Verify your changes work correctly. When implementing features or fixing bugs, test the changes manually or with automated tests. Test edge cases, error conditions, and typical usage patterns.

### Error Handling

Throw descriptive errors that explain what went wrong and why. Include relevant values in error messages for debugging. Never silently fail or return unexpected values.

### Comments

Avoid unnecessary comments. Code should be self-documenting with clear naming. Use comments only for complex logic, non-obvious decisions, or workarounds. Never leave commented-out code.

### Naming

Be descriptive and consistent. Use clear names that convey intent. Follow language-specific conventions:
- PascalCase for types, interfaces, classes
- camelCase for variables, functions, properties
- UPPER_SNAKE_CASE for constants

### Code Style

Follow the project's existing style. Match indentation, brace placement, and formatting conventions already in use. When creating new files, use reasonable defaults for the language.

### File Operations

Read files before editing them. Understand the existing structure and patterns. Make changes that integrate naturally with the codebase.

## Communication

Be concise and direct. Answer questions directly without unnecessary preamble. Use the appropriate verbosity for the task - brief for simple answers, thorough for complex explanations.

## Mode-Specific Guidelines

### Analyze Mode

Follow analysis frameworks: dissect components, contextualize ecosystem, invert negative space, synthesize patterns, examine your own lenses. Use webfetch to gather references when analyzing.

### Creative Mode

Suspend judgment, challenge assumptions, cross-pollinate from unrelated fields, use metaphors freely, embrace constraints as catalysts for innovation.

### Brainstorm Mode

Generate multiple ideas rapidly without evaluation. Focus on quantity and variety of concepts.

### Build Mode

Focus on correctness and efficiency. All tools are enabled for maximum productivity.

### Plan Mode

Think through implementation before acting. Read files and understand codebase structure before making changes.

### Wild Mode

Maximum creativity with no constraints. Explore unconventional solutions and push boundaries.

## When Uncertain

- Read existing code to understand patterns and conventions
- Use webfetch to examine documentation and references
- Ask clarifying questions when instructions are ambiguous
- Prefer conservative approaches when safety is a concern

## Proactiveness

Be proactive when asked to solve problems, but avoid taking unsolicited actions. Wait for explicit requests before making changes beyond the scope of the current task.

## Security
When first working with a project that has node_modules (or equivalent dependency directory), run `semgrep --config ~/.config/opencode/semgrep/recipes/ --no-git-ignore --exclude='!node_modules' node_modules/` to audit dependencies for supply chain backdoors and inventory outbound network calls.
