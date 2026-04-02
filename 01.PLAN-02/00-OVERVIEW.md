# KW-OS v2.0 — Extension Plan Overview

> This document summarizes how KW-OS will be extended across four development phases, and what it will be capable of once the extension is completed.

---

## Current State (v1.0)

KW-OS currently:
- Installs and configures MCP servers for knowledge work via `kw-os init`
- Copies bundled skill `.md` files into IDE workspace directories
- Generates `mcp.json` config targeting a single IDE
- `add-skill` command only works with **built-in skills** bundled in the kw-os npm package
- MCP config is written to a single hardcoded filename (`mcp.json`) per IDE — but **Windsurf actually uses `mcp_config.json`** at `~/.codeium/windsurf/mcp_config.json`, not `.windsurf/mcp.json`
- No capability to process documents larger than the AI model's context window

---

## Extension Summary

### Phase 1: Skill System Overhaul
**Auto-load all built-in skills + install external skills from URLs/GitHub**

What changes:
- All built-in skills are automatically installed during `kw-os init` (no longer gated by filter)
- `kw-os add-skill` becomes a universal skill installer that accepts:
  - Built-in skill names (e.g., `financial-analyst`)
  - GitHub repo URLs (e.g., `https://github.com/user/repo`)
  - GitHub shorthand (e.g., `user/repo`)
  - Raw URLs to `.md` skill files
  - Local file paths
- Skills from external sources are fetched, validated, and installed into the IDE workspace
- A skill manifest tracks installed skills, their sources, and versions

**New capabilities:**
- Community skill sharing via GitHub repositories
- Skill discovery from any public source
- Skill versioning and update tracking

---

### Phase 2: Robust Cross-IDE MCP Configuration
**Write MCP config to the correct location for every MCP client, adapting to changes**

The problem: Each IDE uses a **different config file name and location**:

| IDE / Client | Config File | Location |
|---|---|---|
| **Cursor** | `mcp.json` | `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global) |
| **Windsurf** | `mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` (global) |
| **VS Code** | `mcp.json` | `.vscode/mcp.json` (project) or user settings |
| **Claude Code** | `.mcp.json` | Project root `.mcp.json` (project) or `~/.claude.json` (local/user) |
| **Claude Desktop** | `claude_desktop_config.json` | `%APPDATA%/Claude/` (Win) or `~/Library/Application Support/Claude/` (Mac) |
| **Antigravity** | `mcp.json` | `.antigravity/mcp.json` |
| **Qoder** | `mcp.json` | `.qoder/mcp.json` |
| **JetBrains** | `mcp.json` | Various locations depending on IDE version |

What changes:
- Replace hardcoded `mcp.json` with a **config profile system** that maps each IDE to its correct file(s)
- Auto-detect **all** MCP clients present in the workspace and write to **all** of them
- Support both project-scoped and global/user-scoped config locations
- Config profile definitions stored in a separate data file that can be updated independently
- Runtime detection: probe filesystem for known IDE config directories to determine which clients are present
- Merge strategy: never overwrite user's existing MCP servers, only add/update kw-os managed ones
- Future-proofing: config profiles are data-driven, so adding a new IDE is just adding a JSON entry

**New capabilities:**
- Install once, works everywhere — MCP servers configured for ALL detected IDE clients
- No more mismatch between detected IDE and actual config file location
- Easy to add new IDE support without code changes

---

### Phase 3: Unbounded Document Processing (RLM + RAG)
**Process documents of any size — 200 pages, 1000 pages, or more**

The problem: Knowledge work frequently requires analysis of massive documents (contracts, research papers, financial reports, regulatory filings) that vastly exceed any AI model's context window (typically 128k-200k tokens, ~50-80 pages).

The solution combines three complementary approaches:

#### 3A. Recursive Language Model (RLM) Integration
Based on research by Zhang & Khattab (MIT, 2025):
- Context is stored as a **variable**, not in the prompt
- The LLM interacts with context through a **Python REPL environment**
- The LLM can **peek**, **grep**, **partition**, and **recursively sub-query** the context
- A root LLM spawns recursive LLM calls for intermediate computation
- **No context rot**: the root LLM's window stays small regardless of document size
- RLM(GPT-5-mini) outperforms GPT-5 by >33% on long-context benchmarks while costing the same

Key strategies that emerge:
1. **Peeking** — Sample first N characters to understand structure
2. **Grepping** — Regex search to narrow relevant sections
3. **Partition + Map** — Chunk context, run parallel recursive LLM calls
4. **Summarization** — Hierarchical summarization of subsections
5. **Programmatic processing** — Use code to process structured data

#### 3B. Local RAG Pipeline with SQLite + Embeddings
For persistent document knowledge that can be queried across sessions:
- **SQLite + sqlite-vec** for local vector storage (no external DB needed)
- **Local embedding models** via Ollama or llama.cpp (e.g., nomic-embed-text, all-MiniLM)
- **Document chunking** with overlap for coherent retrieval
- **Hybrid search**: vector similarity + BM25 keyword matching
- PDF/DOCX/XLSX → Markdown conversion via existing MarkItDown MCP server

#### 3C. Knowledge Graph Construction
Using LightRAG-inspired approach:
- Extract **entities** and **relationships** from documents during ingestion
- Build a lightweight **knowledge graph** stored in SQLite
- Enable **graph-aware retrieval**: follow relationships to find connected information
- Support **multi-hop queries** that span multiple documents
- Combine graph traversal with vector search for best-of-both-worlds retrieval

**New capabilities:**
- Ingest and analyze documents of unlimited size (100+ pages, millions of tokens)
- Persistent document memory across sessions via SQLite
- Multi-document cross-referencing and relationship discovery
- Fully local — no API keys, no cloud services for storage/embedding
- Works with any LLM provider (OpenAI, Anthropic, Ollama, llama.cpp)

---

### Phase 4: Agentic Workflow Integration
**Combine all components into intelligent, multi-step knowledge work pipelines**

What changes:
- **Document Ingestion MCP Server**: A new kw-os MCP server that exposes tools for:
  - `ingest_document(path)` — Parse, chunk, embed, build knowledge graph
  - `query_document(question, doc_id)` — RAG query over specific document
  - `query_all(question)` — Cross-document search
  - `recursive_analyze(question, doc_id)` — RLM-style deep analysis
  - `get_entities(doc_id)` — Knowledge graph entities
  - `get_relationships(entity)` — Knowledge graph connections
  - `summarize_document(doc_id, detail_level)` — Hierarchical summary

- **Agentic workflow patterns** added to skills:
  - Research Analyst: Ingest multiple PDFs → cross-reference → synthesize
  - Financial Analyst: Ingest financial statements → extract KPIs → compare periods
  - Legal Review: Ingest contract → flag clauses → compare to template
  - Due Diligence: Ingest multiple docs → build entity graph → identify risks

- **Session memory**: Knowledge graph persists across conversations
- **Incremental updates**: New documents extend existing knowledge graph

**New capabilities after all phases are complete:**

1. **Universal skill installation** from any source (built-in, GitHub, URL)
2. **Works on every MCP client** without manual config fixes
3. **Analyze documents of any size** — 10 pages or 10,000 pages
4. **Persistent knowledge** — documents ingested once, queryable forever
5. **Cross-document intelligence** — find connections across a library of documents
6. **Fully local** — SQLite, local embeddings, no cloud dependencies
7. **Agentic pipelines** — multi-step analysis workflows that combine all capabilities

---

## Development Phases & Timeline

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **Phase 1** | Skill System Overhaul | Auto-load skills, external skill installer |
| **Phase 2** | Cross-IDE MCP Config | Config profiles, multi-IDE write, auto-detection |
| **Phase 3** | Document Processing | RLM integration, RAG pipeline, knowledge graph |
| **Phase 4** | Agentic Integration | Document MCP server, workflow skills, session memory |

---

## Architecture After Extension

```
kw-os/
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   ├── init.ts              # Now auto-loads all skills + writes multi-IDE config
│   │   ├── add-skill.ts         # Now supports GitHub/URL/local sources
│   │   ├── status.ts
│   │   └── update.ts
│   ├── core/
│   │   ├── skill-installer.ts   # Extended: fetch from GitHub/URL
│   │   ├── skill-fetcher.ts     # NEW: download/clone external skills
│   │   ├── skill-validator.ts   # NEW: validate external skill format
│   │   ├── config-generator.ts  # Rewritten: multi-IDE config profiles
│   │   ├── config-profiles.ts   # NEW: IDE config profile definitions
│   │   ├── server-installer.ts
│   │   ├── server-registry.ts
│   │   └── env-check.ts
│   ├── document/                # NEW: Document processing engine
│   │   ├── ingestion.ts         # PDF/DOCX/XLSX → chunks
│   │   ├── chunker.ts           # Smart document chunking
│   │   ├── embedder.ts          # Local embedding via Ollama/llama.cpp
│   │   ├── store.ts             # SQLite + sqlite-vec storage
│   │   ├── knowledge-graph.ts   # Entity/relationship extraction
│   │   ├── rlm-engine.ts        # Recursive Language Model orchestrator
│   │   ├── rag-query.ts         # Hybrid RAG retrieval
│   │   └── mcp-server.ts        # MCP server exposing document tools
│   └── types/
│       └── index.ts
├── config-profiles/             # NEW: IDE config profile data
│   └── ide-profiles.json
├── registry/
│   └── servers.json
├── skills/                      # Built-in skills (auto-loaded)
├── prompts/
└── templates/
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| IDE config formats change | Data-driven config profiles; easy to update JSON |
| External skills contain malicious content | Validation + sandboxing; warn user before install |
| Embedding model quality varies | Default to well-tested models; allow user override |
| SQLite-vec not available on all platforms | Fallback to pure-JS vector math; sqlite-vec has good cross-platform support |
| RLM requires API calls | Support local models via Ollama; RLM works with any LLM |
| Large document processing is slow | Async processing; progress indicators; caching |
| GitHub rate limits on skill fetching | Cache downloaded skills; support offline mode |

---

## References

- **Recursive Language Models**: Zhang & Khattab, MIT 2025 — [Blog](https://alexzhang13.github.io/blog/2025/rlm/) | [arXiv](https://arxiv.org/abs/2512.24601)
- **recursive-llm implementation**: [github.com/ysz/recursive-llm](https://github.com/ysz/recursive-llm)
- **LightRAG**: EMNLP 2025 — [github.com/HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)
- **sqlite-vec**: Local vector search — [github.com/asg017/sqlite-vec](https://github.com/asg017/sqlite-vec)
- **Windsurf MCP docs**: [docs.windsurf.com/windsurf/cascade/mcp](https://docs.windsurf.com/windsurf/cascade/mcp)
- **Claude Code MCP docs**: [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)
- **VS Code MCP docs**: [code.visualstudio.com/docs/copilot/customization/mcp-servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
