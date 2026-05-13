import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateAiProject } from '../utils/aiProjectGenerator';
import { buildGlobalSceneLayout, generateAiImage, getConnectedScenes } from '../utils/aiImageGenerator';
import { getAiAuthHeaders } from '../utils/aiAuthHeaders';
import { mergeProjectPatch, validateProject } from '../utils/projectValidation';
import { downloadBlob } from '../utils/fileHelpers';
import { createIndexedDraftStorage } from '../utils/indexedDraftStorage';
import { showConfirm } from './AccessibleDialog';
import AiBriefForm from './ai/AiBriefForm.jsx';
import AiControlsPanel from './ai/AiControlsPanel.jsx';
import AiDiffPanel from './ai/AiDiffPanel.jsx';
import AiDraftPreview from './ai/AiDraftPreview.jsx';
import AiGenerationStatus from './ai/AiGenerationStatus.jsx';
import AiImageWorkbench from './ai/AiImageWorkbench.jsx';
import {
  HelpLabel,
  formatChronologyEntries,
  getCoherenceLabel,
  getCoherenceScore,
  getDiffLines,
  getDisplayItemName,
  getHeroItemPreviewLabel,
  getItemFallbackIcon,
  getLastSceneIdFromChronology,
  getNarrativeEndScene,
  isTechnicalItemName,
  makeIdeaSuggestions,
  makeProjectStorySummary,
  makeSceneChronology,
  makeSceneVisualConstraints,
  markAiChanges,
  parseChronologyEntries,
  placeHotspotsFromElements,
  stripLargeMediaFields,
} from './ai/aiTabHelpers.js';

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
const aiDraftStorage = createIndexedDraftStorage(AI_DRAFT_DB);
const readAiDraft = aiDraftStorage.read;
const writeAiDraft = aiDraftStorage.write;
const deleteAiDraft = aiDraftStorage.remove;

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
  const briefForm = (
    <AiBriefForm
      brief={brief}
      updateBrief={updateBrief}
      HelpLabel={HelpLabel}
      FIELD_HELP={FIELD_HELP}
      isChoiceAdventureAi={isChoiceAdventureAi}
      isBeginnerAi={isBeginnerAi}
      isHeroAdventureAi={isHeroAdventureAi}
      shouldGenerateCombinations={shouldGenerateCombinations}
    />
  );
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
      <AiGenerationStatus isBusy={isAiBusy} />
      <AiImageWorkbench
        imagePreview={imagePreview}
        imageCompare={imageCompare}
        onClosePreview={() => setImagePreview(null)}
        onCloseCompare={() => setImageCompare(null)}
        onOpenPreview={setImagePreview}
        onDownloadImage={downloadImage}
        onSelectImageVariant={selectImageVariant}
      />
      <AiControlsPanel
        mode={mode}
        setMode={setMode}
        isGenerating={isGenerating}
        aiCredits={aiCredits}
        currentTextGenerationCost={currentTextGenerationCost}
        refreshAiCredits={refreshAiCredits}
        isChoiceAdventureAi={isChoiceAdventureAi}
        isBeginnerAi={isBeginnerAi}
        calculateProjectGenerationCreditCost={calculateProjectGenerationCreditCost}
        formatCreditCost={formatCreditCost}
        getAiCreditCost={getAiCreditCost}
        countCreditUnits={countCreditUnits}
        brief={brief}
        calculateBriefImageCreditCost={calculateBriefImageCreditCost}
        calculateBriefTotalCreditCost={calculateBriefTotalCreditCost}
        imageStylePreset={imageStylePreset}
        setImageStylePreset={setImageStylePreset}
        imageStylePresets={IMAGE_STYLE_PRESETS}
        globalVisualStyle={globalVisualStyle}
        setGlobalVisualStyle={setGlobalVisualStyle}
        imageReadabilityLevel={imageReadabilityLevel}
        setImageReadabilityLevel={setImageReadabilityLevel}
        visualInheritance={visualInheritance}
        setVisualInheritance={setVisualInheritance}
        fieldHelp={FIELD_HELP}
        targetSceneId={targetSceneId}
        setTargetSceneId={setTargetSceneId}
        scenes={scenes}
        getSceneLabel={getSceneLabel}
        instruction={instruction}
        setInstruction={setInstruction}
        proposeIdeas={proposeIdeas}
        ideaSuggestions={ideaSuggestions}
        useSuggestion={useSuggestion}
        briefForm={briefForm}
        progressiveActStages={progressiveActStages}
        progressiveStatus={progressiveStatus}
        hasEnoughAiCredits={hasEnoughAiCredits}
        getTextGenerationCreditCost={getTextGenerationCreditCost}
        getProgressiveStageSummary={getProgressiveStageSummary}
        generateProgressiveStep={generateProgressiveStep}
        extendSource={extendSource}
        setExtendSource={setExtendSource}
        importedProject={importedProject}
        importExtensionJson={importExtensionJson}
        storySummary={storySummary}
        setStorySummary={setStorySummary}
        extensionSourceProject={extensionSourceProject}
        sceneChronology={sceneChronology}
        moveChronologyEntry={moveChronologyEntry}
        setSceneChronology={setSceneChronology}
        setContinuationSceneId={setContinuationSceneId}
        continuationScene={continuationScene}
        extensionScenes={extensionScenes}
        continuationWish={continuationWish}
        setContinuationWish={setContinuationWish}
        setExtendInstruction={setExtendInstruction}
        extendExistingProject={extendExistingProject}
        canRunTextAi={canRunTextAi}
        generate={generate}
      />

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

        <AiDiffPanel
          currentDiffLines={currentDiffLines}
          coherenceScore={coherenceScore}
          getCoherenceLabel={getCoherenceLabel}
          aiHistory={aiHistory}
          restoreHistory={restoreHistory}
          validation={validation}
        />

        <AiDraftPreview
          isEmpty={!narrativePreview}
          narrativePreview={narrativePreview}
          isPatch={isPatch}
          isChoiceAdventureAi={isChoiceAdventureAi}
          isHeroAdventureAi={isHeroAdventureAi}
          HelpLabel={HelpLabel}
          FIELD_HELP={FIELD_HELP}
          patchGeneratedScene={patchGeneratedScene}
          patchGeneratedItem={patchGeneratedItem}
          patchGeneratedCinematicSlide={patchGeneratedCinematicSlide}
          renameGeneratedItem={renameGeneratedItem}
          getSceneVisualConstraints={getSceneVisualConstraints}
          updateSceneVisualConstraints={updateSceneVisualConstraints}
          getItemFallbackIcon={getItemFallbackIcon}
          isTechnicalItemName={isTechnicalItemName}
          getHeroItemPreviewLabel={getHeroItemPreviewLabel}
          generatingImageKey={generatingImageKey}
          canRunImageAi={canRunImageAi}
          canRunObjectImageAi={canRunObjectImageAi}
          canRunObjectThumbnailAi={canRunObjectThumbnailAi}
          generateSceneImage={generateSceneImage}
          generateItemImage={generateItemImage}
          generateCinematicImage={generateCinematicImage}
          formatCreditCost={formatCreditCost}
          getAiCreditCost={getAiCreditCost}
          openImageCompare={openImageCompare}
          onOpenImagePreview={setImagePreview}
        />
      </section>
    </div>
  );
}
