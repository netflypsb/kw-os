# KW-OS — Phase-by-Phase Development Plan

> Reference: See SUMMARY.md for full analysis of ideas, MCP servers, skills, and architecture.
> Constraint: **Zero API keys required.** Every capability must work without user-provided API credentials.

---

## Phase 1: Package Foundation & CLI (Weeks 1–2)

### Week 1: Scaffolding, CLI, Environment Detection

**Step 1.1 — Project Scaffolding**

- [ ] Initialize npm package (`name: kw-os`, `bin: { "kw-os": "./bin/kw-os.js" }`)
- [ ] Set up TypeScript (`tsconfig.json` with `Node16` module resolution)
- [ ] Create `bin/kw-os.js` shebang entry point
- [ ] Set up ESLint + Prettier
- [ ] Create `.gitignore`, `.npmignore`
- [ ] Write initial `README.md`

**Project Structure:**
```
kw-os/
├── bin/kw-os.js                 # CLI entry point (#!/usr/bin/env node)
├── src/
│   ├── cli.ts                   # Commander.js program definition
│   ├── commands/
│   │   ├── init.ts              # Main init command (orchestrator)
│   │   ├── status.ts            # Health check & status report
│   │   ├── add-skill.ts         # Install individual skill
│   │   └── update.ts            # Update servers & skills
│   ├── core/
│   │   ├── env-check.ts         # Node/Python/pip/Git/IDE detection
│   │   ├── server-installer.ts  # Clone, install, configure MCP servers
│   │   ├── server-registry.ts   # Server metadata & version pinning
│   │   ├── config-generator.ts  # Generate mcp.json for each IDE
│   │   ├── skill-installer.ts   # Copy skills into workspace
│   │   └── health-check.ts      # Verify servers respond
│   ├── types/
│   │   └── index.ts             # Shared TypeScript interfaces
│   └── utils/
│       ├── logger.ts            # Chalk-colored console output
│       ├── spinner.ts           # Ora progress spinners
│       └── platform.ts          # OS/path normalization helpers
├── registry/
│   └── servers.json             # Master server registry (repos, types, versions)
├── templates/
│   ├── mcp/
│   │   ├── cursor.json          # Cursor mcp.json template
│   │   ├── windsurf.json        # Windsurf mcp.json template
│   │   ├── vscode.json          # VS Code mcp.json template
│   │   ├── claude.json          # Claude Code mcp.json template
│   │   └── antigravity.json     # Antigravity mcp.json template
│   └── rules/
│       └── master-knowledge-worker.md
├── skills/
│   ├── financial-analyst.md
│   ├── presentation-designer.md
│   ├── research-synthesizer.md
│   ├── data-analyst.md
│   ├── global-intelligence.md
│   ├── browser-automation.md
│   ├── business-strategist.md
│   └── document-editor.md
├── prompts/
│   ├── financial-report.md
│   ├── market-research.md
│   ├── competitive-analysis.md
│   ├── trend-brief.md
│   └── slide-deck.md
├── tests/
│   ├── env-check.test.ts
│   ├── server-installer.test.ts
│   ├── config-generator.test.ts
│   └── health-check.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Step 1.2 — CLI Framework**

- [ ] Install `commander`, `chalk`, `ora`, `inquirer`, `fs-extra`, `which`, `semver`
- [ ] Implement `kw-os init` — the main orchestrator command
- [ ] Implement `kw-os status` — health check report
- [ ] Implement `kw-os add-skill <name>` — individual skill installer
- [ ] Implement `kw-os update` — update servers/skills to latest
- [ ] Implement `kw-os list-skills` — show available skills

**CLI Definition:**
```
kw-os init [options]
  --ide <type>      Target IDE: cursor|windsurf|vscode|claude|antigravity|qoder (default: auto-detect)
  --servers <list>  Server categories: all|core|browser|office|data|finance|research (default: all)
  --skills <list>   Skills to install: all|none|comma-separated names (default: all)
  --no-browser      Skip browser automation setup (agent-browser + playwright)

kw-os status        Show installation health report
kw-os update        Update all installed servers and skills
kw-os add-skill <n> Install a specific skill
kw-os list-skills   List available professional skills
kw-os doctor        Diagnose and fix common issues
```

**Step 1.3 — Environment Detection**

- [ ] Detect Node.js version (require >= 18)
- [ ] Detect Python version (require >= 3.10)
- [ ] Detect pip/pip3 availability
- [ ] Detect Git availability
- [ ] Auto-detect IDE from workspace config directories
- [ ] Detect existing `~/.kw-os/` installation (upgrade path)
- [ ] Generate environment status report with actionable error messages

**Supported IDE Detection:**

| IDE | Detection Method | Config Path |
|-----|-----------------|-------------|
| Cursor | `.cursor/` dir exists | `.cursor/mcp.json` |
| Windsurf | `.windsurf/` dir exists | `.windsurf/mcp.json` |
| VS Code | `.vscode/` dir exists | `.vscode/mcp.json` |
| Claude Code | `claude` CLI in PATH | `.claude/mcp.json` |
| Antigravity | `.antigravity/` dir exists | `.antigravity/mcp.json` |
| Qoder | `.qoder/` dir exists | `.qoder/mcp.json` |

### Week 2: Server Installation Engine & Registry

**Step 1.4 — Server Registry**

The registry is the single source of truth for all MCP servers KW-OS manages.

- [ ] Create `registry/servers.json` with all server metadata
- [ ] Support three server types: `npm` (install via npx/npm), `python` (clone + pip), `cli` (binary install)
- [ ] Pin every server to a tested version/ref
- [ ] Include install verification command for each server

**Registry Format:**
```json
{
  "servers": {
    "playwright": {
      "id": "playwright",
      "category": "browser",
      "type": "npm",
      "package": "@playwright/mcp",
      "version": "latest",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "apiRequired": false,
      "description": "MCP-native browser automation (35+ tools)"
    },
    "agent-browser": {
      "id": "agent-browser",
      "category": "browser",
      "type": "cli",
      "package": "agent-browser",
      "installCmd": "npm install -g agent-browser",
      "postInstall": "agent-browser install",
      "apiRequired": false,
      "description": "Fast Rust CLI browser automation for AI agents"
    },
    "powerpoint": {
      "id": "powerpoint",
      "category": "office",
      "type": "python",
      "repo": "dmytro-ustynov/office-powerpoint-mcp-server",
      "ref": "main",
      "apiRequired": false,
      "description": "Create/edit PowerPoint .pptx files locally"
    }
  }
}
```

**Step 1.5 — Server Installer Engine**

- [ ] Implement `npm`-type server installation (npx / npm install -g)
- [ ] Implement `python`-type installation (git clone → venv → pip install)
- [ ] Implement `cli`-type installation (npm install -g + post-install)
- [ ] Create `~/.kw-os/servers/` directory with per-category subdirs
- [ ] Implement parallel installation for independent servers
- [ ] Add retry logic with exponential backoff
- [ ] Create rollback on failure

**Step 1.6 — IDE Config Generator**

- [ ] Generate `mcp.json` for each supported IDE
- [ ] Merge with existing `mcp.json` if present (don't overwrite user servers)
- [ ] Handle platform-specific paths (Windows vs macOS vs Linux)
- [ ] No API keys in any generated config

**Step 1.7 — Health Check System**

- [ ] Test each installed server can start (spawn process, check for MCP handshake)
- [ ] Validate all required dependencies for each server
- [ ] Generate formatted status table
- [ ] Provide actionable fix suggestions for failures

---

## Phase 2: MCP Server Integration (Weeks 3–4)

### Week 3: Core, Browser, and Office Servers

**Step 2.1 — Core MCP Servers**

Integrate the official MCP reference servers. These form the foundation.

- [ ] `filesystem` — Secure file operations scoped to project directory
- [ ] `git` — Repository status, diff, log, blame
- [ ] `memory` — Knowledge graph for persistent agent memory
- [ ] `fetch` — Web content fetching converted to Markdown
- [ ] `sequentialthinking` — Multi-step problem-solving chains
- [ ] `time` — Timezone awareness and date manipulation

**Config (all IDEs share this structure):**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "sequentialthinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequentialthinking"]
    }
  }
}
```

**Step 2.2 — Browser Automation Servers (CRITICAL — replaces all API dependencies)**

This is the key enabler for zero-API knowledge work. Two complementary tools:

- [ ] **Playwright MCP** (`@playwright/mcp`) — MCP-native, 35+ browser tools, persistent state
  - Used for: long-running web research, data scraping, form automation, screenshots, PDF export
  - Config: `{ "command": "npx", "args": ["@playwright/mcp@latest"] }`
- [ ] **Agent Browser** (`agent-browser`) — Rust CLI, token-efficient, snapshot-ref workflow
  - Used for: quick web tasks, site monitoring, data extraction
  - Install globally: `npm install -g agent-browser && agent-browser install`
  - Bundle SKILL.md from `vercel-labs/agent-browser` into workspace skills

**Browser Automation SKILL.md (to be bundled):**
```markdown
## Browser Automation

Use `agent-browser` for web automation tasks. Core workflow:
1. `agent-browser open <url>` — Navigate to page
2. `agent-browser snapshot -i` — Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` — Interact using refs
4. Re-snapshot after page changes

For long-running or stateful browser tasks, use the `playwright` MCP server tools:
- browser_navigate, browser_click, browser_fill, browser_snapshot
- browser_screenshot, browser_pdf_save, browser_console_messages

No API keys are needed. Both tools use a local Chrome instance.
```

**Step 2.3 — Office Document Lifecycle Servers**

- [ ] **PowerPoint** — `dmytro-ustynov/office-powerpoint-mcp-server` (python-pptx)
  - Clone → venv → pip install
  - Verify: can create a test .pptx file
- [ ] **Excel** — `byjonemo/mcp-openpyxl` (openpyxl)
  - Clone → venv → pip install
  - Verify: can read/write .xlsx
- [ ] **Word** — `jlowans/mcp-python-docx` (python-docx)
  - Clone → venv → pip install
  - Verify: can create .docx
- [ ] **PDF Reader** — `SylphxAI/pdf-reader-mcp`
  - npm install
  - Verify: can extract text from sample PDF
- [ ] **MarkItDown** — `microsoft/markitdown`
  - pip install markitdown
  - Verify: can convert PDF/DOCX/XLSX → Markdown
- [ ] **Document Operations** — `alejandroballesteros/document-operations` (alt multi-format)
  - Evaluate and include if it covers gaps

### Week 4: Data, Finance, and Research Servers

**Step 2.4 — Data Analysis & Visualization**

- [ ] **Chart Generation** — `antvis/mcp-server-chart`
  - 26+ chart types: line, bar, pie, scatter, sankey, treemap, mind-map, flowchart, word cloud, etc.
  - npm install, no API keys
- [ ] **Data Exploration** — `reading-plus-ai/mcp-server-data-exploration`
  - Autonomous CSV analysis with intelligent insights
  - Python, clone + pip install
- [ ] **Vega-Lite** — `isaacwasserman/mcp-vegalite-server`
  - Alternative chart rendering
- [ ] **SQLite** — local SQL database for structured data storage
  - Use for: storing scraped data, financial records, research notes

**Step 2.5 — Financial & Accounting**

- [ ] **hledger-mcp** — `iiAtlas/hledger-mcp`
  - Double-entry bookkeeping, balance sheets, income statements
  - Download hledger binary for platform (Win/Mac/Linux)
- [ ] **Finance Analysis** — `aitrados/finance-trading-ai-agents-mcp`
  - Quantitative metrics, financial modeling
- [ ] **CoinCap** — `QuantGeekDev/coincap-mcp`
  - Real-time crypto data via public API (no auth required)

**Step 2.6 — Research & Knowledge**

- [ ] **Web Search** — `mrkrsl/web-search-mcp`
  - Local search using DuckDuckGo/Bing scraping
- [ ] **Read Website Fast** — `just-every/mcp-read-website-fast`
  - Token-efficient web → Markdown conversion
  - Mozilla Readability, smart caching, robots.txt support
- [ ] **Documentation Server** — `andrea9293/mcp-documentation-server`
  - Local PDF semantic search with Orama vector DB
- [ ] **JSON MCP** — `VadimNastoyashchy/json-mcp`
  - Split, merge, manipulate JSON files

**Step 2.7 — Utilities**

- [ ] **Image Editing** — `flowy11/imagician`
  - Resize, crop, format conversion (sharp-based)
- [ ] **Email** — `Shy2593666979/mcp-server-email` (optional, user provides SMTP creds)
- [ ] **CalDAV** — `dominik1001/caldav-mcp` (optional, user provides server URL)

---

## Phase 3: Skills, Rules & Prompt Templates (Weeks 5–6)

### Week 5: Master Rule & Skill Architecture

**Step 3.1 — Master Knowledge Worker Rule**

The "brain" of KW-OS. This rule is injected into every workspace and teaches the agent its full capabilities.

- [ ] Write master rule covering all tool categories
- [ ] Define workflow patterns for common knowledge tasks
- [ ] Include tool selection heuristics (when to use which server)
- [ ] Add output formatting standards
- [ ] Include error recovery patterns

**Master Rule Outline:**
```markdown
# KW-OS: Elite Knowledge Worker

## Identity
You are an Elite Knowledge Worker with access to local MCP tools.
You can perform both coding tasks AND professional knowledge work.
You NEVER require API keys — all your tools are local or use browser automation.

## Tool Inventory

### Browser Automation (for any online task)
- playwright MCP: 35+ browser tools — navigate, click, fill, screenshot, PDF
- agent-browser CLI: fast snapshot-ref workflow — open, snapshot, click/fill by ref

### Office Suite (full lifecycle of binary files)
- powerpoint: Create/edit .pptx — slides, charts, tables, layouts
- openpyxl: Full .xlsx manipulation — read, write, formulas, formatting
- python-docx: Create/edit .docx — reports, letters, documents
- pdf-reader: Extract text, images, metadata from .pdf
- markitdown: Convert any document (PDF/Office/HTML) to Markdown

### Data Analysis & Visualization
- chart-mcp: Generate 26+ chart types from data
- data-exploration: Autonomous CSV/dataset analysis
- sqlite: Local SQL database for structured queries

### Financial
- hledger: Double-entry bookkeeping, balance sheets, P&L
- finance-analysis: Quantitative metrics, modeling
- coincap: Real-time crypto market data (no auth)

### Research & Knowledge
- web-search: DuckDuckGo/Bing search
- read-website-fast: Web page → clean Markdown
- fetch: URL content fetching
- memory: Persistent knowledge graph

### Core System
- filesystem: Secure local file operations
- git: Repository management
- sequentialthinking: Multi-step reasoning
- time: Timezone and date operations

## Standard Workflows

### Research & Intelligence Gathering
1. Search with web-search-mcp or navigate with playwright
2. Fetch full pages with read-website-fast or agent-browser snapshot
3. Convert documents with markitdown
4. Store key findings in memory
5. Synthesize into structured report (Word or PowerPoint)

### Financial Report Creation
1. Query data: hledger for accounting, openpyxl for spreadsheets
2. Analyze: use sequentialthinking for multi-step analysis
3. Visualize: chart-mcp for graphs, openpyxl for tables
4. Report: powerpoint for slides, python-docx for written report

### Global Trend Monitoring (WorldMonitor-style, zero APIs)
1. Use playwright to navigate to news sites, financial portals, data dashboards
2. Extract data from tables, charts, feeds
3. Store in SQLite for historical tracking
4. Analyze trends with data-exploration and chart-mcp
5. Generate intelligence brief in PowerPoint or Word

### Browser-Automated Data Gathering
1. Open target URL with playwright browser_navigate
2. Take snapshot with browser_snapshot to get interactive refs
3. Click/fill/navigate as needed
4. Extract content from page
5. Repeat across multiple sources
6. Compile into local dataset (CSV/SQLite/Excel)

## Constraints
- NEVER ask user for API keys
- ALWAYS work with local files
- PREFER browser automation over API calls for online data
- Save work incrementally
- Cite sources when researching
```

**Step 3.2 — Skill Architecture**

Skills are modular `.md` files that teach the agent domain expertise.

- [ ] Define skill file format (YAML frontmatter + markdown body)
- [ ] Implement skill installation into workspace (`.cursor/skills/`, `.windsurf/skills/`, etc.)
- [ ] Create skill discovery system (agent can list and self-reference skills)
- [ ] Implement skill composition (combine multiple skills for complex tasks)

**Skill Format Standard:**
```markdown
---
id: skill-name
name: Human Readable Name
description: One-line description
category: knowledge-work | coding | automation
tools: [list, of, required, mcp, servers]
triggers: [keywords, that, activate, this, skill]
---

# Skill Name

## Expertise
[What this skill knows]

## Workflows
[Step-by-step patterns]

## Best Practices
[Domain-specific guidelines]

## Output Formats
[How to structure deliverables]
```

### Week 6: Professional Skills Library

**Step 3.3 — Core Knowledge Work Skills**

- [ ] `financial-analyst.md` — Balance sheets, income statements, ratio analysis, forecasting, hledger workflows
- [ ] `presentation-designer.md` — Slide structure, layout patterns, corporate themes, chart placement
- [ ] `research-synthesizer.md` — Multi-hop search, source triangulation, citation, evidence hierarchy
- [ ] `data-analyst.md` — CSV/Excel modeling, pivot tables, statistical analysis, chart selection
- [ ] `document-editor.md` — Professional report writing, formatting standards, review cycles

**Step 3.4 — Specialized Skills**

- [ ] `global-intelligence.md` — News monitoring, geopolitical signals, economic indicators, trend analysis
  - This skill replaces WorldMonitor's API dependencies with browser automation workflows
  - Includes target sites list: Reuters, Bloomberg (free), Yahoo Finance, trading economics, etc.
  - Teaches data extraction patterns for each site type
- [ ] `browser-automation.md` — Web scraping, form filling, site monitoring, data extraction patterns
  - Includes agent-browser SKILL.md content
  - Playwright MCP tool reference
  - Anti-detection best practices
- [ ] `business-strategist.md` — SWOT, Porter's Five Forces, competitive analysis, roadmaps, OKRs
- [ ] `project-manager.md` — Task tracking, timeline creation, Gantt charts, status reports

**Step 3.5 — Discoverable Prompt Templates**

Pre-built prompts the user can invoke for common knowledge tasks.

- [ ] `financial-report.md` — "Generate a monthly financial report from my ledger data"
- [ ] `market-research.md` — "Research the market for [X] and create a competitive landscape analysis"
- [ ] `competitive-analysis.md` — "Analyze competitors of [company] across [dimensions]"
- [ ] `trend-brief.md` — "Monitor and summarize current trends in [sector/region]"
- [ ] `slide-deck.md` — "Create a [N]-slide presentation about [topic] for [audience]"
- [ ] `data-dashboard.md` — "Build a visual dashboard from [data source]"
- [ ] `executive-summary.md` — "Synthesize [documents] into a 1-page executive brief"

---

## Phase 4: Testing & Polish (Weeks 7–8)

### Week 7: Testing

**Step 4.1 — Unit Tests**

- [ ] Set up Jest + ts-jest
- [ ] Test `env-check.ts` — mock `execSync` for all platforms
- [ ] Test `server-installer.ts` — mock git clone, npm install, pip install
- [ ] Test `config-generator.ts` — verify correct mcp.json for each IDE
- [ ] Test `health-check.ts` — mock server process spawning
- [ ] Test `server-registry.ts` — validate registry format

**Step 4.2 — Integration Tests**

- [ ] End-to-end: `kw-os init` on clean system
- [ ] End-to-end: `kw-os status` after install
- [ ] Verify Playwright MCP starts and responds
- [ ] Verify agent-browser installs Chrome for Testing
- [ ] Verify Office servers can create sample documents
- [ ] Test on Windows 11 (primary target per user environment)
- [ ] Test on macOS
- [ ] Test on Ubuntu 22.04

**Step 4.3 — Multi-IDE Testing**

| IDE | Test Scope |
|-----|------------|
| Cursor | Full init, config generation, skill injection, all servers |
| Windsurf | Full init, config generation, skill injection |
| VS Code | Config generation (+ Cline/Copilot MCP support) |
| Claude Code | `claude mcp add` commands |
| Antigravity | Config generation |

### Week 8: Documentation & Polish

**Step 4.4 — Documentation**

- [ ] README.md — Quick start, features, screenshots
- [ ] INSTALL.md — Detailed installation guide for each IDE
- [ ] SKILLS.md — Catalog of all bundled skills with examples
- [ ] SERVERS.md — Reference for all MCP servers included
- [ ] TROUBLESHOOTING.md — Common issues and fixes
- [ ] CONTRIBUTING.md — How to add new skills/servers

**Step 4.5 — Polish**

- [ ] Parallelize independent server installations
- [ ] Add progress bars with estimated time
- [ ] Implement download caching (`~/.kw-os/cache/`)
- [ ] Create `kw-os doctor` command for self-diagnosis
- [ ] Graceful degradation (if one server fails, others still work)
- [ ] Rollback support (undo last init)
- [ ] Beautiful CLI output with status tables

---

## Phase 5: Distribution & Launch (Week 9)

**Step 5.1 — npm Publishing**

- [ ] Finalize `package.json` (name, description, keywords, bin, files)
- [ ] Create `.npmignore` (exclude tests, docs, dev files)
- [ ] Test `npm pack` — verify package contents
- [ ] Test `npx kw-os init` from clean npx cache
- [ ] Publish to npm registry
- [ ] Verify global install: `npm install -g kw-os`

**Step 5.2 — GitHub Release**

- [ ] Create `kw-os` GitHub organization
- [ ] Push repository with full history
- [ ] Set up GitHub Actions CI (test on Win/Mac/Linux)
- [ ] Create release v1.0.0 with changelog
- [ ] Fork critical MCP server repos to `kw-os` org as safety mirrors
- [ ] Create issue templates (bug report, feature request, new skill)

**Step 5.3 — Community Launch**

- [ ] Write announcement blog post
- [ ] Create demo video showing full workflow (research → analysis → presentation)
- [ ] Post to: r/cursor, r/vscode, r/artificial, Hacker News
- [ ] Share on MCP community channels
- [ ] Create Discord/GitHub Discussions for community support

---

## Technical Specifications

### Dependencies

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.1",
    "inquirer": "^9.2.0",
    "fs-extra": "^11.2.0",
    "tar": "^6.2.0",
    "which": "^4.0.0",
    "semver": "^7.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/fs-extra": "^11.0.4",
    "@types/tar": "^6.1.0",
    "@types/which": "^3.0.0",
    "@types/semver": "^7.5.0",
    "typescript": "^5.4.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0"
  }
}
```

### IDE Configuration Mapping

| IDE | Config Directory | Config File | Notes |
|-----|-----------------|-------------|-------|
| Cursor | `.cursor/` | `mcp.json` | Also supports `.cursor/rules/` for skills |
| Windsurf | `.windsurf/` | `mcp.json` | Also supports `.windsurf/rules/` |
| VS Code | `.vscode/` | `mcp.json` | Works with Copilot Chat MCP |
| Claude Code | `.claude/` | `mcp.json` | Also `claude mcp add` CLI |
| Antigravity | project config | `mcp.json` | Standard MCP config |
| Qoder | project config | `mcp.json` | Standard MCP config |

### Complete MCP Server Tree

```
KW-OS Server Categories
│
├── core/ (Always Installed)
│   ├── filesystem     — @modelcontextprotocol/server-filesystem (npm)
│   ├── git           — @modelcontextprotocol/server-git (npm)
│   ├── memory        — @modelcontextprotocol/server-memory (npm)
│   ├── fetch         — @modelcontextprotocol/server-fetch (npm)
│   ├── sequentialthinking — @modelcontextprotocol/server-sequentialthinking (npm)
│   └── time          — @modelcontextprotocol/server-time (npm)
│
├── browser/ (Always Installed — enables zero-API online work)
│   ├── playwright    — @playwright/mcp (npm, zero-config)
│   └── agent-browser — agent-browser (npm global, Rust CLI)
│
├── office/ (Document Lifecycle)
│   ├── powerpoint    — dmytro-ustynov/office-powerpoint-mcp-server (python)
│   ├── excel         — byjonemo/mcp-openpyxl (python)
│   ├── word          — jlowans/mcp-python-docx (python)
│   ├── pdf-reader    — SylphxAI/pdf-reader-mcp (npm)
│   └── markitdown    — microsoft/markitdown (pip)
│
├── data/ (Analysis & Visualization)
│   ├── chart         — antvis/mcp-server-chart (npm, 26+ chart types)
│   ├── data-explore  — reading-plus-ai/mcp-server-data-exploration (python)
│   ├── vegalite      — isaacwasserman/mcp-vegalite-server (npm)
│   └── sqlite        — SQLite MCP server (python)
│
├── finance/ (Accounting & Markets)
│   ├── hledger       — iiAtlas/hledger-mcp (python + binary)
│   ├── finance       — aitrados/finance-trading-ai-agents-mcp (python)
│   └── coincap       — QuantGeekDev/coincap-mcp (npm, no auth)
│
├── research/ (Knowledge Gathering)
│   ├── web-search    — mrkrsl/web-search-mcp (npm)
│   ├── read-fast     — just-every/mcp-read-website-fast (npm)
│   ├── doc-server    — andrea9293/mcp-documentation-server (python)
│   └── json          — VadimNastoyashchy/json-mcp (npm)
│
└── utils/ (Optional)
    ├── imagician     — flowy11/imagician (npm, image editing)
    ├── email         — mcp-server-email (python, needs SMTP creds)
    └── caldav        — caldav-mcp (python, needs server URL)
```

---

## Success Criteria

- [ ] `npx kw-os init` completes in < 5 minutes on broadband
- [ ] Zero API keys required for any server
- [ ] All core + browser servers start successfully
- [ ] Can create .pptx, .xlsx, .docx files from agent commands
- [ ] Can extract text from .pdf files
- [ ] Can browse web, scrape data, fill forms via Playwright/agent-browser
- [ ] Can generate 10+ chart types from data
- [ ] Can track finances with hledger
- [ ] Works on Windows (primary), macOS, Linux
- [ ] Works with Cursor, Windsurf, VS Code, Claude Code, Antigravity
- [ ] 8+ professional skills bundled
- [ ] 5+ prompt templates included
- [ ] `kw-os status` shows clear health report
- [ ] Documentation covers all IDEs and all servers
- [ ] Test suite passes > 90%

---

## Post-v1.0 Roadmap

### v1.1 — Enhanced Intelligence
- [ ] WorldMonitor-style dashboard skill with scheduled scraping
- [ ] RSS feed monitoring via browser automation
- [ ] Automated daily briefing generation

### v1.2 — Enhanced Office
- [ ] PDF generation (not just reading)
- [ ] Advanced Excel: charts embedded in cells, conditional formatting
- [ ] PowerPoint template library (10+ themes)
- [ ] Document merge/diff capabilities

### v1.3 — Collaboration
- [ ] Git-synced team skills repository
- [ ] Shared knowledge base (memory server with file sync)
- [ ] Multi-user prompt template sharing
- [ ] Team workflow templates

### v1.4 — Advanced AI
- [ ] Local LLM integration (Ollama) for offline mode
- [ ] Multi-model routing (choose best model per task)
- [ ] Skill marketplace (community-contributed skills)
- [ ] Custom skill creation wizard

---

## Resource Requirements

**Development Machine:**
- Node.js 18+, Python 3.10+, Git
- 10GB disk space for testing all servers
- Chrome (for browser automation testing)

**End User (Runtime):**
- Node.js 18+, Python 3.10+
- ~3GB disk space (servers + Chrome for Testing)
- Internet for initial download only (works offline after install)

---

## Risk Mitigation

| Risk | Strategy |
|------|----------|
| Server repo goes offline | Fork to `kw-os` GitHub org; pin versions |
| MCP protocol breaking change | Abstract server layer; version detect |
| IDE config format changes | Auto-detect IDE version; multiple templates |
| Python dependency conflicts | Isolated venvs per Python server |
| Browser automation blocked | User-agent rotation; respect robots.txt; fallback to fetch |
| Windows path issues | Use `path.posix` normalization; test Windows first |
| Package too large | Lazy download on first use; modular categories |
| Chrome for Testing download fails | Detect existing Chrome/Brave/Edge; skip download |

---

## Conclusion

This plan delivers KW-OS in **5 phases over 9 weeks**, building from a solid CLI foundation through server integration, professional skills, testing, and distribution. The key differentiator is the **browser automation layer** (Playwright MCP + agent-browser) which eliminates all API dependencies while enabling full online research and data gathering capabilities.

**Start**: `npx kw-os init` → IDE becomes a full-spectrum Knowledge Worker
