import type {
  ExtractedEntity,
  ExtractedRelationship,
  EntityExtractionResult,
  EntityRecord,
} from '../types/index.js';
import type { DocumentStore } from './store.js';

/**
 * Extract entities and relationships from a chunk of text.
 * Uses a structured prompt that works with any LLM provider.
 *
 * The caller is responsible for sending this prompt to their LLM
 * and passing the response back through parseExtractionResponse().
 */
export function buildEntityExtractionPrompt(
  chunkText: string,
  docContext?: string
): string {
  const contextLine = docContext
    ? `Document context: ${docContext}\n\n`
    : '';

  return `${contextLine}Extract all named entities and their relationships from this text.

Text:
${chunkText}

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "entities": [
    {"name": "exact name", "type": "person|org|location|concept|date|money|product|event|regulation|document", "description": "one-sentence description"}
  ],
  "relationships": [
    {"source": "entity name", "target": "entity name", "relationship": "verb_phrase", "context": "brief context"}
  ]
}

Rules:
- Extract ALL named entities, not just the most prominent ones
- Use lowercase_snake_case for relationship types (e.g. "works_for", "located_in", "regulates")
- description should be specific to this text, not generic
- If no entities found, return {"entities": [], "relationships": []}`;
}

/**
 * Parse the LLM's JSON response into structured entities and relationships.
 * Handles common LLM output quirks (markdown fences, trailing commas, etc.).
 */
export function parseExtractionResponse(response: string): EntityExtractionResult {
  const empty: EntityExtractionResult = { entities: [], relationships: [] };

  try {
    // Strip markdown code fences if present
    let cleaned = response
      .replace(/^```(?:json)?\s*\n?/m, '')
      .replace(/\n?```\s*$/m, '')
      .trim();

    // Remove trailing commas (common LLM mistake)
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    const parsed = JSON.parse(cleaned) as {
      entities?: unknown[];
      relationships?: unknown[];
    };

    const entities: ExtractedEntity[] = [];
    const relationships: ExtractedRelationship[] = [];

    if (Array.isArray(parsed.entities)) {
      for (const e of parsed.entities) {
        if (isValidEntity(e)) {
          entities.push({
            name: String(e.name).trim(),
            type: normalizeEntityType(String(e.type)),
            description: String(e.description || '').trim(),
          });
        }
      }
    }

    if (Array.isArray(parsed.relationships)) {
      for (const r of parsed.relationships) {
        if (isValidRelationship(r)) {
          relationships.push({
            source: String(r.source).trim(),
            target: String(r.target).trim(),
            relationship: normalizeRelationship(String(r.relationship)),
            context: String(r.context || '').trim(),
          });
        }
      }
    }

    return { entities, relationships };
  } catch {
    return empty;
  }
}

function isValidEntity(e: unknown): e is { name: string; type: string; description?: string } {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  return typeof obj.name === 'string' && obj.name.length > 0
    && typeof obj.type === 'string' && obj.type.length > 0;
}

function isValidRelationship(r: unknown): r is { source: string; target: string; relationship: string; context?: string } {
  if (!r || typeof r !== 'object') return false;
  const obj = r as Record<string, unknown>;
  return typeof obj.source === 'string' && obj.source.length > 0
    && typeof obj.target === 'string' && obj.target.length > 0
    && typeof obj.relationship === 'string' && obj.relationship.length > 0;
}

const VALID_ENTITY_TYPES = new Set([
  'person', 'org', 'location', 'concept', 'date', 'money',
  'product', 'event', 'regulation', 'document',
]);

function normalizeEntityType(type: string): string {
  const lower = type.toLowerCase().trim();
  if (VALID_ENTITY_TYPES.has(lower)) return lower;

  // Common synonyms
  if (lower.includes('organization') || lower.includes('company')) return 'org';
  if (lower.includes('place') || lower.includes('city') || lower.includes('country')) return 'location';
  if (lower.includes('law') || lower.includes('rule') || lower.includes('policy')) return 'regulation';
  if (lower.includes('amount') || lower.includes('price') || lower.includes('cost')) return 'money';

  return 'concept'; // Default fallback
}

function normalizeRelationship(rel: string): string {
  return rel.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Store extracted entities and relationships into the DocumentStore.
 * Handles deduplication by upserting entities and resolving names to IDs.
 */
export function storeExtraction(
  store: DocumentStore,
  extraction: EntityExtractionResult,
  docId: string,
  chunkId: string
): { entitiesStored: number; relationshipsStored: number } {
  let entitiesStored = 0;
  let relationshipsStored = 0;

  // Map entity names to IDs for relationship resolution
  const nameToId = new Map<string, number>();

  for (const entity of extraction.entities) {
    const id = store.addEntity(
      entity.name,
      entity.type,
      docId,
      entity.description,
      [chunkId]
    );
    nameToId.set(entity.name.toLowerCase(), id);
    entitiesStored++;
  }

  for (const rel of extraction.relationships) {
    const sourceId = nameToId.get(rel.source.toLowerCase())
      || store.findEntityByName(rel.source, docId)?.id;
    const targetId = nameToId.get(rel.target.toLowerCase())
      || store.findEntityByName(rel.target, docId)?.id;

    if (sourceId && targetId) {
      store.addRelationship(
        sourceId,
        targetId,
        rel.relationship,
        docId,
        chunkId
      );
      relationshipsStored++;
    }
  }

  return { entitiesStored, relationshipsStored };
}

/**
 * Deduplicate entities by fuzzy name matching.
 * Simple approach: normalize and compare lowercase names.
 * More advanced: Levenshtein distance or LLM-assisted resolution.
 */
export function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = `${entity.type}:${entity.name.toLowerCase().trim()}`;
    const existing = seen.get(key);

    if (existing) {
      // Merge descriptions — keep the longer one
      if (entity.description.length > existing.description.length) {
        existing.description = entity.description;
      }
    } else {
      seen.set(key, { ...entity });
    }
  }

  return [...seen.values()];
}
