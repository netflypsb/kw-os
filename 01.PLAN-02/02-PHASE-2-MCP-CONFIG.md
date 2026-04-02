# Phase 2: Robust Cross-IDE MCP Configuration

> Write MCP config to the correct location for every MCP client, automatically adapting to any future changes.

---

## Problem Statement

### The Bug (Windsurf)
KW-OS currently generates `mcp.json` for all IDEs using a hardcoded mapping in `src/core/config-generator.ts`:

```typescript
private getIDEConfigPath(ide: IDEType, cwd: string): { dir: string; path: string } {
  const mapping: Record<IDEType, string> = {
    cursor: '.cursor',
    windsurf: '.windsurf',
    vscode: '.vscode',
    claude: '.claude',
    antigravity: '.antigravity',
    qoder: '.qoder',
  };
  const dir = path.join(cwd, mapping[ide]);
  return { dir, path: path.join(dir, 'mcp.json') };
}
```

This is **wrong for Windsurf**. Windsurf uses `mcp_config.json` at `~/.codeium/windsurf/mcp_config.json` (global), NOT `.windsurf/mcp.json` (project-level).

It's also potentially wrong for **Claude Code**, which uses `.mcp.json` at project root (project scope) or `~/.claude.json` (local/user scope), not `.claude/mcp.json`.

### The Deeper Problem
Each IDE has its own config file naming, location, and sometimes different JSON structure. These formats **change over time** as IDEs evolve. Hardcoding them in TypeScript is fragile.

---

## Research Findings: IDE MCP Config Formats

### Definitive Config Map (as of April 2025)

| IDE / Client | Config File Name | Project-Scoped Location | Global/User Location | JSON Root Key | Notes |
|---|---|---|---|---|---|
| **Cursor** | `mcp.json` | `.cursor/mcp.json` | `~/.cursor/mcp.json` | `mcpServers` | Also supports `~/.cursor/mcp.json` global |
| **Windsurf** | `mcp_config.json` | ❌ No project-scoped | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | Global only. Supports env var interpolation `${env:VAR}` |
| **VS Code** | `mcp.json` | `.vscode/mcp.json` | User settings | `mcpServers` (or `servers` inside `mcp` key in settings.json) | Also supports `mcp` section in `settings.json` |
| **Claude Code** | `.mcp.json` | `.mcp.json` (project root) | `~/.claude.json` (under `mcpServers` key) | `mcpServers` | CLI: `claude mcp add`. Project scope is `.mcp.json` at root |
| **Claude Desktop** | `claude_desktop_config.json` | ❌ No project-scoped | `%APPDATA%/Claude/` (Win), `~/Library/Application Support/Claude/` (Mac) | `mcpServers` | Desktop app only |
| **Antigravity** | `mcp.json` | `.antigravity/mcp.json` | TBD | `mcpServers` | Google's IDE, follows standard |
| **Qoder** | `mcp.json` | `.qoder/mcp.json` | TBD | `mcpServers` | Follows standard |
| **JetBrains** | Various | Project-level | Global settings | `mcpServers` | 2025.2+ has built-in MCP support |

---

## Solution: Data-Driven Config Profile System

### Design Principles

1. **Config profiles are data, not code** — stored in a JSON file that can be updated without changing TypeScript
2. **Auto-detect all present IDEs** — don't just write for one, write for ALL detected clients
3. **Support both project-scoped and global-scoped** config locations
4. **Never overwrite user's existing MCP servers** — only merge kw-os managed servers
5. **Mark kw-os managed servers** so we can update them later without touching user's custom servers
6. **Future-proof** — adding a new IDE is adding a JSON entry, not changing code

---

### Step 2.1: IDE Config Profiles Data File

**New file: `config-profiles/ide-profiles.json`**

```json
{
  "$schema": "./ide-profiles.schema.json",
  "version": "1.0.0",
  "profiles": {
    "cursor": {
      "displayName": "Cursor",
      "configLocations": [
        {
          "scope": "project",
          "filePath": ".cursor/mcp.json",
          "relativeTo": "workspace",
          "create": true
        },
        {
          "scope": "global",
          "filePath": ".cursor/mcp.json",
          "relativeTo": "home",
          "create": false
        }
      ],
      "jsonRootKey": "mcpServers",
      "detection": {
        "workspaceDirs": [".cursor"],
        "processNames": ["Cursor", "cursor"],
        "globalDirs": []
      },
      "skillsDir": ".cursor/skills",
      "rulesDir": ".cursor/rules",
      "notes": "Standard mcp.json format"
    },
    "windsurf": {
      "displayName": "Windsurf",
      "configLocations": [
        {
          "scope": "global",
          "filePath": ".codeium/windsurf/mcp_config.json",
          "relativeTo": "home",
          "create": true
        }
      ],
      "jsonRootKey": "mcpServers",
      "detection": {
        "workspaceDirs": [".windsurf"],
        "processNames": ["Windsurf", "windsurf"],
        "globalDirs": [".codeium/windsurf"]
      },
      "skillsDir": ".windsurf/skills",
      "rulesDir": ".windsurf/rules",
      "notes": "Uses mcp_config.json at ~/.codeium/windsurf/. Supports ${env:VAR} interpolation."
    },
    "vscode": {
      "displayName": "VS Code",
      "configLocations": [
        {
          "scope": "project",
          "filePath": ".vscode/mcp.json",
          "relativeTo": "workspace",
          "create": true
        }
      ],
      "jsonRootKey": "mcpServers",
      "detection": {
        "workspaceDirs": [".vscode"],
        "processNames": ["Code", "code"],
        "globalDirs": []
      },
      "skillsDir": ".vscode/skills",
      "rulesDir": ".vscode/rules",
      "notes": "Also supports mcp section in settings.json"
    },
    "claude": {
      "displayName": "Claude Code",
      "configLocations": [
        {
          "scope": "project",
          "filePath": ".mcp.json",
          "relativeTo": "workspace",
          "create": true
        }
      ],
      "jsonRootKey": "mcpServers",
      "detection": {
        "workspaceDirs": [".claude"],
        "processNames": ["claude"],
        "globalDirs": [".claude"],
        "cliCheck": "claude --version"
      },
      "skillsDir": ".claude/skills",
      "rulesDir": ".claude/rules",
      "notes": "Project scope uses .mcp.json at workspace root. User scope uses ~/.claude.json."
    },
    "claude-desktop": {
      "displayName": "Claude Desktop",
      "configLocations": [
        {
          "scope": "global",
          "filePath": "Claude/claude_desktop_config.json",
          "relativeTo": "appdata",
          "create": false
        }
      ],
      "jsonRootKey": "mcpServers",
      "detection": {
        "workspaceDirs": [],
        "processNames": ["Claude"],
        "globalDirs": ["Claude"],
        "globalDirsRelativeTo": "appdata"
      },
      "skillsDir": null,
      "rulesDir": null,
      "notes": "Desktop app. Config at %APPDATA%/Claude/ (Win) or ~/Library/Application Support/Claude/ (Mac)"
    },
    "antigravity": {
      "displayName": "Antigravity",
      "configLocations": [
        {
          "scope": "project",
          "filePath": ".antigravity/mcp.json",
          "relativeTo": "workspace",
          "create": true
        }
      ],
      "jsonRootKey": "mcpServers",
      "detection": {
        "workspaceDirs": [".antigravity"],
        "processNames": ["Antigravity", "antigravity"],
        "globalDirs": []
      },
      "skillsDir": ".antigravity/skills",
      "rulesDir": ".antigravity/rules",
      "notes": "Google's AI IDE. Follows standard mcp.json format."
    },
    "qoder": {
      "displayName": "Qoder",
      "configLocations": [
        {
          "scope": "project",
          "filePath": ".qoder/mcp.json",
          "relativeTo": "workspace",
          "create": true
        }
      ],
      "jsonRootKey": "mcpServers",
      "detection": {
        "workspaceDirs": [".qoder"],
        "processNames": ["Qoder", "qoder"],
        "globalDirs": []
      },
      "skillsDir": ".qoder/skills",
      "rulesDir": ".qoder/rules",
      "notes": "Standard mcp.json format."
    }
  }
}
```

---

### Step 2.2: Config Profile Loader

**New file: `src/core/config-profiles.ts`**

```typescript
export interface ConfigLocation {
  scope: 'project' | 'global';
  filePath: string;
  relativeTo: 'workspace' | 'home' | 'appdata';
  create: boolean;
}

export interface IDEProfile {
  displayName: string;
  configLocations: ConfigLocation[];
  jsonRootKey: string;
  detection: {
    workspaceDirs: string[];
    processNames: string[];
    globalDirs: string[];
    globalDirsRelativeTo?: string;
    cliCheck?: string;
  };
  skillsDir: string | null;
  rulesDir: string | null;
  notes: string;
}

export interface IDEProfiles {
  version: string;
  profiles: Record<string, IDEProfile>;
}

export function loadProfiles(): IDEProfiles { ... }

export function resolveConfigPath(
  location: ConfigLocation,
  cwd: string
): string {
  switch (location.relativeTo) {
    case 'workspace':
      return path.join(cwd, location.filePath);
    case 'home':
      return path.join(os.homedir(), location.filePath);
    case 'appdata':
      return path.join(getAppDataDir(), location.filePath);
  }
}

function getAppDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  return path.join(os.homedir(), '.config');
}
```

---

### Step 2.3: Multi-IDE Detection

**Modify: `src/core/env-check.ts`**

Instead of detecting a single IDE, detect **all** IDEs present:

```typescript
export function detectAllIDEs(cwd: string): DetectedIDE[] {
  const profiles = loadProfiles();
  const detected: DetectedIDE[] = [];

  for (const [id, profile] of Object.entries(profiles.profiles)) {
    let confidence = 0;
    const reasons: string[] = [];

    // Check workspace directories
    for (const dir of profile.detection.workspaceDirs) {
      if (fs.existsSync(path.join(cwd, dir))) {
        confidence += 50;
        reasons.push(`Found ${dir}/ directory`);
      }
    }

    // Check global directories
    for (const dir of profile.detection.globalDirs) {
      const base = profile.detection.globalDirsRelativeTo === 'appdata'
        ? getAppDataDir()
        : os.homedir();
      if (fs.existsSync(path.join(base, dir))) {
        confidence += 30;
        reasons.push(`Found global ${dir}/ directory`);
      }
    }

    // Check existing config files
    for (const loc of profile.configLocations) {
      const configPath = resolveConfigPath(loc, cwd);
      if (fs.existsSync(configPath)) {
        confidence += 40;
        reasons.push(`Found existing ${path.basename(configPath)}`);
      }
    }

    // CLI check (e.g., claude --version)
    if (profile.detection.cliCheck) {
      try {
        execSync(profile.detection.cliCheck, { stdio: 'pipe', timeout: 5000 });
        confidence += 30;
        reasons.push(`CLI available`);
      } catch {}
    }

    if (confidence > 0) {
      detected.push({
        id,
        profile,
        confidence,
        reasons,
      });
    }
  }

  // Sort by confidence descending
  return detected.sort((a, b) => b.confidence - a.confidence);
}
```

---

### Step 2.4: Rewrite Config Generator

**Rewrite: `src/core/config-generator.ts`**

The generator now writes to **all detected IDE config locations**:

```typescript
export class ConfigGenerator {
  private serversDir: string;
  private profiles: IDEProfiles;

  constructor() {
    this.serversDir = getServersDir();
    this.profiles = loadProfiles();
  }

  generateConfig(servers: ServerEntry[]): MCPConfig {
    // Same as before — generates mcpServers record
    const mcpServers: Record<string, MCPServerConfig> = {};
    for (const server of servers) {
      const config = this.serverToMCPConfig(server);
      if (config) mcpServers[server.id] = config;
    }
    return { mcpServers };
  }

  writeConfigForAllIDEs(
    config: MCPConfig,
    detectedIDEs: DetectedIDE[],
    cwd: string,
    primaryIDE?: string
  ): WriteResult[] {
    const results: WriteResult[] = [];

    for (const detected of detectedIDEs) {
      const profile = detected.profile;

      for (const location of profile.configLocations) {
        // Only create new config files for the primary IDE
        // For other IDEs, only update existing files
        if (!location.create && detected.id !== primaryIDE) {
          const configPath = resolveConfigPath(location, cwd);
          if (!fs.existsSync(configPath)) continue;
        }

        try {
          const configPath = this.writeConfigToLocation(config, profile, location, cwd);
          results.push({
            ide: detected.id,
            scope: location.scope,
            path: configPath,
            success: true,
          });
        } catch (err) {
          results.push({
            ide: detected.id,
            scope: location.scope,
            path: resolveConfigPath(location, cwd),
            success: false,
            error: err.message,
          });
        }
      }
    }

    return results;
  }

  private writeConfigToLocation(
    config: MCPConfig,
    profile: IDEProfile,
    location: ConfigLocation,
    cwd: string
  ): string {
    const configPath = resolveConfigPath(location, cwd);
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Merge with existing config
    let finalConfig: any = {};
    if (fs.existsSync(configPath)) {
      try {
        finalConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch {
        // Malformed existing file — start fresh but log warning
        log.warn(`Existing ${path.basename(configPath)} was malformed, creating new`);
      }
    }

    // Get the root key from profile (usually "mcpServers")
    const rootKey = profile.jsonRootKey;

    // Merge: preserve existing servers, add/update kw-os servers
    if (!finalConfig[rootKey]) {
      finalConfig[rootKey] = {};
    }

    // Add kw-os managed servers (with marker comment in server id)
    for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
      finalConfig[rootKey][serverId] = serverConfig;
    }

    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
    return configPath;
  }
}
```

---

### Step 2.5: Update Init Command

**Modify: `src/commands/init.ts`**

```typescript
// Step 3: Generate IDE Config (REWRITTEN)
log.header('Step 3: Generate IDE Configuration');

const detectedIDEs = detectAllIDEs(cwd);
if (detectedIDEs.length === 0) {
  log.warn('No IDE detected. Creating config for specified IDE only.');
}

log.info(`  Detected IDEs: ${detectedIDEs.map(d => d.profile.displayName).join(', ') || 'none'}`);

const configGen = new ConfigGenerator();
const mcpConfig = configGen.generateConfig(servers);

const writeResults = configGen.writeConfigForAllIDEs(
  mcpConfig,
  detectedIDEs.length > 0 ? detectedIDEs : [{ id: ide, profile: profiles.profiles[ide], confidence: 100, reasons: ['--ide flag'] }],
  cwd,
  ide
);

for (const result of writeResults) {
  if (result.success) {
    log.success(`${result.ide} (${result.scope}): ${result.path}`);
  } else {
    log.warn(`${result.ide} (${result.scope}): Failed — ${result.error}`);
  }
}

// Step 4: Install Skills & Rules (for ALL detected IDEs)
log.header('Step 4: Install Skills & Rules');

for (const detected of detectedIDEs) {
  const profile = detected.profile;
  if (profile.skillsDir) {
    const skillCount = installSkills('all', detected.id as IDEType, cwd);
    const ruleInstalled = installMasterRule(detected.id as IDEType, cwd);
    const promptCount = installPrompts(detected.id as IDEType, cwd);
    log.success(`${detected.profile.displayName}: ${skillCount} skills, ${promptCount} prompts${ruleInstalled ? ', master rule' : ''}`);
  }
}
```

---

### Step 2.6: Skill/Rule Dir Resolution from Profiles

**Modify: `src/core/skill-installer.ts`**

Replace hardcoded mappings with profile-driven resolution:

```typescript
function getIDESkillsDir(ide: IDEType, cwd: string): string {
  const profiles = loadProfiles();
  const profile = profiles.profiles[ide];
  if (profile?.skillsDir) {
    return path.join(cwd, profile.skillsDir);
  }
  // Fallback for unknown IDEs
  return path.join(cwd, `.${ide}`, 'skills');
}

function getIDERulesDir(ide: IDEType, cwd: string): string {
  const profiles = loadProfiles();
  const profile = profiles.profiles[ide];
  if (profile?.rulesDir) {
    return path.join(cwd, profile.rulesDir);
  }
  return path.join(cwd, `.${ide}`, 'rules');
}
```

---

## Future-Proofing Strategy

### Why Data-Driven Profiles Work

1. **New IDE support** = add a JSON entry to `ide-profiles.json`. No TypeScript changes.
2. **Config path changes** = update the JSON entry. Ship via `kw-os update`.
3. **Version-specific behavior** = profiles can include version ranges with different config paths.
4. **Community contributions** = PRs to add IDE support are trivial JSON edits.

### Self-Healing Config Detection

If KW-OS detects that it wrote config to the wrong location (e.g., `kw-os status` finds the IDE is running but MCP servers aren't loaded), it can:
1. Check which config files the IDE is actually reading
2. Suggest or auto-fix by moving config to the correct location
3. Update the profile data for future installs

### Profile Updates via `kw-os update`

```typescript
// During kw-os update, check for updated IDE profiles
async function updateProfiles(): Promise<void> {
  // Fetch latest ide-profiles.json from GitHub
  const url = 'https://raw.githubusercontent.com/kw-os/kw-os/main/config-profiles/ide-profiles.json';
  try {
    const response = await fetch(url);
    const latest = await response.json();
    // Compare versions, update if newer
    const current = loadProfiles();
    if (semver.gt(latest.version, current.version)) {
      saveProfiles(latest);
      log.success(`IDE profiles updated: ${current.version} → ${latest.version}`);
    }
  } catch {
    // Non-fatal, use existing profiles
  }
}
```

---

## Files Changed / Created

| File | Action | Description |
|------|--------|-------------|
| `config-profiles/ide-profiles.json` | **New** | Data-driven IDE config profile definitions |
| `src/core/config-profiles.ts` | **New** | Profile loader, path resolver, detection |
| `src/core/config-generator.ts` | **Rewritten** | Multi-IDE config writing using profiles |
| `src/core/env-check.ts` | Modified | `detectAllIDEs()` replaces single IDE detection |
| `src/core/skill-installer.ts` | Modified | Use profile-driven directory resolution |
| `src/commands/init.ts` | Modified | Write config for all detected IDEs |
| `src/types/index.ts` | Modified | Add new types for profiles, detection results |

---

## Testing Checklist

- [ ] Windsurf: config written to `~/.codeium/windsurf/mcp_config.json` (NOT `.windsurf/mcp.json`)
- [ ] Cursor: config written to `.cursor/mcp.json`
- [ ] VS Code: config written to `.vscode/mcp.json`
- [ ] Claude Code: config written to `.mcp.json` at project root
- [ ] Multi-IDE: if both `.cursor/` and `.windsurf/` exist, write config for BOTH
- [ ] Merge: existing user MCP servers in config files are preserved
- [ ] Skills: installed into correct directories for all detected IDEs
- [ ] Global paths: correctly resolve `~`, `%APPDATA%`, `~/Library/Application Support/` per OS
- [ ] Windows paths: handle backslashes and `%USERPROFILE%` correctly
- [ ] New IDE: adding a JSON entry to profiles is sufficient (no code changes needed)
- [ ] Profile update: `kw-os update` can pull latest profile definitions
- [ ] Fallback: if no IDE detected, uses `--ide` flag or defaults gracefully
