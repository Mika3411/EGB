import { describe, expect, it } from 'vitest';
import { validateProject } from '../shared/utils/projectValidation';

const makeProject = () => ({
  title: 'Projet logique objets',
  acts: [{ id: 'act1', name: 'Acte 1' }],
  start: { type: 'scene', targetSceneId: 'scene1', targetCinematicId: '' },
  scenes: [{
    id: 'scene1',
    name: 'Salle',
    actId: 'act1',
    introText: 'Une salle avec un levier.',
    hotspots: [{
      id: 'door',
      name: 'Porte',
      x: 20,
      y: 20,
      width: 12,
      height: 12,
      actionType: 'dialogue',
      dialogue: 'La porte attend.',
      logicRules: [{
        id: 'ruleDoor',
        name: 'Panneau après levier',
        conditionType: 'completed_hotspot',
        hotspotId: 'lever',
        actionType: 'block',
        targetBlockId: 'panel',
      }],
    }],
    sceneObjects: [{
      id: 'lever',
      name: 'Levier',
      blockType: 'button',
      clickMode: 'action',
      actionType: 'dialogue',
      dialogue: 'Le levier bouge.',
      logicRules: [{
        id: 'ruleLever',
        name: 'Levier avec clé',
        conditionType: 'has_item',
        itemId: 'key',
        actionType: 'scene',
        targetSceneId: 'scene2',
      }],
    }, {
      id: 'panel',
      name: 'Panneau',
      blockType: 'text',
      clickMode: 'none',
      blockText: 'Un panneau secret.',
    }, {
      id: 'coinObject',
      name: 'Pièce visible',
      blockType: 'object',
      clickMode: 'object',
      linkedItemId: 'key',
    }],
  }, {
    id: 'scene2',
    name: 'Sortie',
    actId: 'act1',
    introText: 'La sortie.',
    hotspots: [{
      id: 'exit',
      name: 'Fin',
      x: 50,
      y: 50,
      width: 12,
      height: 12,
      actionType: 'dialogue',
      dialogue: 'Terminé.',
    }],
    sceneObjects: [],
  }],
  items: [{ id: 'key', name: 'Clé', icon: 'K' }],
  combinations: [],
  enigmas: [],
  cinematics: [],
});

describe('project validation for scene object logic', () => {
  it('accepts scene objects as completed-hotspot conditions and block targets', () => {
    const result = validateProject(makeProject());

    expect(result.errors).toEqual([]);
  });

  it('validates logic rules carried by scene objects', () => {
    const project = makeProject();
    project.scenes[0].sceneObjects[0].logicRules[0].targetSceneId = 'missingScene';

    const result = validateProject(project);

    expect(result.errors.some((error) => (
      error.includes('Objet de scène "Levier" règle "Levier avec clé" scène cible')
      && error.includes('missingScene')
    ))).toBe(true);
  });

  it('rejects non-block scene objects as block action targets', () => {
    const project = makeProject();
    project.scenes[0].hotspots[0].logicRules[0].targetBlockId = 'coinObject';

    const result = validateProject(project);

    expect(result.errors.some((error) => (
      error.includes('Zone "Porte" règle "Panneau après levier" bloc cible')
      && error.includes('coinObject')
    ))).toBe(true);
  });

  it('warns when selected logic actions have no required target', () => {
    const project = makeProject();
    project.scenes[0].timerEnabled = true;
    project.scenes[0].timerEndAction = 'scene';
    project.scenes[0].timerTargetSceneId = '';
    project.scenes[0].hotspots[0].logicRules.push({
      id: 'emptySceneRule',
      name: 'Scène vide',
      conditionType: 'always',
      actionType: 'scene',
      targetSceneId: '',
    });
    project.scenes[0].sceneObjects[0].logicRules[0].actionType = 'cinematic';
    project.scenes[0].sceneObjects[0].logicRules[0].targetCinematicId = '';

    const result = validateProject(project);

    expect(result.warnings.some((warning) => (
      warning.includes('timer')
      && warning.includes('Scène cible du timer manquante')
    ))).toBe(true);
    expect(result.warnings.some((warning) => (
      warning.includes('Scène vide')
      && warning.includes('Action: Scène cible manquante')
    ))).toBe(true);
    expect(result.warnings.some((warning) => (
      warning.includes('Levier avec clé')
      && warning.includes('Action: Cinématique cible manquante')
    ))).toBe(true);
  });
});
