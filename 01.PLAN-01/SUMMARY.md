# KW-OS: Knowledge Worker Operating System
## Comprehensive Analysis & Summary

> **Single npx command → Any IDE becomes an AI-powered Knowledge Worker**
> Zero APIs. Zero subscriptions. Fully local. Fully private.

---

## 1. Executive Summary

**KW-OS** is a single `npx` package that transforms any MCP-compatible IDE (Windsurf, Cursor, VS Code, Claude Code, Antigravity, Qoder) into an **Elite Knowledge Worker Agent**. The agent can perform both coding AND professional knowledge work: creating/editing PowerPoint, Excel, Word, PDF files; performing browser-based research and automation; running financial analysis; monitoring global trends for business/economic/political insights — **all without requiring a single API key or cloud subscription**.

### Core Principles
- **Zero API Keys**: Every capability runs locally or via browser automation — no API setup ever
- **Single Command**: `npx kw-os init` installs and configures everything
- **Local-First**: All MCP servers run on the user's machine
- **Universal IDE**: Works with Cursor, Windsurf, VS Code, Claude Code, Antigravity, Qoder
- **Full Lifecycle**: Extract, analyse, create, and edit binary files (pptx, xlsx, docx, pdf)

---

## 2. Ideas Analysis (from 00.IDEA/)

### idea1.md — Local-First MCP Stack
- Proposes the **Local Orchestrator** pattern: the npx package doesn't contain servers, it pulls them
- Lists Office MCP servers (powerpoint-mcp, mcp-openpyxl, mcp-python-docx)
- Lists Finance servers (hledger-mcp, finance-trading-ai-agents-mcp, SQLite)
- Lists Research servers (web-search-mcp, mcp-documentation-server, markitdown)
- Lists Skills repos (cursor-skills, mcp-prompt-templates, cursorrules)
- Proposes "Master Skill" `.cursorrules` that orchestrates tool usage

### idea2.md — Simplified No-Auth Architecture
- Reinforces zero-subscription, zero-auth as the core selling point
- Adds `shell-mcp` for general CLI access
- Proposes Agent Skills as `.md` files in folders, not hardcoded prompts
- Highlights Smithery CLI as existing installer pattern (`npx @smithery/cli install`)
- Notes `office-powerpoint-mcp` has a built-in `prompts/` directory

### idea3.md — MCP Package Manager Approach
- Notes Smithery and mcp-get as existing installers
- Adds `@automatalabs/mcp-server-playwright` for browser-based research
- Adds `knowledge-mcp` for local vector database memory
- Proposes `.agents/skills/` folder as standardized skill injection location
- Emphasizes that IDE gives AI **direct filesystem access** vs. web chat

### Key Takeaway from All Three Ideas
The ideas converge on the same architecture: **a single npx installer that pulls local MCP servers, generates IDE config, and injects professional skills/rules**. The gap is that no single package does this today. KW-OS fills that gap.

---

## 3. Researched Projects for Inclusion

### 3.1 WorldMonitor — Global Intelligence Dashboard
- **Repo**: [koala73/worldmonitor](https://github.com/koala73/worldmonitor)
- **What it does**: Real-time global intelligence — 435+ curated news feeds across 15 categories, AI-synthesized briefs, geopolitical monitoring, finance radar (92 stock exchanges, commodities, crypto), Country Intelligence Index, cross-stream correlation of military/economic/disaster signals
- **Tech**: Vue.js + globe.gl + deck.gl, supports local AI via Ollama
- **Problem**: Uses many external APIs and data sources (30+ external feeds)
- **KW-OS Strategy**: **Do NOT include the full app**. Instead:
  1. Include a **"Global Intelligence" skill** that teaches the agent to use browser automation (Playwright MCP) to scrape the same public data sources WorldMonitor uses
  2. Include a **"Trend Analysis" prompt template** that instructs the agent to monitor news feeds, financial data, and geopolitical signals via browser
  3. Create **data scraping workflows** that replicate WorldMonitor's key capabilities without APIs
  4. Use the agent's local data analysis tools (Excel, charts, SQLite) to synthesize intelligence reports

### 3.2 Agent Browser (Vercel Labs)
- **Repo**: [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
- **What it does**: Fast native Rust CLI for browser automation by AI agents
- **Key capabilities**: 
  - Semantic locators (find elements by role, text, label — not just CSS)
  - Snapshot-based interaction (accessibility tree with refs like @e1, @e2)
  - Session persistence and authentication import from existing browser
  - `--json` mode for machine-readable output
  - Works with Claude Code, Cursor, Windsurf via SKILL.md
- **Installation**: `npm install -g agent-browser && agent-browser install` (downloads Chrome for Testing)
- **No API keys needed**: Fully local, uses Chrome for Testing
- **KW-OS Strategy**: **INCLUDE as primary browser automation tool**
  - Install `agent-browser` globally during `npx kw-os init`
  - Bundle the official SKILL.md for agent integration
  - Use for: web research, data scraping, form filling, site monitoring
  - Superior to Playwright MCP for token efficiency (CLI-based vs MCP schema overhead)

### 3.3 Microsoft Playwright MCP
- **Repo**: [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- **What it does**: MCP server wrapping Playwright for browser automation
- **Key capabilities**:
  - Uses accessibility tree (not pixel-based) — LLM-friendly, no vision models needed
  - Deterministic tool application
  - 35+ tools: navigate, click, fill, screenshot, PDF export, console messages, network monitoring
  - Native MCP protocol — works seamlessly with all MCP clients
  - Config for every major IDE: Cursor, Windsurf, VS Code, Claude Code, Antigravity, etc.
- **Installation**: `npx @playwright/mcp@latest` — zero config, no API keys
- **KW-OS Strategy**: **INCLUDE as MCP-native browser server**
  - Use alongside agent-browser: Playwright MCP for persistent state/long-running workflows, agent-browser for quick CLI tasks
  - Essential for: online research, data gathering to replace WorldMonitor APIs, web form automation
  - Configuration is trivial: single line in mcp.json

---

## 4. Complete MCP Server Inventory for KW-OS

### Tier 1: Core System (Always Installed)

| Server | Source | Type | Purpose | API Required |
|--------|--------|------|---------|:---:|
| **Filesystem** | `@modelcontextprotocol/server-filesystem` | npm | Secure file read/write/search | ❌ |
| **Git** | `modelcontextprotocol/servers/src/git` | Node | Repository management | ❌ |
| **Memory** | `modelcontextprotocol/servers/src/memory` | Node | Knowledge graph persistence | ❌ |
| **Fetch** | `modelcontextprotocol/servers/src/fetch` | Node | Web content fetching → Markdown | ❌ |
| **Sequential Thinking** | `modelcontextprotocol/servers/src/sequentialthinking` | Node | Multi-step reasoning chains | ❌ |
| **Time** | `modelcontextprotocol/servers/src/time` | Node | Timezone conversions | ❌ |

### Tier 2: Browser Automation (Always Installed)

| Server | Source | Type | Purpose | API Required |
|--------|--------|------|---------|:---:|
| **Playwright MCP** | `@playwright/mcp` | npm | MCP-native browser automation (35+ tools) | ❌ |
| **Agent Browser** | `agent-browser` | npm (Rust CLI) | CLI-based browser automation + SKILL | ❌ |

### Tier 3: Office Document Lifecycle

| Server | Source | Type | Purpose | API Required |
|--------|--------|------|---------|:---:|
| **PowerPoint** | `dmytro-ustynov/office-powerpoint-mcp-server` | Python | Create/edit .pptx files | ❌ |
| **PowerPoint** (alt) | `ichigo3766/powerpoint-mcp` | Python | Slides, tables, charts | ❌ |
| **Excel** | `byjonemo/mcp-openpyxl` | Python | Full .xlsx manipulation | ❌ |
| **Excel** (alt) | `haris-musa/excel-mcp-server` | Python | Charts, pivot tables, formatting | ❌ |
| **Word** | `jlowans/mcp-python-docx` | Python | Create/edit .docx documents | ❌ |
| **PDF Reader** | `SylphxAI/pdf-reader-mcp` | Node | Extract text/images/metadata from PDF | ❌ |
| **PDF Extraction** | `xraywu/mcp-pdf-extraction-server` | Python | PDF content extraction | ❌ |
| **MarkItDown** | `microsoft/markitdown` | Python | Convert any doc (PDF/Office/HTML) → Markdown | ❌ |
| **Document Ops** | `alejandroballesteros/document-operations` | Node | Multi-format document operations | ❌ |

### Tier 4: Data Analysis & Visualization

| Server | Source | Type | Purpose | API Required |
|--------|--------|------|---------|:---:|
| **Chart Generation** | `antvis/mcp-server-chart` | Node | 26+ chart types (line, bar, pie, sankey, etc.) | ❌ |
| **Data Exploration** | `reading-plus-ai/mcp-server-data-exploration` | Python | Autonomous CSV data analysis | ❌ |
| **Vega-Lite** | `isaacwasserman/mcp-vegalite-server` | Node | Generate visualizations from data | ❌ |
| **SQLite** | `modelcontextprotocol/servers` (archived) | Python | Local SQL database | ❌ |

### Tier 5: Financial & Accounting

| Server | Source | Type | Purpose | API Required |
|--------|--------|------|---------|:---:|
| **hledger** | `iiAtlas/hledger-mcp` | Python | Double-entry bookkeeping | ❌ |
| **Finance Analysis** | `aitrados/finance-trading-ai-agents-mcp` | Python | Quantitative financial metrics | ❌ |
| **CoinCap** | `QuantGeekDev/coincap-mcp` | Node | Real-time crypto data (public API, no auth) | ❌ |

### Tier 6: Research & Knowledge

| Server | Source | Type | Purpose | API Required |
|--------|--------|------|---------|:---:|
| **Web Search** | `mrkrsl/web-search-mcp` | Node | Local web search + summaries | ❌ |
| **Read Website Fast** | `just-every/mcp-read-website-fast` | Node | Token-efficient web → Markdown | ❌ |
| **Documentation Server** | `andrea9293/mcp-documentation-server` | Python | PDF semantic search (Orama) | ❌ |
| **JSON MCP** | `VadimNastoyashchy/json-mcp` | Node | JSON file manipulation | ❌ |

### Tier 7: Communication & Utilities

| Server | Source | Type | Purpose | API Required |
|--------|--------|------|---------|:---:|
| **Email** | `Shy2593666979/mcp-server-email` | Python | Send emails (Gmail, Outlook, etc. via SMTP) | ❌* |
| **Image Editing** | `flowy11/imagician` | Node | Resize, crop, convert images | ❌ |
| **CalDAV** | `dominik1001/caldav-mcp` | Python | Calendar operations | ❌* |

*Note: Email/Calendar use existing user credentials, not API keys*

---

## 5. Skills & Agent Rules Inventory

### Existing Skill Sources

| Source | Repository | Content |
|--------|------------|---------|
| **Agent Browser SKILL** | `vercel-labs/agent-browser` | Browser automation workflow |
| **Playwright CLI SKILL** | `microsoft/playwright-cli` | Browser test automation |
| **Cursor Skills** | `chrisboden/cursor-skills` | Financial modeling, branding |
| **Prompt Templates** | `mikeskarl/mcp-prompt-templates` | Content analysis templates |
| **Awesome Cursorrules** | `PatrickJS/awesome-cursorrules` | 100+ role-specific rulesets |
| **Knowledge Worker Rules** | `Qwertic/cursorrules` | PM & Data Analyst rules |

### KW-OS Skill Categories to Bundle

#### Knowledge Work Skills
1. **Financial Analyst** — Balance sheets, income statements, forecasting, ratio analysis
2. **Presentation Designer** — Slide layouts, corporate themes, visual storytelling
3. **Research Synthesizer** — Multi-hop search, source triangulation, citation management
4. **Data Analyst** — CSV/Excel modeling, chart creation, trend analysis, pivot tables
5. **Document Editor** — Professional report writing, formatting, review cycles
6. **Project Manager** — Task tracking, timelines, status reports, Gantt charts
7. **Business Strategist** — SWOT, Porter's Five Forces, competitive analysis, roadmaps
8. **Global Intelligence Analyst** — News monitoring, trend analysis, geopolitical signals (replaces WorldMonitor APIs with browser skills)
9. **Browser Automation Specialist** — Web scraping, form filling, data extraction, site monitoring

#### Coding Skills (inherited from IDE)
The IDE's native coding capabilities are preserved. KW-OS adds knowledge work on top, not replacing any coding ability.

---

## 6. WorldMonitor API Replacement Strategy

WorldMonitor uses 30+ external data sources. KW-OS replaces these with **browser automation skills**:

| WorldMonitor API Source | KW-OS Replacement | Tool Used |
|------------------------|-------------------|-----------|
| News API feeds | Scrape RSS feeds & news sites | Playwright MCP / agent-browser |
| Stock exchange data | Scrape Yahoo Finance, Google Finance | Playwright MCP |
| Commodities data | Scrape investing.com, kitco.com | Playwright MCP |
| Crypto data | CoinCap MCP (public, no auth) | coincap-mcp |
| Geopolitical indices | Scrape public index providers | Playwright MCP |
| Climate/weather data | Scrape weather.gov, open-meteo.com | agent-browser |
| Flight data (Wingbits) | Skip — niche, not core knowledge work | — |
| Currency exchange | Scrape xe.com or use Frankfurter API (free, no auth) | Playwright MCP / fetch |

**Implementation**: A "Global Intelligence" skill teaches the agent to:
1. Open target sites with Playwright MCP
2. Extract structured data from tables/feeds
3. Store in local SQLite database
4. Analyse trends in Excel/charts
5. Generate intelligence brief in PowerPoint or Word

---

## 7. Architecture Overview

### Installation Flow
```
npx kw-os init [--ide cursor|windsurf|vscode|claude|antigravity|qoder]
│
├── 1. ENVIRONMENT CHECK
│   ├── Node.js >= 18 ✓
│   ├── Python >= 3.10 ✓
│   ├── pip ✓
│   └── Git ✓
│
├── 2. INSTALL MCP SERVERS (to ~/.kw-os/servers/)
│   ├── Core: filesystem, git, memory, fetch, sequentialthinking, time
│   ├── Browser: playwright-mcp, agent-browser (+ Chrome for Testing)
│   ├── Office: powerpoint-mcp, openpyxl-mcp, python-docx-mcp
│   ├── Data: markitdown, pdf-reader-mcp, chart-mcp, data-exploration
│   ├── Finance: hledger-mcp, sqlite
│   └── Research: web-search-mcp, read-website-fast
│
├── 3. GENERATE IDE CONFIG
│   ├── Detect IDE or use --ide flag
│   ├── Write mcp.json with all server configs
│   └── No API keys in any config
│
├── 4. INJECT SKILLS & RULES
│   ├── Master Knowledge Worker rule
│   ├── Professional skill .md files
│   ├── Browser automation SKILL.md
│   ├── Discoverable prompt templates
│   └── Project-specific rules
│
└── 5. VERIFY & REPORT
    ├── Health-check each server
    ├── Print status table
    └── Show "Getting Started" guide
```

### Directory Structure
```
~/.kw-os/
├── servers/
│   ├── core/           # filesystem, git, memory, fetch, sequentialthinking, time
│   ├── browser/        # playwright-mcp config, agent-browser binary
│   ├── office/         # powerpoint, openpyxl, python-docx
│   ├── data/           # markitdown, pdf-reader, chart-mcp, data-exploration
│   ├── finance/        # hledger-mcp, sqlite
│   └── research/       # web-search-mcp, read-website-fast
├── skills/
│   ├── master-knowledge-worker.md
│   ├── financial-analyst.md
│   ├── presentation-designer.md
│   ├── research-synthesizer.md
│   ├── data-analyst.md
│   ├── global-intelligence.md
│   ├── browser-automation.md
│   └── business-strategist.md
├── prompts/
│   ├── financial-report.md
│   ├── market-research.md
│   ├── competitive-analysis.md
│   ├── slide-deck.md
│   └── trend-brief.md
├── templates/
│   ├── mcp.cursor.json
│   ├── mcp.windsurf.json
│   ├── mcp.vscode.json
│   ├── mcp.claude.json
│   └── mcp.antigravity.json
└── config.json          # User preferences & installed components
```

---

## 8. Competitive Landscape

| Solution | Cost | API Keys? | IDE Support | Knowledge Work? | Browser? |
|----------|------|:---------:|-------------|:---------------:|:--------:|
| **Microsoft 365 Copilot** | $30/mo | Yes (Graph) | Office only | ✓ | ❌ |
| **Smithery CLI** | Free | Per server | Any MCP | ❌ (tools only) | ❌ |
| **MCP-Get** | Free | Per server | Any MCP | ❌ (tools only) | ❌ |
| **Cursor Skills** | Free | N/A | Cursor only | Partial | ❌ |
| **Claude Code** | $20/mo | N/A | Terminal | ❌ | ❌ |
| **KW-OS** | **Free** | **None** | **All MCPs** | **✓ Full** | **✓** |

### KW-OS Unique Differentiators
1. **Only zero-API complete knowledge work stack**
2. **Only package with browser automation + office tools + data analysis + skills combined**
3. **Only universal installer across 6+ IDEs**
4. **Only solution with WorldMonitor-style intelligence without API dependencies**
5. **Only local-first architecture with privacy guarantee**

---

## 9. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP server repo goes offline | High | Fork critical servers to `kw-os` GitHub org; pin versions |
| IDE changes MCP config format | Medium | Abstract config layer; auto-detect IDE version |
| Python/Node version conflicts | Medium | Virtual environments; version detection; clear error messages |
| Browser automation blocked by sites | Medium | Rotate user-agents; respect robots.txt; use multiple scraping strategies |
| Server startup failures | Medium | Health checks; graceful degradation; clear error messages |
| Package size too large | Low | Lazy installation (only download on first use); modular categories |
| Security concerns | High | Sandboxed file access; no outbound data; clear permission model |

---

## 10. Conclusion

KW-OS fills the critical gap between powerful AI models and practical knowledge work. No existing solution combines **local MCP servers + browser automation + office document lifecycle + professional skills + universal IDE support** in a single, zero-API-key package.

By replacing API dependencies with browser automation (Playwright MCP + agent-browser) and bundling curated professional skills, KW-OS delivers the "Holy Grail" for non-developer AI adoption: **one command to make any IDE a full-spectrum knowledge worker**.
