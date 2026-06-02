import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildStandaloneModuleFiles } from '../utils/standaloneHtml';

const makeHeroAdventureStoryProject = () => ({
  id: 'hero-story-e2e',
  title: 'Hero Story E2E',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'gate', targetCinematicId: '' },
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
      enemyAutoTurn: false,
      heroDieDamagePercent: 0,
      enemyDieDamagePercent: 0,
      enemyPowerUsageChance: 0,
      enemyCriticalChance: 0,
    },
    hero: {
      id: 'hero-1',
      name: 'Ariane',
      health: 4,
      maxHealth: 10,
      mana: 2,
      maxMana: 5,
      initiative: 0,
      armor: 0,
      equipmentSlotCount: 4,
      skills: [
        { id: 'force', name: 'Force', value: 3, manaCost: 0 },
        { id: 'survie', name: 'Survie', value: 20, manaCost: 0 },
      ],
      powers: [],
    },
  },
  scenes: [{
    id: 'gate',
    name: 'Gate',
    introText: 'A sealed gate waits.',
    hotspots: [{
      id: 'open-gate',
      name: 'Open gate',
      actionType: 'skill_check',
      skillCheckSkillId: 'force',
      skillCheckDifficulty: 10,
      skillCheckManaCost: 1,
      skillCheckSuccessDialogue: 'The gate opens.',
      skillCheckSuccessTargetSceneId: 'armory',
      skillCheckSuccessRewardItemId: 'health-potion',
      skillCheckFailureDialogue: 'The gate holds.',
      skillCheckFailureHealthLoss: 2,
      x: 40,
      y: 40,
      width: 20,
      height: 20,
    }],
    sceneObjects: [],
  }, {
    id: 'armory',
    name: 'Armory',
    introText: 'Old steel lines the wall.',
    hotspots: [{
      id: 'take-sword',
      name: 'Take sword',
      actionType: 'dialogue_item',
      dialogue: 'You take the sword.',
      rewardItemId: 'sword',
      x: 30,
      y: 45,
      width: 20,
      height: 20,
    }, {
      id: 'guardian',
      name: 'Guardian',
      actionType: 'hero_combat',
      combatEnemyName: 'Guardian',
      combatEnemyMaxHealth: 7,
      combatAttackDifficulty: 8,
      combatEnemyStrength: 0,
      combatEnemyMaxMana: 0,
      combatEnemyPowerUsageChance: 0,
      combatRewardItemId: 'relic',
      combatVictoryDialogue: 'Guardian defeated.',
      combatVictoryTargetSceneId: 'victory',
      x: 55,
      y: 45,
      width: 20,
      height: 20,
    }],
    sceneObjects: [],
  }, {
    id: 'victory',
    name: 'Victory',
    introText: 'The relic hums.',
    hotspots: [{
      id: 'shadow',
      name: 'Shadow',
      actionType: 'hero_combat',
      combatEnemyName: 'Shadow',
      combatEnemyMaxHealth: 99,
      combatAttackDifficulty: 99,
      combatEnemyInitiative: 10,
      combatEnemyStrength: 99,
      combatEnemyChaos: 10,
      combatEnemyMaxMana: 0,
      combatEnemyPowerUsageChance: 0,
      combatDefeatDialogue: 'The shadow wins.',
      combatDefeatTargetSceneId: 'defeat',
      x: 50,
      y: 50,
      width: 20,
      height: 20,
    }],
    sceneObjects: [],
  }, {
    id: 'defeat',
    name: 'Defeat',
    introText: 'The story ends here.',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [{
    id: 'health-potion',
    name: 'Health Potion',
    heroItemType: 'health_potion',
    heroItemAmount: 5,
    heroItemConsumeOnUse: true,
  }, {
    id: 'sword',
    name: 'Sword',
    heroItemType: 'equipment',
    heroItemBonusTarget: 'skill',
    heroItemSkillId: 'force',
    heroItemBonus: 4,
    heroItemConsumeOnUse: false,
  }, {
    id: 'relic',
    name: 'Relic',
  }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const makeHeroAdventureObjectiveProject = () => ({
  id: 'hero-objective-e2e',
  title: 'Valombre Test',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'approach', targetCinematicId: '' },
  heroAdventure: {
    enabled: true,
    dice: { sides: 20, label: 'd20' },
    objectiveChecklist: {
      title: 'Objectif: arreter Morholt',
      description: 'Prepare au moins une voie finale.',
      finalSceneId: 'scene_28_salle_des_bannieres',
      blockFinalSceneUntilRouteReady: true,
      routes: [
        {
          id: 'alliances',
          label: 'Voie des alliances',
          successText: 'Les allies peuvent charger Morholt.',
          conditions: [
            { type: 'has_item', itemId: 'item_sifflet_gardebois', label: 'Sifflet des garde-bois' },
            { type: 'has_item', itemId: 'item_corne_des_prisonniers', label: 'Corne des prisonniers' },
            { type: 'story_variable', variableKey: 'alliances', operator: 'greater_or_equal', value: 4, label: 'alliances >= 4' },
          ],
        },
        {
          id: 'honneur',
          label: "Duel d'honneur",
          successText: 'Morholt ne peut plus refuser le duel.',
          conditions: [
            { type: 'story_variable', variableKey: 'honneur', operator: 'greater_or_equal', value: 6, label: 'honneur >= 6' },
            { type: 'has_item', itemId: 'item_lame_de_cendre', label: 'Lame de cendre' },
            { type: 'has_item', itemId: 'item_relique_saint_oran', label: 'Relique de Saint-Oran' },
          ],
        },
        {
          id: 'ombre',
          label: "Voie de l'ombre",
          successText: 'Les tentures noires deviennent une ouverture.',
          conditions: [
            { type: 'story_variable', variableKey: 'ombre', operator: 'greater_or_equal', value: 5, label: 'ombre >= 5' },
            { type: 'has_item', itemId: 'item_passe_deserteur', label: 'Passe de deserteur' },
            { type: 'has_item', itemId: 'item_sceau_de_pierre', label: 'Sceau de pierre' },
          ],
        },
      ],
    },
    hero: {
      id: 'hero-1',
      name: 'Ariane',
      health: 10,
      maxHealth: 10,
      mana: 5,
      maxMana: 5,
      skills: [{ id: 'force', name: 'Force', value: 3, manaCost: 0 }],
      powers: [],
    },
  },
  scenes: [{
    id: 'approach',
    name: 'Approche',
    introText: 'La salle est proche.',
    hotspots: [{
      id: 'route-choice',
      name: 'Route',
      actionType: 'conversation',
      x: 30,
      y: 30,
      width: 20,
      height: 20,
      conversation: {
        startNodeId: 'node-route',
        nodes: [{
          id: 'node-route',
          speaker: 'Route',
          text: 'Choisis une direction.',
          replies: [{
            id: 'r_return_village',
            label: 'Retourner au village',
            actionType: 'scene',
            targetSceneId: 'village',
          }],
        }],
      },
    }],
    sceneObjects: [],
  }, {
    id: 'village',
    name: 'Village',
    introText: 'Le village attend.',
    hotspots: [],
    sceneObjects: [],
  }, {
    id: 'scene_28_salle_des_bannieres',
    name: 'Salle des bannieres',
    introText: 'Morholt attend.',
    hotspots: [{
      id: 'morholt',
      name: 'Morholt',
      actionType: 'conversation',
      x: 45,
      y: 45,
      width: 20,
      height: 20,
      conversation: {
        startNodeId: 'node-final',
        nodes: [{
          id: 'node-final',
          speaker: 'Morholt',
          text: 'Choisis ta voie.',
          replies: [
            {
              id: 'r_s28_allies',
              label: 'Appeler les allies',
              showWhenLocked: true,
              lockedLabel: 'Voie des alliances incomplete.',
              conditionType: 'advanced',
              advancedConditionMode: 'all',
              advancedConditions: [
                { type: 'has_item', itemId: 'item_sifflet_gardebois', label: 'Sifflet des garde-bois' },
                { type: 'has_item', itemId: 'item_corne_des_prisonniers', label: 'Corne des prisonniers' },
                { type: 'story_variable', variableKey: 'alliances', operator: 'greater_or_equal', value: 4, label: 'alliances >= 4' },
              ],
            },
            {
              id: 'r_s28_duel',
              label: "Provoquer Morholt en duel d'honneur",
              showWhenLocked: true,
              lockedLabel: "Duel d'honneur incomplet.",
              conditionType: 'advanced',
              advancedConditionMode: 'all',
              advancedConditions: [
                { type: 'story_variable', variableKey: 'honneur', operator: 'greater_or_equal', value: 6, label: 'honneur >= 6' },
                { type: 'has_item', itemId: 'item_lame_de_cendre', label: 'Lame de cendre' },
                { type: 'has_item', itemId: 'item_relique_saint_oran', label: 'Relique de Saint-Oran' },
              ],
            },
            {
              id: 'r_s28_ombre',
              label: "Frapper depuis l'ombre",
              showWhenLocked: true,
              lockedLabel: "Voie de l'ombre incomplete.",
              conditionType: 'advanced',
              advancedConditionMode: 'all',
              advancedConditions: [
                { type: 'story_variable', variableKey: 'ombre', operator: 'greater_or_equal', value: 5, label: 'ombre >= 5' },
                { type: 'has_item', itemId: 'item_passe_deserteur', label: 'Passe de deserteur' },
                { type: 'has_item', itemId: 'item_sceau_de_pierre', label: 'Sceau de pierre' },
              ],
            },
          ],
        }],
      },
    }],
    sceneObjects: [],
  }],
  items: [
    { id: 'item_sifflet_gardebois', name: 'Sifflet des garde-bois' },
    { id: 'item_corne_des_prisonniers', name: 'Corne des prisonniers' },
    { id: 'item_lame_de_cendre', name: 'Lame de cendre' },
    { id: 'item_relique_saint_oran', name: 'Relique de Saint-Oran' },
    { id: 'item_passe_deserteur', name: 'Passe de deserteur' },
    { id: 'item_sceau_de_pierre', name: 'Sceau de pierre' },
  ],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [
    { key: 'alliances', journalLabel: 'alliances' },
    { key: 'honneur', journalLabel: 'honneur' },
    { key: 'ombre', journalLabel: 'ombre' },
  ],
});

const createElementStub = () => ({
  innerHTML: '',
  textContent: '',
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

const makeSequenceRandom = (values = []) => {
  let index = 0;
  return () => {
    const value = index < values.length ? values[index] : values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
};

const runStandalone = (project, random = () => 0) => {
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
      getElementById: (id) => (id === 'game-root' ? root : createElementStub()),
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
    `${engineJs}
globalThis.__standaloneTest = {
  state,
  render,
  goToScene,
  saveGame,
  loadGame,
  triggerHotspot,
  openInventoryItem,
  attackActiveHeroCombat,
  rollActiveEnemyCombat,
  attemptSurvivalHeroCombat
};`,
    context,
  );

  return { runtime: context.__standaloneTest, storage, root };
};

describe('standalone hero adventure story e2e', () => {
  it('uses neutral wording for standalone return buttons that target unvisited scenes', () => {
    const { runtime, root } = runStandalone(makeHeroAdventureObjectiveProject());

    runtime.triggerHotspot('route-choice');

    expect(root.innerHTML).toContain('Aller au village');
    expect(root.innerHTML).not.toContain('Retourner au village');

    runtime.state.visitedSceneIds = ['approach', 'village'];
    runtime.state.activeConversation = null;
    runtime.triggerHotspot('route-choice');

    expect(root.innerHTML).toContain('Retourner au village');
  });

  it('shows final objective routes in a drawer and keeps technical locks in conversation details', () => {
    const { runtime, root } = runStandalone(makeHeroAdventureObjectiveProject());

    runtime.state.objectiveDrawerOpen = true;
    runtime.render(false);

    expect(root.innerHTML).toContain('Objectif: arreter Morholt');
    expect(root.innerHTML).toContain('Voie des alliances');
    expect(root.innerHTML).toContain('Sifflet des garde-bois');
    expect(root.innerHTML).toContain('Corne des prisonniers');
    expect(root.innerHTML).toContain('alliances &gt;= 4');

    runtime.state.objectiveDrawerOpen = false;
    runtime.state.playSceneId = 'scene_28_salle_des_bannieres';
    runtime.render(false);
    runtime.triggerHotspot('morholt');

    expect(root.innerHTML).not.toContain('adventure-objective-card');
    expect(root.innerHTML).toContain('Voie des alliances incomplete.');
    expect(root.innerHTML).toContain("Duel d'honneur incomplet.");
    expect(root.innerHTML).toContain("Voie de l'ombre incomplete.");
    expect(root.innerHTML).toContain('Sifflet des garde-bois');
    expect(root.innerHTML).toContain('Corne des prisonniers');
    expect(root.innerHTML).toContain('alliances &gt;= 4');
    expect(root.innerHTML).toContain('honneur &gt;= 6');
    expect(root.innerHTML).toContain('Lame de cendre');
    expect(root.innerHTML).toContain('Relique de Saint-Oran');
    expect(root.innerHTML).toContain('ombre &gt;= 5');
    expect(root.innerHTML).toContain('Passe de deserteur');
    expect(root.innerHTML).toContain('Sceau de pierre');
  });

  it('blocks standalone entry to the objective final scene until a route is ready', () => {
    const { runtime } = runStandalone(makeHeroAdventureObjectiveProject());

    expect(runtime.state.playSceneId).toBe('approach');
    expect(runtime.goToScene('scene_28_salle_des_bannieres', 'La porte de Morholt s ouvre.')).toBe(false);
    expect(runtime.state.playSceneId).toBe('approach');
    expect(runtime.state.dialogue).toContain("Tu n'as pas encore de prise suffisante");
    expect(runtime.state.dialogue).toContain('tiroir Objectif');
    expect(runtime.state.dialogue).toContain('Relique de Saint-Oran');

    runtime.state.inventory = ['item_lame_de_cendre', 'item_relique_saint_oran'];
    runtime.state.storyVariables = { honneur: 6 };

    expect(runtime.goToScene('scene_28_salle_des_bannieres', 'La porte de Morholt s ouvre.')).toBe(true);
    expect(runtime.state.playSceneId).toBe('scene_28_salle_des_bannieres');
  });

  it('plays a full exported story through skill check, items, save/load, victory and defeat', () => {
    const { runtime, storage } = runStandalone(
      makeHeroAdventureStoryProject(),
      makeSequenceRandom([0.55, 0]),
    );

    runtime.triggerHotspot('open-gate');

    expect(runtime.state.playSceneId).toBe('armory');
    expect(runtime.state.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      skillId: 'force',
      raw: 12,
      modifier: 3,
      difficulty: 10,
      success: true,
    });
    expect(runtime.state.heroState.mana).toBe(1);
    expect(runtime.state.inventory).toContain('health-potion');

    runtime.openInventoryItem('health-potion');

    expect(runtime.state.heroState.health).toBe(9);
    expect(runtime.state.inventory).not.toContain('health-potion');
    expect(runtime.state.dialogue).toContain('+5 PV (9/10)');

    runtime.triggerHotspot('take-sword');
    runtime.openInventoryItem('sword');

    expect(runtime.state.inventory).toContain('sword');
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 0: 'sword' });
    expect(runtime.state.heroState.skills.find((skill) => skill.id === 'force').value).toBe(7);

    expect(runtime.saveGame(false)).toBe(true);
    const saveKey = Array.from(storage.keys()).find((key) => key.startsWith('escapeGameSave:'));
    const savedState = JSON.parse(storage.get(saveKey));
    expect(savedState.heroState.health).toBe(9);
    expect(savedState.equippedHeroItemIds).toEqual(['sword']);
    expect(savedState.equippedHeroSlotMap).toEqual({ 0: 'sword' });

    Object.assign(runtime.state, {
      playSceneId: 'gate',
      inventory: [],
      equippedHeroItemIds: [],
      equippedHeroSlotMap: {},
      heroState: {
        ...runtime.state.heroState,
        health: 1,
        mana: 0,
        skills: runtime.state.heroState.skills.map((skill) => (
          skill.id === 'force' ? { ...skill, value: 3 } : skill
        )),
      },
    });

    expect(runtime.loadGame(false)).toBe(true);
    expect(runtime.state.playSceneId).toBe('armory');
    expect(runtime.state.heroState.health).toBe(9);
    expect(runtime.state.heroState.mana).toBe(1);
    expect(runtime.state.inventory).toEqual(['sword']);
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword']);
    expect(runtime.state.heroState.skills.find((skill) => skill.id === 'force').value).toBe(7);

    runtime.triggerHotspot('guardian');
    expect(runtime.state.activeHeroCombat).toMatchObject({
      id: 'guardian',
      status: 'active',
      enemyHealth: 7,
    });

    runtime.attackActiveHeroCombat('', { rawRoll: 12 });

    expect(runtime.state.activeHeroCombat).toMatchObject({
      id: 'guardian',
      status: 'victory',
      enemyHealth: 0,
    });
    expect(runtime.state.heroCombatStates.guardian.defeated).toBe(true);
    expect(runtime.state.inventory).toEqual(['sword', 'relic']);
    expect(runtime.state.playSceneId).toBe('victory');
    expect(runtime.state.activeHeroCombat.message).toContain('Guardian defeated.');

    runtime.triggerHotspot('shadow');
    expect(runtime.state.activeHeroCombat).toMatchObject({
      id: 'shadow',
      status: 'active',
      phase: 'enemy',
    });

    runtime.rollActiveEnemyCombat();
    expect(runtime.state.heroState.health).toBe(0);
    expect(runtime.state.activeHeroCombat).toMatchObject({
      id: 'shadow',
      status: 'active',
      phase: 'survival',
    });

    expect(runtime.attemptSurvivalHeroCombat()).toBe(true);
    expect(runtime.state.heroState.health).toBe(1);
    expect(runtime.state.heroCombatStates.shadow.survivalUsed).toBe(true);
    expect(runtime.state.activeHeroCombat.phase).toBe('hero');

    runtime.attackActiveHeroCombat('', { rawRoll: 1 });
    expect(runtime.state.activeHeroCombat.phase).toBe('enemy');

    runtime.rollActiveEnemyCombat();

    expect(runtime.state.heroState.health).toBe(0);
    expect(runtime.state.activeHeroCombat).toMatchObject({
      id: 'shadow',
      status: 'defeat',
      phase: 'ended',
    });
    expect(runtime.state.playSceneId).toBe('defeat');
    expect(runtime.state.activeHeroCombat.message).toContain('The shadow wins.');
  });
});
