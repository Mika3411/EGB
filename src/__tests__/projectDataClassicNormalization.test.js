import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeProject } from '../data/projectData.js';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (relativePath) => readFileSync(resolve(srcDir, relativePath), 'utf8');

describe('project data classic normalization boundaries', () => {
  it('keeps RPG 3D runtime helpers out of classic project data normalization', () => {
    const projectDataSource = readSource('data/projectData.js');
    const projectData3dSource = readSource('data/projectData3d.js');

    expect(projectDataSource).not.toMatch(/utils[\\/]+rpg3d/i);
    expect(projectData3dSource).not.toMatch(/utils[\\/]+rpg3d/i);
  });

  it('normalizes classic projects without requiring 3D collections', () => {
    const normalized = normalizeProject({
      title: 'Projet classique',
      acts: [{ id: 'act-a', name: 'Acte I' }],
      scenes: [{ id: 'scene-a', name: 'Depart', hotspots: [] }],
      items: null,
      cinematics: null,
      enigmas: null,
    });

    expect(normalized.items).toEqual([]);
    expect(normalized.cinematics).toEqual([]);
    expect(normalized.enigmas).toEqual([]);
    expect(normalized.characterModels3d).toEqual([]);
    expect(normalized.decorModels3d).toEqual([]);
    expect(normalized.scenes[0].actId).toBe('act-a');
    expect(Array.isArray(normalized.scenes[0].hotspots)).toBe(true);
  });
});
