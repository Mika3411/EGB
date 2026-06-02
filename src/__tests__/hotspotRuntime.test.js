import { describe, expect, it } from 'vitest';
import {
  addRewardItemToInventory,
  applyHotspotBlockState,
  createGameEngine,
  consumeInventoryItem,
  createHotspotViewerImage,
  createInventoryViewerImage,
  gameActions,
  getHotspotRewardItemId,
  resolveHotspotInteraction,
  selectRewardInventoryItem,
} from '../lib/gameEngine';

describe('hotspot runtime helpers', () => {
  it('computes inventory and viewer side-effect values without mutating inputs', () => {
    const inventory = ['key'];
    const selected = ['old'];
    const hotspot = {
      interactionMode: 'inventory',
      linkedItemId: 'coin',
      objectImageData: 'data:image/png;base64,AAA',
      objectImageName: 'Medallion',
      dialogue: 'Found',
    };

    expect(getHotspotRewardItemId(hotspot)).toBe('coin');
    expect(addRewardItemToInventory(inventory, 'coin')).toEqual(['key', 'coin']);
    expect(inventory).toEqual(['key']);
    expect(addRewardItemToInventory(['key'], 'key')).toEqual(['key']);
    expect(consumeInventoryItem(['key', 'coin'], 'key')).toEqual(['coin']);
    expect(selectRewardInventoryItem(selected, 'coin')).toEqual(['old', 'coin']);
    expect(createHotspotViewerImage(hotspot)).toEqual({
      src: 'data:image/png;base64,AAA',
      name: 'Medallion',
      caption: 'Found',
    });
    expect(createInventoryViewerImage({
      assets: [{ id: 'asset-coin', url: 'data:image/png;base64,Q09JTg==' }],
      items: [{ id: 'coin', name: 'Coin', imageId: 'asset-coin', icon: 'C' }],
    }, 'coin')).toEqual({
      id: 'coin',
      src: 'data:image/png;base64,Q09JTg==',
      name: 'Coin',
      icon: 'C',
    });
  });

  it('shows a reward item viewer even when the hotspot has no dedicated image', () => {
    const project = {
      scenes: [{
        id: 'scene-1',
        hotspots: [{
          id: 'take-note',
          actionType: 'dialogue_item',
          dialogue: 'Une note est ajoutee.',
          rewardItemId: 'note',
        }],
      }],
      items: [{ id: 'note', name: 'Note froissee', icon: 'NOTE' }],
    };
    const engine = createGameEngine(project, { currentSceneId: 'scene-1' });

    const state = engine.dispatch(gameActions.triggerHotspot('take-note'));

    expect(state.inventory).toEqual(['note']);
    expect(state.viewerImage).toMatchObject({
      id: 'note',
      src: '',
      name: 'Note froissee',
      icon: 'NOTE',
    });
  });

  it('applies block side-effect state with configurable removed ids key', () => {
    const baseState = {
      removedSceneObjectIds: [],
      revealedSceneObjectIds: ['door'],
      sceneObjectTextOverrides: {},
    };

    expect(applyHotspotBlockState(baseState, {
      actionType: 'block',
      targetBlockId: 'door',
      blockActionType: 'hide',
    }, { removedKey: 'removedSceneObjectIds' })).toMatchObject({
      removedSceneObjectIds: ['door'],
      revealedSceneObjectIds: [],
    });

    expect(applyHotspotBlockState(baseState, {
      actionType: 'block',
      targetBlockId: 'panel',
      blockActionType: 'update_text',
      targetBlockText: 'Open',
    }, { removedKey: 'removedSceneObjectIds' })).toMatchObject({
      removedSceneObjectIds: [],
      revealedSceneObjectIds: ['door', 'panel'],
      sceneObjectTextOverrides: { panel: 'Open' },
    });
  });

  it('resolves a matching logic rule without applying side effects', () => {
    const spot = {
      id: 'hotspot-1',
      actionType: 'dialogue',
      dialogue: 'Default',
      rewardItemId: 'old-reward',
      logicRules: [{
        id: 'rule-1',
        conditionType: 'has_item',
        itemId: 'key',
        actionType: 'scene',
        dialogue: 'Open',
        targetSceneId: 'scene-2',
        rewardItemId: 'new-reward',
        successSoundId: 'sound-1',
        disableAfterUse: true,
      }],
    };

    expect(resolveHotspotInteraction(spot, { inventory: ['key'] })).toMatchObject({
      actionType: 'scene',
      dialogue: 'Open',
      requiredItemId: 'key',
      targetSceneId: 'scene-2',
      rewardItemId: 'new-reward',
      soundId: 'sound-1',
      logicRuleId: 'rule-1',
      disableAfterUse: true,
    });
  });

  it('returns a failure dialogue when a configured rule is unmet', () => {
    const spot = {
      id: 'hotspot-1',
      actionType: 'scene',
      targetSceneId: 'scene-2',
      logicRules: [{
        id: 'rule-1',
        conditionType: 'has_item',
        itemId: 'key',
        failureDialogue: 'Need a key',
        failureSoundData: 'data:audio/mp3;base64,AAA',
      }],
    };

    expect(resolveHotspotInteraction(spot, { inventory: [] })).toMatchObject({
      actionType: 'dialogue',
      dialogue: 'Need a key',
      rewardItemId: '',
      targetSceneId: '',
      soundData: 'data:audio/mp3;base64,AAA',
      logicRuleFailed: true,
      failedLogicRuleId: 'rule-1',
    });
  });

  it('does not complete a hotspot when only a logic failure dialogue is shown', () => {
    const project = {
      scenes: [{
        id: 'scene-1',
        hotspots: [{
          id: 'hotspot-1',
          actionType: 'scene',
          targetSceneId: 'scene-2',
          logicRules: [{
            id: 'rule-1',
            conditionType: 'has_item',
            itemId: 'key',
            failureDialogue: 'Need a key',
          }],
        }],
      }, {
        id: 'scene-2',
        hotspots: [],
      }],
      items: [{ id: 'key', name: 'Key' }],
    };
    const engine = createGameEngine(project, { currentSceneId: 'scene-1' });

    const state = engine.dispatch(gameActions.triggerHotspot('hotspot-1'));

    expect(state.lastResult).toMatchObject({
      ok: false,
      logicRuleFailed: true,
      failedLogicRuleId: 'rule-1',
    });
    expect(state.dialogue).toBe('Need a key');
    expect(state.currentSceneId).toBe('scene-1');
    expect(state.completedHotspotIds).toEqual([]);
  });

  it('does not re-resolve an already resolved hotspot action in the engine reducer', () => {
    const project = {
      scenes: [{
        id: 'scene-1',
        hotspots: [],
      }, {
        id: 'scene-2',
        introText: 'Scene two',
        hotspots: [],
      }],
    };
    const sourceSpot = {
      id: 'hotspot-1',
      actionType: 'dialogue',
      dialogue: 'Default',
      logicRules: [{
        id: 'rule-1',
        conditionType: 'visited_scene',
        conditionSceneId: 'scene-visited',
        actionType: 'scene',
        dialogue: 'Unlocked',
        targetSceneId: 'scene-2',
        failureDialogue: 'Still locked',
      }],
    };
    const resolvedSpot = resolveHotspotInteraction(sourceSpot, {
      visitedSceneIds: ['scene-visited'],
    });
    const engine = createGameEngine(project, {
      currentSceneId: 'scene-1',
      visitedSceneIds: [],
    });

    const state = engine.dispatch({
      ...gameActions.triggerHotspot(resolvedSpot.id),
      hotspot: resolvedSpot,
      scene: project.scenes[0],
    });

    expect(state.lastResult).toMatchObject({
      ok: true,
      logicRuleFailed: false,
    });
    expect(state.currentSceneId).toBe('scene-2');
    expect(state.dialogue).toBe('Scene two');
  });

  it('ignores hero logic rules when Hero Adventure is disabled', () => {
    const spot = {
      id: 'hotspot-1',
      actionType: 'dialogue',
      dialogue: 'Default action',
      logicRules: [{
        id: 'rule-hero',
        conditionType: 'hero_mana_at_least',
        heroManaThreshold: 1,
        dialogue: 'Hero branch',
        failureDialogue: 'No hero',
      }],
    };

    expect(resolveHotspotInteraction(spot, {
      heroAdventureEnabled: false,
      heroState: { mana: 6 },
    })).toMatchObject({
      actionType: 'dialogue',
      dialogue: 'Default action',
    });
    expect(resolveHotspotInteraction(spot, {
      heroAdventureEnabled: false,
      heroState: { mana: 6 },
    }).logicRuleFailed).toBeUndefined();
  });

  it('switches to the configured second action after completion', () => {
    const spot = {
      id: 'hotspot-1',
      hasSecondAction: true,
      secondActionType: 'cinematic',
      secondDialogue: 'Again',
      secondTargetCinematicId: 'cin-1',
      secondRewardItemId: 'bonus',
    };

    expect(resolveHotspotInteraction(spot, { completedHotspotIds: ['hotspot-1'] })).toMatchObject({
      actionType: 'cinematic',
      dialogue: 'Again',
      targetCinematicId: 'cin-1',
      rewardItemId: 'bonus',
    });
  });

  it('clears one-shot has-item requirements once the disabling rule has been used', () => {
    const spot = {
      id: 'hotspot-1',
      requiredItemId: 'key',
      consumeRequiredItemOnUse: true,
      soundId: 'sound-1',
      logicRules: [{
        id: 'rule-1',
        conditionType: 'has_item',
        itemId: 'key',
        disableAfterUse: true,
      }],
    };

    expect(resolveHotspotInteraction(spot, { usedLogicRuleIds: ['rule-1'] })).toMatchObject({
      requiredItemId: '',
      consumeRequiredItemOnUse: false,
      soundId: '',
    });
  });
});
