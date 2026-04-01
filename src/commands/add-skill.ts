import fs from 'node:fs';
import { log } from '../utils/logger.js';
import { getConfigPath } from '../utils/platform.js';
import { installSkills } from '../core/skill-installer.js';
import type { KWOSConfig, IDEType } from '../types/index.js';

export async function addSkillCommand(skillName: string): Promise<void> {
  const cwd = process.cwd();
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    log.error('KW-OS is not installed. Run "kw-os init" first.');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as KWOSConfig;
  const ide: IDEType = config.ide;

  const count = installSkills(skillName, ide, cwd);
  if (count > 0) {
    log.success(`Installed ${count} skill(s): ${skillName}`);
  } else {
    log.error(`Skill "${skillName}" not found. Run "kw-os list-skills" to see available skills.`);
  }
}
