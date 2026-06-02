import { describe, expect, it } from 'vitest';
import {
  evaluateLogicRuleCondition,
  evaluateReplyCondition,
  getReplyConditionFailureSummary,
  getReplyConditionLockReason,
  getVisitedAwareReplyLabel,
  shouldBlockObjectiveFinalScene,
  isLogicRuleAvailable,
  isLogicRuleConfigured,
} from '../lib/conditionEngine';

describe('condition engine logic rules', () => {
  it('keeps disabled one-shot rules unavailable after use', () => {
    const rule = { id: 'rule-1', disableAfterUse: true, conditionType: 'always' };

    expect(isLogicRuleAvailable(rule, { usedLogicRuleIds: [] })).toBe(true);
    expect(isLogicRuleAvailable(rule, { usedLogicRuleIds: ['rule-1'] })).toBe(false);
    expect(evaluateLogicRuleCondition(rule, { usedLogicRuleIds: ['rule-1'] })).toBe(false);
  });

  it('matches inventory, cinematic, combination, and second-click conditions', () => {
    const context = {
      inventory: ['key'],
      visitedSceneIds: ['scene-2'],
      launchedCinematicIds: ['intro'],
      completedCombinationIds: ['combo-1'],
      chosenConversationReplyIds: ['reply-1'],
      completedHotspotIds: ['hotspot-1'],
      hotspotId: 'hotspot-1',
    };

    expect(evaluateLogicRuleCondition({ conditionType: 'has_item', itemId: 'key' }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'visited_scene', conditionSceneId: 'scene-2' }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'launched_cinematic', cinematicId: 'intro' }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'completed_combination', combinationId: 'combo-1' }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'chose_reply', conditionReplyId: 'reply-1' }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'second_click' }, context)).toBe(true);
  });

  it('matches story variable and advanced logic rule conditions', () => {
    const context = {
      inventory: ['sigil'],
      storyVariables: { trust: 3 },
    };

    expect(evaluateLogicRuleCondition({
      conditionType: 'story_variable',
      conditionVariableKey: 'trust',
      conditionVariableOperator: 'greater_or_equal',
      conditionVariableValue: 3,
    }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({
      conditionType: 'advanced',
      advancedConditionMode: 'all',
      advancedConditions: [
        { type: 'has_item', itemId: 'sigil' },
        { type: 'story_variable', variableKey: 'trust', operator: 'greater_or_equal', value: 3 },
      ],
    }, context)).toBe(true);
  });

  it('matches hero conditions with the shared runtime context', () => {
    const context = {
      heroAdventureEnabled: true,
      heroState: { health: 3, mana: 5 },
      lastDiceRoll: { success: true, skillId: 'ruse' },
    };

    expect(evaluateLogicRuleCondition({ conditionType: 'hero_health_below', heroHealthThreshold: 4 }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'hero_mana_at_least', heroManaThreshold: 5 }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'hero_last_roll_success' }, context)).toBe(true);
    expect(evaluateLogicRuleCondition({ conditionType: 'hero_skill_used', heroSkillId: 'ruse' }, context)).toBe(true);
  });

  it('blocks hero conditions when Hero Adventure is not enabled', () => {
    const context = {
      heroState: { health: 3, mana: 5 },
      lastDiceRoll: { success: true, skillId: 'ruse' },
    };

    expect(evaluateLogicRuleCondition({ conditionType: 'hero_health_below', heroHealthThreshold: 4 }, context)).toBe(false);
    expect(evaluateLogicRuleCondition({ conditionType: 'hero_mana_at_least', heroManaThreshold: 1 }, context)).toBe(false);
    expect(evaluateLogicRuleCondition({ conditionType: 'hero_last_roll_success' }, context)).toBe(false);
    expect(evaluateLogicRuleCondition({ conditionType: 'hero_skill_used', heroSkillId: 'ruse' }, context)).toBe(false);
  });

  it('preserves configured checks used by failure branches', () => {
    expect(isLogicRuleConfigured({ conditionType: 'has_item' })).toBe(false);
    expect(isLogicRuleConfigured({ conditionType: 'has_item', itemId: 'key' })).toBe(true);
    expect(isLogicRuleConfigured({ conditionType: 'visited_scene', conditionSceneId: 'scene-2' })).toBe(true);
    expect(isLogicRuleConfigured({ conditionType: 'solved_enigma', conditionEnigmaId: 'enigma-1' })).toBe(true);
    expect(isLogicRuleConfigured({ conditionType: 'chose_reply', conditionReplyId: 'reply-1' })).toBe(true);
    expect(isLogicRuleConfigured({ conditionType: 'story_variable', conditionVariableKey: 'trust' })).toBe(true);
    expect(isLogicRuleConfigured({ conditionType: 'hero_last_roll_success' })).toBe(true);
  });

  it('keeps locked labels while showing missing reply requirements', () => {
    const reply = {
      lockedLabel: 'Voie fermee.',
      conditionType: 'advanced',
      advancedConditionMode: 'all',
      advancedConditions: [
        { type: 'has_item', itemId: 'key' },
        { type: 'story_variable', variableKey: 'trust', operator: 'greater_or_equal', value: 3 },
      ],
    };
    const reason = getReplyConditionLockReason(reply, {
      inventory: [],
      storyVariables: { trust: 1 },
      project: {
        items: [{ id: 'key', name: 'Clef de la salle' }],
        storyVariables: [{ key: 'trust', journalLabel: 'Confiance' }],
      },
    });

    expect(reason).toContain('Voie fermee.');
    expect(reason).toContain('Prerequis manquants');
    expect(reason).toContain('Clef de la salle');
    expect(reason).toContain('Confiance >= 3 (actuel 1)');
  });

  it('reports incomplete has_item reply conditions', () => {
    const summary = getReplyConditionFailureSummary({
      conditionType: 'advanced',
      advancedConditionMode: 'all',
      advancedConditions: [{ type: 'has_item' }],
    }, {
      inventory: [],
      project: { items: [] },
    });

    expect(summary).toContain("condition d'objet non configuree");
  });

  it('uses neutral wording when a return button targets an unvisited scene', () => {
    const reply = {
      label: 'Retourner au village',
      targetSceneId: 'scene-village',
    };

    expect(getVisitedAwareReplyLabel(reply, { visitedSceneIds: [] })).toBe('Aller au village');
    expect(getVisitedAwareReplyLabel(reply, { visitedSceneIds: ['scene-village'] })).toBe('Retourner au village');
  });

  it('unlocks the Valombre honor duel with honor, the ash blade, and Saint-Oran relic', () => {
    const duelReply = {
      conditionType: 'advanced',
      advancedConditionMode: 'all',
      advancedConditions: [
        { type: 'story_variable', variableKey: 'honneur', operator: 'greater_or_equal', value: 6 },
        { type: 'has_item', itemId: 'item_lame_de_cendre' },
        { type: 'has_item', itemId: 'item_relique_saint_oran' },
      ],
    };

    expect(evaluateReplyCondition(duelReply, {
      inventory: ['item_lame_de_cendre'],
      storyVariables: { honneur: 6 },
    })).toBe(false);
    expect(evaluateReplyCondition(duelReply, {
      inventory: ['item_lame_de_cendre', 'item_relique_saint_oran'],
      storyVariables: { honneur: 6 },
    })).toBe(true);
  });

  it('blocks the configured final scene until at least one objective route is ready', () => {
    const context = {
      inventory: ['item_lame_de_cendre'],
      storyVariables: { honneur: 6 },
      project: {
        heroAdventure: {
          objectiveChecklist: {
            finalSceneId: 'scene_28_salle_des_bannieres',
            blockFinalSceneUntilRouteReady: true,
            routes: [{
              label: "Duel d'honneur",
              conditions: [
                { type: 'story_variable', variableKey: 'honneur', operator: 'greater_or_equal', value: 6 },
                { type: 'has_item', itemId: 'item_lame_de_cendre' },
                { type: 'has_item', itemId: 'item_relique_saint_oran' },
              ],
            }],
          },
        },
      },
    };

    expect(shouldBlockObjectiveFinalScene('scene_28_salle_des_bannieres', context)).toBe(true);
    expect(shouldBlockObjectiveFinalScene('scene_28_salle_des_bannieres', {
      ...context,
      inventory: ['item_lame_de_cendre', 'item_relique_saint_oran'],
    })).toBe(false);
  });
});
