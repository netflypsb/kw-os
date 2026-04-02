import fs from 'node:fs';
import path from 'node:path';
import type {
  SkillManifest,
  SkillManifestEntry,
  SkillSourceType,
  FetchedSkill,
} from '../types/index.js';
import { getKWOSDir } from '../utils/platform.js';

function getManifestPath(): string {
  return path.join(getKWOSDir(), 'skill-manifest.json');
}

export function loadManifest(): SkillManifest {
  const manifestPath = getManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return { version: '1.0.0', skills: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as SkillManifest;
  } catch {
    return { version: '1.0.0', skills: [] };
  }
}

export function saveManifest(manifest: SkillManifest): void {
  const manifestPath = getManifestPath();
  const dir = path.dirname(manifestPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export function addToManifest(
  skills: FetchedSkill[],
  sourceType: SkillSourceType
): void {
  const manifest = loadManifest();

  for (const skill of skills) {
    const id = skill.filename.replace(/\.md$/, '');

    // Remove existing entry for this id if present
    manifest.skills = manifest.skills.filter(s => s.id !== id);

    const entry: SkillManifestEntry = {
      id,
      source: skill.source,
      sourceType,
      installedAt: new Date().toISOString(),
      filename: skill.filename,
    };

    manifest.skills.push(entry);
  }

  saveManifest(manifest);
}

export function removeFromManifest(skillId: string): void {
  const manifest = loadManifest();
  manifest.skills = manifest.skills.filter(s => s.id !== skillId);
  saveManifest(manifest);
}
