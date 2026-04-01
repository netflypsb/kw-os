import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { addSkillCommand } from './commands/add-skill.js';
import { updateCommand } from './commands/update.js';
import { listSkillsCommand } from './commands/list-skills.js';
import { doctorCommand } from './commands/doctor.js';

export const program = new Command();

program
  .name('kw-os')
  .description('Knowledge Worker Operating System — turn any IDE into an AI-powered knowledge worker')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize KW-OS in current workspace')
  .option('--ide <type>', 'Target IDE: cursor|windsurf|vscode|claude|antigravity|qoder')
  .option('--servers <list>', 'Server categories: all|core|browser|office|data|finance|research', 'all')
  .option('--skills <list>', 'Skills to install: all|none|comma-separated names', 'all')
  .option('--no-browser', 'Skip browser automation setup')
  .action(initCommand);

program
  .command('status')
  .description('Show installation health report')
  .action(statusCommand);

program
  .command('add-skill <name>')
  .description('Install a specific professional skill')
  .action(addSkillCommand);

program
  .command('update')
  .description('Update all installed servers and skills')
  .action(updateCommand);

program
  .command('list-skills')
  .description('List available professional skills')
  .action(listSkillsCommand);

program
  .command('doctor')
  .description('Diagnose and fix common issues')
  .action(doctorCommand);
