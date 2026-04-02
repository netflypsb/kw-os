#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { DocumentStore } from './store.js';
import { LocalEmbedder } from './embedder.js';
import { chunkDocument } from './chunker.js';
import { ingestFile, ingestText, detectFileType, extractText } from './ingestion.js';
import type { SearchOptions } from '../types/index.js';

// --- Configuration from environment ---
const DB_PATH = process.env.KWOS_DB_PATH || undefined;
const OLLAMA_URL = process.env.KWOS_OLLAMA_URL || 'http://localhost:11434';

// --- Shared instances ---
const store = new DocumentStore(DB_PATH);
const embedder = new LocalEmbedder({ baseUrl: OLLAMA_URL });

// --- Tool Definitions ---
const TOOLS = [
  {
    name: 'ingest_document',
    description:
      'Ingest a document into the kw-os knowledge base. Supports PDF, DOCX, XLSX, PPTX, MD, TXT, HTML, CSV, JSON. The document is chunked, embedded, and indexed for fast retrieval. Entities and relationships are extracted to build a knowledge graph.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the document file' },
        title: { type: 'string', description: 'Optional title override (auto-detected from file if omitted)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for categorization' },
      },
      required: ['path'],
    },
  },
  {
    name: 'query_document',
    description:
      'Ask a question about ingested documents. Uses hybrid search (semantic + keyword + knowledge graph) to find relevant information. If doc_id is provided, restricts search to that document. Otherwise searches across all ingested documents.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        question: { type: 'string', description: 'The question to answer' },
        doc_id: { type: 'string', description: 'Optional: restrict to a specific document' },
        top_k: { type: 'number', description: 'Number of chunks to retrieve (default: 10)' },
      },
      required: ['question'],
    },
  },
  {
    name: 'recursive_analyze',
    description:
      'Deep analysis of a document using Recursive Language Model (RLM) technique. Use this for complex analytical questions that require understanding the ENTIRE document, not just retrieving specific sections. The RLM can peek, grep, partition, and recursively process the full document text. Best for: summarization, comparison, pattern finding, statistical analysis over the full document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        question: { type: 'string', description: 'The analytical question' },
        doc_id: { type: 'string', description: 'Document to analyze' },
      },
      required: ['question', 'doc_id'],
    },
  },
  {
    name: 'get_document_summary',
    description: 'Get a summary of an ingested document at the specified detail level.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string', description: 'Document ID' },
        detail_level: {
          type: 'string',
          enum: ['brief', 'standard', 'detailed'],
          description: 'brief = 1 paragraph, standard = section-by-section, detailed = comprehensive',
        },
      },
      required: ['doc_id'],
    },
  },
  {
    name: 'get_entities',
    description:
      'Get entities from the knowledge graph. Entities are people, organizations, locations, concepts, dates, monetary amounts, etc. extracted from ingested documents.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string', description: 'Filter to specific document' },
        type: { type: 'string', description: 'Filter by entity type (person, org, location, concept, etc.)' },
        limit: { type: 'number', description: 'Max results (default: 50)' },
      },
    },
  },
  {
    name: 'get_relationships',
    description:
      'Get relationships for an entity from the knowledge graph. Shows how entities are connected across documents.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        entity_name: { type: 'string', description: 'Entity to look up' },
        hops: { type: 'number', description: 'Degrees of separation to traverse (default: 2)' },
      },
      required: ['entity_name'],
    },
  },
  {
    name: 'search_documents',
    description: 'Search across all ingested documents. Returns matching chunks ranked by relevance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        doc_ids: { type: 'array', items: { type: 'string' }, description: 'Optional: limit to specific documents' },
        type: {
          type: 'string',
          enum: ['hybrid', 'semantic', 'keyword'],
          description: 'Search type (default: hybrid)',
        },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_documents',
    description: 'List all documents in the kw-os knowledge base.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_document_stats',
    description:
      'Get statistics about an ingested document: chunk count, entity count, relationship count, estimated tokens, sections.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        doc_id: { type: 'string', description: 'Document ID' },
      },
      required: ['doc_id'],
    },
  },
];

// --- Tool Handlers ---

async function handleIngestDocument(args: Record<string, unknown>) {
  const filePath = String(args.path);
  const title = args.title ? String(args.title) : undefined;

  if (!fs.existsSync(filePath)) {
    return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
  }

  // Check for incremental ingestion
  const existing = store.findDocumentByPath(filePath);
  if (existing) {
    const stat = fs.statSync(filePath);
    const lastModified = stat.mtime.toISOString();
    if (lastModified <= existing.ingested_at) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'already_ingested',
            doc_id: existing.id,
            filename: existing.filename,
            chunks: existing.total_chunks,
            tokens: existing.total_tokens,
            message: 'Document already ingested and up to date. Use the existing doc_id for queries.',
          }, null, 2),
        }],
      };
    }
    // File changed — delete old version and re-ingest
    store.deleteDocument(existing.id);
  }

  const startTime = Date.now();

  try {
    const result = await ingestFile(filePath, store, {
      title,
      embedder,
      generateEmbeddings: true,
      extractEntities: false, // Entity extraction requires LLM — handled by the IDE agent
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'success',
          doc_id: result.docId,
          filename: result.filename,
          chunks: result.chunks,
          tokens: result.tokens,
          embeddings: result.embeddingsGenerated,
          processing_time: `${elapsed}s`,
        }, null, 2),
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Error ingesting document: ${msg}` }], isError: true };
  }
}

async function handleQueryDocument(args: Record<string, unknown>) {
  const question = String(args.question);
  const docId = args.doc_id ? String(args.doc_id) : undefined;
  const topK = typeof args.top_k === 'number' ? args.top_k : 10;

  const searchOpts: Partial<SearchOptions> = { limit: topK, docId };

  try {
    // Try hybrid search if embeddings available
    const embeddingAvailable = await embedder.isAvailable();

    let results;
    if (embeddingAvailable) {
      const queryEmbedding = await embedder.embedOne(question);
      results = store.hybridSearch(queryEmbedding, question, searchOpts);
    } else {
      results = store.keywordSearch(question, searchOpts);
    }

    // Build context from results
    const context = results.map(r => ({
      chunk_id: r.id,
      doc_id: r.doc_id,
      section: r.section,
      relevance: Math.round(r.score * 1000) / 1000,
      text: r.text,
    }));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          question,
          results_count: results.length,
          search_type: embeddingAvailable ? 'hybrid' : 'keyword',
          results: context,
        }, null, 2),
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Error querying: ${msg}` }], isError: true };
  }
}

async function handleRecursiveAnalyze(args: Record<string, unknown>) {
  const question = String(args.question);
  const docId = String(args.doc_id);

  const doc = store.getDocument(docId);
  if (!doc) {
    return { content: [{ type: 'text' as const, text: `Error: Document not found: ${docId}` }], isError: true };
  }

  // Retrieve all chunks and reconstruct the full document text
  const chunks = store.getChunks(docId);
  if (chunks.length === 0) {
    return { content: [{ type: 'text' as const, text: `Error: Document has no chunks.` }], isError: true };
  }

  const fullText = chunks.map(c => c.text).join('\n\n');

  // RLM requires an external LLM — return the context for the IDE agent to use
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        status: 'context_prepared',
        doc_id: docId,
        filename: doc.filename,
        question,
        total_characters: fullText.length,
        total_tokens_est: Math.round(fullText.length / 4),
        total_chunks: chunks.length,
        sections: [...new Set(chunks.map(c => c.section).filter(Boolean))],
        context_preview: fullText.slice(0, 2000) + (fullText.length > 2000 ? '\n\n... [truncated]' : ''),
        instruction: 'The full document is too large for a single prompt. Use the chunk results from query_document for targeted retrieval, or process sections iteratively.',
      }, null, 2),
    }],
  };
}

async function handleGetDocumentSummary(args: Record<string, unknown>) {
  const docId = String(args.doc_id);
  const detailLevel = (args.detail_level as string) || 'standard';

  const doc = store.getDocument(docId);
  if (!doc) {
    return { content: [{ type: 'text' as const, text: `Error: Document not found: ${docId}` }], isError: true };
  }

  const chunks = store.getChunks(docId);
  const sections = [...new Set(chunks.map(c => c.section).filter(Boolean))];
  const entities = store.getEntities(docId);

  let summary: Record<string, unknown>;

  switch (detailLevel) {
    case 'brief':
      summary = {
        doc_id: docId,
        filename: doc.filename,
        title: doc.title,
        chunks: doc.total_chunks,
        tokens: doc.total_tokens,
        sections: sections.length,
        entities: entities.length,
        ingested_at: doc.ingested_at,
      };
      break;

    case 'detailed':
      summary = {
        doc_id: docId,
        filename: doc.filename,
        title: doc.title,
        filetype: doc.filetype,
        chunks: doc.total_chunks,
        tokens: doc.total_tokens,
        ingested_at: doc.ingested_at,
        sections: sections.map(s => {
          const sectionChunks = chunks.filter(c => c.section === s);
          return {
            name: s,
            chunks: sectionChunks.length,
            preview: sectionChunks[0]?.text.slice(0, 200) + '...',
          };
        }),
        entities: entities.slice(0, 20).map(e => ({
          name: e.name,
          type: e.type,
          description: e.description,
        })),
        entity_types: [...new Set(entities.map(e => e.type))],
      };
      break;

    default: // standard
      summary = {
        doc_id: docId,
        filename: doc.filename,
        title: doc.title,
        chunks: doc.total_chunks,
        tokens: doc.total_tokens,
        ingested_at: doc.ingested_at,
        sections,
        entity_count: entities.length,
        entity_types: [...new Set(entities.map(e => e.type))],
      };
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
}

async function handleGetEntities(args: Record<string, unknown>) {
  const docId = args.doc_id ? String(args.doc_id) : undefined;
  const type = args.type ? String(args.type) : undefined;
  const limit = typeof args.limit === 'number' ? args.limit : 50;

  const entities = store.getEntities(docId, type).slice(0, limit);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        count: entities.length,
        entities: entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          description: e.description,
          doc_id: e.doc_id,
        })),
      }, null, 2),
    }],
  };
}

async function handleGetRelationships(args: Record<string, unknown>) {
  const entityName = String(args.entity_name);
  const hops = typeof args.hops === 'number' ? args.hops : 2;

  const graphResult = store.graphSearch(entityName, hops);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        entity: entityName,
        hops,
        entities: graphResult.entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          description: e.description,
        })),
        relationships: graphResult.relationships.map(r => ({
          source_id: r.source_entity_id,
          target_id: r.target_entity_id,
          relationship: r.relationship,
          weight: r.weight,
        })),
        related_chunks: graphResult.chunks.length,
      }, null, 2),
    }],
  };
}

async function handleSearchDocuments(args: Record<string, unknown>) {
  const query = String(args.query);
  const searchType = (args.type as string) || 'hybrid';
  const limit = typeof args.limit === 'number' ? args.limit : 10;

  try {
    let results;

    if (searchType === 'keyword') {
      results = store.keywordSearch(query, { limit });
    } else if (searchType === 'semantic') {
      const embeddingAvailable = await embedder.isAvailable();
      if (!embeddingAvailable) {
        return {
          content: [{ type: 'text' as const, text: 'Semantic search unavailable: Ollama not running. Use keyword search instead.' }],
          isError: true,
        };
      }
      const queryEmbedding = await embedder.embedOne(query);
      results = store.vectorSearch(queryEmbedding, { limit });
    } else {
      // hybrid
      const embeddingAvailable = await embedder.isAvailable();
      if (embeddingAvailable) {
        const queryEmbedding = await embedder.embedOne(query);
        results = store.hybridSearch(queryEmbedding, query, { limit });
      } else {
        results = store.keywordSearch(query, { limit });
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          query,
          search_type: searchType,
          results_count: results.length,
          results: results.map(r => ({
            chunk_id: r.id,
            doc_id: r.doc_id,
            section: r.section,
            relevance: Math.round(r.score * 1000) / 1000,
            text: r.text,
          })),
        }, null, 2),
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Search error: ${msg}` }], isError: true };
  }
}

async function handleListDocuments() {
  const docs = store.listDocuments();
  const stats = store.getStats();

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        total_documents: docs.length,
        total_chunks: stats.chunks,
        total_entities: stats.entities,
        total_relationships: stats.relationships,
        documents: docs.map(d => ({
          id: d.id,
          filename: d.filename,
          title: d.title,
          filetype: d.filetype,
          chunks: d.total_chunks,
          tokens: d.total_tokens,
          ingested_at: d.ingested_at,
        })),
      }, null, 2),
    }],
  };
}

async function handleGetDocumentStats(args: Record<string, unknown>) {
  const docId = String(args.doc_id);

  const doc = store.getDocument(docId);
  if (!doc) {
    return { content: [{ type: 'text' as const, text: `Error: Document not found: ${docId}` }], isError: true };
  }

  const chunks = store.getChunks(docId);
  const entities = store.getEntities(docId);
  const sections = [...new Set(chunks.map(c => c.section).filter(Boolean))];

  // Count relationships for entities in this document
  let relCount = 0;
  for (const entity of entities) {
    const rels = store.getRelationships(entity.id);
    relCount += rels.length;
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        doc_id: docId,
        filename: doc.filename,
        title: doc.title,
        filetype: doc.filetype,
        total_chunks: doc.total_chunks,
        total_tokens: doc.total_tokens,
        sections,
        section_count: sections.length,
        entity_count: entities.length,
        relationship_count: relCount,
        entity_types: [...new Set(entities.map(e => e.type))],
        ingested_at: doc.ingested_at,
        filepath: doc.filepath,
      }, null, 2),
    }],
  };
}

// --- MCP Server Setup ---

const server = new Server(
  { name: 'kw-os-documents', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args || {}) as Record<string, unknown>;

  switch (name) {
    case 'ingest_document':
      return handleIngestDocument(safeArgs);
    case 'query_document':
      return handleQueryDocument(safeArgs);
    case 'recursive_analyze':
      return handleRecursiveAnalyze(safeArgs);
    case 'get_document_summary':
      return handleGetDocumentSummary(safeArgs);
    case 'get_entities':
      return handleGetEntities(safeArgs);
    case 'get_relationships':
      return handleGetRelationships(safeArgs);
    case 'search_documents':
      return handleSearchDocuments(safeArgs);
    case 'list_documents':
      return handleListDocuments();
    case 'get_document_stats':
      return handleGetDocumentStats(safeArgs);
    default:
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('kw-os-documents MCP server failed to start:', err);
  process.exit(1);
});
