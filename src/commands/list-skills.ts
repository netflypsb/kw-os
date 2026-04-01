import chalk from 'chalk';
import { log } from '../utils/logger.js';
import { listAvailableSkills } from '../core/skill-installer.js';

export async function listSkillsCommand(): Promise<void> {
  log.header('Available KW-OS Skills');

  const skills = listAvailableSkills();

  if (skills.length === 0) {
    log.warn('No skills found. Skills will be available after package is built.');
    return;
  }

  for (const skill of skills) {
    const tools = skill.tools.length > 0 ? chalk.dim(` [${skill.tools.join(', ')}]`) : '';
    console.log(`  ${chalk.bold(skill.name.padEnd(28))} ${skill.description}${tools}`);
  }

  console.log();
  log.info(`${skills.length} skills available. Use "kw-os add-skill <name>" to install individually.`);
  console.log();
}
