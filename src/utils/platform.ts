import os from 'node:os';
import path from 'node:path';

export function getHomeDir(): string {
  return os.homedir();
}

export function getKWOSDir(): string {
  return path.join(os.homedir(), '.kw-os');
}

export function getServersDir(): string {
  return path.join(getKWOSDir(), 'servers');
}

export function getCacheDir(): string {
  return path.join(getKWOSDir(), 'cache');
}

export function getConfigPath(): string {
  return path.join(getKWOSDir(), 'config.json');
}

export function getPlatform(): 'win32' | 'darwin' | 'linux' {
  const p = os.platform();
  if (p === 'win32') return 'win32';
  if (p === 'darwin') return 'darwin';
  return 'linux';
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}
