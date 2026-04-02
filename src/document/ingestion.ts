import fs from 'node:fs';
import path from 'node:path';
import type {
  DocumentFileType,
  IngestOptions,
  Chunk,
} from '../types/index.js';
import { log } from '../utils/logger.js';
import { chunkDocument } from './chunker.js';
import { LocalEmbedder } from './embedder.js';
import { DocumentStore } from './store.js';
import {
  buildEntityExtractionPrompt,
  parseExtractionResponse,
  storeExtraction,
} from './knowledge-graph.js';

/**
 * Callback for entity extraction — caller provides their own LLM.
 */
export type EntityExtractionFn = (prompt: string) => Promise<string>;

export interface IngestionResult {
  docId: string;
  filename: string;
  chunks: number;
  tokens: number;
  entities: number;
  relationships: number;
  embeddingsGenerated: boolean;
}

const SUPPORTED_EXTENSIONS: Record<string, DocumentFileType> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.pptx': 'pptx',
  '.html': 'html',
  '.htm': 'html',
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
  '.csv': 'csv',
  '.json': 'json',
};

/**
 * Detect file type from extension.
 */
export function detectFileType(filePath: string): DocumentFileType | null {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] || null;
}

/**
 * Extract text from a file based on its type.
 *
 * For simple formats (md, txt, csv, json, html), reads directly.
 * For complex formats (pdf, docx, xlsx, pptx), the caller should
 * pre-extract text using MCP servers (MarkItDown, pdf-reader, etc.)
 * and pass it to ingestText() instead.
 */
export function extractText(filePath: string, fileType: DocumentFileType): string {
  switch (fileType) {
    case 'md':
    case 'txt':
    case 'csv':
    case 'html':
      return fs.readFileSync(filePath, 'utf-8');

    case 'json': {
      const raw = fs.readFileSync(filePath, 'utf-8');
      try {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return raw;
      }
    }

    case 'pdf':
    case 'docx':
    case 'xlsx':
    case 'pptx':
      throw new Error(
        `Direct extraction of ${fileType} files is not supported. ` +
        `Use an MCP server (MarkItDown, pdf-reader) to extract text first, ` +
        `then call ingestText() with the extracted content.`
      );

    default:
      return fs.readFileSync(filePath, 'utf-8');
  }
}

/**
 * Full ingestion pipeline for a file on disk.
 *
 * 1. Detect file type
 * 2. Extract text
 * 3. Chunk the text
 * 4. Generate embeddings (if Ollama available)
 * 5. Extract entities (if LLM callback provided)
 * 6. Store everything in SQLite
 */
export async function ingestFile(
  filePath: string,
  store: DocumentStore,
  options?: IngestOptions & {
    embedder?: LocalEmbedder;
    entityExtractor?: EntityExtractionFn;
  }
): Promise<IngestionResult> {
  const filename = path.basename(filePath);
  const fileType = detectFileType(filePath);

  if (!fileType) {
    throw new Error(`Unsupported file type: ${path.extname(filePath)}`);
  }

  log.dim(`  Extracting text from ${filename}...`);
  const text = extractText(filePath, fileType);

  return ingestText(text, filename, fileType, store, {
    ...options,
    filepath: filePath,
  });
}

/**
 * Ingest pre-extracted text (e.g., from MCP server output).
 * Use this for PDF/DOCX/XLSX that have already been converted to text.
 */
export async function ingestText(
  text: string,
  filename: string,
  fileType: DocumentFileType,
  store: DocumentStore,
  options?: IngestOptions & {
    filepath?: string;
    embedder?: LocalEmbedder;
    entityExtractor?: EntityExtractionFn;
  }
): Promise<IngestionResult> {
  const opts = {
    generateEmbeddings: true,
    extractEntities: true,
    ...options,
  };

  // Step 1: Create document record
  const docId = store.addDocument(
    filename,
    fileType,
    opts.filepath,
    opts.title
  );

  log.dim(`  Document registered: ${docId.slice(0, 8)}...`);

  // Step 2: Chunk the text
  log.dim(`  Chunking ${text.length} characters...`);
  const chunks = chunkDocument(text, docId);

  // Step 3: Store chunks
  store.addChunks(chunks);
  const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0);
  store.updateDocumentStats(docId, chunks.length, totalTokens);

  log.dim(`  ${chunks.length} chunks stored (${totalTokens} est. tokens)`);

  // Step 4: Generate embeddings
  let embeddingsGenerated = false;
  if (opts.generateEmbeddings && opts.embedder) {
    try {
      const available = await opts.embedder.isAvailable();
      if (available) {
        log.dim(`  Generating embeddings (${opts.embedder.model})...`);
        embeddingsGenerated = await generateEmbeddings(chunks, opts.embedder, store);
      } else {
        log.dim('  Ollama not available — skipping embeddings (BM25 search still works)');
      }
    } catch (err) {
      log.warn(`  Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Step 5: Extract entities
  let totalEntities = 0;
  let totalRelationships = 0;
  if (opts.extractEntities && opts.entityExtractor) {
    log.dim('  Extracting entities and relationships...');
    const result = await extractEntitiesFromChunks(
      chunks,
      store,
      docId,
      opts.entityExtractor,
      opts.title || filename
    );
    totalEntities = result.entities;
    totalRelationships = result.relationships;
    log.dim(`  ${totalEntities} entities, ${totalRelationships} relationships extracted`);
  }

  return {
    docId,
    filename,
    chunks: chunks.length,
    tokens: totalTokens,
    entities: totalEntities,
    relationships: totalRelationships,
    embeddingsGenerated,
  };
}

/**
 * Generate and store embeddings for all chunks.
 */
async function generateEmbeddings(
  chunks: Chunk[],
  embedder: LocalEmbedder,
  store: DocumentStore
): Promise<boolean> {
  const texts = chunks.map(c => c.text);
  const embeddings = await embedder.embed(texts);

  const entries = chunks.map((chunk, i) => ({
    chunkId: chunk.id,
    embedding: embeddings[i],
  }));

  store.addEmbeddings(entries);
  return true;
}

/**
 * Extract entities from all chunks using the provided LLM callback.
 * Processes chunks sequentially to avoid overwhelming the LLM.
 */
async function extractEntitiesFromChunks(
  chunks: Chunk[],
  store: DocumentStore,
  docId: string,
  extractFn: EntityExtractionFn,
  docContext: string
): Promise<{ entities: number; relationships: number }> {
  let totalEntities = 0;
  let totalRelationships = 0;

  for (const chunk of chunks) {
    try {
      const prompt = buildEntityExtractionPrompt(chunk.text, docContext);
      const response = await extractFn(prompt);
      const extraction = parseExtractionResponse(response);

      if (extraction.entities.length > 0 || extraction.relationships.length > 0) {
        const result = storeExtraction(store, extraction, docId, chunk.id);
        totalEntities += result.entitiesStored;
        totalRelationships += result.relationshipsStored;
      }
    } catch {
      // Skip failed chunks — entity extraction is best-effort
    }
  }

  return { entities: totalEntities, relationships: totalRelationships };
}
