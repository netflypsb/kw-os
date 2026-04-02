import crypto from 'node:crypto';
import type { Chunk, ChunkOptions } from '../types/index.js';

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChunkSize: 4000,      // ~1000 tokens
  overlapSize: 800,        // ~200 tokens
  respectBoundaries: true,
};

// Heading patterns sorted by level (highest first)
const HEADING_PATTERNS = [
  /^#{1}\s+.+$/m,   // # H1
  /^#{2}\s+.+$/m,   // ## H2
  /^#{3}\s+.+$/m,   // ### H3
  /^#{4,6}\s+.+$/m, // #### H4-H6
];

const PAGE_BREAK = /\f|---\s*page\s*break\s*---/gi;
const PARAGRAPH_BREAK = /\n\s*\n/;
const SENTENCE_END = /(?<=[.!?])\s+/;

interface BoundaryCandidate {
  index: number;
  level: number; // lower = stronger boundary
}

/**
 * Detect the current section heading for a given offset in the document.
 */
function detectSection(text: string, offset: number): string | null {
  const preceding = text.slice(0, offset);
  const headings = preceding.match(/^#{1,6}\s+.+$/gm);
  if (headings && headings.length > 0) {
    return headings[headings.length - 1].replace(/^#+\s+/, '').trim();
  }
  return null;
}

/**
 * Estimate token count from character count (~4 chars per token for English).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Find the best split point within a text range, respecting structural boundaries.
 */
function findBestSplitPoint(text: string, maxSize: number): number {
  if (text.length <= maxSize) return text.length;

  const searchRegion = text.slice(0, maxSize);

  // Try splitting at paragraph breaks (strongest boundary within text)
  const paragraphs = [...searchRegion.matchAll(/\n\s*\n/g)];
  if (paragraphs.length > 0) {
    // Pick the last paragraph break within the limit
    const last = paragraphs[paragraphs.length - 1];
    if (last.index !== undefined && last.index > maxSize * 0.3) {
      return last.index + last[0].length;
    }
  }

  // Try splitting at sentence boundaries
  const sentences = [...searchRegion.matchAll(/(?<=[.!?])\s+/g)];
  if (sentences.length > 0) {
    const last = sentences[sentences.length - 1];
    if (last.index !== undefined && last.index > maxSize * 0.3) {
      return last.index + last[0].length;
    }
  }

  // Try splitting at line breaks
  const lines = [...searchRegion.matchAll(/\n/g)];
  if (lines.length > 0) {
    const last = lines[lines.length - 1];
    if (last.index !== undefined) {
      return last.index + 1;
    }
  }

  // Last resort: split at word boundary
  const lastSpace = searchRegion.lastIndexOf(' ');
  if (lastSpace > maxSize * 0.3) return lastSpace + 1;

  // Absolute last resort: hard split
  return maxSize;
}

/**
 * Split document text into heading-delimited sections.
 * Returns array of { text, heading, startOffset }.
 */
function splitByHeadings(text: string): Array<{ text: string; heading: string | null; startOffset: number }> {
  const sections: Array<{ text: string; heading: string | null; startOffset: number }> = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const matches = [...text.matchAll(headingRegex)];

  if (matches.length === 0) {
    return [{ text, heading: null, startOffset: 0 }];
  }

  // Text before first heading
  const firstIndex = matches[0].index!;
  if (firstIndex > 0) {
    const preText = text.slice(0, firstIndex).trim();
    if (preText.length > 0) {
      sections.push({ text: preText, heading: null, startOffset: 0 });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const sectionText = text.slice(start, end).trim();
    const heading = match[2].trim();

    if (sectionText.length > 0) {
      sections.push({ text: sectionText, heading, startOffset: start });
    }
  }

  return sections;
}

/**
 * Chunk a document into overlapping segments preserving semantic structure.
 *
 * Strategy:
 * 1. Split by headings if respectBoundaries is true
 * 2. For each section, split at natural boundaries (paragraph > sentence > word)
 * 3. Add overlap from previous chunk's tail
 * 4. Tag each chunk with section name and position
 */
export function chunkDocument(
  text: string,
  docId: string,
  options: Partial<ChunkOptions> = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  if (opts.respectBoundaries) {
    const sections = splitByHeadings(text);

    for (const section of sections) {
      const sectionChunks = chunkText(
        section.text,
        docId,
        opts,
        chunkIndex,
        section.startOffset,
        section.heading
      );
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }
  } else {
    const simpleChunks = chunkText(text, docId, opts, 0, 0, null);
    chunks.push(...simpleChunks);
  }

  // Add overlap between consecutive chunks
  if (opts.overlapSize > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const overlapText = prev.text.slice(-opts.overlapSize);
      if (overlapText.length > 0 && !chunks[i].text.startsWith(overlapText)) {
        chunks[i].text = overlapText + '\n...\n' + chunks[i].text;
        chunks[i].token_count = estimateTokens(chunks[i].text);
      }
    }
  }

  return chunks;
}

/**
 * Split a single section of text into chunks.
 */
function chunkText(
  text: string,
  docId: string,
  opts: ChunkOptions,
  startIndex: number,
  globalOffset: number,
  section: string | null
): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = 0;
  let index = startIndex;

  while (offset < text.length) {
    const remaining = text.slice(offset);
    const splitAt = findBestSplitPoint(remaining, opts.maxChunkSize);
    const chunkText = remaining.slice(0, splitAt).trim();

    if (chunkText.length === 0) {
      offset += splitAt;
      continue;
    }

    const chunkId = crypto.createHash('sha256')
      .update(`${docId}:${index}:${globalOffset + offset}`)
      .digest('hex')
      .slice(0, 16);

    chunks.push({
      id: chunkId,
      doc_id: docId,
      chunk_index: index,
      text: chunkText,
      start_offset: globalOffset + offset,
      end_offset: globalOffset + offset + splitAt,
      section: section || detectSection(text, offset),
      page_number: null,
      token_count: estimateTokens(chunkText),
      metadata: '{}',
    });

    offset += splitAt;
    index++;
  }

  return chunks;
}

export { DEFAULT_OPTIONS as defaultChunkOptions };
