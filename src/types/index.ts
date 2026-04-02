export interface EnvironmentStatus {
  node: DependencyCheck;
  python: DependencyCheck;
  pip: DependencyCheck;
  git: DependencyCheck;
  ide: IDEDetection;
  existingInstall: boolean;
}

export interface DependencyCheck {
  installed: boolean;
  version: string | null;
  path: string | null;
  meetsMinimum: boolean;
}

export interface IDEDetection {
  type: IDEType | null;
  detected: boolean;
  configPath: string | null;
  configDir: string | null;
}

export type IDEType = 'cursor' | 'windsurf' | 'vscode' | 'claude' | 'antigravity' | 'qoder';

export type ServerCategory = 'core' | 'browser' | 'office' | 'data' | 'finance' | 'research' | 'utils';

export type ServerType = 'npm' | 'python' | 'cli';

export interface ServerEntry {
  id: string;
  category: ServerCategory;
  type: ServerType;
  description: string;
  apiRequired: boolean;
  // npm type
  package?: string;
  version?: string;
  command?: string;
  args?: string[];
  // python type
  repo?: string;
  ref?: string;
  // cli type
  installCmd?: string;
  postInstall?: string;
}

export interface ServerRegistry {
  servers: Record<string, ServerEntry>;
}

export interface ServerStatus {
  id: string;
  installed: boolean;
  healthy: boolean;
  version: string | null;
  error: string | null;
}

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  tools: string[];
  triggers: string[];
}

export interface KWOSConfig {
  version: string;
  installedAt: string;
  ide: IDEType;
  servers: string[];
  skills: string[];
  installDir: string;
}

export interface InitOptions {
  ide?: IDEType;
  servers?: string;
  skills?: string;
  browser?: boolean;
}

// --- Skill System v2 Types ---

export type SkillSourceType = 'builtin' | 'github' | 'url' | 'local';

export interface SkillSourceBuiltin {
  type: 'builtin';
  name: string;
}

export interface SkillSourceGitHub {
  type: 'github';
  owner: string;
  repo: string;
  url: string;
}

export interface SkillSourceURL {
  type: 'url';
  url: string;
}

export interface SkillSourceLocal {
  type: 'local';
  path: string;
}

export type SkillSource = SkillSourceBuiltin | SkillSourceGitHub | SkillSourceURL | SkillSourceLocal;

export interface FetchedSkill {
  filename: string;
  content: string;
  source: string;
}

export interface SkillManifestEntry {
  id: string;
  source: string;
  sourceType: SkillSourceType;
  installedAt: string;
  filename: string;
  sha?: string;
}

export interface SkillManifest {
  version: string;
  skills: SkillManifestEntry[];
}

export interface SkillValidationResult {
  valid: boolean;
  safe: boolean;
  warnings: string[];
}

export interface AddSkillOptions {
  force?: boolean;
  dryRun?: boolean;
}

// --- Phase 3: Document Processing Types ---

export type DocumentFileType = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'html' | 'md' | 'txt' | 'csv' | 'json';

export interface DocumentRecord {
  id: string;
  filename: string;
  filepath: string | null;
  filetype: DocumentFileType;
  title: string | null;
  total_chunks: number;
  total_tokens: number;
  ingested_at: string;
  metadata: string;
}

export interface Chunk {
  id: string;
  doc_id: string;
  chunk_index: number;
  text: string;
  start_offset: number;
  end_offset: number;
  section: string | null;
  page_number: number | null;
  token_count: number;
  metadata: string;
}

export interface ChunkOptions {
  maxChunkSize: number;
  overlapSize: number;
  respectBoundaries: boolean;
}

export interface EmbedderConfig {
  provider: 'ollama' | 'llamacpp';
  model: string;
  dimensions: number;
  batchSize: number;
  baseUrl: string;
}

export interface ExtractedEntity {
  name: string;
  type: string;
  description: string;
}

export interface ExtractedRelationship {
  source: string;
  target: string;
  relationship: string;
  context: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

export interface EntityRecord {
  id: number;
  name: string;
  type: string;
  description: string | null;
  doc_id: string | null;
  chunk_ids: string;
  metadata: string;
}

export interface RelationshipRecord {
  id: number;
  source_entity_id: number;
  target_entity_id: number;
  relationship: string;
  weight: number;
  doc_id: string | null;
  chunk_id: string | null;
  metadata: string;
}

export interface SearchResult {
  id: string;
  doc_id: string;
  text: string;
  section: string | null;
  score: number;
  chunk_index: number;
}

export interface SearchOptions {
  limit: number;
  docId?: string;
  minScore?: number;
}

export interface GraphSearchResult {
  entities: EntityRecord[];
  relationships: RelationshipRecord[];
  chunks: SearchResult[];
}

export interface IngestOptions {
  title?: string;
  extractEntities?: boolean;
  generateEmbeddings?: boolean;
}

export interface RAGResult {
  answer: string;
  sources: Array<{
    docId: string;
    chunkId: string;
    section: string | null;
    relevance: number;
  }>;
  entities: EntityRecord[];
}

export interface RLMConfig {
  maxDepth: number;
  maxIterations: number;
  timeout: number;
}

export interface RLMResult {
  answer: string;
  iterations: number;
  codeExecutions: number;
}
