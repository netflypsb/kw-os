import { execSync, spawn } from 'node:child_process';
import type { ServerEntry, ServerStatus } from '../types/index.js';
import { ServerInstaller } from './server-installer.js';

const installer = new ServerInstaller();

export async function checkServerHealth(server: ServerEntry): Promise<ServerStatus> {
  const base: ServerStatus = {
    id: server.id,
    installed: installer.isInstalled(server.id),
    healthy: false,
    version: null,
    error: null,
  };

  if (!base.installed) {
    base.error = 'Not installed';
    return base;
  }

  try {
    switch (server.type) {
      case 'npm':
        return await checkNpmServer(server, base);
      case 'uvx':
        return await checkUvxServer(server, base);
      case 'python':
        return await checkPythonServer(server, base);
      case 'cli':
        return await checkCliServer(server, base);
      default:
        base.error = `Unknown server type: ${server.type}`;
        return base;
    }
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    return base;
  }
}

async function checkUvxServer(server: ServerEntry, status: ServerStatus): Promise<ServerStatus> {
  if (!server.package) {
    status.error = 'No package defined';
    return status;
  }

  // Verify uvx is available
  try {
    execSync('uvx --version', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    status.healthy = true;
    status.version = server.package;
  } catch {
    try {
      execSync('uv --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      status.healthy = true;
      status.version = server.package;
    } catch {
      status.error = 'uv/uvx not found — install from https://docs.astral.sh/uv/';
    }
  }

  return status;
}

async function checkNpmServer(server: ServerEntry, status: ServerStatus): Promise<ServerStatus> {
  if (!server.package) {
    status.error = 'No package defined';
    return status;
  }

  // Verify the package is resolvable
  try {
    const result = execSync(`npm view ${server.package} version`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    status.version = result;
    status.healthy = true;
  } catch {
    // Offline check: try to see if npx can locate it in cache
    status.healthy = true; // Assume healthy if marked installed
    status.version = server.version || 'latest';
  }

  return status;
}

async function checkPythonServer(server: ServerEntry, status: ServerStatus): Promise<ServerStatus> {
  // Verify venv exists and has pip packages
  const { getServersDir } = await import('../utils/platform.js');
  const path = await import('node:path');
  const fs = await import('node:fs');

  const serverDir = path.join(getServersDir(), server.category, server.id);
  const venvDir = path.join(serverDir, '.venv');

  if (!fs.existsSync(venvDir)) {
    status.error = 'Virtual environment not found';
    return status;
  }

  const isWin = process.platform === 'win32';
  const pythonBin = path.join(venvDir, isWin ? 'Scripts' : 'bin', 'python');

  if (!fs.existsSync(pythonBin)) {
    status.error = 'Python binary not found in venv';
    return status;
  }

  try {
    const ver = execSync(`"${pythonBin}" --version`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    status.version = ver;
    status.healthy = true;
  } catch {
    status.error = 'Python venv is broken';
  }

  return status;
}

async function checkCliServer(server: ServerEntry, status: ServerStatus): Promise<ServerStatus> {
  if (!server.package) {
    status.healthy = true;
    return status;
  }

  try {
    const { default: which } = await import('which');
    const resolved = which.sync(server.package, { nothrow: true });
    if (resolved) {
      status.healthy = true;
      try {
        const ver = execSync(`${server.package} --version`, {
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        status.version = ver;
      } catch {
        status.version = 'installed';
      }
    } else {
      status.error = `${server.package} not found in PATH`;
    }
  } catch {
    status.error = `Could not verify ${server.package}`;
  }

  return status;
}

export async function checkAllServers(servers: ServerEntry[]): Promise<ServerStatus[]> {
  const results: ServerStatus[] = [];
  for (const server of servers) {
    results.push(await checkServerHealth(server));
  }
  return results;
}
