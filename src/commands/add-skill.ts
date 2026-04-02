import fs from 'node:fs';
import path from 'node:path';
import { log } from '../utils/logger.js';
import { getConfigPath } from '../utils/platform.js';
import { installSkills, getIDESkillsDir } from '../core/skill-installer.js';
import {
  detectSkillSource,
  fetchFromGitHub,
  fetchFromURL,
  fetchFromLocal,
} from '../core/skill-fetcher.js';
import { validateSkill } from '../core/skill-validator.js';
import { addToManifest } from '../core/skill-manifest.js';
import type { KWOSConfig, IDEType, FetchedSkill, AddSkillOptions } from '../types/index.js';

export async function addSkillCommand(
  source: string,
  options: AddSkillOptions = {}
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
  log.dim(`  Source type: ${skillSource.type}`);

  // Handle built-in skills with the existing installer
  if (skillSource.type === 'builtin') {
    const count = installSkills(skillSource.name, ide, cwd);
    if (count > 0) {
      log.success(`Installed ${count} built-in skill(s): ${skillSource.name}`);
    } else {
      log.error(`Built-in skill "${skillSource.name}" not found. Run "kw-os list-skills" to see available skills.`);
    }
    return;
  }

  // Fetch external skills
  let fetchedSkills: FetchedSkill[];

  try {
    switch (skillSource.type) {
      case 'github':
        fetchedSkills = await fetchFromGitHub(skillSource);
        break;
      case 'url':
        fetchedSkills = await fetchFromURL(skillSource);
        break;
      case 'local':
        fetchedSkills = await fetchFromLocal(skillSource);
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Failed to fetch skill: ${msg}`);
    return;
  }

  if (fetchedSkills.length === 0) {
    log.error('No valid skill files found at the specified source.');
    return;
  }

  log.info(`  Found ${fetchedSkills.length} skill(s)`);

  // Validate and install each skill
  const skillsDir = getIDESkillsDir(ide, cwd);
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  let installed = 0;
  const installedSkills: FetchedSkill[] = [];

  for (const skill of fetchedSkills) {
    const validation = validateSkill(skill.content);

    if (!validation.valid) {
      log.warn(`  Skipping ${skill.filename}: ${validation.warnings.join(', ')}`);
      continue;
    }

    if (!validation.safe) {
      log.warn(`  Warning for ${skill.filename}:`);
      for (const w of validation.warnings) {
        log.warn(`    - ${w}`);
      }
      if (!options.force) {
        log.warn(`  Skipping. Use --force to install anyway.`);
        continue;
      }
      log.dim(`  Installing anyway (--force)`);
    }

    const dest = path.join(skillsDir, skill.filename);

    if (options.dryRun) {
      log.info(`  [dry-run] Would install: ${skill.filename}`);
      installed++;
      continue;
    }

    if (fs.existsSync(dest) && !options.force) {
      log.dim(`  Skipping ${skill.filename} (already exists, use --force to overwrite)`);
      continue;
    }

    fs.writeFileSync(dest, skill.content, 'utf-8');
    installedSkills.push(skill);
    installed++;
    log.success(`  Installed: ${skill.filename}`);
  }

  // Update manifest
  if (installedSkills.length > 0 && !options.dryRun) {
    addToManifest(installedSkills, skillSource.type);
  }

  if (installed > 0) {
    log.info(`\n  ${installed} skill(s) installed from ${skillSource.type} source`);
  } else {
    log.warn('\n  No skills were installed.');
  }
}
