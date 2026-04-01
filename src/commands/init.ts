import type { InitOptions, IDEType } from '../types/index.js';
import { log } from '../utils/logger.js';
import { withSpinner } from '../utils/spinner.js';
import { getKWOSDir, getConfigPath } from '../utils/platform.js';
import { checkEnvironment, validateEnvironment } from '../core/env-check.js';
import { resolveServerList } from '../core/server-registry.js';
import { ServerInstaller } from '../core/server-installer.js';
import { ConfigGenerator } from '../core/config-generator.js';
import { installSkills, installMasterRule, installPrompts } from '../core/skill-installer.js';
import fs from 'node:fs';
import type { KWOSConfig } from '../types/index.js';

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  log.header('KW-OS — Knowledge Worker Operating System');
  log.dim('Zero API keys. Zero subscriptions. Fully local.\n');

  // Step 1: Environment Check
  log.header('Step 1: Environment Check');
  const env = checkEnvironment(cwd);

  log.table('Node.js', env.node.version || 'not found', env.node.installed && env.node.meetsMinimum);
  log.table('Python', env.python.version || 'not found', env.python.installed && env.python.meetsMinimum);
  log.table('pip', env.pip.version || 'not found', env.pip.installed);
  log.table('Git', env.git.version || 'not found', env.git.installed);
  log.table('IDE', env.ide.type || 'not detected', env.ide.detected);

  if (env.existingInstall) {
    log.dim('  Existing KW-OS installation detected — will upgrade');
  }

  const errors = validateEnvironment(env);
  if (errors.length > 0) {
    log.header('Missing Requirements');
    for (const err of errors) {
      log.error(err);
    }
    log.info('\nPlease install the missing dependencies and run kw-os init again.');
    process.exit(1);
  }

  // Resolve IDE
  const ide: IDEType = options.ide || env.ide.type || 'cursor';
  log.success(`Target IDE: ${ide}`);

  // Step 2: Install MCP Servers
  log.header('Step 2: Install MCP Servers');

  const serverFilter = options.servers || 'all';
  let servers = resolveServerList(serverFilter);

  // Filter out browser servers if --no-browser
  if (options.browser === false) {
    servers = servers.filter(s => s.category !== 'browser');
    log.dim('  Browser automation skipped (--no-browser)');
  }

  const installer = new ServerInstaller();
  await installer.ensureDirectories();

  let installed = 0;
  let failed = 0;

  for (const server of servers) {
    const success = await withSpinner(
      `Installing ${server.id} (${server.category}/${server.type})`,
      () => installer.installServer(server)
    );
    if (success) {
      installed++;
    } else {
      failed++;
    }
  }

  log.info(`\n  Servers: ${installed} installed, ${failed} failed`);

  // Step 3: Generate IDE Config
  log.header('Step 3: Generate IDE Configuration');

  const configGen = new ConfigGenerator();
  const mcpConfig = configGen.generateConfig(servers);
  const configPath = configGen.writeConfig(mcpConfig, ide, cwd);
  log.success(`MCP config written to ${configPath}`);

  // Step 4: Install Skills & Rules
  log.header('Step 4: Install Skills & Rules');

  const skillFilter = options.skills || 'all';
  const masterInstalled = installMasterRule(ide, cwd);
  if (masterInstalled) {
    log.success('Master Knowledge Worker rule installed');
  }

  const skillCount = installSkills(skillFilter, ide, cwd);
  log.success(`${skillCount} professional skills installed`);

  const promptCount = installPrompts(ide, cwd);
  log.success(`${promptCount} prompt templates installed`);

  // Step 5: Save Config
  const kwosConfig: KWOSConfig = {
    version: '1.0.0',
    installedAt: new Date().toISOString(),
    ide,
    servers: servers.map(s => s.id),
    skills: [], // Will be populated from installed skills
    installDir: getKWOSDir(),
  };

  const configDir = getKWOSDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(kwosConfig, null, 2));

  // Done
  log.header('KW-OS Initialized Successfully!');
  log.info(`IDE:      ${ide}`);
  log.info(`Servers:  ${installed} installed`);
  log.info(`Skills:   ${skillCount} skills + ${promptCount} prompts`);
  log.info(`Config:   ${configPath}`);
  log.dim('\nYour IDE is now a Knowledge Worker. Restart your IDE to load the new MCP servers.');
  log.dim('Run "kw-os status" to check installation health.\n');
}
