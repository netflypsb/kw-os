import type { EmbedderConfig } from '../types/index.js';
import { log } from '../utils/logger.js';

const DEFAULT_CONFIG: EmbedderConfig = {
  provider: 'ollama',
  model: 'nomic-embed-text',
  dimensions: 768,
  batchSize: 32,
  baseUrl: 'http://localhost:11434',
};

export class LocalEmbedder {
  private config: EmbedderConfig;

  constructor(config?: Partial<EmbedderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get dimensions(): number {
    return this.config.dimensions;
  }

  get model(): string {
    return this.config.model;
  }

  /**
   * Generate embeddings for an array of texts.
   * Processes in batches to avoid overwhelming the embedding server.
   */
  async embed(texts: string[]): Promise<number[][]> {
    switch (this.config.provider) {
      case 'ollama':
        return this.embedViaOllama(texts);
      case 'llamacpp':
        return this.embedViaLlamaCpp(texts);
    }
  }

  /**
   * Generate a single embedding vector for one text.
   */
  async embedOne(text: string): Promise<number[]> {
    const results = await this.embed([text]);
    return results[0];
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

        if (!response.ok) {
          throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { embedding: number[] };
        results.push(data.embedding);
      }
    }

    return results;
  }

  private async embedViaLlamaCpp(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const response = await fetch(`${this.config.baseUrl}/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      if (!response.ok) {
        throw new Error(`llama.cpp embedding failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { embedding: number[] };
      results.push(data.embedding);
    }

    return results;
  }

  /**
   * Check if the embedding provider is available and the model is loaded.
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.config.provider === 'ollama') {
        const resp = await fetch(`${this.config.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) return false;
        const data = await resp.json() as { models?: Array<{ name: string }> };
        return data.models?.some(m => m.name.includes(this.config.model)) ?? false;
      }

      if (this.config.provider === 'llamacpp') {
        const resp = await fetch(`${this.config.baseUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        return resp.ok;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Pull the embedding model if not already present (Ollama only).
   */
  async ensureModel(): Promise<void> {
    if (this.config.provider !== 'ollama') return;

    const available = await this.isAvailable();
    if (available) return;

    log.dim(`  Pulling embedding model: ${this.config.model} ...`);

    const response = await fetch(`${this.config.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.config.model, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model ${this.config.model}: ${response.statusText}`);
    }
  }
}

/**
 * Compute cosine similarity between two vectors.
 * Used as fallback when sqlite-vec is not available.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
