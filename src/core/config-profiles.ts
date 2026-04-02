import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Profile Types ---

export interface ConfigLocation {
  scope: 'project' | 'global';
  filePath: string;
  relativeTo: 'workspace' | 'home' | 'appdata';
  create: boolean;
}

export interface IDEProfileDetection {
  workspaceDirs: string[];
  processNames: string[];
  globalDirs: string[];
  globalDirsRelativeTo?: string;
  cliCheck?: string;
}

export interface IDEProfile {
  displayName: string;
  configLocations: ConfigLocation[];
  jsonRootKey: string;
  detection: IDEProfileDetection;
  skillsDir: string | null;
  rulesDir: string | null;
  notes: string;
}

export interface IDEProfiles {
  version: string;
  profiles: Record<string, IDEProfile>;
}

export interface DetectedIDE {
  id: string;
  profile: IDEProfile;
  confidence: number;
  reasons: string[];
}

export interface ConfigWriteResult {
  ide: string;
  scope: string;
  path: string;
  success: boolean;
  error?: string;
}

// --- Loaders ---

let cachedProfiles: IDEProfiles | null = null;

/**
 * Load IDE profiles from the bundled config-profiles/ide-profiles.json.
 * Results are cached for the process lifetime.
 */
export function loadProfiles(): IDEProfiles {
  if (cachedProfiles) return cachedProfiles;

  // Navigate from dist/core/ up to project root, then into config-profiles/
  const profilePath = path.resolve(__dirname, '..', '..', 'config-profiles', 'ide-profiles.json');

  if (!fs.existsSync(profilePath)) {
    throw new Error(`IDE profiles not found at ${profilePath}`);
  }

  cachedProfiles = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as IDEProfiles;
  return cachedProfiles;
}

/**
 * Clear the cached profiles (useful for testing or after profile updates).
 */
export function clearProfileCache(): void {
  cachedProfiles = null;
}

// --- Path Resolution ---

/**
 * Get the platform-appropriate AppData directory.
 * - Windows: %APPDATA% (e.g. C:\Users\X\AppData\Roaming)
 * - macOS: ~/Library/Application Support
 * - Linux: ~/.config
 */
export function getAppDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  return path.join(os.homedir(), '.config');
}

/**
 * Resolve a ConfigLocation to an absolute filesystem path.
 */
export function resolveConfigPath(location: ConfigLocation, cwd: string): string {
  switch (location.relativeTo) {
    case 'workspace':
      return path.join(cwd, location.filePath);
    case 'home':
      return path.join(os.homedir(), location.filePath);
    case 'appdata':
      return path.join(getAppDataDir(), location.filePath);
    default:
      return path.join(cwd, location.filePath);
  }
}

/**
 * Resolve a relative directory path using the same base logic as ConfigLocation,
 * given a `relativeTo` hint and the workspace cwd.
 */
export function resolveDetectionDir(
  dir: string,
  relativeTo: string | undefined,
  cwd: string
): string {
  switch (relativeTo) {
    case 'appdata':
      return path.join(getAppDataDir(), dir);
    case 'home':
      return path.join(os.homedir(), dir);
    default:
      return path.join(os.homedir(), dir);
  }
}

// --- Profile Lookups ---

/**
 * Get the IDE profile for a given IDE type string.
 * Falls back to a sensible default if the profile doesn't exist.
 */
export function getProfile(ideId: string): IDEProfile | null {
  const profiles = loadProfiles();
  return profiles.profiles[ideId] || null;
}

/**
 * Get the skills directory for an IDE, resolved to an absolute path.
 * Returns null if the profile has no skillsDir.
 */
export function getProfileSkillsDir(ideId: string, cwd: string): string | null {
  const profile = getProfile(ideId);
  if (!profile?.skillsDir) return null;
  return path.join(cwd, profile.skillsDir);
}

/**
 * Get the rules directory for an IDE, resolved to an absolute path.
 * Returns null if the profile has no rulesDir.
 */
export function getProfileRulesDir(ideId: string, cwd: string): string | null {
  const profile = getProfile(ideId);
  if (!profile?.rulesDir) return null;
  return path.join(cwd, profile.rulesDir);
}
