import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getKWOSDir } from '../utils/platform.js';
import { cosineSimilarity } from './embedder.js';
import type {
  DocumentRecord,
  Chunk,
  EntityRecord,
  RelationshipRecord,
  SearchResult,
  SearchOptions,
  GraphSearchResult,
  DocumentFileType,
} from '../types/index.js';

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  limit: 10,
};

export class DocumentStore {
  private db: Database.Database;
  private useVec: boolean = false;

  constructor(dbPath?: string) {
    const defaultPath = path.join(getKWOSDir(), 'documents.db');
    const resolvedPath = dbPath || defaultPath;

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    // Try to load sqlite-vec extension
    try {
      this.db.loadExtension('vec0');
      this.useVec = true;
    } catch {
      // sqlite-vec not available — will use JS fallback for vector search
      this.useVec = false;
    }

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
        doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
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

      -- Embeddings table (JS fallback — stores vectors as JSON blobs)
      CREATE TABLE IF NOT EXISTS chunk_embeddings (
        chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        dimensions INTEGER NOT NULL
      );

      -- BM25 full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        text,
        section,
        content='chunks',
        content_rowid='rowid'
      );

      -- FTS triggers to keep in sync
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, text, section)
        VALUES (NEW.rowid, NEW.text, NEW.section);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, text, section)
        VALUES ('delete', OLD.rowid, OLD.text, OLD.section);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, text, section)
        VALUES ('delete', OLD.rowid, OLD.text, OLD.section);
        INSERT INTO chunks_fts(rowid, text, section)
        VALUES (NEW.rowid, NEW.text, NEW.section);
      END;

      -- Knowledge graph: entities
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        doc_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
        chunk_ids TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        UNIQUE(name, type, doc_id)
      );

      -- Knowledge graph: relationships
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
        target_entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
        relationship TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        doc_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
        chunk_id TEXT,
        metadata TEXT DEFAULT '{}'
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
      CREATE INDEX IF NOT EXISTS idx_entities_doc ON entities(doc_id);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_doc ON relationships(doc_id);
    `);
  }

  // --- Document Operations ---

  addDocument(
    filename: string,
    filetype: DocumentFileType,
    filepath?: string,
    title?: string
  ): string {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO documents (id, filename, filepath, filetype, title)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, filename, filepath || null, filetype, title || null);
    return id;
  }

  getDocument(docId: string): DocumentRecord | null {
    return this.db.prepare('SELECT * FROM documents WHERE id = ?')
      .get(docId) as DocumentRecord | null;
  }

  listDocuments(): DocumentRecord[] {
    return this.db.prepare('SELECT * FROM documents ORDER BY ingested_at DESC')
      .all() as DocumentRecord[];
  }

  deleteDocument(docId: string): void {
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
  }

  updateDocumentStats(docId: string, totalChunks: number, totalTokens: number): void {
    this.db.prepare(`
      UPDATE documents SET total_chunks = ?, total_tokens = ? WHERE id = ?
    `).run(totalChunks, totalTokens, docId);
  }

  // --- Chunk Operations ---

  addChunks(chunks: Chunk[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO chunks
        (id, doc_id, chunk_index, text, start_offset, end_offset, section, page_number, token_count, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: Chunk[]) => {
      for (const c of items) {
        insert.run(
          c.id, c.doc_id, c.chunk_index, c.text,
          c.start_offset, c.end_offset, c.section,
          c.page_number, c.token_count, c.metadata
        );
      }
    });

    insertMany(chunks);
  }

  getChunks(docId: string): Chunk[] {
    return this.db.prepare(
      'SELECT * FROM chunks WHERE doc_id = ? ORDER BY chunk_index'
    ).all(docId) as Chunk[];
  }

  getChunkById(chunkId: string): Chunk | null {
    return this.db.prepare('SELECT * FROM chunks WHERE id = ?')
      .get(chunkId) as Chunk | null;
  }

  // --- Embedding Operations ---

  addEmbedding(chunkId: string, embedding: number[]): void {
    const buffer = Buffer.from(new Float32Array(embedding).buffer);
    this.db.prepare(`
      INSERT OR REPLACE INTO chunk_embeddings (chunk_id, embedding, dimensions)
      VALUES (?, ?, ?)
    `).run(chunkId, buffer, embedding.length);
  }

  addEmbeddings(entries: Array<{ chunkId: string; embedding: number[] }>): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO chunk_embeddings (chunk_id, embedding, dimensions)
      VALUES (?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: typeof entries) => {
      for (const e of items) {
        const buffer = Buffer.from(new Float32Array(e.embedding).buffer);
        insert.run(e.chunkId, buffer, e.embedding.length);
      }
    });

    insertMany(entries);
  }

  private getEmbedding(chunkId: string): number[] | null {
    const row = this.db.prepare(
      'SELECT embedding, dimensions FROM chunk_embeddings WHERE chunk_id = ?'
    ).get(chunkId) as { embedding: Buffer; dimensions: number } | undefined;

    if (!row) return null;
    return Array.from(new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.dimensions));
  }

  // --- Search Operations ---

  /**
   * Vector similarity search using cosine similarity (JS fallback).
   */
  vectorSearch(queryEmbedding: number[], options?: Partial<SearchOptions>): SearchResult[] {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

    // Get all embeddings (for JS fallback; sqlite-vec would do this in SQL)
    let query = 'SELECT chunk_id, embedding, dimensions FROM chunk_embeddings';
    const params: unknown[] = [];

    if (opts.docId) {
      query += ' WHERE chunk_id IN (SELECT id FROM chunks WHERE doc_id = ?)';
      params.push(opts.docId);
    }

    const rows = this.db.prepare(query).all(...params) as Array<{
      chunk_id: string;
      embedding: Buffer;
      dimensions: number;
    }>;

    // Compute similarities
    const scored: Array<{ chunkId: string; score: number }> = [];
    for (const row of rows) {
      const embedding = Array.from(
        new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.dimensions)
      );
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (!opts.minScore || score >= opts.minScore) {
        scored.push({ chunkId: row.chunk_id, score });
      }
    }

    // Sort by score descending and take top N
    scored.sort((a, b) => b.score - a.score);
    const topN = scored.slice(0, opts.limit);

    // Fetch chunk data for results
    const results: SearchResult[] = [];
    for (const s of topN) {
      const chunk = this.getChunkById(s.chunkId);
      if (chunk) {
        results.push({
          id: chunk.id,
          doc_id: chunk.doc_id,
          text: chunk.text,
          section: chunk.section,
          score: s.score,
          chunk_index: chunk.chunk_index,
        });
      }
    }

    return results;
  }

  /**
   * Full-text keyword search using FTS5 BM25 ranking.
   */
  keywordSearch(query: string, options?: Partial<SearchOptions>): SearchResult[] {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

    let sql = `
      SELECT c.id, c.doc_id, c.text, c.section, c.chunk_index,
             rank AS score
      FROM chunks_fts f
      JOIN chunks c ON c.rowid = f.rowid
      WHERE chunks_fts MATCH ?
    `;
    const params: unknown[] = [query];

    if (opts.docId) {
      sql += ' AND c.doc_id = ?';
      params.push(opts.docId);
    }

    sql += ' ORDER BY rank LIMIT ?';
    params.push(opts.limit);

    const rows = this.db.prepare(sql).all(...params) as SearchResult[];

    // Normalize FTS5 rank scores (they are negative; more negative = better)
    return rows.map(r => ({
      ...r,
      score: Math.abs(r.score),
    }));
  }

  /**
   * Hybrid search combining vector similarity and BM25 keyword search.
   * Uses Reciprocal Rank Fusion to merge results.
   */
  hybridSearch(
    queryEmbedding: number[],
    queryText: string,
    options?: Partial<SearchOptions>
  ): SearchResult[] {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

    // Run both searches with expanded limit for better fusion
    const expandedOpts = { ...opts, limit: opts.limit * 3 };
    const vectorResults = this.vectorSearch(queryEmbedding, expandedOpts);

    let keywordResults: SearchResult[] = [];
    try {
      keywordResults = this.keywordSearch(queryText, expandedOpts);
    } catch {
      // FTS query may fail on certain inputs; fallback to vector-only
    }

    return reciprocalRankFusion(vectorResults, keywordResults, opts.limit);
  }

  // --- Entity Operations ---

  addEntity(
    name: string,
    type: string,
    docId: string,
    description?: string,
    chunkIds?: string[]
  ): number {
    const result = this.db.prepare(`
      INSERT INTO entities (name, type, doc_id, description, chunk_ids)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name, type, doc_id) DO UPDATE SET
        description = COALESCE(excluded.description, entities.description),
        chunk_ids = excluded.chunk_ids
    `).run(name, type, docId, description || null, JSON.stringify(chunkIds || []));

    return Number(result.lastInsertRowid);
  }

  getEntities(docId?: string, type?: string): EntityRecord[] {
    let sql = 'SELECT * FROM entities WHERE 1=1';
    const params: unknown[] = [];

    if (docId) {
      sql += ' AND doc_id = ?';
      params.push(docId);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY name';
    return this.db.prepare(sql).all(...params) as EntityRecord[];
  }

  findEntityByName(name: string, docId?: string): EntityRecord | null {
    let sql = 'SELECT * FROM entities WHERE LOWER(name) = LOWER(?)';
    const params: unknown[] = [name];

    if (docId) {
      sql += ' AND doc_id = ?';
      params.push(docId);
    }

    sql += ' LIMIT 1';
    return this.db.prepare(sql).get(...params) as EntityRecord | null;
  }

  // --- Relationship Operations ---

  addRelationship(
    sourceEntityId: number,
    targetEntityId: number,
    relationship: string,
    docId: string,
    chunkId?: string,
    weight?: number
  ): number {
    const result = this.db.prepare(`
      INSERT INTO relationships (source_entity_id, target_entity_id, relationship, doc_id, chunk_id, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sourceEntityId, targetEntityId, relationship, docId, chunkId || null, weight || 1.0);

    return Number(result.lastInsertRowid);
  }

  getRelationships(entityId: number): RelationshipRecord[] {
    return this.db.prepare(`
      SELECT * FROM relationships
      WHERE source_entity_id = ? OR target_entity_id = ?
    `).all(entityId, entityId) as RelationshipRecord[];
  }

  /**
   * Graph-aware search: find entities matching query, traverse relationships,
   * and collect associated chunks.
   */
  graphSearch(query: string, hops: number = 2, docId?: string): GraphSearchResult {
    // Find entities whose name matches the query
    let entitySql = 'SELECT * FROM entities WHERE LOWER(name) LIKE LOWER(?)';
    const params: unknown[] = [`%${query}%`];

    if (docId) {
      entitySql += ' AND doc_id = ?';
      params.push(docId);
    }

    const seedEntities = this.db.prepare(entitySql).all(...params) as EntityRecord[];

    if (seedEntities.length === 0) {
      return { entities: [], relationships: [], chunks: [] };
    }

    // BFS traversal of relationship graph
    const visited = new Set<number>();
    const allEntities: EntityRecord[] = [];
    const allRelationships: RelationshipRecord[] = [];
    let frontier = seedEntities.map(e => e.id);

    for (let hop = 0; hop < hops && frontier.length > 0; hop++) {
      const nextFrontier: number[] = [];

      for (const entityId of frontier) {
        if (visited.has(entityId)) continue;
        visited.add(entityId);

        const entity = this.db.prepare('SELECT * FROM entities WHERE id = ?')
          .get(entityId) as EntityRecord | undefined;
        if (entity) allEntities.push(entity);

        const rels = this.getRelationships(entityId);
        for (const rel of rels) {
          allRelationships.push(rel);
          const neighborId = rel.source_entity_id === entityId
            ? rel.target_entity_id
            : rel.source_entity_id;
          if (!visited.has(neighborId)) {
            nextFrontier.push(neighborId);
          }
        }
      }

      frontier = nextFrontier;
    }

    // Collect chunks referenced by found entities
    const chunkIds = new Set<string>();
    for (const entity of allEntities) {
      try {
        const ids = JSON.parse(entity.chunk_ids) as string[];
        ids.forEach(id => chunkIds.add(id));
      } catch {
        // Invalid chunk_ids JSON — skip
      }
    }

    const chunks: SearchResult[] = [];
    for (const chunkId of chunkIds) {
      const chunk = this.getChunkById(chunkId);
      if (chunk) {
        chunks.push({
          id: chunk.id,
          doc_id: chunk.doc_id,
          text: chunk.text,
          section: chunk.section,
          score: 1.0,
          chunk_index: chunk.chunk_index,
        });
      }
    }

    return { entities: allEntities, relationships: allRelationships, chunks };
  }

  // --- Stats ---

  getStats(): { documents: number; chunks: number; entities: number; relationships: number } {
    const docs = (this.db.prepare('SELECT COUNT(*) as c FROM documents').get() as { c: number }).c;
    const chunks = (this.db.prepare('SELECT COUNT(*) as c FROM chunks').get() as { c: number }).c;
    const entities = (this.db.prepare('SELECT COUNT(*) as c FROM entities').get() as { c: number }).c;
    const rels = (this.db.prepare('SELECT COUNT(*) as c FROM relationships').get() as { c: number }).c;
    return { documents: docs, chunks, entities, relationships: rels };
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Reciprocal Rank Fusion — combines multiple ranked result sets.
 * Standard constant k=60.
 */
function reciprocalRankFusion(
  ...args: [...SearchResult[][], number]
): SearchResult[] {
  const limit = args.pop() as number;
  const resultSets = args as unknown as SearchResult[][];
  const k = 60;
  const scores = new Map<string, { score: number; result: SearchResult }>();

  for (const results of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const r = results[rank];
      const existing = scores.get(r.id);
      const rrfScore = 1 / (k + rank + 1);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(r.id, { score: rrfScore, result: r });
      }
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => ({ ...entry.result, score: entry.score }));
}
