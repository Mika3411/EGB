import { describe, expect, test } from 'vitest';
import { createInitialProject } from '../data/projectData';
import { importProjectFromJsonText } from '../utils/projectJsonImport';
import { PROJECT_SAFETY_LIMITS } from '../utils/projectSafetyValidation';

const makeImportableProject = (overrides = {}) => {
  const project = createInitialProject();
  project.title = 'Projet importable';
  project.scenes = [{
    id: 'scene-1',
    name: 'Scene 1',
    hotspots: [],
    sceneObjects: [],
  }];
  project.start = {
    type: 'scene',
    targetSceneId: 'scene-1',
    targetCinematicId: '',
  };
  project.enigmas = [];
  project.cinematics = [];
  project.combinations = [];
  return {
    ...project,
    ...overrides,
  };
};

describe('project JSON import validation', () => {
  test('refuse un JSON corrompu avec une erreur lisible', () => {
    expect(() => importProjectFromJsonText('{"title":"Cassé",')).toThrow(/JSON illisible/);

    try {
      importProjectFromJsonText('{"title":"Cassé",');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'ProjectImportError',
        code: 'PROJECT_IMPORT_INVALID_JSON',
      });
    }
  });

  test('accepte les champs inconnus anciens comme avertissements et les preserve', () => {
    const project = makeImportableProject({
      legacyBuilderVersion: 'v0',
      scenes: [{
        id: 'scene-1',
        name: 'Scene 1',
        legacySceneFlag: true,
        hotspots: [],
        sceneObjects: [],
      }],
    });

    const result = importProjectFromJsonText(JSON.stringify({ data: { project } }));

    expect(result.project.legacyBuilderVersion).toBe('v0');
    expect(result.project.scenes[0].legacySceneFlag).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('champ inattendu'))).toBe(true);
  });

  test('preserve les anciens exports avec cle scenes accentuee', () => {
    const legacyProject = makeImportableProject();
    delete legacyProject.scenes;
    legacyProject['scènes'] = [{
      id: 'scene-1',
      name: 'Scene héritée',
      hotspots: [],
      sceneObjects: [],
    }];

    const result = importProjectFromJsonText(JSON.stringify(legacyProject));

    expect(result.project.scenes).toHaveLength(1);
    expect(result.project.scenes[0].name).toBe('Scene héritée');
  });

  test('refuse les references cassees avant import', () => {
    const project = makeImportableProject({
      scenes: [{
        id: 'scene-1',
        name: 'Scene 1',
        hotspots: [{
          id: 'hotspot-1',
          name: 'Porte',
          x: 50,
          y: 50,
          width: 12,
          height: 12,
          actionType: 'scene',
          targetSceneId: 'scene-manquante',
        }],
        sceneObjects: [],
      }],
    });

    expect(() => importProjectFromJsonText(JSON.stringify(project))).toThrow(/référence introuvable \(scene-manquante\)/);
  });

  test('refuse les contenus actifs dangereux avant normalisation', () => {
    const project = makeImportableProject({
      scenes: [{
        id: 'scene-1',
        name: 'Scene 1',
        introText: '<script>alert(1)</script>',
        hotspots: [],
        sceneObjects: [],
      }],
    });

    expect(() => importProjectFromJsonText(JSON.stringify(project))).toThrow(/contenu actif interdit/);
  });

  test('refuse les medias embarques trop volumineux', () => {
    const project = makeImportableProject({
      scenes: [{
        id: 'scene-1',
        name: 'Scene 1',
        backgroundData: `data:image/png;base64,${'a'.repeat(PROJECT_SAFETY_LIMITS.maxMediaFieldLength + 1)}`,
        hotspots: [],
        sceneObjects: [],
      }],
    });

    expect(() => importProjectFromJsonText(JSON.stringify(project))).toThrow(/média trop volumineux/);
  });
});
