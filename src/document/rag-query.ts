import type {
  SearchOptions,
  SearchResult,
  GraphSearchResult,
  EntityRecord,
  RAGResult,
} from '../types/index.js';
import type { DocumentStore } from './store.js';
import type { LocalEmbedder } from './embedder.js';

/**
 * Callback type for LLM answer generation.
 * The RAG engine is LLM-agnostic — the caller provides the completion function.
 */
export type RAGCompletionFn = (prompt: string) => Promise<string>;

export interface QueryOptions {
  topK?: number;
  contextChunks?: number;
  docId?: string;
  useGraph?: boolean;
  graphHops?: number;
}

const DEFAULT_QUERY_OPTIONS: Required<QueryOptions> = {
  topK: 10,
  contextChunks: 5,
  docId: '',
  useGraph: true,
  graphHops: 2,
};

export class RAGQueryEngine {
  private store: DocumentStore;
  private embedder: LocalEmbedder;
  private llmComplete: RAGCompletionFn;

  constructor(
    store: DocumentStore,
    embedder: LocalEmbedder,
    llmComplete: RAGCompletionFn
  ) {
    this.store = store;
    this.embedder = embedder;
    this.llmComplete = llmComplete;
  }

  /**
   * Answer a question using hybrid retrieval (vector + keyword + graph).
   *
   * Pipeline:
   * 1. Embed the query
   * 2. Hybrid search (vector similarity + BM25 keyword)
   * 3. Graph-augmented retrieval (optional)
   * 4. Combine and deduplicate results
   * 5. Build context from top chunks
   * 6. Generate answer with LLM
   */
  async query(question: string, options?: QueryOptions): Promise<RAGResult> {
    const opts = { ...DEFAULT_QUERY_OPTIONS, ...options };

    // Step 1: Embed the query
    const queryEmbedding = await this.embedder.embedOne(question);

    // Step 2: Hybrid search
    const searchOpts: Partial<SearchOptions> = {
      limit: opts.topK,
      docId: opts.docId || undefined,
    };

    const hybridResults = this.store.hybridSearch(
      queryEmbedding,
      question,
      searchOpts
    );

    // Step 3: Graph-augmented retrieval
    let graphResults: GraphSearchResult = { entities: [], relationships: [], chunks: [] };
    if (opts.useGraph) {
      graphResults = this.store.graphSearch(
        question,
        opts.graphHops,
        opts.docId || undefined
      );
    }

    // Step 4: Combine and deduplicate
    const allChunks = deduplicateResults([
      ...hybridResults,
      ...graphResults.chunks,
    ]);

    // Step 5: Build context from top chunks
    const contextChunks = allChunks.slice(0, opts.contextChunks);
    const context = contextChunks
      .map(c => {
        const header = c.section ? `[${c.section}]` : `[Chunk ${c.chunk_index}]`;
        return `${header}\n${c.text}`;
      })
      .join('\n\n---\n\n');

    // Step 6: Generate answer
    const entityContext = graphResults.entities.length > 0
      ? `\nRelevant entities: ${graphResults.entities.map(e => `${e.name} (${e.type})`).join(', ')}\n`
      : '';

    const prompt = `Answer the following question based on the provided context. 
Be precise and cite specific sections when possible.
If the context doesn't contain enough information, say so.

${entityContext}
Context:
${context}

Question: ${question}

Answer:`;

    const answer = await this.llmComplete(prompt);

    return {
      answer,
      sources: contextChunks.map(c => ({
        docId: c.doc_id,
        chunkId: c.id,
        section: c.section,
        relevance: c.score,
      })),
      entities: graphResults.entities,
    };
  }

  /**
   * Simple retrieval without LLM generation — just return relevant chunks.
   * Useful for building context for external LLM calls.
   */
  async retrieve(
    question: string,
    options?: QueryOptions
  ): Promise<{ chunks: SearchResult[]; entities: EntityRecord[] }> {
    const opts = { ...DEFAULT_QUERY_OPTIONS, ...options };

    const queryEmbedding = await this.embedder.embedOne(question);

    const hybridResults = this.store.hybridSearch(
      queryEmbedding,
      question,
      { limit: opts.topK, docId: opts.docId || undefined }
    );

    let entities: EntityRecord[] = [];
    if (opts.useGraph) {
      const graphResults = this.store.graphSearch(
        question,
        opts.graphHops,
        opts.docId || undefined
      );
      entities = graphResults.entities;

      // Merge graph chunks into results
      const allChunks = deduplicateResults([
        ...hybridResults,
        ...graphResults.chunks,
      ]);
      return { chunks: allChunks.slice(0, opts.contextChunks), entities };
    }

    return { chunks: hybridResults.slice(0, opts.contextChunks), entities };
  }
}

/**
 * Deduplicate search results by chunk ID, keeping the highest score.
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>();

  for (const r of results) {
    const existing = seen.get(r.id);
    if (!existing || r.score > existing.score) {
      seen.set(r.id, r);
    }
  }

  return [...seen.values()].sort((a, b) => b.score - a.score);
}
