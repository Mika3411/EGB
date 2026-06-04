import { describe, expect, it } from 'vitest';
import {
  parseProjectJsonPayload,
  validateProjectSafety,
} from '../shared/utils/projectSafetyValidation';
import { validateProject } from '../shared/utils/projectValidation';

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

const toDataUrl = (mimeType, content) => `data:${mimeType};base64,${btoa(content)}`;

describe('project safety validation', () => {
  it('accepts a compact AI project with the expected schema', () => {
    const result = validateProjectSafety(makeProject(), { mode: 'ai' });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts advanced combat fields in strict AI mode', () => {
    const result = validateProjectSafety(makeProject({
      scenes: [{
        ...makeProject().scenes[0],
        hotspots: [{
          id: 'combat1',
          name: 'Gardien',
          x: 40,
          y: 45,
          width: 18,
          height: 18,
          actionType: 'hero_combat',
          combatEnemyName: 'Sentinelle',
          combatStartDialogue: 'La sentinelle bloque le passage.',
          combatEndDialogue: 'La poussiere retombe.',
          combatHeroDieDamagePercent: 50,
          combatEnemyDieDamagePercent: 25,
          combatEnemyCunning: 12,
          combatEnemyChaos: 14,
          combatEnemyAiMode: 'tactical',
        }],
      }],
    }), { mode: 'ai' });

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
    expect(result.errors.some((error) => error.includes('champ média non vide'))).toBe(true);
  });

  it('allows embedded 3D model data outside AI responses', () => {
    const result = validateProjectSafety(makeProject({
      characterModels3d: [{
        id: 'char1',
        name: 'Hero FBX',
        role: 'hero',
        shape: 'glb',
        modelName: 'hero.fbx',
        modelData: 'data:application/octet-stream;base64,ZmJ4',
      }],
      decorModels3d: [{
        id: 'decor1',
        name: 'Door OBJ',
        kind: 'decor',
        modelName: 'door.obj',
        modelData: 'data:model/obj;base64,byBET29y',
      }],
    }));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('allows OBJ ZIP model resources with MTL and supported texture data URLs', () => {
    const result = validateProjectSafety(makeProject({
      decorModels3d: [{
        id: 'decor1',
        name: 'Door OBJ',
        kind: 'decor',
        modelName: 'door.obj',
        modelData: 'data:model/obj;base64,byBET29y',
        modelResources: [
          {
            path: 'door.mtl',
            name: 'door.mtl',
            data: toDataUrl('text/plain', 'newmtl Door'),
          },
          {
            path: 'textures/door.bmp',
            name: 'door.bmp',
            data: toDataUrl('image/bmp', 'bmp-texture'),
          },
          {
            path: 'textures/door.png',
            name: 'door.png',
            data: toDataUrl('image/png', 'png-texture'),
          },
        ],
      }],
    }));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('keeps text data URLs rejected outside model resources', () => {
    const result = validateProjectSafety(makeProject({
      assets: [{
        id: 'asset1',
        type: 'note',
        name: 'note.txt',
        data: toDataUrl('text/plain', 'plain text outside model resources'),
      }],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('assets.0.data: type data URL interdit (text/plain)'))).toBe(true);
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
