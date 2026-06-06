import { describe, expect, test } from 'vitest';
import {
  createInitialProject,
  makeLogicRule,
  makeRouteMap,
  normalizeProject,
} from '../shared/data/projectData';
import {
  PRO_PROMOTION_PROJECT_MODE,
  applyProPromotionProjectSetup,
  getProPromotionConfig,
  getProPromotionProjectKind,
  isProPromotionProject,
} from '../shared/services/proPromotion';
import { getClassicBuilderTabValuesForMode } from '../shared/utils/classicBuilderTabs';

describe('pro promotion projects', () => {
  test('limite le mode pro aux onglets utiles aux extensions experience', () => {
    expect(getClassicBuilderTabValuesForMode(PRO_PROMOTION_PROJECT_MODE)).toEqual(['scenes', 'media', 'preview']);
  });

  test('prepare une extension experience sans perdre le mode a la normalisation', () => {
    const project = applyProPromotionProjectSetup(createInitialProject(), 'extend');
    const normalizedProject = normalizeProject(project);

    expect(getProPromotionConfig('promote').title).toBe('Extension d’expérience - promotion');
    expect(normalizedProject.creationMode).toBe(PRO_PROMOTION_PROJECT_MODE);
    expect(normalizedProject.title).toBe('Extension d’expérience - prolongement');
    expect(normalizedProject.proPage).toMatchObject({
      kind: 'extend',
      intentLabel: 'Prolonger',
    });
    expect(isProPromotionProject(normalizedProject)).toBe(true);
    expect(getProPromotionProjectKind(normalizedProject)).toBe('extend');
    expect(isProPromotionProject(createInitialProject())).toBe(false);
  });

  test('normalise une extension pro en page unique sans navigation de scene', () => {
    const project = applyProPromotionProjectSetup(createInitialProject(), 'promote');
    const pageScene = project.scenes[0];
    const removedScene = project.scenes[1];
    const removedAct = project.acts[1];

    pageScene.parentSceneId = removedScene.id;
    pageScene.timerEndAction = 'scene';
    pageScene.timerTargetSceneId = removedScene.id;
    pageScene.hotspots[0] = {
      ...pageScene.hotspots[0],
      actionType: 'scene',
      targetSceneId: removedScene.id,
      enigmaId: project.enigmas[0].id,
      secondActionType: 'scene',
      secondTargetSceneId: removedScene.id,
      secondEnigmaId: project.enigmas[0].id,
      skillCheckSuccessTargetSceneId: removedScene.id,
      skillCheckFailureTargetSceneId: removedScene.id,
      combatVictoryTargetSceneId: removedScene.id,
      combatDefeatTargetSceneId: removedScene.id,
      logicRules: [{
        ...makeLogicRule(),
        actionType: 'scene',
        targetSceneId: removedScene.id,
        enigmaId: project.enigmas[0].id,
        conditionType: 'visited_scene',
        conditionSceneId: removedScene.id,
        conditionEnigmaId: project.enigmas[0].id,
      }],
      conversation: {
        startNodeId: 'start',
        nodes: [{
          id: 'start',
          speaker: 'PNJ',
          text: 'Une question.',
          replies: [{
            id: 'reply-scene',
            label: 'Changer',
            actionType: 'scene',
            targetSceneId: removedScene.id,
            conditionType: 'visited_scene',
            conditionSceneId: removedScene.id,
            conditionEnigmaId: project.enigmas[0].id,
            effects: [{
              id: 'effect-scene',
              type: 'scene',
              targetSceneId: removedScene.id,
              message: 'Suite',
            }],
          }],
        }],
      },
    };
    pageScene.hotspots[1] = {
      id: 'legacy-reward-hotspot',
      name: 'Ancienne zone objet',
      x: 50,
      y: 50,
      width: 14,
      height: 12,
      actionType: 'dialogue_item',
      rewardItemId: project.items[0].id,
    };
    pageScene.sceneObjects = [
      {
        id: 'object-scene-link',
        name: 'Objet vers scene',
        x: 40,
        y: 40,
        width: 10,
        height: 10,
        clickMode: 'action',
        targetSceneId: removedScene.id,
        logicRules: [{
          ...makeLogicRule(),
          actionType: 'scene',
          targetSceneId: removedScene.id,
        }],
      },
      {
        id: 'text-scene-link',
        name: 'Texte conservé',
        blockType: 'text',
        x: 45,
        y: 42,
        width: 30,
        height: 12,
        clickMode: 'action',
        actionType: 'external_link',
        externalUrl: 'example.com/teaser',
        linkedItemId: project.items[0].id,
        targetSceneId: removedScene.id,
        logicRules: [{
          ...makeLogicRule(),
          actionType: 'scene',
          targetSceneId: removedScene.id,
        }],
      },
      {
        id: 'text-reward-link',
        name: 'Texte ancien objet',
        blockType: 'text',
        x: 45,
        y: 56,
        width: 30,
        height: 12,
        clickMode: 'action',
        actionType: 'dialogue_item',
        rewardItemId: project.items[0].id,
      },
    ];
    project.enigmas[0].unlockType = 'scene';
    project.enigmas[0].targetSceneId = removedScene.id;
    project.cinematics[0].onEndType = 'scene';
    project.cinematics[0].targetActId = removedAct.id;
    project.cinematics[0].targetSceneId = removedScene.id;
    project.routeMap = {
      ...makeRouteMap(),
      cells: [{ id: 'cell-scene', x: 1, y: 1, type: 'start', sceneId: removedScene.id }],
      rooms: [{ id: 'room-scene', name: 'Ancienne scene', sceneId: removedScene.id, x: 20, y: 20 }],
      connections: [{ id: 'route-link', fromRoomId: 'room-scene', toRoomId: 'other-room' }],
    };
    project.start = { type: 'scene', targetSceneId: removedScene.id, targetCinematicId: '' };

    const normalizedProject = normalizeProject(project);
    const normalizedPage = normalizedProject.scenes[0];
    const normalizedHotspot = normalizedPage.hotspots[0];
    const normalizedRewardHotspot = normalizedPage.hotspots.find((spot) => spot.id === 'legacy-reward-hotspot');
    const normalizedRule = normalizedHotspot.logicRules[0];
    const normalizedReply = normalizedHotspot.conversation.nodes[0].replies[0];
    const normalizedEffect = normalizedReply.effects[0];
    const normalizedObject = normalizedPage.sceneObjects[0];
    const normalizedRewardText = normalizedPage.sceneObjects.find((object) => object.id === 'text-reward-link');

    expect(normalizedProject.acts).toHaveLength(1);
    expect(normalizedProject.scenes).toHaveLength(1);
    expect(normalizedPage.id).toBe(pageScene.id);
    expect(normalizedPage.parentSceneId).toBe('');
    expect(normalizedPage.timerEndAction).toBe('none');
    expect(normalizedPage.timerTargetSceneId).toBe('');
    expect(normalizedProject.start).toEqual({
      type: 'scene',
      targetSceneId: normalizedPage.id,
      targetCinematicId: '',
    });
    expect(normalizedProject.routeMap.rooms).toEqual([]);
    expect(normalizedProject.routeMap.cells).toEqual([]);
    expect(normalizedProject.routeMap.connections).toEqual([]);

    expect(normalizedHotspot.actionType).toBe('dialogue');
    expect(normalizedHotspot.targetSceneId).toBe('');
    expect(normalizedHotspot.enigmaId).toBe('');
    expect(normalizedHotspot.secondActionType).toBe('dialogue');
    expect(normalizedHotspot.secondTargetSceneId).toBe('');
    expect(normalizedHotspot.secondEnigmaId).toBe('');
    expect(normalizedHotspot.skillCheckSuccessTargetSceneId).toBe('');
    expect(normalizedHotspot.skillCheckFailureTargetSceneId).toBe('');
    expect(normalizedHotspot.combatVictoryTargetSceneId).toBe('');
    expect(normalizedHotspot.combatDefeatTargetSceneId).toBe('');
    expect(normalizedRewardHotspot.actionType).toBe('dialogue');
    expect(normalizedRewardHotspot.rewardItemId).toBe('');
    expect(normalizedRule.actionType).toBe('dialogue');
    expect(normalizedRule.targetSceneId).toBe('');
    expect(normalizedRule.conditionSceneId).toBe('');
    expect(normalizedRule.enigmaId).toBe('');
    expect(normalizedRule.conditionEnigmaId).toBe('');
    expect(normalizedReply.actionType).toBe('dialogue');
    expect(normalizedReply.targetSceneId).toBe('');
    expect(normalizedReply.conditionSceneId).toBe('');
    expect(normalizedReply.conditionEnigmaId).toBe('');
    expect(normalizedEffect.type).toBe('message');
    expect(normalizedEffect.targetSceneId).toBe('');
    expect(normalizedPage.sceneObjects).toHaveLength(2);
    expect(normalizedObject.id).toBe('text-scene-link');
    expect(normalizedObject.blockType).toBe('text');
    expect(normalizedObject.clickMode).toBe('action');
    expect(normalizedObject.actionType).toBe('external_link');
    expect(normalizedObject.externalUrl).toBe('example.com/teaser');
    expect(normalizedObject.linkedItemId).toBe('');
    expect(normalizedObject.targetSceneId).toBe('');
    expect(normalizedObject.logicRules).toEqual([]);
    expect(normalizedRewardText.actionType).toBe('dialogue');
    expect(normalizedRewardText.rewardItemId).toBe('');
    expect(normalizedProject.enigmas[0].unlockType).toBe('none');
    expect(normalizedProject.enigmas[0].targetSceneId).toBe('');
    expect(normalizedProject.cinematics[0].onEndType).toBe('none');
    expect(normalizedProject.cinematics[0].targetActId).toBe('');
    expect(normalizedProject.cinematics[0].targetSceneId).toBe('');
  });
});
