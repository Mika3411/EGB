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
    expect(engineJs).toContain('const applyArmor =');
    expect(engineJs).toContain('const applyRecovery =');
    expect(engineJs).toContain('const tickStatusEffects =');
    expect(engineJs).toContain('const applyShield =');
    expect(engineJs).toContain('const getStatusModifiers =');
    expect(engineJs).toContain('const resolveEnemyPowerDecision =');
    expect(engineJs).toContain('const rollDodge =');
    expect(engineJs).toContain('const resolveCombatInitiative =');
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

  it('keeps armor combat rules in exported games', () => {
    const project = makeProject({
      enemyAutoTurn: false,
    });
    project.heroAdventure.hero.armor = 2;
    project.scenes[0].hotspots[0].combatEnemyArmor = 14;
    project.scenes[0].hotspots[0].combatEnemyMaxHealth = 10;
    project.scenes[0].hotspots[0].combatVictoryTargetSceneId = '';
    const runtime = runStandalone(project);

    runtime.triggerHotspot('fight');
    runtime.attackActiveHeroCombat('');

    expect(runtime.state.activeHeroCombat?.enemyHealth).toBe(8);
    expect(runtime.state.dialogue).toContain('Armure -14');
  });

  it('starts exported turn-based combat on the enemy phase when enemy initiative is higher', () => {
    const project = makeProject();
    project.heroAdventure.hero.initiative = 0;
    project.scenes[0].hotspots[0].combatEnemyInitiative = 4;
    const runtime = runStandalone(project);

    runtime.triggerHotspot('fight');

    expect(runtime.state.activeHeroCombat?.phase).toBe('enemy');
    expect(runtime.state.activeHeroCombat?.message).toContain('initiative');
  });

  it('applies healing powers in exported combat', () => {
    const project = makeProject();
    project.heroAdventure.hero.health = 5;
    project.heroAdventure.hero.powers = [
      { id: 'heal', name: 'Soin', type: 'water', manaCost: 1, force: 0, healHealth: 4 },
    ];
    project.scenes[0].hotspots[0].combatEnemyMaxHealth = 100;
    project.scenes[0].hotspots[0].combatVictoryTargetSceneId = '';
    const runtime = runStandalone(project);

    runtime.triggerHotspot('fight');
    runtime.attackActiveHeroCombat('heal');

    expect(runtime.state.heroState.health).toBe(9);
    expect(runtime.state.activeHeroCombat?.message).toContain('Soin: +4 PV');
  });

  it('keeps status effects in exported combat', () => {
    const project = makeProject({ enemyAutoTurn: false });
    project.heroAdventure.hero.skills = [{ id: 'force', name: 'Force', value: 0 }];
    project.heroAdventure.hero.powers = [
      { id: 'poison', name: 'Poison', type: 'earth', manaCost: 0, force: 0, statusType: 'poison', statusAmount: 3, statusDuration: 2 },
    ];
    project.scenes[0].hotspots[0].combatEnemyMaxHealth = 5;
    project.scenes[0].hotspots[0].combatAttackDifficulty = 1;
    project.scenes[0].hotspots[0].combatVictoryTargetSceneId = '';
    const runtime = runStandalone(project);

    runtime.triggerHotspot('fight');
    runtime.attackActiveHeroCombat('poison');

    expect(runtime.state.heroCombatStates.fight.enemyStatusEffects).toEqual([
      { type: 'poison', amount: 3, duration: 2 },
    ]);

    runtime.state.activeHeroCombat.phase = 'enemy';
    runtime.rollActiveEnemyCombat();

    expect(runtime.state.heroCombatStates.fight.enemyHealth).toBe(2);
    expect(runtime.state.dialogue).toContain("PV d'altération");
  });
});
