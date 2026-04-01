import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerEntry, ServerRegistry, ServerCategory } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _registry: ServerRegistry | null = null;

function getRegistryPath(): string {
  // Navigate from dist/core/ up to project root, then into registry/
  return path.resolve(__dirname, '..', '..', 'registry', 'servers.json');
}

export function loadRegistry(): ServerRegistry {
  if (_registry) return _registry;

  const registryPath = getRegistryPath();
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Server registry not found at ${registryPath}`);
  }

  const raw = fs.readFileSync(registryPath, 'utf-8');
  _registry = JSON.parse(raw) as ServerRegistry;
  return _registry;
}

export function getServer(id: string): ServerEntry | undefined {
  const registry = loadRegistry();
  return registry.servers[id];
}

export function getServersByCategory(category: ServerCategory): ServerEntry[] {
  const registry = loadRegistry();
  return Object.values(registry.servers).filter(s => s.category === category);
}

export function getAllServers(): ServerEntry[] {
  const registry = loadRegistry();
  return Object.values(registry.servers);
}

export function getCategories(): ServerCategory[] {
  const registry = loadRegistry();
  const cats = new Set<ServerCategory>();
  for (const s of Object.values(registry.servers)) {
    cats.add(s.category);
  }
  return [...cats];
}

export function resolveServerList(serverFilter: string): ServerEntry[] {
  if (serverFilter === 'all') {
    return getAllServers();
  }

  const categories = serverFilter.split(',').map(s => s.trim()) as ServerCategory[];
  const registry = loadRegistry();
  return Object.values(registry.servers).filter(s => categories.includes(s.category));
}
