# TRIAL-01 Analysis — Root Cause & Fix Plan

## ISSUE 1: MCP Server Failures — Root Cause Analysis

The failures fall into **3 categories**:

### Category A: Wrong npm Package Names (6 servers)

These packages **do not exist** on npm. The names in `servers.json` are incorrect.

| Server | Current (WRONG) | Correct Package | Correct Type |
|--------|-----------------|-----------------|--------------|
| git | `@modelcontextprotocol/server-git` | `mcp-server-git` | **Python/uvx** (PyPI) |
| sequential-thinking | `@modelcontextprotocol/server-sequentialthinking` | `@modelcontextprotocol/server-sequential-thinking` | npm (correct with hyphens) |
| time | `@modelcontextprotocol/server-time` | `mcp-server-time` | **Python/uvx** (PyPI) |
| pdf-reader | `pdf-reader-mcp` | `@sylphx/pdf-reader-mcp` | npm (scoped package) |
| vegalite | `mcp-vegalite-server` | N/A — Python/uv project | **Python/uv** (GitHub clone) |
| web-search | `web-search-mcp` | N/A — not published | **Remove or replace** |
| imagician | `imagician` | `@flowy11/imagician` | npm (scoped package) |

**Root cause**: Many official MCP servers from `modelcontextprotocol/servers` are **Python packages on PyPI**, not npm packages. The `servers.json` registry incorrectly assumed they were all npm.

### Category B: Python Servers — Silent Install Failures (6 servers)

| Server | Error | Root Cause |
|--------|-------|------------|
| data-exploration | `No module named data_exploration` | `pip install -e .` failed silently; module name mismatch |
| excel | transport closed | Clone or pip install failed; no entry point found |
| hledger | `No module named hledger` | Same — pip install failed silently |
| markitdown | `No module named markitdown` | markitdown is a pip package (`markitdown`), not a git-clone project |
| powerpoint | `No module named powerpoint` | Module name doesn't match server id |
| word | `python executable not found in %PATH%` | venv Python path is wrong (missing `.exe` on Windows) |

**Root cause**: The Python install logic (`installPythonServer`) has multiple issues:
1. `pip install -e .` errors are swallowed silently (catch block does nothing)
2. Module name detection uses `server.id.replace(/-/g, '_')` which doesn't match actual Python module names
3. Windows path for Python in venv needs `.exe` suffix
4. Some repos (like `markitdown`) are pip-installable packages, not meant to be git-cloned

### Category C: fetch Server — Wrong Error Attribution

The `fetch` error message says "No module named data_exploration" — this is actually a **config generation bug** where the fetch server config got crossed with data-exploration's config. The actual `@modelcontextprotocol/server-fetch` npm package **does exist** and works.

---

## ISSUE 2: Skills Not Loading

Skills ARE being copied to the IDE skills directory during `kw-os init`, but the IDE may not auto-load them. The master rule (`KW-OS: Elite Knowledge Worker`) IS the primary rule — it references all available MCP tools. Individual skill files are in the skills directory but need the IDE to recognize them.

**Fix**: Verify skill installation paths match IDE expectations. For Windsurf, skills go in `.windsurf/skills/` and rules in `.windsurf/rules/`.

---

## Fix Plan: Local-First Architecture

### 1. Add `uvx` Server Type

Many official MCP servers are Python packages best run via `uvx` (uv tool runner). This is:
- **More reliable** than git clone + venv + pip install
- **Official recommended approach** from modelcontextprotocol
- **Single command** — no venv management needed

Config example:
```json
{
  "command": "uvx",
  "args": ["mcp-server-git"]
}
```

### 2. Fix npm Package Names

Update all npm servers to use verified, correct package names.

### 3. Replace Unreliable Servers

| Remove | Replace With | Reason |
|--------|-------------|--------|
| `web-search-mcp` (404) | `@anthropic-ai/duckduckgo-mcp-server` or `ddg-mcp` | Reliable, no API key |
| `mcp-vegalite-server` (404) | Keep `@antv/mcp-server-chart` only | Already have chart server |
| `pdf-reader-mcp` (404) | `@sylphx/pdf-reader-mcp` | Verified on npm |
| `imagician` (wrong name) | `@flowy11/imagician` | Correct scoped name |

### 4. Fix Python Server Installation

- Use `uvx` for official servers (git, time, fetch)
- For GitHub-cloned servers, improve entry point detection
- Don't swallow pip install errors
- Fix Windows `.exe` path issue

### 5. Revised Server Registry

**Verified working servers (local, no API keys):**

| Server | Type | Package/Source | Status |
|--------|------|---------------|--------|
| filesystem | npm | `@modelcontextprotocol/server-filesystem` | ✅ Verified |
| memory | npm | `@modelcontextprotocol/server-memory` | ✅ Verified |
| sequential-thinking | npm | `@modelcontextprotocol/server-sequential-thinking` | ✅ Verified |
| fetch | uvx | `mcp-server-fetch` | ✅ Official PyPI |
| git | uvx | `mcp-server-git` | ✅ Official PyPI |
| time | uvx | `mcp-server-time` | ✅ Official PyPI |
| playwright | npm | `@playwright/mcp` | ✅ Verified |
| chart | npm | `@antv/mcp-server-chart` | ✅ Verified |
| coincap | npm | `coincap-mcp` | ✅ Verified |
| read-website-fast | npm | `@just-every/mcp-read-website-fast` | ✅ Verified |
| json | npm | `json-mcp` | ✅ Verified |
| pdf-reader | npm | `@sylphx/pdf-reader-mcp` | ✅ Verified |
| imagician | npm | `@flowy11/imagician` | ✅ Verified |
| markitdown | uvx | `markitdown` | ✅ Official PyPI (Microsoft) |
| powerpoint | python | `GongRzhe/Office-PowerPoint-MCP-Server` | Needs fix |
| excel | python | `haris-musa/excel-mcp-server` | Needs fix |
| word | python | `Rookie0x80/docx-mcp` | Needs fix |

---

## Anthropic Skills to Add

The Anthropic team has published official document creation skills:

| Skill | Source | Description |
|-------|--------|-------------|
| docx | `anthropics/skills/skills/docx` | Create/edit Word documents with tracked changes, comments, formatting |
| pdf | `anthropics/skills/skills/pdf` | PDF manipulation toolkit |
| pptx | `anthropics/skills/skills/pptx` | PowerPoint creation and editing |
| xlsx | `anthropics/skills/skills/xlsx` | Excel spreadsheet operations |

Each skill has a `SKILL.md` and a `scripts/` folder. These are **skill files** (markdown instructions + helper scripts), not MCP servers. They can be added to kw-os's built-in skill library.

Additional valuable skills from the Anthropic repo:
- `mcp-builder` — Build MCP servers
- `skill-creator` — Create new skills
- `web-artifacts-builder` — Build web artifacts
- `webapp-testing` — Test web applications
