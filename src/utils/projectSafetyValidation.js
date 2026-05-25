const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export const PROJECT_SAFETY_LIMITS = {
  aiMaxJsonBytes: 2 * 1024 * 1024,
  projectMaxJsonBytes: 30 * 1024 * 1024,
  aiMaxDepth: 16,
  projectMaxDepth: 24,
  aiMaxNodes: 12000,
  projectMaxNodes: 80000,
  aiMaxStringLength: 12000,
  projectMaxStringLength: 80000,
  maxPromptLength: 3500,
  maxTextLength: 6000,
  maxIdLength: 96,
  maxMediaFieldLength: 12 * 1024 * 1024,
  maxTotalMediaLength: 24 * 1024 * 1024,
};

const countUtf8Bytes = (value) => {
  const text = String(value || '');
  return textEncoder ? textEncoder.encode(text).length : text.length * 2;
};

const stringifyForSize = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const makeSet = (items) => new Set(items);

const PROJECT_KEYS = makeSet([
  'id', 'title', 'description', 'summary', 'creationMode', 'start', 'acts', 'scenes', 'items',
  'combinations', 'enigmas', 'cinematics', 'storyVariables', 'routeMap', 'heroAdventure',
  'adventureChoices', 'anime2dDraft', 'assets', 'aiDraft', 'tutorialExampleAudio',
  'tutorialExampleImages', 'authorProfile', 'thumbnail', 'thumbnailUrl', 'published',
  'publication', 'publicStatus', 'visibility', 'slug', 'userId', 'createdAt', 'updatedAt',
  'storagePath', 'templateId', 'tags', 'version', 'mode', 'metadata', 'exportedAt',
  'imagePromptRules', 'characterModels3d', 'decorModels3d',
]);

const START_KEYS = makeSet(['type', 'targetSceneId', 'targetCinematicId']);
const ACT_KEYS = makeSet(['id', 'name', 'description', 'summary', 'aiGenerated', 'aiActionLabel']);

const SHARED_AI_KEYS = [
  'aiGenerated', 'aiActionLabel', 'imagePrompt', 'instructions', 'logicNotes', 'authorNote',
  'placementStatus',
];

const MEDIA_ID_KEYS = [
  'imageId', 'backgroundId', 'musicId', 'ambientSoundId', 'objectImageId', 'secondObjectImageId',
  'popupImageId', 'popupBackgroundId', 'soundId', 'successSoundId', 'failureSoundId',
  'responseImageId', 'responseSoundId', 'npcPortraitId', 'ambienceSoundId', 'audioId', 'videoId',
];

const ACTION_KEYS = [
  'actionType', 'dialogue', 'requiredItemId', 'consumeRequiredItemOnUse', 'rewardItemId',
  'targetSceneId', 'targetCinematicId', 'enigmaId', 'requiredHotspotId', 'lockedMessage',
  'conditionType', 'conditionItemId', 'conditionSceneId', 'conditionHotspotId',
  'conditionEnigmaId', 'conditionCinematicId', 'conditionCombinationId', 'conditionReplyId',
  'conditionVariableKey', 'conditionVariableOperator', 'conditionVariableValue',
  'advancedConditionMode', 'advancedConditions', 'storyVariableKey', 'storyVariableOperation',
  'storyVariableValue', 'effects', 'endingType', 'endingTitle', 'endingSummary',
  'heroMalusHealthLoss', 'heroMalusManaLoss', 'heroMalusMessage',
  'skillCheckSkillId', 'skillCheckDifficulty', 'skillCheckManaCost', 'skillCheckSuccessDialogue',
  'skillCheckSuccessNextNodeId', 'skillCheckSuccessTargetSceneId', 'skillCheckFailureDialogue',
  'skillCheckFailureNextNodeId', 'skillCheckFailureTargetSceneId',
  'skillCheckFailureHealthLoss', 'skillCheckSuccessRewardItemId', 'combatEnemyName',
  'combatEnemyMaxHealth', 'combatHeroAttackType', 'combatSkillId', 'combatAttackDifficulty',
  'combatHeroDieDamagePercent', 'combatDamage', 'combatEnemyInitiative', 'combatEnemyStrength',
  'combatEnemyDamage', 'combatEnemyDieDamagePercent', 'combatEnemyCunning', 'combatEnemyChaos',
  'combatEnemyMaxMana', 'combatEnemyArmor', 'combatEnemyDodgeChance',
  'combatEnemyPowerName', 'combatEnemyPowerType', 'combatEnemyPowerManaCost',
  'combatEnemyPowerDamage', 'combatEnemyPowerUsageChance', 'combatEnemyAiMode', 'combatEnemyCriticalChance',
  'combatEnemyCriticalMultiplier', 'combatEnemyResistanceWater', 'combatEnemyResistanceEarth',
  'combatEnemyResistanceFire', 'combatEnemyResistanceLightning', 'combatManaCost', 'combatStartDialogue',
  'combatEndDialogue', 'combatVictoryDialogue', 'combatDefeatDialogue', 'combatVictoryTargetSceneId',
  'combatDefeatTargetSceneId', 'combatRewardItemId',
  'combatTurnMode', 'combatShowDice', 'combatEnemyAutoTurn', 'combatBackgroundImageData', 'combatBackgroundImageName',
  'combatHeroMediaType', 'combatHeroImageData', 'combatHeroImageName', 'combatHeroAnime2dSpec',
  'combatHeroAnime2dName', 'combatEnemyMediaType', 'combatEnemyImageData', 'combatEnemyImageName',
  'combatEnemyAnime2dSpec', 'combatEnemyAnime2dName',
  'blockActionType', 'targetBlockId', 'targetBlockText',
];

const LOGIC_RULE_KEYS = makeSet([
  'id', 'name', 'conditionType', 'itemId', 'conditionItemId', 'conditionSceneId',
  'sceneId', 'hotspotId', 'conditionHotspotId', 'conditionEnigmaId', 'conditionReplyId',
  'replyId', 'conditionVariableKey', 'conditionVariableOperator', 'conditionVariableValue',
  'variableKey', 'operator', 'value', 'advancedConditionMode', 'advancedConditions',
  'cinematicId', 'combinationId', 'heroHealthThreshold', 'heroManaThreshold', 'heroSkillId',
  'actionType', 'dialogue', 'failureDialogue', 'successSoundData', 'successSoundName',
  'failureSoundData', 'failureSoundName', 'consumeRequiredItemOnUse', 'disableAfterUse',
  'rewardItemId', 'targetSceneId', 'targetCinematicId', 'enigmaId', 'blockActionType',
  'targetBlockId', 'targetBlockText', ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const HOTSPOT_KEYS = makeSet([
  'id', 'name', 'x', 'y', 'width', 'height', 'conversation', 'logicRules',
  'objectImageData', 'objectImageName', 'hasSecondAction', 'secondActionType',
  'secondDialogue', 'secondRequiredItemId', 'secondConsumeRequiredItemOnUse',
  'secondRewardItemId', 'secondTargetSceneId', 'secondTargetCinematicId', 'secondEnigmaId',
  'secondObjectImageData', 'secondObjectImageName', 'shapeType', 'shapeCorners', 'shapePoints',
  'shapePointCount', 'zIndex', 'tutorialCreated', ...ACTION_KEYS, ...MEDIA_ID_KEYS,
  ...SHARED_AI_KEYS,
]);

const SCENE_OBJECT_KEYS = makeSet([
  'id', 'name', 'blockType', 'imageData', 'imageName', 'popupImage', 'popupImageData',
  'popupImageName', 'objectImageData', 'objectImageName', 'soundData', 'soundName', 'x', 'y',
  'width', 'height', 'isInvisible', 'isHidden', 'isLocked', 'isClickable', 'clickMode',
  'interactionMode', 'linkedItemId', 'removeAfterUse', 'blockLabel', 'blockText',
  'buttonLabel', 'placeholder', 'expectedAnswer', 'successDialogue', 'failureDialogue',
  'fontSize', 'anime2dSpec', 'anime2dName', 'logicRules', 'zIndex', 'shapeType',
  'shapeCorners', 'shapePoints', 'shapePointCount', 'tutorialCreated', ...ACTION_KEYS,
  ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const SCENE_KEYS = makeSet([
  'id', 'name', 'actId', 'parentSceneId', 'backgroundId', 'backgroundData', 'backgroundName',
  'backgroundWidth', 'backgroundHeight', 'backgroundAspectRatio', 'visualEffect',
  'visualEffectIntensity', 'sceneTransition', 'sceneTransitionDuration', 'timerEnabled',
  'timerSeconds', 'timerEndAction', 'timerTargetSceneId', 'timerTargetCinematicId',
  'timerLifeLoss', 'timerEndMessage', 'visualEffectZones', 'musicId', 'musicData',
  'musicName', 'musicLoop', 'ambientSoundId', 'ambientSoundData', 'ambientSoundName',
  'ambientSoundLoop', 'introText', 'hotspots', 'sceneObjects', 'aiVisualElements',
  'visualConstraints', ...SHARED_AI_KEYS,
]);

const ITEM_KEYS = makeSet([
  'id', 'name', 'icon', 'imageData', 'imageName', 'imagePrompt', 'description',
  'heroItemType', 'heroItemAmount', 'heroItemConsumeOnUse', 'heroItemBonusTarget',
  'heroItemSkillId', 'heroItemBonus', ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const CHARACTER_3D_MODEL_KEYS = makeSet([
  'id', 'name', 'role', 'shape', 'modelUrl', 'modelData', 'modelName', 'modelResources', 'inventory',
  'characterModelScale', 'characterModelScaleX', 'characterModelScaleY', 'characterModelScaleZ', 'characterModelScaleProportional',
  'materialBrightness', 'previewLightIntensity', 'previewLightOrientation', 'characterRigPoints',
  ...SHARED_AI_KEYS,
]);

const CHARACTER_RIG_POINT_KEYS = makeSet([
  'id', 'label', 'shortLabel', 'socket', 'group', 'hand', 'finger', 'joint', 'connectTo', 'hideLabel', 'size', 'enabled', 'x', 'y', 'z',
]);

const EQUIPMENT_GRIP_KEYS = [
  'weaponModelRotationX', 'weaponModelRotationY', 'weaponModelRotationZ',
  'weaponGripHand', 'weaponGripReferenceScale',
  'weaponGripRightEnabled', 'weaponGripRightX', 'weaponGripRightY', 'weaponGripRightZ',
  'weaponGripRightRotationX', 'weaponGripRightRotationY', 'weaponGripRightRotationZ',
  'weaponGripLeftEnabled', 'weaponGripLeftX', 'weaponGripLeftY', 'weaponGripLeftZ',
  'weaponGripLeftRotationX', 'weaponGripLeftRotationY', 'weaponGripLeftRotationZ',
  'shieldGripArm', 'shieldGripReferenceScale',
  'shieldGripHandEnabled', 'shieldGripHandX', 'shieldGripHandY', 'shieldGripHandZ',
  'shieldGripElbowEnabled', 'shieldGripElbowX', 'shieldGripElbowY', 'shieldGripElbowZ',
  'armorGripReferenceScale',
  'armorGripLeftShoulderEnabled', 'armorGripLeftShoulderX', 'armorGripLeftShoulderY', 'armorGripLeftShoulderZ',
  'armorGripRightShoulderEnabled', 'armorGripRightShoulderX', 'armorGripRightShoulderY', 'armorGripRightShoulderZ',
  'armorGripLeftElbowEnabled', 'armorGripLeftElbowX', 'armorGripLeftElbowY', 'armorGripLeftElbowZ',
  'armorGripRightElbowEnabled', 'armorGripRightElbowX', 'armorGripRightElbowY', 'armorGripRightElbowZ',
  'armorGripLowerBellyEnabled', 'armorGripLowerBellyX', 'armorGripLowerBellyY', 'armorGripLowerBellyZ',
  'armorCanvasCutEnabled',
  'armorSegmentAssignments',
  'armorCutContours',
  'armorCutPaintStrokes',
];

const DECOR_3D_MODEL_KEYS = makeSet([
  'id', 'name', 'kind', 'imageData', 'imageName', 'baseColor', 'accentColor', 'roofColor',
  'modelUrl', 'modelData', 'modelName', 'modelResources', 'width', 'depth', 'height', 'floorZeroZ', 'scale', 'modelSizeProportional', 'elevation', 'materialBrightness', 'collision', 'repeatTexture', 'notes',
  ...EQUIPMENT_GRIP_KEYS,
  ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const COMBINATION_KEYS = makeSet([
  'id', 'itemAId', 'itemBId', 'resultItemId', 'message', 'consume', 'conditions',
  'failMessage', ...SHARED_AI_KEYS,
]);

const ADVANCED_CONDITION_KEYS = makeSet([
  'id', 'type', 'conditionType', 'itemId', 'conditionItemId', 'sceneId', 'conditionSceneId',
  'hotspotId', 'conditionHotspotId', 'enigmaId', 'conditionEnigmaId', 'replyId',
  'conditionReplyId', 'variableKey', 'conditionVariableKey', 'operator',
  'conditionVariableOperator', 'value', 'conditionVariableValue',
]);

const CONVERSATION_KEYS = makeSet(['startNodeId', 'nodes']);
const CONVERSATION_NODE_KEYS = makeSet(['id', 'speaker', 'text', 'askOnce', 'authorNote', 'replies']);
const CONVERSATION_REPLY_KEYS = makeSet([
  'id', 'label', 'hideAfterChosen', 'hideReplyIdsAfterChosen', 'branchTags', 'authorNote',
  'nextNodeId', 'responseImageData', 'responseImageName', 'responseSoundData',
  'responseSoundName', 'npcPortraitData', 'npcPortraitName', 'ambienceSoundData',
  'ambienceSoundName', 'showWhenLocked', 'lockedLabel', 'responseImagePrompt',
  'npcPortraitPrompt', 'ambienceSoundPrompt', ...ACTION_KEYS, ...MEDIA_ID_KEYS,
]);

const CONVERSATION_EFFECT_KEYS = makeSet([
  'id', 'type', 'message', 'itemId', 'variableKey', 'value', 'journalTitle', 'journalDetail',
  'nextNodeId', 'targetSceneId', 'targetCinematicId', 'enigmaId', 'endingType', 'endingTitle',
  'endingSummary',
]);

const ENIGMA_KEYS = makeSet([
  'id', 'name', 'type', 'question', 'solutionText', 'solutionColors', 'miscMode',
  'miscChoices', 'miscCorrectChoices', 'miscPairs', 'miscMin', 'miscMax', 'miscTargetItemId',
  'successMessage', 'failMessage', 'unlockType', 'targetSceneId', 'targetCinematicId',
  'imageData', 'imageName', 'imagePrompt', 'popupBackgroundData', 'popupBackgroundName',
  'popupBackgroundZoom', 'popupBackgroundX', 'popupBackgroundY', 'popupBackgroundOverlay',
  'gridRows', 'gridCols', 'clueSceneIds', 'logicNotes', ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const CINEMATIC_KEYS = makeSet([
  'id', 'name', 'cinematicType', 'slides', 'steps', 'videoData', 'videoName', 'videoPoster',
  'videoAutoplay', 'videoControls', 'onEndType', 'targetActId', 'targetSceneId',
  'rewardItemId', 'anime2dSpec', 'anime2dName', ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const CINEMATIC_SLIDE_KEYS = makeSet([
  'id', 'imageData', 'imageName', 'imagePrompt', 'narration', 'audioData', 'audioName',
  ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const CINEMATIC_STEP_KEYS = makeSet([
  'id', 'type', 'content', 'duration', 'imageData', 'imageName', 'audioData', 'audioName',
  'speaker', 'text', 'caption', 'transition', 'targetSceneId', 'targetCinematicId',
  ...MEDIA_ID_KEYS, ...SHARED_AI_KEYS,
]);

const STORY_VARIABLE_KEYS = makeSet([
  'id', 'key', 'type', 'defaultValue', 'description', 'journalLabel', 'journalVisible',
  'name',
]);

const ROUTE_MAP_KEYS = makeSet(['rows', 'cols', 'notes', 'cells', 'rooms', 'connections', 'canvases', 'actMaps']);
const ROUTE_CELL_KEYS = makeSet(['id', 'x', 'y', 'type', 'label', 'sceneId']);
const ROUTE_ROOM_KEYS = makeSet(['id', 'name', 'sceneId', 'canvasId', 'x', 'y', 'type']);
const ROUTE_CONNECTION_KEYS = makeSet(['id', 'fromRoomId', 'toRoomId', 'label', 'condition', 'locked', 'allowOneWay']);
const ROUTE_CANVAS_KEYS = makeSet(['id', 'name']);

const ASSET_KEYS = makeSet([
  'id', 'type', 'url', 'src', 'data', 'name', 'width', 'height', 'size', 'bytes', 'usedIn',
  'meta',
]);

const VISUAL_ZONE_KEYS = makeSet([
  'id', 'name', 'effect', 'intensity', 'x', 'y', 'width', 'height', 'layer', 'isHidden',
  'zIndex',
]);

const AI_VISUAL_ELEMENT_KEYS = makeSet([
  'id', 'label', 'name', 'x', 'y', 'width', 'height', 'confidence', 'notes',
]);

const ARRAY_LIMITS = {
  acts: [12, 40],
  scenes: [80, 200],
  items: [300, 800],
  combinations: [300, 800],
  enigmas: [200, 600],
  cinematics: [120, 300],
  storyVariables: [120, 400],
  characterModels3d: [80, 240],
  decorModels3d: [120, 400],
  assets: [0, 1200],
  'scenes.[].hotspots': [40, 120],
  'scenes.[].sceneObjects': [60, 200],
  'scenes.[].visualEffectZones': [40, 120],
  'scenes.[].aiVisualElements': [80, 200],
  'scenes.[].hotspots.[].logicRules': [40, 120],
  'scenes.[].sceneObjects.[].logicRules': [40, 120],
  'scenes.[].hotspots.[].conversation.nodes': [80, 180],
  'scenes.[].hotspots.[].conversation.nodes.[].replies': [20, 60],
  'cinematics.[].slides': [80, 180],
  'cinematics.[].steps': [150, 400],
  'routeMap.cells': [1200, 2000],
  'routeMap.rooms': [300, 800],
  'routeMap.connections': [600, 1600],
  'routeMap.canvases': [30, 100],
};

const DANGEROUS_OBJECT_KEYS = makeSet(['__proto__', 'prototype', 'constructor']);
const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,95}$/;
const URL_LIKE_KEY_PATTERN = /(?:url|uri|href|src|poster|thumbnail|download|data)$/i;
const MEDIA_KEY_PATTERN = /(?:backgroundData|imageData|objectImageData|popupImage|popupImageData|popupBackgroundData|musicData|ambientSoundData|soundData|audioData|videoData|videoPoster|responseImageData|responseSoundData|npcPortraitData|ambienceSoundData|url|src|thumbnail|thumbnailUrl|downloadUrl)$/i;
const PROMPT_KEY_PATTERN = /prompt$/i;
const TEXT_KEY_PATTERN = /(?:text|dialogue|message|summary|description|question|narration|instructions|notes|label|name|title)$/i;
const ALLOWED_DATA_MIME_PATTERN = /^(image\/(?:png|jpeg|jpg|webp|gif|svg\+xml)|audio\/(?:mpeg|mp3|wav|ogg|webm|mp4)|video\/(?:mp4|webm|ogg)|application\/json)$/i;
const ALLOWED_MODEL_DATA_MIME_PATTERN = /^(model\/(?:gltf-binary|gltf\+json|obj|vnd\.fbx)|application\/(?:octet-stream|vnd\.autodesk\.fbx))$/i;
const ALLOWED_MODEL_RESOURCE_DATA_MIME_PATTERN = /^(image\/(?:png|jpeg|jpg|webp|gif|bmp)|text\/plain)$/i;
const MODEL_DATA_URL_KEYS = makeSet(['modelData', 'modelUrl', 'characterModelUrl', 'decorModelUrl']);
const SVG_RISK_PATTERN = /<\s*script\b|javascript\s*:|on[a-z]+\s*=|<\s*foreignObject\b/i;

const ACTIVE_CONTENT_PATTERNS = [
  { label: 'balise script', pattern: /<\s*script\b/i },
  { label: 'iframe', pattern: /<\s*iframe\b/i },
  { label: 'javascript:', pattern: /\bjavascript\s*:/i },
  { label: 'vbscript:', pattern: /\bvbscript\s*:/i },
  { label: 'gestionnaire HTML inline', pattern: /(?:^|\s)on[a-z]+\s*=/i },
  { label: 'expression CSS', pattern: /\bexpression\s*\(/i },
];

const SECRET_PATTERNS = [
  { label: 'cle API OpenAI/Stripe', pattern: /\b(?:sk|rk|pk)_(?:live|test)_[a-zA-Z0-9]{20,}\b|\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b/ },
  { label: 'cle de service', pattern: /\b(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE|PRIVATE_KEY)\b/i },
  { label: 'cle privee', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { label: 'jeton Bearer', pattern: /\bBearer\s+[a-zA-Z0-9._~+/-]{20,}=*/i },
  { label: 'JWT', pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/ },
  { label: 'cle AWS', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

const toPathLabel = (path) => (path.length ? path.join('.') : 'project');
const isAiMode = (options) => options.mode === 'ai' || options.strict === true;

const signatureFromPath = (path) => path
  .map((part) => (typeof part === 'number' ? '[]' : part))
  .join('.');

const routeActMapSignature = (path) => {
  if (path[0] !== 'routeMap' || path[1] !== 'actMaps') return '';
  const rest = path.slice(3);
  if (!rest.length) return 'routeMap';
  return signatureFromPath(['routeMap', ...rest]);
};

const getAllowedKeys = (path) => {
  const signature = routeActMapSignature(path) || signatureFromPath(path);
  if (!signature) return PROJECT_KEYS;
  if (signature === 'start') return START_KEYS;
  if (signature === 'acts.[]') return ACT_KEYS;
  if (signature === 'items.[]') return ITEM_KEYS;
  if (signature === 'characterModels3d.[]') return CHARACTER_3D_MODEL_KEYS;
  if (signature === 'characterModels3d.[].characterRigPoints.[]') return CHARACTER_RIG_POINT_KEYS;
  if (signature === 'decorModels3d.[]') return DECOR_3D_MODEL_KEYS;
  if (signature === 'decorModels3d.[].armorSegmentAssignments.[]') return makeSet(['path', 'name', 'segment']);
  if (signature === 'characterModels3d.[].inventory.[].armorSegmentAssignments.[]') return makeSet(['path', 'name', 'segment']);
  if (signature === 'combinations.[]') return COMBINATION_KEYS;
  if (signature === 'combinations.[].conditions.[]') return ADVANCED_CONDITION_KEYS;
  if (signature === 'scenes.[]') return SCENE_KEYS;
  if (signature === 'scenes.[].visualEffectZones.[]') return VISUAL_ZONE_KEYS;
  if (signature === 'scenes.[].aiVisualElements.[]') return AI_VISUAL_ELEMENT_KEYS;
  if (signature === 'scenes.[].hotspots.[]') return HOTSPOT_KEYS;
  if (signature === 'scenes.[].hotspots.[].logicRules.[]') return LOGIC_RULE_KEYS;
  if (signature === 'scenes.[].hotspots.[].logicRules.[].advancedConditions.[]') return ADVANCED_CONDITION_KEYS;
  if (signature === 'scenes.[].hotspots.[].conversation') return CONVERSATION_KEYS;
  if (signature === 'scenes.[].hotspots.[].conversation.nodes.[]') return CONVERSATION_NODE_KEYS;
  if (signature === 'scenes.[].hotspots.[].conversation.nodes.[].replies.[]') return CONVERSATION_REPLY_KEYS;
  if (signature === 'scenes.[].hotspots.[].conversation.nodes.[].replies.[].advancedConditions.[]') return ADVANCED_CONDITION_KEYS;
  if (signature === 'scenes.[].hotspots.[].conversation.nodes.[].replies.[].effects.[]') return CONVERSATION_EFFECT_KEYS;
  if (signature === 'scenes.[].sceneObjects.[]') return SCENE_OBJECT_KEYS;
  if (signature === 'scenes.[].sceneObjects.[].logicRules.[]') return LOGIC_RULE_KEYS;
  if (signature === 'scenes.[].sceneObjects.[].logicRules.[].advancedConditions.[]') return ADVANCED_CONDITION_KEYS;
  if (signature === 'enigmas.[]') return ENIGMA_KEYS;
  if (signature === 'enigmas.[].miscPairs.[]') return makeSet(['left', 'right']);
  if (signature === 'cinematics.[]') return CINEMATIC_KEYS;
  if (signature === 'cinematics.[].slides.[]') return CINEMATIC_SLIDE_KEYS;
  if (signature === 'cinematics.[].steps.[]') return CINEMATIC_STEP_KEYS;
  if (signature === 'storyVariables.[]') return STORY_VARIABLE_KEYS;
  if (signature === 'routeMap') return ROUTE_MAP_KEYS;
  if (signature === 'routeMap.cells.[]') return ROUTE_CELL_KEYS;
  if (signature === 'routeMap.rooms.[]') return ROUTE_ROOM_KEYS;
  if (signature === 'routeMap.connections.[]') return ROUTE_CONNECTION_KEYS;
  if (signature === 'routeMap.canvases.[]') return ROUTE_CANVAS_KEYS;
  if (signature === 'assets.[]') return ASSET_KEYS;
  return null;
};

const isGenericObjectPath = (path) => {
  const signature = signatureFromPath(path);
  return signature.includes('heroAdventure')
    || signature.includes('adventureChoices')
    || signature.includes('anime2dDraft')
    || signature.includes('anime2dSpec')
    || signature.endsWith('.meta')
    || signature.includes('.meta.')
    || signature.includes('aiDraft')
    || signature.includes('metadata');
};

const getArrayLimit = (path, options) => {
  const signature = routeActMapSignature(path) || signatureFromPath(path);
  const limit = ARRAY_LIMITS[signature];
  if (!limit) return isAiMode(options) ? 500 : 2000;
  return isAiMode(options) ? limit[0] : limit[1];
};

const addLimited = (list, message, max = 80) => {
  if (list.length < max) list.push(message);
};

const validateIdString = (key, value, path, options, errors, warnings) => {
  if (key !== 'id' || !value) return;
  const text = String(value);
  if (text.length > PROJECT_SAFETY_LIMITS.maxIdLength) {
    addLimited(errors, `${toPathLabel(path)}: id trop long.`);
    return;
  }
  if (!SAFE_ID_PATTERN.test(text)) {
    const target = isAiMode(options) ? errors : warnings;
    addLimited(target, `${toPathLabel(path)}: id avec caractères non autorisés (${text}).`);
  }
};

const validateStringContent = (key, value, path, options, errors, warnings) => {
  const text = String(value);
  const label = toPathLabel(path);
  const maxStringLength = isAiMode(options)
    ? PROJECT_SAFETY_LIMITS.aiMaxStringLength
    : PROJECT_SAFETY_LIMITS.projectMaxStringLength;

  if (text.length > maxStringLength && !MEDIA_KEY_PATTERN.test(key)) {
    addLimited(errors, `${label}: texte trop long (${text.length} caracteres).`);
  }
  if (PROMPT_KEY_PATTERN.test(key) && text.length > PROJECT_SAFETY_LIMITS.maxPromptLength) {
    addLimited(errors, `${label}: prompt trop long (${text.length} caracteres).`);
  }
  if (TEXT_KEY_PATTERN.test(key) && !PROMPT_KEY_PATTERN.test(key) && text.length > PROJECT_SAFETY_LIMITS.maxTextLength) {
    addLimited(warnings, `${label}: texte volumineux (${text.length} caracteres).`);
  }

  ACTIVE_CONTENT_PATTERNS.forEach(({ label: riskLabel, pattern }) => {
    if (pattern.test(text)) addLimited(errors, `${toPathLabel(path)}: contenu actif interdit (${riskLabel}).`);
  });
  SECRET_PATTERNS.forEach(({ label: riskLabel, pattern }) => {
    if (pattern.test(text)) addLimited(errors, `${toPathLabel(path)}: contenu sensible detecte (${riskLabel}).`);
  });
};

const parseDataUrl = (value) => String(value).match(/^data:([^;,]+)(?:;[^,]*)?,/i);

const isModelResourceDataPath = (key, path) => (
  key === 'data'
  && path[path.length - 1] === 'data'
  && path.includes('modelResources')
);

const validateUrlValue = (key, value, path, options, errors, warnings, mediaStats) => {
  const text = String(value || '').trim();
  if (!text || !URL_LIKE_KEY_PATTERN.test(key)) return;

  const label = toPathLabel(path);
  const dataMatch = parseDataUrl(text);
  if (dataMatch) {
    const mimeType = dataMatch[1].toLowerCase();
    const isAllowedModelData = MODEL_DATA_URL_KEYS.has(key) && ALLOWED_MODEL_DATA_MIME_PATTERN.test(mimeType);
    const isAllowedModelResourceData = isModelResourceDataPath(key, path) && ALLOWED_MODEL_RESOURCE_DATA_MIME_PATTERN.test(mimeType);
    if (!ALLOWED_DATA_MIME_PATTERN.test(mimeType) && !isAllowedModelData && !isAllowedModelResourceData) {
      addLimited(errors, `${label}: type data URL interdit (${mimeType}).`);
    }
    if (mimeType === 'image/svg+xml') {
      let decoded = '';
      try {
        decoded = text.includes(',')
          ? decodeURIComponent(text.slice(text.indexOf(',') + 1).slice(0, 20000))
          : '';
      } catch {
        decoded = '';
      }
      if (SVG_RISK_PATTERN.test(decoded)) addLimited(errors, `${label}: SVG média actif interdit.`);
    }
    mediaStats.total += text.length;
    if (isAiMode(options)) {
      addLimited(errors, `${label}: média embarqué interdit dans une réponse IA.`);
    } else if (text.length > PROJECT_SAFETY_LIMITS.maxMediaFieldLength) {
      addLimited(errors, `${label}: média trop volumineux (${Math.round(text.length / 1024 / 1024)} Mo).`);
    }
    return;
  }

  if (MEDIA_KEY_PATTERN.test(key) && isAiMode(options)) {
    addLimited(errors, `${label}: champ média non vide interdit dans une réponse IA.`);
    return;
  }

  if (/^(?:javascript|vbscript|file|ftp|chrome|resource):/i.test(text)) {
    addLimited(errors, `${label}: protocole URL interdit.`);
    return;
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const isLocalHttp = url.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
      if (url.protocol === 'http:' && !isLocalHttp) {
        addLimited(errors, `${label}: URL http non securisee.`);
      }
    } catch {
      addLimited(errors, `${label}: URL invalide.`);
    }
    return;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    addLimited(errors, `${label}: protocole URL non autorise.`);
  } else if (MEDIA_KEY_PATTERN.test(key) && /\/\//.test(text)) {
    addLimited(warnings, `${label}: URL média ambiguë.`);
  }
};

const validatePrimitive = (key, value, path, options, errors, warnings, mediaStats) => {
  if (typeof value === 'string') {
    validateStringContent(key, value, path, options, errors, warnings);
    validateIdString(key, value, path, options, errors, warnings);
    validateUrlValue(key, value, path, options, errors, warnings, mediaStats);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    addLimited(errors, `${toPathLabel(path)}: nombre invalide.`);
  }
};

const walkProjectValue = (value, path, state, options) => {
  state.nodes += 1;
  const maxNodes = isAiMode(options) ? PROJECT_SAFETY_LIMITS.aiMaxNodes : PROJECT_SAFETY_LIMITS.projectMaxNodes;
  if (state.nodes > maxNodes) {
    addLimited(state.errors, `Projet trop complexe (${state.nodes} noeuds).`);
    return;
  }

  const maxDepth = isAiMode(options) ? PROJECT_SAFETY_LIMITS.aiMaxDepth : PROJECT_SAFETY_LIMITS.projectMaxDepth;
  if (path.length > maxDepth) {
    addLimited(state.errors, `${toPathLabel(path)}: imbrication trop profonde.`);
    return;
  }

  if (Array.isArray(value)) {
    const limit = getArrayLimit(path, options);
    if (value.length > limit) {
      addLimited(state.errors, `${toPathLabel(path)}: trop d'entrees (${value.length}/${limit}).`);
    }
    value.forEach((entry, index) => walkProjectValue(entry, [...path, index], state, options));
    return;
  }

  if (!value || typeof value !== 'object') {
    const key = path[path.length - 1] || '';
    validatePrimitive(String(key), value, path, options, state.errors, state.warnings, state.mediaStats);
    return;
  }

  if (state.seen.has(value)) return;
  state.seen.add(value);

  const allowedKeys = isGenericObjectPath(path) ? null : getAllowedKeys(path);
  Object.entries(value).forEach(([key, entryValue]) => {
    const entryPath = [...path, key];
    if (DANGEROUS_OBJECT_KEYS.has(key)) {
      addLimited(state.errors, `${toPathLabel(entryPath)}: cle d'objet interdite.`);
      return;
    }
    if (allowedKeys && !allowedKeys.has(key)) {
      const target = isAiMode(options) ? state.errors : state.warnings;
      addLimited(target, `${toPathLabel(entryPath)}: champ inattendu.`);
    }
    validatePrimitive(key, entryValue, entryPath, options, state.errors, state.warnings, state.mediaStats);
    if (entryValue && typeof entryValue === 'object') {
      walkProjectValue(entryValue, entryPath, state, options);
    }
  });
};

const validateRootShape = (project, options, errors) => {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    errors.push('Le projet doit etre un objet JSON.');
    return;
  }
  ['acts', 'scenes', 'items', 'combinations', 'enigmas', 'cinematics'].forEach((key) => {
    if (project[key] !== undefined && !Array.isArray(project[key])) {
      addLimited(errors, `project.${key}: tableau attendu.`);
    }
  });
  if (isAiMode(options) && (!Array.isArray(project.scenes) || project.scenes.length < 1)) {
    addLimited(errors, 'Le projet IA doit contenir au moins une scene.');
  }
};

export function validateProjectSafety(project, options = {}) {
  const errors = [];
  const warnings = [];
  validateRootShape(project, options, errors);

  const serialized = stringifyForSize(project);
  if (serialized) {
    const bytes = countUtf8Bytes(serialized);
    const maxBytes = isAiMode(options)
      ? PROJECT_SAFETY_LIMITS.aiMaxJsonBytes
      : PROJECT_SAFETY_LIMITS.projectMaxJsonBytes;
    if (bytes > maxBytes) {
      errors.push(`Projet trop lourd (${Math.round(bytes / 1024)} Ko, limite ${Math.round(maxBytes / 1024)} Ko).`);
    }
  } else if (project && typeof project === 'object') {
    errors.push('Le projet ne peut pas etre serialise en JSON.');
  }

  if (project && typeof project === 'object') {
    const state = {
      errors,
      warnings,
      nodes: 0,
      seen: new WeakSet(),
      mediaStats: { total: 0 },
    };
    walkProjectValue(project, [], state, options);
    if (!isAiMode(options) && state.mediaStats.total > PROJECT_SAFETY_LIMITS.maxTotalMediaLength) {
      warnings.push(`Medias embarques volumineux (${Math.round(state.mediaStats.total / 1024 / 1024)} Mo).`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export const normalizeParsedProjectKeys = (project) => {
  if (!project || typeof project !== 'object') return project;
  const legacyScenes = project['sc\u00e8nes'];
  if (!Array.isArray(project.scenes) && Array.isArray(legacyScenes)) {
    return { ...project, scenes: legacyScenes };
  }
  return project;
};

export const parseProjectJsonPayload = (outputText = '') => {
  const raw = String(outputText || '').trim();
  if (!raw) {
    const error = new Error('OpenAI a renvoye un texte vide.');
    error.statusCode = 502;
    error.code = 'AI_EMPTY_OUTPUT';
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      const error = new Error('OpenAI a renvoye un JSON introuvable.');
      error.statusCode = 502;
      error.code = 'AI_INVALID_JSON';
      throw error;
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      const error = new Error('OpenAI a renvoye un JSON invalide.');
      error.statusCode = 502;
      error.code = 'AI_INVALID_JSON';
      throw error;
    }
  }

  const project = parsed?.project || parsed?.data?.project || parsed;
  return normalizeParsedProjectKeys(project);
};

export const assertProjectSafety = (project, options = {}) => {
  const validation = validateProjectSafety(project, options);
  if (!validation.ok) {
    const error = new Error(`Projet IA refuse: ${validation.errors[0] || 'schema invalide'}`);
    error.statusCode = 502;
    error.code = 'AI_PROJECT_SCHEMA_INVALID';
    error.validation = validation;
    throw error;
  }
  return validation;
};
