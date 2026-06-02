import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Footprints,
  Gem,
  HardHat,
  Home,
  Image as ImageIcon,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Mountain,
  PanelLeftOpen,
  Plus,
  Save,
  Shield,
  Shirt,
  ShoppingBag,
  Sparkles,
  Sword,
  Trash2,
  Upload,
} from 'lucide-react';
import { makeDecor3DModel } from '../data/projectData';
import {
  DECOR_FLOOR_MATERIAL_BRIGHTNESS,
  DECOR_MATERIAL_BRIGHTNESS_MAX,
  DECOR_MATERIAL_BRIGHTNESS_MIN,
  DECOR_MODEL_DIMENSION_MAX,
  DECOR_MODEL_DIMENSION_MIN,
  FLOOR_ZERO_Z_MAX,
  FLOOR_ZERO_Z_MIN,
  getDecorModelDimensions,
  getDecorImportFileInfo,
  getDecorKindId,
  getDecorMaterialBrightness,
  getFloorTileSize,
  getFloorZeroZ,
  getModelRotationValue,
  getModelRotationX,
  getModelRotationY,
  getModelRotationZ,
  isDecorModelSizeProportional,
  isFloorTileKind,
  numberValue,
  resizeAxesProportionally,
} from '../utils/rpg3dModelImportCore.js';
import {
  THREE_MODEL_ACCEPT,
  getThreeModelFormatLabel,
  getThreeModelSource,
} from '../utils/threeModelUtils.js';
import {
  createLocalModelFileId,
  forgetRpg3DLocalBlobFile,
  persistLocalModelFile,
  rememberRpg3DLocalBlobFile,
} from '../utils/rpg3dAssetsCore.js';
import {
  CHARACTER_RIG_ARMOR_GRIP_POINTS,
} from '../utils/rpg3dCharacterRig.js';
import { lazyWithRetry } from '../utils/lazyImportRetry';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import HelpLabel from './forms/HelpLabel.jsx';

const Decor3DPreview = lazyWithRetry(() => import('./rpg3d/Decor3DPreview.jsx'));

const WORLD_KIND_OPTIONS = [
  { id: 'decor', label: 'décors', icon: Mountain, renderKind: 'decor' },
  { id: 'road', label: 'sol', icon: MapIcon, renderKind: 'road' },
  { id: 'water', label: 'eau', icon: ImageIcon, renderKind: 'water' },
  { id: 'wall', label: 'mur', icon: Box, renderKind: 'wall' },
  { id: 'house', label: 'habitations', icon: Home, renderKind: 'house' },
];
const INVENTORY_KIND_OPTIONS = [
  { id: 'inventory-weapon', label: 'armes', createLabel: 'arme', icon: Sword, renderKind: 'decor' },
  { id: 'inventory-armor', label: 'armures', createLabel: 'armure', icon: Shirt, renderKind: 'decor' },
  { id: 'inventory-helmet', label: 'casques', createLabel: 'casque', icon: HardHat, renderKind: 'decor' },
  { id: 'inventory-shield', label: 'boucliers', createLabel: 'bouclier', icon: Shield, renderKind: 'decor' },
  { id: 'inventory-leggings', label: 'jambières', createLabel: 'jambière', icon: Footprints, renderKind: 'decor' },
  { id: 'inventory-jewelry', label: 'bijoux', createLabel: 'bijou', icon: Gem, renderKind: 'decor' },
  { id: 'inventory-misc', label: 'divers', createLabel: 'objet divers', icon: Box, renderKind: 'decor' },
];
const KIND_OPTIONS = [
  ...WORLD_KIND_OPTIONS,
  { id: 'inventory', label: 'inventaire', icon: ShoppingBag, children: INVENTORY_KIND_OPTIONS },
];
const SELECTABLE_KIND_OPTIONS = [
  ...WORLD_KIND_OPTIONS,
  ...INVENTORY_KIND_OPTIONS,
];
const INVENTORY_KIND_IDS = new Set(INVENTORY_KIND_OPTIONS.map((option) => option.id));

const DECOR_FIELD_HELP = {
  name: 'Nom interne de cet objet 3D. Il sert a le retrouver dans la bibliotheque et sur la carte.',
  rotationX: 'Incline le modele vers l avant ou l arriere. Utile pour coucher une image ou corriger un modele importe.',
  rotationY: 'Tourne le modele autour de l axe vertical pour orienter sa face principale.',
  rotationZ: 'Incline le modele sur le cote pour ajuster un objet mal aligne.',
  floorTileSize: 'Largeur et profondeur de la dalle au sol. Les deux valeurs restent identiques pour garder un carre.',
  floorZeroZ: 'Hauteur de reference ou les personnages marchent sur cette dalle. Ajuste-la si le sol semble flotter ou avaler les pieds.',
  baseColor: 'Couleur principale du sol ou de l objet procedural quand aucune texture ne la remplace.',
  accentColor: 'Couleur secondaire utilisee pour les details visibles: lignes, reflets ou reperes.',
  glbImport: 'Charge ou remplace un modele 3D au format .glb, .fbx, .obj ou .zip. Pour un FBX/OBJ avec textures, importe un ZIP contenant le modele et ses images.',
  glbTexture: 'Image appliquee sur le modele 3D importe, pratique pour tester une variation de materiau.',
  modelScale: 'Regle les dimensions de cet objet quand il est place sur la carte RPG 3D. X = largeur, Y = profondeur, Z = hauteur.',
  materialBrightness: 'Regle la luminosite de cet objet sur la carte RPG 3D sans changer la lumiere globale.',
  repeatTexture: 'Repete l image sur le modele au lieu de l etirer une seule fois.',
};

const DecorHelpLabel = ({ children, help }) => (
  <HelpLabel as="span" className="builder3d-help-label" help={help}>{children}</HelpLabel>
);

const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value || '');
const colorValue = (value, fallback) => (isHexColor(value) ? value : fallback);
const getDecorKindConfig = (kind = '') => SELECTABLE_KIND_OPTIONS.find((option) => option.id === getDecorKindId(kind)) || SELECTABLE_KIND_OPTIONS[0];
const isInventoryKindId = (kind = '') => INVENTORY_KIND_IDS.has(getDecorKindId(kind));
const isInventoryWeaponKindId = (kind = '') => getDecorKindId(kind) === 'inventory-weapon';
const isInventoryArmorKindId = (kind = '') => getDecorKindId(kind) === 'inventory-armor';
const isInventoryHelmetKindId = (kind = '') => getDecorKindId(kind) === 'inventory-helmet';
const isInventoryLeggingsKindId = (kind = '') => getDecorKindId(kind) === 'inventory-leggings';
const isInventoryShieldKindId = (kind = '') => getDecorKindId(kind) === 'inventory-shield';
const WEAPON_GRIP_HANDS = [
  { id: 'right', label: 'Main droite', suffix: 'Right' },
  { id: 'left', label: 'Main gauche', suffix: 'Left' },
];
const SHIELD_GRIP_ARMS = [
  { id: 'left', label: 'Bras gauche' },
  { id: 'right', label: 'Bras droit' },
];
const SHIELD_GRIP_POINTS = [
  { id: 'hand', label: 'Poignet / main', suffix: 'Hand', defaultY: -0.35 },
  { id: 'elbow', label: 'Coude', suffix: 'Elbow', defaultY: 0.35 },
];
const ARMOR_GRIP_POINTS = CHARACTER_RIG_ARMOR_GRIP_POINTS;
const HELMET_GRIP_POINTS = CHARACTER_RIG_ARMOR_GRIP_POINTS.filter((point) => point.id === 'mouth');
const LEGGINGS_GRIP_POINT_IDS = [
  'left-groin-fold',
  'right-groin-fold',
  'left-knee',
  'right-knee',
  'left-foot',
  'right-foot',
];
const LEGGINGS_GRIP_POINTS = LEGGINGS_GRIP_POINT_IDS
  .map((id) => CHARACTER_RIG_ARMOR_GRIP_POINTS.find((point) => point.id === id))
  .filter(Boolean);
const getVisibleArmorGripPoints = (model = {}) => (
  model.armorFullCharacterRigEnabled || ARMOR_GRIP_POINTS.some((point) => !point.core && model[`armorGrip${point.suffix}Enabled`])
    ? ARMOR_GRIP_POINTS
    : ARMOR_GRIP_POINTS.filter((point) => point.core)
);
const WEAPON_GRIP_POSITION_MIN = -2;
const WEAPON_GRIP_POSITION_MAX = 2;
const DECOR_SIZE_AXES = [
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
  { id: 'z', label: 'Z' },
];
const formatDraftNumber = (value) => (Number.isFinite(Number(value)) ? String(Number(value)) : '');
const normalizeDraftNumber = (value = '') => String(value ?? '').trim().replace(',', '.');
const isValidDraftNumber = (value = '') => {
  const normalized = normalizeDraftNumber(value);
  return normalized !== '' && Number.isFinite(Number(normalized));
};
const normalizeEquipmentHand = (value = '') => (value === 'left' ? 'left' : 'right');
const normalizeEquipmentArm = (value = '') => (value === 'right' ? 'right' : 'left');
const toDecorUserAxes = (dimensions = {}) => ({
  x: dimensions.x,
  y: dimensions.z,
  z: dimensions.y,
});

const getKindDefaults = (kind, current = {}) => {
  const nextKind = getDecorKindId(kind);
  if (nextKind === 'road') {
    const tileSize = getFloorTileSize(current);
    return {
      kind: 'road',
      width: tileSize,
      depth: tileSize,
      height: Math.min(Number(current.height) || 0.05, 0.08),
      floorZeroZ: getFloorZeroZ(current),
      collision: false,
      repeatTexture: false,
      materialBrightness: Number.isFinite(Number(current.materialBrightness)) ? Number(current.materialBrightness) : DECOR_FLOOR_MATERIAL_BRIGHTNESS,
      baseColor: current.baseColor === '#64748b' || !current.baseColor ? '#334155' : current.baseColor,
    };
  }
  if (nextKind === 'water') {
    const tileSize = getFloorTileSize(current);
    return {
      kind: 'water',
      width: tileSize,
      depth: tileSize,
      height: Math.min(Number(current.height) || 0.05, 0.08),
      floorZeroZ: getFloorZeroZ(current),
      collision: false,
      repeatTexture: false,
      materialBrightness: Number.isFinite(Number(current.materialBrightness)) ? Number(current.materialBrightness) : DECOR_FLOOR_MATERIAL_BRIGHTNESS,
      baseColor: current.baseColor === '#64748b' || !current.baseColor ? '#2563eb' : current.baseColor,
      accentColor: current.accentColor === '#f59e0b' || !current.accentColor ? '#67e8f9' : current.accentColor,
    };
  }
  if (nextKind === 'wall') {
    return {
      kind: 'wall',
      height: Math.max(Number(current.height) || 1.2, 1.4),
      collision: true,
      repeatTexture: false,
      baseColor: current.baseColor === '#64748b' || !current.baseColor ? '#475569' : current.baseColor,
    };
  }
  if (nextKind === 'house') {
    return {
      kind: 'house',
      height: Math.max(Number(current.height) || 1.2, 1.6),
      collision: true,
      repeatTexture: false,
    };
  }
  if (isInventoryKindId(nextKind)) {
    return {
      kind: nextKind,
      width: Number(current.width) || 0.8,
      depth: Number(current.depth) || 0.8,
      height: Number(current.height) || 1,
      collision: false,
      repeatTexture: false,
    };
  }
  return {
    kind: 'decor',
    collision: true,
    repeatTexture: false,
  };
};

const ensureDecorModels = (draft) => {
  if (!Array.isArray(draft.decorModels3d)) draft.decorModels3d = [];
  return draft.decorModels3d;
};

export default function Decor3DTab({
  project,
  patchProject,
  handleUpload,
  mediaLibrary,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  onSaveAssets,
  saveStatus,
  localModelScope = null,
  saveInProgress = false,
}) {
  const models = project.decorModels3d || [];
  const isSelectionControlled = controlledSelectedModelId !== undefined;
  const [localSelectedModelId, setLocalSelectedModelId] = useState(controlledSelectedModelId || models[0]?.id || '');
  const selectedModelId = isSelectionControlled ? controlledSelectedModelId : localSelectedModelId;
  const setSelectedModelId = useCallback((nextModelId) => {
    setLocalSelectedModelId(nextModelId);
    onSelectedModelIdChange?.(nextModelId);
  }, [onSelectedModelIdChange]);
  const [copyStatus, setCopyStatus] = useState('');
  const [importInProgress, setImportInProgress] = useState(false);
  const [activeCardField, setActiveCardField] = useState('');
  const localModelUrlsRef = useRef(new Map());
  const modelFileInputRef = useRef(null);
  const [dimensionDraft, setDimensionDraft] = useState({ modelId: '', x: '', y: '', z: '' });

  useEffect(() => {
    if (!models.length) {
      if (selectedModelId) setSelectedModelId('');
      return;
    }
    if (!models.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId, setSelectedModelId]);

  const selectedModel = models.find((model) => model.id === selectedModelId) || models[0] || null;
  const selectedModelSource = selectedModel ? getThreeModelSource(selectedModel) : '';
  const previewModel = useMemo(() => selectedModel || makeDecor3DModel({ name: 'Nouveau decor' }), [selectedModel]);
  const kindConfig = getDecorKindConfig(previewModel.kind);
  const KindIcon = kindConfig.icon;
  const editorKindLabel = selectedModel ? getDecorKindConfig(selectedModel.kind).label : kindConfig.label;
  const selectedKindId = getDecorKindId(selectedModel?.kind);
  const activeKindId = selectedModel ? selectedKindId : (activeCardField || getDecorKindId(previewModel.kind));
  const selectedIsFloorTile = selectedModel ? isFloorTileKind(selectedModel.kind) : false;
  const selectedIsInventoryWeapon = Boolean(selectedModelSource && selectedModel && isInventoryWeaponKindId(selectedModel.kind));
  const selectedIsInventoryArmor = Boolean(selectedModelSource && selectedModel && isInventoryArmorKindId(selectedModel.kind));
  const selectedIsInventoryHelmet = Boolean(selectedModelSource && selectedModel && isInventoryHelmetKindId(selectedModel.kind));
  const selectedIsInventoryLeggings = Boolean(selectedModelSource && selectedModel && isInventoryLeggingsKindId(selectedModel.kind));
  const selectedIsInventoryShield = Boolean(selectedModelSource && selectedModel && isInventoryShieldKindId(selectedModel.kind));
  const showFloorTileInspectorFields = selectedIsFloorTile && selectedKindId !== 'road';
  const showObjectSizeControl = Boolean(selectedModel) && (!selectedIsFloorTile || selectedModelSource);

  const patchSelectedModel = useCallback((updater, options) => {
    if (!selectedModelId) return;
    patchProject((draft) => {
      const model = ensureDecorModels(draft).find((entry) => entry.id === selectedModelId);
      if (model) updater(model);
    }, options);
  }, [patchProject, selectedModelId]);

  const commitSelectedModelDimension = useCallback((axisId, rawValue) => {
    if (!selectedModel) return;
    if (!isValidDraftNumber(rawValue)) {
      const dimensions = toDecorUserAxes(getDecorModelDimensions(selectedModel));
      setDimensionDraft((current) => ({
        ...current,
        modelId: selectedModel.id || '',
        [axisId]: formatDraftNumber(dimensions[axisId]),
      }));
      return;
    }
    patchSelectedModel((model) => {
      const dimensions = toDecorUserAxes(getDecorModelDimensions(model));
      const nextValue = numberValue(rawValue, dimensions[axisId] || 1, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX);
      const isProportional = isDecorModelSizeProportional(model);
      const nextDimensions = isProportional
        ? resizeAxesProportionally(dimensions, axisId, nextValue, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX)
        : { ...dimensions, [axisId]: nextValue };
      model.width = nextDimensions.x;
      model.height = nextDimensions.z;
      model.depth = nextDimensions.y;
      model.scale = 1;
    }, { rememberHistory: false });
  }, [patchSelectedModel, selectedModel]);

  const setSelectedModelDimensionDraft = useCallback((axisId, rawValue) => {
    setDimensionDraft((current) => ({
      ...current,
      modelId: selectedModelId || '',
      [axisId]: rawValue,
    }));
  }, [selectedModelId]);

  const setSelectedModelSizeProportional = useCallback((checked) => {
    patchSelectedModel((model) => {
      model.modelSizeProportional = checked;
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const setSelectedWeaponGripHand = useCallback((hand) => {
    patchSelectedModel((model) => {
      model.weaponGripHand = normalizeEquipmentHand(hand);
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const setSelectedWeaponGripEnabled = useCallback((hand, checked) => {
    const suffix = hand === 'left' ? 'Left' : 'Right';
    patchSelectedModel((model) => {
      model[`weaponGrip${suffix}Enabled`] = checked;
      if (checked && !Number(model[`weaponGrip${suffix}Y`])) {
        model[`weaponGrip${suffix}Y`] = -0.44;
      }
      if (checked && !Number(model[`weaponGrip${suffix}RotationZ`])) {
        model[`weaponGrip${suffix}RotationZ`] = 180;
      }
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const updateSelectedWeaponGripField = useCallback((hand, field, rawValue, options = {}) => {
    const suffix = hand === 'left' ? 'Left' : 'Right';
    patchSelectedModel((model) => {
      const key = `weaponGrip${suffix}${field}`;
      model[key] = options.numeric
        ? numberValue(rawValue, Number(model[key]) || 0, options.min, options.max)
        : rawValue;
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const updateSelectedWeaponGripMarker = useCallback((hand, point = {}) => {
    const suffix = hand === 'left' ? 'Left' : 'Right';
    patchSelectedModel((model) => {
      model[`weaponGrip${suffix}Enabled`] = true;
      if (!Number(model[`weaponGrip${suffix}RotationZ`])) {
        model[`weaponGrip${suffix}RotationZ`] = 180;
      }
      model[`weaponGrip${suffix}X`] = numberValue(point.x, Number(model[`weaponGrip${suffix}X`]) || 0, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
      model[`weaponGrip${suffix}Y`] = numberValue(point.y, Number(model[`weaponGrip${suffix}Y`]) || 0, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
      model[`weaponGrip${suffix}Z`] = numberValue(point.z, Number(model[`weaponGrip${suffix}Z`]) || 0, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const setSelectedShieldGripArm = useCallback((arm) => {
    patchSelectedModel((model) => {
      model.shieldGripArm = normalizeEquipmentArm(arm);
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const setSelectedShieldGripEnabled = useCallback((pointId, checked) => {
    const config = SHIELD_GRIP_POINTS.find((point) => point.id === pointId);
    if (!config) return;
    patchSelectedModel((model) => {
      model[`shieldGrip${config.suffix}Enabled`] = checked;
      if (checked && !Number(model[`shieldGrip${config.suffix}Y`])) {
        model[`shieldGrip${config.suffix}Y`] = config.defaultY;
      }
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const updateSelectedShieldGripField = useCallback((pointId, axis, rawValue) => {
    const config = SHIELD_GRIP_POINTS.find((point) => point.id === pointId);
    if (!config) return;
    patchSelectedModel((model) => {
      const key = `shieldGrip${config.suffix}${axis}`;
      const fallback = axis === 'Y' ? config.defaultY : 0;
      model[key] = numberValue(rawValue, Number(model[key]) || fallback, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const updateSelectedShieldGripMarker = useCallback((pointId, point = {}) => {
    const config = SHIELD_GRIP_POINTS.find((entry) => entry.id === pointId);
    if (!config) return;
    patchSelectedModel((model) => {
      model[`shieldGrip${config.suffix}Enabled`] = true;
      model[`shieldGrip${config.suffix}X`] = numberValue(point.x, Number(model[`shieldGrip${config.suffix}X`]) || 0, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
      model[`shieldGrip${config.suffix}Y`] = numberValue(point.y, Number(model[`shieldGrip${config.suffix}Y`]) || config.defaultY, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
      model[`shieldGrip${config.suffix}Z`] = numberValue(point.z, Number(model[`shieldGrip${config.suffix}Z`]) || 0, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const setSelectedArmorGripEnabled = useCallback((pointId, checked) => {
    const config = ARMOR_GRIP_POINTS.find((point) => point.id === pointId);
    if (!config) return;
    patchSelectedModel((model) => {
      model[`armorGrip${config.suffix}Enabled`] = checked;
      if (checked && !isValidDraftNumber(model[`armorGrip${config.suffix}X`])) {
        model[`armorGrip${config.suffix}X`] = config.defaultX;
      }
      if (checked && !isValidDraftNumber(model[`armorGrip${config.suffix}Y`])) {
        model[`armorGrip${config.suffix}Y`] = config.defaultY;
      }
      if (checked && !isValidDraftNumber(model[`armorGrip${config.suffix}Z`])) {
        model[`armorGrip${config.suffix}Z`] = config.defaultZ;
      }
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const updateSelectedArmorGripField = useCallback((pointId, axis, rawValue) => {
    const config = ARMOR_GRIP_POINTS.find((point) => point.id === pointId);
    if (!config) return;
    patchSelectedModel((model) => {
      const key = `armorGrip${config.suffix}${axis}`;
      const fallback = Number(config[`default${axis}`]) || 0;
      model[key] = numberValue(rawValue, Number(model[key]) || fallback, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const updateSelectedArmorGripMarker = useCallback((pointId, point = {}) => {
    const config = ARMOR_GRIP_POINTS.find((entry) => entry.id === pointId);
    if (!config) return;
    patchSelectedModel((model) => {
      model[`armorGrip${config.suffix}Enabled`] = true;
      model[`armorGrip${config.suffix}X`] = numberValue(point.x, Number(model[`armorGrip${config.suffix}X`]) || config.defaultX, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
      model[`armorGrip${config.suffix}Y`] = numberValue(point.y, Number(model[`armorGrip${config.suffix}Y`]) || config.defaultY, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
      model[`armorGrip${config.suffix}Z`] = numberValue(point.z, Number(model[`armorGrip${config.suffix}Z`]) || config.defaultZ, WEAPON_GRIP_POSITION_MIN, WEAPON_GRIP_POSITION_MAX);
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  useEffect(() => {
    const dimensions = selectedModel ? toDecorUserAxes(getDecorModelDimensions(selectedModel)) : { x: 2.2, y: 2.2, z: 1.2 };
    setDimensionDraft({
      modelId: selectedModel?.id || '',
      x: formatDraftNumber(dimensions.x),
      y: formatDraftNumber(dimensions.y),
      z: formatDraftNumber(dimensions.z),
    });
  }, [
    selectedModel?.id,
    selectedModel?.width,
    selectedModel?.height,
    selectedModel?.depth,
    selectedModel?.scale,
  ]);

  const setSelectedModelFile = useCallback(async (file) => {
    if (!file || !selectedModelId) return;
    const fileInfo = getDecorImportFileInfo(file);
    const { archiveFormat, modelFormat, isZip } = fileInfo;
    if (!archiveFormat && !modelFormat) {
      setCopyStatus('Choisis un fichier .glb, .fbx, .obj ou .zip');
      return;
    }
    const previousUrl = localModelUrlsRef.current.get(selectedModelId);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localModelUrlsRef.current.delete(selectedModelId);
    setImportInProgress(true);
    setCopyStatus(isZip ? 'Lecture ZIP...' : `Import ${getThreeModelFormatLabel(modelFormat)}...`);
    try {
      const { readDecorModelImport } = await import('../utils/rpg3dModelImport');
      const {
        zipBundle,
        sourceFile,
        sourceFormat,
        isGlb,
        optimizedFile,
        modelData,
        modelDimensions,
        modelFileSize,
      } = await readDecorModelImport(file, fileInfo);
      if (isZip) {
        setCopyStatus(`ZIP: ${getThreeModelFormatLabel(sourceFormat)} + ${zipBundle.modelResources.length} texture${zipBundle.modelResources.length > 1 ? 's' : ''}`);
      }
      const localModelFileId = createLocalModelFileId('decor', selectedModelId, optimizedFile);
      const modelUrl = URL.createObjectURL(optimizedFile);
      rememberRpg3DLocalBlobFile(modelUrl, optimizedFile, localModelFileId, { persist: false });
      const localModelPersisted = await persistLocalModelFile(localModelFileId, optimizedFile, { scope: localModelScope });
      localModelUrlsRef.current.set(selectedModelId, modelUrl);
      patchSelectedModel((model) => {
        if (activeCardField && getDecorKindId(model.kind) !== activeCardField) {
          Object.assign(model, getKindDefaults(activeCardField, model));
        }
        if (isFloorTileKind(model.kind)) {
          model.height = numberValue(model.height, 0.08, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX);
          model.floorZeroZ = getFloorZeroZ(model);
          model.collision = false;
          model.repeatTexture = false;
          model.modelCenterOnOrigin = true;
          if (!Number.isFinite(Number(model.materialBrightness))) model.materialBrightness = DECOR_FLOOR_MATERIAL_BRIGHTNESS;
        }
        if (modelDimensions) {
          model.width = modelDimensions.width;
          model.depth = modelDimensions.depth;
          model.height = modelDimensions.height;
          model.scale = 1;
        }
        model.modelUrl = modelUrl;
        model.modelData = modelData || '';
        model.localModelFileId = localModelPersisted ? localModelFileId : '';
        model.modelName = optimizedFile.name || zipBundle?.modelFile?.name || file.name || `modele.${sourceFormat}`;
        model.modelFormat = sourceFormat;
        model.modelFileSize = modelFileSize || Number(optimizedFile?.size || sourceFile?.size || file?.size) || 0;
        model.modelResources = zipBundle?.modelResources || [];
      });
      setCopyStatus(isGlb
        ? `GLB charge sans recompression${modelData ? '' : ' en local'}${localModelPersisted ? '' : ' - stockage local non confirme'}`
        : isZip
            ? `ZIP charge: ${getThreeModelFormatLabel(sourceFormat)} + ${zipBundle.modelResources.length} texture${zipBundle.modelResources.length > 1 ? 's' : ''}${modelData ? '' : ' en local'}${localModelPersisted ? '' : ' - stockage local non confirme'}`
            : `${getThreeModelFormatLabel(sourceFormat)} charge${modelData ? '' : ' en local'}${localModelPersisted ? '' : ' - stockage local non confirme'}`);
    } catch (error) {
      console.error(error);
      setCopyStatus('Import du modele 3D impossible');
    } finally {
      setImportInProgress(false);
    }
  }, [activeCardField, localModelScope, patchSelectedModel, selectedModelId]);

  const handleTextureUpload = useCallback(async (event, onSelect) => {
    const file = event?.target?.files?.[0];
    if (!file || !handleUpload) {
      await handleUpload?.(event, onSelect);
      return;
    }
    setImportInProgress(true);
    setCopyStatus('Import texture...');
    try {
      await handleUpload(event, onSelect);
      setCopyStatus('Texture importee');
    } catch {
      setCopyStatus('Import texture impossible');
    } finally {
      setImportInProgress(false);
    }
  }, [handleUpload]);

  const setSelectedTileSize = useCallback((value) => {
    patchSelectedModel((model) => {
      const size = numberValue(value, getFloorTileSize(model), 0.4, 8);
      model.width = size;
      model.depth = size;
      model.height = Math.min(Number(model.height) || 0.05, 0.08);
      model.floorZeroZ = getFloorZeroZ(model);
      model.collision = false;
    });
  }, [patchSelectedModel]);

  const setSelectedModelRotation = useCallback((field, value) => {
    patchSelectedModel((model) => {
      model[field] = getModelRotationValue({ [field]: value }, field);
    }, false);
  }, [patchSelectedModel]);

  const setSelectedModelFlat = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelRotationX = isFloorTileKind(model.kind) ? 0 : -90;
      model.modelRotationY = 0;
      model.modelRotationZ = 0;
      model.modelCenterOnOrigin = true;
      model.modelFlushToGround = !isFloorTileKind(model.kind);
    }, false);
  }, [patchSelectedModel]);

  const resetSelectedModelOrientation = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelRotationX = 0;
      model.modelRotationY = 0;
      model.modelRotationZ = 0;
      model.modelFlushToGround = false;
    }, false);
  }, [patchSelectedModel]);

  const centerSelectedModelOnOrigin = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelCenterOnOrigin = true;
    }, false);
  }, [patchSelectedModel]);

  const flushSelectedModelToGround = useCallback(() => {
    patchSelectedModel((model) => {
      model.modelFlushToGround = true;
      model.elevation = 0;
    }, false);
  }, [patchSelectedModel]);

  const createModel = (overrides = {}) => {
    const kindId = getDecorKindId(overrides.kind || activeKindId || 'decor');
    const kindDefaults = getKindDefaults(kindId, overrides);
    const kindConfig = getDecorKindConfig(kindId);
    const next = makeDecor3DModel({
      name: `Nouveau ${kindConfig.createLabel || kindConfig.label}`,
      ...kindDefaults,
      ...overrides,
      kind: kindId,
    });
    patchProject((draft) => {
      ensureDecorModels(draft).push(next);
    });
    setCopyStatus('');
    setActiveCardField(kindId);
    setSelectedModelId(next.id);
    return next;
  };

  const deleteModel = () => {
    if (!selectedModel) return;
    const nextModels = models.filter((model) => model.id !== selectedModel.id);
    setSelectedModelId(nextModels[0]?.id || '');
    patchProject((draft) => {
      draft.decorModels3d = ensureDecorModels(draft).filter((model) => model.id !== selectedModel.id);
    });
  };

  const showLibraryPanel = false;
  const showInspectorPanel = true;
  const showGlbImportControl = Boolean(selectedModel);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const decorTabClassName = [
    'decor3d-tab',
    'decor3d-tab-with-inspector',
    previewFullscreen ? 'decor3d-tab-fullscreen' : '',
    previewFullscreen && previewDrawerOpen ? 'decor3d-drawer-open' : '',
  ].filter(Boolean).join(' ');
  const togglePreviewFullscreen = () => {
    setPreviewFullscreen((current) => {
      const next = !current;
      if (!next) setPreviewDrawerOpen(false);
      return next;
    });
  };
  const selectedDimensions = selectedModel ? toDecorUserAxes(getDecorModelDimensions(selectedModel)) : { x: 2.2, y: 2.2, z: 1.2 };
  const selectedSizeProportional = selectedModel ? isDecorModelSizeProportional(selectedModel) : false;
  const activeDimensionDraft = dimensionDraft.modelId === (selectedModel?.id || '')
    ? dimensionDraft
    : {
      modelId: selectedModel?.id || '',
      x: formatDraftNumber(selectedDimensions.x),
      y: formatDraftNumber(selectedDimensions.y),
      z: formatDraftNumber(selectedDimensions.z),
    };
  const selectedWeaponGripMarkers = useMemo(() => {
    if (!selectedIsInventoryWeapon || !selectedModel) return [];
    return WEAPON_GRIP_HANDS.map((hand) => ({
      hand: hand.id,
      label: hand.label,
      enabled: Boolean(selectedModel[`weaponGrip${hand.suffix}Enabled`]),
      x: Number(selectedModel[`weaponGrip${hand.suffix}X`]) || 0,
      y: Number(selectedModel[`weaponGrip${hand.suffix}Y`]) || 0,
      z: Number(selectedModel[`weaponGrip${hand.suffix}Z`]) || 0,
    }));
  }, [selectedIsInventoryWeapon, selectedModel]);
  const selectedShieldGripMarkers = useMemo(() => {
    if (!selectedIsInventoryShield || !selectedModel) return [];
    return SHIELD_GRIP_POINTS.map((point) => ({
      id: point.id,
      label: point.label,
      enabled: Boolean(selectedModel[`shieldGrip${point.suffix}Enabled`]),
      x: Number(selectedModel[`shieldGrip${point.suffix}X`]) || 0,
      y: Number(selectedModel[`shieldGrip${point.suffix}Y`]) || point.defaultY,
      z: Number(selectedModel[`shieldGrip${point.suffix}Z`]) || 0,
    }));
  }, [selectedIsInventoryShield, selectedModel]);
  const selectedArmorGripMarkers = useMemo(() => {
    if (!selectedIsInventoryArmor || !selectedModel) return [];
    return getVisibleArmorGripPoints(selectedModel).map((point) => ({
      ...point,
      id: point.id,
      label: point.label,
      enabled: Boolean(selectedModel[`armorGrip${point.suffix}Enabled`]),
      x: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}X`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}X`])) : point.defaultX,
      y: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}Y`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}Y`])) : point.defaultY,
      z: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}Z`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}Z`])) : point.defaultZ,
      defaultX: point.defaultX,
      defaultY: point.defaultY,
      defaultZ: point.defaultZ,
    }));
  }, [selectedIsInventoryArmor, selectedModel]);
  const selectedHelmetGripMarkers = useMemo(() => {
    if (!selectedIsInventoryHelmet || !selectedModel) return [];
    return HELMET_GRIP_POINTS.map((point) => ({
      ...point,
      id: point.id,
      label: point.label,
      enabled: Boolean(selectedModel[`armorGrip${point.suffix}Enabled`]),
      x: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}X`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}X`])) : point.defaultX,
      y: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}Y`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}Y`])) : point.defaultY,
      z: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}Z`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}Z`])) : point.defaultZ,
      defaultX: point.defaultX,
      defaultY: point.defaultY,
      defaultZ: point.defaultZ,
    }));
  }, [selectedIsInventoryHelmet, selectedModel]);
  const selectedLeggingsGripMarkers = useMemo(() => {
    if (!selectedIsInventoryLeggings || !selectedModel) return [];
    return LEGGINGS_GRIP_POINTS.map((point) => ({
      ...point,
      id: point.id,
      label: point.label,
      enabled: Boolean(selectedModel[`armorGrip${point.suffix}Enabled`]),
      x: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}X`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}X`])) : point.defaultX,
      y: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}Y`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}Y`])) : point.defaultY,
      z: isValidDraftNumber(selectedModel[`armorGrip${point.suffix}Z`]) ? Number(normalizeDraftNumber(selectedModel[`armorGrip${point.suffix}Z`])) : point.defaultZ,
      defaultX: point.defaultX,
      defaultY: point.defaultY,
      defaultZ: point.defaultZ,
    }));
  }, [selectedIsInventoryLeggings, selectedModel]);
  const selectedRigGripMarkers = selectedIsInventoryHelmet
    ? selectedHelmetGripMarkers
    : (selectedIsInventoryLeggings ? selectedLeggingsGripMarkers : selectedArmorGripMarkers);
  const selectedHasRigGripMarkers = selectedIsInventoryArmor || selectedIsInventoryHelmet || selectedIsInventoryLeggings;
  const setDecorKind = (kindId) => {
    if (selectedModel?.id) {
      setSelectedModelId(selectedModel.id);
      patchSelectedModel((model) => {
        Object.assign(model, getKindDefaults(kindId, model));
      });
    } else {
      const nextKind = getDecorKindConfig(kindId);
      createModel({ name: `Nouveau ${nextKind.label}`, ...getKindDefaults(kindId) });
    }
    setActiveCardField(kindId);
  };

  return (
    <main className={decorTabClassName}>
      {showLibraryPanel ? (
      <section className="panel decor3d-library-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Atelier</span>
            <h2>Decors 3D</h2>
            <p className="small-note">{models.length} modele{models.length > 1 ? 's' : ''}</p>
          </div>
          <button type="button" className="primary-action" onClick={() => createModel()}>
            <Plus aria-hidden="true" size={16} />
            <span>Decor</span>
          </button>
        </div>

        <div className="decor3d-list" aria-label="Decors 3D">
          {models.map((model) => {
            const modelKind = getDecorKindConfig(model.kind);
            const ModelKindIcon = modelKind.icon;
            return (
              <button
                type="button"
                key={model.id}
                className={`decor3d-list-item ${model.id === selectedModelId ? 'selected' : ''}`}
                onClick={() => setSelectedModelId(model.id)}
              >
                <span className="decor3d-thumb" style={{ '--decor-body': colorValue(model.baseColor, '#64748b'), '--decor-accent': colorValue(model.accentColor, '#f59e0b') }}>
                  {model.imageData ? <img src={model.imageData} alt="" /> : <ModelKindIcon aria-hidden="true" size={19} />}
                </span>
                <span>
                  <strong>{model.name || 'Decor 3D'}</strong>
                  <small>{modelKind.label}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      ) : null}

      <section className="panel decor3d-side-card" aria-label="Carte decor">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Carte</span>
            <h2>{previewModel.name || 'Decor 3D'}</h2>
          </div>
        </div>
        <div className="decor3d-card-grid">
          {KIND_OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            const childOptions = option.children || [];
            const isGroup = childOptions.length > 0;
            const isActive = isGroup
              ? childOptions.some((child) => child.id === activeKindId)
              : activeKindId === option.id;
            return (
              <div key={option.id} className={isGroup ? 'decor3d-kind-group' : ''}>
                <button
                  type="button"
                  className={isActive ? 'active' : ''}
                  onClick={() => setDecorKind(isGroup ? childOptions[0].id : option.id)}
                >
                  <OptionIcon aria-hidden="true" size={14} /> {option.label}
                </button>
                {isGroup ? (
                  <div className="decor3d-subkind-grid">
                    {childOptions.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          className={activeKindId === child.id ? 'active' : ''}
                          onClick={() => setDecorKind(child.id)}
                        >
                          <ChildIcon aria-hidden="true" size={13} /> {child.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel decor3d-preview-panel">
        <React.Suspense fallback={<div className="decor3d-preview-loading" />}>
          <Decor3DPreview
            model={previewModel}
            weaponGripMarkers={selectedWeaponGripMarkers}
            onWeaponGripMarkerChange={selectedIsInventoryWeapon ? updateSelectedWeaponGripMarker : undefined}
            shieldGripMarkers={selectedShieldGripMarkers}
            onShieldGripMarkerChange={selectedIsInventoryShield ? updateSelectedShieldGripMarker : undefined}
            armorGripMarkers={selectedRigGripMarkers}
            onArmorGripMarkerChange={selectedHasRigGripMarkers ? updateSelectedArmorGripMarker : undefined}
          >
            <div className="decor3d-preview-toolbar decor3d-canvas-overlay">
              <div>
                <span className="section-kicker"><KindIcon size={14} /> Modele</span>
                <h2>{previewModel.name || 'Decor 3D'}</h2>
              </div>
              <div className="decor3d-preview-actions">
                {previewFullscreen ? (
                  <button
                    type="button"
                    className={previewDrawerOpen ? 'active' : ''}
                    title={previewDrawerOpen ? 'Fermer le tiroir' : 'Ouvrir le tiroir'}
                    aria-label={previewDrawerOpen ? 'Fermer le tiroir de navigation' : 'Ouvrir le tiroir de navigation'}
                    aria-pressed={previewDrawerOpen}
                    onClick={() => setPreviewDrawerOpen((open) => !open)}
                  >
                    <PanelLeftOpen aria-hidden="true" size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  title={previewFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
                  aria-label={previewFullscreen ? 'Quitter le plein ecran' : 'Activer le plein ecran'}
                  aria-pressed={previewFullscreen}
                  onClick={togglePreviewFullscreen}
                >
                  {previewFullscreen ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
                </button>
              </div>
            </div>
          </Decor3DPreview>
        </React.Suspense>

        <div className="decor3d-meta-strip">
          <span><KindIcon aria-hidden="true" size={14} /> {kindConfig.label}</span>
          {copyStatus ? <span><Sparkles aria-hidden="true" size={14} /> {copyStatus}</span> : null}
        </div>
      </section>

      {showInspectorPanel ? (
      <section className="panel decor3d-editor-panel">
        <div className="decor3d-editor-fixed">
          <div className="panel-head panel-head-stack">
            <div>
              <span className="section-kicker">Reglages</span>
              <h2>{selectedModel ? `Fiche ${editorKindLabel}` : `Aucun ${editorKindLabel}`}</h2>
            </div>
            <div className="decor3d-editor-actions">
              <button
                type="button"
                className="secondary-action decor3d-new-button"
                aria-label="Nouvel objet 3D"
                title="Nouvel objet 3D"
                onClick={() => {
                  createModel();
                }}
              >
                <Plus aria-hidden="true" size={15} />
                <span>Nouveau</span>
              </button>
              {onSaveAssets ? (
                <button
                  type="button"
                  className="secondary-action decor3d-save-button"
                  aria-label="Sauvegarder objet"
                  title="Sauvegarder objet"
                  onClick={onSaveAssets}
                  disabled={saveInProgress}
                >
                  <Save aria-hidden="true" size={15} />
                  <span>Sauver</span>
                </button>
              ) : null}
              <button type="button" className="danger-button compact" onClick={deleteModel} disabled={!selectedModel || models.length <= 1}>
                <Trash2 aria-hidden="true" size={15} />
              </button>
            </div>
          </div>
          {saveStatus ? <p className="decor3d-save-status" role="status">{saveStatus}</p> : null}
          {saveInProgress ? <div className="decor3d-progress decor3d-progress-save" role="progressbar" aria-label="Sauvegarde en cours"><span /></div> : null}
          {copyStatus ? <p className="decor3d-import-status" role="status">{copyStatus}</p> : null}
          {importInProgress ? <div className="decor3d-progress decor3d-progress-import" role="progressbar" aria-label="Import en cours"><span /></div> : null}
        </div>

        <div className="decor3d-editor-scroll">
        {selectedModel ? (
          <div className="decor3d-form">
            <label>
              <DecorHelpLabel help={DECOR_FIELD_HELP.name}>Nom</DecorHelpLabel>
              <input value={selectedModel.name || ''} onChange={(event) => patchSelectedModel((model) => { model.name = event.target.value; })} />
            </label>
            <div className="decor3d-orientation-grid">
              <label>
                <DecorHelpLabel help={DECOR_FIELD_HELP.rotationX}>Inclinaison X</DecorHelpLabel>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="15"
                  value={getModelRotationX(selectedModel)}
                  onChange={(event) => setSelectedModelRotation('modelRotationX', event.target.value)}
                />
              </label>
              <label>
                <DecorHelpLabel help={DECOR_FIELD_HELP.rotationY}>Axe Y</DecorHelpLabel>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="15"
                  value={getModelRotationY(selectedModel)}
                  onChange={(event) => setSelectedModelRotation('modelRotationY', event.target.value)}
                />
              </label>
              <label>
                <DecorHelpLabel help={DECOR_FIELD_HELP.rotationZ}>Inclinaison Z</DecorHelpLabel>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="15"
                  value={getModelRotationZ(selectedModel)}
                  onChange={(event) => setSelectedModelRotation('modelRotationZ', event.target.value)}
                />
              </label>
            </div>
            <div className="decor3d-orientation-actions">
              <button type="button" className="secondary-action" onClick={setSelectedModelFlat}>A plat</button>
              <button type="button" className="secondary-action" onClick={centerSelectedModelOnOrigin}>Centrer</button>
              {selectedModelSource ? (
                <button type="button" className="secondary-action" onClick={flushSelectedModelToGround}>Niveau sol</button>
              ) : null}
              <button type="button" className="secondary-action" onClick={resetSelectedModelOrientation}>Debout</button>
            </div>

            {showObjectSizeControl ? (
              <div className="decor3d-axis-size">
                <div className="decor3d-axis-size-head">
                  <DecorHelpLabel help={DECOR_FIELD_HELP.modelScale}>Taille XYZ</DecorHelpLabel>
                  <label className="decor3d-proportional-toggle">
                    <input
                      type="checkbox"
                      checked={selectedSizeProportional}
                      onChange={(event) => setSelectedModelSizeProportional(event.target.checked)}
                    />
                    <span>Proportionnel</span>
                  </label>
                </div>
                <div className="decor3d-axis-grid">
                  {DECOR_SIZE_AXES.map(({ id, label }) => (
                    <label key={id}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min={DECOR_MODEL_DIMENSION_MIN}
                        max={DECOR_MODEL_DIMENSION_MAX}
                        step="0.001"
                        value={activeDimensionDraft[id]}
                        onChange={(event) => setSelectedModelDimensionDraft(id, event.target.value)}
                        onBlur={(event) => commitSelectedModelDimension(id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitSelectedModelDimension(id, event.currentTarget.value);
                            event.currentTarget.blur();
                          }
                          if (event.key === 'Escape') {
                            setSelectedModelDimensionDraft(id, formatDraftNumber(selectedDimensions[id]));
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {showFloorTileInspectorFields ? (
              <>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.floorTileSize}>Taille carre</DecorHelpLabel>
                  <input
                    type="number"
                    min="0.4"
                    max="8"
                    step="0.1"
                    value={getFloorTileSize(selectedModel)}
                    onChange={(event) => setSelectedTileSize(event.target.value)}
                  />
                </label>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.floorZeroZ}>Z 0 personnages</DecorHelpLabel>
                  <input
                    type="number"
                    min={FLOOR_ZERO_Z_MIN}
                    max={FLOOR_ZERO_Z_MAX}
                    step="0.5"
                    value={getFloorZeroZ(selectedModel)}
                    onChange={(event) => patchSelectedModel((model) => {
                      model.floorZeroZ = numberValue(event.target.value, getFloorZeroZ(model), FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
                    })}
                  />
                </label>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.baseColor}>Couleur sol</DecorHelpLabel>
                  <input
                    type="color"
                    value={colorValue(selectedModel.baseColor, selectedKindId === 'water' ? '#2563eb' : '#334155')}
                    onChange={(event) => patchSelectedModel((model) => { model.baseColor = event.target.value; })}
                  />
                </label>
                <label>
                  <DecorHelpLabel help={DECOR_FIELD_HELP.accentColor}>Couleur detail</DecorHelpLabel>
                  <input
                    type="color"
                    value={colorValue(selectedModel.accentColor, selectedKindId === 'water' ? '#67e8f9' : '#f59e0b')}
                    onChange={(event) => patchSelectedModel((model) => { model.accentColor = event.target.value; })}
                  />
                </label>
              </>
            ) : null}

            {showGlbImportControl ? (
              <>
                <DecorHelpLabel help={DECOR_FIELD_HELP.glbImport}>Modele 3D</DecorHelpLabel>
                <button type="button" className="button like full secondary-action decor3d-file-button" onClick={() => modelFileInputRef.current?.click()}>
                  <Upload aria-hidden="true" size={16} />
                  <span>{selectedModel.modelName ? 'Remplacer modele 3D' : 'Importer modele 3D'}</span>
                </button>
                <input
                  ref={modelFileInputRef}
                  type="file"
                  accept={THREE_MODEL_ACCEPT}
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    setSelectedModelFile(file);
                  }}
                />
                {selectedModelSource ? (
                  <label>
                    <DecorHelpLabel help={DECOR_FIELD_HELP.materialBrightness}>Lumiere carte {Math.round(getDecorMaterialBrightness(selectedModel) * 100)}%</DecorHelpLabel>
                    <input
                      type="range"
                      min={DECOR_MATERIAL_BRIGHTNESS_MIN}
                      max={DECOR_MATERIAL_BRIGHTNESS_MAX}
                      step="0.05"
                      value={getDecorMaterialBrightness(selectedModel)}
                      onChange={(event) => patchSelectedModel((model) => {
                        model.materialBrightness = numberValue(
                          event.target.value,
                          getDecorMaterialBrightness(model),
                          DECOR_MATERIAL_BRIGHTNESS_MIN,
                          DECOR_MATERIAL_BRIGHTNESS_MAX,
                        );
                      })}
                    />
                  </label>
                ) : null}
              </>
            ) : null}

            {selectedIsInventoryWeapon ? (
              <div className="decor3d-weapon-grip-section">
                <DecorHelpLabel help="Definis le point de l arme qui doit tomber dans la main du personnage. Les valeurs sont en coordonnees locales du modele apres taille normalisee.">
                  Points de prise
                </DecorHelpLabel>
                <label>
                  <span>Main par défaut</span>
                  <select
                    value={normalizeEquipmentHand(selectedModel.weaponGripHand)}
                    onChange={(event) => setSelectedWeaponGripHand(event.target.value)}
                  >
                    {WEAPON_GRIP_HANDS.map((hand) => (
                      <option key={hand.id} value={hand.id}>{hand.label}</option>
                    ))}
                  </select>
                </label>
                <div className="decor3d-weapon-grip-grid">
                  {WEAPON_GRIP_HANDS.map((hand) => {
                    const enabledField = `weaponGrip${hand.suffix}Enabled`;
                    const enabled = Boolean(selectedModel[enabledField]);
                    return (
                      <div className="decor3d-weapon-grip-card" key={hand.id}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => setSelectedWeaponGripEnabled(hand.id, event.target.checked)}
                          />
                          <span>{hand.label}</span>
                        </label>
                        <div className="decor3d-axis-grid">
                          {['X', 'Y', 'Z'].map((axis) => {
                            const field = axis;
                            const key = `weaponGrip${hand.suffix}${axis}`;
                            return (
                              <label key={key}>
                                <span>Point {axis}</span>
                                <input
                                  type="number"
                                  min={WEAPON_GRIP_POSITION_MIN}
                                  max={WEAPON_GRIP_POSITION_MAX}
                                  step="0.01"
                                  disabled={!enabled}
                                  value={selectedModel[key] || 0}
                                  onChange={(event) => updateSelectedWeaponGripField(hand.id, field, event.target.value, {
                                    numeric: true,
                                    min: WEAPON_GRIP_POSITION_MIN,
                                    max: WEAPON_GRIP_POSITION_MAX,
                                  })}
                                />
                              </label>
                            );
                          })}
                        </div>
                        <div className="decor3d-axis-grid">
                          {['X', 'Y', 'Z'].map((axis) => {
                            const field = `Rotation${axis}`;
                            const key = `weaponGrip${hand.suffix}${field}`;
                            return (
                              <label key={key}>
                                <span>Rot {axis}</span>
                                <input
                                  type="number"
                                  min="-180"
                                  max="180"
                                  step="5"
                                  disabled={!enabled}
                                  value={selectedModel[key] || 0}
                                  onChange={(event) => updateSelectedWeaponGripField(hand.id, field, event.target.value, {
                                    numeric: true,
                                    min: -180,
                                    max: 180,
                                  })}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedIsInventoryArmor ? (
              <div className="decor3d-weapon-grip-section">
                <DecorHelpLabel help="Definis les points de l armure qui doivent suivre les epaules, les coudes et le bas du ventre du personnage. Les pastilles se deplacent directement dans l apercu.">
                  Points de prise armure
                </DecorHelpLabel>
                <div className="decor3d-weapon-grip-grid">
                  {getVisibleArmorGripPoints(selectedModel).map((point) => {
                    const enabledField = `armorGrip${point.suffix}Enabled`;
                    const enabled = Boolean(selectedModel[enabledField]);
                    return (
                      <div className="decor3d-weapon-grip-card" key={point.id}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => setSelectedArmorGripEnabled(point.id, event.target.checked)}
                          />
                          <span>{point.label}</span>
                        </label>
                        <div className="decor3d-axis-grid">
                          {['X', 'Y', 'Z'].map((axis) => {
                            const key = `armorGrip${point.suffix}${axis}`;
                            const fallback = Number(point[`default${axis}`]) || 0;
                            return (
                              <label key={key}>
                                <span>Point {axis}</span>
                                <input
                                  type="number"
                                  min={WEAPON_GRIP_POSITION_MIN}
                                  max={WEAPON_GRIP_POSITION_MAX}
                                  step="0.01"
                                  disabled={!enabled}
                                  value={selectedModel[key] ?? fallback}
                                  onChange={(event) => updateSelectedArmorGripField(point.id, axis, event.target.value)}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedIsInventoryHelmet ? (
              <div className="decor3d-weapon-grip-section">
                <DecorHelpLabel help="Definis le point du casque qui doit tomber sur la bouche du personnage. Active puis deplace la pastille BO dans l apercu pour caler les casques fermes.">
                  Point de prise casque
                </DecorHelpLabel>
                <div className="decor3d-weapon-grip-grid">
                  {HELMET_GRIP_POINTS.map((point) => {
                    const enabledField = `armorGrip${point.suffix}Enabled`;
                    const enabled = Boolean(selectedModel[enabledField]);
                    return (
                      <div className="decor3d-weapon-grip-card" key={point.id}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => setSelectedArmorGripEnabled(point.id, event.target.checked)}
                          />
                          <span>{point.label}</span>
                        </label>
                        <div className="decor3d-axis-grid">
                          {['X', 'Y', 'Z'].map((axis) => {
                            const key = `armorGrip${point.suffix}${axis}`;
                            const fallback = Number(point[`default${axis}`]) || 0;
                            return (
                              <label key={key}>
                                <span>Point {axis}</span>
                                <input
                                  type="number"
                                  min={WEAPON_GRIP_POSITION_MIN}
                                  max={WEAPON_GRIP_POSITION_MAX}
                                  step="0.01"
                                  disabled={!enabled}
                                  value={selectedModel[key] ?? fallback}
                                  onChange={(event) => updateSelectedArmorGripField(point.id, axis, event.target.value)}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedIsInventoryLeggings ? (
              <div className="decor3d-weapon-grip-section">
                <DecorHelpLabel help="Definis les points des jambieres qui doivent suivre les aines, les genoux et les pieds du personnage. Les pastilles se deplacent directement dans l apercu.">
                  Points de prise jambieres
                </DecorHelpLabel>
                <div className="decor3d-weapon-grip-grid">
                  {LEGGINGS_GRIP_POINTS.map((point) => {
                    const enabledField = `armorGrip${point.suffix}Enabled`;
                    const enabled = Boolean(selectedModel[enabledField]);
                    return (
                      <div className="decor3d-weapon-grip-card" key={point.id}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => setSelectedArmorGripEnabled(point.id, event.target.checked)}
                          />
                          <span>{point.label}</span>
                        </label>
                        <div className="decor3d-axis-grid">
                          {['X', 'Y', 'Z'].map((axis) => {
                            const key = `armorGrip${point.suffix}${axis}`;
                            const fallback = Number(point[`default${axis}`]) || 0;
                            return (
                              <label key={key}>
                                <span>Point {axis}</span>
                                <input
                                  type="number"
                                  min={WEAPON_GRIP_POSITION_MIN}
                                  max={WEAPON_GRIP_POSITION_MAX}
                                  step="0.01"
                                  disabled={!enabled}
                                  value={selectedModel[key] ?? fallback}
                                  onChange={(event) => updateSelectedArmorGripField(point.id, axis, event.target.value)}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedIsInventoryShield ? (
              <div className="decor3d-weapon-grip-section">
                <DecorHelpLabel help="Definis les points du bouclier qui doivent suivre la ligne du bras du personnage. Avec main/poignet et coude actifs, le bouclier s'aligne toujours sur cette ligne.">
                  Points de prise bouclier
                </DecorHelpLabel>
                <label>
                  <span>Bras par defaut</span>
                  <select
                    value={normalizeEquipmentArm(selectedModel.shieldGripArm)}
                    onChange={(event) => setSelectedShieldGripArm(event.target.value)}
                  >
                    {SHIELD_GRIP_ARMS.map((arm) => (
                      <option key={arm.id} value={arm.id}>{arm.label}</option>
                    ))}
                  </select>
                </label>
                <div className="decor3d-weapon-grip-grid">
                  {SHIELD_GRIP_POINTS.map((point) => {
                    const enabledField = `shieldGrip${point.suffix}Enabled`;
                    const enabled = Boolean(selectedModel[enabledField]);
                    return (
                      <div className="decor3d-weapon-grip-card" key={point.id}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => setSelectedShieldGripEnabled(point.id, event.target.checked)}
                          />
                          <span>{point.label}</span>
                        </label>
                        <div className="decor3d-axis-grid">
                          {['X', 'Y', 'Z'].map((axis) => {
                            const key = `shieldGrip${point.suffix}${axis}`;
                            return (
                              <label key={key}>
                                <span>Point {axis}</span>
                                <input
                                  type="number"
                                  min={WEAPON_GRIP_POSITION_MIN}
                                  max={WEAPON_GRIP_POSITION_MAX}
                                  step="0.01"
                                  disabled={!enabled}
                                  value={selectedModel[key] ?? (axis === 'Y' ? point.defaultY : 0)}
                                  onChange={(event) => updateSelectedShieldGripField(point.id, axis, event.target.value)}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedModelSource ? (
              <>
                <DecorHelpLabel help={DECOR_FIELD_HELP.glbTexture}>Texture modele</DecorHelpLabel>
                <MediaSourcePicker
                  className="button like full secondary-action decor3d-file-button"
                  accept="image/*"
                  assetScope="decor3d-texture"
                  handleUpload={handleTextureUpload}
                  mediaLibrary={mediaLibrary}
                  onSelect={(data, name) => patchSelectedModel((model) => {
                    model.imageData = data;
                    model.imageName = name;
                  })}
                >
                  <ImageIcon aria-hidden="true" size={16} />
                  <span>{selectedModel.imageName || 'Texture modele'}</span>
                </MediaSourcePicker>
                {selectedModel.imageData ? (
                  <>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedModel.repeatTexture)}
                        onChange={(event) => patchSelectedModel((model) => {
                          model.repeatTexture = event.target.checked;
                        })}
                      />
                      <DecorHelpLabel help={DECOR_FIELD_HELP.repeatTexture}>Repeter texture</DecorHelpLabel>
                    </label>
                    <button type="button" className="secondary-action full" onClick={() => patchSelectedModel((model) => {
                      model.imageData = '';
                      model.imageName = '';
                      model.repeatTexture = false;
                    })}>
                      Retirer texture modele
                    </button>
                  </>
                ) : null}
              </>
            ) : null}

            {selectedModelSource ? (
              <button type="button" className="secondary-action full" onClick={() => patchSelectedModel((model) => {
                if (String(model.modelUrl || '').startsWith('blob:')) {
                  const previousUrl = localModelUrlsRef.current.get(model.id);
                  if (previousUrl) {
                    forgetRpg3DLocalBlobFile(previousUrl);
                    URL.revokeObjectURL(previousUrl);
                  }
                  localModelUrlsRef.current.delete(model.id);
                }
                model.modelUrl = '';
                model.modelData = '';
                model.localModelFileId = '';
                model.modelName = '';
                model.modelFormat = '';
                model.modelFileSize = 0;
                model.modelResources = [];
              })}>
                Retirer modele 3D
              </button>
            ) : null}

          </div>
        ) : (
          <div className="empty-state-inline">Aucun decor 3D.</div>
        )}
        </div>
      </section>
      ) : null}
    </main>
  );
}
