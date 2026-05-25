import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  Activity,
  Brush,
  Cuboid,
  Hand,
  Trash2,
  Undo2,
  Save,
  Scissors,
  UserRound,
  ZoomIn,
} from 'lucide-react';
import {
  getDecorModelDimensions,
} from '../utils/rpg3dModelImportCore.js';
import {
  disposeThreeObject,
} from '../utils/rpg3dModelImport.js';
import {
  getThreeModelSource,
  loadThreeModelFromSource,
} from '../utils/threeGltfUtils';

const Decor3DPreview = React.lazy(() => import('./rpg3d/Decor3DPreview.jsx'));

const SEGMENT_OPTIONS = [
  { id: 'body', label: 'Plastron', shortLabel: 'P' },
  { id: 'left-arm', label: 'Bras gauche', shortLabel: 'G' },
  { id: 'right-arm', label: 'Bras droit', shortLabel: 'D' },
];
const ARMOR_CONTOUR_POINT_LIMIT = 80;
const ARMOR_PAINT_POINT_LIMIT = 240;
const ARMOR_PAINT_RADIUS = 0.14;
const ARMOR_PAINT_RADIUS_MIN = 0.04;
const ARMOR_PAINT_RADIUS_MAX = 0.5;
const ARMOR_PAINT_SIZE_MIN = Math.round(ARMOR_PAINT_RADIUS_MIN * 100);
const ARMOR_PAINT_SIZE_MAX = Math.round(ARMOR_PAINT_RADIUS_MAX * 100);

const ARMOR_GRIP_MARKERS = [
  { id: 'left-shoulder', suffix: 'LeftShoulder', defaultX: -0.45, defaultY: 0.55, defaultZ: 0 },
  { id: 'right-shoulder', suffix: 'RightShoulder', defaultX: 0.45, defaultY: 0.55, defaultZ: 0 },
  { id: 'left-elbow', suffix: 'LeftElbow', defaultX: -0.65, defaultY: 0.05, defaultZ: 0 },
  { id: 'right-elbow', suffix: 'RightElbow', defaultX: 0.65, defaultY: 0.05, defaultZ: 0 },
  { id: 'lower-belly', suffix: 'LowerBelly', defaultX: 0, defaultY: -0.55, defaultZ: 0 },
];

const ARMOR_GRIP_DEFAULTS = {
  armorGripLeftShoulderEnabled: true,
  armorGripLeftShoulderX: -0.45,
  armorGripLeftShoulderY: 0.55,
  armorGripLeftShoulderZ: 0,
  armorGripRightShoulderEnabled: true,
  armorGripRightShoulderX: 0.45,
  armorGripRightShoulderY: 0.55,
  armorGripRightShoulderZ: 0,
  armorGripLeftElbowEnabled: true,
  armorGripLeftElbowX: -0.65,
  armorGripLeftElbowY: 0.05,
  armorGripLeftElbowZ: 0,
  armorGripRightElbowEnabled: true,
  armorGripRightElbowX: 0.65,
  armorGripRightElbowY: 0.05,
  armorGripRightElbowZ: 0,
  armorGripLowerBellyEnabled: true,
  armorGripLowerBellyX: 0,
  armorGripLowerBellyY: -0.55,
  armorGripLowerBellyZ: 0,
};

const normalizeRigObjectName = (name = '') => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getRigNodePath = (object = null, root = null) => {
  if (!object || !root) return '';
  const parts = [];
  let cursor = object;
  while (cursor && cursor !== root) {
    const parent = cursor.parent;
    const index = parent?.children ? parent.children.indexOf(cursor) : -1;
    const name = normalizeRigObjectName(cursor.name || cursor.type || 'node') || 'node';
    parts.unshift(`${Math.max(0, index)}:${name}`);
    cursor = parent;
  }
  return parts.join('/');
};

const normalizeSegment = (value = '') => (
  SEGMENT_OPTIONS.some((option) => option.id === value) ? value : 'body'
);

const normalizeAssignments = (assignments = []) => (
  Array.isArray(assignments)
    ? assignments.map((entry) => ({
      path: String(entry?.path || '').slice(0, 260),
      name: String(entry?.name || '').slice(0, 120),
      segment: normalizeSegment(entry?.segment),
    })).filter((entry) => entry.path)
    : []
);

const normalizeContourPoint = (point = {}) => ({
  x: Math.round(THREE.MathUtils.clamp(Number(point.x) || 0, -2, 2) * 1000) / 1000,
  y: Math.round(THREE.MathUtils.clamp(Number(point.y) || 0, -2, 2) * 1000) / 1000,
  z: Math.round(THREE.MathUtils.clamp(Number(point.z) || 0, -2, 2) * 1000) / 1000,
  ...normalizePaintSurfaceNormal(point),
});

const normalizePaintSurfaceNormal = (point = {}) => {
  const nx = Number(point.nx);
  const ny = Number(point.ny);
  const nz = Number(point.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return {};
  const length = Math.hypot(nx, ny, nz);
  if (length <= 0.001) return {};
  return {
    nx: Math.round((nx / length) * 1000) / 1000,
    ny: Math.round((ny / length) * 1000) / 1000,
    nz: Math.round((nz / length) * 1000) / 1000,
  };
};

const normalizeArmorPaintRadius = (value = ARMOR_PAINT_RADIUS) => (
  Math.round(THREE.MathUtils.clamp(
    Number(value) || ARMOR_PAINT_RADIUS,
    ARMOR_PAINT_RADIUS_MIN,
    ARMOR_PAINT_RADIUS_MAX,
  ) * 100) / 100
);

const normalizeArmorCutContours = (contours = []) => {
  const entries = Array.isArray(contours)
    ? contours
    : Object.entries(contours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeSegment(entry?.segment),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, ARMOR_CONTOUR_POINT_LIMIT)
        .map(normalizeContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const getContourPoints = (contours = [], segmentId = 'body') => (
  normalizeArmorCutContours(contours)
    .find((entry) => entry.segment === normalizeSegment(segmentId))?.points || []
);

const patchContourEntries = (contours = [], segmentId = 'body', points = []) => {
  const segment = normalizeSegment(segmentId);
  const map = new Map(normalizeArmorCutContours(contours).map((entry) => [entry.segment, entry]));
  const nextPoints = points.slice(0, ARMOR_CONTOUR_POINT_LIMIT).map(normalizeContourPoint);
  if (nextPoints.length) map.set(segment, { segment, points: nextPoints });
  else map.delete(segment);
  return [...map.values()];
};

const normalizeArmorCutPaintStrokes = (strokes = []) => {
  const entries = Array.isArray(strokes)
    ? strokes
    : Object.entries(strokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeSegment(entry?.segment),
      radius: normalizeArmorPaintRadius(entry?.radius),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, ARMOR_PAINT_POINT_LIMIT)
        .map(normalizeContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const getPaintStroke = (strokes = [], segmentId = 'body') => (
  normalizeArmorCutPaintStrokes(strokes)
    .find((entry) => entry.segment === normalizeSegment(segmentId))
);

const getPaintPoints = (strokes = [], segmentId = 'body') => getPaintStroke(strokes, segmentId)?.points || [];

const patchPaintEntries = (strokes = [], segmentId = 'body', points = [], radius = ARMOR_PAINT_RADIUS) => {
  const segment = normalizeSegment(segmentId);
  const map = new Map(normalizeArmorCutPaintStrokes(strokes).map((entry) => [entry.segment, entry]));
  const previous = map.get(segment);
  const nextPoints = points.slice(-ARMOR_PAINT_POINT_LIMIT).map(normalizeContourPoint);
  const nextRadius = normalizeArmorPaintRadius(radius ?? previous?.radius ?? ARMOR_PAINT_RADIUS);
  if (nextPoints.length) {
    map.set(segment, {
      segment,
      radius: nextRadius,
      points: nextPoints,
    });
  } else {
    map.delete(segment);
  }
  return [...map.values()];
};

const getAssignmentMap = (model = {}) => new Map(
  normalizeAssignments(model.armorSegmentAssignments).map((entry) => [entry.path, entry]),
);

const getArmorGripValue = (model = {}, suffix = '', axis = 'X', fallback = 0) => {
  const value = Number(model[`armorGrip${suffix}${axis}`]);
  return Number.isFinite(value) ? value : fallback;
};

const getArmorGripMarkers = (model = null) => (
  model
    ? ARMOR_GRIP_MARKERS.map((marker) => ({
      id: marker.id,
      enabled: model[`armorGrip${marker.suffix}Enabled`] !== false,
      x: getArmorGripValue(model, marker.suffix, 'X', marker.defaultX),
      y: getArmorGripValue(model, marker.suffix, 'Y', marker.defaultY),
      z: getArmorGripValue(model, marker.suffix, 'Z', marker.defaultZ),
      defaultX: marker.defaultX,
      defaultY: marker.defaultY,
      defaultZ: marker.defaultZ,
    }))
    : []
);

const getModelReferenceScale = (model = {}) => {
  const dimensions = getDecorModelDimensions(model);
  return Math.max(
    1,
    Number(dimensions.x) || 0,
    Number(dimensions.y) || 0,
    Number(dimensions.z) || 0,
  );
};

const inferSegment = (mesh = {}, center = new THREE.Vector3()) => {
  const name = normalizeRigObjectName(mesh.name || mesh.path || '');
  if (/(left|larm|lshoulder|gauche|brasgauche|epaulegauche|pauldrong)/.test(name)) return 'left-arm';
  if (/(right|rarm|rshoulder|droite|brasdroit|epauledroite|pauldrond)/.test(name)) return 'right-arm';
  if (/(pauldron|shoulder|bracer|brassard|upperarm|forearm|sleeve|manche|elbow|coude)/.test(name)) {
    return center.x < 0 ? 'left-arm' : 'right-arm';
  }
  if (Math.abs(center.x) > 0.42 && center.y > -0.25) return center.x < 0 ? 'left-arm' : 'right-arm';
  return 'body';
};

const extractMeshNodes = (object = null) => {
  if (!object?.traverse) return [];
  object.updateMatrixWorld(true);
  const nodes = [];
  object.traverse((child) => {
    if (child === object || (!child.isMesh && !child.isSkinnedMesh)) return;
    const box = new THREE.Box3().setFromObject(child);
    const size = box.getSize(new THREE.Vector3());
    const center = object.worldToLocal(box.getCenter(new THREE.Vector3()));
    const path = getRigNodePath(child, object);
    nodes.push({
      path,
      name: child.name || child.parent?.name || 'Morceau',
      center: { x: center.x, y: center.y, z: center.z },
      size: { x: size.x, y: size.y, z: size.z },
    });
  });
  return nodes.sort((a, b) => a.path.localeCompare(b.path));
};

const ensureDecorModels = (draft) => {
  if (!Array.isArray(draft.decorModels3d)) draft.decorModels3d = [];
  return draft.decorModels3d;
};

const ensureArmorRigDefaults = (model = {}) => {
  model.kind = 'inventory-armor';
  model.armorGripReferenceScale = model.armorGripReferenceScale || getModelReferenceScale(model);
  Object.entries(ARMOR_GRIP_DEFAULTS).forEach(([key, value]) => {
    if (model[key] === undefined || model[key] === null || model[key] === '') {
      model[key] = value;
    }
  });
};

export default function ObjectRiggingTab({
  project,
  patchProject,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  onSaveAssets,
  onTestOnCharacter,
  saveStatus = '',
  saveInProgress = false,
}) {
  const decorModels = useMemo(() => (
    (project.decorModels3d || []).filter((model) => getThreeModelSource(model))
  ), [project.decorModels3d]);
  const characterModels = useMemo(() => (
    (project.characterModels3d || []).filter((model) => getThreeModelSource(model))
  ), [project.characterModels3d]);
  const [localSelectedModelId, setLocalSelectedModelId] = useState(controlledSelectedModelId || decorModels[0]?.id || '');
  const selectedModelId = controlledSelectedModelId ?? localSelectedModelId;
  const [selectedCharacterId, setSelectedCharacterId] = useState(characterModels[0]?.id || '');
  const [meshNodes, setMeshNodes] = useState([]);
  const [loadStatus, setLoadStatus] = useState('');
  const [activeSegment, setActiveSegment] = useState('body');
  const [canvasInteractionMode, setCanvasInteractionMode] = useState('cut');
  const [paintBrushRadii, setPaintBrushRadii] = useState({});
  const [cameraZoomPercent, setCameraZoomPercent] = useState(100);

  useEffect(() => {
    if (!decorModels.length) return;
    if (!decorModels.some((model) => model.id === selectedModelId)) {
      const nextId = decorModels[0].id;
      setLocalSelectedModelId(nextId);
      onSelectedModelIdChange?.(nextId);
    }
  }, [decorModels, onSelectedModelIdChange, selectedModelId]);

  useEffect(() => {
    if (!characterModels.length) return;
    if (!characterModels.some((model) => model.id === selectedCharacterId)) {
      setSelectedCharacterId(characterModels[0].id);
    }
  }, [characterModels, selectedCharacterId]);

  const selectedModel = decorModels.find((model) => model.id === selectedModelId) || decorModels[0] || null;
  const selectedCharacter = characterModels.find((model) => model.id === selectedCharacterId) || characterModels[0] || null;
  const assignmentMap = useMemo(() => getAssignmentMap(selectedModel || {}), [selectedModel]);
  const armorCutContours = useMemo(() => normalizeArmorCutContours(selectedModel?.armorCutContours), [selectedModel]);
  const armorCutPaintStrokes = useMemo(() => normalizeArmorCutPaintStrokes(selectedModel?.armorCutPaintStrokes), [selectedModel]);
  const activePaintStroke = useMemo(
    () => getPaintStroke(armorCutPaintStrokes, activeSegment),
    [activeSegment, armorCutPaintStrokes],
  );
  const activePaintPoints = useMemo(
    () => activePaintStroke?.points || [],
    [activePaintStroke],
  );
  const activePaintRadius = normalizeArmorPaintRadius(
    paintBrushRadii[activeSegment] ?? activePaintStroke?.radius ?? ARMOR_PAINT_RADIUS,
  );
  const activePaintSize = Math.round(activePaintRadius * 100);
  const armorGripMarkers = useMemo(() => getArmorGripMarkers(selectedModel), [selectedModel]);
  const canvasCutEnabled = Boolean(selectedModel?.armorCanvasCutEnabled);
  const canvasManipulationEnabled = canvasCutEnabled && canvasInteractionMode === 'manipulate';
  const canvasPaintEnabled = canvasCutEnabled && canvasInteractionMode === 'paint';
  const canvasZoomEnabled = canvasInteractionMode === 'zoom';

  useEffect(() => {
    if (!canvasCutEnabled && (canvasInteractionMode === 'paint' || canvasInteractionMode === 'manipulate')) {
      setCanvasInteractionMode('cut');
    }
  }, [canvasCutEnabled, canvasInteractionMode]);

  const setSelectedModelId = (nextId) => {
    setLocalSelectedModelId(nextId);
    onSelectedModelIdChange?.(nextId);
  };

  const patchSelectedModel = (updater) => {
    if (!selectedModel?.id) return;
    patchProject((draft) => {
      const model = ensureDecorModels(draft).find((entry) => entry.id === selectedModel.id);
      if (model) updater(model);
    });
  };

  useEffect(() => {
    const source = selectedModel ? getThreeModelSource(selectedModel) : '';
    if (!selectedModel || !source) {
      setMeshNodes([]);
      setLoadStatus('Aucun objet 3D');
      return undefined;
    }
    let cancelled = false;
    setLoadStatus('Lecture du modele...');
    setMeshNodes([]);
    loadThreeModelFromSource(
      source,
      selectedModel,
      ({ object } = {}) => {
        if (cancelled) {
          if (object) disposeThreeObject(object);
          return;
        }
        const nodes = extractMeshNodes(object);
        setMeshNodes(nodes);
        setLoadStatus(nodes.length ? `${nodes.length} morceau${nodes.length > 1 ? 'x' : ''}` : 'Aucun mesh separe');
        if (object) disposeThreeObject(object);
      },
      (error) => {
        if (cancelled) return;
        setMeshNodes([]);
        setLoadStatus(error?.message || 'Modele non lisible');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedModel]);

  const setNodeSegment = (node, segment) => {
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model);
      model.armorCanvasCutEnabled = true;
      const map = new Map(normalizeAssignments(model.armorSegmentAssignments).map((entry) => [entry.path, entry]));
      map.set(node.path, {
        path: node.path,
        name: node.name,
        segment: normalizeSegment(segment),
      });
      model.armorSegmentAssignments = [...map.values()];
    });
  };

  const applyArmorSkeleton = () => {
    patchSelectedModel((model) => {
      Object.assign(model, {
        ...ARMOR_GRIP_DEFAULTS,
        kind: 'inventory-armor',
        armorGripReferenceScale: model.armorGripReferenceScale || getModelReferenceScale(model),
      });
    });
  };

  const applyCanvasCut = () => {
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model);
      model.armorCanvasCutEnabled = true;
      model.armorSegmentAssignments = meshNodes.length > 1
        ? meshNodes.map((node) => ({
          path: node.path,
          name: node.name,
          segment: inferSegment(node, node.center),
        }))
        : [];
    });
    setLoadStatus(meshNodes.length > 1 ? 'Morceaux decoupes dans le canevas.' : 'Zones colorees activees dans le canevas.');
  };

  const setPaintMode = () => {
    if (!selectedModel) return;
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model);
      model.armorCanvasCutEnabled = true;
      model.armorCutPaintStrokes = normalizeArmorCutPaintStrokes(model.armorCutPaintStrokes);
    });
    setCanvasInteractionMode('paint');
  };

  const updateArmorCutContour = (segmentId = activeSegment, action = {}) => {
    const segment = normalizeSegment(segmentId);
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model);
      model.armorCanvasCutEnabled = true;
      const previous = getContourPoints(model.armorCutContours, segment);
      let nextPoints = previous;
      if (action?.action === 'clear') {
        nextPoints = [];
      } else if (action?.action === 'undo') {
        nextPoints = previous.slice(0, -1);
      } else if (action?.action === 'replace') {
        nextPoints = Array.isArray(action.points) ? action.points : [];
      } else if (action?.action === 'append' && Array.isArray(action.points)) {
        nextPoints = [...previous, ...action.points];
      } else if (action?.point) {
        nextPoints = [...previous, action.point];
      }
      model.armorCutContours = patchContourEntries(model.armorCutContours, segment, nextPoints);
    });
  };

  const updateArmorCutPaint = (segmentId = activeSegment, action = {}) => {
    const segment = normalizeSegment(segmentId);
    const radius = normalizeArmorPaintRadius(action?.radius ?? activePaintRadius);
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model);
      model.armorCanvasCutEnabled = true;
      const previous = getPaintPoints(model.armorCutPaintStrokes, segment);
      let nextPoints = previous;
      if (action?.action === 'clear') {
        nextPoints = [];
      } else if (action?.action === 'undo') {
        nextPoints = previous.slice(0, -1);
      } else if (action?.action === 'replace') {
        nextPoints = Array.isArray(action.points) ? action.points : [];
      } else if (action?.action === 'append' && Array.isArray(action.points)) {
        nextPoints = [...previous, ...action.points];
      } else if (action?.point) {
        nextPoints = [...previous, action.point];
      }
      model.armorCutPaintStrokes = patchPaintEntries(model.armorCutPaintStrokes, segment, nextPoints, radius);
    });
  };

  const updateArmorPaintRadius = (value) => {
    const radius = normalizeArmorPaintRadius(value);
    setPaintBrushRadii((previous) => ({
      ...previous,
      [activeSegment]: radius,
    }));
    if (activePaintPoints.length) {
      updateArmorCutPaint(activeSegment, { action: 'radius', radius });
    }
  };

  const updateArmorPaintSize = (value) => {
    const nextSize = THREE.MathUtils.clamp(
      Math.round(Number(value) || activePaintSize),
      ARMOR_PAINT_SIZE_MIN,
      ARMOR_PAINT_SIZE_MAX,
    );
    updateArmorPaintRadius(nextSize / 100);
  };

  const updateArmorGripMarker = (markerId, position = {}) => {
    const marker = ARMOR_GRIP_MARKERS.find((entry) => entry.id === markerId);
    if (!marker) return;
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model);
      model.armorCanvasCutEnabled = true;
      model[`armorGrip${marker.suffix}Enabled`] = true;
      model[`armorGrip${marker.suffix}X`] = position.x;
      model[`armorGrip${marker.suffix}Y`] = position.y;
      model[`armorGrip${marker.suffix}Z`] = position.z;
    });
  };

  const handleCanvasMeshPick = (node = {}) => {
    if (canvasManipulationEnabled || canvasPaintEnabled || canvasZoomEnabled) return;
    if (!node.path) return;
    if (meshNodes.length <= 1) {
      applyCanvasCut();
      return;
    }
    const knownNode = meshNodes.find((entry) => entry.path === node.path) || node;
    setNodeSegment(knownNode, activeSegment);
  };

  const testOnCharacter = () => {
    if (!selectedModel?.id || !selectedCharacter?.id) return;
    onTestOnCharacter?.({
      decorModelId: selectedModel.id,
      characterModelId: selectedCharacter.id,
    });
  };

  const singleMeshCanvasCut = canvasCutEnabled && meshNodes.length <= 1;
  const assignedCounts = singleMeshCanvasCut
    ? SEGMENT_OPTIONS.reduce((counts, segment) => ({ ...counts, [segment.id]: 1 }), {})
    : meshNodes.reduce((counts, node) => {
      const segment = assignmentMap.get(node.path)?.segment || inferSegment(node, node.center);
      counts[segment] = (counts[segment] || 0) + 1;
      return counts;
    }, {});
  const getSegmentCountLabel = (segmentId) => (
    singleMeshCanvasCut ? 'visible' : `${assignedCounts[segmentId] || 0}`
  );

  const previewModel = selectedModel && getThreeModelSource(selectedModel) ? selectedModel : null;

  return (
    <main className="object-rigging-tab">
      <section className="panel object-rigging-controls">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker"><Cuboid size={14} /> Rig 3D</span>
            <h2>Assemblage objets</h2>
          </div>
          <button type="button" className="primary-action" onClick={onSaveAssets} disabled={saveInProgress}>
            <Save aria-hidden="true" size={16} />
            <span>{saveInProgress ? 'Sauvegarde...' : 'Sauver'}</span>
          </button>
        </div>
        <label>
          <span>Objet</span>
          <select value={selectedModel?.id || ''} onChange={(event) => setSelectedModelId(event.target.value)}>
            {decorModels.map((model) => (
              <option key={model.id} value={model.id}>{model.name || model.modelName || 'Objet 3D'}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Personnage test</span>
          <select value={selectedCharacter?.id || ''} onChange={(event) => setSelectedCharacterId(event.target.value)}>
            {characterModels.map((model) => (
              <option key={model.id} value={model.id}>{model.name || model.modelName || 'Personnage 3D'}</option>
            ))}
          </select>
        </label>
        <div className="object-rigging-actions">
          <button type="button" className="secondary-action" onClick={applyArmorSkeleton} disabled={!selectedModel}>
            <Activity aria-hidden="true" size={16} />
            <span>Squelette armure</span>
          </button>
          <button type="button" className="secondary-action" onClick={applyCanvasCut} disabled={!selectedModel}>
            <Scissors aria-hidden="true" size={16} />
            <span>{canvasCutEnabled ? 'Revoir coupe' : 'Decouper'}</span>
          </button>
          <button
            type="button"
            className={canvasPaintEnabled ? 'secondary-action active' : 'secondary-action'}
            onClick={setPaintMode}
            disabled={!selectedModel}
          >
            <Brush aria-hidden="true" size={16} />
            <span>Peindre zone</span>
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={testOnCharacter}
            disabled={!selectedModel || !selectedCharacter || !onTestOnCharacter}
          >
            <UserRound aria-hidden="true" size={16} />
            <span>Tester sur personnage</span>
          </button>
        </div>
        <p className="small-note">{saveStatus || loadStatus}</p>
        <div className="object-rigging-stats">
          {SEGMENT_OPTIONS.map((segment) => (
            <span key={segment.id}>{segment.label}: {getSegmentCountLabel(segment.id)}</span>
          ))}
        </div>
        <div className="object-rigging-contour-tools">
          <span>
            Peinture {SEGMENT_OPTIONS.find((segment) => segment.id === activeSegment)?.shortLabel || 'P'}:
            {' '}
            {activePaintPoints.length} touche{activePaintPoints.length > 1 ? 's' : ''}
          </span>
          <label className="object-rigging-brush-size" title="Taille du pinceau">
            <span>Taille</span>
            <input
              aria-label="Taille pinceau"
              type="number"
              min={ARMOR_PAINT_SIZE_MIN}
              max={ARMOR_PAINT_SIZE_MAX}
              step="1"
              value={activePaintSize}
              onChange={(event) => updateArmorPaintSize(event.target.value)}
            />
          </label>
          <div className="object-rigging-contour-actions">
            <button
              type="button"
              aria-label="Annuler"
              className="secondary-action"
              onClick={() => updateArmorCutPaint(activeSegment, { action: 'undo' })}
              disabled={!activePaintPoints.length}
              title="Retirer la derniere touche"
            >
              <Undo2 aria-hidden="true" size={15} />
            </button>
            <button
              type="button"
              aria-label="Effacer"
              className="secondary-action"
              onClick={() => updateArmorCutPaint(activeSegment, { action: 'clear' })}
              disabled={!activePaintPoints.length}
              title="Effacer la peinture active"
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
      </section>

      <section className="panel object-rigging-preview-panel">
        <React.Suspense fallback={<div className="decor3d-preview-loading" />}>
          {previewModel ? (
            <Decor3DPreview
              armorCanvasCutEnabled={canvasCutEnabled}
              armorCutManipulationEnabled={canvasManipulationEnabled}
              armorCutContours={armorCutContours}
              armorCutPaintStrokes={armorCutPaintStrokes}
              armorGripMarkers={armorGripMarkers}
              onArmorCutContourChange={updateArmorCutContour}
              onArmorCutPaintChange={updateArmorCutPaint}
              model={previewModel}
              onArmorGripMarkerChange={updateArmorGripMarker}
              onRigMeshPick={handleCanvasMeshPick}
              armorPaintDrawEnabled={canvasPaintEnabled}
              cameraZoomDragEnabled={canvasZoomEnabled}
              onCameraZoomChange={setCameraZoomPercent}
              rigMeshPickEnabled={!canvasManipulationEnabled && !canvasPaintEnabled && !canvasZoomEnabled}
              rigActiveSegment={activeSegment}
              armorPaintBrushRadius={activePaintRadius}
            >
              <div className="object-rigging-canvas-hud decor3d-canvas-overlay">
                <div>
                  <span className="section-kicker"><Cuboid size={14} /> Objet</span>
                  <h2>{selectedModel?.name || selectedModel?.modelName || 'Objet 3D'}</h2>
                </div>
                <div className="object-rigging-segment-pills" aria-label="Segment actif">
                  {SEGMENT_OPTIONS.map((segment) => (
                    <button
                      aria-pressed={activeSegment === segment.id}
                      className={activeSegment === segment.id ? 'active' : ''}
                      key={segment.id}
                      onClick={() => {
                        setActiveSegment(segment.id);
                        if (canvasInteractionMode !== 'paint') setCanvasInteractionMode('cut');
                      }}
                      type="button"
                    >
                      <b>{segment.shortLabel}</b>
                      <span>{segment.label}</span>
                    </button>
                  ))}
                  <button
                    aria-pressed={canvasZoomEnabled}
                    className={canvasZoomEnabled ? 'active object-rigging-zoom-button' : 'object-rigging-zoom-button'}
                    onClick={() => setCanvasInteractionMode(canvasZoomEnabled ? 'cut' : 'zoom')}
                    title={canvasZoomEnabled ? 'Revenir a la coupe' : 'Zoom souris: clic gauche et glisse haut/bas'}
                    type="button"
                  >
                    <ZoomIn aria-hidden="true" size={15} />
                    <span>{canvasZoomEnabled ? 'Couper' : 'Zoom'}</span>
                  </button>
                  {canvasCutEnabled ? (
                    <>
                      <button
                        aria-pressed={canvasPaintEnabled}
                        className={canvasPaintEnabled ? 'active object-rigging-contour-button' : 'object-rigging-contour-button'}
                        onClick={() => setCanvasInteractionMode(canvasPaintEnabled ? 'cut' : 'paint')}
                        title={canvasPaintEnabled ? 'Revenir a la coupe' : 'Peindre une zone de decoupe'}
                        type="button"
                      >
                        <Brush aria-hidden="true" size={15} />
                        <span>{canvasPaintEnabled ? 'Couper' : 'Peindre'}</span>
                      </button>
                    <button
                      aria-pressed={canvasManipulationEnabled}
                      className={canvasManipulationEnabled ? 'active object-rigging-manipulate-button' : 'object-rigging-manipulate-button'}
                      onClick={() => setCanvasInteractionMode(canvasManipulationEnabled ? 'cut' : 'manipulate')}
                      title={canvasManipulationEnabled ? 'Revenir a la coupe' : "Manipuler l'objet dans le canvas"}
                      type="button"
                    >
                      <Hand aria-hidden="true" size={15} />
                      <span>{canvasManipulationEnabled ? 'Couper' : 'Manipuler'}</span>
                    </button>
                    </>
                  ) : null}
                </div>
                <div className="object-rigging-cut-status">
                  {canvasManipulationEnabled
                    ? 'Manipulation active dans le canevas'
                    : (canvasZoomEnabled
                      ? `Zoom souris: ${cameraZoomPercent}%`
                    : (canvasPaintEnabled
                      ? `Peinture active: ${activePaintPoints.length} touche${activePaintPoints.length > 1 ? 's' : ''}`
                      : (canvasCutEnabled ? 'Coupe visible dans le canevas' : `Clic canvas: ${SEGMENT_OPTIONS.find((segment) => segment.id === activeSegment)?.label || 'Plastron'}`)))}
                </div>
              </div>
            </Decor3DPreview>
          ) : (
            <div className="object-rigging-empty-preview">Selectionne un objet 3D.</div>
          )}
        </React.Suspense>
      </section>
    </main>
  );
}
