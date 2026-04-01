import fs from 'node:fs';
import { log } from '../utils/logger.js';
import { getConfigPath, getKWOSDir, getServersDir } from '../utils/platform.js';
import { checkEnvironment, validateEnvironment } from '../core/env-check.js';
import { getAllServers } from '../core/server-registry.js';
import { checkAllServers } from '../core/health-check.js';

export async function doctorCommand(): Promise<void> {
  log.header('KW-OS Doctor — Diagnosing Issues');

  const cwd = process.cwd();
  let issues = 0;

  // 1. Check environment
  log.step('Checking environment...');
  const env = checkEnvironment(cwd);
  const envErrors = validateEnvironment(env);
  for (const err of envErrors) {
    log.error(err);
    issues++;
  }
  if (envErrors.length === 0) {
    log.success('Environment OK');
  }

  // 2. Check KW-OS installation
  log.step('Checking KW-OS installation...');
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    log.error('KW-OS config not found. Run "kw-os init" to install.');
    issues++;
  } else {
    log.success('KW-OS config found');
  }

  // 3. Check servers directory
  log.step('Checking servers directory...');
  const serversDir = getServersDir();
  if (!fs.existsSync(serversDir)) {
    log.error(`Servers directory missing: ${serversDir}`);
    log.info('  Fix: Run "kw-os init" to recreate');
    issues++;
  } else {
    log.success('Servers directory exists');
  }

  // 4. Check server health
  log.step('Checking server health...');
  try {
    const servers = getAllServers();
    const statuses = await checkAllServers(servers);
    const unhealthy = statuses.filter(s => !s.healthy);

    if (unhealthy.length > 0) {
      for (const s of unhealthy) {
        log.error(`${s.id}: ${s.error || 'unhealthy'}`);
        issues++;
      }
      log.info('  Fix: Run "kw-os update" to reinstall failed servers');
    } else {
      log.success(`All ${statuses.length} servers healthy`);
    }
  } catch (err) {
    log.warn('Could not check server health (registry may not be loaded)');
  }

  // 5. Check IDE config
  log.step('Checking IDE configuration...');
  if (env.ide.detected && env.ide.configPath) {
    if (fs.existsSync(env.ide.configPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(env.ide.configPath, 'utf-8'));
        const serverCount = Object.keys(content.mcpServers || {}).length;
        log.success(`IDE config has ${serverCount} MCP servers configured`);
      } catch {
        log.error('IDE config file is malformed JSON');
        log.info(`  Fix: Delete ${env.ide.configPath} and run "kw-os init"`);
        issues++;
      }
    } else {
      log.warn('IDE config file not found');
      log.info('  Fix: Run "kw-os init" to generate');
      issues++;
    }
  } else {
    log.warn('No IDE detected in current workspace');
    log.info('  Fix: Run "kw-os init --ide <type>" to specify your IDE');
    issues++;
  }

  // Summary
  console.log();
  if (issues === 0) {
    log.success('No issues found! KW-OS is healthy.');
  } else {
    log.warn(`Found ${issues} issue(s). Follow the suggestions above to fix them.`);
  }
  console.log();
}
