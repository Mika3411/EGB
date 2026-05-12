import { describe, expect, it } from 'vitest';
import { calculateProjectScore } from '../lib/projectScoreEngine';

const makeHeroProject = ({ combat = null } = {}) => ({
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'start' },
  acts: [{ id: 'act-1', title: 'Acte 1' }],
  items: [{ id: 'reward', name: 'Relique', icon: '*' }],
  enigmas: [],
  cinematics: [],
  heroAdventure: {
    enabled: true,
    hero: {
      maxHealth: 12,
      maxMana: 6,
      skills: [{ id: 'force', name: 'Force', value: 3 }],
    },
  },
  scenes: [
    {
      id: 'start',
      name: 'Depart',
      hotspots: combat ? [combat] : [],
      sceneObjects: [],
    },
    { id: 'victory', name: 'Victoire', hotspots: [], sceneObjects: [] },
      { id: 'defeat', name: 'Défaite', hotspots: [], sceneObjects: [] },
  ],
});

const configuredCombat = {
  id: 'combat-1',
  name: 'Combat',
  actionType: 'hero_combat',
  combatEnemyName: 'Garde',
  combatEnemyStrength: 3,
  combatVictoryDialogue: 'Le passage est libre.',
  combatDefeatDialogue: 'Le heros recule.',
  combatVictoryTargetSceneId: 'victory',
  combatDefeatTargetSceneId: 'defeat',
  combatRewardItemId: 'reward',
};

describe('calculateProjectScore hero combat analysis', () => {
  it('counts hero combats in score diagnostics, playtime, and player complexity', () => {
    const withoutCombat = calculateProjectScore(makeHeroProject());
    const withCombat = calculateProjectScore(makeHeroProject({ combat: configuredCombat }));

    const combatCriterion = withCombat.sectionDetails.content.criteria.find((criterion) => criterion.id === 'heroCombats');
    const noCombatCriterion = withoutCombat.sectionDetails.content.criteria.find((criterion) => criterion.id === 'heroCombats');

    expect(noCombatCriterion.score).toBe(0);
    expect(withCombat.metrics.heroCombats).toBe(1);
    expect(withCombat.metrics.heroCombatIssues).toBe(0);
    expect(combatCriterion.score).toBeGreaterThan(0);
    expect(withCombat.metrics.estimatedMinutes).toBeGreaterThan(withoutCombat.metrics.estimatedMinutes);
    expect(withCombat.playerScore.complexity.heroCombatPressure).toBeGreaterThan(0);
    expect(withCombat.badges.some((badge) => badge.id === 'hero-combat-ready')).toBe(true);
    expect(withoutCombat.feedback.some((entry) => entry.metric === '0 combat')).toBe(true);
  });
});
