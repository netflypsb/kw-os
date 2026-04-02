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
