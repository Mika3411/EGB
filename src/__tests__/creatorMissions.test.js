import { describe, expect, it } from 'vitest';
import {
  getCreatorMissionProgress,
  hasCreatedCinematic,
  hasCreatedEnigma,
  hasHiddenObject,
  hasLinkedScenes,
  hasPublishedProject,
} from '../shared/data/creatorMissions.js';

const baseProject = (overrides = {}) => ({
  scenes: [
    { id: 'scene-a', name: 'Depart', hotspots: [], sceneObjects: [] },
    { id: 'scene-b', name: 'Arrivee', hotspots: [], sceneObjects: [] },
  ],
  items: [],
  enigmas: [],
  cinematics: [],
  combinations: [],
  ...overrides,
});

describe('creator missions', () => {
  it('detecte les scenes reliees par action principale, secondaire, logique ou conversation', () => {
    expect(hasLinkedScenes(baseProject())).toBe(false);

    expect(hasLinkedScenes(baseProject({
      scenes: [
        {
          id: 'scene-a',
          hotspots: [{ id: 'hotspot-a', actionType: 'scene', targetSceneId: 'scene-b' }],
          sceneObjects: [],
        },
        { id: 'scene-b', hotspots: [], sceneObjects: [] },
      ],
    }))).toBe(true);

    expect(hasLinkedScenes(baseProject({
      scenes: [
        {
          id: 'scene-a',
          hotspots: [{
            id: 'hotspot-b',
            actionType: 'dialogue',
            hasSecondAction: true,
            secondActionType: 'scene',
            secondTargetSceneId: 'scene-b',
          }],
          sceneObjects: [],
        },
        { id: 'scene-b', hotspots: [], sceneObjects: [] },
      ],
    }))).toBe(true);

    expect(hasLinkedScenes(baseProject({
      scenes: [
        {
          id: 'scene-a',
          hotspots: [{
            id: 'hotspot-c',
            actionType: 'dialogue',
            logicRules: [{ id: 'rule-a', actionType: 'scene', targetSceneId: 'scene-b' }],
          }],
          sceneObjects: [],
        },
        { id: 'scene-b', hotspots: [], sceneObjects: [] },
      ],
    }))).toBe(true);

    expect(hasLinkedScenes(baseProject({
      scenes: [
        {
          id: 'scene-a',
          hotspots: [{
            id: 'hotspot-d',
            actionType: 'conversation',
            conversation: {
              nodes: [{
                id: 'node-a',
                replies: [{ id: 'reply-a', actionType: 'scene', targetSceneId: 'scene-b' }],
              }],
            },
          }],
          sceneObjects: [],
        },
        { id: 'scene-b', hotspots: [], sceneObjects: [] },
      ],
    }))).toBe(true);
  });

  it('detecte un objet obtenable depuis les actions classiques', () => {
    expect(hasHiddenObject(baseProject({ items: [{ id: 'key', name: 'Cle' }] }))).toBe(false);

    expect(hasHiddenObject(baseProject({
      items: [{ id: 'key', name: 'Cle' }],
      scenes: [{
        id: 'scene-a',
        hotspots: [{ id: 'hotspot-a', actionType: 'dialogue_item', rewardItemId: 'key' }],
        sceneObjects: [],
      }],
    }))).toBe(true);

    expect(hasHiddenObject(baseProject({
      items: [{ id: 'key', name: 'Cle' }],
      scenes: [{
        id: 'scene-a',
        hotspots: [{ id: 'hotspot-b', logicRules: [{ id: 'rule-a', actionType: 'dialogue_item', rewardItemId: 'key' }] }],
        sceneObjects: [],
      }],
    }))).toBe(true);

    expect(hasHiddenObject(baseProject({
      items: [{ id: 'key', name: 'Cle' }],
      scenes: [{
        id: 'scene-a',
        hotspots: [{
          id: 'hotspot-c',
          actionType: 'conversation',
          conversation: {
            nodes: [{
              id: 'node-a',
              replies: [{
                id: 'reply-a',
                actionType: 'multiple',
                effects: [{ type: 'add_item', itemId: 'key' }],
              }],
            }],
          },
        }],
        sceneObjects: [],
      }],
    }))).toBe(true);

    expect(hasHiddenObject(baseProject({
      items: [{ id: 'key', name: 'Cle' }],
      scenes: [{
        id: 'scene-a',
        hotspots: [],
        sceneObjects: [{ id: 'object-a', linkedItemId: 'key' }],
      }],
    }))).toBe(true);

    expect(hasHiddenObject(baseProject({
      items: [{ id: 'key', name: 'Cle' }],
      scenes: [{
        id: 'scene-a',
        hotspots: [],
        sceneObjects: [{ id: 'object-hidden', linkedItemId: 'key', clickMode: 'none' }],
      }],
    }))).toBe(false);
  });

  it('valide enigme, cinematic et publication avec des donnees exploitables', () => {
    expect(hasCreatedEnigma(baseProject({ enigmas: [{ id: 'enigma-empty', type: 'code', solutionText: '' }] }))).toBe(false);
    expect(hasCreatedEnigma(baseProject({ enigmas: [{ id: 'enigma-a', type: 'code', solutionText: '1234' }] }))).toBe(true);

    expect(hasCreatedCinematic(baseProject({ cinematics: [{ id: 'cine-empty', slides: [], steps: [] }] }))).toBe(false);
    expect(hasCreatedCinematic(baseProject({
      cinematics: [{ id: 'cine-a', slides: [{ id: 'slide-a', narration: 'Une porte s ouvre.' }], steps: [] }],
    }))).toBe(true);

    expect(hasPublishedProject(baseProject(), { shareState: { isPublic: false, publishedAt: '2026-01-01' } })).toBe(false);
    expect(hasPublishedProject(baseProject(), { shareState: { isPublic: true, publishedAt: '2026-01-01' } })).toBe(true);
  });

  it('calcule la progression complete des cinq missions', () => {
    const project = baseProject({
      items: [{ id: 'key', name: 'Cle' }],
      scenes: [
        {
          id: 'scene-a',
          hotspots: [{
            id: 'hotspot-a',
            actionType: 'scene',
            targetSceneId: 'scene-b',
            rewardItemId: 'key',
            enigmaId: 'enigma-a',
            targetCinematicId: 'cine-a',
          }],
          sceneObjects: [],
        },
        { id: 'scene-b', hotspots: [], sceneObjects: [] },
      ],
      enigmas: [{ id: 'enigma-a', type: 'code', solutionText: '1234' }],
      cinematics: [{ id: 'cine-a', slides: [{ id: 'slide-a', narration: 'Intro.' }], steps: [] }],
    });

    const progress = getCreatorMissionProgress(project, { shareState: { isPublic: true } });

    expect(progress.completedCount).toBe(5);
    expect(progress.totalCount).toBe(5);
    expect(progress.allDone).toBe(true);
    expect(progress.missions.map((mission) => [mission.id, mission.isComplete])).toEqual([
      ['linked_scenes', true],
      ['hidden_object', true],
      ['enigma', true],
      ['cinematic', true],
      ['publish', true],
    ]);
  });
});
