import fs from 'node:fs';
import { log } from '../utils/logger.js';
import { getConfigPath, getKWOSDir } from '../utils/platform.js';
import { checkEnvironment } from '../core/env-check.js';
import { getAllServers } from '../core/server-registry.js';
import { checkAllServers } from '../core/health-check.js';
import type { KWOSConfig } from '../types/index.js';

export async function statusCommand(): Promise<void> {
  log.header('KW-OS Status Report');

  const cwd = process.cwd();
  const configPath = getConfigPath();

  // Check if KW-OS is installed
  if (!fs.existsSync(configPath)) {
    log.error('KW-OS is not installed. Run "kw-os init" first.');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as KWOSConfig;
  log.info(`Version:    ${config.version}`);
  log.info(`Installed:  ${config.installedAt}`);
  log.info(`IDE:        ${config.ide}`);
  log.info(`Install Dir: ${config.installDir}`);

  // Environment
  log.header('Environment');
  const env = checkEnvironment(cwd);
  log.table('Node.js', env.node.version || 'missing', env.node.installed && env.node.meetsMinimum);
  log.table('Python', env.python.version || 'missing', env.python.installed && env.python.meetsMinimum);
  log.table('pip', env.pip.version || 'missing', env.pip.installed);
  log.table('Git', env.git.version || 'missing', env.git.installed);
  log.table('IDE', env.ide.type || 'not detected', env.ide.detected);

  // Servers
  log.header('MCP Servers');
  const allServers = getAllServers();
  const statuses = await checkAllServers(allServers);

  let healthy = 0;
  let unhealthy = 0;

  for (const status of statuses) {
    const ok = status.installed && status.healthy;
    const detail = status.error || status.version || 'ok';
    log.table(status.id, detail, ok);
    if (ok) healthy++;
    else unhealthy++;
  }

  console.log();
  log.info(`  Total: ${statuses.length} servers | ${healthy} healthy | ${unhealthy} issues`);
  console.log();
}
