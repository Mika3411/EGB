import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cuboid,
  Footprints,
  HardHat,
  Maximize2,
  Minimize2,
  PanelLeftOpen,
  Plus,
  Save,
  Shield,
  Swords,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { makeCharacter3DModel } from '../data/projectData';
import {
  CHARACTER_ANIMATION_SLOTS,
  CHARACTER_MATERIAL_BRIGHTNESS_MAX,
  CHARACTER_MATERIAL_BRIGHTNESS_MIN,
  CHARACTER_MODEL_SCALE_MAX,
  CHARACTER_MODEL_SCALE_MIN,
  getAnimationBaseSlotId,
  getAnimationEntriesForSlot,
  getAnimationSource,
  getCharacterModelAxisScale,
  getCharacterImportFileInfo,
  getCharacterMaterialBrightness,
  getEmbeddedAnimationSignature,
  getPreviewLightIntensity,
  getPreviewLightOrientation,
  isCharacterModelScaleProportional,
  isHeavyLocalFbxAsset,
  numberValue,
  resizeAxesProportionally,
  summarizeEmbeddedAnimationClips,
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
import { getStudioDecorKindId } from '../utils/rpg3dDomain.js';
import { formatBytes } from '../utils/glbOptimizer';
import { lazyWithRetry } from '../utils/lazyImportRetry';
import { getAdminAuthHeaders } from '../lib/adminApi';
import HelpLabel from './forms/HelpLabel.jsx';

const Character3DPreview = lazyWithRetry(() => import('./rpg3d/Character3DPreview.jsx'));

const ROLE_OPTIONS = [
  { id: 'hero', label: 'Héros', icon: Shield },
  { id: 'enemy', label: 'Ennemi', icon: Swords },
  { id: 'npc', label: 'PNJ', icon: User },
];

const CHARACTER_FIELD_HELP = {
  name: 'Nom interne et visible du personnage dans les listes du builder 3D.',
  glbImport: 'Charge ou remplace le modèle 3D du personnage avec son animation stand-by de base au format .glb, .fbx, .obj ou .zip. Pour un FBX avec dossier .fbm, importe un zip contenant le FBX et ses textures.',
  animationImport: 'Ajoute un FBX/GLB d animation qui utilise le même squelette que le modèle principal. Le stand-by joue quand le joueur est arrêté, la marche pendant le déplacement, l attaque pendant le tir ou le sort.',
  characterModelScale: 'Règle les axes du personnage quand il est placé sur la carte RPG 3D. X élargit, Y règle la profondeur, Z règle la hauteur.',
  equipment: 'Choisit une arme, un casque, une armure, des jambières ou un bouclier créé dans Objets 3D > Inventaire pour l associer au personnage.',
  materialBrightness: 'Règle la luminosité de ce personnage quand il est placé sur la carte RPG 3D.',
  previewLightIntensity: 'Règle la puissance de l éclairage dans l aperçu personnage. Cela aide à vérifier les volumes et les textures.',
  previewLightOrientation: 'Tourne la lumière principale autour du personnage pour contrôler les ombres dans l aperçu.',
};

const CharacterHelpLabel = ({ children, help }) => (
  <HelpLabel as="span" className="builder3d-help-label" help={help}>{children}</HelpLabel>
);

const ensureCharacterModels = (draft) => {
  if (!Array.isArray(draft.characterModels3d)) draft.characterModels3d = [];
  return draft.characterModels3d;
};

const CHARACTER_SCALE_AXES = [
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
  { id: 'z', label: 'Z' },
];
const CHARACTER_EQUIPMENT_SLOTS = [
  { type: 'weapon', label: 'Arme', kind: 'inventory-weapon', icon: Swords },
  { type: 'helmet', label: 'Casque', kind: 'inventory-helmet', icon: HardHat },
  { type: 'armor', label: 'Armure', kind: 'inventory-armor', icon: Cuboid },
  { type: 'leggings', label: 'Jambieres', kind: 'inventory-leggings', icon: Footprints },
  { type: 'shield', label: 'Bouclier', kind: 'inventory-shield', icon: Shield },
];
const CHARACTER_EQUIPMENT_TYPES = new Set(CHARACTER_EQUIPMENT_SLOTS.map((slot) => slot.type));
const getCharacterEquipmentLabel = (type = 'weapon') => (
  CHARACTER_EQUIPMENT_SLOTS.find((slot) => slot.type === type)?.label || 'Arme'
);
const CHARACTER_EQUIPMENT_KIND_BY_TYPE = CHARACTER_EQUIPMENT_SLOTS.reduce((map, slot) => ({
  ...map,
  [slot.type]: slot.kind,
}), {});
const normalizeEquipmentKindText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();
const inferEquipmentKindFromModel = (model = {}) => {
  const kind = getStudioDecorKindId(model.kind);
  if (Object.values(CHARACTER_EQUIPMENT_KIND_BY_TYPE).includes(kind)) return kind;
  const haystack = normalizeEquipmentKindText([
    model.name,
    model.modelName,
    model.imageName,
    model.kind,
  ].filter(Boolean).join(' '));
  if (/(bouclier|shield|buckler|targe)/.test(haystack)) return 'inventory-shield';
  if (/(arme|weapon|sword|epee|blade|lame|hache|axe|mace|massue|dagger|dague|bow|arc|staff|baton)/.test(haystack)) return 'inventory-weapon';
  if (/(helmet|casque|helm)/.test(haystack)) return 'inventory-helmet';
  if (/(jambiere|jambieres|leggings|greaves|greave|legguard|cuissarde|cuissardes|botte|boots|chausse|chausses)/.test(haystack)) return 'inventory-leggings';
  if (/(armure|armor|armour|cuirasse|plastron|chestplate|breastplate)/.test(haystack)) return 'inventory-armor';
  return kind;
};
const hasEquipmentModelSource = (model = null) => (
  Boolean(model && (getThreeModelSource(model) || model.localModelFileId))
);
const getEquipmentOptionsForSlot = (models = [], slot = {}) => {
  const exactMatches = [];
  const fallbackMatches = [];
  models.forEach((model) => {
    if (inferEquipmentKindFromModel(model) === slot.kind) exactMatches.push(model);
    else fallbackMatches.push(model);
  });
  return [...exactMatches, ...fallbackMatches];
};
const CHARACTER_EQUIPMENT_SCALE_MIN = 0.001;
const CHARACTER_EQUIPMENT_SCALE_MAX = 8;
const CHARACTER_EQUIPMENT_OFFSET_MIN = -2;
const CHARACTER_EQUIPMENT_OFFSET_MAX = 2;
const CHARACTER_EQUIPMENT_HANDS = [
  { id: 'right', label: 'Main droite' },
  { id: 'left', label: 'Main gauche' },
];
const ARMOR_GRIP_POINTS = CHARACTER_RIG_ARMOR_GRIP_POINTS;
const CHARACTER_LOCAL_CONVERSION_QUALITY = 'source-meshopt';
const CHARACTER_ANIMATION_LOCAL_CONVERSION_QUALITY = 'animation-source-v2';
const characterLocalConversionCache = new Map();
const formatDraftNumber = (value) => (Number.isFinite(Number(value)) ? String(Number(value)) : '');
const normalizeDraftNumber = (value = '') => String(value ?? '').trim().replace(',', '.');
const isValidDraftNumber = (value = '') => {
  const normalized = normalizeDraftNumber(value);
  return normalized !== '' && Number.isFinite(Number(normalized));
};
const getStepDecimals = (step = 1) => {
  const stepText = String(step);
  return stepText.includes('.') ? stepText.split('.')[1].length : 0;
};
const formatNumericFieldValue = (value, step = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(getStepDecimals(step));
};
const toCharacterUserAxes = (axisScale = {}) => ({
  x: axisScale.x,
  y: axisScale.z,
  z: axisScale.y,
});

const FieldNumber = ({ label, help, value, min, max, step = 1, onChange }) => {
  const [draft, setDraft] = useState(() => formatNumericFieldValue(value, step));

  useEffect(() => {
    setDraft(formatNumericFieldValue(value, step));
  }, [step, value]);

  const commitDraft = useCallback((rawValue = draft) => {
    if (!isValidDraftNumber(rawValue)) {
      setDraft(formatNumericFieldValue(value, step));
      return;
    }
    const minValue = Number.isFinite(Number(min)) ? Number(min) : -999;
    const maxValue = Number.isFinite(Number(max)) ? Number(max) : 999;
    const nextValue = numberValue(normalizeDraftNumber(rawValue), value, minValue, maxValue);
    setDraft(formatNumericFieldValue(nextValue, step));
    onChange(nextValue);
  }, [draft, max, min, onChange, step, value]);

  return (
    <label className="character3d-number-field">
      <span><CharacterHelpLabel help={help}>{label}</CharacterHelpLabel></span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commitDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitDraft(event.currentTarget.value);
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            setDraft(formatNumericFieldValue(value, step));
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
};

const clampEquipmentNumber = (value, fallback, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
};

const normalizeEquipmentHand = (value = '') => (
  value === 'left' ? 'left' : 'right'
);
const normalizeEquipmentArm = (value = '') => (
  value === 'right' ? 'right' : 'left'
);
const ARMOR_SEGMENT_VALUES = new Set(['body', 'left-arm', 'right-arm']);
const ARMOR_RIG_POINT_IDS = new Set(CHARACTER_RIG_ARMOR_GRIP_POINTS.map((point) => point.rigPointId || point.id));
const getDefaultArmorPieceRigPointId = (segment = 'body') => {
  if (segment === 'left-arm') return 'left-elbow';
  if (segment === 'right-arm') return 'right-elbow';
  return 'lower-belly';
};
const normalizeArmorPieceRigPointId = (value = '', segment = 'body') => {
  const id = String(value || '').trim();
  return ARMOR_RIG_POINT_IDS.has(id) ? id : getDefaultArmorPieceRigPointId(segment);
};
const normalizeArmorPieceId = (value = '') => (
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
);
const normalizeArmorPieceName = (value = '', fallback = '') => {
  const cleanName = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return cleanName || fallback;
};
const normalizeArmorSegmentAssignments = (assignments = []) => (
  Array.isArray(assignments)
    ? assignments.map((entry) => {
      const pieceId = normalizeArmorPieceId(entry?.pieceId);
      const pieceName = normalizeArmorPieceName(entry?.pieceName);
      const segment = ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body';
      return {
        path: String(entry?.path || '').slice(0, 260),
        name: String(entry?.name || '').slice(0, 120),
        segment,
        ...(pieceId ? { pieceId } : {}),
        ...(pieceName ? { pieceName } : {}),
        ...(pieceId ? { rigPointId: normalizeArmorPieceRigPointId(entry?.rigPointId, segment) } : {}),
      };
    }).filter((entry) => entry.path)
    : []
);
const normalizeArmorCustomPieces = (pieces = []) => (
  Array.isArray(pieces)
    ? pieces.map((piece, index) => {
      const id = normalizeArmorPieceId(piece?.id || `piece-${index + 1}`);
      return {
        id,
        name: normalizeArmorPieceName(piece?.name, `Morceau ${index + 1}`),
        segment: ARMOR_SEGMENT_VALUES.has(piece?.segment) ? piece.segment : 'body',
        rigPointId: normalizeArmorPieceRigPointId(piece?.rigPointId, piece?.segment),
      };
    }).filter((piece) => piece.id)
    : []
);
const normalizeArmorCutContourPoint = (point = {}) => ({
  x: clampEquipmentNumber(point?.x, 0, -2, 2),
  y: clampEquipmentNumber(point?.y, 0, -2, 2),
  z: clampEquipmentNumber(point?.z, 0, -2, 2),
  ...normalizeArmorPaintSurfaceNormal(point),
});
const normalizeArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return {};
  const length = Math.hypot(nx, ny, nz);
  if (length <= 0.001) return {};
  return {
    nx: nx / length,
    ny: ny / length,
    nz: nz / length,
  };
};
const normalizeArmorCutContours = (contours = []) => {
  const entries = Array.isArray(contours)
    ? contours
    : Object.entries(contours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body',
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 80)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};
const normalizeArmorCutPaintStrokes = (strokes = []) => {
  const entries = Array.isArray(strokes)
    ? strokes
    : Object.entries(strokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body',
      radius: clampEquipmentNumber(entry?.radius, 0.14, 0.04, 0.5),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 240)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const getEquipmentGripReferenceScale = (source = {}) => {
  const legacyScale = Number.isFinite(Number(source.scale)) && Number(source.scale) > 0 ? Number(source.scale) : 1;
  const dimensions = [
    Number(source.width) || 0,
    Number(source.height) || 0,
    Number(source.depth) || 0,
  ].map((value) => value * legacyScale).filter((value) => Number.isFinite(value) && value > 0.0001);
  if (dimensions.length) return clampEquipmentNumber(Math.max(...dimensions), 1, CHARACTER_EQUIPMENT_SCALE_MIN, 120);
  const explicitScale = Number(source.weaponGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clampEquipmentNumber(explicitScale, 1, CHARACTER_EQUIPMENT_SCALE_MIN, 120)
    : 1;
};
const getShieldGripReferenceScale = (source = {}) => {
  const explicitScale = Number(source.shieldGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clampEquipmentNumber(explicitScale, 1, CHARACTER_EQUIPMENT_SCALE_MIN, 120)
    : getEquipmentGripReferenceScale(source);
};
const getArmorGripReferenceScale = (source = {}) => {
  const explicitScale = Number(source.armorGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clampEquipmentNumber(explicitScale, 1, CHARACTER_EQUIPMENT_SCALE_MIN, 120)
    : getEquipmentGripReferenceScale(source);
};
const getEquipmentModelReferenceScale = (source = {}) => (
  clampEquipmentNumber(
    getEquipmentGripReferenceScale(source),
    1,
    CHARACTER_EQUIPMENT_SCALE_MIN,
    CHARACTER_EQUIPMENT_SCALE_MAX,
  )
);
const getEquipmentModelDimensions = (source = {}) => {
  const legacyScale = Number.isFinite(Number(source.scale)) && Number(source.scale) > 0 ? Number(source.scale) : 1;
  const fallbackScale = getEquipmentModelReferenceScale(source);
  return {
    width: clampEquipmentNumber((Number(source.width) || fallbackScale) * legacyScale, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    height: clampEquipmentNumber((Number(source.height) || fallbackScale) * legacyScale, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    depth: clampEquipmentNumber((Number(source.depth) || fallbackScale) * legacyScale, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
  };
};
const getEquipmentDimensionsScale = (dimensions = {}) => (
  clampEquipmentNumber(
    Math.max(Number(dimensions.width) || 0, Number(dimensions.height) || 0, Number(dimensions.depth) || 0),
    1,
    CHARACTER_EQUIPMENT_SCALE_MIN,
    CHARACTER_EQUIPMENT_SCALE_MAX,
  )
);
const getStoredEquipmentSourceScale = (item = {}) => {
  const sourceScale = Number(item.weaponModelSourceScale);
  return Number.isFinite(sourceScale) && sourceScale > 0
    ? clampEquipmentNumber(sourceScale, 1, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX)
    : 0;
};
const getStoredEquipmentSourceDimensions = (item = {}) => {
  const fallbackScale = getStoredEquipmentSourceScale(item) || getEquipmentDimensionsScale(item);
  return {
    width: clampEquipmentNumber(item.weaponModelSourceWidth, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    height: clampEquipmentNumber(item.weaponModelSourceHeight, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    depth: clampEquipmentNumber(item.weaponModelSourceDepth, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
  };
};
const hasStoredEquipmentSourceDimensions = (item = {}) => (
  Number(item.weaponModelSourceWidth) > 0
  && Number(item.weaponModelSourceHeight) > 0
  && Number(item.weaponModelSourceDepth) > 0
);
const getStoredEquipmentDimensions = (item = {}) => {
  const fallbackScale = clampEquipmentNumber(item.weaponModelScale, 1, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX);
  return {
    width: clampEquipmentNumber(item.weaponModelWidth, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    height: clampEquipmentNumber(item.weaponModelHeight, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    depth: clampEquipmentNumber(item.weaponModelDepth, fallbackScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
  };
};
const resolveEquipmentModelDimensions = (item = {}, source = null) => {
  const currentDimensions = getStoredEquipmentDimensions(item);
  if (!source) return currentDimensions;
  const sourceDimensions = getEquipmentModelDimensions(source);
  if (!hasStoredEquipmentSourceDimensions(item)) {
    const sourceScale = getEquipmentDimensionsScale(sourceDimensions);
    const currentScale = Number(item.weaponModelScale);
    const targetScale = Number.isFinite(currentScale) && currentScale > 0 && Math.abs(currentScale - 1) > 0.0001
      ? clampEquipmentNumber(currentScale, sourceScale, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX)
      : sourceScale;
    const ratio = targetScale / Math.max(CHARACTER_EQUIPMENT_SCALE_MIN, sourceScale);
    return {
      width: clampEquipmentNumber(sourceDimensions.width * ratio, sourceDimensions.width, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
      height: clampEquipmentNumber(sourceDimensions.height * ratio, sourceDimensions.height, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
      depth: clampEquipmentNumber(sourceDimensions.depth * ratio, sourceDimensions.depth, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    };
  }
  const previousSourceDimensions = getStoredEquipmentSourceDimensions(item);
  return {
    width: clampEquipmentNumber(
      sourceDimensions.width * (currentDimensions.width / Math.max(CHARACTER_EQUIPMENT_SCALE_MIN, previousSourceDimensions.width)),
      sourceDimensions.width,
      CHARACTER_EQUIPMENT_SCALE_MIN,
      CHARACTER_EQUIPMENT_SCALE_MAX,
    ),
    height: clampEquipmentNumber(
      sourceDimensions.height * (currentDimensions.height / Math.max(CHARACTER_EQUIPMENT_SCALE_MIN, previousSourceDimensions.height)),
      sourceDimensions.height,
      CHARACTER_EQUIPMENT_SCALE_MIN,
      CHARACTER_EQUIPMENT_SCALE_MAX,
    ),
    depth: clampEquipmentNumber(
      sourceDimensions.depth * (currentDimensions.depth / Math.max(CHARACTER_EQUIPMENT_SCALE_MIN, previousSourceDimensions.depth)),
      sourceDimensions.depth,
      CHARACTER_EQUIPMENT_SCALE_MIN,
      CHARACTER_EQUIPMENT_SCALE_MAX,
    ),
  };
};
const getEquipmentModelRotationValue = (source = {}, axis = 'X') => {
  const modelField = `weaponModelRotation${axis}`;
  if (source[modelField] !== undefined && source[modelField] !== null && source[modelField] !== '') {
    return clampEquipmentNumber(source[modelField], 0, -180, 180);
  }
  return clampEquipmentNumber(source[`modelRotation${axis}`], 0, -180, 180);
};

const copyEquipmentGripFields = (target, source = {}) => {
  if (!target) return target;
  ['X', 'Y', 'Z'].forEach((axis) => {
    target[`weaponModelRotation${axis}`] = getEquipmentModelRotationValue(source, axis);
  });
  target.weaponGripHand = normalizeEquipmentHand(source.weaponGripHand || target.weaponGripHand);
  target.weaponGripReferenceScale = getEquipmentGripReferenceScale(source);
  ['Right', 'Left'].forEach((hand) => {
    target[`weaponGrip${hand}Enabled`] = Boolean(source[`weaponGrip${hand}Enabled`]);
    ['X', 'Y', 'Z'].forEach((axis) => {
      target[`weaponGrip${hand}${axis}`] = clampEquipmentNumber(source[`weaponGrip${hand}${axis}`], 0, -2, 2);
      target[`weaponGrip${hand}Rotation${axis}`] = clampEquipmentNumber(source[`weaponGrip${hand}Rotation${axis}`], 0, -180, 180);
    });
  });
  target.shieldGripArm = normalizeEquipmentArm(source.shieldGripArm || target.shieldGripArm);
  target.shieldGripReferenceScale = getShieldGripReferenceScale(source);
  ['Hand', 'Elbow'].forEach((point) => {
    target[`shieldGrip${point}Enabled`] = Boolean(source[`shieldGrip${point}Enabled`]);
    ['X', 'Y', 'Z'].forEach((axis) => {
      const fallback = point === 'Hand' && axis === 'Y' ? -0.35 : (point === 'Elbow' && axis === 'Y' ? 0.35 : 0);
      target[`shieldGrip${point}${axis}`] = clampEquipmentNumber(source[`shieldGrip${point}${axis}`], fallback, -2, 2);
    });
  });
  target.armorGripReferenceScale = getArmorGripReferenceScale(source);
  ARMOR_GRIP_POINTS.forEach((point) => {
    target[`armorGrip${point.suffix}Enabled`] = Boolean(source[`armorGrip${point.suffix}Enabled`]);
    target[`armorGrip${point.suffix}X`] = clampEquipmentNumber(source[`armorGrip${point.suffix}X`], point.defaultX, -2, 2);
    target[`armorGrip${point.suffix}Y`] = clampEquipmentNumber(source[`armorGrip${point.suffix}Y`], point.defaultY, -2, 2);
    target[`armorGrip${point.suffix}Z`] = clampEquipmentNumber(source[`armorGrip${point.suffix}Z`], point.defaultZ, -2, 2);
  });
  target.armorCanvasCutEnabled = Boolean(source.armorCanvasCutEnabled);
  target.armorFullCharacterRigEnabled = Boolean(source.armorFullCharacterRigEnabled);
  target.armorCustomPieces = normalizeArmorCustomPieces(source.armorCustomPieces);
  target.armorSegmentAssignments = normalizeArmorSegmentAssignments(source.armorSegmentAssignments);
  target.armorCutContours = normalizeArmorCutContours(source.armorCutContours);
  target.armorCutPaintStrokes = normalizeArmorCutPaintStrokes(source.armorCutPaintStrokes);
  return target;
};

const getCharacterEquipmentItem = (model = {}, type = 'weapon') => {
  const item = (Array.isArray(model?.inventory) ? model.inventory : [])
    .find((entry) => entry?.type === type);
  return normalizeCharacterEquipmentItem(item || { type }, type);
};

const normalizeCharacterEquipmentItem = (item = {}, forcedType = '') => {
  const type = CHARACTER_EQUIPMENT_TYPES.has(forcedType)
    ? forcedType
    : (CHARACTER_EQUIPMENT_TYPES.has(item.type) ? item.type : 'weapon');
  return {
    id: item.id || `character-equipment-${type}`,
    name: item.name || getCharacterEquipmentLabel(type),
    type,
    quantity: 1,
    effect: item.effect || '',
    equipped: Boolean(item.equipped),
    weaponModel3dId: item.weaponModel3dId || item.model3dId || '',
    weaponModelUrl: item.weaponModelUrl || item.modelUrl || '',
    weaponModelName: item.weaponModelName || item.modelName || '',
    weaponModelFormat: item.weaponModelFormat || item.modelFormat || '',
    weaponModelFileSize: Number(item.weaponModelFileSize || item.modelFileSize) || 0,
    weaponModelResources: Array.isArray(item.weaponModelResources)
      ? item.weaponModelResources.map((resource) => ({ ...(resource || {}) }))
      : (Array.isArray(item.modelResources) ? item.modelResources.map((resource) => ({ ...(resource || {}) })) : []),
    weaponModelScale: clampEquipmentNumber(item.weaponModelScale, 1, CHARACTER_EQUIPMENT_SCALE_MIN, CHARACTER_EQUIPMENT_SCALE_MAX),
    weaponModelSourceScale: getStoredEquipmentSourceScale(item),
    weaponModelWidth: getStoredEquipmentDimensions(item).width,
    weaponModelHeight: getStoredEquipmentDimensions(item).height,
    weaponModelDepth: getStoredEquipmentDimensions(item).depth,
    weaponModelSourceWidth: getStoredEquipmentSourceDimensions(item).width,
    weaponModelSourceHeight: getStoredEquipmentSourceDimensions(item).height,
    weaponModelSourceDepth: getStoredEquipmentSourceDimensions(item).depth,
    weaponOffsetX: clampEquipmentNumber(item.weaponOffsetX, 0, CHARACTER_EQUIPMENT_OFFSET_MIN, CHARACTER_EQUIPMENT_OFFSET_MAX),
    weaponOffsetY: clampEquipmentNumber(item.weaponOffsetY, 0, CHARACTER_EQUIPMENT_OFFSET_MIN, CHARACTER_EQUIPMENT_OFFSET_MAX),
    weaponOffsetZ: clampEquipmentNumber(item.weaponOffsetZ, 0, CHARACTER_EQUIPMENT_OFFSET_MIN, CHARACTER_EQUIPMENT_OFFSET_MAX),
    weaponRotationX: clampEquipmentNumber(item.weaponRotationX, 0, -180, 180),
    weaponRotationY: clampEquipmentNumber(item.weaponRotationY, 0, -180, 180),
    weaponRotationZ: clampEquipmentNumber(item.weaponRotationZ, 0, -180, 180),
    ...copyEquipmentGripFields({}, item),
  };
};

const applyInventoryModelToEquipmentItem = (item, model = null) => {
  if (!item) return;
  if (!model || !getThreeModelSource(model)) {
    item.equipped = false;
    item.weaponModel3dId = '';
    item.weaponModelUrl = '';
    item.weaponModelName = '';
    item.weaponModelFormat = '';
    item.weaponModelFileSize = 0;
    item.weaponModelResources = [];
    item.weaponModelSourceScale = 0;
    return;
  }
  const sourceScale = getEquipmentModelReferenceScale(model);
  const sourceDimensions = getEquipmentModelDimensions(model);
  item.equipped = true;
  item.weaponModel3dId = model.id || '';
  item.weaponModelUrl = '';
  item.weaponModelName = model.modelName || model.name || item.name || '';
  item.weaponModelFormat = model.modelFormat || '';
  item.weaponModelFileSize = Number(model.modelFileSize) || 0;
  item.weaponModelResources = [];
  item.weaponModelScale = getEquipmentDimensionsScale(sourceDimensions) || sourceScale;
  item.weaponModelSourceScale = sourceScale;
  item.weaponModelWidth = sourceDimensions.width;
  item.weaponModelHeight = sourceDimensions.height;
  item.weaponModelDepth = sourceDimensions.depth;
  item.weaponModelSourceWidth = sourceDimensions.width;
  item.weaponModelSourceHeight = sourceDimensions.height;
  item.weaponModelSourceDepth = sourceDimensions.depth;
  copyEquipmentGripFields(item, model);
};

const resolveEquipmentItemModelSource = (item, model = null) => {
  const sourceScale = model ? getEquipmentModelReferenceScale(model) : getStoredEquipmentSourceScale(item);
  const sourceDimensions = model ? getEquipmentModelDimensions(model) : getStoredEquipmentSourceDimensions(item);
  const resolvedDimensions = resolveEquipmentModelDimensions(item, model);
  return {
    ...item,
    weaponModelUrl: model ? getThreeModelSource(model) : (item.weaponModelUrl || ''),
    weaponModelName: model?.modelName || model?.name || item.weaponModelName || '',
    weaponModelFormat: model?.modelFormat || item.weaponModelFormat || '',
    weaponModelFileSize: Number(model?.modelFileSize || item.weaponModelFileSize) || 0,
    weaponModelResources: Array.isArray(model?.modelResources)
      ? model.modelResources
      : (Array.isArray(item.weaponModelResources) ? item.weaponModelResources : []),
    weaponModelScale: getEquipmentDimensionsScale(resolvedDimensions),
    weaponModelSourceScale: sourceScale,
    weaponModelWidth: resolvedDimensions.width,
    weaponModelHeight: resolvedDimensions.height,
    weaponModelDepth: resolvedDimensions.depth,
    weaponModelSourceWidth: sourceDimensions.width,
    weaponModelSourceHeight: sourceDimensions.height,
    weaponModelSourceDepth: sourceDimensions.depth,
    ...(model ? copyEquipmentGripFields({}, {
      ...model,
      weaponGripHand: item.weaponGripHand || model.weaponGripHand,
      shieldGripArm: item.shieldGripArm || model.shieldGripArm,
    }) : copyEquipmentGripFields({}, item)),
  };
};

const isInventoryModelForEquipmentType = (model = null, type = '') => (
  Boolean(
    model
    && CHARACTER_EQUIPMENT_TYPES.has(type)
    && hasEquipmentModelSource(model),
  )
);

const isEquipmentItemLinkedToInventoryModel = (item = {}, inventoryModelById = new Map()) => {
  const type = CHARACTER_EQUIPMENT_TYPES.has(item?.type) ? item.type : '';
  if (!type) return false;
  const modelId = item.weaponModel3dId || item.model3dId || '';
  if (!modelId) return false;
  return isInventoryModelForEquipmentType(inventoryModelById.get(modelId), type);
};

const clearEquipmentItemModelSource = (item = {}) => ({
  ...item,
  equipped: false,
  weaponModel3dId: '',
  weaponModelUrl: '',
  weaponModelName: '',
  weaponModelFormat: '',
  weaponModelFileSize: 0,
  weaponModelResources: [],
  weaponModelSourceScale: 0,
  weaponModelSourceWidth: 0,
  weaponModelSourceHeight: 0,
  weaponModelSourceDepth: 0,
});

const resolveSelectedEquipmentItemModelSource = (item = {}, inventoryModelById = new Map()) => {
  const normalized = normalizeCharacterEquipmentItem(item, item.type);
  if (!normalized.weaponModel3dId) return clearEquipmentItemModelSource(normalized);
  const inventoryModel = inventoryModelById.get(normalized.weaponModel3dId);
  if (!isInventoryModelForEquipmentType(inventoryModel, normalized.type)) {
    return clearEquipmentItemModelSource(normalized);
  }
  return resolveEquipmentItemModelSource(normalized, inventoryModel);
};

const upsertCharacterEquipmentItem = (model, item) => {
  const normalized = normalizeCharacterEquipmentItem(item, item.type);
  const inventory = (Array.isArray(model.inventory) ? model.inventory : [])
    .filter((entry) => entry?.type !== normalized.type && CHARACTER_EQUIPMENT_TYPES.has(entry?.type))
    .map((entry) => normalizeCharacterEquipmentItem(entry, entry.type));
  if (normalized.weaponModel3dId || normalized.weaponModelUrl) {
    inventory.push({
      ...normalized,
      weaponModelUrl: '',
      weaponModelResources: [],
    });
  }
  model.inventory = inventory;
};

const wait = (durationMs) => new Promise((resolve) => window.setTimeout(resolve, durationMs));

const clampProgressPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const getCharacterLocalConversionCacheKey = (file, quality = CHARACTER_LOCAL_CONVERSION_QUALITY) => [
  quality,
  file?.name || '',
  Number(file?.size) || 0,
  Number(file?.lastModified) || 0,
].join(':');

const getDispositionFilename = (value = '') => {
  const match = String(value).match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1].replace(/^"|"$/g, ''));
  } catch {
    return match[1].replace(/^"|"$/g, '');
  }
};

const getLocalModelToolsApiUrl = (pathSuffix = '') => {
  return `/api/model-tools${pathSuffix}`;
};

const getLocalModelToolsAssetUrl = (pathSuffix = '') => {
  if (!pathSuffix) return '';
  if (/^https?:\/\//i.test(pathSuffix)) return pathSuffix;
  return pathSuffix.startsWith('/api/model-tools') ? pathSuffix : getLocalModelToolsApiUrl(pathSuffix);
};

const getLocalModelToolsApiUrls = (pathSuffix = '') => {
  return [getLocalModelToolsApiUrl(pathSuffix)];
};

const parseModelToolError = async (response) => {
  try {
    const payload = await response.json();
    return payload.error || 'Conversion locale impossible.';
  } catch {
    return 'Conversion locale impossible.';
  }
};

const fetchLocalModelTools = async (pathSuffix = '', options = {}) => {
  let lastError = null;
  for (const url of getLocalModelToolsApiUrls(pathSuffix)) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError?.message ? `API locale 3D indisponible: ${lastError.message}` : 'API locale 3D indisponible. Relance le serveur local puis reessaie.');
};

const parseModelToolXhrError = (xhr) => {
  try {
    const payload = JSON.parse(xhr.responseText || '{}');
    return payload.error || `API locale 3D erreur ${xhr.status || 0}.`;
  } catch {
    return `API locale 3D erreur ${xhr.status || 0}.`;
  }
};

const getModelToolsAuthHeaders = async () => {
  try {
    return await getAdminAuthHeaders();
  } catch {
    return {};
  }
};

const requestModelToolsJsonWithXhr = async (pathSuffix = '', { method = 'GET', body = null, headers = {} } = {}) => {
  const authHeaders = await getModelToolsAuthHeaders();
  return new Promise((resolve, reject) => {
  const urls = getLocalModelToolsApiUrls(pathSuffix);
  const sendToUrl = (urlIndex = 0, lastError = '') => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, urls[urlIndex]);
    xhr.responseType = 'text';
    Object.entries({ ...(headers || {}), ...authHeaders }).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.onerror = () => {
      if (urlIndex + 1 < urls.length) {
        sendToUrl(urlIndex + 1, 'connexion interrompue');
        return;
      }
      reject(new Error(lastError || 'Connexion API locale 3D interrompue.'));
    };
    xhr.ontimeout = () => reject(new Error('API locale 3D trop longue.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(parseModelToolXhrError(xhr)));
        return;
      }
      try {
        resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
      } catch {
        reject(new Error('Reponse locale invalide.'));
      }
    };
    xhr.send(body);
  };
  sendToUrl();
  });
};

const requestModelToolsBlobWithXhr = async (pathSuffix = '') => {
  const authHeaders = await getModelToolsAuthHeaders();
  return new Promise((resolve, reject) => {
  const urls = getLocalModelToolsApiUrls(pathSuffix);
  const sendToUrl = (urlIndex = 0, lastError = '') => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', urls[urlIndex]);
    xhr.responseType = 'blob';
    Object.entries(authHeaders).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.onerror = () => {
      if (urlIndex + 1 < urls.length) {
        sendToUrl(urlIndex + 1, 'connexion interrompue');
        return;
      }
      reject(new Error(lastError || 'Telechargement GLB interrompu.'));
    };
    xhr.ontimeout = () => reject(new Error('Telechargement GLB trop long.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Telechargement GLB impossible (${xhr.status || 0}).`));
        return;
      }
      resolve({
        blob: xhr.response,
        filename: getDispositionFilename(xhr.getResponseHeader('content-disposition')) || 'personnage-fbx-source-meshopt.glb',
        originalSize: Number(xhr.getResponseHeader('x-model-tools-original-size')) || 0,
        outputSize: Number(xhr.getResponseHeader('x-model-tools-output-size')) || xhr.response?.size || 0,
      });
    };
    xhr.send();
  };
  sendToUrl();
  });
};

const getVisibleCharacterSaveStatus = (status = '', hasImportStatus = false) => {
  if (hasImportStatus) return '';
  const message = String(status || '').trim();
  if (!message || message === 'Failed to fetch') return '';
  return message;
};

const requestLocalCharacterConversionJob = ({
  file,
  onProgress,
  uploadLabel = 'Envoi du ZIP FBX',
  quality = CHARACTER_LOCAL_CONVERSION_QUALITY,
  forceConversion = false,
}) => getModelToolsAuthHeaders().then((authHeaders) => new Promise((resolve, reject) => {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('quality', quality);
  if (forceConversion) formData.set('force', 'true');
  const urls = getLocalModelToolsApiUrls('/jobs');

  const sendToUrl = (urlIndex = 0, lastError = '') => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', urls[urlIndex]);
    xhr.responseType = 'text';
    Object.entries(authHeaders).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.(`${uploadLabel}...`, 8);
        return;
      }
      const uploadProgress = 8 + Math.round((event.loaded / Math.max(1, event.total)) * 22);
      onProgress?.(`${uploadLabel}... ${formatBytes(event.loaded)} / ${formatBytes(event.total)}`, uploadProgress);
    };
    xhr.onerror = () => {
      if (urlIndex + 1 < urls.length) {
        sendToUrl(urlIndex + 1, 'connexion interrompue');
        return;
      }
      reject(new Error(lastError || 'API locale 3D indisponible. Relance le serveur local puis reessaie.'));
    };
    xhr.ontimeout = () => reject(new Error('Conversion locale trop longue.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const payload = JSON.parse(xhr.responseText || '{}');
          reject(new Error(payload.error || `Conversion locale impossible (${xhr.status}).`));
        } catch {
          reject(new Error(`Conversion locale impossible (${xhr.status}).`));
        }
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText || '{}'));
      } catch {
        reject(new Error('Reponse locale invalide.'));
      }
    };
    xhr.send(formData);
  };
  sendToUrl();
}));

const requestLocalCharacterCachedJob = async (file, onStatus = () => {}, quality = CHARACTER_LOCAL_CONVERSION_QUALITY) => {
  onStatus('Recherche GLB deja converti...');
  try {
    return await requestModelToolsJsonWithXhr('/jobs/from-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file?.name || '',
        size: Number(file?.size) || 0,
        quality,
      }),
    });
  } catch (error) {
    if (/404/.test(String(error?.message || ''))) return null;
    return null;
  }
};

const requestLatestLocalCharacterCachedJob = async (onStatus = () => {}) => {
  onStatus('Recherche du dernier GLB local...');
  return requestModelToolsJsonWithXhr('/jobs/from-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quality: CHARACTER_LOCAL_CONVERSION_QUALITY,
    }),
  });
};

const fetchLocalCharacterConversionJob = async (jobId) => {
  return requestModelToolsJsonWithXhr(`/jobs/${encodeURIComponent(jobId)}`);
};

const downloadLocalCharacterConversionJob = async (jobId) => {
  const result = await requestModelToolsBlobWithXhr(`/jobs/${encodeURIComponent(jobId)}/download`);
  const blob = result.blob;
  return {
    file: new File([blob], result.filename, { type: 'model/gltf-binary' }),
    originalSize: result.originalSize,
    outputSize: result.outputSize || blob.size || 0,
  };
};

const getCachedCharacterConversionResult = (job = {}) => {
  const cacheUrl = getLocalModelToolsAssetUrl(job.cacheUrl || '');
  if (!cacheUrl) return null;
  return {
    cacheUrl,
    originalSize: Number(job.originalSize) || 0,
    outputSize: Number(job.outputSize) || 0,
    filename: job.filename || 'personnage-fbx-source-meshopt.glb',
    sourceFormat: job.sourceFormat || 'fbx',
    fromCache: Boolean(job.fromCache),
  };
};

const CHARACTER_ANIMATION_LOCAL_CONVERSION_MESSAGES = {
  cachedFileStatus: 'Animation source deja convertie en memoire, liaison locale...',
  missingCacheStatus: 'Conversion Blender de l animation...',
  uploadFailureStatus: 'Envoi animation impossible: tentative dernier GLB local...',
  runningStatus: 'Extraction locale de l animation...',
  cachedUrlStatus: 'Animation convertie, liaison directe...',
  readyStatus: 'Animation source prete, import dans le personnage...',
  uploadLabel: 'Envoi animation 3D',
  allowLatestCacheFallback: false,
  useCachedJob: false,
  forceConversion: true,
  quality: CHARACTER_ANIMATION_LOCAL_CONVERSION_QUALITY,
};

const getCharacterAnimationSlotLabel = (slot = '') => (
  CHARACTER_ANIMATION_SLOTS.find((entry) => entry.id === getAnimationBaseSlotId(slot))?.label || slot
);

const getCharacterAnimationSlot = (slot = '') => (
  CHARACTER_ANIMATION_SLOTS.find((entry) => entry.id === getAnimationBaseSlotId(slot))?.id || ''
);

const makeCharacterAnimationVariantKey = (slot = '', animations = {}) => {
  const baseSlot = getCharacterAnimationSlot(slot);
  if (!baseSlot) return '';
  if (!getAnimationSource(animations?.[baseSlot] || {})) return baseSlot;
  let key = '';
  do {
    key = `${baseSlot}__${Math.random().toString(36).slice(2, 10)}`;
  } while (animations?.[key]);
  return key;
};

const convertCharacterModelWithLocalTool = async (file, onStatus = () => {}, options = {}) => {
  const {
    cachedFileStatus = 'GLB source deja converti, import local...',
    missingCacheStatus = 'Aucun GLB local pour ce ZIP: envoi au convertisseur...',
    uploadFailureStatus = 'Envoi ZIP impossible: tentative dernier GLB local...',
    runningStatus = 'Conversion locale du ZIP FBX...',
    cachedUrlStatus = 'GLB local trouve, liaison directe au canvas...',
    readyStatus = 'GLB interne pret, import dans le personnage...',
    uploadLabel = 'Envoi du ZIP FBX',
    allowLatestCacheFallback = true,
    useCachedJob = true,
    forceConversion = false,
    quality = CHARACTER_LOCAL_CONVERSION_QUALITY,
  } = options;
  const cacheKey = getCharacterLocalConversionCacheKey(file, quality);
  const cachedResult = characterLocalConversionCache.get(cacheKey);
  if (cachedResult?.file) {
    onStatus(cachedFileStatus);
    return cachedResult;
  }
  let jobId = '';
  try {
    let initialJob = useCachedJob ? await requestLocalCharacterCachedJob(file, onStatus, quality) : null;
    if (!initialJob) {
      onStatus(missingCacheStatus);
      try {
        initialJob = await requestLocalCharacterConversionJob({
          file,
          onProgress: onStatus,
          uploadLabel,
          quality,
          forceConversion,
        });
      } catch (error) {
        if (!allowLatestCacheFallback) throw error;
        onStatus(uploadFailureStatus);
        initialJob = await requestLatestLocalCharacterCachedJob(onStatus).catch(() => {
          throw error;
        });
      }
    }
    jobId = initialJob.id || '';
    let job = initialJob;
    while (job?.status === 'running') {
      onStatus(job.label || runningStatus, job.progress);
      await wait(1000);
      job = await fetchLocalCharacterConversionJob(jobId);
    }
    if (job?.status === 'error') {
      throw new Error(job.error || job.detail || 'Conversion locale impossible.');
    }
    if (job?.status !== 'done') {
      throw new Error('Etat de conversion locale inattendu.');
    }
    const cachedConversion = getCachedCharacterConversionResult(job);
    if (cachedConversion) {
      onStatus(cachedUrlStatus, 100);
      return cachedConversion;
    }
    onStatus(readyStatus, 100);
    const result = await downloadLocalCharacterConversionJob(jobId);
    characterLocalConversionCache.set(cacheKey, result);
    if (characterLocalConversionCache.size > 2) {
      const oldestCacheKey = characterLocalConversionCache.keys().next().value;
      characterLocalConversionCache.delete(oldestCacheKey);
    }
    return result;
  } finally {
    if (jobId) {
      requestModelToolsJsonWithXhr(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => {});
    }
  }
};

export default function Character3DTab({
  project,
  patchProject,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  previewEquipmentTest = null,
  onPreviewEquipmentTestClear,
  onSaveAssets,
  localModelScope = null,
  saveStatus,
  saveInProgress = false,
}) {
  const models = project.characterModels3d || [];
  const isSelectionControlled = controlledSelectedModelId !== undefined;
  const [localSelectedModelId, setLocalSelectedModelId] = useState(controlledSelectedModelId || models[0]?.id || '');
  const selectedModelId = isSelectionControlled ? controlledSelectedModelId : localSelectedModelId;
  const setSelectedModelId = useCallback((nextModelId) => {
    setLocalSelectedModelId(nextModelId);
    onSelectedModelIdChange?.(nextModelId);
  }, [onSelectedModelIdChange]);
  const [copyStatus, setCopyStatus] = useState('');
  const [importInProgress, setImportInProgress] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const localModelUrlsRef = useRef(new Map());
  const localAnimationUrlsRef = useRef(new Map());
  const bootstrappedModelRef = useRef(false);
  const [previewAnimationSlot, setPreviewAnimationSlot] = useState('');
  const [embeddedAnimationInfoByModelId, setEmbeddedAnimationInfoByModelId] = useState({});
  const [axisScaleDraft, setAxisScaleDraft] = useState({ modelId: '', x: '', y: '', z: '' });
  const selectPreviewAnimationSlot = useCallback((slot = '') => {
    setPreviewAnimationSlot((current) => (current === slot ? '' : slot));
  }, []);

  useEffect(() => {
    if (!models.length) {
      if (bootstrappedModelRef.current) return;
      bootstrappedModelRef.current = true;
      const next = makeCharacter3DModel({ name: 'Nouveau personnage', role: 'hero', shape: 'glb' });
      patchProject((draft) => {
        const modelList = ensureCharacterModels(draft);
        if (!modelList.length) modelList.push(next);
      });
      setSelectedModelId(next.id);
      return;
    }
    bootstrappedModelRef.current = true;
    if (!models.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(models[0].id);
    }
  }, [models, patchProject, selectedModelId, setSelectedModelId]);

  const selectedModel = models.find((model) => model.id === selectedModelId) || models[0] || null;
  const displaySaveStatus = getVisibleCharacterSaveStatus(saveStatus, Boolean(copyStatus || importInProgress));
  const setImportStatus = useCallback((message, progress = null) => {
    setCopyStatus(message);
    const percent = clampProgressPercent(progress);
    if (percent !== null) setImportProgress(percent);
  }, []);
  const selectedModelSource = selectedModel ? getThreeModelSource(selectedModel) : '';
  const inventoryModels = useMemo(() => (
    (project.decorModels3d || []).filter(hasEquipmentModelSource)
  ), [project.decorModels3d]);
  const inventoryModelById = useMemo(() => (
    new Map(inventoryModels.map((model) => [model.id, model]))
  ), [inventoryModels]);
  const equipmentOptionsByType = useMemo(() => (
    CHARACTER_EQUIPMENT_SLOTS.reduce((next, slot) => {
      next[slot.type] = getEquipmentOptionsForSlot(inventoryModels, slot);
      return next;
    }, {})
  ), [inventoryModels]);
  const previewEquipmentTestItem = useMemo(() => {
    if (!previewEquipmentTest || previewEquipmentTest.characterModelId !== selectedModel?.id) return null;
    const type = CHARACTER_EQUIPMENT_TYPES.has(previewEquipmentTest.type) ? previewEquipmentTest.type : '';
    if (!type) return null;
    const inventoryModel = inventoryModelById.get(previewEquipmentTest.decorModelId);
    if (!isInventoryModelForEquipmentType(inventoryModel, type)) return null;
    const sourceScale = getEquipmentModelReferenceScale(inventoryModel);
    return resolveEquipmentItemModelSource(normalizeCharacterEquipmentItem({
      id: `character-equipment-${type}-rig-test`,
      name: inventoryModel.name || inventoryModel.modelName || getCharacterEquipmentLabel(type),
      type,
      equipped: true,
      weaponModel3dId: inventoryModel.id || '',
      weaponModelScale: sourceScale,
      weaponModelSourceScale: sourceScale,
    }, type), inventoryModel);
  }, [inventoryModelById, previewEquipmentTest, selectedModel?.id]);
  const previewModel = useMemo(() => {
    const baseModel = selectedModel || makeCharacter3DModel({ name: 'Nouveau personnage' });
    let resolvedInventory = (Array.isArray(baseModel.inventory) ? baseModel.inventory : [])
      .map((item) => resolveSelectedEquipmentItemModelSource(item, inventoryModelById))
      .filter((item) => item.equipped && item.weaponModel3dId && item.weaponModelUrl);
    if (previewEquipmentTestItem) {
      resolvedInventory = [
        ...resolvedInventory.filter((item) => item.type !== previewEquipmentTestItem.type),
        previewEquipmentTestItem,
      ];
    }
    return { ...baseModel, inventory: resolvedInventory };
  }, [inventoryModelById, previewEquipmentTestItem, selectedModel]);
  const selectedEquipmentByType = useMemo(() => (
    CHARACTER_EQUIPMENT_SLOTS.reduce((next, slot) => {
      const item = getCharacterEquipmentItem(selectedModel || {}, slot.type);
      next[slot.type] = resolveSelectedEquipmentItemModelSource(item, inventoryModelById);
      if (previewEquipmentTestItem?.type === slot.type) next[slot.type] = previewEquipmentTestItem;
      return next;
    }, {})
  ), [inventoryModelById, previewEquipmentTestItem, selectedModel]);
  const selectedRole = selectedModel?.role || previewModel.role || 'hero';
  const cardRoleOptions = ['enemy', 'hero', 'npc']
    .map((roleId) => ROLE_OPTIONS.find((option) => option.id === roleId))
    .filter(Boolean);
  const canImportRoleGlb = Boolean(selectedModel);

  const hasInvalidCharacterEquipment = useMemo(() => (
    models.some((model) => (
      Array.isArray(model.inventory)
      && model.inventory.some((item) => (
        CHARACTER_EQUIPMENT_TYPES.has(item?.type)
        && !isEquipmentItemLinkedToInventoryModel(item, inventoryModelById)
      ))
    ))
  ), [inventoryModelById, models]);

  useEffect(() => {
    if (!hasInvalidCharacterEquipment) return;
    patchProject((draft) => {
      ensureCharacterModels(draft).forEach((model) => {
        if (!Array.isArray(model.inventory)) return;
        const nextInventory = model.inventory.filter((item) => (
          !CHARACTER_EQUIPMENT_TYPES.has(item?.type)
          || isEquipmentItemLinkedToInventoryModel(item, inventoryModelById)
        ));
        if (nextInventory.length !== model.inventory.length) model.inventory = nextInventory;
      });
    }, { rememberHistory: false });
  }, [hasInvalidCharacterEquipment, inventoryModelById, patchProject]);

  useEffect(() => {
    if (!previewAnimationSlot) return;
    const previewAnimation = selectedModel?.modelAnimations?.[previewAnimationSlot] || {};
    if (!getAnimationBaseSlotId(previewAnimationSlot, previewAnimation) || !getAnimationSource(previewAnimation)) {
      setPreviewAnimationSlot('');
    }
  }, [previewAnimationSlot, selectedModel?.id, selectedModel?.modelAnimations]);

  const patchSelectedModel = useCallback((updater, options) => {
    if (!selectedModelId) return;
    patchProject((draft) => {
      const model = ensureCharacterModels(draft).find((entry) => entry.id === selectedModelId);
      if (model) updater(model);
    }, options);
  }, [patchProject, selectedModelId]);

  const commitSelectedModelAxisScale = useCallback((axisId, rawValue) => {
    if (!selectedModel) return;
    if (!isValidDraftNumber(rawValue)) {
      const axisScale = toCharacterUserAxes(getCharacterModelAxisScale(selectedModel));
      setAxisScaleDraft((current) => ({
        ...current,
        modelId: selectedModel.id || '',
        [axisId]: formatDraftNumber(axisScale[axisId]),
      }));
      return;
    }
    patchSelectedModel((model) => {
      const axisScale = toCharacterUserAxes(getCharacterModelAxisScale(model));
      const nextValue = numberValue(rawValue, axisScale[axisId] || 1, CHARACTER_MODEL_SCALE_MIN, CHARACTER_MODEL_SCALE_MAX);
      const isProportional = isCharacterModelScaleProportional(model);
      const nextAxisScale = isProportional
        ? resizeAxesProportionally(axisScale, axisId, nextValue, CHARACTER_MODEL_SCALE_MIN, CHARACTER_MODEL_SCALE_MAX)
        : { ...axisScale, [axisId]: nextValue };
      model.characterModelScaleX = nextAxisScale.x;
      model.characterModelScaleY = nextAxisScale.z;
      model.characterModelScaleZ = nextAxisScale.y;
      model.characterModelScale = nextAxisScale.z;
    }, { rememberHistory: false });
  }, [patchSelectedModel, selectedModel]);

  const setSelectedModelAxisDraft = useCallback((axisId, rawValue) => {
    setAxisScaleDraft((current) => ({
      ...current,
      modelId: selectedModelId || '',
      [axisId]: rawValue,
    }));
  }, [selectedModelId]);

  const setSelectedModelScaleProportional = useCallback((checked) => {
    patchSelectedModel((model) => {
      model.characterModelScaleProportional = checked;
    }, { rememberHistory: false });
  }, [patchSelectedModel]);

  const setSelectedEquipmentModel = useCallback((type, modelId) => {
    if (previewEquipmentTest?.type === type) onPreviewEquipmentTestClear?.();
    patchSelectedModel((model) => {
      const item = getCharacterEquipmentItem(model, type);
      const inventoryModel = inventoryModelById.get(modelId) || null;
      item.type = type;
      item.name = inventoryModel?.name || inventoryModel?.modelName || getCharacterEquipmentLabel(type);
      applyInventoryModelToEquipmentItem(item, inventoryModel);
      upsertCharacterEquipmentItem(model, item);
    }, { rememberHistory: false });
  }, [inventoryModelById, onPreviewEquipmentTestClear, patchSelectedModel, previewEquipmentTest?.type]);

  useEffect(() => {
    const axisScale = selectedModel ? toCharacterUserAxes(getCharacterModelAxisScale(selectedModel)) : { x: 1, y: 1, z: 1 };
    setAxisScaleDraft({
      modelId: selectedModel?.id || '',
      x: formatDraftNumber(axisScale.x),
      y: formatDraftNumber(axisScale.y),
      z: formatDraftNumber(axisScale.z),
    });
  }, [
    selectedModel?.id,
    selectedModel?.characterModelScale,
    selectedModel?.characterModelScaleX,
    selectedModel?.characterModelScaleY,
    selectedModel?.characterModelScaleZ,
  ]);

  const handlePreviewAnimationClipsLoaded = useCallback((modelId, clips = []) => {
    if (!modelId) return;
    const nextClips = summarizeEmbeddedAnimationClips(clips);
    const nextSignature = getEmbeddedAnimationSignature(nextClips);
    setEmbeddedAnimationInfoByModelId((current) => (
      getEmbeddedAnimationSignature(current[modelId] || []) === nextSignature
        ? current
        : { ...current, [modelId]: nextClips }
    ));
  }, []);

  const applyConvertedCharacterModel = useCallback(async (storedFile, conversionResult = {}) => {
    if (!storedFile || !selectedModelId) return null;
    const previousUrl = localModelUrlsRef.current.get(selectedModelId);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localModelUrlsRef.current.delete(selectedModelId);
    const storedModelFileSize = conversionResult.outputSize || storedFile.size || 0;
    const localModelFileId = createLocalModelFileId('character', selectedModelId, storedFile);
    const modelUrl = URL.createObjectURL(storedFile);
    rememberRpg3DLocalBlobFile(modelUrl, storedFile, localModelFileId, { persist: false });
    const localModelPersisted = await persistLocalModelFile(localModelFileId, storedFile, { scope: localModelScope });
    localModelUrlsRef.current.set(selectedModelId, modelUrl);
    patchSelectedModel((model) => {
      model.shape = 'glb';
      model.modelUrl = modelUrl;
      model.modelData = '';
      model.localModelFileId = localModelPersisted ? localModelFileId : '';
      model.modelName = storedFile.name || 'personnage-source-meshopt.glb';
      model.modelFormat = 'glb';
      model.modelFileSize = storedModelFileSize;
      model.modelResources = [];
    });
    setEmbeddedAnimationInfoByModelId((current) => {
      const next = { ...current };
      delete next[selectedModelId];
      return next;
    });
    return { localModelPersisted, storedModelFileSize };
  }, [localModelScope, patchSelectedModel, selectedModelId]);

  const applyCachedCharacterModelUrl = useCallback((conversionResult = {}) => {
    const cacheUrl = getLocalModelToolsAssetUrl(conversionResult.cacheUrl || '');
    if (!cacheUrl || !selectedModelId) return null;
    const previousUrl = localModelUrlsRef.current.get(selectedModelId);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localModelUrlsRef.current.delete(selectedModelId);
    const storedModelFileSize = Number(conversionResult.outputSize) || 0;
    patchSelectedModel((model) => {
      model.shape = 'glb';
      model.modelUrl = cacheUrl;
      model.modelData = '';
      model.localModelFileId = '';
      model.modelName = conversionResult.filename || 'personnage-source-meshopt.glb';
      model.modelFormat = 'glb';
      model.modelFileSize = storedModelFileSize;
      model.modelResources = [];
    });
    setEmbeddedAnimationInfoByModelId((current) => {
      const next = { ...current };
      delete next[selectedModelId];
      return next;
    });
    return { localModelPersisted: true, storedModelFileSize };
  }, [patchSelectedModel, selectedModelId]);

  const applyConvertedCharacterAnimation = useCallback(async (targetKey, slot, storedFile, conversionResult = {}) => {
    const baseSlot = getCharacterAnimationSlot(slot);
    if (!storedFile || !selectedModelId || !targetKey || !baseSlot) return null;
    const localAnimationKey = `${selectedModelId}:${targetKey}`;
    const previousUrl = localAnimationUrlsRef.current.get(localAnimationKey);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localAnimationUrlsRef.current.delete(localAnimationKey);
    const storedModelFileSize = Number(conversionResult.outputSize) || Number(storedFile.size) || 0;
    const localModelFileId = createLocalModelFileId(`character-animation-${targetKey}`, selectedModelId, storedFile);
    const animationUrl = URL.createObjectURL(storedFile);
    rememberRpg3DLocalBlobFile(animationUrl, storedFile, localModelFileId, { persist: false });
    const localModelPersisted = await persistLocalModelFile(localModelFileId, storedFile, { scope: localModelScope });
    localAnimationUrlsRef.current.set(localAnimationKey, animationUrl);
    patchSelectedModel((model) => {
      model.modelAnimations = {
        ...(model.modelAnimations || {}),
        [targetKey]: {
          animationSlot: baseSlot,
          animationId: targetKey,
          modelUrl: animationUrl,
          modelData: '',
          localModelFileId: localModelPersisted ? localModelFileId : '',
          modelName: storedFile.name || conversionResult.filename || `animation-${baseSlot}.glb`,
          modelFormat: 'glb',
          modelFileSize: storedModelFileSize,
          modelResources: [],
        },
      };
    });
    setPreviewAnimationSlot(targetKey);
    return { localModelPersisted, storedModelFileSize };
  }, [localModelScope, patchSelectedModel, selectedModelId]);

  const applyCachedCharacterAnimationUrl = useCallback((targetKey, slot, conversionResult = {}) => {
    const baseSlot = getCharacterAnimationSlot(slot);
    const cacheUrl = getLocalModelToolsAssetUrl(conversionResult.cacheUrl || '');
    if (!cacheUrl || !selectedModelId || !targetKey || !baseSlot) return null;
    const localAnimationKey = `${selectedModelId}:${targetKey}`;
    const previousUrl = localAnimationUrlsRef.current.get(localAnimationKey);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localAnimationUrlsRef.current.delete(localAnimationKey);
    const storedModelFileSize = Number(conversionResult.outputSize) || 0;
    patchSelectedModel((model) => {
      model.modelAnimations = {
        ...(model.modelAnimations || {}),
        [targetKey]: {
          animationSlot: baseSlot,
          animationId: targetKey,
          modelUrl: cacheUrl,
          modelData: '',
          localModelFileId: '',
          modelName: conversionResult.filename || `animation-${baseSlot}.glb`,
          modelFormat: 'glb',
          modelFileSize: storedModelFileSize,
          modelResources: [],
        },
      };
    });
    setPreviewAnimationSlot(targetKey);
    return { localModelPersisted: true, storedModelFileSize };
  }, [patchSelectedModel, selectedModelId]);

  const importLatestCachedCharacterModel = useCallback(async () => {
    if (!selectedModelId) return;
    setImportInProgress(true);
    setCopyStatus('Recherche GLB local...');
    let jobId = '';
    try {
      const job = await requestLatestLocalCharacterCachedJob(setCopyStatus);
      jobId = job.id || '';
      const cachedConversion = getCachedCharacterConversionResult(job);
      if (cachedConversion) {
        const applyResult = applyCachedCharacterModelUrl(cachedConversion);
        setCopyStatus(`GLB cache lié au canvas (${formatBytes(cachedConversion.outputSize)})`);
        return;
      }
      setCopyStatus('Téléchargement du GLB local...');
      const conversionResult = await downloadLocalCharacterConversionJob(jobId);
      const applyResult = await applyConvertedCharacterModel(conversionResult.file, conversionResult);
      setCopyStatus(`GLB cache chargé: modèle prêt pour le canvas (${formatBytes(conversionResult.outputSize || conversionResult.file.size)})${applyResult?.localModelPersisted ? '' : ' - stockage local non confirmé'}`);
    } catch (error) {
      setCopyStatus(error?.message ? `Cache GLB impossible: ${error.message}` : 'Cache GLB impossible');
    } finally {
      if (jobId) requestModelToolsJsonWithXhr(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => {});
      setImportInProgress(false);
    }
  }, [applyCachedCharacterModelUrl, applyConvertedCharacterModel, selectedModelId]);

  const removeSelectedModelFile = useCallback(() => {
    patchSelectedModel((model) => {
      if (String(model.modelUrl || '').startsWith('blob:')) {
        const previousUrl = localModelUrlsRef.current.get(model.id);
        if (previousUrl) {
          forgetRpg3DLocalBlobFile(previousUrl);
          URL.revokeObjectURL(previousUrl);
        }
        localModelUrlsRef.current.delete(model.id);
      }
      setEmbeddedAnimationInfoByModelId((current) => {
        const next = { ...current };
        delete next[model.id];
        return next;
      });
      model.modelUrl = '';
      model.modelData = '';
      model.localModelFileId = '';
      model.modelName = '';
      model.modelFormat = '';
      model.modelFileSize = 0;
      model.modelResources = [];
      model.modelAnimations = {};
    });
    setPreviewAnimationSlot('');
  }, [patchSelectedModel]);

  const setSelectedModelFile = useCallback(async (file) => {
    if (!file || !selectedModelId) return;
    const fileInfo = getCharacterImportFileInfo(file);
    const { archiveFormat, modelFormat, isZip } = fileInfo;
    if (!modelFormat && !archiveFormat) {
      setCopyStatus('Choisis un fichier .glb, .fbx, .obj ou .zip');
      return;
    }
    if (archiveFormat && archiveFormat !== 'zip') {
      setCopyStatus('Archive 3D non supportée');
      return;
    }
    const previousUrl = localModelUrlsRef.current.get(selectedModelId);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localModelUrlsRef.current.delete(selectedModelId);
    const importLabel = isZip ? 'ZIP' : getThreeModelFormatLabel(modelFormat);
    setImportInProgress(true);
    setImportProgress(3);
    setCopyStatus(isZip ? 'Lecture ZIP...' : `Import ${importLabel}...`);
    try {
      if (isZip) {
        setCopyStatus('ZIP 3D: recherche du GLB local déjà converti...');
        const conversionResult = await convertCharacterModelWithLocalTool(file, setImportStatus);
        if (conversionResult.cacheUrl) {
          const applyResult = applyCachedCharacterModelUrl(conversionResult);
          setCopyStatus(`ZIP accepté: GLB haute qualité lié au canvas (${formatBytes(conversionResult.originalSize || file.size)} -> ${formatBytes(applyResult?.storedModelFileSize || conversionResult.outputSize)})`);
          return;
        }
        const storedFile = conversionResult.file;
        const applyResult = await applyConvertedCharacterModel(storedFile, conversionResult);
        setCopyStatus(`ZIP accepté: GLB haute qualité prêt pour le canvas (${formatBytes(conversionResult.originalSize || file.size)} -> ${formatBytes(applyResult?.storedModelFileSize || storedFile.size)})${applyResult?.localModelPersisted ? '' : ' - stockage local non confirmé'}`);
        return;
      }
      const { readCharacterModelImport } = await import('../utils/rpg3dModelImport');
      const {
        zipBundle,
        sourceFormat,
        isGlb,
        optimizedFile,
        modelData,
        modelFileSize,
      } = await readCharacterModelImport(file, fileInfo);
      if (isZip) setCopyStatus(`ZIP: ${getThreeModelFormatLabel(sourceFormat)} + ${zipBundle.modelResources.length} texture${zipBundle.modelResources.length > 1 ? 's' : ''}`);
      let storedFile = optimizedFile;
      let storedFormat = sourceFormat;
      let storedModelData = modelData || '';
      let storedModelFileSize = modelFileSize;
      let storedResources = zipBundle?.modelResources || [];
      let conversionResult = null;
      if (
        sourceFormat === 'fbx'
        && isHeavyLocalFbxAsset({ modelFormat: sourceFormat, modelUrl: 'blob:local-fbx', modelFileSize })
      ) {
        setCopyStatus(`${isZip ? 'ZIP FBX' : 'FBX'} lourd: conversion locale haute qualité pour le canvas...`);
        conversionResult = await convertCharacterModelWithLocalTool(file, setImportStatus);
        storedFile = conversionResult.file;
        storedFormat = 'glb';
        storedModelData = '';
        storedModelFileSize = conversionResult.outputSize || storedFile.size || 0;
        storedResources = [];
      }
      const localModelFileId = createLocalModelFileId('character', selectedModelId, storedFile);
      const modelUrl = URL.createObjectURL(storedFile);
      rememberRpg3DLocalBlobFile(modelUrl, storedFile, localModelFileId, { persist: false });
      const localModelPersisted = await persistLocalModelFile(localModelFileId, storedFile, { scope: localModelScope });
      localModelUrlsRef.current.set(selectedModelId, modelUrl);
      patchSelectedModel((model) => {
        model.shape = 'glb';
        model.modelUrl = modelUrl;
        model.modelData = storedModelData;
        model.localModelFileId = localModelPersisted ? localModelFileId : '';
        model.modelName = storedFile.name || file.name || `modèle.${storedFormat}`;
        model.modelFormat = storedFormat;
        model.modelFileSize = storedModelFileSize;
        model.modelResources = storedResources;
      });
      setEmbeddedAnimationInfoByModelId((current) => {
        const next = { ...current };
        delete next[selectedModelId];
        return next;
      });
      setCopyStatus(conversionResult
        ? `${isZip ? 'ZIP FBX accepté' : 'FBX accepté'}: GLB haute qualité prêt pour le canvas (${formatBytes(conversionResult.originalSize || file.size)} -> ${formatBytes(storedModelFileSize)})${localModelPersisted ? '' : ' - stockage local non confirmé'}`
        : isGlb
        ? `GLB chargé sans recompression${modelData ? '' : ' en local'}${localModelPersisted ? '' : ' - stockage local non confirmé'}`
        : isZip
          ? `ZIP chargé: ${getThreeModelFormatLabel(sourceFormat)} + ${zipBundle.modelResources.length} texture${zipBundle.modelResources.length > 1 ? 's' : ''}${modelData ? '' : ' en local'}${localModelPersisted ? '' : ' - stockage local non confirmé'}${isHeavyLocalFbxAsset({ modelFormat: sourceFormat, modelUrl, modelFileSize }) ? ' - preview GLB conseillé' : ''}`
          : `${getThreeModelFormatLabel(sourceFormat)} chargé${modelData ? '' : ' en local'}${localModelPersisted ? '' : ' - stockage local non confirmé'}${isHeavyLocalFbxAsset({ modelFormat: sourceFormat, modelUrl, modelFileSize }) ? ' - preview GLB conseillé' : ''}`);
    } catch (error) {
      setCopyStatus(error?.message || 'Import du modèle 3D impossible');
    } finally {
      setImportInProgress(false);
      setImportProgress(null);
    }
  }, [applyCachedCharacterModelUrl, applyConvertedCharacterModel, localModelScope, patchSelectedModel, selectedModelId, setImportStatus]);

  const setSelectedAnimationFile = useCallback(async (slot, file, requestedAnimationKey = '') => {
    const baseSlot = getCharacterAnimationSlot(slot);
    const targetKey = requestedAnimationKey || makeCharacterAnimationVariantKey(baseSlot, selectedModel?.modelAnimations || {});
    if (!file || !selectedModelId || !baseSlot || !targetKey) return;
    const fileInfo = getCharacterImportFileInfo(file);
    const { archiveFormat, modelFormat, isZip } = fileInfo;
    const slotLabel = getCharacterAnimationSlotLabel(baseSlot);
    if (!modelFormat && !archiveFormat) {
      setCopyStatus('Choisis une animation .glb, .fbx ou .zip');
      return;
    }
    if (modelFormat && !['glb', 'fbx'].includes(modelFormat)) {
      setCopyStatus('Choisis une animation .glb, .fbx ou .zip');
      return;
    }
    if (archiveFormat && archiveFormat !== 'zip') {
      setCopyStatus('Archive animation non supportée');
      return;
    }
    const localAnimationKey = `${selectedModelId}:${targetKey}`;
    const previousUrl = localAnimationUrlsRef.current.get(localAnimationKey);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localAnimationUrlsRef.current.delete(localAnimationKey);
    setImportInProgress(true);
    setImportProgress(3);
    setCopyStatus(isZip ? `${slotLabel}: lecture ZIP animation...` : `${slotLabel}: import animation ${getThreeModelFormatLabel(modelFormat)}...`);
    try {
      if (isZip) {
        setCopyStatus(`${slotLabel}: ZIP animation, recherche du GLB local déjà converti...`);
        const conversionResult = await convertCharacterModelWithLocalTool(
          file,
          setImportStatus,
          CHARACTER_ANIMATION_LOCAL_CONVERSION_MESSAGES,
        );
        if (conversionResult.cacheUrl) {
          applyCachedCharacterAnimationUrl(targetKey, baseSlot, conversionResult);
          setCopyStatus(`${slotLabel}: animation ZIP convertie et liée`);
          return;
        }
        const applyResult = await applyConvertedCharacterAnimation(targetKey, baseSlot, conversionResult.file, conversionResult);
        setCopyStatus(`${slotLabel}: animation ZIP convertie et liée${applyResult?.localModelPersisted ? '' : ' - stockage local non confirmé'}`);
        return;
      }
      const { readCharacterAnimationImport } = await import('../utils/rpg3dModelImport');
      const {
        zipBundle,
        sourceFile,
        sourceFormat,
        animationData,
        modelFileSize,
      } = await readCharacterAnimationImport(file, fileInfo);
      let storedFile = sourceFile;
      let storedFormat = sourceFormat;
      let storedAnimationData = animationData || '';
      let storedModelFileSize = modelFileSize;
      let storedResources = zipBundle?.modelResources || [];
      let conversionResult = null;
      if (sourceFormat === 'fbx') {
        setCopyStatus(`${slotLabel}: FBX animation, conversion locale GLB...`);
        conversionResult = await convertCharacterModelWithLocalTool(
          file,
          setImportStatus,
          CHARACTER_ANIMATION_LOCAL_CONVERSION_MESSAGES,
        );
        if (conversionResult.cacheUrl) {
          applyCachedCharacterAnimationUrl(targetKey, baseSlot, conversionResult);
          setCopyStatus(`${slotLabel}: animation FBX convertie et liée`);
          return;
        }
        storedFile = conversionResult.file;
        storedFormat = 'glb';
        storedAnimationData = '';
        storedModelFileSize = Number(conversionResult.outputSize) || Number(storedFile?.size) || 0;
        storedResources = [];
      }
      const localModelFileId = createLocalModelFileId(`character-animation-${targetKey}`, selectedModelId, storedFile);
      const animationUrl = URL.createObjectURL(storedFile);
      rememberRpg3DLocalBlobFile(animationUrl, storedFile, localModelFileId, { persist: false });
      const localModelPersisted = await persistLocalModelFile(localModelFileId, storedFile, { scope: localModelScope });
      localAnimationUrlsRef.current.set(localAnimationKey, animationUrl);
      patchSelectedModel((model) => {
        model.modelAnimations = {
          ...(model.modelAnimations || {}),
          [targetKey]: {
            animationSlot: baseSlot,
            animationId: targetKey,
            modelUrl: animationUrl,
            modelData: storedAnimationData,
            localModelFileId: localModelPersisted ? localModelFileId : '',
            modelName: storedFile.name || file.name || `animation-${baseSlot}.${storedFormat}`,
            modelFormat: storedFormat,
            modelFileSize: storedModelFileSize,
            modelResources: storedResources,
          },
        };
      });
      setPreviewAnimationSlot(targetKey);
      setCopyStatus(conversionResult
        ? `${slotLabel}: animation FBX convertie et liée${localModelPersisted ? '' : ' - stockage local non confirmé'}`
        : `${slotLabel}: animation ${getThreeModelFormatLabel(storedFormat)} chargée${storedAnimationData ? '' : ' en local'}${localModelPersisted ? '' : ' - stockage local non confirmé'}`);
    } catch (error) {
      setCopyStatus(error?.message ? `${slotLabel}: ${error.message}` : `${slotLabel}: import animation impossible`);
    } finally {
      setImportInProgress(false);
      setImportProgress(null);
    }
  }, [applyCachedCharacterAnimationUrl, applyConvertedCharacterAnimation, localModelScope, patchSelectedModel, selectedModel?.modelAnimations, selectedModelId, setImportStatus]);

  const removeSelectedAnimation = useCallback((animationKey) => {
    if (!selectedModelId || !animationKey) return;
    const localAnimationKey = `${selectedModelId}:${animationKey}`;
    const previousUrl = localAnimationUrlsRef.current.get(localAnimationKey);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localAnimationUrlsRef.current.delete(localAnimationKey);
    patchSelectedModel((model) => {
      const nextAnimations = { ...(model.modelAnimations || {}) };
      delete nextAnimations[animationKey];
      model.modelAnimations = nextAnimations;
    });
    setPreviewAnimationSlot((current) => (current === animationKey ? '' : current));
  }, [patchSelectedModel, selectedModelId]);

  const createModel = () => {
    const role = ROLE_OPTIONS.some((option) => option.id === selectedRole) ? selectedRole : 'npc';
    const next = makeCharacter3DModel({ name: `Personnage 3D ${models.length + 1}`, role, shape: 'glb' });
    patchProject((draft) => {
      ensureCharacterModels(draft).push(next);
    });
    setCopyStatus('');
    setSelectedModelId(next.id);
  };

  const deleteModel = () => {
    if (!selectedModel) return;
    const nextModels = models.filter((model) => model.id !== selectedModel.id);
    const previousModelUrl = localModelUrlsRef.current.get(selectedModel.id);
    if (previousModelUrl) {
      forgetRpg3DLocalBlobFile(previousModelUrl);
      URL.revokeObjectURL(previousModelUrl);
      localModelUrlsRef.current.delete(selectedModel.id);
    }
    [...localAnimationUrlsRef.current.keys()]
      .filter((key) => key.startsWith(`${selectedModel.id}:`))
      .forEach((key) => {
        const previousUrl = localAnimationUrlsRef.current.get(key);
        if (previousUrl) {
          forgetRpg3DLocalBlobFile(previousUrl);
          URL.revokeObjectURL(previousUrl);
        }
        localAnimationUrlsRef.current.delete(key);
      });
    setSelectedModelId(nextModels[0]?.id || '');
    setEmbeddedAnimationInfoByModelId((current) => {
      const next = { ...current };
      delete next[selectedModel.id];
      return next;
    });
    patchProject((draft) => {
      draft.characterModels3d = ensureCharacterModels(draft).filter((model) => model.id !== selectedModel.id);
    });
  };

  const showLibraryPanel = false;
  const showInspectorPanel = true;
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const characterTabClassName = [
    'character3d-tab',
    'character3d-tab-with-inspector',
    previewFullscreen ? 'character3d-tab-fullscreen' : '',
    previewFullscreen && previewDrawerOpen ? 'character3d-drawer-open' : '',
  ].filter(Boolean).join(' ');
  const togglePreviewFullscreen = () => {
    setPreviewFullscreen((current) => {
      const next = !current;
      if (!next) setPreviewDrawerOpen(false);
      return next;
    });
  };
  const selectedAxisScale = selectedModel ? toCharacterUserAxes(getCharacterModelAxisScale(selectedModel)) : { x: 1, y: 1, z: 1 };
  const selectedScaleProportional = selectedModel ? isCharacterModelScaleProportional(selectedModel) : true;
  const activeAxisScaleDraft = axisScaleDraft.modelId === (selectedModel?.id || '')
    ? axisScaleDraft
    : {
      modelId: selectedModel?.id || '',
      x: formatDraftNumber(selectedAxisScale.x),
      y: formatDraftNumber(selectedAxisScale.y),
      z: formatDraftNumber(selectedAxisScale.z),
    };

  return (
    <main className={characterTabClassName}>
      {showLibraryPanel ? (
      <section className="panel character3d-library-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Atelier</span>
            <h2>Personnages 3D</h2>
            <p className="small-note">{models.length} modèle{models.length > 1 ? 's' : ''}</p>
          </div>
          <button type="button" className="primary-action" onClick={createModel}>
            <Plus aria-hidden="true" size={16} />
            <span>Personnage</span>
          </button>
        </div>

        <div className="character3d-list" aria-label="Personnages 3D">
          {models.map((model) => {
            const modelRole = ROLE_OPTIONS.find((option) => option.id === model.role) || ROLE_OPTIONS[0];
            const ModelRoleIcon = modelRole.icon;
            return (
              <button
                type="button"
                key={model.id}
                className={`character3d-list-item ${model.id === selectedModelId ? 'selected' : ''}`}
                onClick={() => setSelectedModelId(model.id)}
              >
                <span className="character3d-thumb" style={{ '--character-body': '#2563eb', '--character-accent': '#67e8f9' }}>
                  {getThreeModelSource(model) ? <Cuboid aria-hidden="true" size={20} /> : <ModelRoleIcon aria-hidden="true" size={19} />}
                </span>
                <span>
                  <strong>{model.name || 'Personnage 3D'}</strong>
                  <small>{modelRole.label} - {model.modelName || 'Aucun modèle importé'}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      ) : null}

      <section className="panel character3d-side-card" aria-label="Carte personnage">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Carte</span>
            <h2>{previewModel.name || 'Personnage 3D'}</h2>
          </div>
        </div>
        <div className="character3d-card-role-buttons" role="group" aria-label="Rôle du personnage">
          {cardRoleOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                className={selectedRole === option.id ? 'active' : ''}
                onClick={() => patchSelectedModel((model) => { model.role = option.id; })}
              >
                <OptionIcon aria-hidden="true" size={15} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel character3d-preview-panel">
        <React.Suspense fallback={<div className="character3d-preview-loading" />}>
          <Character3DPreview
            model={previewModel}
            animationSlot={previewAnimationSlot}
            autoPreviewAnimation={false}
            onAnimationClipsLoaded={handlePreviewAnimationClipsLoaded}
          >
            <div className="character3d-preview-head character3d-canvas-overlay">
              <div>
                <span className="section-kicker"><Cuboid size={14} /> Modèle</span>
                <h2>{previewModel.name || 'Personnage 3D'}</h2>
              </div>
              <div className="character3d-preview-actions">
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
                  title={previewFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                  aria-label={previewFullscreen ? 'Quitter le plein écran' : 'Activer le plein écran'}
                  aria-pressed={previewFullscreen}
                  onClick={togglePreviewFullscreen}
                >
                  {previewFullscreen ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
                </button>
              </div>
            </div>
          </Character3DPreview>
        </React.Suspense>
      </section>

      {showInspectorPanel ? (
      <section className="panel character3d-editor-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Réglages</span>
            <h2>{selectedModel ? 'Fiche personnage' : 'Aucun personnage'}</h2>
          </div>
          <div className="character3d-editor-actions">
            <button
              type="button"
              className="secondary-action character3d-new-button"
              aria-label="Nouveau personnage"
              title="Nouveau personnage"
              onClick={createModel}
            >
              <Plus aria-hidden="true" size={15} />
              <span>Nouveau</span>
            </button>
            {onSaveAssets ? (
              <button
                type="button"
                className="secondary-action character3d-save-button"
                aria-label="Sauvegarder personnage"
                title="Sauvegarder personnage"
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
        {saveInProgress ? <div className="character3d-progress character3d-progress-save" role="progressbar" aria-label="Sauvegarde en cours"><span /></div> : null}
        {copyStatus ? <p className="character3d-import-status" role="status">{copyStatus}</p> : null}
        {importInProgress ? (
          <div
            className={`character3d-progress character3d-progress-import ${importProgress !== null ? 'is-determinate' : ''}`}
            role="progressbar"
            aria-label="Import en cours"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={importProgress ?? undefined}
            style={{ '--character3d-progress': `${importProgress ?? 0}%` }}
          >
            <span />
            {importProgress !== null ? <strong>{importProgress}%</strong> : null}
          </div>
        ) : null}

        {selectedModel ? (
          <div className="character3d-form">
            <label>
              <CharacterHelpLabel help={CHARACTER_FIELD_HELP.name}>Nom</CharacterHelpLabel>
              <input value={selectedModel.name || ''} onChange={(event) => patchSelectedModel((model) => { model.name = event.target.value; })} />
            </label>

            {canImportRoleGlb ? (
              <>
                <CharacterHelpLabel help={CHARACTER_FIELD_HELP.glbImport}>Animations</CharacterHelpLabel>
                {!selectedModelSource ? (
                  <label className="button like full secondary-action character3d-file-button">
                    <Upload aria-hidden="true" size={16} />
                    <span>Importer stand-by</span>
                    <input
                      type="file"
                      accept={THREE_MODEL_ACCEPT}
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        setSelectedModelFile(file);
                      }}
                    />
                  </label>
                ) : null}
              </>
            ) : null}

            {selectedModelSource ? (
              <div className="character3d-animation-meta character3d-model-meta">
                <small>{selectedModel.modelName || 'animation 3D'}</small>
                <label className="button like secondary-action compact character3d-file-button">
                  <Upload aria-hidden="true" size={14} />
                  <span>Remplacer</span>
                  <input
                    type="file"
                    accept={THREE_MODEL_ACCEPT}
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      setSelectedModelFile(file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={`secondary-action compact ${previewAnimationSlot ? '' : 'active'}`}
                  aria-pressed={!previewAnimationSlot}
                  onClick={() => selectPreviewAnimationSlot('')}
                >
                  Aperçu
                </button>
                <button type="button" className="secondary-action compact" onClick={removeSelectedModelFile}>
                  Retirer
                </button>
              </div>
            ) : null}

            {selectedModelSource ? (
              <div className="character3d-animation-imports">
                {CHARACTER_ANIMATION_SLOTS.map((slot) => {
                  const animationEntries = getAnimationEntriesForSlot(selectedModel.modelAnimations || {}, slot.id);
                  return (
                    <div className="character3d-animation-row" key={slot.id}>
                      {animationEntries.map(({ key, animation }, index) => (
                        <div className="character3d-animation-meta" key={key}>
                          <small>{animation.modelName || 'animation 3D'}</small>
                          <label className="button like secondary-action compact character3d-file-button">
                            <Upload aria-hidden="true" size={14} />
                            <span>Remplacer</span>
                            <input
                              type="file"
                              accept={THREE_MODEL_ACCEPT}
                              hidden
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                setSelectedAnimationFile(slot.id, file, key);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className={`secondary-action compact ${previewAnimationSlot === key ? 'active' : ''}`}
                            aria-pressed={previewAnimationSlot === key}
                            onClick={() => selectPreviewAnimationSlot(key)}
                          >
                            Aperçu
                          </button>
                          <button type="button" className="secondary-action compact" onClick={() => removeSelectedAnimation(key)}>
                            Retirer
                          </button>
                        </div>
                      ))}
                      <label className="button like full secondary-action character3d-file-button">
                        <Plus aria-hidden="true" size={16} />
                        <span>Ajouter {slot.label.toLowerCase()}</span>
                        <input
                          type="file"
                          accept={THREE_MODEL_ACCEPT}
                          hidden
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            setSelectedAnimationFile(slot.id, file);
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="character3d-equipment-section">
              <CharacterHelpLabel help={CHARACTER_FIELD_HELP.equipment}>Équipement</CharacterHelpLabel>
              <div className="character3d-equipment-grid">
                {CHARACTER_EQUIPMENT_SLOTS.map((slot) => {
                  const SlotIcon = slot.icon;
                  const item = selectedEquipmentByType[slot.type] || getCharacterEquipmentItem(selectedModel, slot.type);
                  const options = equipmentOptionsByType[slot.type] || [];
                  return (
                    <div className={`character3d-equipment-card character3d-equipment-card-${slot.type}`} key={slot.type}>
                      <div className="character3d-equipment-card-head">
                        <SlotIcon aria-hidden="true" size={15} />
                        <strong>{slot.label}</strong>
                      </div>
                      <label>
                        <span>Modèle</span>
                        <select value={item.weaponModel3dId || ''} onChange={(event) => setSelectedEquipmentModel(slot.type, event.target.value)}>
                          <option value="">Aucun</option>
                          {options.map((model) => (
                            <option key={model.id} value={model.id}>{model.name || model.modelName || slot.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="character3d-axis-scale">
              <div className="character3d-axis-scale-head">
                <CharacterHelpLabel help={CHARACTER_FIELD_HELP.characterModelScale}>Taille XYZ</CharacterHelpLabel>
                <label className="character3d-proportional-toggle">
                  <input
                    type="checkbox"
                    checked={selectedScaleProportional}
                    onChange={(event) => setSelectedModelScaleProportional(event.target.checked)}
                  />
                  <span>Proportionnel</span>
                </label>
              </div>
              <div className="character3d-axis-grid">
                {CHARACTER_SCALE_AXES.map(({ id, label }) => (
                  <label key={id}>
                    <span>{label}</span>
                    <input
                      type="number"
                      min={CHARACTER_MODEL_SCALE_MIN}
                      max={CHARACTER_MODEL_SCALE_MAX}
                      step="0.05"
                      value={activeAxisScaleDraft[id]}
                      onChange={(event) => setSelectedModelAxisDraft(id, event.target.value)}
                      onBlur={(event) => commitSelectedModelAxisScale(id, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitSelectedModelAxisScale(id, event.currentTarget.value);
                          event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                          setSelectedModelAxisDraft(id, formatDraftNumber(selectedAxisScale[id]));
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="character3d-light-fields">
              <FieldNumber
                label="Lumière carte"
                help={CHARACTER_FIELD_HELP.materialBrightness}
                min={CHARACTER_MATERIAL_BRIGHTNESS_MIN}
                max={CHARACTER_MATERIAL_BRIGHTNESS_MAX}
                step="0.05"
                value={getCharacterMaterialBrightness(selectedModel)}
                onChange={(value) => patchSelectedModel((model) => { model.materialBrightness = value; }, { rememberHistory: false })}
              />
              <FieldNumber
                label="Lumière aperçu"
                help={CHARACTER_FIELD_HELP.previewLightIntensity}
                min="0.2"
                max="2.5"
                step="0.05"
                value={getPreviewLightIntensity(selectedModel)}
                onChange={(value) => patchSelectedModel((model) => { model.previewLightIntensity = value; }, { rememberHistory: false })}
              />
              <FieldNumber
                label="Orientation lumière"
                help={CHARACTER_FIELD_HELP.previewLightOrientation}
                min="-180"
                max="180"
                step="1"
                value={getPreviewLightOrientation(selectedModel)}
                onChange={(value) => patchSelectedModel((model) => { model.previewLightOrientation = value; }, { rememberHistory: false })}
              />
            </div>
          </div>
        ) : (
          <div className="empty-state-inline">Aucun personnage 3D.</div>
        )}
      </section>
      ) : null}
    </main>
  );
}
