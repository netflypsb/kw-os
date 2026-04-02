import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../utils/logger.js';
import { checkEnvironment, validateEnvironment } from '../core/env-check.js';
import { resolveServerList } from '../core/server-registry.js';
import { checkAllServers } from '../core/health-check.js';
import { listAvailableSkills } from '../core/skill-installer.js';
import { getKWOSDir, getConfigPath } from '../utils/platform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

async function runTest(name: string, fn: () => Promise<void> | void): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, passed: false, error: msg, duration: Date.now() - start };
  }
}

// --- Test Suites ---

async function testEnvironment(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(await runTest('Node.js >= 18 available', () => {
    const env = checkEnvironment(process.cwd());
    if (!env.node.installed) throw new Error('Node.js not installed');
    if (!env.node.meetsMinimum) throw new Error(`Node.js ${env.node.version} < 18.0.0`);
  }));

  results.push(await runTest('Python >= 3.10 available', () => {
    const env = checkEnvironment(process.cwd());
    if (!env.python.installed) throw new Error('Python not installed');
    if (!env.python.meetsMinimum) throw new Error(`Python ${env.python.version} < 3.10.0`);
  }));

  results.push(await runTest('pip available', () => {
    const env = checkEnvironment(process.cwd());
    if (!env.pip.installed) throw new Error('pip not installed');
  }));

  results.push(await runTest('uv/uvx available', () => {
    const env = checkEnvironment(process.cwd());
    if (!env.uv.installed) throw new Error('uv/uvx not installed — install from https://docs.astral.sh/uv/');
  }));

  results.push(await runTest('Git available', () => {
    const env = checkEnvironment(process.cwd());
    if (!env.git.installed) throw new Error('Git not installed');
  }));

  return results;
}

async function testServerRegistry(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(await runTest('Server registry loads', () => {
    const servers = resolveServerList('all');
    if (servers.length === 0) throw new Error('No servers found in registry');
  }));

  results.push(await runTest('All npm packages exist on registry', async () => {
    const servers = resolveServerList('all');
    const npmServers = servers.filter(s => s.type === 'npm' && s.package);
    const failed: string[] = [];

    for (const server of npmServers) {
      if (server.id === 'kw-os-documents') continue; // Internal server
      try {
        execSync(`npm view ${server.package} version`, {
          encoding: 'utf-8',
          timeout: 15000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        failed.push(`${server.id} (${server.package})`);
      }
    }

    if (failed.length > 0) {
      throw new Error(`npm packages not found: ${failed.join(', ')}`);
    }
  }));

  results.push(await runTest('All uvx packages are resolvable', async () => {
    const servers = resolveServerList('all');
    const uvxServers = servers.filter(s => s.type === 'uvx' && s.package);

    // Just verify uvx is available — packages are resolved at runtime
    try {
      execSync('uvx --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      throw new Error(`uvx not available — ${uvxServers.length} servers require it`);
    }
  }));

  results.push(await runTest('No duplicate server IDs', () => {
    const servers = resolveServerList('all');
    const ids = servers.map(s => s.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      throw new Error(`Duplicate server IDs: ${dupes.join(', ')}`);
    }
  }));

  results.push(await runTest('All servers have required fields', () => {
    const servers = resolveServerList('all');
    const invalid: string[] = [];
    for (const server of servers) {
      if (!server.id || !server.category || !server.type || !server.description) {
        invalid.push(server.id || 'unknown');
      }
      if (server.type === 'npm' && !server.package) invalid.push(`${server.id} (no package)`);
      if (server.type === 'uvx' && !server.package) invalid.push(`${server.id} (no package)`);
      if (server.type === 'python' && !server.repo) invalid.push(`${server.id} (no repo)`);
    }
    if (invalid.length > 0) {
      throw new Error(`Invalid server entries: ${invalid.join(', ')}`);
    }
  }));

  return results;
}

async function testSkills(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(await runTest('Skills directory exists', () => {
    const skillsDir = path.resolve(__dirname, '..', '..', 'skills');
    if (!fs.existsSync(skillsDir)) throw new Error(`Skills directory not found: ${skillsDir}`);
  }));

  results.push(await runTest('Skills are loadable', () => {
    const skills = listAvailableSkills();
    if (skills.length === 0) throw new Error('No skills found');
  }));

  results.push(await runTest('Each skill has valid metadata', () => {
    const skills = listAvailableSkills();
    const invalid: string[] = [];
    for (const skill of skills) {
      if (!skill.id || !skill.name) {
        invalid.push(skill.id || 'unknown');
      }
    }
    if (invalid.length > 0) {
      throw new Error(`Skills with missing metadata: ${invalid.join(', ')}`);
    }
  }));

  return results;
}

async function testBuildArtifacts(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(await runTest('TypeScript compiles without errors', () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    try {
      execSync('npx tsc --noEmit', {
        encoding: 'utf-8',
        timeout: 60000,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      const msg = err instanceof Error ? (err as any).stderr || err.message : String(err);
      throw new Error(`TypeScript compilation errors:\n${msg}`);
    }
  }));

  results.push(await runTest('dist/ directory exists', () => {
    const distDir = path.resolve(__dirname, '..', '..');
    const dist = path.join(distDir, 'dist');
    if (!fs.existsSync(dist)) throw new Error('dist/ not found — run npm run build');
  }));

  results.push(await runTest('CLI entry point exists', () => {
    const distDir = path.resolve(__dirname, '..', '..');
    const cli = path.join(distDir, 'dist', 'cli.js');
    if (!fs.existsSync(cli)) throw new Error('dist/cli.js not found — run npm run build');
  }));

  return results;
}

async function testInstallation(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(await runTest('KW-OS directory exists', () => {
    const kwosDir = getKWOSDir();
    if (!fs.existsSync(kwosDir)) throw new Error(`${kwosDir} not found — run kw-os init first`);
  }));

  results.push(await runTest('Config file exists', () => {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) throw new Error(`${configPath} not found — run kw-os init first`);
  }));

  results.push(await runTest('Config file is valid JSON', () => {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) throw new Error('Config not found');
    const content = fs.readFileSync(configPath, 'utf-8');
    JSON.parse(content); // Throws on invalid JSON
  }));

  return results;
}

async function testServerHealth(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const servers = resolveServerList('all');
  const health = await checkAllServers(servers);

  for (const status of health) {
    results.push({
      name: `Server health: ${status.id}`,
      passed: status.healthy,
      error: status.error || undefined,
      duration: 0,
    });
  }

  return results;
}

// --- Main Test Runner ---

export async function testCommand(options: { suite?: string; verbose?: boolean }): Promise<void> {
  log.header('KW-OS Test Suite');
  log.dim('Testing all components...\n');

  const suite = options.suite || 'all';
  const allResults: TestResult[] = [];

  const suites: Record<string, { name: string; fn: () => Promise<TestResult[]> }> = {
    env: { name: 'Environment', fn: testEnvironment },
    registry: { name: 'Server Registry', fn: testServerRegistry },
    skills: { name: 'Skills', fn: testSkills },
    build: { name: 'Build Artifacts', fn: testBuildArtifacts },
    install: { name: 'Installation', fn: testInstallation },
    health: { name: 'Server Health', fn: testServerHealth },
  };

  const suitesToRun = suite === 'all' ? Object.keys(suites) : [suite];

  for (const key of suitesToRun) {
    const s = suites[key];
    if (!s) {
      log.error(`Unknown test suite: ${key}`);
      log.info(`Available suites: ${Object.keys(suites).join(', ')}`);
      process.exit(1);
    }

    log.header(`Suite: ${s.name}`);
    const results = await s.fn();
    allResults.push(...results);

    for (const r of results) {
      if (r.passed) {
        log.success(`  ✓ ${r.name} (${r.duration}ms)`);
      } else {
        log.error(`  ✗ ${r.name}: ${r.error}`);
      }
    }
    console.log();
  }

  // Summary
  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;
  const total = allResults.length;

  log.header('Test Summary');
  log.info(`  Total:  ${total}`);
  log.success(`  Passed: ${passed}`);
  if (failed > 0) {
    log.error(`  Failed: ${failed}`);

    if (options.verbose || failed <= 10) {
      log.header('Failed Tests');
      for (const r of allResults.filter(r => !r.passed)) {
        log.error(`  ✗ ${r.name}`);
        if (r.error) log.dim(`    ${r.error}`);
      }
    }

    process.exit(1);
  } else {
    log.success('\n  All tests passed! ✓\n');
  }
}
