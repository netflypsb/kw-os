import type { SkillValidationResult } from '../types/index.js';

/**
 * Check if content looks like a valid kw-os skill file.
 * Must have YAML frontmatter with at least an id or name field,
 * and a meaningful markdown body.
 */
export function isValidSkill(content: string): boolean {
  if (!content.startsWith('---')) return false;

  const fmEnd = content.indexOf('---', 3);
  if (fmEnd === -1) return false;

  const frontmatter = content.slice(3, fmEnd).trim();

  const hasId = /^id\s*:/m.test(frontmatter);
  const hasName = /^name\s*:/m.test(frontmatter);

  if (!hasId && !hasName) return false;

  const body = content.slice(fmEnd + 3).trim();
  if (body.length < 50) return false;

  return true;
}

/**
 * Validate that a skill file is both structurally valid and safe to install.
 * Returns warnings for suspicious patterns that could indicate malicious content.
 */
export function validateSkill(content: string): SkillValidationResult {
  const warnings: string[] = [];

  // Structural validity
  const valid = isValidSkill(content);
  if (!valid) {
    warnings.push('Missing or invalid YAML frontmatter (requires --- delimiters with id or name field)');
    return { valid: false, safe: true, warnings };
  }

  // Safety checks — flag suspicious patterns in skill instructions
  if (/<script[\s>]/i.test(content)) {
    warnings.push('Contains <script> tags');
  }
  if (/\beval\s*\(/.test(content)) {
    warnings.push('Contains eval() calls');
  }
  if (/\brm\s+-rf\b/.test(content)) {
    warnings.push('Contains destructive shell commands (rm -rf)');
  }
  if (/\bcurl\b.*\|\s*(ba)?sh\b/.test(content)) {
    warnings.push('Contains pipe-to-shell pattern (curl | sh)');
  }
  if (/\bwget\b.*\|\s*(ba)?sh\b/.test(content)) {
    warnings.push('Contains pipe-to-shell pattern (wget | sh)');
  }
  if (/\bFormat-Volume\b/i.test(content)) {
    warnings.push('Contains destructive Windows command (Format-Volume)');
  }
  if (/\bdel\s+\/[sf]/i.test(content)) {
    warnings.push('Contains destructive Windows command (del /s or del /f)');
  }

  const safe = warnings.length === 0;
  return { valid, safe, warnings };
}
