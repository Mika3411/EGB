import { describe, expect, it } from 'vitest';
import { calculateProjectScore } from '../shared/services/projectScoreEngine';

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

  it('scores large classic route maps without changing connection diagnostics', () => {
    const sceneCount = 160;
    const scenes = Array.from({ length: sceneCount }, (_, index) => ({
      id: `scene-${index}`,
      name: `Scene ${index}`,
      introText: `Intro ${index}`,
      hotspots: index < sceneCount - 1 ? [{
        id: `hotspot-${index}`,
        name: 'Suite',
        actionType: 'scene',
        targetSceneId: `scene-${index + 1}`,
      }] : [],
      sceneObjects: [],
    }));
    const rooms = scenes.map((scene, index) => ({
      id: `room-${index}`,
      sceneId: scene.id,
      type: index === 0 ? 'start' : index === sceneCount - 1 ? 'end' : 'room',
    }));
    const connections = Array.from({ length: sceneCount - 1 }, (_, index) => ({
      id: `connection-${index}`,
      fromRoomId: `room-${index}`,
      toRoomId: `room-${index + 1}`,
      allowOneWay: true,
    }));
    const score = calculateProjectScore({
      creationMode: 'beginner',
      start: { type: 'scene', targetSceneId: 'scene-0' },
      acts: [{ id: 'act-1', title: 'Acte 1' }],
      items: [],
      enigmas: [],
      cinematics: [],
      scenes,
      routeMap: { rooms, connections },
    });

    expect(score.metrics.transitions).toBe(sceneCount - 1);
    expect(score.metrics.connectionCounts.accepted).toBe(sceneCount - 1);
    expect(score.metrics.connectionCounts.missing || 0).toBe(0);
    expect(score.metrics.deadPaths).toBe(0);
    expect(score.metrics.blockedProgression).toBe(0);
    expect(score.advancedAnalysis.route.reachableScenes).toBe(sceneCount);
  });
});
