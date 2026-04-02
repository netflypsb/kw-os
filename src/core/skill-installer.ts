import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IDEType, SkillMeta } from '../types/index.js';
import { log } from '../utils/logger.js';
import { getProfileSkillsDir, getProfileRulesDir } from './config-profiles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSkillsSourceDir(): string {
  // Navigate from dist/core/ up to project root, then into skills/
  return path.resolve(__dirname, '..', '..', 'skills');
}

function getPromptsSourceDir(): string {
  return path.resolve(__dirname, '..', '..', 'prompts');
}

function getRulesSourceDir(): string {
  return path.resolve(__dirname, '..', '..', 'templates', 'rules');
}

export function listAvailableSkills(): SkillMeta[] {
  const skillsDir = getSkillsSourceDir();
  if (!fs.existsSync(skillsDir)) return [];

  const files = fs.readdirSync(skillsDir).filter((f: string) => f.endsWith('.md'));
  return files.map((f: string) => {
    const content = fs.readFileSync(path.join(skillsDir, f), 'utf-8');
    return parseSkillMeta(f, content);
  });
}

function parseSkillMeta(filename: string, content: string): SkillMeta {
  const id = filename.replace('.md', '');
  const meta: SkillMeta = {
    id,
    name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: '',
    category: 'knowledge-work',
    tools: [],
    triggers: [],
  };

  // Parse YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const lines = fm.split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (!key || !value) continue;

      switch (key.trim()) {
        case 'id': meta.id = value; break;
        case 'name': meta.name = value; break;
        case 'description': meta.description = value; break;
        case 'category': meta.category = value; break;
        case 'tools': meta.tools = parseYamlArray(value); break;
        case 'triggers': meta.triggers = parseYamlArray(value); break;
      }
    }
  }

  return meta;
}

function parseYamlArray(value: string): string[] {
  // Handle [a, b, c] format
  const match = value.match(/\[(.*)\]/);
  if (match) {
    return match[1].split(',').map(s => s.trim()).filter(Boolean);
  }
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function getIDESkillsDir(ide: IDEType, cwd: string): string {
  // Try profile-driven resolution first
  const profileDir = getProfileSkillsDir(ide, cwd);
  if (profileDir) return profileDir;

  // Fallback to hardcoded mapping
  const mapping: Record<IDEType, string> = {
    cursor: '.cursor/skills',
    windsurf: '.windsurf/skills',
    vscode: '.vscode/skills',
    claude: '.claude/skills',
    antigravity: '.antigravity/skills',
    qoder: '.qoder/skills',
  };
  return path.join(cwd, mapping[ide]);
}

function getIDERulesDir(ide: IDEType, cwd: string): string {
  // Try profile-driven resolution first
  const profileDir = getProfileRulesDir(ide, cwd);
  if (profileDir) return profileDir;

  // Fallback to hardcoded mapping
  const mapping: Record<IDEType, string> = {
    cursor: '.cursor/rules',
    windsurf: '.windsurf/rules',
    vscode: '.vscode/rules',
    claude: '.claude/rules',
    antigravity: '.antigravity/rules',
    qoder: '.qoder/rules',
  };
  return path.join(cwd, mapping[ide]);
}

export function installSkills(skillFilter: string, ide: IDEType, cwd: string): number {
  const skillsDir = getIDESkillsDir(ide, cwd);
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  const sourceDir = getSkillsSourceDir();
  if (!fs.existsSync(sourceDir)) {
    log.warn('No skills found in package');
    return 0;
  }

  const files = fs.readdirSync(sourceDir).filter((f: string) => f.endsWith('.md'));
  let installed = 0;

  for (const file of files) {
    const skillId = file.replace('.md', '');

    if (skillFilter !== 'all' && skillFilter !== 'none') {
      const requested = skillFilter.split(',').map(s => s.trim());
      if (!requested.includes(skillId)) continue;
    }
    if (skillFilter === 'none') continue;

    const src = path.join(sourceDir, file);
    const dest = path.join(skillsDir, file);
    fs.copyFileSync(src, dest);
    installed++;
  }

  return installed;
}

export function installMasterRule(ide: IDEType, cwd: string): boolean {
  const rulesDir = getIDERulesDir(ide, cwd);
  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  const sourceDir = getRulesSourceDir();
  const masterRule = path.join(sourceDir, 'master-knowledge-worker.md');
  if (!fs.existsSync(masterRule)) {
    log.warn('Master knowledge worker rule not found in package');
    return false;
  }

  const dest = path.join(rulesDir, 'kw-os-knowledge-worker.md');
  fs.copyFileSync(masterRule, dest);
  return true;
}

export function installPrompts(ide: IDEType, cwd: string): number {
  const promptsSourceDir = getPromptsSourceDir();
  if (!fs.existsSync(promptsSourceDir)) return 0;

  const promptsDestDir = path.join(getIDESkillsDir(ide, cwd), '..', 'prompts');
  if (!fs.existsSync(promptsDestDir)) {
    fs.mkdirSync(promptsDestDir, { recursive: true });
  }

  const files = fs.readdirSync(promptsSourceDir).filter((f: string) => f.endsWith('.md'));
  let installed = 0;

  for (const file of files) {
    fs.copyFileSync(
      path.join(promptsSourceDir, file),
      path.join(promptsDestDir, file)
    );
    installed++;
  }

  return installed;
}
