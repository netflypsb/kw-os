import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import which from 'which';
import semver from 'semver';
import type { EnvironmentStatus, DependencyCheck, IDEDetection, IDEType } from '../types/index.js';
import { getKWOSDir } from '../utils/platform.js';
import {
  loadProfiles,
  resolveConfigPath,
  resolveDetectionDir,
  getAppDataDir,
  type DetectedIDE,
} from './config-profiles.js';

const MIN_NODE = '18.0.0';
const MIN_PYTHON = '3.10.0';

function checkCommand(cmd: string, versionFlag = '--version'): DependencyCheck {
  try {
    const resolvedPath = which.sync(cmd, { nothrow: true });
    if (!resolvedPath) {
      return { installed: false, version: null, path: null, meetsMinimum: false };
    }
    const raw = execSync(`${cmd} ${versionFlag}`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const match = raw.match(/(\d+\.\d+\.\d+)/);
    const version = match ? match[1] : raw;
    return { installed: true, version, path: resolvedPath, meetsMinimum: true };
  } catch {
    return { installed: false, version: null, path: null, meetsMinimum: false };
  }
}

function checkNode(): DependencyCheck {
  const result = checkCommand('node');
  if (result.installed && result.version) {
    result.meetsMinimum = semver.gte(result.version, MIN_NODE);
  }
  return result;
}

function checkPython(): DependencyCheck {
  // Try python3 first, then python
  let result = checkCommand('python3');
  if (!result.installed) {
    result = checkCommand('python');
  }
  if (result.installed && result.version) {
    result.meetsMinimum = semver.gte(result.version, MIN_PYTHON);
  }
  return result;
}

function checkPip(): DependencyCheck {
  let result = checkCommand('pip3');
  if (!result.installed) {
    result = checkCommand('pip');
  }
  return result;
}

function checkGit(): DependencyCheck {
  return checkCommand('git');
}

interface IDEConfig {
  type: IDEType;
  dirName: string;
  configFile: string;
}

const IDE_CONFIGS: IDEConfig[] = [
  { type: 'cursor', dirName: '.cursor', configFile: 'mcp.json' },
  { type: 'windsurf', dirName: '.windsurf', configFile: 'mcp.json' },
  { type: 'vscode', dirName: '.vscode', configFile: 'mcp.json' },
  { type: 'antigravity', dirName: '.antigravity', configFile: 'mcp.json' },
  { type: 'qoder', dirName: '.qoder', configFile: 'mcp.json' },
];

function detectIDE(cwd: string): IDEDetection {
  // Check workspace config directories
  for (const ide of IDE_CONFIGS) {
    const dirPath = path.join(cwd, ide.dirName);
    if (fs.existsSync(dirPath)) {
      return {
        type: ide.type,
        detected: true,
        configDir: dirPath,
        configPath: path.join(dirPath, ide.configFile),
      };
    }
  }

  // Check for Claude Code CLI
  const claudePath = which.sync('claude', { nothrow: true });
  if (claudePath) {
    const configDir = path.join(cwd, '.claude');
    return {
      type: 'claude',
      detected: true,
      configDir,
      configPath: path.join(configDir, 'mcp.json'),
    };
  }

  return { type: null, detected: false, configDir: null, configPath: null };
}

function checkUv(): DependencyCheck {
  let result = checkCommand('uvx');
  if (!result.installed) {
    result = checkCommand('uv');
  }
  return result;
}

export function checkEnvironment(cwd: string): EnvironmentStatus {
  const kwosDir = getKWOSDir();
  return {
    node: checkNode(),
    python: checkPython(),
    pip: checkPip(),
    uv: checkUv(),
    git: checkGit(),
    ide: detectIDE(cwd),
    existingInstall: fs.existsSync(kwosDir),
  };
}

/**
 * Detect ALL IDEs present in the workspace and globally.
 * Returns an array of detected IDEs sorted by confidence (highest first).
 * Uses data-driven IDE profiles rather than hardcoded paths.
 */
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
        reasons.push(`Found ${dir}/ in workspace`);
      }
    }

    // Check global directories
    for (const dir of profile.detection.globalDirs) {
      const resolved = resolveDetectionDir(
        dir,
        profile.detection.globalDirsRelativeTo,
        cwd
      );
      if (fs.existsSync(resolved)) {
        confidence += 30;
        reasons.push(`Found global ${dir}/`);
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
        execSync(profile.detection.cliCheck, {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        confidence += 30;
        reasons.push('CLI available');
      } catch {
        // CLI not found — not an error
      }
    }

    if (confidence > 0) {
      detected.push({ id, profile, confidence, reasons });
    }
  }

  // Sort by confidence descending
  return detected.sort((a, b) => b.confidence - a.confidence);
}

export function validateEnvironment(env: EnvironmentStatus): string[] {
  const errors: string[] = [];

  if (!env.node.installed) {
    errors.push('Node.js is not installed. Install from https://nodejs.org (v18+)');
  } else if (!env.node.meetsMinimum) {
    errors.push(`Node.js ${env.node.version} found but >= ${MIN_NODE} required`);
  }

  if (!env.python.installed) {
    errors.push('Python is not installed. Install from https://python.org (v3.10+)');
  } else if (!env.python.meetsMinimum) {
    errors.push(`Python ${env.python.version} found but >= ${MIN_PYTHON} required`);
  }

  if (!env.pip.installed) {
    errors.push('pip is not installed. Run: python -m ensurepip --upgrade');
  }

  if (!env.git.installed) {
    errors.push('Git is not installed. Install from https://git-scm.com');
  }

  return errors;
}
