import vm from 'node:vm';
import JSZip from 'jszip';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { buildStandaloneModuleFiles } from '../utils/standaloneHtml';
import { buildStandaloneCss } from '../utils/standalone/standaloneCss';
import { exportStandalone } from '../utils/exportStandalone';
import { downloadBlob } from '../utils/fileHelpers';

vi.mock('../utils/fileHelpers', () => ({
  downloadBlob: vi.fn(),
}));

const remoteStandaloneBackgroundUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/offline-background.png';
const remoteStandaloneMissingAudioUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/missing-theme.mp3';

const makeFetchResponse = (body, { contentType = '', ok = true, status = 200, statusText = 'OK' } = {}) => ({
  ok,
  status,
  statusText,
  headers: {
    get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null),
  },
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

const makeStandaloneProject = () => ({
  id: 'standalone-critical',
  title: 'Standalone Critical',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    actId: 'act-1',
    backgroundData: 'data:image/png;base64,c2NlbmU=',
    backgroundName: 'Hall final.png',
    musicData: 'data:audio/mpeg;base64,bXVzaWM=',
    musicName: 'Theme.mp3',
    hotspots: [{
      id: 'spot-key',
      name: 'Coffret',
      x: 45,
      y: 50,
      width: 12,
      height: 12,
      actionType: 'dialogue_item',
      dialogue: 'Tu prends la cle.',
      rewardItemId: 'key',
      objectImageData: 'data:image/png;base64,aG90c3BvdA==',
      objectImageName: 'Coffret.png',
    }],
    sceneObjects: [{
      id: 'visible-note',
      name: 'Note visible',
      blockType: 'text',
      x: 30,
      y: 40,
      width: 15,
      height: 10,
      blockText: 'Indice',
    }],
  }],
  items: [{
    id: 'key',
    name: 'Cle',
    imageData: 'data:image/png;base64,aXRlbQ==',
    imageName: 'Cle.png',
  }],
  enigmas: [],
  cinematics: [{
    id: 'cin-1',
    name: 'Intro',
    cinematicType: 'slides',
    slides: [{
      id: 'slide-1',
      narration: 'La porte tremble.',
      imageData: 'data:image/png;base64,c2xpZGU=',
      imageName: 'Slide.png',
      audioData: 'data:audio/mpeg;base64,YXVkaW8=',
      audioName: 'Slide.mp3',
    }],
    steps: [],
    onEndType: 'none',
  }],
  combinations: [],
  assets: [],
  storyVariables: [{
    id: 'var-score',
    key: 'score',
    type: 'number',
    defaultValue: 0,
    journalVisible: true,
  }],
});

const makeStandaloneCombatMediaProject = () => ({
  id: 'standalone-combat-media',
  title: 'Standalone Combat Media',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
  acts: [{ id: 'act-1', name: 'Acte 1' }],
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
      id: 'hero-1',
      name: 'Ariane',
      health: 10,
      maxHealth: 10,
      mana: 3,
      maxMana: 3,
      skills: [{ id: 'force', name: 'Force', value: 4 }],
      powers: [],
      characterImageData: 'data:image/png;base64,aGVybw==',
    },
    combat: {
      turnMode: true,
      backgroundImageData: 'data:image/png;base64,YXJlbmE=',
      backgroundImageName: 'Combat Arena.png',
      heroImageData: 'data:image/png;base64,Z2xvYmFsLWhlcm8=',
      heroImageName: 'Global Hero.png',
      enemyImageData: 'data:image/png;base64,Z2xvYmFsLWVuZW15',
      enemyImageName: 'Global Enemy.png',
      heroHitEffectMediaType: 'video',
      heroHitEffectVideoData: 'data:video/mp4;base64,aGVyby12aWRlbw==',
      heroHitEffectVideoName: 'Hero Impact.mp4',
      heroHitEffectAudioData: 'data:audio/mpeg;base64,aGVyby1hdWRpbw==',
      heroHitEffectAudioName: 'Hero Impact.mp3',
      enemyDeathEffectMediaType: 'video',
      enemyDeathEffectVideoData: 'data:video/mp4;base64,ZW5lbXktdmlkZW8=',
      enemyDeathEffectVideoName: 'Enemy Death.mp4',
      enemyDeathEffectAudioData: 'data:audio/ogg;base64,ZW5lbXktYXVkaW8=',
      enemyDeathEffectAudioName: 'Enemy Death.ogg',
    },
  },
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    actId: 'act-1',
    hotspots: [{
      id: 'combat-hotspot',
      name: 'Gardien',
      actionType: 'hero_combat',
      x: 40,
      y: 50,
      width: 20,
      height: 20,
      combatEnemyName: 'Gardien',
      combatEnemyMaxHealth: 3,
      combatBackgroundImageData: 'data:image/png;base64,aG90c3BvdC1iZw==',
      combatBackgroundImageName: 'Hotspot Combat BG.png',
      combatEnemyImageData: 'data:image/png;base64,aG90c3BvdC1lbmVteQ==',
      combatEnemyImageName: 'Hotspot Enemy.png',
    }, {
      id: 'talk',
      name: 'Oracle',
      actionType: 'conversation',
      x: 20,
      y: 30,
      width: 18,
      height: 18,
      conversation: {
        startNodeId: 'intro',
        nodes: [{
          id: 'intro',
          speaker: 'Oracle',
          text: 'Un duel?',
          replies: [{
            id: 'fight-reply',
            label: 'Combattre',
            actionType: 'hero_combat',
            combatEnemyName: 'Ombre',
            combatEnemyMaxHealth: 2,
            combatHeroImageData: 'data:image/png;base64,cmVwbHktaGVybw==',
            combatHeroImageName: 'Reply Hero.png',
          }],
        }],
      },
    }],
    sceneObjects: [],
  }],
  items: [],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const makeStandaloneOnlineCompatibilityProject = () => ({
  id: 'standalone-online-compatibility',
  title: 'Standalone Online Compatibility',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  assets: [{
    id: 'remote-background',
    type: 'image',
    name: 'Remote Background.png',
    url: 'https://project.supabase.co/storage/v1/object/public/game-media/remote-background.png',
  }],
  heroAdventure: {
    enabled: true,
    hero: {
      id: 'hero-1',
      name: 'Ariane',
      health: 10,
      maxHealth: 10,
      mana: 3,
      maxMana: 3,
      skills: [],
      powers: [],
      characterImageData: 'data:image/png;base64,aGVyby1ub24tbGVnYWN5',
      setupMusicData: 'data:audio/mpeg;base64,c2V0dXAtbm9uLWxlZ2FjeQ==',
      setupMusicName: 'Setup.mp3',
    },
    combat: {
      backgroundImageData: 'data:image/png;base64,Y29tYmF0LWxlZ2FjeQ==',
      backgroundImageName: 'Legacy Combat.png',
    },
  },
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    actId: 'act-1',
    backgroundData: 'https://project.supabase.co/storage/v1/object/public/game-media/remote-background.png',
    backgroundName: 'Remote Background.png',
    hotspots: [{
      id: 'talk',
      name: 'Oracle',
      actionType: 'conversation',
      x: 20,
      y: 30,
      width: 18,
      height: 18,
      conversation: {
        startNodeId: 'intro',
        nodes: [{
          id: 'intro',
          speaker: 'Oracle',
          text: 'Ecoute.',
          replies: [{
            id: 'reply-image',
            label: 'Voir',
            actionType: 'end',
            responseImageData: 'data:image/png;base64,cmVzcG9uc2Utbm9uLWxlZ2FjeQ==',
            responseSoundData: 'data:audio/mpeg;base64,cmVzcG9uc2Utc291bmQ=',
            npcPortraitData: 'https://cdn.example.com/oracle.webp',
          }],
        }],
      },
    }],
    sceneObjects: [],
  }],
  items: [],
  enigmas: [],
  cinematics: [],
  combinations: [],
  storyVariables: [],
});

const makeStandaloneOfflineOptionProject = () => ({
  id: 'standalone-offline-option',
  title: 'Standalone Offline Option',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  assets: [{
    id: 'remote-background',
    type: 'image',
    name: 'Offline Background.png',
    url: remoteStandaloneBackgroundUrl,
  }],
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    actId: 'act-1',
    backgroundData: remoteStandaloneBackgroundUrl,
    backgroundName: 'Offline Background.png',
    musicData: remoteStandaloneMissingAudioUrl,
    musicName: 'Missing Theme.mp3',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [],
  enigmas: [],
  cinematics: [],
  combinations: [],
  storyVariables: [],
});

const makeHeroMalusProject = () => ({
  id: 'standalone-hero-malus',
  title: 'Standalone Hero Malus',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
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
      id: 'hero-1',
      name: 'Ariane',
      health: 10,
      maxHealth: 10,
      mana: 6,
      maxMana: 6,
      skills: [],
      powers: [],
    },
  },
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    introText: 'Le hall attend.',
    hotspots: [{
      id: 'spot-malus',
      name: 'Piege',
      x: 45,
      y: 50,
      width: 12,
      height: 12,
      actionType: 'dialogue_item',
      dialogue: 'Le piege claque.',
      rewardItemId: 'key',
      heroMalusHealthLoss: 3,
      heroMalusManaLoss: 2,
      heroMalusMessage: 'Les runes brulent.',
    }, {
      id: 'spot-conversation',
      name: 'Statue',
      x: 25,
      y: 30,
      width: 12,
      height: 12,
      actionType: 'conversation',
      dialogue: 'La statue murmure.',
      conversation: {
        startNodeId: 'node-1',
        nodes: [{
          id: 'node-1',
          text: 'Choisis.',
          replies: [{
            id: 'reply-malus',
            label: 'Toucher le sceau',
            dialogue: 'Tu touches le sceau.',
            actionType: 'end',
            heroMalusHealthLoss: 4,
            heroMalusManaLoss: 1,
            heroMalusMessage: 'Le sceau mord.',
          }],
        }],
      },
    }],
    sceneObjects: [],
  }],
  items: [{
    id: 'key',
    name: 'Cle',
  }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const makeHeroItemProject = () => ({
  id: 'standalone-hero-items',
  title: 'Standalone Hero Items',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
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
      id: 'hero-1',
      name: 'Ariane',
      health: 6,
      maxHealth: 10,
      mana: 2,
      maxMana: 6,
      equipmentSlotCount: 4,
      skills: [{
        id: 'force',
        name: 'Force',
        value: 3,
      }],
      powers: [],
    },
  },
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    introText: 'Le hall attend.',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [{
    id: 'health-potion',
    name: 'Soin',
    heroItemType: 'health_potion',
    heroItemAmount: 3,
  }, {
    id: 'mana-potion',
    name: 'Mana',
    heroItemType: 'mana_potion',
    heroItemAmount: 4,
  }, {
    id: 'sword',
    name: 'Epee',
    heroItemType: 'equipment',
    heroItemBonusTarget: 'skill',
    heroItemSkillId: 'force',
    heroItemBonus: 2,
  }, {
    id: 'amulet',
    name: 'Amulette',
    heroItemType: 'equipment',
    heroItemBonusTarget: 'maxHealth',
    heroItemBonus: 3,
  }, {
    id: 'ring',
    name: 'Anneau',
    heroItemType: 'equipment',
    heroItemBonusTarget: 'maxMana',
    heroItemBonus: 4,
  }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const makeStandaloneLogicConditionProject = () => ({
  id: 'standalone-logic-conditions',
  title: 'Standalone Logic Conditions',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
  heroAdventure: {
    enabled: true,
    hero: {
      id: 'hero-1',
      name: 'Ariane',
      health: 10,
      maxHealth: 10,
      mana: 6,
      maxMana: 6,
      skills: [],
      powers: [],
    },
  },
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    introText: 'Le hall attend.',
    hotspots: [{
      id: 'mana-door',
      name: 'Porte de mana',
      actionType: 'dialogue',
      dialogue: 'Default mana',
      logicRules: [{
        id: 'rule-mana',
        conditionType: 'hero_mana_at_least',
        heroManaThreshold: 5,
        actionType: 'dialogue',
        dialogue: 'Mana branch',
      }],
    }, {
      id: 'cinematic-door',
      name: 'Porte cinema',
      actionType: 'dialogue',
      dialogue: 'Default cinematic',
      logicRules: [{
        id: 'rule-cinematic',
        conditionType: 'launched_cinematic',
        actionType: 'dialogue',
        dialogue: 'Cinematic branch',
      }],
    }],
    sceneObjects: [],
  }],
  items: [],
  enigmas: [],
  cinematics: [{ id: 'intro', name: 'Intro', slides: [], steps: [] }],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const makeCorruptedHeroRuntimeState = () => ({
  playSceneId: 'scene-start',
  inventory: ['sword', 'amulet', 'ring'],
  heroState: {
    id: 'hero-1',
    name: 'Ariane',
    health: 99,
    maxHealth: 13,
    mana: -4,
    maxMana: 10,
    equipmentSlotCount: 4,
    skills: [{ id: 'force', name: 'Force', value: 5, baseValue: 3, rolledValue: 2, manaCost: '1' }],
    powers: [],
    rules: { criticalSuccess: 99, criticalFailure: -10, criticalChance: 250, criticalMultiplier: 0 },
  },
  lastDiceRoll: {
    raw: '30',
    sides: '20',
    modifier: '2',
    total: '32',
    success: 'yes',
    skillId: 42,
  },
  equippedHeroItemIds: ['sword', 'sword', 'ghost', 'health-potion', 'amulet', 'ring'],
  equippedHeroSlotMap: { 0: 'ghost', 1: 'amulet', 2: 'sword', 3: 'amulet', 99: 'ring' },
  heroCombatStates: {
    fight: {
      enemyHealth: '-4',
      heroStatusEffects: [
        { type: 'force_buff', amount: '2', duration: '3' },
        { type: 'unknown', amount: 9, duration: 1 },
      ],
      enemyStatusEffects: [{ statusType: 'poison', statusAmount: '4', statusDuration: '2' }],
    },
  },
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

const runStandalone = (project) => {
  const { engineJs } = buildStandaloneModuleFiles(project);
  const root = createElementStub();
  const storage = new Map();
  const context = {
    console,
    Math,
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
    FileReader: class {
      readAsText(file) {
        this.result = typeof file === 'string' ? file : file?.content || '';
        this.onload?.();
      }
    },
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
    `${engineJs}\nglobalThis.__standaloneTest = { state, saveGame, loadGame, buildSavePayload, importSaveFromJsonFile, triggerHotspot, chooseConversationReply, openInventoryItem, equipHeroItem, unequipHeroItem };`,
    context,
  );

  return { runtime: context.__standaloneTest, storage };
};

describe('standalone export regression', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test('generates a zip with safe HTML, engine, project and bundled media', async () => {
    await exportStandalone(makeStandaloneProject());

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [filename, blob] = downloadBlob.mock.calls[0];
    expect(filename).toBe('jeu-exporte-prêt-a-jouer.zip');

    const zip = await JSZip.loadAsync(blob);
    const files = Object.keys(zip.files);
    [
      'jeu-exporte/index.html',
      'jeu-exporte/engine.js',
      'jeu-exporte/style.css',
      'jeu-exporte/project.json',
    ].forEach((expectedFile) => {
      expect(files).toContain(expectedFile);
    });

    const indexHtml = await zip.file('jeu-exporte/index.html').async('string');
    const engineJs = await zip.file('jeu-exporte/engine.js').async('string');
    const styleCss = await zip.file('jeu-exporte/style.css').async('string');
    const exportedProject = JSON.parse(await zip.file('jeu-exporte/project.json').async('string'));

    expect(indexHtml).toContain('<script src="./engine.js"></script>');
    expect(indexHtml).toContain('<link rel="stylesheet" href="./style.css">');
    expect(indexHtml).not.toContain('<script>const project');
    expect(indexHtml).not.toContain('<style>');
    expect(engineJs).toContain('const project =');
    expect(engineJs).toContain('assets/scenes/hall-final-png.png');
    expect(engineJs).not.toContain('fetch(');
    expect(engineJs).not.toContain('project.json');
    expect(engineJs).toContain('function saveGame');
    expect(engineJs).toContain('function safeMediaUrl');
    expect(styleCss).toBe(buildStandaloneCss());
    expect(exportedProject.scenes[0].backgroundData).toMatch(/^assets\/scenes\/hall-final-png\.png$/);
    expect(exportedProject.scenes[0].musicData).toMatch(/^assets\/audio\/theme-mp3\.mp3$/);
    expect(exportedProject.scenes[0].hotspots[0].objectImageData).toMatch(/^assets\/hotspots\/coffret-png\.png$/);
    expect(exportedProject.items[0].imageData).toMatch(/^assets\/items\/cle-png\.png$/);
    expect(exportedProject.cinematics[0].slides[0].audioData).toMatch(/^assets\/audio\/slide-mp3\.mp3$/);

    [
      exportedProject.scenes[0].backgroundData,
      exportedProject.scenes[0].musicData,
      exportedProject.scenes[0].hotspots[0].objectImageData,
      exportedProject.items[0].imageData,
      exportedProject.cinematics[0].slides[0].imageData,
      exportedProject.cinematics[0].slides[0].audioData,
    ].forEach((assetPath) => {
      expect(files).toContain(`jeu-exporte/${assetPath}`);
    });
  });

  test('packages standalone combat media instead of leaving audio and video data URLs', async () => {
    await exportStandalone(makeStandaloneCombatMediaProject());

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [, blob] = downloadBlob.mock.calls[0];
    const zip = await JSZip.loadAsync(blob);
    const files = Object.keys(zip.files);
    const exportedProject = JSON.parse(await zip.file('jeu-exporte/project.json').async('string'));
    const combat = exportedProject.heroAdventure.combat;
    const hotspot = exportedProject.scenes[0].hotspots[0];
    const reply = exportedProject.scenes[0].hotspots[1].conversation.nodes[0].replies[0];

    expect(combat.backgroundImageData).toMatch(/^assets\/combat\/combat-arena-png\.png$/);
    expect(combat.heroImageData).toMatch(/^assets\/combat\/global-hero-png\.png$/);
    expect(combat.enemyImageData).toMatch(/^assets\/combat\/global-enemy-png\.png$/);
    expect(combat.heroHitEffectVideoData).toMatch(/^assets\/video\/hero-impact-mp4\.mp4$/);
    expect(combat.heroHitEffectAudioData).toMatch(/^assets\/audio\/hero-impact-mp3\.mp3$/);
    expect(combat.enemyDeathEffectVideoData).toMatch(/^assets\/video\/enemy-death-mp4\.mp4$/);
    expect(combat.enemyDeathEffectAudioData).toMatch(/^assets\/audio\/enemy-death-ogg\.ogg$/);
    expect(hotspot.combatBackgroundImageData).toMatch(/^assets\/combat\/hotspot-combat-bg-png\.png$/);
    expect(hotspot.combatEnemyImageData).toMatch(/^assets\/combat\/hotspot-enemy-png\.png$/);
    expect(reply.combatHeroImageData).toMatch(/^assets\/combat\/reply-hero-png\.png$/);
    expect(JSON.stringify(exportedProject.heroAdventure.combat)).not.toContain('data:');
    expect(exportedProject.heroAdventure.hero.characterImageData).toBe('data:image/png;base64,aGVybw==');

    [
      combat.heroHitEffectVideoData,
      combat.heroHitEffectAudioData,
      combat.enemyDeathEffectVideoData,
      combat.enemyDeathEffectAudioData,
      hotspot.combatBackgroundImageData,
      hotspot.combatEnemyImageData,
      reply.combatHeroImageData,
    ].forEach((assetPath) => {
      expect(files).toContain(`jeu-exporte/${assetPath}`);
    });
  });

  test('keeps remote URLs and newly collected non-legacy fields unchanged', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await exportStandalone(makeStandaloneOnlineCompatibilityProject());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.offlineAssetsSummary).toMatchObject({ enabled: false, onlineCount: 0 });
    expect(result.offlineAssetsMessage).toBe('');
    expect(downloadBlob).toHaveBeenCalledTimes(1);

    const [, blob] = downloadBlob.mock.calls[0];
    const zip = await JSZip.loadAsync(blob);
    const files = Object.keys(zip.files);
    const exportedProject = JSON.parse(await zip.file('jeu-exporte/project.json').async('string'));
    const reply = exportedProject.scenes[0].hotspots[0].conversation.nodes[0].replies[0];

    expect(exportedProject.assets[0].url).toBe('https://project.supabase.co/storage/v1/object/public/game-media/remote-background.png');
    expect(exportedProject.scenes[0].backgroundData).toBe('https://project.supabase.co/storage/v1/object/public/game-media/remote-background.png');
    expect(exportedProject.heroAdventure.combat.backgroundImageData).toMatch(/^assets\/combat\/legacy-combat-png\.png$/);
    expect(exportedProject.heroAdventure.hero.characterImageData).toBe('data:image/png;base64,aGVyby1ub24tbGVnYWN5');
    expect(exportedProject.heroAdventure.hero.setupMusicData).toBe('data:audio/mpeg;base64,c2V0dXAtbm9uLWxlZ2FjeQ==');
    expect(reply.responseImageData).toBe('data:image/png;base64,cmVzcG9uc2Utbm9uLWxlZ2FjeQ==');
    expect(reply.responseSoundData).toBe('data:audio/mpeg;base64,cmVzcG9uc2Utc291bmQ=');
    expect(reply.npcPortraitData).toBe('https://cdn.example.com/oracle.webp');
    expect(files).toContain(`jeu-exporte/${exportedProject.heroAdventure.combat.backgroundImageData}`);
  });

  test('passes exportOfflineAssets to the bundler and returns an offline summary', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === remoteStandaloneBackgroundUrl) {
        return makeFetchResponse('background-bytes', { contentType: 'image/png' });
      }
      if (url === remoteStandaloneMissingAudioUrl) {
        return makeFetchResponse('missing', { ok: false, status: 503, statusText: 'Unavailable' });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exportStandalone(makeStandaloneOfflineOptionProject(), { exportOfflineAssets: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.offlineAssetsSummary).toMatchObject({
      enabled: true,
      bundledCount: 1,
      onlineCount: 1,
      warningCount: 1,
    });
    expect(result.offlineAssetsMessage).toBe('Export offline : 1 médias intégrés, 1 médias restés en ligne.');

    const zip = await JSZip.loadAsync(result.blob);
    const files = Object.keys(zip.files);
    const exportedProject = JSON.parse(await zip.file('jeu-exporte/project.json').async('string'));
    const report = JSON.parse(await zip.file('jeu-exporte/offline-assets-report.json').async('string'));

    expect(exportedProject.assets[0].url).toMatch(/^assets\/images\/offline-background-png-[a-f0-9]{8}\.png$/);
    expect(exportedProject.scenes[0].backgroundData).toBe(exportedProject.assets[0].url);
    expect(exportedProject.scenes[0].musicData).toBe(remoteStandaloneMissingAudioUrl);
    expect(files).toContain(`jeu-exporte/${exportedProject.assets[0].url}`);
    expect(report).toEqual({
      warnings: [{
        url: remoteStandaloneMissingAudioUrl,
        paths: ['scenes[0].musicData'],
        message: 'Unavailable',
        status: 503,
      }],
    });
  });

  test('keeps player save and load state in the standalone runtime', () => {
    const { runtime, storage } = runStandalone(makeStandaloneProject());

    runtime.triggerHotspot('spot-key');
    expect(runtime.state.inventory).toEqual(['key']);
    expect(runtime.state.completedHotspotIds).toEqual(['spot-key']);

    expect(runtime.saveGame(false)).toBe(true);
    const saveKey = Array.from(storage.keys()).find((key) => key.startsWith('escapeGameSave:'));
    expect(saveKey).toBe('escapeGameSave:standalone-critical');

    runtime.state.inventory = [];
    runtime.state.completedHotspotIds = [];
    runtime.state.playSceneId = 'missing-scene';
    runtime.state.dialogue = 'Etat modifie';

    expect(runtime.loadGame(false)).toBe(true);
    expect(runtime.state.inventory).toEqual(['key']);
    expect(runtime.state.completedHotspotIds).toEqual(['spot-key']);
    expect(runtime.state.playSceneId).toBe('scene-start');
    expect(runtime.state.dialogue).toBe('Tu prends la cle.');
  });

  test('applies configured hero malus from standalone hotspots without dropping existing action effects', () => {
    const { runtime } = runStandalone(makeHeroMalusProject());

    expect(runtime.state.heroState.health).toBe(10);
    expect(runtime.state.heroState.mana).toBe(6);

    runtime.triggerHotspot('spot-malus');

    expect(runtime.state.heroState.health).toBe(7);
    expect(runtime.state.heroState.mana).toBe(4);
    expect(runtime.state.dialogue).toBe('Le piege claque. Les runes brulent. Hero: 7/10 PV, 4/6 mana.');
    expect(runtime.state.inventory).toEqual(['key']);
    expect(runtime.state.completedHotspotIds).toContain('spot-malus');
  });

  test('applies configured hero malus from standalone conversation replies', () => {
    const { runtime } = runStandalone(makeHeroMalusProject());

    runtime.triggerHotspot('spot-conversation');
    const reply = runtime.state.activeConversation.conversation.nodes[0].replies[0];
    runtime.chooseConversationReply(reply);

    expect(runtime.state.heroState.health).toBe(6);
    expect(runtime.state.heroState.mana).toBe(5);
    expect(runtime.state.dialogue).toBe('Tu touches le sceau. Le sceau mord. Hero: 6/10 PV, 5/6 mana.');
    expect(runtime.state.activeConversation).toBeNull();
    expect(runtime.state.chosenConversationReplyIds).toContain('reply-malus');
    expect(runtime.state.completedHotspotIds).toContain('spot-conversation');
  });

  test('uses standalone hero health and mana potions', () => {
    const { runtime } = runStandalone(makeHeroItemProject());
    runtime.state.inventory = ['health-potion', 'mana-potion'];
    runtime.state.selectedInventoryIds = ['health-potion', 'mana-potion'];

    expect(runtime.openInventoryItem('health-potion')).toBe(true);
    expect(runtime.state.heroState.health).toBe(9);
    expect(runtime.state.heroState.mana).toBe(2);
    expect(runtime.state.inventory).toEqual(['mana-potion']);
    expect(runtime.state.selectedInventoryIds).toEqual(['mana-potion']);
    expect(runtime.state.dialogue).toContain('+3 PV (9/10)');

    expect(runtime.openInventoryItem('mana-potion')).toBe(true);
    expect(runtime.state.heroState.health).toBe(9);
    expect(runtime.state.heroState.mana).toBe(6);
    expect(runtime.state.inventory).toEqual([]);
    expect(runtime.state.selectedInventoryIds).toEqual([]);
    expect(runtime.state.dialogue).toContain('+4 mana (6/6)');
  });

  test('runs exported hero and cinematic logic conditions in the standalone runtime', () => {
    const { runtime } = runStandalone(makeStandaloneLogicConditionProject());

    expect(() => runtime.triggerHotspot('mana-door')).not.toThrow();
    expect(runtime.state.dialogue).toBe('Mana branch');

    runtime.state.launchedCinematicIds = ['intro'];

    expect(() => runtime.triggerHotspot('cinematic-door')).not.toThrow();
    expect(runtime.state.dialogue).toBe('Cinematic branch');
  });

  test('equips and unequips standalone hero equipment bonuses cleanly', () => {
    const { runtime } = runStandalone(makeHeroItemProject());
    runtime.state.inventory = ['sword', 'amulet', 'ring'];

    expect(runtime.openInventoryItem('sword')).toBe(true);
    expect(runtime.state.heroState.skills.find((skill) => skill.id === 'force').value).toBe(5);
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 0: 'sword' });

    expect(runtime.openInventoryItem('amulet')).toBe(true);
    expect(runtime.state.heroState.maxHealth).toBe(13);
    expect(runtime.state.heroState.health).toBe(9);
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword', 'amulet']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 0: 'sword', 1: 'amulet' });

    expect(runtime.openInventoryItem('ring')).toBe(true);
    expect(runtime.state.heroState.maxMana).toBe(10);
    expect(runtime.state.heroState.mana).toBe(6);
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 0: 'sword', 1: 'amulet', 2: 'ring' });

    expect(runtime.unequipHeroItem('sword')).toBe(true);
    expect(runtime.state.heroState.skills.find((skill) => skill.id === 'force').value).toBe(3);
    expect(runtime.state.equippedHeroItemIds).toEqual(['amulet', 'ring']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 1: 'amulet', 2: 'ring' });

    expect(runtime.unequipHeroItem('amulet')).toBe(true);
    expect(runtime.state.heroState.maxHealth).toBe(10);
    expect(runtime.state.heroState.health).toBe(9);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 2: 'ring' });

    expect(runtime.unequipHeroItem('ring')).toBe(true);
    expect(runtime.state.heroState.maxMana).toBe(6);
    expect(runtime.state.heroState.mana).toBe(6);
    expect(runtime.state.equippedHeroItemIds).toEqual([]);
    expect(runtime.state.equippedHeroSlotMap).toEqual({});
  });

  test('persists standalone equipped hero items through save and load', () => {
    const { runtime, storage } = runStandalone(makeHeroItemProject());
    runtime.state.inventory = ['sword'];

    expect(runtime.openInventoryItem('sword')).toBe(true);
    expect(runtime.saveGame(false)).toBe(true);

    const saveKey = Array.from(storage.keys()).find((key) => key.startsWith('escapeGameSave:'));
    const savedState = JSON.parse(storage.get(saveKey));
    expect(savedState.equippedHeroItemIds).toEqual(['sword']);
    expect(savedState.equippedHeroSlotMap).toEqual({ 0: 'sword' });

    runtime.state.equippedHeroItemIds = [];
    runtime.state.equippedHeroSlotMap = {};
    runtime.state.heroState.skills = runtime.state.heroState.skills.map((skill) => (
      skill.id === 'force' ? { ...skill, value: 3 } : skill
    ));

    expect(runtime.loadGame(false)).toBe(true);
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 0: 'sword' });
    expect(runtime.state.heroState.skills.find((skill) => skill.id === 'force').value).toBe(5);
  });

  test('normalizes standalone hero runtime contracts on save and load', () => {
    const { runtime, storage } = runStandalone(makeHeroItemProject());
    Object.assign(runtime.state, makeCorruptedHeroRuntimeState());

    expect(runtime.saveGame(false)).toBe(true);
    const saveKey = Array.from(storage.keys()).find((key) => key.startsWith('escapeGameSave:'));
    const savedState = JSON.parse(storage.get(saveKey));
    expect(savedState.heroState.health).toBe(13);
    expect(savedState.heroState.mana).toBe(0);
    expect(savedState.heroState.rules).toMatchObject({
      criticalSuccess: 20,
      criticalFailure: 1,
      criticalChance: 100,
      criticalMultiplier: 1,
    });
    expect(savedState.lastDiceRoll).toMatchObject({ raw: 20, sides: 20, modifier: 2, total: 32, success: true, skillId: '42' });
    expect(savedState.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(savedState.equippedHeroSlotMap).toEqual({ 0: 'ring', 1: 'amulet', 2: 'sword' });
    expect(savedState.heroCombatStates.fight.heroStatusEffects).toEqual([{ type: 'force_buff', amount: 2, duration: 3 }]);

    Object.assign(runtime.state, {
      heroState: { health: 1, mana: 1, skills: [] },
      lastDiceRoll: null,
      equippedHeroItemIds: [],
      equippedHeroSlotMap: {},
      heroCombatStates: {},
    });

    expect(runtime.loadGame(false)).toBe(true);
    expect(runtime.state.heroState.health).toBe(13);
    expect(runtime.state.heroState.mana).toBe(0);
    expect(runtime.state.heroState.skills[0]).toMatchObject({ id: 'force', value: 5, baseValue: 3, rolledValue: 2, manaCost: 1 });
    expect(runtime.state.lastDiceRoll).toMatchObject({ raw: 20, sides: 20, modifier: 2, total: 32, success: true, skillId: '42' });
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 0: 'ring', 1: 'amulet', 2: 'sword' });
    expect(runtime.state.heroCombatStates.fight.enemyStatusEffects).toEqual([{ type: 'poison', amount: 4, duration: 2 }]);
  });

  test('normalizes standalone imported JSON hero runtime contracts', () => {
    const { runtime, storage } = runStandalone(makeHeroItemProject());
    runtime.importSaveFromJsonFile({
      content: JSON.stringify({
        type: 'escape-game-save',
        name: 'Import test',
        state: makeCorruptedHeroRuntimeState(),
      }),
    });

    expect(runtime.state.heroState.health).toBe(13);
    expect(runtime.state.heroState.mana).toBe(0);
    expect(runtime.state.lastDiceRoll).toMatchObject({ raw: 20, sides: 20, modifier: 2, total: 32, success: true, skillId: '42' });
    expect(runtime.state.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(runtime.state.equippedHeroSlotMap).toEqual({ 0: 'ring', 1: 'amulet', 2: 'sword' });
    expect(runtime.state.heroCombatStates.fight.heroStatusEffects).toEqual([{ type: 'force_buff', amount: 2, duration: 3 }]);
    expect(runtime.state.dialogue).toBe('Sauvegarde importée : Import test.');

    const saveKey = Array.from(storage.keys()).find((key) => key.startsWith('escapeGameSave:'));
    const savedState = JSON.parse(storage.get(saveKey));
    expect(savedState.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(savedState.equippedHeroSlotMap).toEqual({ 0: 'ring', 1: 'amulet', 2: 'sword' });
  });
});
