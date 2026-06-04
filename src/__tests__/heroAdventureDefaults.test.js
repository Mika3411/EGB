import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HERO_ADVENTURE,
  DEFAULT_HERO_EDITOR_ADVENTURE,
  normalizeHeroAdventure,
} from '../shared/services/heroAdventureDefaults.js';
import {
  DEFAULT_HERO_ADVENTURE as PREVIEW_DEFAULT_HERO_ADVENTURE,
  normalizeHeroAdventure as normalizePreviewHeroAdventure,
} from '../domains/player/hooks/preview/previewPlayerDefaults.js';

describe('hero adventure defaults', () => {
  it('keeps preview defaults and normalizer exported from the shared source', () => {
    const normalized = normalizePreviewHeroAdventure({ creationMode: 'classic' });

    expect(PREVIEW_DEFAULT_HERO_ADVENTURE).toBe(DEFAULT_HERO_ADVENTURE);
    expect(normalized).toEqual(normalizeHeroAdventure({ creationMode: 'classic' }));
    expect(normalized.enabled).toBe(false);
    expect(normalized.hero.name).toBe('Héros');
    expect(normalized.hero.health).toBe(12);
    expect(normalized.hero.maxHealth).toBe(12);
    expect(normalized.hero.mana).toBe(6);
    expect(normalized.hero.maxMana).toBe(6);
    expect(normalized.hero.skills.map((skill) => skill.value)).toEqual([1, 1, 1, 1]);
    expect(normalized.hero.equipmentSlotLabels[5]).toBe('Jambieres');
  });

  it('preserves preview legacy number handling', () => {
    const normalized = normalizeHeroAdventure({
      heroAdventure: {
        enabled: true,
        dice: { sides: 20 },
        rules: { criticalMultiplier: '2.5' },
        hero: {
          health: '7.5',
          mana: '3.5',
          skills: [{ name: 'Agilité', value: '2.6', rolledValue: '1.2' }],
          powers: [{ name: 'Trait', type: 'void', force: 'bad' }],
        },
      },
    });

    expect(normalized.hero.maxHealth).toBe(7.5);
    expect(normalized.hero.health).toBe(7.5);
    expect(normalized.hero.maxMana).toBe(3.5);
    expect(normalized.hero.mana).toBe(3.5);
    expect(normalized.hero.skills[0]).toMatchObject({
      id: 'skill_0',
      value: 2.6,
      rolledValue: 1.2,
    });
    expect(normalized.hero.powers[0]).toMatchObject({
      id: 'power_0',
      type: 'fire',
      force: 1,
    });
    expect(normalized.rules.criticalMultiplier).toBe(2.5);
  });

  it('keeps HeroDesigner editor defaults available through the shared normalizer profile', () => {
    const normalized = normalizeHeroAdventure({ creationMode: 'classic' }, {
      defaults: DEFAULT_HERO_EDITOR_ADVENTURE,
      profile: 'editor',
    });

    expect(normalized.enabled).toBe(false);
    expect(normalized.hero.name).toBe('Aventurier');
    expect(normalized.hero.health).toBe(18);
    expect(normalized.hero.maxHealth).toBe(18);
    expect(normalized.hero.mana).toBe(10);
    expect(normalized.hero.maxMana).toBe(10);
    expect(normalized.hero.skills.map((skill) => skill.value)).toEqual([3, 2, 2, 4]);
    expect(normalized.hero.equipmentSlotLabels[5]).toBe('Jambières');
    expect(normalized.rules).toMatchObject({
      allowManualAdjustments: true,
      failForward: true,
    });
  });

  it('preserves HeroDesigner editor clamping and generated ids', () => {
    const normalized = normalizeHeroAdventure({
      heroAdventure: {
        enabled: true,
        dice: { sides: '200.8', skin: 'mana' },
        rules: { criticalSuccess: '21.4', failForward: false },
        hero: {
          maxHealth: '18.8',
          health: '9.2',
          maxMana: '6.6',
          mana: '3.2',
          skills: [{ name: 'Agilité vive', value: '4.7', rolledValue: '7', manaCost: '2.2' }],
          powers: [{ name: 'Onde froide', type: 'void', force: '3.6', statusType: 'unknown' }],
        },
        combat: {
          enemyStrength: '2.6',
        },
      },
    }, {
      defaults: DEFAULT_HERO_EDITOR_ADVENTURE,
      profile: 'editor',
    });

    expect(normalized.dice).toMatchObject({ sides: 100, skin: 'mana' });
    expect(normalized.hero).toMatchObject({
      maxHealth: 19,
      health: 9,
      maxMana: 7,
      mana: 3,
    });
    expect(normalized.hero.skills[0]).toMatchObject({
      id: 'agilite_vive',
      value: 5,
      rolledValue: 6,
      manaCost: 2,
    });
    expect(normalized.hero.powers[0]).toMatchObject({
      id: 'onde_froide',
      type: 'fire',
      force: 4,
      statusType: '',
    });
    expect(normalized.rules).toMatchObject({
      criticalSuccess: 21,
      failForward: false,
    });
    expect(normalized.combat.enemyStrength).toBe(3);
  });
});
