import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildStandaloneModuleFiles } from '../utils/standaloneHtml';

const makeProject = (combatPatch = {}) => ({
  id: 'combat-export-project',
  title: 'Combat export',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'start', targetCinematicId: '' },
  heroAdventure: {
    enabled: true,
    dice: { sides: 20, label: 'd20' },
    rules: {
      criticalSuccess: 20,
      criticalFailure: 1,
      criticalChance: 0,
      criticalMultiplier: 2,
    },
    combat: {
      turnMode: true,
      enemyAutoTurn: true,
      enemyStrength: 0,
      ...combatPatch,
    },
    hero: {
      name: 'Ariane',
      health: 12,
      maxHealth: 12,
      mana: 5,
      maxMana: 5,
      skills: [{ id: 'force', name: 'Force', value: 8 }],
      powers: [],
    },
  },
  scenes: [
    {
      id: 'start',
      name: 'Départ',
      hotspots: [{
        id: 'fight',
        name: 'Blob',
        actionType: 'hero_combat',
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        combatEnemyName: 'Blob',
        combatEnemyMaxHealth: 2,
        combatAttackDifficulty: 5,
        combatEnemyStrength: 0,
        combatRewardItemId: 'amulet',
        combatVictoryDialogue: 'Blob vaincu.',
        combatVictoryTargetSceneId: 'victory',
      }],
      sceneObjects: [],
    },
    {
      id: 'victory',
      name: 'Victoire',
      hotspots: [],
      sceneObjects: [],
    },
  ],
  items: [{ id: 'amulet', name: 'Amulette solaire' }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const createElementStub = () => ({
  innerHTML: '',
  style: { setProperty() {} },
  classList: { toggle() {}, add() {}, remove() {} },
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  appendChild() {},
  remove() {},
  click() {},
  setAttribute() {},
  removeAttribute() {},
  load() {},
});

const runStandalone = (project) => {
  const { engineJs } = buildStandaloneModuleFiles(project);
  const root = createElementStub();
  const storage = new Map();
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0.99;

  const context = {
    console,
    Math: deterministicMath,
    URL,
    Blob,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Audio: class {
      constructor() {
        this.volume = 1;
        this.loop = false;
      }

      play() { return Promise.resolve(); }

      pause() {}

      load() {}

      removeAttribute() {}
    },
    Image: class {},
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    document: {
      fullscreenElement: null,
      body: { classList: { toggle() {} }, appendChild() {} },
      documentElement: { requestFullscreen: () => Promise.resolve() },
      exitFullscreen: () => Promise.resolve(),
      addEventListener() {},
      createElement: createElementStub,
      getElementById: (id) => (id === 'game-root' ? root : null),
    },
    window: {
      setTimeout,
      clearTimeout,
      prompt: () => null,
    },
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;

  vm.runInNewContext(
    `${engineJs}\nglobalThis.__standaloneTest = { state, triggerHotspot, attackActiveHeroCombat, rollActiveEnemyCombat };`,
    context,
  );
  return context.__standaloneTest;
};

describe('standalone combat export', () => {
  it('embeds the pure combat engine in engine.js', () => {
    const { engineJs } = buildStandaloneModuleFiles(makeProject());

    expect(engineJs).toContain('const resolveHeroCombatAttack =');
    expect(engineJs).toContain('const resolveEnemyCombatAttack =');
    expect(engineJs).toContain('const resolveCombatVictoryReward =');
    expect(engineJs).toContain("actionType === 'hero_combat'");
  });

  it('runs an exported turn-based combat through the standalone runtime', () => {
    const runtime = runStandalone(makeProject());

    runtime.triggerHotspot('fight');
    expect(runtime.state.activeHeroCombat?.status).toBe('active');
    expect(runtime.state.activeHeroCombat?.enemyHealth).toBe(2);

    runtime.attackActiveHeroCombat('');

    expect(runtime.state.activeHeroCombat?.status).toBe('victory');
    expect(runtime.state.heroCombatStates.fight.defeated).toBe(true);
    expect(runtime.state.inventory).toContain('amulet');
    expect(runtime.state.playSceneId).toBe('victory');
    expect(runtime.state.dialogue).toContain('Blob vaincu');
    expect(runtime.state.dialogue).toContain('Amulette solaire');
  });
});
