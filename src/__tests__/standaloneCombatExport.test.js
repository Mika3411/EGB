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

const makeSkillCheckProject = (hotspotPatch = {}, heroPatch = {}) => ({
  id: 'skill-check-export-project',
  title: 'Skill check export',
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
    hero: {
      name: 'Ariane',
      health: 10,
      maxHealth: 10,
      mana: 4,
      maxMana: 4,
      skills: [{ id: 'agility', name: 'Agility', value: 3 }],
      powers: [],
      ...heroPatch,
    },
  },
  scenes: [
    {
      id: 'start',
      name: 'Start',
      hotspots: [{
        id: 'door',
        name: 'Door',
        actionType: 'skill_check',
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        skillCheckSkillId: 'agility',
        skillCheckDifficulty: 18,
        skillCheckManaCost: 2,
        skillCheckSuccessDialogue: 'Door opens.',
        skillCheckFailureDialogue: 'Door resists.',
        skillCheckFailureHealthLoss: 0,
        skillCheckSuccessTargetSceneId: 'treasure',
        skillCheckSuccessRewardItemId: 'gem',
        ...hotspotPatch,
      }],
      sceneObjects: [],
    },
    {
      id: 'treasure',
      name: 'Treasure',
      hotspots: [],
      sceneObjects: [],
    },
  ],
  items: [{ id: 'gem', name: 'Gem' }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const makeConversationSkillCheckProject = () => {
  const project = makeSkillCheckProject();
  project.scenes[0].hotspots = [{
    id: 'sage',
    name: 'Sage',
    actionType: 'conversation',
    x: 50,
    y: 50,
    width: 20,
    height: 20,
    conversation: {
      startNodeId: 'intro',
      nodes: [
        {
          id: 'intro',
          speaker: 'Sage',
          text: 'Can you pass?',
          replies: [{
            id: 'try',
            label: 'Try',
            actionType: 'skill_check',
            skillCheckSkillId: 'agility',
            skillCheckDifficulty: 18,
            skillCheckManaCost: 1,
            skillCheckSuccessDialogue: 'You pass.',
            skillCheckFailureDialogue: 'You fail.',
            skillCheckSuccessNextNodeId: 'success',
            skillCheckFailureNextNodeId: 'failure',
          }],
        },
        {
          id: 'success',
          speaker: 'Sage',
          text: 'Passed.',
          replies: [],
        },
        {
          id: 'failure',
          speaker: 'Sage',
          text: 'Failed.',
          replies: [],
        },
      ],
    },
  }];
  return project;
};

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

const runStandalone = (project, random = () => 0.99) => {
  const { engineJs } = buildStandaloneModuleFiles(project);
  const root = createElementStub();
  const storage = new Map();
  const deterministicMath = Object.create(Math);
  deterministicMath.random = random;

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
    `${engineJs}\nglobalThis.__standaloneTest = { state, triggerHotspot, chooseConversationReply, attackActiveHeroCombat, rollActiveEnemyCombat };`,
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

  it('runs an exported hotspot skill check with mana, reward and scene routing', () => {
    const runtime = runStandalone(makeSkillCheckProject());

    runtime.triggerHotspot('door');

    expect(runtime.state.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      skillId: 'agility',
      raw: 20,
      modifier: 3,
      total: 23,
      difficulty: 18,
      success: true,
    });
    expect(runtime.state.heroState.mana).toBe(2);
    expect(runtime.state.inventory).toContain('gem');
    expect(runtime.state.completedHotspotIds).toContain('door');
    expect(runtime.state.playSceneId).toBe('treasure');
    expect(runtime.state.dialogue).toContain('Door opens.');
  });

  it('forces exported skill check success on critical success', () => {
    const runtime = runStandalone(makeSkillCheckProject({
      skillCheckDifficulty: 30,
      skillCheckManaCost: 0,
    }, {
      skills: [{ id: 'agility', name: 'Agility', value: 0 }],
    }));

    runtime.triggerHotspot('door');

    expect(runtime.state.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      raw: 20,
      modifier: 0,
      total: 20,
      difficulty: 30,
      isCriticalSuccess: true,
      isCriticalFailure: false,
      success: true,
    });
    expect(runtime.state.inventory).toContain('gem');
    expect(runtime.state.playSceneId).toBe('treasure');
    expect(runtime.state.dialogue).toContain('Réussite critique contre 30');
    expect(runtime.state.dialogue).toContain('Door opens.');
  });

  it('forces exported skill check failure on critical failure', () => {
    const runtime = runStandalone(makeSkillCheckProject({
      skillCheckDifficulty: 10,
      skillCheckManaCost: 0,
      skillCheckFailureHealthLoss: 2,
    }, {
      skills: [{ id: 'agility', name: 'Agility', value: 30 }],
    }), () => 0);

    runtime.triggerHotspot('door');

    expect(runtime.state.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      raw: 1,
      modifier: 30,
      total: 31,
      difficulty: 10,
      isCriticalSuccess: false,
      isCriticalFailure: true,
      success: false,
    });
    expect(runtime.state.heroState.health).toBe(8);
    expect(runtime.state.inventory).not.toContain('gem');
    expect(runtime.state.playSceneId).toBe('start');
    expect(runtime.state.dialogue).toContain('Échec critique contre 10');
    expect(runtime.state.dialogue).toContain('Door resists.');
  });

  it('keeps exported normal skill check comparison unchanged', () => {
    const runtime = runStandalone(makeSkillCheckProject({
      skillCheckDifficulty: 13,
      skillCheckManaCost: 0,
    }), () => 0.45);

    runtime.triggerHotspot('door');

    expect(runtime.state.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      raw: 10,
      modifier: 3,
      total: 13,
      difficulty: 13,
      isCriticalSuccess: false,
      isCriticalFailure: false,
      success: true,
    });
    expect(runtime.state.playSceneId).toBe('treasure');
    expect(runtime.state.dialogue).toContain('Réussite contre 13');
    expect(runtime.state.dialogue).not.toContain('critique');
  });

  it('applies exported skill check failure health loss', () => {
    const runtime = runStandalone(makeSkillCheckProject({
      skillCheckDifficulty: 20,
      skillCheckManaCost: 1,
      skillCheckFailureHealthLoss: 3,
      skillCheckSuccessTargetSceneId: '',
      skillCheckSuccessRewardItemId: '',
    }), () => 0);

    runtime.triggerHotspot('door');

    expect(runtime.state.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      raw: 1,
      total: 4,
      difficulty: 20,
      success: false,
    });
    expect(runtime.state.heroState.health).toBe(7);
    expect(runtime.state.heroState.mana).toBe(3);
    expect(runtime.state.inventory).not.toContain('gem');
    expect(runtime.state.completedHotspotIds).toContain('door');
    expect(runtime.state.playSceneId).toBe('start');
    expect(runtime.state.dialogue).toContain('Door resists.');
  });

  it('routes exported conversation skill checks to the configured next node', () => {
    const runtime = runStandalone(makeConversationSkillCheckProject());

    runtime.triggerHotspot('sage');
    const reply = runtime.state.activeConversation.conversation.nodes[0].replies[0];
    runtime.chooseConversationReply(reply);

    expect(runtime.state.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      success: true,
      raw: 20,
      difficulty: 18,
    });
    expect(runtime.state.heroState.mana).toBe(3);
    expect(runtime.state.completedHotspotIds).toContain('sage');
    expect(runtime.state.activeConversation.nodeId).toBe('success');
    expect(runtime.state.askedConversationNodeIds).toContain('success');
    expect(runtime.state.dialogue).toContain('You pass.');
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
