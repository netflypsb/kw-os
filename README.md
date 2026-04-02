# KW-OS — Knowledge Worker Operating System

> **One command to turn any IDE into an AI-powered Knowledge Worker.**
> Zero API keys. Zero subscriptions. Fully local. Fully private.

## Quick Start

```bash
npx kw-os init
```

## What It Does

KW-OS installs and configures a curated stack of local MCP servers, professional skills, and prompt templates that enable your IDE's AI agent to perform knowledge work:

- **Office Suite** — Create/edit PowerPoint, Excel, Word, PDF files
- **Browser Automation** — Web research, data scraping, form filling (Playwright + agent-browser)
- **Data Analysis** — Charts, CSV analysis, SQL queries, visualizations
- **Financial** — Double-entry bookkeeping, financial modeling, crypto data
- **Research** — Web search, document conversion, knowledge persistence
- **Global Intelligence** — News monitoring, trend analysis, geopolitical signals

## Supported IDEs

| IDE | Status |
|-----|--------|
| Cursor | ✅ Full support |
| Windsurf | ✅ Full support |
| VS Code | ✅ Full support |
| Claude Code | ✅ Full support |
| Antigravity | ✅ Full support |
| Qoder | ✅ Full support |

## Commands

```bash
kw-os init              # Install and configure everything
kw-os status            # Show installation health report
kw-os update            # Update servers and skills
kw-os add-skill <name>  # Install a specific skill
kw-os list-skills       # List available professional skills
kw-os doctor            # Diagnose and fix common issues
kw-os test              # Run comprehensive test suite
```

### Test Suite

The `kw-os test` command validates your installation with 6 test suites:

```bash
kw-os test                         # Run all tests (39 total)
kw-os test --suite env              # Environment dependencies only
kw-os test --suite registry         # Server registry validation
kw-os test --suite skills           # Skills loading and metadata
kw-os test --suite build            # TypeScript compilation check
kw-os test --suite install          # Installation integrity
kw-os test --suite health           # Individual server health checks
kw-os test --verbose                # Show detailed failure output
```

### Health Check

The `kw-os status` command provides a detailed health report showing:
- Environment status (Node.js, Python, pip, uv/uvx, Git)
- Installation status for each MCP server
- Server-specific error messages if any
- Overall installation health score

## Options

```bash
kw-os init --ide cursor           # Target a specific IDE
kw-os init --servers core,browser # Install only specific categories
kw-os init --skills all           # Install all skills (default)
kw-os init --no-browser           # Skip browser automation setup
```

## Requirements

- **Node.js** >= 18
- **Python** >= 3.10
- **pip** (Python package manager)
- **uv/uvx** (recommended for Python packages) - Install from https://docs.astral.sh/uv/
- **Git**

## Architecture

KW-OS does not require any API keys or cloud subscriptions. All MCP servers run locally on your machine. Browser automation (Playwright MCP + agent-browser) replaces any need for external API calls.

## License

MIT
