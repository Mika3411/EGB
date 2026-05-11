import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateAiProject } from '../utils/aiProjectGenerator';
import { buildGlobalSceneLayout, generateAiImage, getConnectedScenes } from '../utils/aiImageGenerator';
import { getAiAuthHeaders } from '../utils/aiAuthHeaders';
import { mergeProjectPatch, validateProject } from '../utils/projectValidation';
import { downloadBlob } from '../utils/fileHelpers';
import { createIndexedDraftStorage } from '../utils/indexedDraftStorage';
import { showConfirm } from './AccessibleDialog';

const FIELD_HELP = {
  title: "Nom du jeu. Si tu laisses vide, l'IA invente un titre cohérent avec le thème.",
  story: "Base narrative du jeu: situation de départ, mystère, objectif final. Vide = l'IA invente.",
  characters: "Personnages importants, alliés, antagonistes, voix entendues, victimes ou suspects. Vide = distribution aléatoire.",
  places: "Lieux imposés ou ambiance géographique. Vide = l'IA choisit les lieux selon le thème.",
  constraints: "Contraintes libres: public visé, choses interdites, twist obligatoire, style d'énigmes, fin souhaitée. Vide = choix aléatoires.",
  theme: "Thème principal de l'histoire: manoir, station spatiale, enquête policière, laboratoire, musée...",
  difficulty: "Influence la complexité des énigmes, le nombre de dépendances et les conditions de déblocage.",
  actCount: "Grandes parties de l'histoire. Un acte contient plusieurs scènes.",
  sceneCount: "Nombre de scènes principales à générer.",
  subsceneCount: "Nombre de sous-scènes rattachées à des scènes principales.",
  itemCount: "Objets d'inventaire qui pourront être trouvés, requis ou combinés.",
  heroBonusObjects: "Demande à l'IA de transformer une partie des objets en potions ou équipements Hero aventure. Les équipements peuvent augmenter une compétence, les PV max ou la mana max.",
  enigmaCount: "Énigmes créées et reliées aux zones d'action.",
  combinationCount: "Obligatoire. Combinaisons d'objets à créer. Exemple: clé + ruban = clé aimantée.",
  cinematicCount: "Cinématiques narratives créées avec des slides textuelles.",
  improve: "L'IA garde la structure de la scène et modifie seulement ambiance, dialogues et objets.",
  mode: "Choisit le type d'aide IA: créer un récit complet, avancer acte par acte, continuer un projet existant ou améliorer une scène précise.",
  tone: "Ambiance d'écriture utilisée pour les textes, dialogues et descriptions. Exemple: mystérieux, drôle, horrifique, poétique, réaliste.",
  duration: "Temps de jeu visé. L'IA s'en sert pour doser le nombre d'étapes, d'indices et de détours narratifs.",
  enrichmentType: "Définit ce que l'étape d'enrichissement doit renforcer en priorité: textes, descriptions visuelles, zones d'action ou tout ensemble.",
  source: "Projet utilisé comme base pour la continuation. Le projet actuel vient de l'éditeur, le JSON importé permet de repartir d'une sauvegarde externe.",
  importJson: "Charge un projet JSON existant pour que l'IA puisse le continuer sans dépendre du projet actuellement ouvert.",
  instruction: "Consigne libre pour guider l'IA. Plus elle est concrète, plus le résultat respectera ton intention.",
  storySummary: "Résumé de l'histoire déjà jouée. Il sert à garder la suite cohérente avec les révélations et enjeux actuels.",
  sceneChronology: "Ordre chronologique canonique. Numérote les scènes dans l'ordre de l'histoire; la suite partira de la dernière ligne.",
  continuationWish: "Direction souhaitée pour la suite. Laisse vide pour demander une suite aléatoire mais cohérente.",
  continuationScene: "Scène exacte depuis laquelle l'histoire doit continuer. La nouvelle scène doit être reliée à celle-ci.",
  extendInstruction: "Ajoute une contrainte ou une idée à la continuation: nouveau lieu, type d'énigme, objet important, révélation, ton souhaité...",
  visualConstraints: "Contraintes données au générateur d'image pour cette scène. Liste les éléments qui doivent être visibles et leur placement approximatif.",
  imagePrompt: "Prompt image fourni par l'IA. Tu peux le retoucher avant de générer l'image correspondante.",
};

const IMAGE_STYLE_PRESETS = {
  realistic: {
    label: 'Réaliste',
    description: 'cinématique photoréaliste, textures naturelles, lumière de film, profondeur et détails réalistes',
  },
  illustrated: {
    label: 'BD / manga',
    description: 'illustration BD manga adulte, encrage fin, contours expressifs, ombres dessinées, rendu cinématographique stylisé',
  },
};

const AI_DRAFT_DB = 'escape-game-builder-ai-drafts';
const AI_DRAFT_AUTOSAVE_DELAY_MS = 2_500;
const AI_CREDITS_ENDPOINT = import.meta.env.VITE_AI_CREDITS_ENDPOINT || '/api/ai-credits';
const AI_PROJECT_PRIVACY_NOTICE = "Quand tu lances une génération IA, les informations nécessaires du projet peuvent être transmises au fournisseur IA: titres, scènes, dialogues, personnages, contraintes et consignes. Les médias volumineux ne sont pas inclus dans ce contexte texte compacté.";
const aiDraftStorage = createIndexedDraftStorage(AI_DRAFT_DB);
const readAiDraft = aiDraftStorage.read;
const writeAiDraft = aiDraftStorage.write;
const deleteAiDraft = aiDraftStorage.remove;

const stripLargeMediaFields = (value) => {
  if (Array.isArray(value)) return value.map(stripLargeMediaFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => {
    const isLargeMediaField = /^(backgroundData|imageData|objectImageData|popupImageData|videoData|audioData)$/i.test(key);
    if (isLargeMediaField) return [key, ''];
    return [key, stripLargeMediaFields(entryValue)];
  }));
};

const HelpLabel = ({ children, help, className = '' }) => (
  <label className={`label-with-help${className ? ` ${className}` : ''}`}>
    <span>{children}</span>
    <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
  </label>
);

const AiPrivacyNotice = () => (
  <div className="ai-privacy-notice" role="note">
    <strong>Confidentialité IA</strong>
    <p>{AI_PROJECT_PRIVACY_NOTICE}</p>
  </div>
);

const shouldPreplaceHotspots = (hotspots = []) => {
  if (!hotspots.length) return false;
  const usable = hotspots.filter((spot) => Number.isFinite(Number(spot.x)) && Number.isFinite(Number(spot.y)));
  if (usable.length !== hotspots.length) return true;
  const uniquePositions = new Set(usable.map((spot) => `${Math.round(Number(spot.x))}:${Math.round(Number(spot.y))}`));
  const allNearDefault = usable.every((spot) => Math.abs(Number(spot.x) - 50) <= 1 && Math.abs(Number(spot.y) - 50) <= 1);
  return uniquePositions.size <= 1 || allNearDefault;
};

const preplaceHotspots = (hotspots = []) => {
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

const normalizeLabel = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const placeHotspotsFromElements = (hotspots = [], elements = []) => {
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

const getStepMeta = (status, locked, doneLabel, availableLabel, lockedLabel = 'verrouillé') => {
  if (status === 'running') return { icon: '⏳', label: 'En cours' };
  if (status === 'done') return { icon: '✔', label: doneLabel };
  if (locked) return { icon: '🔒', label: lockedLabel };
  return { icon: '→', label: availableLabel };
};

const getProjectDiff = (before = {}, after = {}) => {
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

const getDiffLines = (before, after) => getProjectDiff(before, after)
  .flatMap((entry) => [
    entry.added.length ? `+ ${entry.added.length} ${entry.label}` : '',
    entry.changed.length ? `~ ${entry.changed.length} ${entry.label} modifié(e)(s)` : '',
  ])
  .filter(Boolean);

const markAiChanges = (before = {}, after = {}, actionLabel = 'IA') => {
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

const getActionEstimate = (mode, action) => {
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

const makeIdeaSuggestions = (theme, projectTitle) => [
  `Ajouter une cave secrète liée à ${theme || projectTitle || 'l’histoire'}`,
  'Introduire un fantôme lié à la famille',
  'Créer une énigme sonore',
  'Ajouter une clé rouillée et une serrure mécanique',
  'Révéler une pièce cachée derrière un tableau',
];

const makeProjectStorySummary = (project = {}) => {
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

const makeSceneChronology = (project = {}) => {
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

const getLastSceneIdFromChronology = (chronology = '', project = {}) => {
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

const parseChronologyEntries = (chronology = '', project = {}) => {
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

const formatChronologyEntries = (entries = []) => entries.map((entry, index) => (
  entry.sceneId ?
     `${index + 1}. [${entry.sceneId}] ${entry.name || 'Scène sans nom'}`
    : `${index + 1}. ${entry.name || entry.raw || 'Step manuelle'}`
)).join('\n');

const getNarrativeEndScene = (project = {}) => {
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

const uniqueLines = (lines) => Array.from(new Set(lines.filter(Boolean)));

const getItemFallbackIcon = (item) => {
  const icon = String(item?.icon || '').trim();
  if (icon && icon.length <= 3 && !/^it[_-]/i.test(icon)) return icon;
  return '•';
};

const isTechnicalItemName = (value) => {
  const text = String(value || '').trim();
  return !text
    || /^[a-z0-9]{6,10}$/i.test(text)
    || (/^[a-z]*\d+[a-z0-9]*$/i.test(text) && text.length <= 12)
    || /^(it|obj|item)[_-]?[a-z0-9]+$/i.test(text);
};

const getDisplayItemName = (item) => (
  isTechnicalItemName(item?.name) ? 'Objet à renommer' : item.name
);

const getHeroItemPreviewLabel = (item) => {
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

const makeSceneVisualConstraints = (scene, project = {}) => {
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

const getCoherenceScore = (project, validation) => {
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

const getCoherenceLabel = (score) => {
  if (score == null) return '';
  if (score >= 8.5) return 'Très cohérent';
  if (score >= 7) return 'Solide';
  if (score >= 5.5) return 'À vérifier';
  return 'Fragile';
};

export default function AiTab({
  project,
  getSceneLabel,
  onApplyProject,
  onSaveAiDraft,
  onPersistAiImage,
  projectStorageKey = 'default',
}) {
  const [mode, setMode] = useState('generate');
  const [brief, setBrief] = useState({
    title: '',
    theme: 'Manoir familial hanté',
    story: '',
    characters: '',
    places: '',
    constraints: '',
    difficulty: 'normal',
    actCount: 2,
    sceneCount: 8,
    subsceneCount: 5,
    itemCount: 10,
    heroBonusObjects: true,
    enigmaCount: 5,
    combinationCount: 3,
    cinematicCount: 3,
    tone: 'mystérieux et cinématographique',
    duration: '45 minutes',
  });
    const [instruction, setInstruction] = useState('Améliore cette scène pour la rendre plus stressante.');
  const [targetSceneId, setTargetSceneId] = useState(project?.scenes?.[0]?.id || '');
  const [generatedProject, setGeneratedProject] = useState(null);
  const [isPatch, setIsPatch] = useState(false);
  const [status, setStatus] = useState('');
  const [validation, setValidation] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageStatus, setImageStatus] = useState('');
  const [generatingImageKey, setGeneratingImageKey] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageCompare, setImageCompare] = useState(null);
  const [aiCredits, setAiCredits] = useState({
    balance: null,
    costs: { text: 2, image: 5 },
    nextObjectImageCost: 3,
    objectImagesInCurrentBatch: 0,
    objectImageBatchSize: 1,
    isLoading: false,
    error: '',
  });
  const [progressiveStatus, setProgressiveStatus] = useState({
    act1: 'pending',
    improveAct1: 'pending',
    act2: 'pending',
    enrich: 'pending',
  });
  const [enrichmentType, setEnrichmentType] = useState('all');
  const [sceneVisualConstraints, setSceneVisualConstraints] = useState({});
  const [imageStylePreset, setImageStylePreset] = useState('realistic');
  const [globalVisualStyle, setGlobalVisualStyle] = useState('réaliste, mystérieux mais clairement éclairé, manoir ancien, caméra large, zones interactives visibles, ombres détaillées non bouchées');
  const [imageReadabilityLevel, setImageReadabilityLevel] = useState('balanced');
  const [visualInheritance, setVisualInheritance] = useState('même type de poignée de porte, même parquet, même lumière, mêmes matériaux');
  const [storySummary, setStorySummary] = useState(() => makeProjectStorySummary(project));
  const [sceneChronology, setSceneChronology] = useState(() => makeSceneChronology(project));
  const [continuationWish, setContinuationWish] = useState('');
  const [continuationSceneId, setContinuationSceneId] = useState(() => getLastSceneIdFromChronology(makeSceneChronology(project), project));
  const [extendInstruction, setExtendInstruction] = useState('');
  const [importedProject, setImportedProject] = useState(null);
  const [extendSource, setExtendSource] = useState('current');
  const [ideaSuggestions, setIdeaSuggestions] = useState([]);
  const [aiHistory, setAiHistory] = useState([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState('');
  const [draftVersion, setDraftVersion] = useState(0);
  const indexedDraftSaveTimerRef = useRef(null);
  const isBeginnerAi = project?.creationMode === 'beginner';
  const isIntermediateAi = project?.creationMode === 'intermediate';
  const isHeroAdventureAi = project?.creationMode === 'hero_adventure' || project?.heroAdventure?.enabled;
  const isChoiceAdventureAi = ['adventure', 'adventure_choices'].includes(project?.creationMode) && !isHeroAdventureAi;
  const isClassicExpertAi = !isBeginnerAi && !isIntermediateAi && !isHeroAdventureAi && !isChoiceAdventureAi;
  const constrainedCreationMode = isBeginnerAi ? 'beginner' : isIntermediateAi ? 'intermediate' : isChoiceAdventureAi ? 'adventure' : isClassicExpertAi ? 'expert' : '';
  const shouldGenerateCombinations = isChoiceAdventureAi || isClassicExpertAi;
  const aiDraftKey = useMemo(() => (
    `ai-draft:${projectStorageKey || project?.title || project?.start?.targetSceneId || 'default'}`
  ), [projectStorageKey, project?.title, project?.start?.targetSceneId]);
  const refreshAiCredits = useCallback(async () => {
    setAiCredits((previous) => ({ ...previous, isLoading: true, error: '' }));
    try {
      const response = await fetch(AI_CREDITS_ENDPOINT, {
        headers: await getAiAuthHeaders(),
      });
      if (!response.ok) throw new Error(`Crédits indisponibles (${response.status}).`);
      const payload = await response.json();
      setAiCredits({
        balance: Number(payload.balance || 0),
        costs: payload.costs || { text: 2, image: 5 },
        nextObjectImageCost: Number(payload.nextObjectImageCost ?? 3),
        objectImagesInCurrentBatch: Number(payload.objectImagesInCurrentBatch || 0),
        objectImageBatchSize: Number(payload.objectImageBatchSize || payload.costs?.objectImageBatchSize || 1),
        isLoading: false,
        error: '',
      });
    } catch (error) {
      setAiCredits((previous) => ({ ...previous, isLoading: false, error: error.message || 'Crédits indisponibles.' }));
    }
  }, []);
  const countCreditUnits = (value) => Math.max(0, Math.round(Number(value) || 0));
  const getModeConstrainedBrief = (targetBrief = brief) => {
    if (isClassicExpertAi) {
      return {
        ...targetBrief,
        heroBonusObjects: false,
        expertBrief: true,
      };
    }
    if (isIntermediateAi) {
      return {
        ...targetBrief,
        combinationCount: 0,
        heroBonusObjects: false,
        intermediateBrief: true,
      };
    }
    if (!isBeginnerAi) return targetBrief;
    return {
      ...targetBrief,
      actCount: 1,
      subsceneCount: 0,
      combinationCount: 0,
      cinematicCount: 0,
      heroBonusObjects: false,
      beginnerBrief: true,
    };
  };
  const stripUnsupportedModeFeatures = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || (!isBeginnerAi && !isIntermediateAi && !isChoiceAdventureAi && !isClassicExpertAi)) return candidate;
    const next = structuredClone(candidate);
    next.creationMode = constrainedCreationMode;
    delete next.heroAdventure;
    if (!isChoiceAdventureAi && Array.isArray(next.storyVariables)) next.storyVariables = [];
    if ((isBeginnerAi || isIntermediateAi) && Array.isArray(next.combinations)) next.combinations = [];
    if (isBeginnerAi) {
      if (Array.isArray(next.cinematics)) next.cinematics = [];
      delete next.routeMap;
    }
    if (Array.isArray(next.items)) next.items = next.items.map((item) => {
      const cleanItem = { ...item };
      delete cleanItem.heroItemType;
      delete cleanItem.heroItemAmount;
      delete cleanItem.heroItemConsumeOnUse;
      delete cleanItem.heroItemBonusTarget;
      delete cleanItem.heroItemSkillId;
      delete cleanItem.heroItemBonus;
      return cleanItem;
    });
    if (Array.isArray(next.scenes)) next.scenes = next.scenes.map((scene) => ({
      ...scene,
      hotspots: (scene.hotspots || []).map((hotspot) => {
        const cleanHotspot = { ...hotspot };
        delete cleanHotspot.heroMalusHealthLoss;
        delete cleanHotspot.heroMalusManaLoss;
        delete cleanHotspot.heroMalusMessage;
        if (isBeginnerAi || isIntermediateAi) delete cleanHotspot.logicRules;
        if (!isChoiceAdventureAi) delete cleanHotspot.conversation;
        if (isChoiceAdventureAi && cleanHotspot.conversation?.nodes) {
          cleanHotspot.conversation = {
            ...cleanHotspot.conversation,
            nodes: cleanHotspot.conversation.nodes.map((node) => ({
              ...node,
              replies: (node.replies || []).map((reply) => {
                const cleanReply = { ...reply };
                delete cleanReply.heroMalusHealthLoss;
                delete cleanReply.heroMalusManaLoss;
                delete cleanReply.heroMalusMessage;
                return cleanReply;
              }),
            })),
          };
        }
        delete cleanHotspot.advancedConditions;
        if (cleanHotspot.actionType === 'conversation') cleanHotspot.actionType = 'dialogue';
        if (isBeginnerAi && cleanHotspot.actionType === 'cinematic') {
          cleanHotspot.actionType = 'dialogue';
          cleanHotspot.targetCinematicId = '';
        }
        return cleanHotspot;
      }),
    }));
    return next;
  };
  const calculateBriefCreditCost = (targetBrief = brief) => {
    const constrainedBrief = getModeConstrainedBrief(targetBrief);
    const units = aiCredits.costs?.projectGeneration || {
      act: 2,
      scene: 1,
      enigma: 1,
      cinematic: 1,
      item: 1,
      combination: 1,
    };
    return Math.max(1, Math.ceil(
      countCreditUnits(constrainedBrief.actCount) * Number(units.act || 0)
      + countCreditUnits(constrainedBrief.sceneCount) * Number(units.scene || 0)
      + countCreditUnits(constrainedBrief.enigmaCount) * Number(units.enigma || 0)
      + (shouldGenerateCombinations ? countCreditUnits(constrainedBrief.combinationCount) * Number(units.combination || 0) : 0)
      + countCreditUnits(constrainedBrief.cinematicCount) * Number(units.cinematic || 0)
      + countCreditUnits(constrainedBrief.itemCount) * Number(units.item || 0),
    ));
  };
  const calculateProjectGenerationCreditCost = () => calculateBriefCreditCost(brief);
  const getGenerationBrief = (targetBrief = brief) => ({
    ...getModeConstrainedBrief(targetBrief),
    heroAdventureBrief: isHeroAdventureAi,
    adventureChoicesBrief: isChoiceAdventureAi,
    expertBrief: isClassicExpertAi,
    heroBonusObjects: Boolean(isHeroAdventureAi && targetBrief.heroBonusObjects !== false),
    ...(isChoiceAdventureAi ? {} : {
      title: '',
      story: '',
      characters: '',
      places: '',
      constraints: '',
      ...(isClassicExpertAi ? {} : { combinationCount: 0 }),
      heroBonusObjects: false,
    }),
  });
  const getProgressiveActNumber = (stage = '') => {
    const match = String(stage).match(/^act(\d+)$/);
    return match ? Number(match[1]) : 0;
  };
  const splitProgressiveCount = (key, stage) => {
    const total = countCreditUnits(brief[key]);
    const acts = Math.max(1, countCreditUnits(brief.actCount) || 1);
    const actNumber = getProgressiveActNumber(stage);
    if (!actNumber) return total;
    const base = Math.floor(total / acts);
    const remainder = total % acts;
    const count = base + (actNumber <= remainder ? 1 : 0);
    return Math.max(key === 'sceneCount' ? 1 : 0, count);
  };
  const getProgressiveStageBrief = (stage) => {
    const actNumber = getProgressiveActNumber(stage);
    const actTotal = Math.max(1, countCreditUnits(brief.actCount) || 1);
    if (!actNumber || actNumber > actTotal) return null;
    return {
      ...brief,
      actCount: 1,
      sceneCount: splitProgressiveCount('sceneCount', stage),
      subsceneCount: splitProgressiveCount('subsceneCount', stage),
      itemCount: splitProgressiveCount('itemCount', stage),
      enigmaCount: splitProgressiveCount('enigmaCount', stage),
      combinationCount: splitProgressiveCount('combinationCount', stage),
      cinematicCount: splitProgressiveCount('cinematicCount', stage),
    };
  };
  const getProgressiveStageSummary = (stage) => {
    const stageBrief = getProgressiveStageBrief(stage);
    if (!stageBrief) return '';
    return `${stageBrief.sceneCount} scènes, ${stageBrief.itemCount} objets, ${stageBrief.enigmaCount} énigmes, ${stageBrief.cinematicCount} cinématiques`;
  };
  const progressiveActStages = Array.from(
    { length: Math.max(1, countCreditUnits(brief.actCount) || 1) },
    (_, index) => `act${index + 1}`,
  );
  const getAiCreditCost = (kind) => {
    if (kind === 'text' && mode === 'generate') return calculateProjectGenerationCreditCost();
    if (isChoiceAdventureAi && (kind === 'objectImage' || kind === 'objectThumbnail')) return Number(aiCredits.costs?.image ?? 5);
    if (kind === 'objectImage') return Number(aiCredits.nextObjectImageCost ?? 1);
    if (kind === 'objectThumbnail') return Number(aiCredits.costs?.objectThumbnail ?? 1);
    return Number(aiCredits.costs?.[kind] ?? (kind === 'image' ? 5 : 2));
  };
  const calculateBriefImageCreditCost = (targetBrief = brief) => {
    const constrainedBrief = getModeConstrainedBrief(targetBrief);
    const imageCost = getAiCreditCost('image');
    const imageCount = countCreditUnits(constrainedBrief.sceneCount)
      + countCreditUnits(constrainedBrief.itemCount)
      + countCreditUnits(constrainedBrief.cinematicCount);
    return imageCount * imageCost;
  };
  const calculateBriefTotalCreditCost = (targetBrief = brief, targetMode = mode, stage = '') => (
    getTextGenerationCreditCost(targetMode, stage) + calculateBriefImageCreditCost(targetBrief)
  );
  const getTextGenerationCreditCost = (targetMode = mode, stage = '') => {
    if (targetMode === 'generate') return calculateProjectGenerationCreditCost();
    if (targetMode === 'progressive') {
      const stageBrief = getProgressiveStageBrief(stage || 'act1');
      return stageBrief ? calculateBriefCreditCost(stageBrief) : Number(aiCredits.costs?.text ?? 2);
    }
    if (targetMode === 'extend') {
      return stage && stage !== 'enrich_interactions' ? calculateBriefCreditCost(brief) : Number(aiCredits.costs?.text ?? 2);
    }
    if (targetMode === 'improve') return Number(aiCredits.costs?.improve ?? 5);
    return Number(aiCredits.costs?.text ?? 2);
  };
  const hasEnoughAiCredits = (kind, costOverride = null) => (
    aiCredits.balance == null || aiCredits.balance >= (costOverride ?? getAiCreditCost(kind))
  );
  const aiCreditMessage = (kind, costOverride = null) => {
    const cost = costOverride ?? getAiCreditCost(kind);
    return `Crédits IA insuffisants: ${aiCredits.balance || 0}/${cost}.`;
  };
  const currentTextGenerationCost = getTextGenerationCreditCost(
    mode,
    mode === 'progressive' ? 'act1' : mode === 'extend' ? 'continue_story' : '',
  );
  const canRunTextAi = !aiCredits.isLoading && hasEnoughAiCredits('text', currentTextGenerationCost);
  const canRunImageAi = !aiCredits.isLoading && hasEnoughAiCredits('image');
  const canRunObjectImageAi = !aiCredits.isLoading && hasEnoughAiCredits('objectImage');
  const canRunObjectThumbnailAi = !aiCredits.isLoading && hasEnoughAiCredits('objectThumbnail');
  const formatCreditCost = (cost) => `${cost} crédit${Number(cost) > 1 ? 's' : ''}`;
  const selectedImageStyle = IMAGE_STYLE_PRESETS[imageStylePreset] || IMAGE_STYLE_PRESETS.realistic;
  const effectiveVisualStyle = `${selectedImageStyle.description}. ${globalVisualStyle}`;
  useEffect(() => {
    if (isBeginnerAi && (mode === 'progressive' || mode === 'extend')) {
      setMode('generate');
    }
  }, [isBeginnerAi, mode]);
  const briefForm = (
    <>
      {isChoiceAdventureAi ? (
      <section className="ai-brief-document">
        <span className="section-kicker">Document IA</span>
        <HelpLabel help={FIELD_HELP.title}>Nom du jeu</HelpLabel>
        <input value={brief.title} onChange={(event) => updateBrief('title', event.target.value)} placeholder="Vide = titre invente par l'IA" />

        <HelpLabel help={FIELD_HELP.story}>Histoire</HelpLabel>
        <textarea value={brief.story} onChange={(event) => updateBrief('story', event.target.value)} placeholder="Vide = histoire aléatoire mais cohérente avec le thème." />

        <HelpLabel help={FIELD_HELP.characters}>Personnages</HelpLabel>
        <textarea value={brief.characters} onChange={(event) => updateBrief('characters', event.target.value)} placeholder="Vide = personnages inventes par l'IA." />

        <HelpLabel help={FIELD_HELP.places}>Lieux / univers</HelpLabel>
        <textarea value={brief.places} onChange={(event) => updateBrief('places', event.target.value)} placeholder="Vide = lieux choisis par l'IA." />

        <HelpLabel help={FIELD_HELP.constraints}>Contraintes libres</HelpLabel>
        <textarea value={brief.constraints} onChange={(event) => updateBrief('constraints', event.target.value)} placeholder="Vide = choix aléatoires. Ex: familial, sans horreur, twist final, fin secrète..." />
      </section>
      ) : null}

      <HelpLabel help={FIELD_HELP.theme}>Thème</HelpLabel>
      <input value={brief.theme} onChange={(event) => updateBrief('theme', event.target.value)} />

      <HelpLabel help={FIELD_HELP.difficulty}>Difficulté</HelpLabel>
      <select value={brief.difficulty} onChange={(event) => updateBrief('difficulty', event.target.value)}>
        <option value="easy">Facile</option>
        <option value="normal">Intermediaire</option>
        <option value="hard">Difficile</option>
      </select>

      <div className="grid-two small-gap">
        {!isBeginnerAi ? (
        <div>
          <HelpLabel help={FIELD_HELP.actCount}>Actes</HelpLabel>
          <input type="number" min="1" max="6" value={brief.actCount} onChange={(event) => updateBrief('actCount', event.target.value)} required />
        </div>
        ) : null}
        <div>
          <HelpLabel help={FIELD_HELP.sceneCount}>Scènes</HelpLabel>
          <input type="number" min="1" max="24" value={brief.sceneCount} onChange={(event) => updateBrief('sceneCount', event.target.value)} required />
        </div>
        {!isBeginnerAi ? (

        <div>
          <HelpLabel help={FIELD_HELP.subsceneCount}>Sous-scenes</HelpLabel>
          <input type="number" min="0" max="24" value={brief.subsceneCount} onChange={(event) => updateBrief('subsceneCount', event.target.value)} />

        </div>

        ) : null}
        <div>
          <HelpLabel help={FIELD_HELP.itemCount}>Objets</HelpLabel>
          <input type="number" min="1" max="40" value={brief.itemCount} onChange={(event) => updateBrief('itemCount', event.target.value)} required />
        </div>
        {isHeroAdventureAi ? (
        <div>
          <HelpLabel help={FIELD_HELP.heroBonusObjects}>Objets avec bonus</HelpLabel>
          <label className="checkbox-row ai-inline-check">
            <input
              type="checkbox"
              checked={brief.heroBonusObjects !== false}
              onChange={(event) => updateBrief('heroBonusObjects', event.target.checked)}
            />
            <span>Potions et équipements</span>
          </label>
        </div>
        ) : null}
        <div>
          <HelpLabel help={FIELD_HELP.enigmaCount}>Énigmes</HelpLabel>
          <input type="number" min="0" max="20" value={brief.enigmaCount} onChange={(event) => updateBrief('enigmaCount', event.target.value)} required />
        </div>
        {shouldGenerateCombinations ? (
        <div>
          <HelpLabel help={FIELD_HELP.combinationCount}>Combinaisons</HelpLabel>
          <input type="number" min="0" max="30" value={brief.combinationCount} onChange={(event) => updateBrief('combinationCount', event.target.value)} required />
        </div>
        ) : null}
        {!isBeginnerAi ? (

        <div>
          <HelpLabel help={FIELD_HELP.cinematicCount}>Cinematiques</HelpLabel>
          <input type="number" min="0" max="12" value={brief.cinematicCount} onChange={(event) => updateBrief('cinematicCount', event.target.value)} required />

        </div>

        ) : null}
      </div>

      <HelpLabel help={FIELD_HELP.tone}>Ton</HelpLabel>
      <input value={brief.tone} onChange={(event) => updateBrief('tone', event.target.value)} />

      <HelpLabel help={FIELD_HELP.duration}>Durée visée</HelpLabel>
      <input value={brief.duration} onChange={(event) => updateBrief('duration', event.target.value)} />
    </>
  );

  useEffect(() => {
    refreshAiCredits();
  }, [refreshAiCredits]);

  useEffect(() => {
    if (!project?.scenes?.some((scene) => scene.id === targetSceneId)) {
      setTargetSceneId(project?.scenes?.[0]?.id || '');
    }
  }, [project, targetSceneId]);

  useEffect(() => {
    if (!project?.scenes?.some((scene) => scene.id === continuationSceneId)) {
      setContinuationSceneId(getLastSceneIdFromChronology(sceneChronology, project));
    }
  }, [project, continuationSceneId, sceneChronology]);

  useEffect(() => {
    let cancelled = false;
    setDraftRestored(false);
    const projectDraft = project?.aiDraft || project?.__aiDraft || null;
    const restoreDraft = (draft, label) => {
      setGeneratedProject(draft.generatedProject);
      setIsPatch(Boolean(draft.isPatch));
      setSceneVisualConstraints(draft.sceneVisualConstraints || {});
      setGlobalVisualStyle(draft.globalVisualStyle || 'réaliste, mystérieux mais clairement éclairé, manoir ancien, caméra large, zones interactives visibles, ombres détaillées non bouchées');
      setImageReadabilityLevel(draft.imageReadabilityLevel || 'balanced');
      setVisualInheritance(draft.visualInheritance || 'même type de poignée de porte, même parquet, même lumière, mêmes matériaux');
      setStorySummary(draft.storySummary || makeProjectStorySummary(project));
      setSceneChronology(draft.sceneChronology || makeSceneChronology(project));
      setContinuationWish(draft.continuationWish || '');
      setContinuationSceneId(draft.continuationSceneId || getNarrativeEndScene(project)?.id || '');
      setStatus(draft.status || label);
      setImageStatus(draft.imageStatus || '');
      setValidation(validateProject(draft.isPatch ? mergeProjectPatch(project, draft.generatedProject) : draft.generatedProject));
    };

    readAiDraft(aiDraftKey)
      .then((draft) => {
        if (cancelled) return;
        if (draft?.generatedProject) {
          restoreDraft(draft, 'Brouillon IA complet restauré.');
          return;
        }
        if (projectDraft?.generatedProject) {
          restoreDraft(projectDraft, 'Copie légère du brouillon IA restaurée.');
        }
      })
      .catch(() => {
        if (!cancelled && projectDraft?.generatedProject) {
          restoreDraft(projectDraft, 'Copie légère du brouillon IA restaurée.');
        } else if (!cancelled) {
          setStatus('Sauvegarde du brouillon IA indisponible sur ce navigateur.');
        }
      })
      .finally(() => {
        if (!cancelled) setDraftRestored(true);
      });

    return () => {
      cancelled = true;
      if (indexedDraftSaveTimerRef.current) clearTimeout(indexedDraftSaveTimerRef.current);
    };
  }, [aiDraftKey, draftVersion]);

  const clearAiDraft = async () => {
    setGeneratedProject(null);
    setValidation(null);
    setIsPatch(false);
    setImageStatus('');
    setDraftSaveStatus('');
    setStatus('Brouillon IA effacé. Tu peux relancer une génération.');
    await deleteAiDraft(aiDraftKey).catch(() => null);
    await onSaveAiDraft?.(null).catch(() => null);
    setDraftVersion((version) => version + 1);
  };

  const buildAiDraftPayload = () => ({
    generatedProject,
    isPatch,
    sceneVisualConstraints,
    globalVisualStyle,
    imageReadabilityLevel,
    visualInheritance,
    storySummary,
    sceneChronology,
    continuationWish,
    continuationSceneId,
    status,
    imageStatus,
    savedAt: new Date().toISOString(),
  });

  const buildLightAiDraftPayload = () => stripLargeMediaFields(buildAiDraftPayload());

  const saveDraftNow = async (options = {}) => {
    const {
      includeProjectCopy,
      manual,
    } = typeof options === 'boolean'
      ? { includeProjectCopy: options, manual: options }
      : { includeProjectCopy: Boolean(options.includeProjectCopy), manual: Boolean(options.manual) };
    if (!generatedProject) {
      if (manual) setDraftSaveStatus('Aucun brouillon IA à sauvegarder.');
      return;
    }

    const fullDraft = buildAiDraftPayload();
    const lightDraft = includeProjectCopy ? buildLightAiDraftPayload() : null;
    let fullSaved = false;
    let projectSaved = false;

    try {
      await writeAiDraft(aiDraftKey, fullDraft);
      fullSaved = true;
    } catch {
      fullSaved = false;
    }

    if (includeProjectCopy && onSaveAiDraft) {
      try {
        await onSaveAiDraft(lightDraft);
        projectSaved = true;
      } catch {
        projectSaved = false;
      }
    }

    if (fullSaved && projectSaved) {
      setDraftSaveStatus(manual ? 'Brouillon IA sauvegardé: complet sur cet appareil, copie légère dans le projet.' : 'Brouillon IA sauvegardé.');
      return;
    }
    if (fullSaved) {
      setDraftSaveStatus(manual ? 'Brouillon IA complet sauvegardé sur cet appareil.' : 'Brouillon IA sauvegardé localement.');
      return;
    }
    if (projectSaved) {
      setDraftSaveStatus(manual ? 'Copie légère du brouillon sauvegardée dans le projet.' : 'Brouillon IA sauvegardé dans le projet.');
      return;
    }

    throw new Error('Aucune sauvegarde de brouillon n’a abouti.');
  };

  useEffect(() => {
    if (!draftRestored || !generatedProject) {
      if (indexedDraftSaveTimerRef.current) clearTimeout(indexedDraftSaveTimerRef.current);
      indexedDraftSaveTimerRef.current = null;
      return undefined;
    }
    if (indexedDraftSaveTimerRef.current) clearTimeout(indexedDraftSaveTimerRef.current);
    indexedDraftSaveTimerRef.current = setTimeout(() => {
      indexedDraftSaveTimerRef.current = null;
      saveDraftNow({ manual: false, includeProjectCopy: false }).catch(() => {
        setDraftSaveStatus('Brouillon IA non sauvegardé: stockage indisponible.');
      });
    }, AI_DRAFT_AUTOSAVE_DELAY_MS);
    return () => {
      if (indexedDraftSaveTimerRef.current) clearTimeout(indexedDraftSaveTimerRef.current);
      indexedDraftSaveTimerRef.current = null;
    };
  }, [
    draftRestored,
    generatedProject,
    globalVisualStyle,
    imageReadabilityLevel,
    imageStatus,
    isPatch,
    sceneVisualConstraints,
    sceneChronology,
    status,
    storySummary,
    continuationSceneId,
    continuationWish,
    visualInheritance,
  ]);

  const scenes = project?.scenes || [];

  const previewCandidate = useMemo(() => {
    if (!generatedProject) return null;
    return isPatch ? mergeProjectPatch(project, generatedProject) : generatedProject;
  }, [generatedProject, isPatch, project]);

  const counts = useMemo(() => ({
    acts: previewCandidate?.acts?.length || 0,
    scenes: previewCandidate?.scenes?.length || 0,
    items: previewCandidate?.items?.length || 0,
    enigmas: previewCandidate?.enigmas?.length || 0,
    cinematics: previewCandidate?.cinematics?.length || 0,
    combinations: previewCandidate?.combinations?.length || 0,
  }), [previewCandidate]);

  const narrativePreview = useMemo(() => {
    if (!generatedProject) return null;

    if (isPatch) {
      const patchedScenes = (generatedProject.scenes || []).map((patchedScene) => {
        const previousScene = project?.scenes?.find((scene) => scene.id === patchedScene.id);
        const scene = { ...(previousScene || {}), ...patchedScene };
        return {
          id: scene.id,
          name: scene.name || previousScene?.name || 'Scène modifiée',
          introText: scene.introText || '',
          backgroundData: scene.backgroundData || '',
          aiVisualElements: scene.aiVisualElements || [],
          hotspots: scene.hotspots || [],
        };
      });

      return {
        title: 'Amélioration proposée',
        subtitle: `${patchedScenes.length} scène(s) touchée(s), le reste du projet reste intact.`,
        scenes: patchedScenes,
        items: [],
        enigmas: [],
        cinematics: [],
      };
    }

    return {
      title: previewCandidate?.title || 'Projet généré',
      subtitle: `${counts.acts} acte(s), ${counts.scenes} scène(s), ${counts.items} objet(s), ${counts.enigmas} énigme(s).`,
      scenes: previewCandidate?.scenes || [],
      items: (previewCandidate?.items || []).slice(0, 8),
      enigmas: (previewCandidate?.enigmas || []).slice(0, 5),
      cinematics: (previewCandidate?.cinematics || []).slice(0, 4),
    };
  }, [counts, generatedProject, isPatch, previewCandidate, project]);

  const updateBrief = (key, value) => {
    setBrief((previous) => ({ ...previous, [key]: value }));
  };
  const validateMandatoryBriefCounts = (targetBrief = brief) => {
    const constrainedBrief = getModeConstrainedBrief(targetBrief);
    const requiredCounts = [
      ['sceneCount', 'scenes'],
      ['enigmaCount', 'enigmes'],
      ...(!isBeginnerAi ? [['actCount', 'actes']] : []),
      ...(shouldGenerateCombinations ? [['combinationCount', 'combinaisons']] : []),
      ...(!isBeginnerAi ? [['cinematicCount', 'cinematiques']] : []),
      ['itemCount', 'objets'],
    ];
    const missing = requiredCounts
      .filter(([key]) => constrainedBrief[key] === '' || constrainedBrief[key] == null || Number.isNaN(Number(constrainedBrief[key])))
      .map(([, label]) => label);
    if (missing.length) {
      setStatus(`Champs obligatoires a remplir: ${missing.join(', ')}.`);
      return false;
    }
    return true;
  };

  const extensionSourceProject = extendSource === 'imported' && importedProject ? importedProject : project;
  const extensionScenes = extensionSourceProject?.scenes || [];
  const continuationScene = extensionScenes.find((scene) => scene.id === continuationSceneId)
    || extensionScenes[extensionScenes.length - 1]
    || null;

  const currentDiffLines = previewCandidate ? getDiffLines(project, previewCandidate) : [];
  const coherenceScore = previewCandidate ? getCoherenceScore(previewCandidate, validation) : null;

  const pushHistory = (label, snapshot) => {
    if (!snapshot) return;
    setAiHistory((previous) => [
      ...previous.slice(-5),
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label,
        project: structuredClone(snapshot),
      },
    ]);
  };

  const setGeneratedWithHistory = (nextProject, label, baseline = project) => {
    const constrainedProject = stripUnsupportedModeFeatures(nextProject);
    if (generatedProject) pushHistory(label, generatedProject);
    setGeneratedProject(markAiChanges(baseline, constrainedProject, label));
  };

  const restoreHistory = (entry) => {
    if (!entry?.project) return;
    pushHistory('Version actuelle', generatedProject);
    setGeneratedProject(entry.project);
    setIsPatch(false);
    validateCandidate(entry.project, false);
    setStatus(`${entry.label} restaurée.`);
  };

  const validateCandidate = (candidate, patchMode = isPatch) => {
    const modeCandidate = patchMode ? candidate : stripUnsupportedModeFeatures(candidate);
    const projectToValidate = patchMode ? mergeProjectPatch(project, candidate) : modeCandidate;
    const result = validateProject(projectToValidate);
    setValidation(result);
    return result;
  };

  const updateSceneVisualConstraints = (sceneId, value) => {
    setSceneVisualConstraints((previous) => ({ ...previous, [sceneId]: value }));
  };

  const getSceneVisualConstraints = (scene) => (
    sceneVisualConstraints[scene.id] || makeSceneVisualConstraints(scene, previewCandidate || project)
  );

  const assertPlayableAiCandidate = (candidate) => {
    if (!Array.isArray(candidate?.scenes) || candidate.scenes.length < 1) {
      const error = new Error('Le brouillon IA ne contient aucune scène exploitable. Relance la génération.');
      error.code = 'AI_PROJECT_WITHOUT_SCENES';
      throw error;
    }
  };

  const generate = async () => {
    if (!validateMandatoryBriefCounts()) return;
    const generationCost = getTextGenerationCreditCost(mode);
    if (!hasEnoughAiCredits('text', generationCost)) {
      setStatus(aiCreditMessage('text', generationCost));
      return;
    }
    setIsGenerating(true);
    setValidation(null);
    setGeneratedProject(null);
    setStatus(`${mode === 'improve' ? 'Amélioration' : 'Génération'} en cours (${formatCreditCost(generationCost)})...`);
    try {
      const result = await generateAiProject(getGenerationBrief(), {
        mode,
        beginnerMode: isBeginnerAi,
        intermediateMode: isIntermediateAi,
        expertMode: isClassicExpertAi,
        currentProject: project,
        target: { type: 'scene', id: targetSceneId },
        instruction,
      });
      const baseline = mode === 'improve' ? project : {};
      const nextProject = result.isPatch ? mergeProjectPatch(project, result.project) : result.project;
      assertPlayableAiCandidate(nextProject);
      setGeneratedWithHistory(nextProject, mode === 'improve' ? 'Amélioration scène' : 'Génération initiale', baseline);
      setIsPatch(false);
      validateCandidate(nextProject, false);
      setStatus(result.source === 'api' ?
         (result.isPatch ? 'Patch généré par API IA.' : 'Projet généré par API IA.')
        : `${result.isPatch ? 'Patch généré localement' : 'Projet généré localement'}. ${result.warning ? `API non utilisée: ${result.warning}` : ''}`);
    } catch (error) {
      setStatus(`Erreur de génération: ${error.message}`);
    } finally {
      setIsGenerating(false);
      refreshAiCredits();
    }
  };

  const generateProgressiveStep = async (stage) => {
    const stageBrief = getProgressiveStageBrief(stage) || brief;
    const generationBrief = getGenerationBrief(stageBrief);
    if (!validateMandatoryBriefCounts(stageBrief)) return;
    const generationCost = getTextGenerationCreditCost('progressive', stage);
    if (!hasEnoughAiCredits('text', generationCost)) {
      setStatus(aiCreditMessage('text', generationCost));
      return;
    }
    setIsGenerating(true);
    setValidation(null);
    setGeneratedProject(null);
    setProgressiveStatus((previous) => ({ ...previous, [stage]: 'running' }));
    const actNumber = getProgressiveActNumber(stage);
    const stageLabel = actNumber ? `Acte ${actNumber}` : stage;
    setStatus(`Génération progressive: ${stageLabel} (${formatCreditCost(generationCost)})...`);
    try {
      const result = await generateAiProject(generationBrief, {
        mode: 'progressive',
        stage,
        enrichmentType,
        currentProject: previewCandidate || project,
      });
      const nextProject = result.isPatch ?
         mergeProjectPatch(previewCandidate || project, result.project)
        : result.project;
      assertPlayableAiCandidate(nextProject);
      setGeneratedWithHistory(nextProject, stageLabel, previewCandidate || project);
      setIsPatch(false);
      validateCandidate(nextProject, false);
      setProgressiveStatus((previous) => ({ ...previous, [stage]: 'done' }));
      setStatus(result.source === 'api' ?
         `${stageLabel} généré par API IA.`
        : `${stageLabel} généré localement. ${result.warning ? `API non utilisée: ${result.warning}` : ''}`);
    } catch (error) {
      setProgressiveStatus((previous) => ({ ...previous, [stage]: 'pending' }));
      setStatus(`Erreur de génération progressive: ${error.message}`);
    } finally {
      setIsGenerating(false);
      refreshAiCredits();
    }
  };

  const importExtensionJson = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const result = validateProject(parsed);
      setImportedProject(result.project);
      setExtendSource('imported');
      setStatus(result.ok ? 'JSON importé pour continuation.' : `JSON importé avec erreurs: ${result.errors[0]}`);
    } catch (error) {
      setStatus(`Import JSON impossible: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const extendExistingProject = async (stage) => {
    if (!validateMandatoryBriefCounts()) return;
    const generationCost = getTextGenerationCreditCost('extend', stage);
    if (!hasEnoughAiCredits('text', generationCost)) {
      setStatus(aiCreditMessage('text', generationCost));
      return;
    }
    setIsGenerating(true);
    setValidation(null);
    setGeneratedProject(null);
    const labels = {
      continue_story: 'Continuer l’histoire',
      add_scenes: 'Ajouter des scènes',
      add_enigmas: 'Ajouter des énigmes',
      enrich_interactions: 'Enrichir les interactions',
    };
    setStatus(`${labels[stage]} (${formatCreditCost(generationCost)})...`);
    try {
      const result = await generateAiProject(getGenerationBrief(), {
        mode: 'extend',
        stage,
        currentProject: extensionSourceProject,
        instruction: continuationWish || extendInstruction,
        storySummary,
        sceneChronology,
        continuationWish,
        continuationSceneId: continuationScene?.id || getLastSceneIdFromChronology(sceneChronology, extensionSourceProject),
      });
      const safePatch = stripUnsupportedModeFeatures(result.project);
      const nextProject = mergeProjectPatch(extensionSourceProject, safePatch);
      if (extendSource === 'current') {
        if (generatedProject) pushHistory(labels[stage], generatedProject);
        setGeneratedProject(markAiChanges(extensionSourceProject, safePatch, labels[stage]));
        setIsPatch(true);
        validateCandidate(safePatch, true);
      } else {
        setGeneratedWithHistory(nextProject, labels[stage], extensionSourceProject);
        setIsPatch(false);
        validateCandidate(nextProject, false);
      }
      setStatus(result.source === 'api' ?
         `${labels[stage]} généré par API IA.`
        : `${labels[stage]} généré localement. ${result.warning ? `API non utilisée: ${result.warning}` : ''}`);
    } catch (error) {
      setStatus(`Erreur: ${error.message}`);
    } finally {
      setIsGenerating(false);
      refreshAiCredits();
    }
  };

  const proposeIdeas = () => {
    setIdeaSuggestions(makeIdeaSuggestions(brief.theme, extensionSourceProject?.title));
    setStatus('Suggestions IA prêtes.');
  };

  const useSuggestion = (suggestion) => {
    if (mode === 'improve') setInstruction(suggestion);
    else {
      setContinuationWish(suggestion);
      setExtendInstruction(suggestion);
    }
    setStatus('Suggestion ajoutée aux instructions.');
  };

  const moveChronologyEntry = (index, direction) => {
    const entries = parseChronologyEntries(sceneChronology, extensionSourceProject);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    const nextEntries = [...entries];
    [nextEntries[index], nextEntries[nextIndex]] = [nextEntries[nextIndex], nextEntries[index]];
    const nextChronology = formatChronologyEntries(nextEntries);
    setSceneChronology(nextChronology);
    setContinuationSceneId(getLastSceneIdFromChronology(nextChronology, extensionSourceProject));
  };

  const applyProject = async () => {
    if (!generatedProject) return;
    try {
      const lines = getDiffLines(project, generatedProject);
      const message = [
        'Confirmer les modifications ?',
        '',
        ...(lines.length ? lines : ['Aucune différence détectée.']),
      ].join('\n');
      const confirmed = await showConfirm({
        title: 'Confirmer les modifications',
        message,
        confirmLabel: 'Appliquer',
      });
      if (!confirmed) {
        setStatus('Application annulée.');
        return;
      }
      const sceneToValidateId = generatedProject.scenes?.find((scene) => scene.backgroundData)?.id
        || generatedProject.scenes?.[0]?.id
        || targetSceneId;
      const fullDraft = buildAiDraftPayload();
      const lightDraft = buildLightAiDraftPayload();
      let fullDraftSaved = false;
      try {
        await writeAiDraft(aiDraftKey, fullDraft);
        fullDraftSaved = true;
      } catch {
        fullDraftSaved = false;
      }
      const result = await onApplyProject?.(generatedProject, {
        mode,
        isPatch,
        selectedSceneId: sceneToValidateId,
        aiDraft: lightDraft,
      });
      setValidation(result || validateCandidate(generatedProject, isPatch));
      setDraftSaveStatus(fullDraftSaved ?
         'Brouillon IA conservé: complet sur cet appareil, copie légère dans le projet.'
        : 'Copie légère du brouillon IA conservée dans le projet.');
      setStatus(isPatch ?
         'Amélioration appliquée. Vérifie rapidement l’image et les zones dans l’éditeur.'
        : 'Projet appliqué. Vérifie rapidement les images et les zones dans l’éditeur.');
    } catch (error) {
      setValidation(error.validation || validateCandidate(generatedProject, isPatch));
      setStatus(`Validation refusée: ${error.message}`);
    }
  };

  const patchGeneratedScene = (sceneId, patch) => {
    setGeneratedProject((previous) => {
      if (!previous) return previous;
      const existingScenes = Array.isArray(previous.scenes) ? previous.scenes : [];
      const hasScene = existingScenes.some((scene) => scene.id === sceneId);
      const scenes = hasScene ?
         existingScenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene))
        : [...existingScenes, { id: sceneId, ...patch }];
      return { ...previous, scenes };
    });
  };

  const patchGeneratedItem = (itemId, patch) => {
    setGeneratedProject((previous) => {
      if (!previous?.items) return previous;
      return {
        ...previous,
        items: previous.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      };
    });
  };

  const patchGeneratedCinematicSlide = (cinematicId, slideId, patch) => {
    setGeneratedProject((previous) => {
      if (!previous?.cinematics) return previous;
      return {
        ...previous,
        cinematics: previous.cinematics.map((cinematic) => (
          cinematic.id === cinematicId ? {
            ...cinematic,
            slides: (cinematic.slides || []).map((slide) => (
              slide.id === slideId ? { ...slide, ...patch } : slide
            )),
          } : cinematic
        )),
      };
    });
  };

  const makeImageVariant = ({ imageData, imageName, label, kind }) => ({
    id: `variant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    imageData,
    imageName: imageName || `${kind || 'image'}-${Date.now()}.png`,
    label: label || 'Image IA',
    kind: kind || 'image',
    createdAt: new Date().toISOString(),
  });

  const mergeImageVariants = (current = [], previousVariant, nextVariant) => {
    const variants = [
      ...(Array.isArray(current) ? current : []),
      previousVariant,
      nextVariant,
    ].filter((variant) => variant?.imageData);
    const seen = new Set();
    return variants
      .filter((variant) => {
        if (seen.has(variant.imageData)) return false;
        seen.add(variant.imageData);
        return true;
      })
      .slice(-10);
  };

  const downloadImage = async (src, name = 'image.png') => {
    const safeName = String(name || 'image.png').replace(/[\\/:*?"<>|]+/g, '-');
    if (!src.startsWith('data:')) {
      try {
        const response = await fetch(src);
        if (response.ok) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = safeName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(objectUrl);
          return;
        }
      } catch {
        // Fall back to a direct browser download/open below.
      }
    }
    const link = document.createElement('a');
    link.href = src;
    link.download = safeName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openImageCompare = (target) => {
    const variants = Array.isArray(target.variants) ? target.variants.filter((variant) => variant?.imageData) : [];
    if (!variants.length) return;
    setImageCompare({ ...target, variants });
  };

  const selectImageVariant = async (variant) => {
    if (!imageCompare || !variant?.imageData) return;
    const patch = imageCompare.type === 'scene' ? {
      backgroundData: variant.imageData,
      backgroundName: variant.imageName,
      aiImageVariants: imageCompare.variants,
    } : {
      imageData: variant.imageData,
      imageName: variant.imageName,
      aiImageVariants: imageCompare.variants,
    };

    if (imageCompare.type === 'scene') {
      patchGeneratedScene(imageCompare.id, patch);
      await onPersistAiImage?.({ type: 'scene', id: imageCompare.id, patch });
    } else if (imageCompare.type === 'item') {
      patchGeneratedItem(imageCompare.id, patch);
      await onPersistAiImage?.({ type: 'item', id: imageCompare.id, patch });
    } else if (imageCompare.type === 'cinematicSlide') {
      const slidePatch = { ...patch, slideId: imageCompare.slideId };
      patchGeneratedCinematicSlide(imageCompare.id, imageCompare.slideId, slidePatch);
      await onPersistAiImage?.({ type: 'cinematicSlide', id: imageCompare.id, patch: slidePatch });
    }

    setImageCompare((previous) => previous ? { ...previous, activeImageData: variant.imageData } : previous);
    setImageStatus(`Image choisie pour "${imageCompare.title}".`);
  };

  const renameGeneratedItem = async (itemId, name) => {
    const nextName = String(name || '').trim();
    patchGeneratedItem(itemId, { name: nextName });
    await onPersistAiImage?.({ type: 'item', id: itemId, patch: { name: nextName } });
  };

  const exportAiJson = () => {
    if (!generatedProject) {
      setStatus('Aucun brouillon IA à exporter.');
      return;
    }
    const safeTitle = String(generatedProject.title || 'projet-ia')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'projet-ia';
    downloadBlob(`${safeTitle}-ia.json`, new Blob([JSON.stringify(generatedProject, null, 2)], { type: 'application/json' }));
    setStatus('JSON IA exporté.');
  };

  const generateSceneImage = async (scene) => {
    const generationCost = getAiCreditCost('image');
    if (!hasEnoughAiCredits('image', generationCost)) {
      setImageStatus(aiCreditMessage('image', generationCost));
      return;
    }
    const key = `scène:${scene.id}`;
    setGeneratingImageKey(key);
    setImageStatus(`Génération de l’image de "${scene.name}" (${formatCreditCost(generationCost)})...`);
    try {
      const visualContext = {
        currentScene: scene.name,
        connectedScenes: getConnectedScenes(previewCandidate || project, scene),
        globalTheme: brief.theme || previewCandidate?.title || project?.title,
        style: effectiveVisualStyle,
        stylePreset: imageStylePreset,
        visualInheritance,
        useEntityImagePrompt: isChoiceAdventureAi,
        layout: buildGlobalSceneLayout(previewCandidate || project),
      };
      const result = await generateAiImage({
        type: 'scene',
        entity: scene,
        projectTitle: previewCandidate?.title || project?.title,
        project: previewCandidate || project,
        visualConstraints: getSceneVisualConstraints(scene),
        visualContext,
        regenerate: Boolean(scene.backgroundData),
        readabilityLevel: imageReadabilityLevel,
      });
      const hotspots = placeHotspotsFromElements(scene.hotspots || [], result.elements || []);
      const previousVariant = scene.backgroundData ? makeImageVariant({
        imageData: scene.backgroundData,
        imageName: scene.backgroundName,
        label: 'Image précédente',
        kind: 'scene',
      }) : null;
      const nextVariant = makeImageVariant({
        imageData: result.imageData,
        imageName: result.imageName,
        label: `Image ${Number(scene.aiImageVariants?.length || 0) + 1}`,
        kind: 'scene',
      });
      const scenePatch = {
        backgroundData: result.imageData,
        backgroundName: result.imageName,
        aiImageVariants: mergeImageVariants(scene.aiImageVariants, previousVariant, nextVariant),
        aiVisualConstraints: getSceneVisualConstraints(scene),
        aiVisualContext: visualContext,
        aiReadabilityLevel: imageReadabilityLevel,
        aiVisualElements: result.elements || [],
        hotspots,
      };
      patchGeneratedScene(scene.id, scenePatch);
      const persisted = await onPersistAiImage?.({ type: 'scene', id: scene.id, patch: scenePatch });
      if (persisted?.patch) patchGeneratedScene(scene.id, persisted.patch);
      setImageStatus(result.warning || `Image de "${scene.name}" prête. Zones estimées depuis les éléments visuels, à valider dans l’éditeur.`);
    } catch (error) {
      setImageStatus(`Erreur image: ${error.message}`);
    } finally {
      setGeneratingImageKey('');
      refreshAiCredits();
    }
  };

  const generateItemImage = async (item, variant = 'full') => {
    const isThumbnail = variant === 'thumbnail';
    const creditKind = isThumbnail ? 'objectThumbnail' : 'objectImage';
    const generationCost = getAiCreditCost(creditKind);
    if (!hasEnoughAiCredits(creditKind, generationCost)) {
      setImageStatus(aiCreditMessage(creditKind, generationCost));
      return;
    }
    const key = `item:${variant}:${item.id}`;
    setGeneratingImageKey(key);
      setImageStatus(`Génération de ${isThumbnail ? (isChoiceAdventureAi ? 'la miniature' : 'la miniature économique') : 'l’image détaillée'} de "${item.name}" (${formatCreditCost(generationCost)})...`);
    try {
      const result = await generateAiImage({
        type: 'item',
        entity: { ...item, name: getDisplayItemName(item) },
        projectTitle: previewCandidate?.title || project?.title,
        visualContext: {
          style: effectiveVisualStyle,
          stylePreset: imageStylePreset,
          useEntityImagePrompt: isChoiceAdventureAi,
        },
        regenerate: Boolean(item.imageData),
        variant,
      });
      const previousVariant = item.imageData ? makeImageVariant({
        imageData: item.imageData,
        imageName: item.imageName,
        label: 'Image précédente',
        kind: isThumbnail ? 'thumbnail' : 'item',
      }) : null;
      const nextVariant = makeImageVariant({
        imageData: result.imageData,
        imageName: result.imageName,
        label: isThumbnail ? (isChoiceAdventureAi ? 'Miniature' : 'Miniature économique') : 'Image détaillée',
        kind: isThumbnail ? 'thumbnail' : 'item',
      });
      const itemPatch = {
        imageData: result.imageData,
        imageName: result.imageName,
        aiImageVariants: mergeImageVariants(item.aiImageVariants, previousVariant, nextVariant),
      };
      patchGeneratedItem(item.id, itemPatch);
      const persisted = await onPersistAiImage?.({ type: 'item', id: item.id, patch: itemPatch });
      if (persisted?.patch) patchGeneratedItem(item.id, persisted.patch);
      setImageStatus(result.warning || `${isThumbnail ? (isChoiceAdventureAi ? 'Miniature' : 'Miniature économique') : 'Image détaillée'} de "${getDisplayItemName(item)}" prête.`);
    } catch (error) {
      setImageStatus(`Erreur image: ${error.message}`);
    } finally {
      setGeneratingImageKey('');
      refreshAiCredits();
    }
  };

  const generateCinematicImage = async (cinematic, slide = null) => {
    const targetSlide = slide || cinematic?.slides?.[0];
    if (!cinematic || !targetSlide) return;
    const generationCost = getAiCreditCost('image');
    if (!hasEnoughAiCredits('image', generationCost)) {
      setImageStatus(aiCreditMessage('image', generationCost));
      return;
    }
    const key = `cinematic:${cinematic.id}:${targetSlide.id}`;
    setGeneratingImageKey(key);
    setImageStatus(`Génération de l’image de la cinématique "${cinematic.name}" (${formatCreditCost(generationCost)})...`);
    try {
      const result = await generateAiImage({
        type: 'cinematic',
        entity: {
          id: targetSlide.id,
          name: `Slide de ${cinematic.name}`,
          cinematicName: cinematic.name,
          narration: targetSlide.narration,
          imagePrompt: targetSlide.imagePrompt,
        },
        projectTitle: previewCandidate?.title || project?.title,
        project: previewCandidate || project,
        visualContext: {
          globalTheme: brief.theme || previewCandidate?.title || project?.title,
          style: effectiveVisualStyle,
          stylePreset: imageStylePreset,
          visualInheritance,
          useEntityImagePrompt: isChoiceAdventureAi,
        },
        regenerate: Boolean(targetSlide.imageData),
        readabilityLevel: imageReadabilityLevel,
      });
      const slidePatch = {
        slideId: targetSlide.id,
        imageData: result.imageData,
        imageName: result.imageName,
        aiImageVariants: mergeImageVariants(
          targetSlide.aiImageVariants,
          targetSlide.imageData ? makeImageVariant({
            imageData: targetSlide.imageData,
            imageName: targetSlide.imageName,
            label: 'Image précédente',
            kind: 'cinematic',
          }) : null,
          makeImageVariant({
            imageData: result.imageData,
            imageName: result.imageName,
            label: `Image ${Number(targetSlide.aiImageVariants?.length || 0) + 1}`,
            kind: 'cinematic',
          }),
        ),
      };
      patchGeneratedCinematicSlide(cinematic.id, targetSlide.id, slidePatch);
      const persisted = await onPersistAiImage?.({ type: 'cinematicSlide', id: cinematic.id, patch: slidePatch });
      if (persisted?.patch) patchGeneratedCinematicSlide(cinematic.id, targetSlide.id, persisted.patch);
      setImageStatus(result.warning || `Image de "${cinematic.name}" prête.`);
    } catch (error) {
      setImageStatus(`Erreur image cinématique: ${error.message}`);
    } finally {
      setGeneratingImageKey('');
      refreshAiCredits();
    }
  };

  const isAiBusy = isGenerating || Boolean(generatingImageKey);

  return (
    <div className="layout two-cols-wide">
      {isAiBusy ? (
        <div className="ai-generation-overlay" role="status" aria-live="polite">
          <div className="ai-generation-modal">
            <span className="ai-generation-spinner" aria-hidden="true" />
            <strong>génération en cours ...</strong>
            <span>Veuillez patienter, cela peut prendre quelques minutes.</span>
          </div>
        </div>
      ) : null}
      {imagePreview ? (
        <div className="ai-image-preview-overlay" role="dialog" aria-modal="true" onClick={() => setImagePreview(null)}>
          <div className="ai-image-preview-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="secondary-action" onClick={() => setImagePreview(null)}>Fermer</button>
            <img src={imagePreview.src} alt={imagePreview.name || 'Aperçu'} />
            <strong>{imagePreview.name || 'Aperçu'}</strong>
            <button type="button" className="secondary-action" onClick={() => downloadImage(imagePreview.src, imagePreview.name || 'image.png')}>Télécharger</button>
          </div>
        </div>
      ) : null}
      {imageCompare ? (
        <div className="ai-image-preview-overlay" role="dialog" aria-modal="true" onClick={() => setImageCompare(null)}>
          <div className="ai-image-compare-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ai-compare-head">
              <strong>{imageCompare.title}</strong>
              <button type="button" className="secondary-action" onClick={() => setImageCompare(null)}>Fermer</button>
            </div>
            <div className="ai-compare-grid">
              {imageCompare.variants.map((variant, index) => {
                const selected = variant.imageData === imageCompare.activeImageData;
                return (
                  <article key={variant.id || variant.imageData} className={selected ? 'selected' : ''}>
                    <button type="button" className="ai-compare-image-button" onClick={() => {
                      setImageCompare(null);
                      setImagePreview({ src: variant.imageData, name: variant.imageName || imageCompare.title });
                    }}>
                      <img src={variant.imageData} alt={variant.label || `Image ${index + 1}`} />
                    </button>
                    <span>{variant.label || `Image ${index + 1}`}</span>
                    <div>
                      <button type="button" className="secondary-action" disabled={selected} onClick={() => selectImageVariant(variant)}>
                        {selected ? 'Sélectionnée' : 'Choisir'}
                      </button>
                      <button type="button" className="secondary-action" onClick={() => downloadImage(variant.imageData, variant.imageName || `${imageCompare.title}-${index + 1}.png`)}>
                        Télécharger
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      <section className="panel side" data-tour="ai-controls">
        <div className="panel-head">
          <h2>IA</h2>
          <span className="status-badge soft">{mode === 'improve' ? 'Patch' : 'IA'}</span>
        </div>
        <div data-tour="ai-credits" className={`ai-credit-panel ${aiCredits.balance != null && aiCredits.balance < currentTextGenerationCost ? 'low' : ''}`}>
          <div>
            <span className="section-kicker">Crédits IA</span>
            <strong>{aiCredits.isLoading ? '...' : `${aiCredits.balance ?? 0}`}</strong>
          </div>
          <button type="button" className="secondary-action" onClick={refreshAiCredits} disabled={aiCredits.isLoading}>
            Actualiser
          </button>
          <p>
            {isChoiceAdventureAi ?
              `Projet: ${calculateProjectGenerationCreditCost()} crédits · Texte: ${Number(aiCredits.costs?.text ?? 2)} crédits · Chaque image: ${formatCreditCost(getAiCreditCost('image'))} · Combinaisons incluses dans le calcul`
              : <>Projet: {calculateProjectGenerationCreditCost()} crédits · Texte: {Number(aiCredits.costs?.text ?? 2)} crédits · Scène: {getAiCreditCost('image')} crédits · Objet détaillé: {formatCreditCost(getAiCreditCost('objectImage'))} · Miniature éco: {formatCreditCost(getAiCreditCost('objectThumbnail'))}</>}
          </p>
          <p className="ai-current-cost">
            Prochaine génération ({mode === 'generate' ? 'projet complet' : mode === 'progressive' ? 'step progressive' : mode === 'extend' ? 'continuer/enrichir' : 'amélioration'}): <strong>{formatCreditCost(currentTextGenerationCost)}</strong>
          </p>
          {isChoiceAdventureAi ? (
            <p className="ai-current-cost">
              Images du brief: <strong>{countCreditUnits(brief.sceneCount) + countCreditUnits(brief.itemCount) + countCreditUnits(brief.cinematicCount)} image(s) - {formatCreditCost(calculateBriefImageCreditCost())}</strong>
              {' '}si tu génères toutes les scènes, objets et cinématiques. Total texte + images: <strong>{formatCreditCost(calculateBriefTotalCreditCost())}</strong>
            </p>
          ) : null}
          {aiCredits.error ? <p className="small-note">{aiCredits.error}</p> : null}
        </div>
        <AiPrivacyNotice />
        <p className="small-note">
          Génère un projet complet ou améliore une scène existante avec un JSON partiel validé avant application.
        </p>

        <HelpLabel help="Choisis le rendu utilisé par les prochaines images IA: scènes, objets et cinématiques.">Style d'image</HelpLabel>
        <div className="segmented-control compact ai-style-choice" data-tour="ai-image-style">
          {Object.entries(IMAGE_STYLE_PRESETS).map(([value, preset]) => (
            <button
              type="button"
              key={value}
              className={imageStylePreset === value ? 'active' : ''}
              onClick={() => setImageStylePreset(value)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <HelpLabel help="Style partagé par les images de scènes pour éviter que chaque pièce parte dans une direction visuelle différente.">Style visuel global</HelpLabel>
        <input data-tour="ai-visual-style" value={globalVisualStyle} onChange={(event) => setGlobalVisualStyle(event.target.value)} />

        <HelpLabel help="Ajuste automatiquement la luminosité après génération pour garder une image jouable sans trop délaver l'ambiance.">Lisibilité des images</HelpLabel>
        <select data-tour="ai-image-readability" value={imageReadabilityLevel} onChange={(event) => setImageReadabilityLevel(event.target.value)}>
          <option value="subtle">Ambiance sombre</option>
          <option value="balanced">Lisibilité renforcée</option>
          <option value="strong">Très lumineux</option>
          <option value="none">Aucune correction</option>
        </select>

        <HelpLabel help="Détails récurrents à conserver entre les pièces: portes, parquet, lumière, époque, matériaux.">Héritage visuel</HelpLabel>
        <textarea data-tour="ai-visual-inheritance" value={visualInheritance} onChange={(event) => setVisualInheritance(event.target.value)} />

        <HelpLabel help={FIELD_HELP.mode}>Mode</HelpLabel>
        <div className="segmented-control" data-tour="ai-mode">
          <button type="button" className={mode === 'generate' ? 'active' : ''} onClick={() => setMode('generate')}>Nouveau</button>
          {!isBeginnerAi ? (
            <>
              <button type="button" className={mode === 'progressive' ? 'active' : ''} onClick={() => setMode('progressive')}>Progressif</button>
              <button type="button" className={mode === 'extend' ? 'active' : ''} onClick={() => setMode('extend')}>Continuer</button>
            </>
          ) : null}
          <button type="button" className={mode === 'improve' ? 'active' : ''} onClick={() => setMode('improve')}>Améliorer</button>
        </div>

        <div className="ai-estimate-panel" data-tour="ai-estimate">
          <strong>Modifiera probablement :</strong>
          <b className="ai-cost-line">Coût annoncé avant lancement: {formatCreditCost(currentTextGenerationCost)}</b>
          <div className="ai-estimate-tags">
            {getActionEstimate(mode).map((line) => <span key={line}>{line}</span>)}
          </div>
        </div>

        {mode === 'improve' ? (
          <>
            <HelpLabel help={FIELD_HELP.improve}>Scène à améliorer</HelpLabel>
            <select value={targetSceneId} onChange={(event) => setTargetSceneId(event.target.value)}>
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene) || scene.name}</option>
              ))}
            </select>

            <HelpLabel help={FIELD_HELP.instruction}>Instruction</HelpLabel>
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Ex: Améliore cette scène pour la rendre plus stressante."
            />
            <p className="small-note">Structure protégée: seules l’ambiance, les dialogues et les objets peuvent être raffinés.</p>
            <button type="button" className="secondary-action full" onClick={proposeIdeas}>Proposer des idées</button>
            {ideaSuggestions.length ? (
              <div className="ai-suggestion-list">
                {ideaSuggestions.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => useSuggestion(suggestion)}>{suggestion}</button>
                ))}
              </div>
            ) : null}
          </>
        ) : mode === 'progressive' ? (
          <>
            {briefForm}

            <div className="ai-progressive-steps">
              {progressiveActStages.map((stage, index) => {
                const actNumber = index + 1;
                const previousStage = index > 0 ? progressiveActStages[index - 1] : '';
                const statusValue = progressiveStatus[stage] || 'pending';
                const isAvailable = index === 0 || progressiveStatus[previousStage] === 'done';
                const cost = getTextGenerationCreditCost('progressive', stage);
                const meta = getStepMeta(statusValue, !isAvailable, `Acte ${actNumber} généré`, `Acte ${actNumber} disponible`);
                if (!isAvailable && statusValue !== 'running' && statusValue !== 'done') return null;
                return (
                  <button type="button" key={stage} disabled={isGenerating || aiCredits.isLoading || !hasEnoughAiCredits('text', cost) || !isAvailable} onClick={() => generateProgressiveStep(stage)}>
                    <strong>{meta.icon} Acte {actNumber}</strong>
                    <span>{getProgressiveStageSummary(stage)} · {formatCreditCost(cost)}</span>
                  </button>
                );
              })}
            </div>

          </>
        ) : mode === 'extend' ? (
          <>
            {briefForm}

            <HelpLabel help={FIELD_HELP.source}>Source</HelpLabel>
            <div className="segmented-control compact">
              <button type="button" className={extendSource === 'current' ? 'active' : ''} onClick={() => setExtendSource('current')}>Projet actuel</button>
              <button type="button" className={extendSource === 'imported' ? 'active' : ''} onClick={() => setExtendSource('imported')} disabled={!importedProject}>JSON importé</button>
            </div>

            <HelpLabel help={FIELD_HELP.importJson}>Importer un JSON existant</HelpLabel>
            <label className="button like secondary-action full">
              Importer un JSON existant
              <input type="file" accept="application/json,.json" hidden onChange={importExtensionJson} />
            </label>
            {importedProject ? <p className="small-note">JSON chargé: {importedProject.title || 'Projet importé'}</p> : null}

            <HelpLabel help={FIELD_HELP.storySummary}>Résumé de l'histoire</HelpLabel>
            <textarea
              value={storySummary}
              onChange={(event) => setStorySummary(event.target.value)}
              placeholder="Résume les événements, révélations et objectifs déjà posés."
            />
            <button type="button" className="secondary-action full" onClick={() => setStorySummary(makeProjectStorySummary(extensionSourceProject))}>
              Refaire le résumé depuis le projet
            </button>

            <HelpLabel help={FIELD_HELP.sceneChronology}>Chronologie des scènes</HelpLabel>
            <div className="ai-chronology-list">
              {parseChronologyEntries(sceneChronology, extensionSourceProject).map((entry, index, entries) => (
                <div className="ai-chronology-row" key={`${entry.id}:${index}`}>
                  <span>{index + 1}</span>
                  <strong>{entry.name || entry.raw}</strong>
                  <button type="button" className="icon-button" title="Monter" disabled={index === 0} onClick={() => moveChronologyEntry(index, -1)}>↑</button>
                  <button type="button" className="icon-button" title="Descendre" disabled={index === entries.length - 1} onClick={() => moveChronologyEntry(index, 1)}>↓</button>
                </div>
              ))}
            </div>
            <textarea
              value={sceneChronology}
              onChange={(event) => {
                setSceneChronology(event.target.value);
                setContinuationSceneId(getLastSceneIdFromChronology(event.target.value, extensionSourceProject));
              }}
              placeholder={[
                '1. [id_scene] Première scène',
                '2. [id_scene] Deuxième scène',
                '3. [id_scene] Dernière scène actuelle',
              ].join('\n')}
            />
            <button type="button" className="secondary-action full" onClick={() => {
              const chronology = makeSceneChronology(extensionSourceProject);
              setSceneChronology(chronology);
              setContinuationSceneId(getLastSceneIdFromChronology(chronology, extensionSourceProject));
            }}>
              Reconstruire la chronologie depuis le projet
            </button>

            <HelpLabel help={FIELD_HELP.continuationScene}>Scène de départ détectée</HelpLabel>
            <select value={continuationScene?.id || ''} onChange={(event) => setContinuationSceneId(event.target.value)}>
              {extensionScenes.map((scene) => (
                <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>
              ))}
            </select>
            <button type="button" className="secondary-action full" onClick={() => setContinuationSceneId(getLastSceneIdFromChronology(sceneChronology, extensionSourceProject))}>
              Utiliser la dernière ligne de la chronologie
            </button>

            <HelpLabel help={FIELD_HELP.continuationWish}>Ce que tu aimerais pour la suite</HelpLabel>
            <textarea
              value={continuationWish}
              onChange={(event) => {
                setContinuationWish(event.target.value);
                setExtendInstruction(event.target.value);
              }}
              placeholder="Vide = suite aléatoire mais cohérente. Ex: révéler une cave secrète avec une énigme mécanique."
            />
            <button type="button" className="secondary-action full" onClick={proposeIdeas}>Proposer des idées</button>
            {ideaSuggestions.length ? (
              <div className="ai-suggestion-list">
                {ideaSuggestions.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => useSuggestion(suggestion)}>{suggestion}</button>
                ))}
              </div>
            ) : null}

            <div className="ai-progressive-steps">
              {(() => {
                const cost = getTextGenerationCreditCost('extend', 'continue_story');
                return (
                  <button type="button" disabled={isGenerating || aiCredits.isLoading || !hasEnoughAiCredits('text', cost)} onClick={() => extendExistingProject('continue_story')}>
                    <strong>→ Continuer l’histoire</strong>
                    <span>suite cohérente · {formatCreditCost(cost)}</span>
                  </button>
                );
              })()}
            </div>
          </>
        ) : (
          <>
            {briefForm}
          </>
        )}

        {mode !== 'progressive' && mode !== 'extend' ? (
          <button type="button" data-tour="ai-generate-button" disabled={isGenerating || !canRunTextAi || (mode === 'improve' && !targetSceneId)} onClick={generate}>
            {isGenerating ? 'Traitement...' : `${mode === 'improve' ? 'Améliorer la scène' : 'Générer le jeu complet'} · ${formatCreditCost(currentTextGenerationCost)}`}
          </button>
        ) : null}
      </section>

      <section className="panel main" data-tour="ai-output">
        <div className="panel-head">
          <div>
            <span className="section-kicker">{isPatch ? 'Amélioration' : 'Génération'}</span>
            <h2>{isPatch ? 'Patch IA' : 'Projet IA'}</h2>
          </div>
            <div className="ai-panel-actions" data-tour="ai-draft-actions">
            <button type="button" className="secondary-action" disabled={isGenerating && !generatedProject} onClick={clearAiDraft}>
              Nouveau brouillon
            </button>
            <button type="button" className="secondary-action" disabled={!generatedProject} onClick={() => saveDraftNow({ manual: true, includeProjectCopy: true })}>
              Sauvegarder le brouillon IA
            </button>
            <button type="button" className="secondary-action" disabled={!generatedProject} onClick={exportAiJson}>
              Exporter JSON IA
            </button>
            <button type="button" data-tour="ai-apply-button" disabled={!generatedProject || validation?.ok === false} onClick={applyProject}>Appliquer au projet</button>
          </div>
        </div>

        {status ? <p className="small-note">{status}</p> : null}
        {imageStatus ? <p className="small-note">{imageStatus}</p> : null}
        {draftSaveStatus ? <p className="small-note">{draftSaveStatus}</p> : null}

        {currentDiffLines.length ? (
          <div className="combo-card ai-diff-panel" data-tour="ai-diff">
            <strong>Modifications prévues</strong>
            <div>
              {currentDiffLines.map((line) => <span key={line}>{line}</span>)}
            </div>
          </div>
        ) : null}

        {coherenceScore != null ? (
          <div className="combo-card ai-coherence-panel">
            <div>
              <strong>Cohérence IA</strong>
              <span>{getCoherenceLabel(coherenceScore)}</span>
            </div>
            <meter min="0" max="10" value={coherenceScore} />
            <b>{coherenceScore.toFixed(1)} / 10</b>
          </div>
        ) : null}

        {aiHistory.length ? (
          <div className="combo-card ai-history-panel">
            <strong>Historique IA</strong>
            {aiHistory.map((entry, index) => (
              <button type="button" key={entry.id} className="secondary-action" onClick={() => restoreHistory(entry)}>
                Version {index + 1} — {entry.label}
              </button>
            ))}
          </div>
        ) : null}

        {validation ? (
          <div data-tour="ai-validation" className={`combo-card ${validation.ok ? 'success-panel' : 'danger-panel'}`}>
            <strong>{validation.ok ? 'Validation OK' : 'Validation bloquée'}</strong>
            {validation.errors?.length ? (
              <ul className="compact-list">
                {validation.errors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}
              </ul>
            ) : null}
            {validation.warnings?.length ? (
              <p className="small-note">{validation.warnings.slice(0, 3).join(' ')}</p>
            ) : null}
          </div>
        ) : null}

        {narrativePreview ? (
          <div className="ai-narrative-preview" data-tour="ai-result-preview">
            <section className="combo-card">
              <span className="section-kicker">{isPatch ? 'Result narratif' : 'Projet proposé'}</span>
              <h3>{narrativePreview.title}</h3>
              <p className="small-note">{narrativePreview.subtitle}</p>
            </section>

            <section className="combo-card">
              <h3>Scènes</h3>
              <div className="ai-narrative-list">
                {narrativePreview.scenes.map((scene) => (
                  <article key={scene.id} className="ai-narrative-card">
                    {scene.backgroundData ? (
                      <img className="ai-generated-image-preview" src={scene.backgroundData} alt={scene.name} />
                    ) : null}
                    <strong>{scene.name}</strong>
                    {scene.introText ? <p>{scene.introText}</p> : null}
                    {isChoiceAdventureAi ? (
                      <>
                        <HelpLabel className="ai-visual-label" help={FIELD_HELP.imagePrompt}>Prompt image scène</HelpLabel>
                        <textarea
                          className="ai-image-prompt"
                          value={scene.imagePrompt || ''}
                          onChange={(event) => patchGeneratedScene(scene.id, { imagePrompt: event.target.value })}
                          placeholder="Prompt image généré par l'IA pour cette scène."
                        />
                      </>
                    ) : null}
                    <HelpLabel className="ai-visual-label" help={FIELD_HELP.visualConstraints}>Contraintes visuelles de la scène</HelpLabel>
                    <textarea
                      className="ai-visual-constraints"
                      data-tour="ai-scene-visual-constraints"
                      value={getSceneVisualConstraints(scene)}
                      onChange={(event) => updateSceneVisualConstraints(scene.id, event.target.value)}
                      placeholder={[
                        '- une porte à droite',
                        '- une table au centre',
                        '- une cachette ou un support visible, sans objet d’inventaire',
                        '- une fenêtre à gauche',
                      ].join('\n')}
                    />
                    <button
                      type="button"
                      className="secondary-action ai-image-action"
                      data-tour="ai-scene-image-button"
                      disabled={generatingImageKey === `scène:${scene.id}` || !canRunImageAi}
                      onClick={() => generateSceneImage(scene)}
                    >
                      {generatingImageKey === `scène:${scene.id}` ?
                         'Génération...'
                        : `${scene.backgroundData ? 'Régénérer uniquement cette image' : 'Générer l’image de cette scène'} · ${formatCreditCost(getAiCreditCost('image'))}`}
                    </button>
                    {scene.aiImageVariants?.length > 1 ? (
                      <button
                        type="button"
                        className="secondary-action ai-image-action"
                        onClick={() => openImageCompare({
                          type: 'scene',
                          id: scene.id,
                          title: scene.name,
                          activeImageData: scene.backgroundData,
                          variants: scene.aiImageVariants,
                        })}
                      >
                        Comparer les images ({scene.aiImageVariants.length})
                      </button>
                    ) : null}
                    {scene.backgroundData && scene.hotspots?.length ? (
                      <p className="ai-placement-note">Zones préplacées automatiquement. Validation visuelle rapide dans l’éditeur après application.</p>
                    ) : null}
                    {scene.aiVisualElements?.length ? (
                      <div className="ai-elements-list">
                        {scene.aiVisualElements.slice(0, 6).map((element) => (
                          <span key={element.id || element.label}>
                            {element.label || element.id}: {Math.round(Number(element.x) || 0)}%, {Math.round(Number(element.y) || 0)}%
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {scene.hotspots?.length ? (
                      <div className="ai-dialogue-list">
                        {scene.hotspots.slice(0, 5).map((hotspot) => (
                          <p key={hotspot.id}>
                            <span>{hotspot.name || 'Zone'}</span>
                            {hotspot.dialogue || 'Interaction sans dialogue.'}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            {!isPatch ? (
              <section className="combo-card ai-narrative-columns">
                <div>
                  <h3>Objets</h3>
                  {narrativePreview.items.length ? (
                    <div className="ai-object-grid">
                      {narrativePreview.items.map((item) => (
                        <article key={item.id} className="ai-object-card">
                          {item.imageData ? (
                            <button
                              type="button"
                              className="ai-object-preview-button"
                              onClick={() => setImagePreview({ src: item.imageData, name: item.name })}
                              title="Aperçu de l'image"
                            >
                              <img src={item.imageData} alt={item.name} />
                            </button>
                          ) : (
                            <span>{getItemFallbackIcon(item)}</span>
                          )}
                          <input
                            className="ai-object-name-input"
                            value={isTechnicalItemName(item.name) ? '' : item.name}
                            onChange={(event) => patchGeneratedItem(item.id, { name: event.target.value })}
                            onBlur={(event) => renameGeneratedItem(item.id, event.target.value)}
                            placeholder="Nom de l’objet"
                          />
                          {isHeroAdventureAi && getHeroItemPreviewLabel(item) ? (
                            <small className="inventory-item-badge">{getHeroItemPreviewLabel(item)}</small>
                          ) : null}
                          {isChoiceAdventureAi ? (
                            <>
                              <HelpLabel className="ai-visual-label" help={FIELD_HELP.imagePrompt}>Prompt image objet</HelpLabel>
                              <textarea
                                className="ai-image-prompt"
                                value={item.imagePrompt || ''}
                                onChange={(event) => patchGeneratedItem(item.id, { imagePrompt: event.target.value })}
                                placeholder="Prompt image généré par l'IA pour cet objet."
                              />
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="secondary-action ai-image-action"
                            disabled={generatingImageKey === `item:full:${item.id}` || !canRunObjectImageAi}
                            onClick={() => generateItemImage(item)}
                          >
                            {generatingImageKey === `item:full:${item.id}` ?
                               'Génération...'
                              : `${item.imageData ? 'Régénérer l’image détaillée' : 'Générer image détaillée'} · ${formatCreditCost(getAiCreditCost('objectImage'))}`}
                          </button>
                          <button
                            type="button"
                            className="secondary-action ai-image-action"
                            disabled={generatingImageKey === `item:thumbnail:${item.id}` || !canRunObjectThumbnailAi}
                            onClick={() => generateItemImage(item, 'thumbnail')}
                          >
                            {generatingImageKey === `item:thumbnail:${item.id}` ?
                               'Génération...'
                              : `${item.imageData ? (isChoiceAdventureAi ? 'Régénérer miniature' : 'Régénérer miniature économique') : (isChoiceAdventureAi ? 'Générer miniature' : 'Générer miniature économique')} · ${formatCreditCost(getAiCreditCost('objectThumbnail'))}`}
                          </button>
                          {item.aiImageVariants?.length > 1 ? (
                            <button
                              type="button"
                              className="secondary-action ai-image-action"
                              onClick={() => openImageCompare({
                                type: 'item',
                                id: item.id,
                                title: item.name,
                                activeImageData: item.imageData,
                                variants: item.aiImageVariants,
                              })}
                            >
                              Comparer les images ({item.aiImageVariants.length})
                            </button>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : <p>Aucun objet.</p>}
                </div>
                <div>
                  <h3>Énigmes</h3>
                  <p>{narrativePreview.enigmas.map((enigma) => enigma.name).join(', ') || 'Aucune énigme.'}</p>
                </div>
                <div>
                  <h3>Cinématiques</h3>
                  {narrativePreview.cinematics.length ? (
                    <div className="ai-cinematic-list">
                      {narrativePreview.cinematics.map((cinematic) => (
                        <article key={cinematic.id} className="ai-cinematic-card">
                          <strong>{cinematic.name}</strong>
                          <div className="ai-cinematic-slide-list">
                            {(cinematic.slides?.length ? cinematic.slides : [{ id: `${cinematic.id}-slide-1`, narration: 'Cinématique sans narration.' }]).map((slide, index) => {
                              const imageKey = `cinematic:${cinematic.id}:${slide.id}`;
                              return (
                                <div key={slide.id || index} className="ai-cinematic-slide-card">
                                  {slide.imageData ? (
                                    <button
                                      type="button"
                                      className="ai-cinematic-preview-button"
                                      onClick={() => setImagePreview({ src: slide.imageData, name: `${cinematic.name} - image ${index + 1}` })}
                                      title="Aperçu de l'image"
                                    >
                                      <img src={slide.imageData} alt={`${cinematic.name} - image ${index + 1}`} />
                                    </button>
                                  ) : (
                                    <span>Image {index + 1}</span>
                                  )}
                                  <p>{slide.narration || `Prompt cinématique ${index + 1}`}</p>
                                  {isChoiceAdventureAi ? (
                                    <>
                                      <HelpLabel className="ai-visual-label" help={FIELD_HELP.imagePrompt}>Prompt image cinématique</HelpLabel>
                                      <textarea
                                        className="ai-image-prompt"
                                        value={slide.imagePrompt || ''}
                                        onChange={(event) => patchGeneratedCinematicSlide(cinematic.id, slide.id, { imagePrompt: event.target.value })}
                                        placeholder="Prompt image généré par l'IA pour cette image de cinématique."
                                      />
                                    </>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="secondary-action ai-image-action"
                                    disabled={!slide || generatingImageKey === imageKey || !canRunImageAi}
                                    onClick={() => generateCinematicImage(cinematic, slide)}
                                  >
                                    {generatingImageKey === imageKey ?
                                       'Génération...'
                                      : `${slide.imageData ? 'Régénérer cette image' : 'Générer cette image'} · ${formatCreditCost(getAiCreditCost('image'))}`}
                                  </button>
                                  {slide.aiImageVariants?.length > 1 ? (
                                    <button
                                      type="button"
                                      className="secondary-action ai-image-action"
                                      onClick={() => openImageCompare({
                                        type: 'cinematicSlide',
                                        id: cinematic.id,
                                        slideId: slide.id,
                                        title: `${cinematic.name} - image ${index + 1}`,
                                        activeImageData: slide.imageData,
                                        variants: slide.aiImageVariants,
                                      })}
                                    >
                                      Comparer les images ({slide.aiImageVariants.length})
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <p>Aucune cinématique.</p>}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="ai-narrative-preview">
            <div className="empty-state-inline">Aucun result narratif pour le moment.</div>
            <section className="combo-card ai-image-empty-panel" data-tour="ai-images-info">
              <span className="section-kicker">Images à la demande</span>
              <h3>Scènes et objets</h3>
              <p className="small-note">
                Génère d’abord le récit ou améliore une scène. Les boutons d’image apparaîtront ensuite sur chaque scène et chaque objet.
              </p>
              <div className="ai-disabled-actions">
                <button type="button" className="secondary-action" disabled>Générer l’image de cette scène</button>
                <button type="button" className="secondary-action" disabled>Générer l’image de cet objet</button>
                <button type="button" className="secondary-action" disabled>Régénérer uniquement cette image</button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
