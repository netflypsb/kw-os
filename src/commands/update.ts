import fs from 'node:fs';
import { log } from '../utils/logger.js';
import { withSpinner } from '../utils/spinner.js';
import { getConfigPath } from '../utils/platform.js';
import { resolveServerList } from '../core/server-registry.js';
import { ServerInstaller } from '../core/server-installer.js';
import { installSkills, installMasterRule, installPrompts } from '../core/skill-installer.js';
import type { KWOSConfig, IDEType } from '../types/index.js';

export async function updateCommand(): Promise<void> {
  const cwd = process.cwd();
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    log.error('KW-OS is not installed. Run "kw-os init" first.');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as KWOSConfig;
  const ide: IDEType = config.ide;

  log.header('KW-OS Update');

  // Re-install all servers
  const servers = resolveServerList('all');
  const installer = new ServerInstaller();
  let updated = 0;

  for (const server of servers) {
    const success = await withSpinner(
      `Updating ${server.id}`,
      () => installer.installServer(server)
    );
    if (success) updated++;
  }

  // Re-install skills
  installMasterRule(ide, cwd);
  const skillCount = installSkills('all', ide, cwd);
  const promptCount = installPrompts(ide, cwd);

  // Update config timestamp
  config.installedAt = new Date().toISOString();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  log.header('Update Complete');
  log.info(`Servers updated: ${updated}`);
  log.info(`Skills refreshed: ${skillCount}`);
  log.info(`Prompts refreshed: ${promptCount}`);
  console.log();
}
