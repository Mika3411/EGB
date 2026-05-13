import { describe, expect, it } from 'vitest';
import { buildHeroBalanceReport } from '../components/HeroTab.jsx';
import { DEFAULT_HERO_EDITOR_ADVENTURE } from '../lib/heroAdventureDefaults.js';

const makeBalanceProject = (hotspots) => {
  const heroAdventure = {
    ...DEFAULT_HERO_EDITOR_ADVENTURE,
    enabled: true,
    dice: { sides: 20, label: 'd20', skin: 'classic' },
    rules: {
      criticalSuccess: 20,
      criticalFailure: 1,
      criticalChance: 0,
      criticalMultiplier: 2,
    },
    hero: {
      ...DEFAULT_HERO_EDITOR_ADVENTURE.hero,
      health: 12,
      maxHealth: 12,
      mana: 6,
      maxMana: 6,
      skills: [{ id: 'force', name: 'Force', value: 8, manaCost: 0 }],
      powers: [],
    },
  };

  return {
    project: {
      id: 'hero-balance-report',
      title: 'Hero balance report',
      heroAdventure,
      items: [],
      scenes: [{
        id: 'start',
        name: 'Start',
        hotspots,
        sceneObjects: [],
      }],
      cinematics: [],
    },
    heroAdventure,
  };
};

describe('hero balance report', () => {
  it('uses combat engine mitigation in combat estimates', () => {
    const baseCombat = {
      id: 'open',
      name: 'Open guard',
      actionType: 'hero_combat',
      combatSkillId: 'force',
      combatEnemyName: 'Open guard',
      combatEnemyMaxHealth: 6,
      combatAttackDifficulty: 5,
      combatEnemyStrength: 0,
      combatEnemyPowerUsageChance: 0,
    };
    const resistedCombat = {
      ...baseCombat,
      id: 'armored',
      name: 'Armored guard',
      combatEnemyName: 'Armored guard',
      combatHeroAttackType: 'fire',
      combatEnemyArmor: 6,
      combatEnemyDodgeChance: 100,
      combatEnemyResistanceFire: 100,
    };
    const poweredCombat = {
      ...baseCombat,
      id: 'caster',
      name: 'Caster',
      combatEnemyName: 'Caster',
      combatEnemyMaxHealth: 30,
      combatEnemyMaxMana: 9,
      combatEnemyPowerDamage: 10,
      combatEnemyPowerManaCost: 3,
      combatEnemyPowerUsageChance: 100,
      combatEnemyChaos: 20,
    };
    const { project, heroAdventure } = makeBalanceProject([baseCombat, resistedCombat, poweredCombat]);

    const report = buildHeroBalanceReport(project, heroAdventure, {
      combatIterations: 30,
      combatMaxRounds: 5,
    });

    const open = report.combats.find((combat) => combat.id.startsWith('open-'));
    const armored = report.combats.find((combat) => combat.id.startsWith('armored-'));
    const caster = report.combats.find((combat) => combat.id.startsWith('caster-'));

    expect(open.winProbability).toBeGreaterThan(0.9);
    expect(armored.winProbability).toBeLessThan(open.winProbability);
    expect(armored.timeoutProbability).toBeGreaterThan(0.5);
    expect(armored.mitigationDetails.join(' ')).toContain('armure 6');
    expect(armored.mitigationDetails.join(' ')).toContain('résistance fire 100%');
    expect(armored.mitigationDetails.join(' ')).toContain('esquive 100%');
    expect(caster.survivalProbability).toBeLessThan(1);
    expect(caster.expectedDamage).toBeGreaterThan(0);
    expect(caster.mitigationDetails.join(' ')).toContain('pouvoir ennemi 10 dégâts (100%)');
  });
});
