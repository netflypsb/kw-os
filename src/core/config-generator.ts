import fs from 'node:fs';
import path from 'node:path';
import type { IDEType, ServerEntry } from '../types/index.js';
import { getServersDir } from '../utils/platform.js';
import { log } from '../utils/logger.js';
import {
  loadProfiles,
  resolveConfigPath,
  getProfile,
  type DetectedIDE,
  type ConfigLocation,
  type IDEProfile,
  type ConfigWriteResult,
} from './config-profiles.js';

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
      case 'uvx':
        return this.uvxServerConfig(server);
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

  private uvxServerConfig(server: ServerEntry): MCPServerConfig {
    return {
      command: server.command || 'uvx',
      args: server.args || [server.package || server.id],
    };
  }

  private pythonServerConfig(server: ServerEntry): MCPServerConfig {
    const serverDir = path.join(this.serversDir, server.category, server.id);
    const isWin = process.platform === 'win32';
    const pythonBin = isWin ? 'python.exe' : 'python';
    const venvPython = path.join(serverDir, '.venv', isWin ? 'Scripts' : 'bin', pythonBin);

    // Use explicit moduleName from registry if provided
    const moduleName = server.moduleName || server.id.replace(/-/g, '_');

    // Try to find the main entry point
    const candidates = [
      path.join(serverDir, 'src', 'server.py'),
      path.join(serverDir, 'server.py'),
      path.join(serverDir, 'main.py'),
      path.join(serverDir, 'src', 'main.py'),
      path.join(serverDir, 'src', `${moduleName}`, 'server.py'),
      path.join(serverDir, 'src', `${moduleName}`, '__main__.py'),
    ];

    let entryPoint = candidates.find(c => fs.existsSync(c));

    if (!entryPoint) {
      // Fallback: use -m to run as module
      return {
        command: venvPython,
        args: ['-m', moduleName],
        env: { PYTHONPATH: serverDir },
      };
    }

    return {
      command: venvPython,
      args: [entryPoint],
      env: { PYTHONPATH: serverDir },
    };
  }

  /**
   * Write MCP config for ALL detected IDEs using data-driven profiles.
   * Each IDE gets its config written to the correct file and location.
   * For non-primary IDEs, only existing config files are updated (not created).
   */
  writeConfigForAllIDEs(
    config: MCPConfig,
    detectedIDEs: DetectedIDE[],
    cwd: string,
    primaryIDE?: string
  ): ConfigWriteResult[] {
    const results: ConfigWriteResult[] = [];

    for (const detected of detectedIDEs) {
      const profile = detected.profile;

      for (const location of profile.configLocations) {
        const configPath = resolveConfigPath(location, cwd);

        // Only create new config files for the primary IDE or if location.create is true
        const isPrimary = detected.id === primaryIDE;
        if (!isPrimary && !fs.existsSync(configPath)) {
          // For non-primary IDEs, only update existing files
          continue;
        }

        try {
          const writtenPath = this.writeConfigToLocation(
            config,
            profile,
            location,
            cwd
          );
          results.push({
            ide: detected.id,
            scope: location.scope,
            path: writtenPath,
            success: true,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({
            ide: detected.id,
            scope: location.scope,
            path: configPath,
            success: false,
            error: msg,
          });
        }
      }
    }

    return results;
  }

  /**
   * Write MCP config to a single location, using the profile's jsonRootKey.
   * Merges with existing config — preserves user's custom MCP servers.
   */
  private writeConfigToLocation(
    config: MCPConfig,
    profile: IDEProfile,
    location: ConfigLocation,
    cwd: string
  ): string {
    const configPath = resolveConfigPath(location, cwd);
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load existing config for merge
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
        log.dim(`  Merged with existing ${path.basename(configPath)}`);
      } catch {
        // Malformed existing file — start fresh
        log.warn(`  Existing ${path.basename(configPath)} was malformed, creating new`);
      }
    }

    // Use the profile's root key (usually "mcpServers", but "servers" for VS Code)
    const rootKey = profile.jsonRootKey;
    const existingServers = (existing[rootKey] || {}) as Record<string, unknown>;

    // Merge: preserve existing servers, add/update kw-os servers
    const mergedServers = { ...existingServers, ...config.mcpServers };

    existing[rootKey] = mergedServers;

    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    return configPath;
  }

  /**
   * Legacy writeConfig — uses profiles under the hood now.
   * Kept for backwards compatibility with code that targets a single IDE.
   */
  writeConfig(config: MCPConfig, ide: IDEType, cwd: string): string {
    const profile = getProfile(ide);

    if (profile && profile.configLocations.length > 0) {
      // Use the first (primary) config location from the profile
      const location = profile.configLocations[0];
      return this.writeConfigToLocation(config, profile, location, cwd);
    }

    // Fallback: if no profile found, use legacy behavior
    const fallbackDir = path.join(cwd, `.${ide}`);
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    const fallbackPath = path.join(fallbackDir, 'mcp.json');
    fs.writeFileSync(fallbackPath, JSON.stringify(config, null, 2));
    return fallbackPath;
  }
}
