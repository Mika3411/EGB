import { describe, expect, it } from 'vitest';
import {
  parseProjectJsonPayload,
  validateProjectSafety,
} from '../utils/projectSafetyValidation';
import { validateProject } from '../utils/projectValidation';

const makeProject = (overrides = {}) => ({
  title: 'Projet test',
  acts: [{ id: 'act1', name: 'Acte 1' }],
  start: { type: 'scene', targetSceneId: 'scene1', targetCinematicId: '' },
  scenes: [{
    id: 'scene1',
    name: 'Scene 1',
    actId: 'act1',
    introText: 'Une piece calme.',
    hotspots: [{
      id: 'hotspot1',
      name: 'Porte',
      x: 50,
      y: 50,
      width: 12,
      height: 12,
      actionType: 'dialogue',
      dialogue: 'La porte est fermee.',
    }],
  }],
  items: [],
  combinations: [],
  enigmas: [],
  cinematics: [],
  ...overrides,
});

describe('project safety validation', () => {
  it('accepts a compact AI project with the expected schema', () => {
    const result = validateProjectSafety(makeProject(), { mode: 'ai' });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects unexpected fields in strict AI mode', () => {
    const result = validateProjectSafety(makeProject({ injected: true }), { mode: 'ai' });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('champ inattendu'))).toBe(true);
  });

  it('rejects non-empty media fields in AI responses', () => {
    const project = makeProject({
      scenes: [{
        ...makeProject().scenes[0],
        backgroundData: 'https://example.com/scene.png',
      }],
    });
    const result = validateProjectSafety(project, { mode: 'ai' });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('champ media non vide'))).toBe(true);
  });

  it('blocks active content through the project validator', () => {
    const result = validateProject(makeProject({
      scenes: [{
        ...makeProject().scenes[0],
        introText: '<script>alert(1)</script>',
      }],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('contenu actif interdit'))).toBe(true);
  });

  it('extracts nested project payloads and legacy scene keys', () => {
    const parsed = parseProjectJsonPayload(JSON.stringify({
      data: {
        project: {
          title: 'Legacy',
          ['sc\u00e8nes']: [{ id: 'scene1', name: 'Scene' }],
        },
      },
    }));

    expect(parsed.scenes).toHaveLength(1);
  });
});
