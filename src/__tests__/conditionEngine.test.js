import { describe, expect, it } from 'vitest';
import {
  evaluateLogicRuleCondition,
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
});
