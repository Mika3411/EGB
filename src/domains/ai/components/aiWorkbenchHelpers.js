import { createElement } from 'react';

export const AI_PROJECT_PRIVACY_NOTICE = "Quand tu lances une génération IA, les informations nécessaires du projet peuvent être transmises au fournisseur IA: titres, scènes, dialogues, personnages, contraintes et consignes. Les médias volumineux ne sont pas inclus dans ce contexte texte compacté.";

export const stripLargeMediaFields = (value) => {
  if (Array.isArray(value)) return value.map(stripLargeMediaFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => {
    const isLargeMediaField = /^(backgroundData|imageData|objectImageData|popupImageData|videoData|audioData)$/i.test(key);
    if (isLargeMediaField) return [key, ''];
    return [key, stripLargeMediaFields(entryValue)];
  }));
};

export const HelpLabel = ({ children, help, className = '' }) => (
  createElement(
    'label',
    { className: `label-with-help${className ? ` ${className}` : ''}` },
    createElement('span', null, children),
    createElement('span', { className: 'help-dot', 'data-help': help, 'aria-label': help, tabIndex: 0 }, '?')
  )
);

export const AiPrivacyNotice = () => (
  createElement(
    'div',
    { className: 'ai-privacy-notice', role: 'note' },
    createElement('strong', null, 'Confidentialit\u00e9 IA'),
    createElement('p', null, AI_PROJECT_PRIVACY_NOTICE)
  )
);

export const shouldPreplaceHotspots = (hotspots = []) => {
  if (!hotspots.length) return false;
  const usable = hotspots.filter((spot) => Number.isFinite(Number(spot.x)) && Number.isFinite(Number(spot.y)));
  if (usable.length !== hotspots.length) return true;
  const uniquePositions = new Set(usable.map((spot) => `${Math.round(Number(spot.x))}:${Math.round(Number(spot.y))}`));
  const allNearDefault = usable.every((spot) => Math.abs(Number(spot.x) - 50) <= 1 && Math.abs(Number(spot.y) - 50) <= 1);
  return uniquePositions.size <= 1 || allNearDefault;
};

export const preplaceHotspots = (hotspots = []) => {
  if (!shouldPreplaceHotspots(hotspots)) return hotspots;
  const slots = [
    [24, 36], [50, 34], [76, 36],
    [28, 58], [52, 58], [74, 58],
    [22, 76], [50, 76], [78, 76],
  ];
  return hotspots.map((hotspot, index) => {
    const [x, y] = slots[index % slots.length];
    return {
      ...hotspot,
      x,
      y,
      width: Number(hotspot.width) > 0 ? hotspot.width : 14,
      height: Number(hotspot.height) > 0 ? hotspot.height : 12,
      placementStatus: 'ai_preplaced',
    };
  });
};

export const normalizeLabel = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

export const placeHotspotsFromElements = (hotspots = [], elements = []) => {
  if (!elements.length) return preplaceHotspots(hotspots);
  const usedElementIds = new Set();
  const placed = hotspots.map((hotspot, index) => {
    const hotspotLabel = normalizeLabel(`${hotspot.name} ${hotspot.dialogue}`);
    const matched = elements.find((element) => {
      if (usedElementIds.has(element.id)) return false;
      const elementLabel = normalizeLabel(`${element.label} ${element.id}`);
      return elementLabel && (hotspotLabel.includes(elementLabel) || elementLabel.includes(normalizeLabel(hotspot.name)));
    }) || elements[index % elements.length];
    if (matched?.id) usedElementIds.add(matched.id);
    return {
      ...hotspot,
      x: Number(matched?.x) || hotspot.x,
      y: Number(matched?.y) || hotspot.y,
      width: Number(matched?.width) || hotspot.width || 14,
      height: Number(matched?.height) || hotspot.height || 12,
      placementStatus: 'ai_element_estimate',
    };
  });
  return shouldPreplaceHotspots(placed) ? preplaceHotspots(placed) : placed;
};

export const getStepMeta = (status, locked, doneLabel, availableLabel, lockedLabel = 'verrouillé') => {
  if (status === 'running') return { icon: '⏳', label: 'En cours' };
  if (status === 'done') return { icon: '✔', label: doneLabel };
  if (locked) return { icon: '🔒', label: lockedLabel };
  return { icon: '→', label: availableLabel };
};

export const getProjectDiff = (before = {}, after = {}) => {
  const keys = [
    ['scenes', 'scènes'],
    ['items', 'objets'],
    ['enigmas', 'énigmes'],
    ['cinematics', 'cinématiques'],
    ['combinations', 'combinaisons'],
  ];
  return keys.map(([key, label]) => {
    const beforeMap = new Map((before[key] || []).map((entry) => [entry.id, entry]));
    const afterEntries = after[key] || [];
    const added = afterEntries.filter((entry) => entry?.id && !beforeMap.has(entry.id));
    const changed = afterEntries.filter((entry) => entry?.id && beforeMap.has(entry.id) && JSON.stringify(beforeMap.get(entry.id)) !== JSON.stringify(entry));
    return { key, label, added, changed };
  });
};

export const getDiffLines = (before, after) => getProjectDiff(before, after)
  .flatMap((entry) => [
    entry.added.length ? `+ ${entry.added.length} ${entry.label}` : '',
    entry.changed.length ? `~ ${entry.changed.length} ${entry.label} modifié(e)(s)` : '',
  ])
  .filter(Boolean);

export const markAiChanges = (before = {}, after = {}, actionLabel = 'IA') => {
  const next = structuredClone(after);
  ['scenes', 'items', 'enigmas', 'cinematics', 'combinations'].forEach((key) => {
    const beforeIds = new Set((before[key] || []).map((entry) => entry.id));
    next[key] = (next[key] || []).map((entry) => (
      beforeIds.has(entry.id) ?
         entry
        : { ...entry, aiGenerated: true, aiActionLabel: actionLabel }
    ));
  });
  return next;
};

export const getActionEstimate = (mode, action) => {
  const estimates = {
    generate: ['+ nouveau projet complet', '+ prompts images', '+ scènes', '+ objets', '+ énigmes'],
    progressive: ['+ Acte 1', '+ Acte 2 ensuite', '~ enrichissement contrôlé'],
    extend: ['+ ajouts ciblés', '~ projet existant conservé', '+ références validées'],
    improve: ['~ 1 scène modifiée', '~ dialogues', '~ ambiance', '~ objets si utile'],
    act1: ['+ 1 acte', '+ 3 à 6 scènes', '+ objets', '+ énigmes'],
    improveAct1: ['~ Acte 1', '~ dialogues', '~ ambiance'],
    act2_continuity: ['+ 1 acte', '+ 2 à 5 scènes', '+ objets', '+ énigmes'],
    enrich: ['~ dialogues', '~ détails visuels', '~ interactions'],
    continue_story: ['+ scènes de suite', '+ objets', '+ zones de liaison'],
    add_scenes: ['+ 1 à 3 scènes', '+ zones de navigation'],
    add_enigmas: ['+ 1 à 3 énigmes', '+ zones liées'],
    enrich_interactions: ['~ zones', '~ dialogues', '~ objets'],
  };
  return estimates[action] || estimates[mode] || [];
};

export const makeIdeaSuggestions = (theme, projectTitle) => [
  `Ajouter une cave secrète liée à ${theme || projectTitle || 'l’histoire'}`,
  'Introduire un fantôme lié à la famille',
  'Créer une énigme sonore',
  'Ajouter une clé rouillée et une serrure mécanique',
  'Révéler une pièce cachée derrière un tableau',
];

export const makeProjectStorySummary = (project = {}) => {
  const scenes = project.scenes || [];
  const startScene = scenes.find((scene) => scene.id === project.start?.targetSceneId) || scenes[0];
  const lastScene = scenes[scenes.length - 1];
  const sceneLines = scenes.slice(-5).map((scene) => {
    const firstDialogue = (scene.hotspots || []).find((hotspot) => hotspot.dialogue)?.dialogue || '';
    return `- ${scene.name}: ${(scene.introText || firstDialogue || 'Scène sans résumé.').split('\n')[0]}`;
  });
  return [
    `Titre: ${project.title || 'Projet sans titre'}`,
    startScene ? `Départ: ${startScene.name}` : '',
    lastScene ? `Dernière scène actuelle: ${lastScene.name}` : '',
    sceneLines.length ? 'Derniers événements:' : '',
    ...sceneLines,
  ].filter(Boolean).join('\n');
};

export const makeSceneChronology = (project = {}) => {
  const scenes = project.scenes || [];
  if (!scenes.length) return '';
  const ordered = [];
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const visited = new Set();
  let current = byId.get(project.start?.targetSceneId) || scenes[0];

  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    const nextId = (current.hotspots || []).find((hotspot) => (
      hotspot.targetSceneId && byId.has(hotspot.targetSceneId) && !visited.has(hotspot.targetSceneId)
    ))?.targetSceneId;
    current = nextId ? byId.get(nextId) : null;
  }

  scenes.forEach((scene) => {
    if (!visited.has(scene.id)) ordered.push(scene);
  });

  return ordered.map((scene, index) => (
    `${index + 1}. [${scene.id}] ${scene.name || 'Scène sans nom'}`
  )).join('\n');
};

export const getLastSceneIdFromChronology = (chronology = '', project = {}) => {
  const scenes = project.scenes || [];
  const lines = String(chronology || '').split('\n').map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const bracketId = line.match(/\[([^\]]+)\]/)?.[1];
    if (bracketId && scenes.some((scene) => scene.id === bracketId)) return bracketId;
    const matchedByName = scenes.find((scene) => line.toLowerCase().includes(String(scene.name || '').toLowerCase()));
    if (matchedByName) return matchedByName.id;
  }
  return getNarrativeEndScene(project)?.id || '';
};

export const parseChronologyEntries = (chronology = '', project = {}) => {
  const scenes = project.scenes || [];
  return String(chronology || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const id = line.match(/\[([^\]]+)\]/)?.[1] || '';
      const scene = scenes.find((entry) => entry.id === id)
        || scenes.find((entry) => line.toLowerCase().includes(String(entry.name || '').toLowerCase()));
      return {
        id: scene?.id || id || `manual_${index}`,
        sceneId: scene?.id || '',
        name: scene?.name || line.replace(/^\d+\.\s*/, '').replace(/\[[^\]]+\]\s*/, ''),
        raw: line,
      };
    });
};

export const formatChronologyEntries = (entries = []) => entries.map((entry, index) => (
  entry.sceneId ?
     `${index + 1}. [${entry.sceneId}] ${entry.name || 'Scène sans nom'}`
    : `${index + 1}. ${entry.name || entry.raw || 'Step manuelle'}`
)).join('\n');

export const getNarrativeEndScene = (project = {}) => {
  const scenes = project.scenes || [];
  if (!scenes.length) return null;
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  let current = byId.get(project.start?.targetSceneId) || scenes[0];
  const visited = new Set();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const nextId = (current.hotspots || []).find((hotspot) => (
      hotspot.targetSceneId && byId.has(hotspot.targetSceneId) && !visited.has(hotspot.targetSceneId)
    ))?.targetSceneId;
    if (!nextId) break;
    current = byId.get(nextId);
  }

  return current || scenes[scenes.length - 1] || null;
};

export const uniqueLines = (lines) => Array.from(new Set(lines.filter(Boolean)));

export const getItemFallbackIcon = (item) => {
  const icon = String(item?.icon || '').trim();
  if (icon && icon.length <= 3 && !/^it[_-]/i.test(icon)) return icon;
  return '•';
};

export const isTechnicalItemName = (value) => {
  const text = String(value || '').trim();
  return !text
    || /^[a-z0-9]{6,10}$/i.test(text)
    || (/^[a-z]*\d+[a-z0-9]*$/i.test(text) && text.length <= 12)
    || /^(it|obj|item)[_-]?[a-z0-9]+$/i.test(text);
};

export const getDisplayItemName = (item) => (
  isTechnicalItemName(item?.name) ? 'Objet à renommer' : item.name
);

export const getHeroItemPreviewLabel = (item) => {
  const type = item?.heroItemType || 'none';
  if (type === 'health_potion') return `Potion soin +${Number(item.heroItemAmount) || 0} PV`;
  if (type === 'mana_potion') return `Potion mana +${Number(item.heroItemAmount) || 0}`;
  if (type === 'equipment') {
    const bonus = Number(item.heroItemBonus) || 0;
    const sign = bonus >= 0 ? '+' : '';
    if ((item.heroItemBonusTarget || 'skill') === 'maxHealth') return `Équipement PV max ${sign}${bonus}`;
    if ((item.heroItemBonusTarget || 'skill') === 'maxMana') return `Équipement mana max ${sign}${bonus}`;
    return `Équipement ${item.heroItemSkillId || 'compétence'} ${sign}${bonus}`;
  }
  return '';
};

export const makeSceneVisualConstraints = (scene, project = {}) => {
  const lines = [];
  const text = `${scene?.name || ''} ${scene?.introText || ''}`.toLowerCase();
  const hotspots = scene?.hotspots || [];
  const scenes = project?.scenes || [];
  const enigmas = project?.enigmas || [];

  lines.push(`- lieu principal clairement identifiable: ${scene?.name || 'scène'}`);

  if (text.includes('vestibule') || text.includes('hall')) lines.push('- grand vestibule avec entrée, sol visible et profondeur vers le reste du lieu');
  if (text.includes('bibliothèque')) lines.push('- bibliothèques hautes, livres nombreux et au moins un rayon manipulable');
  if (text.includes('bureau')) lines.push('- bureau visible au centre ou sur un côté, avec documents et tiroirs lisibles');
  if (text.includes('cuisine')) lines.push('- cuisine ancienne avec plan de travail, placards et objets manipulables visibles');
  if (text.includes('cave')) lines.push('- cave sombre avec murs bruts, stockage et passage lisible vers la suite');
  if (text.includes('grenier')) lines.push('- grenier encombré avec poutrès, malles et zones de fouille distinctes');
  if (text.includes('jardin')) lines.push('- extérieur lisible avec chemin, végétation et point d’accès vers le bâtiment');
  if (text.includes('chambre')) lines.push('- lit, table dé chevet et éléments personnels clairement séparés');
  if (text.includes('salon')) lines.push('- salon avec assises, cheminée ou meuble central utilisable');
  if (text.includes('couloir')) lines.push('- couloir profond avec portes ou bifurcation visibles');

  hotspots.slice(0, 6).forEach((hotspot) => {
    const name = hotspot.name || 'zone interactive';
    if (hotspot.targetSceneId) {
      const target = scenes.find((entry) => entry.id === hotspot.targetSceneId);
      lines.push(`- sortie ou passage visible pour "${name}" vers ${target?.name || 'une autre scène'}`);
    } else if (hotspot.enigmaId) {
      const enigma = enigmas.find((entry) => entry.id === hotspot.enigmaId);
      lines.push(`- mécanisme ou support d’énigme visible pour "${name}"${enigma?.name ? ` (${enigma.name})` : ''}`);
    } else {
      lines.push(`- élément interactif distinct pour "${name}"`);
    }
  });

  if (!hotspots.length) lines.push('- décor large et lisible avec plusieurs zones interactives potentielles');
  lines.push('- composition en caméra large, sans texte incrusté, utilisable comme scène cliquable');
  lines.push('- exposition claire pour le jeu: ombres détaillées, aucun centre noir bouché, passages et objets inspectables');
  lines.push('- ne pas afficher les objets d’inventaire dans l’image: ils seront ajoutés manuellement par l’utilisateur dans la scène');

  return uniqueLines(lines).join('\n');
};

export const getCoherenceScore = (project, validation) => {
  if (!project) return null;
  let score = 10;
  score -= (validation?.errors?.length || 0) * 1.4;
  score -= (validation?.warnings?.length || 0) * 0.35;

  const scenes = project.scenes || [];
  const orphanScenes = scenes.filter((scene) => scene.id !== project.start?.targetSceneId && !scenes.some((candidate) => (
    (candidate.hotspots || []).some((hotspot) => hotspot.targetSceneId === scene.id)
  )));
  const emptyScenes = scenes.filter((scene) => !String(scene.introText || '').trim() || !(scene.hotspots || []).length);
  const emptyDialogues = scenes.flatMap((scene) => scene.hotspots || []).filter((hotspot) => !String(hotspot.dialogue || '').trim());

  score -= Math.min(2, orphanScenes.length * 0.35);
  score -= Math.min(1.5, emptyScenes.length * 0.45);
  score -= Math.min(1.2, emptyDialogues.length * 0.15);

  return Math.max(0, Math.min(10, score));
};

export const getCoherenceLabel = (score) => {
  if (score == null) return '';
  if (score >= 8.5) return 'Très cohérent';
  if (score >= 7) return 'Solide';
  if (score >= 5.5) return 'À vérifier';
  return 'Fragile';
};
