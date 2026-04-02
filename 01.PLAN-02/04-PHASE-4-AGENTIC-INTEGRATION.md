# Phase 4: Agentic Workflow Integration

> Combine all Phase 1-3 components into a unified MCP server that exposes document intelligence tools to the IDE agent, plus workflow skills that teach the agent how to orchestrate multi-step knowledge work pipelines.

---

## Problem Statement

Phases 1-3 build the underlying engines (skill system, config system, document processing). But these engines need to be **exposed to the AI agent** running in the IDE. The agent interacts via MCP tools — so we need a kw-os MCP server that wraps the document processing pipeline and makes it available as callable tools.

Additionally, the agent needs **workflow skills** that teach it *when* and *how* to use these tools for real knowledge work tasks.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   IDE Agent (Cascade, Cursor, etc.)  │
│                                                      │
│  "Analyze this 500-page contract for risk clauses"   │
└───────────────────┬──────────────────────────────────┘
                    │ MCP Tool Calls
                    ▼
┌─────────────────────────────────────────────────────┐
│              kw-os Document Intelligence MCP Server   │
│                                                      │
│  Tools:                                              │
│  ├── ingest_document(path)                           │
│  ├── query_document(question, doc_id?)               │
│  ├── recursive_analyze(question, doc_id)             │
│  ├── get_document_summary(doc_id, detail_level)      │
│  ├── get_entities(doc_id?, type?)                    │
│  ├── get_relationships(entity_name)                  │
│  ├── search_documents(query, filters?)               │
│  ├── list_documents()                                │
│  └── get_document_stats(doc_id)                      │
│                                                      │
│  Backed by:                                          │
│  ├── Document Store (SQLite + sqlite-vec)            │
│  ├── Local Embedder (Ollama)                         │
│  ├── Knowledge Graph (SQLite)                        │
│  ├── RLM Engine (recursive analysis)                 │
│  └── RAG Query Engine (hybrid search)                │
└─────────────────────────────────────────────────────┘
```

---

## Step 4.1: kw-os Document Intelligence MCP Server

**New file: `src/document/mcp-server.ts`**

This is a standalone MCP server process that the IDE launches via the MCP config. It uses the `@modelcontextprotocol/sdk` to expose tools.

### Tool Definitions

#### `ingest_document`
```json
{
  "name": "ingest_document",
  "description": "Ingest a document into the kw-os knowledge base. Supports PDF, DOCX, XLSX, PPTX, MD, TXT, HTML, CSV, JSON. The document is chunked, embedded, and indexed for fast retrieval. Entities and relationships are extracted to build a knowledge graph.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Absolute path to the document file"
      },
      "title": {
        "type": "string",
        "description": "Optional title override (auto-detected from file if omitted)"
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Optional tags for categorization"
      }
    },
    "required": ["path"]
  }
}
```

**Returns**: Document ID, chunk count, entity count, processing time.

#### `query_document`
```json
{
  "name": "query_document",
  "description": "Ask a question about ingested documents. Uses hybrid search (semantic + keyword + knowledge graph) to find relevant information and generate an answer. If doc_id is provided, restricts search to that document. Otherwise searches across all ingested documents.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "question": {
        "type": "string",
        "description": "The question to answer"
      },
      "doc_id": {
        "type": "string",
        "description": "Optional: restrict to a specific document"
      },
      "top_k": {
        "type": "number",
        "description": "Number of chunks to retrieve (default: 10)"
      }
    },
    "required": ["question"]
  }
}
```

**Returns**: Answer, source chunks with relevance scores, related entities.

#### `recursive_analyze`
```json
{
  "name": "recursive_analyze",
  "description": "Deep analysis of a document using Recursive Language Model (RLM) technique. Use this for complex analytical questions that require understanding the ENTIRE document, not just retrieving specific sections. The RLM can peek, grep, partition, and recursively process the full document text. Best for: summarization, comparison, pattern finding, statistical analysis over the full document.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "question": {
        "type": "string",
        "description": "The analytical question"
      },
      "doc_id": {
        "type": "string",
        "description": "Document to analyze"
      },
      "model": {
        "type": "string",
        "description": "LLM to use (default: auto-detect available model)"
      }
    },
    "required": ["question", "doc_id"]
  }
}
```

**Returns**: Answer, analysis trajectory (steps taken), cost/time metrics.

#### `get_document_summary`
```json
{
  "name": "get_document_summary",
  "description": "Get a summary of an ingested document at the specified detail level.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": {
        "type": "string",
        "description": "Document ID"
      },
      "detail_level": {
        "type": "string",
        "enum": ["brief", "standard", "detailed"],
        "description": "brief = 1 paragraph, standard = section-by-section, detailed = comprehensive"
      }
    },
    "required": ["doc_id"]
  }
}
```

#### `get_entities`
```json
{
  "name": "get_entities",
  "description": "Get entities from the knowledge graph. Entities are people, organizations, locations, concepts, dates, monetary amounts, etc. extracted from ingested documents.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string", "description": "Filter to specific document" },
      "type": { "type": "string", "description": "Filter by entity type (person, org, location, concept, etc.)" },
      "limit": { "type": "number", "description": "Max results (default: 50)" }
    }
  }
}
```

#### `get_relationships`
```json
{
  "name": "get_relationships",
  "description": "Get relationships for an entity from the knowledge graph. Shows how entities are connected across documents.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "entity_name": { "type": "string", "description": "Entity to look up" },
      "hops": { "type": "number", "description": "Degrees of separation to traverse (default: 2)" }
    },
    "required": ["entity_name"]
  }
}
```

#### `search_documents`
```json
{
  "name": "search_documents",
  "description": "Search across all ingested documents. Returns matching chunks ranked by relevance.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" },
      "doc_ids": { "type": "array", "items": { "type": "string" }, "description": "Optional: limit to specific documents" },
      "type": { "type": "string", "enum": ["hybrid", "semantic", "keyword"], "description": "Search type (default: hybrid)" },
      "limit": { "type": "number", "description": "Max results (default: 10)" }
    },
    "required": ["query"]
  }
}
```

#### `list_documents`
```json
{
  "name": "list_documents",
  "description": "List all documents in the kw-os knowledge base.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

#### `get_document_stats`
```json
{
  "name": "get_document_stats",
  "description": "Get statistics about an ingested document: chunk count, entity count, relationship count, estimated tokens, sections.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" }
    },
    "required": ["doc_id"]
  }
}
```

---

### MCP Server Implementation

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DocumentStore } from './store.js';
import { LocalEmbedder } from './embedder.js';
import { RLMEngine } from './rlm-engine.js';
import { RAGQueryEngine } from './rag-query.js';

const server = new Server({
  name: 'kw-os-documents',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

const store = new DocumentStore();
const embedder = new LocalEmbedder();
const rlm = new RLMEngine({ /* config */ });
const rag = new RAGQueryEngine(store, embedder);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'ingest_document', description: '...', inputSchema: { ... } },
    { name: 'query_document', description: '...', inputSchema: { ... } },
    { name: 'recursive_analyze', description: '...', inputSchema: { ... } },
    // ... all tools
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'ingest_document':
      return handleIngest(request.params.arguments);
    case 'query_document':
      return handleQuery(request.params.arguments);
    case 'recursive_analyze':
      return handleRLMAnalysis(request.params.arguments);
    // ... all handlers
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### Step 4.2: Server Registration in kw-os

The document intelligence MCP server is registered in `registry/servers.json`:

```json
{
  "kw-os-documents": {
    "id": "kw-os-documents",
    "category": "core",
    "type": "npm",
    "package": "kw-os",
    "command": "node",
    "args": ["<kw-os-install-path>/dist/document/mcp-server.js"],
    "apiRequired": false,
    "description": "KW-OS Document Intelligence — ingest, query, and analyze documents of any size"
  }
}
```

The MCP config generated for each IDE will include:
```json
{
  "mcpServers": {
    "kw-os-documents": {
      "command": "node",
      "args": ["<resolved-path>/dist/document/mcp-server.js"],
      "env": {
        "KWOS_DB_PATH": "<path-to-documents.db>",
        "KWOS_OLLAMA_URL": "http://localhost:11434"
      }
    }
  }
}
```

---

## Step 4.3: Workflow Skills for Document Intelligence

New skills that teach the agent how to use the document intelligence tools:

### `document-analyst.md`
```markdown
---
id: document-analyst
name: Document Analyst
description: Analyze documents of any size using ingestion, RAG, and recursive analysis
category: knowledge-work
tools: [kw-os-documents, filesystem]
triggers: [analyze document, read PDF, review contract, study report, large document]
---

# Document Analyst

## When to Use
Use this skill when the user provides a document (PDF, DOCX, XLSX, etc.) for analysis,
especially when the document is large (>20 pages) or requires deep understanding.

## Workflow

### Step 1: Ingest the Document
Always ingest the document first using `ingest_document`:
- This creates searchable chunks, embeddings, and a knowledge graph
- Only needs to be done once per document; check `list_documents` first

### Step 2: Understand the Document
Get an overview before diving into details:
- Use `get_document_stats` to see size, structure, entity counts
- Use `get_document_summary` with detail_level "standard" for a section-by-section overview
- Use `get_entities` to see key people, organizations, concepts

### Step 3: Answer Questions
Choose the right tool based on the question type:

| Question Type | Tool | Example |
|---|---|---|
| Find specific information | `query_document` | "What is the termination clause?" |
| Broad analysis | `recursive_analyze` | "Summarize all financial risks" |
| Cross-document | `search_documents` | "Compare pricing across all proposals" |
| Relationship mapping | `get_relationships` | "Who are all parties related to Company X?" |

### Step 4: Present Findings
- Cite specific sections/pages from source chunks
- Include relevant entities and relationships
- Use charts/tables for structured data (via chart MCP)
- Save analysis to a report (via python-docx or powerpoint MCP)

## Best Practices
- Always ingest before querying — never try to read a 200-page PDF directly
- Use `query_document` for factual retrieval (faster, cheaper)
- Use `recursive_analyze` for analytical questions requiring full-document understanding
- For multi-document analysis, ingest all documents then use `search_documents`
- Check `list_documents` before ingesting to avoid duplicates
```

### `research-deep-dive.md`
```markdown
---
id: research-deep-dive
name: Research Deep Dive
description: Multi-document research synthesis using document intelligence
category: knowledge-work
tools: [kw-os-documents, web-search, read-fast, filesystem, memory]
triggers: [research, literature review, multi-source analysis, deep dive, synthesis]
---

# Research Deep Dive

## Expertise
Conduct comprehensive research by combining web sources with document analysis.
Can process research paper collections, reports, and large reference documents.

## Workflow

### Phase 1: Gather Sources
1. Search web for relevant sources using `web-search`
2. Download key documents (PDFs, reports) using browser automation
3. Collect all reference documents provided by user

### Phase 2: Build Knowledge Base
1. Ingest ALL gathered documents using `ingest_document`
2. Review entities across all documents: `get_entities`
3. Map relationships: `get_relationships` for key entities
4. Identify themes: `search_documents` with thematic queries

### Phase 3: Deep Analysis
1. For each key document, use `recursive_analyze` for comprehensive understanding
2. Cross-reference findings: `search_documents` across all docs
3. Identify contradictions, gaps, and consensus
4. Build timeline if temporal data exists

### Phase 4: Synthesis
1. Compile findings into structured report
2. Use `get_relationships` to create network diagrams of key connections
3. Generate charts for quantitative findings (via chart MCP)
4. Create final deliverable (Word doc, PowerPoint, or Markdown)

## Output Formats
- Executive summary (1-2 pages)
- Detailed research report (section per theme)
- Entity relationship map
- Source citation index
```

### `financial-deep-analysis.md`
```markdown
---
id: financial-deep-analysis
name: Financial Deep Analysis
description: Analyze financial documents at scale — annual reports, 10-K filings, earning calls
category: knowledge-work
tools: [kw-os-documents, hledger, excel, chart, filesystem]
triggers: [financial analysis, annual report, 10-K, earnings, financial statements]
---

# Financial Deep Analysis

## Expertise
Analyze financial documents that exceed context limits: annual reports (100+ pages),
10-K filings (200+ pages), multi-year financial data.

## Workflow

### Step 1: Ingest Financial Documents
- `ingest_document` for each financial document
- Multiple years can be ingested for trend analysis

### Step 2: Extract Key Financial Data
- `recursive_analyze`: "Extract all financial figures including revenue, net income, 
  EBITDA, total assets, total liabilities, and cash flow for all reported periods"
- `get_entities(type="money")`: Find all monetary amounts
- `query_document`: Targeted queries for specific line items

### Step 3: Build Financial Model
- Export extracted figures to Excel (via openpyxl MCP)
- Calculate ratios: current ratio, debt-to-equity, ROE, ROA, margins
- Create trend charts (via chart MCP)

### Step 4: Risk & Opportunity Analysis
- `recursive_analyze`: "What are the key risk factors and how have they changed?"
- `search_documents`: Compare risk factors across years/companies
- `get_relationships`: Map relationships between entities (subsidiaries, partners, regulators)

### Step 5: Generate Report
- Financial summary with key metrics table
- Trend charts for revenue, margins, growth
- Risk factor analysis
- Entity relationship diagram
- Save as PowerPoint or Word document
```

### `legal-review.md`
```markdown
---
id: legal-review
name: Legal Document Review
description: Analyze contracts, agreements, and legal filings of any length
category: knowledge-work
tools: [kw-os-documents, filesystem]
triggers: [contract review, legal analysis, agreement, clause, terms, compliance]
---

# Legal Document Review

## Expertise
Review legal documents of any length. Extract key terms, identify risk clauses,
compare against templates, and produce structured analysis.

## Workflow

### Step 1: Ingest and Overview
- `ingest_document` the legal document
- `get_document_summary(detail_level="detailed")` for full structure
- `get_entities(type="org")` to identify all parties

### Step 2: Clause Analysis
Use `recursive_analyze` for comprehensive clause extraction:
- "List all termination clauses with their conditions and notice periods"
- "Identify all indemnification and liability limitation provisions"
- "Extract all payment terms, milestones, and financial obligations"
- "Find all representations and warranties"

### Step 3: Risk Identification
- `recursive_analyze`: "Identify all clauses that may pose risk to [party name]"
- `query_document`: Targeted queries for specific risk areas
- `get_relationships`: Map obligations between parties

### Step 4: Deliverable
- Clause-by-clause summary table
- Risk assessment matrix (risk level + clause reference + recommendation)
- Key dates and deadlines extracted
- Party obligation map
```

---

## Step 4.4: Session Memory & Incremental Updates

### Persistent Knowledge Base
The SQLite database persists across IDE sessions. Documents ingested in one session are available in future sessions.

### Incremental Ingestion
```typescript
async ingestDocument(filePath: string, options?: IngestOptions): Promise<string> {
  // Check if document was already ingested
  const existing = this.store.findDocumentByPath(filePath);
  if (existing) {
    // Check if file has been modified since last ingestion
    const stat = fs.statSync(filePath);
    const lastModified = stat.mtime.toISOString();
    if (lastModified <= existing.ingested_at) {
      return existing.id; // Already up to date
    }
    // Re-ingest: delete old chunks/entities, process new version
    this.store.deleteDocument(existing.id);
  }
  // ... proceed with ingestion
}
```

### Cross-Session Entity Resolution
When the same entity appears in multiple documents ingested across different sessions, the knowledge graph deduplicates and links them:
- "Apple Inc." in Document A links to "Apple" in Document B
- Relationships from both documents are merged into a unified graph

---

## Step 4.5: Configuration & Setup

### Automatic Setup During `kw-os init`

During init, the document intelligence system is set up:
1. Create SQLite database at `~/.kw-os/documents.db`
2. Check for Ollama availability
3. If Ollama is available, pull embedding model (`nomic-embed-text`)
4. If Ollama is not available, log instructions and continue (BM25-only fallback)
5. Register `kw-os-documents` MCP server in all IDE configs
6. Install document analysis skills

### Fallback Modes

| Component | Available | Fallback |
|-----------|-----------|----------|
| Ollama + embedding model | Yes | Full hybrid search (vector + keyword + graph) |
| Ollama + embedding model | No | Keyword search (BM25) + knowledge graph only |
| Python REPL | Yes | Full RLM with code execution |
| Python REPL | No | Simplified RLM with text-only interaction |
| LLM API (OpenAI/Anthropic) | Yes | Full RLM + entity extraction |
| LLM API | No, but Ollama LLM available | Use local LLM for everything |
| No LLM available | N/A | Ingestion + keyword search only (no entity extraction, no RLM) |

The system gracefully degrades. Even without any LLM or embedding model, basic document ingestion and keyword search still work.

---

## Files Created / Modified

| File | Action | Description |
|------|--------|-------------|
| `src/document/mcp-server.ts` | **New** | MCP server exposing document intelligence tools |
| `skills/document-analyst.md` | **New** | Skill: general document analysis workflow |
| `skills/research-deep-dive.md` | **New** | Skill: multi-document research synthesis |
| `skills/financial-deep-analysis.md` | **New** | Skill: financial document analysis at scale |
| `skills/legal-review.md` | **New** | Skill: legal document review and risk analysis |
| `registry/servers.json` | Modified | Add kw-os-documents server entry |
| `src/core/config-generator.ts` | Modified | Include kw-os-documents in generated MCP configs |
| `src/commands/init.ts` | Modified | Set up SQLite DB, check Ollama, install document skills |
| `src/commands/status.ts` | Modified | Report document DB stats, Ollama status |

---

## Testing Checklist

- [ ] MCP server starts and responds to tool list request
- [ ] `ingest_document` processes a PDF and creates chunks + embeddings + entities
- [ ] `query_document` returns relevant answers with source citations
- [ ] `recursive_analyze` processes a 100+ page document without context overflow
- [ ] `get_entities` returns correctly typed entities
- [ ] `get_relationships` returns multi-hop connections
- [ ] `search_documents` works across multiple ingested documents
- [ ] `list_documents` shows all ingested documents with stats
- [ ] Incremental ingestion skips unchanged documents
- [ ] Cross-session persistence: documents survive IDE restart
- [ ] Graceful degradation without Ollama (BM25 only)
- [ ] Graceful degradation without LLM API (no entity extraction)
- [ ] MCP server appears in generated IDE configs
- [ ] Document analysis skills are installed and usable
- [ ] Works on Windows, macOS, Linux
- [ ] SQLite database handles 100+ documents without performance degradation
