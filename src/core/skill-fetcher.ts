import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import type {
  SkillSource,
  SkillSourceGitHub,
  SkillSourceURL,
  SkillSourceLocal,
  FetchedSkill,
} from '../types/index.js';
import { isValidSkill } from './skill-validator.js';
import { log } from '../utils/logger.js';

/**
 * Detect the skill source type from user input string.
 *
 *  - Local file/dir path: starts with ./ or ../ or is absolute
 *  - Full GitHub URL: starts with https://github.com/
 *  - Direct URL to .md: starts with http(s):// and ends with .md
 *  - Generic URL: starts with http(s)://
 *  - GitHub shorthand: contains exactly one / with no spaces (owner/repo)
 *  - Built-in skill name: everything else
 */
export function detectSkillSource(input: string): SkillSource {
  // 1. Local file path
  if (
    input.startsWith('./') ||
    input.startsWith('.\\') ||
    input.startsWith('../') ||
    input.startsWith('..\\') ||
    path.isAbsolute(input)
  ) {
    return { type: 'local', path: input };
  }

  // 2. Full GitHub URL
  if (input.startsWith('https://github.com/') || input.startsWith('http://github.com/')) {
    const match = input.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
    if (match) {
      const repoName = match[2].replace(/\.git$/, '');
      return { type: 'github', owner: match[1], repo: repoName, url: input };
    }
  }

  // 3. Direct URL (any http/https)
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return { type: 'url', url: input };
  }

  // 4. GitHub shorthand (owner/repo — exactly one slash, no spaces)
  if (/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(input)) {
    const [owner, repo] = input.split('/');
    return { type: 'github', owner, repo, url: `https://github.com/${owner}/${repo}` };
  }

  // 5. Built-in skill name
  return { type: 'builtin', name: input };
}

/**
 * Fetch skills from a GitHub repository.
 * Clones the repo to a temp directory, scans for skill .md files, returns them.
 */
export async function fetchFromGitHub(source: SkillSourceGitHub): Promise<FetchedSkill[]> {
  const tempDir = path.join(os.tmpdir(), `kw-os-skill-${Date.now()}`);

  try {
    log.dim(`  Cloning ${source.url} ...`);

    const cloneUrl = source.url.endsWith('.git') ? source.url : `${source.url}.git`;
    execSync(
      `git clone --depth 1 "${cloneUrl}" "${tempDir}"`,
      { encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Search for skill files in standard locations
    const searchDirs = [
      path.join(tempDir, 'skills'),
      path.join(tempDir, '.cursor', 'skills'),
      path.join(tempDir, '.windsurf', 'skills'),
      path.join(tempDir, '.vscode', 'skills'),
      tempDir, // root-level .md files
    ];

    const skills: FetchedSkill[] = [];
    const seen = new Set<string>();

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        if (seen.has(file)) continue;

        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        if (isValidSkill(content)) {
          skills.push({ filename: file, content, source: source.url });
          seen.add(file);
        }
      }
    }

    return skills;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to clone ${source.url}: ${msg}`);
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Non-fatal cleanup failure
    }
  }
}

/**
 * Fetch a skill from a direct URL.
 * If the URL points to a raw .md file, fetch and validate it.
 * If it points to a GitHub blob URL, convert to raw URL automatically.
 */
export async function fetchFromURL(source: SkillSourceURL): Promise<FetchedSkill[]> {
  let url = source.url;

  // Convert GitHub blob URLs to raw URLs
  // https://github.com/user/repo/blob/main/file.md → https://raw.githubusercontent.com/user/repo/main/file.md
  const blobMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/
  );
  if (blobMatch) {
    url = `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}`;
  }

  log.dim(`  Fetching ${url} ...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const content = await response.text();

  if (!isValidSkill(content)) {
    throw new Error('URL content is not a valid skill file (missing YAML frontmatter with id/name)');
  }

  // Derive filename from URL path
  let filename: string;
  try {
    const pathname = new URL(url).pathname;
    filename = path.basename(pathname);
    if (!filename.endsWith('.md')) {
      filename = `${filename}.md`;
    }
  } catch {
    filename = 'external-skill.md';
  }

  return [{ filename, content, source: source.url }];
}

/**
 * Fetch skills from a local file or directory.
 */
export async function fetchFromLocal(source: SkillSourceLocal): Promise<FetchedSkill[]> {
  const resolved = path.resolve(source.path);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Path not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);

  if (stat.isDirectory()) {
    const files = fs.readdirSync(resolved).filter(f => f.endsWith('.md'));
    const skills: FetchedSkill[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(resolved, file), 'utf-8');
      if (isValidSkill(content)) {
        skills.push({ filename: file, content, source: resolved });
      }
    }

    return skills;
  }

  // Single file
  const content = fs.readFileSync(resolved, 'utf-8');
  if (!isValidSkill(content)) {
    throw new Error(`File is not a valid skill (missing YAML frontmatter with id/name): ${resolved}`);
  }

  return [{ filename: path.basename(resolved), content, source: resolved }];
}
