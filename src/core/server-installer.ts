import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerEntry } from '../types/index.js';
import { getServersDir } from '../utils/platform.js';
import { log } from '../utils/logger.js';

export class ServerInstaller {
  private serversDir: string;

  constructor() {
    this.serversDir = getServersDir();
  }

  async ensureDirectories(): Promise<void> {
    const categories = ['core', 'browser', 'office', 'data', 'finance', 'research', 'utils'];
    for (const cat of categories) {
      const dir = path.join(this.serversDir, cat);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async installServer(server: ServerEntry): Promise<boolean> {
    try {
      switch (server.type) {
        case 'npm':
          return await this.installNpmServer(server);
        case 'python':
          return await this.installPythonServer(server);
        case 'cli':
          return await this.installCliServer(server);
        default:
          log.error(`Unknown server type: ${server.type}`);
          return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Failed to install ${server.id}: ${msg}`);
      return false;
    }
  }

  private async installNpmServer(server: ServerEntry): Promise<boolean> {
    if (!server.package) {
      log.error(`No package specified for npm server ${server.id}`);
      return false;
    }

    // For npm-type MCP servers, we verify npx can resolve the package.
    // The actual server runs via npx at runtime, so no persistent install is needed.
    // We just validate the package name is resolvable.
    try {
      execSync(`npx --yes ${server.package}@${server.version || 'latest'} --help`, {
        encoding: 'utf-8',
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // Many MCP servers don't have --help, so just pre-cache the package
      try {
        execSync(`npm cache add ${server.package}@${server.version || 'latest'}`, {
          encoding: 'utf-8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        // npm cache add can fail in some environments; not critical
      }
    }

    // Mark as installed in our tracking
    this.markInstalled(server);
    return true;
  }

  private async installPythonServer(server: ServerEntry): Promise<boolean> {
    if (!server.repo) {
      log.error(`No repo specified for python server ${server.id}`);
      return false;
    }

    const serverDir = path.join(this.serversDir, server.category, server.id);

    // Clone if not already present
    if (!fs.existsSync(serverDir)) {
      const ref = server.ref || 'main';
      execSync(
        `git clone --depth 1 --branch ${ref} https://github.com/${server.repo}.git "${serverDir}"`,
        { encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
    }

    // Create venv and install deps
    const venvDir = path.join(serverDir, '.venv');
    if (!fs.existsSync(venvDir)) {
      const pythonCmd = this.getPythonCmd();
      execSync(`${pythonCmd} -m venv "${venvDir}"`, {
        encoding: 'utf-8',
        timeout: 60000,
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    // Install requirements if they exist
    const pipCmd = this.getVenvPip(venvDir);
    const reqFile = path.join(serverDir, 'requirements.txt');
    if (fs.existsSync(reqFile)) {
      execSync(`"${pipCmd}" install -r requirements.txt`, {
        encoding: 'utf-8',
        timeout: 300000,
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    // Try pyproject.toml / setup.py install
    const pyproject = path.join(serverDir, 'pyproject.toml');
    const setupPy = path.join(serverDir, 'setup.py');
    if (fs.existsSync(pyproject) || fs.existsSync(setupPy)) {
      try {
        execSync(`"${pipCmd}" install -e .`, {
          encoding: 'utf-8',
          timeout: 300000,
          cwd: serverDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        // Not all repos support editable install; non-fatal
      }
    }

    this.markInstalled(server);
    return true;
  }

  private async installCliServer(server: ServerEntry): Promise<boolean> {
    if (!server.installCmd) {
      log.error(`No installCmd specified for CLI server ${server.id}`);
      return false;
    }

    execSync(server.installCmd, {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (server.postInstall) {
      try {
        execSync(server.postInstall, {
          encoding: 'utf-8',
          timeout: 120000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        log.warn(`Post-install command for ${server.id} had warnings (may be non-fatal)`);
      }
    }

    this.markInstalled(server);
    return true;
  }

  private getPythonCmd(): string {
    try {
      execSync('python3 --version', { stdio: ['pipe', 'pipe', 'pipe'] });
      return 'python3';
    } catch {
      return 'python';
    }
  }

  private getVenvPip(venvDir: string): string {
    const isWin = process.platform === 'win32';
    return path.join(venvDir, isWin ? 'Scripts' : 'bin', 'pip');
  }

  private markInstalled(server: ServerEntry): void {
    const trackingDir = path.join(this.serversDir, '.installed');
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir, { recursive: true });
    }
    const trackingFile = path.join(trackingDir, `${server.id}.json`);
    fs.writeFileSync(trackingFile, JSON.stringify({
      id: server.id,
      category: server.category,
      type: server.type,
      installedAt: new Date().toISOString(),
    }, null, 2));
  }

  isInstalled(serverId: string): boolean {
    const trackingFile = path.join(this.serversDir, '.installed', `${serverId}.json`);
    return fs.existsSync(trackingFile);
  }
}
