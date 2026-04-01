import fs from 'node:fs';
import path from 'node:path';
import type { IDEType, ServerEntry } from '../types/index.js';
import { getServersDir } from '../utils/platform.js';
import { log } from '../utils/logger.js';

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export class ConfigGenerator {
  private serversDir: string;

  constructor() {
    this.serversDir = getServersDir();
  }

  generateConfig(servers: ServerEntry[]): MCPConfig {
    const mcpServers: Record<string, MCPServerConfig> = {};

    for (const server of servers) {
      const config = this.serverToMCPConfig(server);
      if (config) {
        mcpServers[server.id] = config;
      }
    }

    return { mcpServers };
  }

  private serverToMCPConfig(server: ServerEntry): MCPServerConfig | null {
    switch (server.type) {
      case 'npm':
        return this.npmServerConfig(server);
      case 'python':
        return this.pythonServerConfig(server);
      case 'cli':
        // CLI servers (like agent-browser) don't need MCP config;
        // they are invoked directly via terminal commands
        return null;
      default:
        return null;
    }
  }

  private npmServerConfig(server: ServerEntry): MCPServerConfig {
    return {
      command: server.command || 'npx',
      args: server.args || ['-y', `${server.package}@${server.version || 'latest'}`],
    };
  }

  private pythonServerConfig(server: ServerEntry): MCPServerConfig {
    const serverDir = path.join(this.serversDir, server.category, server.id);
    const isWin = process.platform === 'win32';
    const venvPython = path.join(serverDir, '.venv', isWin ? 'Scripts' : 'bin', 'python');

    // Try to find the main entry point
    const candidates = [
      path.join(serverDir, 'src', 'server.py'),
      path.join(serverDir, 'server.py'),
      path.join(serverDir, 'main.py'),
      path.join(serverDir, 'src', 'main.py'),
      path.join(serverDir, 'src', `${server.id.replace(/-/g, '_')}_mcp`, 'server.py'),
    ];

    let entryPoint = candidates.find(c => fs.existsSync(c));

    if (!entryPoint) {
      // Fallback: use -m to run as module
      return {
        command: venvPython,
        args: ['-m', server.id.replace(/-/g, '_')],
        env: { PYTHONPATH: serverDir },
      };
    }

    return {
      command: venvPython,
      args: [entryPoint],
      env: { PYTHONPATH: serverDir },
    };
  }

  writeConfig(config: MCPConfig, ide: IDEType, cwd: string): string {
    const configInfo = this.getIDEConfigPath(ide, cwd);

    // Ensure config directory exists
    if (!fs.existsSync(configInfo.dir)) {
      fs.mkdirSync(configInfo.dir, { recursive: true });
    }

    // Merge with existing config if present
    let finalConfig = config;
    if (fs.existsSync(configInfo.path)) {
      try {
        const existing = JSON.parse(fs.readFileSync(configInfo.path, 'utf-8')) as MCPConfig;
        finalConfig = {
          mcpServers: {
            ...existing.mcpServers,
            ...config.mcpServers,
          },
        };
        log.dim(`  Merged with existing ${path.basename(configInfo.path)}`);
      } catch {
        // Existing file is malformed; overwrite
      }
    }

    fs.writeFileSync(configInfo.path, JSON.stringify(finalConfig, null, 2));
    return configInfo.path;
  }

  private getIDEConfigPath(ide: IDEType, cwd: string): { dir: string; path: string } {
    const mapping: Record<IDEType, string> = {
      cursor: '.cursor',
      windsurf: '.windsurf',
      vscode: '.vscode',
      claude: '.claude',
      antigravity: '.antigravity',
      qoder: '.qoder',
    };

    const dir = path.join(cwd, mapping[ide]);
    return { dir, path: path.join(dir, 'mcp.json') };
  }
}
