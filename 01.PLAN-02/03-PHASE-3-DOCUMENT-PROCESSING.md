# Phase 3: Unbounded Document Processing

> Enable KW-OS to ingest, analyze, and query documents of any size — from 10 pages to 10,000 pages — using Recursive Language Models, local RAG with SQLite vector search, and knowledge graph construction.

---

## Problem Statement

Knowledge work frequently requires analysis of massive documents:
- 200-page contracts and legal filings
- 1000-page regulatory submissions
- Multi-volume financial reports
- Research paper collections (100+ papers)
- Historical data archives

Current AI models have context windows of 128k-200k tokens (~50-80 pages). Even with "long context" models, performance **degrades significantly** as context grows ("context rot"). Simply stuffing documents into the prompt is not viable for serious knowledge work.

---

## Research Summary

### Recursive Language Models (RLM)
**Source**: Zhang & Khattab, MIT 2025 — [Blog](https://alexzhang13.github.io/blog/2025/rlm/) | [Implementation](https://github.com/ysz/recursive-llm)

**Core Idea**: Instead of putting the entire document in the prompt, store it as a **variable** and let the LLM interact with it through a Python REPL environment.

**How it works**:
1. Context is stored as a Python variable in a REPL environment
2. Root LLM receives **only the query** + instructions (not the full context)
3. Root LLM can write Python code to explore the context:
   - `context[:1000]` — peek at beginning
   - `re.findall(r'pattern', context)` — regex search
   - `context[5000:10000]` — view specific sections
   - `recursive_llm("sub-query", context[chunk])` — spawn sub-LLM calls
4. Root LLM builds answer iteratively, then returns `FINAL(answer)`

**Key Results**:
- RLM(GPT-5-mini) **outperforms GPT-5** by >33% on long-context benchmarks
- Performance does **not degrade** at 10M+ tokens
- Cost is approximately the same as a single GPT-5 call
- Works with **any LLM provider** including local models via Ollama

**Emergent Strategies** the RLM discovers on its own:
- **Peeking**: Sample first N characters to understand structure
- **Grepping**: Regex to narrow search space
- **Partition + Map**: Chunk context → parallel recursive sub-queries → combine
- **Summarization**: Hierarchical summarization of subsections
- **Programmatic processing**: Write code to process structured data (tables, diffs, etc.)

**Architecture** of the reference implementation:
```
RLM
├── Core (async completion logic)
├── REPL Executor (safe code execution via RestrictedPython)
├── Prompt Builder (system prompts)
└── Parser (extract FINAL() answers)
```

### Local RAG with SQLite Vector Search
**Sources**: sqlite-vec, Ollama embeddings, LightRAG

For persistent document knowledge queryable across sessions:
- **sqlite-vec**: SQLite extension for vector similarity search. Fully local, no server needed, cross-platform.
- **Local embeddings**: Ollama runs models like `nomic-embed-text` or `all-MiniLM-L6-v2` locally. Alternatively, llama.cpp can serve embeddings.
- **Hybrid search**: Combine vector similarity (semantic) with BM25 (keyword) for best retrieval quality.

### Knowledge Graph (LightRAG-inspired)
**Source**: [LightRAG](https://github.com/HKUDS/LightRAG) (EMNLP 2025)

Instead of only indexing raw text chunks:
- During ingestion, extract **entities** (people, orgs, places, concepts) and **relationships** between them
- Store as a graph in SQLite (nodes + edges tables)
- Enable **graph-aware retrieval**: follow relationship edges to find connected information
- Supports **multi-hop queries** that span multiple documents
- Combines graph traversal with vector search

---

## Detailed Implementation Plan

### Step 3.1: Document Ingestion Pipeline

**New file: `src/document/ingestion.ts`**

The ingestion pipeline converts any supported document into indexed, searchable chunks:

```
Input Document (.pdf, .docx, .xlsx, .md, .txt, .html)
    │
    ▼
┌─────────────────┐
│ Format Detection │  ← Detect file type, choose parser
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Text Extraction  │  ← MarkItDown MCP, pdf-reader, or direct read
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Smart Chunking   │  ← Split into overlapping chunks preserving structure
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│ Parallel Processing          │
│  ├─ Embedding Generation     │  ← Local model via Ollama or llama.cpp
│  ├─ Entity Extraction        │  ← LLM extracts entities + relationships
│  └─ BM25 Index Update        │  ← Keyword index for hybrid search
└────────┬─────────────────────┘
         │
         ▼
┌─────────────────┐
│ SQLite Storage   │  ← Chunks, embeddings, entities, relationships
└─────────────────┘
```

**Supported input formats** (via existing MCP servers + native parsers):
- **PDF**: pdf-reader MCP server or MarkItDown
- **DOCX**: python-docx MCP server or MarkItDown
- **XLSX**: openpyxl MCP server or MarkItDown
- **PPTX**: powerpoint MCP server or MarkItDown
- **HTML**: Readability parsing or MarkItDown
- **Markdown**: Direct read
- **Plain text**: Direct read
- **CSV/JSON**: Direct read with structure detection

---

### Step 3.2: Smart Document Chunker

**New file: `src/document/chunker.ts`**

The chunker splits documents into overlapping segments while preserving semantic structure:

```typescript
export interface ChunkOptions {
  maxChunkSize: number;      // Default: 1000 tokens (~4000 chars)
  overlapSize: number;       // Default: 200 tokens (~800 chars)
  respectBoundaries: boolean; // Try to split at headers, paragraphs
}

export interface Chunk {
  id: string;                 // Unique chunk ID
  docId: string;              // Parent document ID
  index: number;              // Position in document
  text: string;               // Chunk content
  startOffset: number;        // Character offset in original doc
  endOffset: number;
  metadata: {
    section?: string;         // Heading/section name if detected
    page?: number;            // Page number if from PDF
    type?: string;            // 'text' | 'table' | 'code' | 'list'
  };
}

export function chunkDocument(
  text: string,
  options: ChunkOptions = defaultOptions
): Chunk[] {
  // 1. Detect document structure (headings, paragraphs, tables)
  // 2. Split at natural boundaries (prefer heading > paragraph > sentence > word)
  // 3. Ensure overlap between consecutive chunks
  // 4. Attach metadata (section name, position, type)
  // 5. Return ordered array of chunks
}
```

**Chunking strategy**:
1. First pass: identify structural boundaries (headings, page breaks, blank lines)
2. Split at highest-level boundary that keeps chunks under `maxChunkSize`
3. If a section is still too large, recursively split at lower-level boundaries
4. Add overlap from previous chunk's tail to current chunk's head
5. Tag each chunk with its section hierarchy (e.g., "Chapter 3 > Section 3.2 > Subsection 3.2.1")

---

### Step 3.3: Local Embedding Engine

**New file: `src/document/embedder.ts`**

Generate vector embeddings locally without any cloud API:

```typescript
export interface EmbedderConfig {
  provider: 'ollama' | 'llamacpp' | 'transformers';
  model: string;             // e.g., 'nomic-embed-text', 'all-MiniLM-L6-v2'
  dimensions: number;        // Vector dimensions (e.g., 768, 384)
  batchSize: number;         // Texts per batch (default: 32)
  baseUrl?: string;          // For ollama: http://localhost:11434
}

export class LocalEmbedder {
  private config: EmbedderConfig;

  constructor(config?: Partial<EmbedderConfig>) {
    this.config = {
      provider: 'ollama',
      model: 'nomic-embed-text',
      dimensions: 768,
      batchSize: 32,
      baseUrl: 'http://localhost:11434',
      ...config,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    switch (this.config.provider) {
      case 'ollama':
        return this.embedViaOllama(texts);
      case 'llamacpp':
        return this.embedViaLlamaCpp(texts);
      case 'transformers':
        return this.embedViaTransformers(texts);
    }
  }

  private async embedViaOllama(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      for (const text of batch) {
        const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.config.model, prompt: text }),
        });
        const data = await response.json();
        results.push(data.embedding);
      }
    }
    return results;
  }

  private async embedViaLlamaCpp(texts: string[]): Promise<number[][]> {
    // Call llama.cpp server's /embedding endpoint
    const results: number[][] = [];
    for (const text of texts) {
      const response = await fetch(`${this.config.baseUrl}/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await response.json();
      results.push(data.embedding);
    }
    return results;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (this.config.provider === 'ollama') {
        const resp = await fetch(`${this.config.baseUrl}/api/tags`);
        const data = await resp.json();
        return data.models?.some(m => m.name.includes(this.config.model));
      }
      return false;
    } catch {
      return false;
    }
  }

  async ensureModel(): Promise<void> {
    if (this.config.provider === 'ollama') {
      // Pull model if not present
      await fetch(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        body: JSON.stringify({ name: this.config.model }),
      });
    }
  }
}
```

**Recommended embedding models** (all run locally via Ollama):

| Model | Dimensions | Size | Quality | Speed |
|-------|-----------|------|---------|-------|
| `nomic-embed-text` | 768 | 274MB | Best overall | Medium |
| `all-minilm` | 384 | 46MB | Good, very fast | Fast |
| `mxbai-embed-large` | 1024 | 670MB | Highest quality | Slow |
| `snowflake-arctic-embed` | 1024 | 670MB | Excellent for retrieval | Slow |

Default: `nomic-embed-text` — best balance of quality, size, and speed.

---

### Step 3.4: SQLite + sqlite-vec Storage

**New file: `src/document/store.ts`**

All document data stored in a single SQLite database with vector search capabilities:

```typescript
export class DocumentStore {
  private db: Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(getKWOSDir(), 'documents.db');
    this.db = new Database(dbPath || defaultPath);
    this.initialize();
  }

  private initialize(): void {
    // Load sqlite-vec extension
    this.db.loadExtension('vec0');

    // Create tables
    this.db.exec(`
      -- Documents table
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT,
        filetype TEXT,
        title TEXT,
        total_chunks INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        ingested_at TEXT DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}'
      );

      -- Chunks table
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL REFERENCES documents(id),
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        start_offset INTEGER,
        end_offset INTEGER,
        section TEXT,
        page_number INTEGER,
        token_count INTEGER,
        metadata TEXT DEFAULT '{}',
        UNIQUE(doc_id, chunk_index)
      );

      -- Vector embeddings (sqlite-vec virtual table)
      CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding float[768]
      );

      -- BM25 full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        text,
        section,
        content='chunks',
        content_rowid='rowid'
      );

      -- Knowledge graph: entities
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,  -- person, org, location, concept, date, money, etc.
        description TEXT,
        doc_id TEXT REFERENCES documents(id),
        chunk_ids TEXT,  -- JSON array of chunk IDs where entity appears
        metadata TEXT DEFAULT '{}',
        UNIQUE(name, type, doc_id)
      );

      -- Knowledge graph: relationships
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_entity_id INTEGER REFERENCES entities(id),
        target_entity_id INTEGER REFERENCES entities(id),
        relationship TEXT NOT NULL,  -- e.g., 'works_for', 'located_in', 'mentions'
        weight REAL DEFAULT 1.0,
        doc_id TEXT REFERENCES documents(id),
        chunk_id TEXT,
        metadata TEXT DEFAULT '{}'
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
      CREATE INDEX IF NOT EXISTS idx_entities_doc ON entities(doc_id);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
    `);
  }

  // --- Document Operations ---

  async ingestDocument(filePath: string, options?: IngestOptions): Promise<string> {
    // 1. Extract text from document
    // 2. Chunk the text
    // 3. Generate embeddings for each chunk
    // 4. Extract entities and relationships
    // 5. Store everything in SQLite
    // 6. Return document ID
  }

  // --- Query Operations ---

  async vectorSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // 1. Embed the query
    // 2. Search chunk_embeddings for nearest neighbors
    // 3. Join with chunks table for full text
    // 4. Return ranked results
  }

  async keywordSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Use FTS5 BM25 ranking
  }

  async hybridSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Combine vector + keyword search with reciprocal rank fusion
    const vectorResults = await this.vectorSearch(query, options);
    const keywordResults = await this.keywordSearch(query, options);
    return reciprocalRankFusion(vectorResults, keywordResults);
  }

  // --- Knowledge Graph Operations ---

  async getEntities(docId?: string, type?: string): Promise<Entity[]> { ... }

  async getRelationships(entityId: number): Promise<Relationship[]> { ... }

  async graphSearch(query: string, hops: number = 2): Promise<GraphSearchResult> {
    // 1. Find entities matching query
    // 2. Traverse relationships up to N hops
    // 3. Collect connected entities and their chunks
    // 4. Return subgraph + associated text
  }
}
```

**SQLite + sqlite-vec advantages**:
- **Zero infrastructure**: Single file, no server process
- **Cross-platform**: Works on Windows, macOS, Linux
- **Fast**: Vector search over 1M vectors in <100ms
- **Portable**: Database file can be moved, backed up, shared
- **Concurrent**: Multiple processes can read simultaneously

---

### Step 3.5: Knowledge Graph Extraction

**New file: `src/document/knowledge-graph.ts`**

Extract entities and relationships from document chunks using the LLM:

```typescript
export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

export async function extractEntitiesFromChunk(
  chunkText: string,
  docContext: string,  // Brief doc summary for context
  llmClient: LLMClient
): Promise<EntityExtractionResult> {
  const prompt = `
Extract all named entities and their relationships from this text.
Document context: ${docContext}

Text:
${chunkText}

Return JSON:
{
  "entities": [
    {"name": "...", "type": "person|org|location|concept|date|money|product|event", "description": "brief description"}
  ],
  "relationships": [
    {"source": "entity name", "target": "entity name", "relationship": "verb phrase", "context": "brief context"}
  ]
}
`;

  const response = await llmClient.complete(prompt);
  return parseEntityExtractionResponse(response);
}

export async function mergeEntities(
  existing: Entity[],
  extracted: ExtractedEntity[]
): Promise<Entity[]> {
  // Deduplicate entities by name similarity
  // Merge descriptions
  // Track all chunk references
}
```

**Entity deduplication** is important because the same entity may appear in different forms:
- "John Smith" vs "J. Smith" vs "Mr. Smith"
- "United States" vs "US" vs "USA" vs "the United States of America"

Strategy: Normalize names, use fuzzy matching with a threshold, let the LLM resolve ambiguous cases.

---

### Step 3.6: RLM Engine

**New file: `src/document/rlm-engine.ts`**

Implements the Recursive Language Model pattern for deep document analysis:

```typescript
export interface RLMConfig {
  rootModel: string;        // e.g., 'gpt-5-mini', 'claude-sonnet-4', 'ollama/llama3.2'
  recursiveModel?: string;  // Defaults to rootModel. Can be smaller/cheaper.
  maxDepth: number;         // Default: 1 (root can call recursive, but recursive can't call recursive)
  maxIterations: number;    // Default: 20 (max REPL iterations before forcing answer)
  timeout: number;          // Default: 300000 (5 minutes)
  provider: 'openai' | 'anthropic' | 'ollama' | 'litellm';
}

export class RLMEngine {
  private config: RLMConfig;
  private repl: REPLExecutor;

  constructor(config: Partial<RLMConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.repl = new REPLExecutor();
  }

  async analyze(
    query: string,
    context: string,   // The full document text (can be millions of characters)
    options?: AnalyzeOptions
  ): Promise<RLMResult> {
    // 1. Store context as a variable in the REPL environment
    this.repl.setVariable('context', context);
    this.repl.setVariable('context_length', context.length.toString());

    // 2. Register the recursive_llm function in the REPL
    this.repl.registerFunction('recursive_llm', async (subQuery: string, subContext: string) => {
      return this.callRecursiveLLM(subQuery, subContext);
    });

    // 3. Build the root prompt (query only — no context!)
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = `
Query: ${query}

The full context is stored in the variable 'context' (${context.length} characters, ~${Math.round(context.length / 4)} tokens).
You can interact with it through Python code in the REPL.
Available functions:
- context[:N] — peek at first N characters
- re.findall(pattern, context) — regex search
- context[start:end] — view a slice
- recursive_llm(sub_query, sub_context) — spawn a sub-LLM call
- len(context) — get total length

When you have the answer, output: FINAL(your_answer)
Or store it in a variable and output: FINAL_VAR(variable_name)
`;

    // 4. Run the REPL loop
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let iteration = 0;
    while (iteration < this.config.maxIterations) {
      const response = await this.callRootLLM(messages);

      // Check for FINAL answer
      const finalAnswer = this.parseFinalAnswer(response);
      if (finalAnswer) {
        return {
          answer: finalAnswer,
          iterations: iteration + 1,
          trajectory: messages,
        };
      }

      // Extract and execute code blocks
      const codeBlocks = this.extractCodeBlocks(response);
      for (const code of codeBlocks) {
        const result = await this.repl.execute(code);
        messages.push(
          { role: 'assistant', content: response },
          { role: 'user', content: `REPL Output:\n${result}` }
        );
      }

      iteration++;
    }

    // Max iterations reached — force final answer
    return {
      answer: 'Analysis incomplete: max iterations reached.',
      iterations: iteration,
      trajectory: messages,
    };
  }

  private async callRecursiveLLM(query: string, context: string): Promise<string> {
    const model = this.config.recursiveModel || this.config.rootModel;
    // Call with smaller/cheaper model
    // The recursive LLM gets the sub-context directly in its prompt
    // (since sub-contexts should be small enough to fit)
    const response = await this.callLLM(model, [
      { role: 'system', content: 'Answer the query based on the provided context.' },
      { role: 'user', content: `Context:\n${context}\n\nQuery: ${query}` },
    ]);
    return response;
  }
}
```

---

### Step 3.7: REPL Executor (Sandboxed)

**New file: `src/document/repl-executor.ts`**

Safe execution of Python code generated by the RLM:

```typescript
export class REPLExecutor {
  private variables: Map<string, string> = new Map();
  private functions: Map<string, Function> = new Map();
  private pythonProcess: ChildProcess | null = null;

  setVariable(name: string, value: string): void {
    this.variables.set(name, value);
  }

  registerFunction(name: string, fn: Function): void {
    this.functions.set(name, fn);
  }

  async execute(code: string): Promise<string> {
    // Option A: Use a sandboxed Python subprocess
    // Option B: Use a JavaScript-based interpreter for simple operations
    // Option C: Use RestrictedPython (like the reference implementation)

    // For kw-os, we use Option A with a persistent Python process:
    // 1. Start Python subprocess with pre-loaded variables
    // 2. Send code to execute
    // 3. Capture stdout/stderr
    // 4. Handle recursive_llm calls (intercepted via IPC)
    // 5. Return output

    // Safety: sandbox restricts filesystem access, network, imports
  }
}
```

**Safety considerations**:
- Sandbox restricts `os`, `subprocess`, `socket`, `requests` imports
- File system access limited to temp directory
- Network access blocked
- Execution timeout per cell (30 seconds default)
- Memory limit per execution

---

### Step 3.8: RAG Query Engine

**New file: `src/document/rag-query.ts`**

Combines all retrieval methods for optimal query answering:

```typescript
export class RAGQueryEngine {
  private store: DocumentStore;
  private embedder: LocalEmbedder;

  async query(
    question: string,
    options?: QueryOptions
  ): Promise<RAGResult> {
    // Step 1: Hybrid search (vector + keyword)
    const searchResults = await this.store.hybridSearch(question, {
      limit: options?.topK || 10,
      docId: options?.docId,  // Optional: limit to specific document
    });

    // Step 2: Graph-augmented retrieval
    const graphResults = await this.store.graphSearch(question, 2);

    // Step 3: Combine and deduplicate
    const allChunks = deduplicateAndRank([...searchResults, ...graphResults.chunks]);

    // Step 4: Build context from top chunks
    const context = allChunks
      .slice(0, options?.contextChunks || 5)
      .map(c => `[${c.section || 'Section ' + c.index}]\n${c.text}`)
      .join('\n\n---\n\n');

    // Step 5: Generate answer with LLM
    const answer = await this.generateAnswer(question, context, graphResults.entities);

    return {
      answer,
      sources: allChunks.slice(0, 5).map(c => ({
        docId: c.docId,
        chunkId: c.id,
        section: c.section,
        relevance: c.score,
      })),
      entities: graphResults.entities,
    };
  }
}
```

**Reciprocal Rank Fusion (RRF)** for combining search results:
```typescript
function reciprocalRankFusion(
  ...resultSets: SearchResult[][]
): SearchResult[] {
  const k = 60; // Standard RRF constant
  const scores = new Map<string, number>();

  for (const results of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const id = results[rank].id;
      const current = scores.get(id) || 0;
      scores.set(id, current + 1 / (k + rank + 1));
    }
  }

  // Sort by combined score
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...findResult(id), score }));
}
```

---

## Dependency Requirements

### Node.js Dependencies
```json
{
  "better-sqlite3": "^11.0.0",
  "sqlite-vec": "^0.1.0"
}
```

### Python Dependencies (for REPL executor)
```
RestrictedPython>=7.0
```

### Ollama (for local embeddings)
```bash
# User must have Ollama installed
# kw-os will auto-pull the embedding model
ollama pull nomic-embed-text
```

### Optional: sqlite-vec as npm package
If `sqlite-vec` npm bindings aren't available, fallback options:
1. Pure JavaScript cosine similarity (slower, no extension needed)
2. Python bridge to `sqlite-vec` (via existing Python venv infrastructure)
3. Pre-built binaries bundled with kw-os

---

## Files Created

| File | Description |
|------|-------------|
| `src/document/ingestion.ts` | Document ingestion pipeline orchestrator |
| `src/document/chunker.ts` | Smart document chunking with structure preservation |
| `src/document/embedder.ts` | Local embedding generation via Ollama/llama.cpp |
| `src/document/store.ts` | SQLite + sqlite-vec storage for chunks, embeddings, graph |
| `src/document/knowledge-graph.ts` | Entity/relationship extraction from chunks |
| `src/document/rlm-engine.ts` | Recursive Language Model orchestrator |
| `src/document/repl-executor.ts` | Sandboxed Python REPL for RLM code execution |
| `src/document/rag-query.ts` | Hybrid RAG query engine (vector + keyword + graph) |

---

## Performance Considerations

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Ingest 100-page PDF | 2-5 min | Dominated by embedding generation |
| Ingest 1000-page PDF | 15-30 min | Can be done in background |
| Vector search (1M chunks) | <100ms | sqlite-vec is very fast |
| Keyword search (FTS5) | <50ms | SQLite FTS5 is excellent |
| RLM analysis (single query) | 30s-5min | Depends on document complexity |
| Entity extraction (per chunk) | 1-3s | One LLM call per chunk |

**Optimization strategies**:
- Batch embedding generation (32 texts per batch)
- Async entity extraction (parallel LLM calls)
- Incremental ingestion (only process new/changed pages)
- Embedding cache (don't re-embed unchanged chunks)
- Pre-computed BM25 index

---

## Testing Checklist

- [ ] Ingest a 10-page PDF and query it successfully
- [ ] Ingest a 200-page PDF and query across all sections
- [ ] Ingest multiple documents and cross-reference between them
- [ ] Knowledge graph correctly extracts entities and relationships
- [ ] Hybrid search returns more relevant results than vector-only or keyword-only
- [ ] RLM engine processes 100k+ token documents without context overflow
- [ ] RLM engine works with Ollama local models
- [ ] RLM engine works with OpenAI/Anthropic API models
- [ ] REPL executor properly sandboxes code execution
- [ ] SQLite database handles concurrent reads
- [ ] Embedding model auto-pulls via Ollama if not present
- [ ] Graceful degradation if Ollama is not installed (skip embeddings, use BM25 only)
- [ ] Works on Windows (primary), macOS, Linux
