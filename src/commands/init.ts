import type { InitOptions, IDEType } from '../types/index.js';
import { log } from '../utils/logger.js';
import { withSpinner } from '../utils/spinner.js';
import { getKWOSDir, getConfigPath } from '../utils/platform.js';
import { checkEnvironment, validateEnvironment, detectAllIDEs } from '../core/env-check.js';
import { resolveServerList } from '../core/server-registry.js';
import { ServerInstaller } from '../core/server-installer.js';
import { ConfigGenerator } from '../core/config-generator.js';
import { installSkills, installMasterRule, installPrompts } from '../core/skill-installer.js';
import { getProfile } from '../core/config-profiles.js';
import { LocalEmbedder } from '../document/embedder.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  log.table('uv/uvx', env.uv.version || 'not found', env.uv.installed);
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

  // Step 3: Generate IDE Configuration (multi-IDE aware)
  log.header('Step 3: Generate IDE Configuration');

  const detectedIDEs = detectAllIDEs(cwd);
  if (detectedIDEs.length > 0) {
    log.info(`  Detected IDEs: ${detectedIDEs.map(d => `${d.profile.displayName} (${d.confidence}%)`).join(', ')}`);
  } else {
    log.dim(`  No IDEs auto-detected. Using --ide flag or default: ${ide}`);
  }

  const configGen = new ConfigGenerator();
  const mcpConfig = configGen.generateConfig(servers);

  // Inject kw-os-documents MCP server with resolved path
  const mcpServerPath = resolveMCPServerPath();
  const dbPath = path.join(getKWOSDir(), 'documents.db');
  mcpConfig.mcpServers['kw-os-documents'] = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      KWOS_DB_PATH: dbPath,
      KWOS_OLLAMA_URL: 'http://localhost:11434',
    },
  };

  // If IDEs were detected, write config to all of them
  // Otherwise fall back to primary IDE only
  let configPaths: string[] = [];
  if (detectedIDEs.length > 0) {
    // Ensure the primary IDE is in the detected list
    const primaryInDetected = detectedIDEs.some(d => d.id === ide);
    if (!primaryInDetected) {
      const primaryProfile = getProfile(ide);
      if (primaryProfile) {
        detectedIDEs.push({ id: ide, profile: primaryProfile, confidence: 100, reasons: ['--ide flag'] });
      }
    }

    const results = configGen.writeConfigForAllIDEs(mcpConfig, detectedIDEs, cwd, ide);
    for (const result of results) {
      if (result.success) {
        log.success(`  ${result.ide} (${result.scope}): ${result.path}`);
        configPaths.push(result.path);
      } else {
        log.warn(`  ${result.ide} (${result.scope}): Failed — ${result.error}`);
      }
    }
  } else {
    const singlePath = configGen.writeConfig(mcpConfig, ide, cwd);
    log.success(`MCP config written to ${singlePath}`);
    configPaths.push(singlePath);
  }

  // Step 4: Install Skills & Rules (for all detected IDEs with skill dirs)
  log.header('Step 4: Install Skills & Rules');

  let totalSkills = 0;
  let totalPrompts = 0;

  // Build list of IDEs to install skills for
  const ideTargets: { id: string; displayName: string }[] = [];
  if (detectedIDEs.length > 0) {
    for (const detected of detectedIDEs) {
      if (detected.profile.skillsDir) {
        ideTargets.push({ id: detected.id, displayName: detected.profile.displayName });
      }
    }
  }
  // Ensure primary IDE is always included
  if (!ideTargets.some(t => t.id === ide)) {
    const primaryProfile = getProfile(ide);
    const displayName = primaryProfile?.displayName || ide;
    ideTargets.push({ id: ide, displayName });
  }

  for (const target of ideTargets) {
    const targetIde = target.id as IDEType;
    const masterInstalled = installMasterRule(targetIde, cwd);
    const skillCount = installSkills('all', targetIde, cwd);
    const promptCount = installPrompts(targetIde, cwd);
    totalSkills += skillCount;
    totalPrompts += promptCount;
    log.success(`  ${target.displayName}: ${skillCount} skills, ${promptCount} prompts${masterInstalled ? ', master rule' : ''}`);
  }

  // Step 5: Document Intelligence Setup
  log.header('Step 5: Document Intelligence');

  // Ensure DB directory exists
  const dbDir = getKWOSDir();
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  log.success(`  Database: ${dbPath}`);
  log.success(`  MCP server: kw-os-documents`);

  // Check Ollama availability for embeddings
  const embedder = new LocalEmbedder();
  const ollamaAvailable = await embedder.isAvailable().catch(() => false);
  if (ollamaAvailable) {
    log.success(`  Ollama: available (${embedder.model} model ready)`);
    log.dim('  → Full hybrid search enabled (vector + keyword + knowledge graph)');
  } else {
    log.warn('  Ollama: not detected');
    log.dim('  → Keyword search (BM25) will be used. For semantic search, install Ollama:');
    log.dim('    https://ollama.com → then run: ollama pull nomic-embed-text');
  }

  // Step 6: Save Config
  const kwosConfig: KWOSConfig = {
    version: '2.0.0',
    installedAt: new Date().toISOString(),
    ide,
    servers: servers.map(s => s.id),
    skills: [],
    installDir: getKWOSDir(),
  };

  const configDir = getKWOSDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(kwosConfig, null, 2));

  // Done
  log.header('KW-OS Initialized Successfully!');
  log.info(`IDE:      ${ide} (primary)${detectedIDEs.length > 1 ? ` + ${detectedIDEs.length - 1} other(s)` : ''}`);
  log.info(`Servers:  ${installed} installed + kw-os-documents`);
  log.info(`Skills:   ${totalSkills} skills + ${totalPrompts} prompts (across ${ideTargets.length} IDE(s))`);
  log.info(`DocIntel: ${ollamaAvailable ? 'Full (vector + keyword + graph)' : 'BM25 keyword search (install Ollama for full)'}`);
  log.info(`Configs:  ${configPaths.join(', ')}`);
  log.dim('\nYour IDE is now a Knowledge Worker. Restart your IDE to load the new MCP servers.');
  log.dim('Run "kw-os status" to check installation health.\n');
}

/**
 * Resolve the absolute path to the compiled mcp-server.js.
 * Works both when running from source (dev) and when installed as a package.
 */
function resolveMCPServerPath(): string {
  // Try to find relative to this file's location
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const distDir = path.dirname(path.dirname(thisFile)); // dist/commands -> dist
    const candidate = path.join(distDir, 'document', 'mcp-server.js');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  } catch {
    // fileURLToPath may fail in some environments
  }

  // Fallback: resolve from package location
  const packageDir = path.resolve(__dirname, '..', '..');
  return path.join(packageDir, 'dist', 'document', 'mcp-server.js');
}
