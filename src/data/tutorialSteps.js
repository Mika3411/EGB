import { makeCinematic, makeCombination, makeEnigma, makeLogicRule, makeRouteMap } from './projectData';

export const BUILDER_TUTORIAL_TABS = ['profile', 'scenes', 'editor', 'map', 'cinematics', 'animation', 'combinations', 'enigmas', 'logic', 'ai'];

const getProjectRecordName = (project) =>
  project?.name || project?.data?.title || project?.data?.name || '';

export const getTutorialName = (user) => {
  const label = user?.name || user?.pseudo || user?.username || user?.email?.split('@')?.[0] || '';
  return String(label || '').trim();
};

export const personalizeTutorialText = (text, userName) => String(text || '').replaceAll('{name}', userName || 'toi');

export const getTutorialInputValue = (selector) => {
  const field = document.querySelector(selector);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value || '';
  }
  return '';
};

export const getTutorialInputField = (selector) => {
  const target = document.querySelector(selector);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return target;
  }
  return target?.querySelector?.('input, textarea, select') || null;
};

export const doRectsOverlap = (a, b, padding = 0) => (
  a.left < b.left + b.width + padding
  && a.left + a.width + padding > b.left
  && a.top < b.top + b.height + padding
  && a.top + a.height + padding > b.top
);

const getSelectedTutorialScene = (project) => (project?.scenes || [])[0] || null;

export const isTutorialStepComplete = (step, interactedSteps, project) => {
  if (!step?.completedWhen) return true;
  const rule = step.completedWhen;
  if (rule.type === 'interact') return interactedSteps.has(step.selector);
  if (rule.type === 'select-touched') return interactedSteps.has(step.selector);
  if (rule.type === 'fake-file') return interactedSteps.has(`fake-file:${step.selector}`);
  if (rule.type === 'input-min') return getTutorialInputValue(rule.selector).trim().length >= (rule.min || 1);
  if (rule.type === 'select-not') return getTutorialInputValue(rule.selector) !== rule.value;
  if (rule.type === 'select-has-value') return getTutorialInputValue(rule.selector).trim().length > 0;
  if (rule.type === 'details-open') return Boolean(document.querySelector(`${rule.selector}[open]`));
  if (rule.type === 'project-scene-field-not') {
    const scene = getSelectedTutorialScene(project);
    return Boolean(scene && (scene[rule.field] || '') !== rule.value);
  }
  if (rule.type === 'project-scene-object-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.sceneObjects || []).some((object) => object.tutorialCreated));
  }
  if (rule.type === 'project-scene-object-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.sceneObjects || []).filter((object) => object.tutorialCreated).some((object) => (
      Math.abs((Number(object.x) || 0) - 50) > 1 || Math.abs((Number(object.y) || 0) - 50) > 1
    )));
  }
  if (rule.type === 'project-hotspot-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.hotspots || []).some((hotspot) => hotspot.tutorialCreated));
  }
  if (rule.type === 'project-hotspot-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.hotspots || []).filter((hotspot) => hotspot.tutorialCreated).some((hotspot) => (
      Math.abs((Number(hotspot.x) || 0) - 50) > 1 || Math.abs((Number(hotspot.y) || 0) - 50) > 1
    )));
  }
  if (rule.type === 'project-visual-zone-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).some((zone) => zone.tutorialCreated));
  }
  if (rule.type === 'project-visual-zone-effect-not') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).filter((zone) => zone.tutorialCreated).some((zone) => (
      (zone.effect || '') !== rule.value
    )));
  }
  if (rule.type === 'project-visual-zone-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).filter((zone) => zone.tutorialCreated).some((zone) => (
      Math.abs((Number(zone.x) || 0) - 50) > 1 || Math.abs((Number(zone.y) || 0) - 50) > 1
    )));
  }
  return true;
};

export const makeTutorialImageDataUrl = (label, color) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="28" fill="#111827"/>
      <rect x="34" y="42" width="172" height="136" rx="16" fill="${color}"/>
      <circle cx="84" cy="88" r="22" fill="#f8fafc" opacity=".9"/>
      <path d="M50 162 L98 118 L132 146 L158 112 L198 162 Z" fill="#f8fafc" opacity=".82"/>
      <text x="120" y="210" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#e5e7eb">${label}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const makeTutorialFileIconDataUrl = (label, color = '#2563eb') => makeTutorialImageDataUrl(label, color);

const FAKE_WINDOWS_IMAGES = [
  { name: 'clé-rouillée.png', label: 'Cle', color: '#b45309' },
  { name: 'lettre-cachétée.png', label: 'Lettre', color: '#7c3aed' },
  { name: 'montre-arrêtée.png', label: 'Montre', color: '#2563eb' },
];

const FAKE_WINDOWS_AUDIO = [
  {
    name: 'ambiance-manoir.mp3',
    label: 'Ambiance manoir',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
  {
    name: 'tic-tac-sourd.mp3',
    label: 'Tic tac sourd',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
  {
    name: 'vent-couloir.mp3',
    label: 'Vent couloir',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
];

const getFakeWindowAudioOptions = (project) => {
  const tutorialAudio = Array.isArray(project?.tutorialExampleAudio) ? project.tutorialExampleAudio : [];
  const realAudio = (tutorialAudio.length ? tutorialAudio : (project?.scenes || []))
    .filter((scene) => scene.musicData)
    .map((scene) => ({
      name: scene.musicName || `${scene.name || 'musique'}.mp3`,
      label: scene.name || 'Musique',
      dataUrl: scene.musicData,
      isReal: true,
    }));

  const uniqueAudio = [];
  const seenAudio = new Set();
  realAudio.forEach((audio) => {
    const key = audio.dataUrl || audio.name;
    if (seenAudio.has(key)) return;
    seenAudio.add(key);
    uniqueAudio.push(audio);
  });

  return uniqueAudio.length ? uniqueAudio.slice(0, 1) : FAKE_WINDOWS_AUDIO.slice(0, 1);
};

export const getFakeWindowImageOptions = (project, target = 'object') => {
  if (target === 'scene-music') return getFakeWindowAudioOptions(project);
  const tutorialSceneImages = Array.isArray(project?.tutorialExampleImages) ? project.tutorialExampleImages : [];
  const source = target === 'scene-background'
    ? (tutorialSceneImages.length ? tutorialSceneImages : (project?.scenes || [])).map((scene) => ({
      imageData: scene.backgroundData,
      imageName: scene.backgroundName,
      name: scene.name,
    }))
    : (project?.items || []);

  const realImages = source
    .filter((item) => item.imageData)
    .slice(0, 6)
    .map((item) => ({
      name: item.imageName || `${item.name || 'objet'}.png`,
      label: item.name || 'Objet',
      dataUrl: item.imageData,
      isReal: true,
    }));

  if (realImages.length) return realImages;

  return FAKE_WINDOWS_IMAGES.map((file) => ({
    ...file,
    dataUrl: makeTutorialImageDataUrl(file.label, file.color),
    isReal: false,
  }));
};

export const prepareProjectForTutorial = (project, tab) => {
  const nextProject = structuredClone(project);
  if (tab === 'scenes') {
    const existingTutorialImages = Array.isArray(nextProject.tutorialExampleImages) ? nextProject.tutorialExampleImages : [];
    const existingTutorialAudio = Array.isArray(nextProject.tutorialExampleAudio) ? nextProject.tutorialExampleAudio : [];
    const sceneImageExamples = (nextProject.scenes || [])
      .filter((scene) => scene.backgroundData)
      .map((scene) => ({
        name: scene.name,
        backgroundData: scene.backgroundData,
        backgroundName: scene.backgroundName,
      }));
    const sceneAudioExamples = (nextProject.scenes || [])
      .filter((scene) => scene.musicData)
      .map((scene) => ({
        name: scene.name,
        musicData: scene.musicData,
        musicName: scene.musicName,
      }));
    nextProject.tutorialExampleImages = existingTutorialImages.length ? existingTutorialImages : sceneImageExamples;
    nextProject.tutorialExampleAudio = existingTutorialAudio.length ? existingTutorialAudio : sceneAudioExamples;
    const scene = nextProject.scenes?.[0];
    if (scene) {
      scene.name = '';
      scene.introText = '';
      scene.backgroundData = '';
      scene.backgroundName = '';
      scene.musicData = '';
      scene.musicName = '';
      scene.musicLoop = true;
      scene.visualEffect = 'none';
      if (!Array.isArray(scene.hotspots) || scene.hotspots.length === 0) {
        scene.hotspots = [{
          id: `hotspot_${Date.now().toString(36)}`,
          name: '',
          x: 50,
          y: 50,
          width: 14,
          height: 12,
          actionType: 'dialogue',
          dialogue: '',
          requiredItemId: '',
          consumeRequiredItemOnUse: false,
          rewardItemId: '',
          targetSceneId: '',
          targetCinematicId: '',
          enigmaId: '',
          requiredHotspotId: '',
          lockedMessage: '',
          objectImageData: '',
          objectImageName: '',
          hasSecondAction: false,
          secondActionType: 'dialogue',
          secondDialogue: '',
          secondRequiredItemId: '',
          secondConsumeRequiredItemOnUse: false,
          secondRewardItemId: '',
          secondTargetSceneId: '',
          secondTargetCinematicId: '',
          secondEnigmaId: '',
          secondObjectImageData: '',
          secondObjectImageName: '',
          logicRules: [],
        }];
      } else {
        scene.hotspots[0].name = '';
        scene.hotspots[0].actionType = 'dialogue';
      }
    }
  }
  if (tab === 'editor') {
    const scene = nextProject.scenes?.[0];
    if (scene) {
      scene.hotspots = (scene.hotspots || []).map((hotspot) => ({
        ...hotspot,
        tutorialCreated: false,
      }));
      scene.visualEffectZones = (scene.visualEffectZones || []).map((zone) => ({
        ...zone,
        tutorialCreated: false,
      }));
      scene.sceneObjects = (scene.sceneObjects || []).map((object) => ({
        ...object,
        tutorialCreated: false,
      }));
    }
  }
  if (tab === 'map') {
    if (!nextProject.routeMap) nextProject.routeMap = makeRouteMap();
    if (!Array.isArray(nextProject.routeMap.rooms) || nextProject.routeMap.rooms.length === 0) {
      const firstScene = nextProject.scenes?.[0];
      nextProject.routeMap.rooms = [{
        id: `room_${Date.now().toString(36)}`,
        name: firstScene?.name || 'Piece de depart',
        sceneId: firstScene?.id || '',
        x: 28,
        y: 42,
        type: 'start',
      }];
    }
  }
  if (tab === 'cinematics') {
    if (!Array.isArray(nextProject.cinematics)) nextProject.cinematics = [];
    if (!nextProject.cinematics.length) nextProject.cinematics.push(makeCinematic());
    const cinematic = nextProject.cinematics[0];
    cinematic.cinematicType = 'slides';
    if (!Array.isArray(cinematic.slides) || !cinematic.slides.length) {
      cinematic.slides = makeCinematic().slides;
    }
  }
  if (tab === 'combinations' && (!Array.isArray(nextProject.combinations) || nextProject.combinations.length === 0)) {
    if (!Array.isArray(nextProject.combinations)) nextProject.combinations = [];
    nextProject.combinations.push(makeCombination());
  }
  if (tab === 'enigmas' && (!Array.isArray(nextProject.enigmas) || nextProject.enigmas.length === 0)) {
    if (!Array.isArray(nextProject.enigmas)) nextProject.enigmas = [];
    nextProject.enigmas.push(makeEnigma());
  }
  if (tab === 'enigmas') {
    const enigma = nextProject.enigmas?.[0];
    if (enigma) {
      enigma.type = 'code';
      enigma.codeSkin = enigma.codeSkin || 'safe-wheels';
      enigma.solutionText = enigma.solutionText || '1234';
    }
  }
  if (tab === 'logic') {
    const scene = nextProject.scenes?.[0];
    const hotspot = scene?.hotspots?.[0];
    if (hotspot && (!Array.isArray(hotspot.logicRules) || hotspot.logicRules.length === 0)) {
      hotspot.logicRules = [makeLogicRule()];
    }
  }
  return nextProject;
};
