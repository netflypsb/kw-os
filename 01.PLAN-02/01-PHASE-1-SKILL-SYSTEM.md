# Phase 1: Skill System Overhaul

> Auto-load all built-in skills during init + make `add-skill` capable of fetching from external URLs and GitHub repos.

---

## Problem Statement

### Problem 1: Built-in skills not auto-loaded
Currently, the `installSkills()` function in `src/core/skill-installer.ts` accepts a `skillFilter` parameter. During `kw-os init`, the filter defaults to `'all'`, but the `add-skill` command requires an exact skill name match. If the user passes `'none'` or a specific name, built-in skills may not all be installed. The intent is that **all built-in skills should always be installed** during init, unconditionally.

### Problem 2: `add-skill` is local-only
The `addSkillCommand()` in `src/commands/add-skill.ts` calls `installSkills(skillName, ide, cwd)` which only searches the local `skills/` directory inside the kw-os npm package. There is no mechanism to fetch skills from external sources.

---

## Detailed Implementation Plan

### Step 1.1: Auto-load All Built-in Skills on Init

**File: `src/commands/init.ts`**

Change the skill installation step to **always** install all built-in skills, ignoring the `--skills` filter for built-in skills:

```typescript
// Current (line 96):
const skillCount = installSkills(skillFilter, ide, cwd);

// New:
const skillCount = installSkills('all', ide, cwd);
// skillFilter only applies to external skills if we add that later
```

The `--skills` CLI option should be deprecated or repurposed. Built-in skills are always installed because they define the agent's core competencies.

**Rationale**: Built-in skills are lightweight `.md` files (<10KB each). There's no reason to skip them — they define the agent's professional capabilities and cost nothing at runtime.

---

### Step 1.2: Extend `add-skill` Command to Accept External Sources

**File: `src/commands/add-skill.ts`**

The command must now parse the `<name>` argument to determine the source type:

```
kw-os add-skill financial-analyst          # Built-in skill (existing behavior)
kw-os add-skill user/repo                  # GitHub shorthand
kw-os add-skill https://github.com/u/repo  # Full GitHub URL
kw-os add-skill https://example.com/s.md   # Direct URL to .md file
kw-os add-skill ./path/to/skill.md         # Local file path
```

**Source detection logic:**

```typescript
function detectSkillSource(input: string): SkillSource {
  // 1. Local file path (starts with ./ or ../ or absolute path)
  if (input.startsWith('./') || input.startsWith('../') || path.isAbsolute(input)) {
    return { type: 'local', path: input };
  }

  // 2. Full GitHub URL
  if (input.startsWith('https://github.com/')) {
    const match = input.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) return { type: 'github', owner: match[1], repo: match[2], url: input };
  }

  // 3. Direct URL to .md file
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return { type: 'url', url: input };
  }

  // 4. GitHub shorthand (owner/repo)
  if (input.includes('/') && !input.includes(' ')) {
    const [owner, repo] = input.split('/');
    return { type: 'github', owner, repo, url: `https://github.com/${owner}/${repo}` };
  }

  // 5. Built-in skill name
  return { type: 'builtin', name: input };
}
```

---

### Step 1.3: Create Skill Fetcher Module

**New file: `src/core/skill-fetcher.ts`**

This module handles downloading/cloning skills from external sources.

#### GitHub Repository Fetcher

For GitHub repos, the fetcher:
1. Checks if the repo contains a `skills/` directory or `.md` files at root
2. Uses GitHub's raw content API (no auth needed for public repos) or `git clone --depth 1`
3. Downloads all `.md` files that match the skill format (YAML frontmatter + markdown)

```typescript
async function fetchFromGitHub(source: GitHubSource): Promise<FetchedSkill[]> {
  const tempDir = path.join(os.tmpdir(), `kw-os-skill-${Date.now()}`);
  
  try {
    // Clone with depth 1 for minimal download
    execSync(
      `git clone --depth 1 ${source.url}.git "${tempDir}"`,
      { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    // Look for skill files in standard locations
    const searchDirs = [
      path.join(tempDir, 'skills'),
      path.join(tempDir, '.cursor', 'skills'),
      path.join(tempDir, '.windsurf', 'skills'),
      tempDir, // root-level .md files
    ];
    
    const skills: FetchedSkill[] = [];
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        if (isValidSkill(content)) {
          skills.push({ filename: file, content, source: source.url });
        }
      }
    }
    
    return skills;
  } finally {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
```

#### Direct URL Fetcher

For direct `.md` URLs:
```typescript
async function fetchFromURL(url: string): Promise<FetchedSkill[]> {
  // Use Node's built-in fetch (Node 18+)
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  
  const content = await response.text();
  if (!isValidSkill(content)) {
    throw new Error('URL content does not appear to be a valid skill file');
  }
  
  const filename = path.basename(new URL(url).pathname) || 'external-skill.md';
  return [{ filename, content, source: url }];
}
```

#### Local File Fetcher

```typescript
async function fetchFromLocal(filePath: string): Promise<FetchedSkill[]> {
  const resolved = path.resolve(filePath);
  
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  
  const stat = fs.statSync(resolved);
  
  if (stat.isDirectory()) {
    // Scan directory for .md skill files
    const files = fs.readdirSync(resolved).filter(f => f.endsWith('.md'));
    return files
      .map(f => {
        const content = fs.readFileSync(path.join(resolved, f), 'utf-8');
        return { filename: f, content, source: resolved };
      })
      .filter(s => isValidSkill(s.content));
  }
  
  const content = fs.readFileSync(resolved, 'utf-8');
  if (!isValidSkill(content)) {
    throw new Error('File does not appear to be a valid skill file');
  }
  
  return [{ filename: path.basename(resolved), content, source: resolved }];
}
```

---

### Step 1.4: Create Skill Validator Module

**New file: `src/core/skill-validator.ts`**

Validates that a `.md` file is a legitimate kw-os skill:

```typescript
export function isValidSkill(content: string): boolean {
  // Must have YAML frontmatter
  if (!content.startsWith('---')) return false;
  
  const fmEnd = content.indexOf('---', 3);
  if (fmEnd === -1) return false;
  
  const frontmatter = content.slice(3, fmEnd).trim();
  
  // Must have at least an id or name field
  const hasId = /^id:/m.test(frontmatter);
  const hasName = /^name:/m.test(frontmatter);
  
  if (!hasId && !hasName) return false;
  
  // Must have markdown body after frontmatter
  const body = content.slice(fmEnd + 3).trim();
  if (body.length < 50) return false; // Too short to be useful
  
  return true;
}

export function validateSkillSafety(content: string): ValidationResult {
  const warnings: string[] = [];
  
  // Check for suspicious patterns
  if (content.includes('<script')) warnings.push('Contains <script> tags');
  if (/\beval\s*\(/.test(content)) warnings.push('Contains eval() calls');
  if (/\brm\s+-rf/.test(content)) warnings.push('Contains destructive shell commands');
  if (/\bcurl\b.*\|\s*sh/.test(content)) warnings.push('Contains pipe-to-shell patterns');
  
  return {
    safe: warnings.length === 0,
    warnings,
  };
}
```

---

### Step 1.5: Skill Manifest for Tracking

**New file: `~/.kw-os/skill-manifest.json`**

Track what skills are installed, where they came from, and when:

```json
{
  "skills": [
    {
      "id": "financial-analyst",
      "source": "builtin",
      "version": "1.0.0",
      "installedAt": "2025-04-01T00:00:00Z",
      "filename": "financial-analyst.md"
    },
    {
      "id": "custom-devops",
      "source": "https://github.com/user/devops-skills",
      "version": null,
      "installedAt": "2025-04-02T00:00:00Z",
      "filename": "custom-devops.md",
      "sha": "abc123"
    }
  ]
}
```

---

### Step 1.6: Updated CLI Interface

**File: `src/cli.ts`**

```typescript
program
  .command('add-skill <source>')
  .description('Install skill(s) from built-in library, GitHub repo, URL, or local path')
  .option('--force', 'Overwrite existing skills')
  .option('--dry-run', 'Show what would be installed without installing')
  .action(addSkillCommand);
```

---

### Step 1.7: Rewrite `addSkillCommand`

**File: `src/commands/add-skill.ts`**

```typescript
export async function addSkillCommand(
  source: string,
  options: { force?: boolean; dryRun?: boolean }
): Promise<void> {
  const cwd = process.cwd();
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    log.error('KW-OS is not installed. Run "kw-os init" first.');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as KWOSConfig;
  const ide: IDEType = config.ide;

  const skillSource = detectSkillSource(source);
  log.info(`Source type: ${skillSource.type}`);

  let fetchedSkills: FetchedSkill[];

  try {
    switch (skillSource.type) {
      case 'builtin':
        // Existing behavior: copy from package
        const count = installSkills(skillSource.name, ide, cwd);
        if (count > 0) {
          log.success(`Installed built-in skill: ${skillSource.name}`);
        } else {
          log.error(`Built-in skill "${skillSource.name}" not found.`);
        }
        return;

      case 'github':
        fetchedSkills = await fetchFromGitHub(skillSource);
        break;
      case 'url':
        fetchedSkills = await fetchFromURL(skillSource.url);
        break;
      case 'local':
        fetchedSkills = await fetchFromLocal(skillSource.path);
        break;
    }
  } catch (err) {
    log.error(`Failed to fetch skill: ${err.message}`);
    return;
  }

  if (fetchedSkills.length === 0) {
    log.error('No valid skill files found at the specified source.');
    return;
  }

  // Validate and install
  const skillsDir = getIDESkillsDir(ide, cwd);
  fs.mkdirSync(skillsDir, { recursive: true });

  let installed = 0;
  for (const skill of fetchedSkills) {
    const safety = validateSkillSafety(skill.content);
    if (!safety.safe) {
      log.warn(`⚠ ${skill.filename}: ${safety.warnings.join(', ')}`);
      if (!options.force) {
        log.warn('  Skipping. Use --force to install anyway.');
        continue;
      }
    }

    if (options.dryRun) {
      log.info(`  Would install: ${skill.filename}`);
      continue;
    }

    const dest = path.join(skillsDir, skill.filename);
    if (fs.existsSync(dest) && !options.force) {
      log.dim(`  Skipping ${skill.filename} (already exists, use --force)`);
      continue;
    }

    fs.writeFileSync(dest, skill.content);
    installed++;
    log.success(`Installed: ${skill.filename}`);
  }

  // Update manifest
  updateSkillManifest(fetchedSkills, source);

  log.info(`\n  ${installed} skill(s) installed from ${skillSource.type} source`);
}
```

---

## New Types Required

**File: `src/types/index.ts` — additions:**

```typescript
export type SkillSourceType = 'builtin' | 'github' | 'url' | 'local';

export interface SkillSource {
  type: SkillSourceType;
  name?: string;     // for builtin
  owner?: string;    // for github
  repo?: string;     // for github
  url?: string;      // for github/url
  path?: string;     // for local
}

export interface FetchedSkill {
  filename: string;
  content: string;
  source: string;
}

export interface SkillManifestEntry {
  id: string;
  source: string;
  version: string | null;
  installedAt: string;
  filename: string;
  sha?: string;
}

export interface SkillManifest {
  skills: SkillManifestEntry[];
}

export interface ValidationResult {
  safe: boolean;
  warnings: string[];
}
```

---

## Files Changed / Created

| File | Action | Description |
|------|--------|-------------|
| `src/commands/init.ts` | Modified | Force `installSkills('all', ...)` |
| `src/commands/add-skill.ts` | Rewritten | Universal skill installer with source detection |
| `src/core/skill-fetcher.ts` | **New** | Fetch skills from GitHub/URL/local |
| `src/core/skill-validator.ts` | **New** | Validate skill format and safety |
| `src/core/skill-installer.ts` | Modified | Export `getIDESkillsDir` for external use |
| `src/types/index.ts` | Modified | Add new type definitions |
| `src/cli.ts` | Modified | Update command definition with new options |

---

## Testing Checklist

- [ ] `kw-os init` installs ALL built-in skills unconditionally
- [ ] `kw-os add-skill financial-analyst` works (built-in)
- [ ] `kw-os add-skill user/repo` clones and installs skills from GitHub
- [ ] `kw-os add-skill https://github.com/user/repo` works with full URL
- [ ] `kw-os add-skill https://raw.githubusercontent.com/.../skill.md` works with direct URL
- [ ] `kw-os add-skill ./local-skill.md` works with local files
- [ ] `kw-os add-skill ./skills-dir/` works with local directories
- [ ] Invalid/malicious skills are flagged with warnings
- [ ] `--force` overrides safety warnings and existing files
- [ ] `--dry-run` shows what would be installed without installing
- [ ] Skill manifest is updated after each install
- [ ] Temp directories are cleaned up after GitHub clones
- [ ] Graceful error handling for network failures, invalid URLs, etc.
