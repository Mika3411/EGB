import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Fingerprint,
  HelpCircle,
  RotateCcw,
  Save,
  Sparkles,
  UserRound,
  X,
  ZoomIn,
} from 'lucide-react';
import { getThreeModelSource } from '../utils/threeGltfUtils';
import {
  CHARACTER_RIG_POINT_GROUPS,
  normalizeCharacterRigPoints,
  updateCharacterRigPoint,
} from '../utils/rpg3dCharacterRig.js';

const Character3DPreview = React.lazy(() => import('./rpg3d/Character3DPreview.jsx'));
const CHARACTER_RIG_HELP_HUMANOID_IMAGE = '/assets/character-rig-help-humanoid.png';
const CHARACTER_RIG_HELP_HANDS_IMAGE = '/assets/character-rig-help-hands.png';
const CHARACTER_RIG_HELP_FINGER_STORAGE_KEY = 'escape-game-builder.characterRigHelpFingerPaths.v1';
const CHARACTER_RIG_HELP_HANDS_VIEWBOX = { width: 1448, height: 1086 };

const ensureCharacterModels = (draft) => {
  if (!Array.isArray(draft.characterModels3d)) draft.characterModels3d = [];
  return draft.characterModels3d;
};

const CHARACTER_RIG_LEGEND = [
  {
    id: 'weapon',
    label: 'Arme',
    details: [
      { code: 'MD', label: 'Poignet droit' },
      { code: 'MG', label: 'Poignet gauche' },
    ],
  },
  {
    id: 'shield',
    label: 'Bouclier',
    details: [
      { code: 'CD', label: 'Coude droit' },
      { code: 'CG', label: 'Coude gauche' },
    ],
  },
  {
    id: 'armor',
    label: 'Armure',
    details: [
      { code: 'ED', label: 'Epaule droite' },
      { code: 'EG', label: 'Epaule gauche' },
      { code: 'CO', label: 'Cou' },
      { code: 'BO', label: 'Bouche' },
      { code: 'BA', label: 'Bassin' },
      { code: 'AD', label: 'Aine droite' },
      { code: 'AG', label: 'Aine gauche' },
      { code: 'GD', label: 'Genou droit' },
      { code: 'GG', label: 'Genou gauche' },
      { code: 'CHD', label: 'Cheville droite' },
      { code: 'CHG', label: 'Cheville gauche' },
      { code: 'PD', label: 'Pied droit' },
      { code: 'PG', label: 'Pied gauche' },
    ],
  },
  {
    id: 'finger',
    label: 'Phalanges',
    details: [
      { code: 'Mains', label: 'pastilles des phalanges' },
    ],
  },
];

const CHARACTER_RIG_MODES = [
  { id: CHARACTER_RIG_POINT_GROUPS.body, label: 'Corps', icon: Crosshair },
  { id: CHARACTER_RIG_POINT_GROUPS.phalanges, label: 'Phalanges', icon: Fingerprint },
];

const CHARACTER_RIG_CAMERA_VIEWS = [
  { id: 'north', label: 'N', title: 'Voir de face' },
  { id: 'east', label: 'E', title: 'Voir le cote droit' },
  { id: 'south', label: 'S', title: 'Voir de dos' },
  { id: 'west', label: 'O', title: 'Voir le cote gauche' },
];

const CHARACTER_RIG_PHALANGE_HANDS = [
  { id: 'right', label: 'Droite' },
  { id: 'left', label: 'Gauche' },
];

const CHARACTER_RIG_PHALANGE_FINGERS = [
  { id: 'thumb', label: 'Pouce' },
  { id: 'index', label: 'Index' },
  { id: 'middle', label: 'Majeur' },
  { id: 'ring', label: 'Annulaire' },
  { id: 'pinky', label: 'Auriculaire' },
];

const CHARACTER_RIG_PHALANGE_JOINT_LABELS = {
  1: 'Base',
  2: 'Milieu',
  3: 'Bout',
  4: 'Pointe',
};

const getPhalangeHandLabel = (handId = '') => (
  CHARACTER_RIG_PHALANGE_HANDS.find((hand) => hand.id === handId)?.label || handId
);

const getPhalangeFingerLabel = (fingerId = '') => (
  CHARACTER_RIG_PHALANGE_FINGERS.find((finger) => finger.id === fingerId)?.label || fingerId
);

const CHARACTER_RIG_HELP_BODY_MARKERS = [
  { id: 'mouth', label: 'BO', socket: 'armor', x: 100, y: 39 },
  { id: 'neck', label: 'CO', socket: 'armor', x: 100, y: 55 },
  { id: 'left-shoulder', label: 'EG', socket: 'armor', x: 75, y: 62 },
  { id: 'right-shoulder', label: 'ED', socket: 'armor', x: 125, y: 62 },
  { id: 'left-elbow', label: 'CG', socket: 'shield', x: 58, y: 94 },
  { id: 'right-elbow', label: 'CD', socket: 'shield', x: 142, y: 94 },
  { id: 'left-hand', label: 'MG', socket: 'weapon', x: 33, y: 129 },
  { id: 'right-hand', label: 'MD', socket: 'weapon', x: 167, y: 129 },
  { id: 'lower-belly', label: 'BA', socket: 'armor', x: 100, y: 139 },
  { id: 'left-groin-fold', label: 'AG', socket: 'armor', x: 89, y: 148 },
  { id: 'right-groin-fold', label: 'AD', socket: 'armor', x: 111, y: 148 },
  { id: 'left-knee', label: 'GG', socket: 'armor', x: 87, y: 192 },
  { id: 'right-knee', label: 'GD', socket: 'armor', x: 113, y: 192 },
  { id: 'left-ankle', label: 'CHG', socket: 'armor', x: 84, y: 235 },
  { id: 'right-ankle', label: 'CHD', socket: 'armor', x: 116, y: 235 },
  { id: 'left-foot', label: 'PG', socket: 'armor', x: 79, y: 252 },
  { id: 'right-foot', label: 'PD', socket: 'armor', x: 121, y: 252 },
];

const CHARACTER_RIG_HELP_FINGER_PATHS = [
  { id: 'right-thumb', points: [{ x: 224, y: 500 }, { x: 145, y: 520 }, { x: 72, y: 544 }, { x: 35, y: 548 }] },
  { id: 'right-index', points: [{ x: 207, y: 672 }, { x: 160, y: 765 }, { x: 125, y: 846 }, { x: 112, y: 882 }] },
  { id: 'right-middle', points: [{ x: 306, y: 680 }, { x: 279, y: 806 }, { x: 262, y: 906 }, { x: 260, y: 944 }] },
  { id: 'right-ring', points: [{ x: 397, y: 689 }, { x: 374, y: 800 }, { x: 358, y: 892 }, { x: 356, y: 930 }] },
  { id: 'right-pinky', points: [{ x: 489, y: 682 }, { x: 486, y: 762 }, { x: 480, y: 838 }, { x: 477, y: 866 }] },
  { id: 'left-thumb', points: [{ x: 1224, y: 500 }, { x: 1303, y: 520 }, { x: 1376, y: 544 }, { x: 1413, y: 548 }] },
  { id: 'left-index', points: [{ x: 1287, y: 682 }, { x: 1311, y: 762 }, { x: 1319, y: 840 }, { x: 1328, y: 876 }] },
  { id: 'left-middle', points: [{ x: 1195, y: 690 }, { x: 1220, y: 808 }, { x: 1231, y: 906 }, { x: 1234, y: 944 }] },
  { id: 'left-ring', points: [{ x: 1107, y: 690 }, { x: 1116, y: 800 }, { x: 1122, y: 890 }, { x: 1124, y: 928 }] },
  { id: 'left-pinky', points: [{ x: 1014, y: 682 }, { x: 1009, y: 762 }, { x: 1004, y: 838 }, { x: 1001, y: 866 }] },
];

const clampHelpPoint = (value, min, max) => Math.min(max, Math.max(min, value));

const cloneHelpFingerPaths = (paths = CHARACTER_RIG_HELP_FINGER_PATHS) => (
  paths.map((path) => ({
    id: path.id,
    points: path.points.map((point) => ({ x: point.x, y: point.y })),
  }))
);

const normalizeHelpFingerPaths = (value) => {
  const pathsById = new Map((Array.isArray(value) ? value : []).map((path) => [path?.id, path]));
  return CHARACTER_RIG_HELP_FINGER_PATHS.map((defaultPath) => {
    const path = pathsById.get(defaultPath.id);
    const normalizedPoints = [];
    defaultPath.points.forEach((defaultPoint, index) => {
      const point = path?.points?.[index];
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        normalizedPoints.push({
          x: Math.round(clampHelpPoint(x, 0, CHARACTER_RIG_HELP_HANDS_VIEWBOX.width)),
          y: Math.round(clampHelpPoint(y, 0, CHARACTER_RIG_HELP_HANDS_VIEWBOX.height)),
        });
        return;
      }
      const previousPoint = normalizedPoints[index - 1];
      const beforePreviousPoint = normalizedPoints[index - 2];
      if (previousPoint && beforePreviousPoint) {
        normalizedPoints.push({
          x: Math.round(clampHelpPoint(previousPoint.x + (previousPoint.x - beforePreviousPoint.x) * 0.45, 0, CHARACTER_RIG_HELP_HANDS_VIEWBOX.width)),
          y: Math.round(clampHelpPoint(previousPoint.y + (previousPoint.y - beforePreviousPoint.y) * 0.45, 0, CHARACTER_RIG_HELP_HANDS_VIEWBOX.height)),
        });
        return;
      }
      normalizedPoints.push({ ...defaultPoint });
    });
    return {
      id: defaultPath.id,
      points: normalizedPoints,
    };
  });
};

const readHelpFingerPaths = () => {
  if (typeof window === 'undefined') return cloneHelpFingerPaths();
  try {
    const stored = window.localStorage.getItem(CHARACTER_RIG_HELP_FINGER_STORAGE_KEY);
    if (!stored) return cloneHelpFingerPaths();
    return normalizeHelpFingerPaths(JSON.parse(stored));
  } catch {
    return cloneHelpFingerPaths();
  }
};

function CharacterRiggingHelpModal({ onClose }) {
  const handsSvgRef = useRef(null);
  const dragMarkerRef = useRef(null);
  const [fingerPaths, setFingerPaths] = useState(readHelpFingerPaths);
  const [draggedMarkerId, setDraggedMarkerId] = useState('');
  const fingerMarkers = useMemo(() => (
    fingerPaths.flatMap((path) => (
      path.points.map((point, index) => ({
        id: `${path.id}-${index + 1}`,
        pathId: path.id,
        pointIndex: index,
        ...point,
      }))
    ))
  ), [fingerPaths]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CHARACTER_RIG_HELP_FINGER_STORAGE_KEY, JSON.stringify(fingerPaths));
  }, [fingerPaths]);

  const getSvgPointFromPointer = (event) => {
    const svg = handsSvgRef.current;
    const matrix = svg?.getScreenCTM?.();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(matrix.inverse());
    return {
      x: Math.round(clampHelpPoint(svgPoint.x, 0, CHARACTER_RIG_HELP_HANDS_VIEWBOX.width)),
      y: Math.round(clampHelpPoint(svgPoint.y, 0, CHARACTER_RIG_HELP_HANDS_VIEWBOX.height)),
    };
  };

  const setHelpFingerPoint = (pathId, pointIndex, point) => {
    setFingerPaths((currentPaths) => currentPaths.map((path) => {
      if (path.id !== pathId) return path;
      return {
        ...path,
        points: path.points.map((existingPoint, index) => (
          index === pointIndex ? point : existingPoint
        )),
      };
    }));
  };

  const startMarkerDrag = (event, marker) => {
    event.preventDefault();
    event.stopPropagation();
    dragMarkerRef.current = {
      id: marker.id,
      pathId: marker.pathId,
      pointIndex: marker.pointIndex,
      pointerId: event.pointerId,
    };
    setDraggedMarkerId(marker.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = getSvgPointFromPointer(event);
    if (point) setHelpFingerPoint(marker.pathId, marker.pointIndex, point);
  };

  const moveMarkerDrag = (event) => {
    const dragMarker = dragMarkerRef.current;
    if (!dragMarker || dragMarker.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = getSvgPointFromPointer(event);
    if (point) setHelpFingerPoint(dragMarker.pathId, dragMarker.pointIndex, point);
  };

  const stopMarkerDrag = (event) => {
    const dragMarker = dragMarkerRef.current;
    if (!dragMarker || dragMarker.pointerId !== event.pointerId) return;
    dragMarkerRef.current = null;
    setDraggedMarkerId('');
  };

  const resetHelpFingerPaths = () => {
    setFingerPaths(cloneHelpFingerPaths());
  };

  return (
    <div className="character-rigging-help-backdrop" onClick={onClose}>
      <div
        className="character-rigging-help-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Aide pastilles"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="character-rigging-help-head">
          <div>
            <span className="section-kicker"><HelpCircle size={14} /> Aide</span>
            <h2>Exemple pastilles</h2>
          </div>
          <div className="character-rigging-help-head-actions">
            <button type="button" aria-label="Reinitialiser les pastilles des mains" title="Reinitialiser les pastilles des mains" onClick={resetHelpFingerPaths}>
              <RotateCcw aria-hidden="true" size={16} />
            </button>
            <button type="button" aria-label="Fermer l'aide pastilles" onClick={onClose}>
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
        <div className="character-rigging-help-body">
          <div className="character-rigging-help-examples">
            <div className="character-rigging-help-figure body" role="img" aria-label="Humanoid 2D exemple pastilles">
              <img className="character-rigging-help-image" src={CHARACTER_RIG_HELP_HUMANOID_IMAGE} alt="" aria-hidden="true" />
              <svg className="character-rigging-help-overlay" viewBox="0 0 200 268" aria-hidden="true">
                <line className="character-rigging-help-center" x1="100" y1="10" x2="100" y2="252" />
                {CHARACTER_RIG_HELP_BODY_MARKERS.map((marker) => (
                  <g className={`character-rigging-help-body-marker ${marker.socket}`} key={marker.id}>
                    <circle cx={marker.x} cy={marker.y} r="5.8" />
                    <text x={marker.x} y={marker.y + 2.2}>{marker.label}</text>
                  </g>
                ))}
              </svg>
            </div>
            <div className="character-rigging-help-figure hands" role="img" aria-label="Mains exemple pastilles phalanges">
              <img className="character-rigging-help-image" src={CHARACTER_RIG_HELP_HANDS_IMAGE} alt="" aria-hidden="true" />
              <svg
                className="character-rigging-help-overlay interactive"
                ref={handsSvgRef}
                viewBox="0 0 1448 1086"
                aria-hidden="true"
                onPointerMove={moveMarkerDrag}
                onPointerUp={stopMarkerDrag}
                onPointerCancel={stopMarkerDrag}
              >
                <line className="character-rigging-help-hands-separator" x1="724" y1="0" x2="724" y2="1086" />
                {fingerPaths.map((path) => (
                  <polyline
                    className="character-rigging-help-finger-line"
                    key={path.id}
                    points={path.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  />
                ))}
                {fingerMarkers.map((marker) => (
                  <circle
                    className={`character-rigging-help-marker finger ${draggedMarkerId === marker.id ? 'dragging' : ''}`}
                    key={marker.id}
                    cx={marker.x}
                    cy={marker.y}
                    r="9"
                    onPointerDown={(event) => startMarkerDrag(event, marker)}
                  />
                ))}
              </svg>
            </div>
          </div>
          <div className="character-rigging-help-key" aria-label="Legende de pastilles">
            <h3>Legende de pastilles</h3>
            {CHARACTER_RIG_LEGEND.map((entry) => (
              <article className={`character-rigging-help-key-item ${entry.id}`} key={entry.id}>
                <i aria-hidden="true" />
                <span>
                  {entry.details.map((detail) => (
                    <em key={detail.code}>
                      <b>{detail.code}</b>
                      {' = '}
                      {detail.label}
                    </em>
                  ))}
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CharacterRiggingTab({
  project,
  patchProject,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  onSaveAssets,
  saveStatus = '',
  saveInProgress = false,
}) {
  const [rigMode, setRigMode] = useState(CHARACTER_RIG_POINT_GROUPS.body);
  const [rigCameraView, setRigCameraView] = useState('north');
  const [canvasZoomEnabled, setCanvasZoomEnabled] = useState(false);
  const [canvasZoomPercent, setCanvasZoomPercent] = useState(100);
  const [helpOpen, setHelpOpen] = useState(false);
  const [phalangeHand, setPhalangeHand] = useState('right');
  const [phalangeFinger, setPhalangeFinger] = useState('index');
  const [selectedRigPointId, setSelectedRigPointId] = useState('');
  const characterModels = useMemo(() => (
    (project.characterModels3d || []).filter((model) => getThreeModelSource(model))
  ), [project.characterModels3d]);
  const [localSelectedModelId, setLocalSelectedModelId] = useState(controlledSelectedModelId || characterModels[0]?.id || '');
  const selectedModelId = controlledSelectedModelId ?? localSelectedModelId;

  useEffect(() => {
    if (!characterModels.length) return;
    if (!characterModels.some((model) => model.id === selectedModelId)) {
      const nextId = characterModels[0].id;
      setLocalSelectedModelId(nextId);
      onSelectedModelIdChange?.(nextId);
    }
  }, [characterModels, onSelectedModelIdChange, selectedModelId]);

  useEffect(() => {
    if (!helpOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setHelpOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [helpOpen]);

  const selectedModel = characterModels.find((model) => model.id === selectedModelId) || characterModels[0] || null;
  const rigPoints = useMemo(() => normalizeCharacterRigPoints(selectedModel?.characterRigPoints), [selectedModel]);
  const isPhalangeMode = rigMode === CHARACTER_RIG_POINT_GROUPS.phalanges;
  const selectedPhalangeHand = CHARACTER_RIG_PHALANGE_HANDS.find((hand) => hand.id === phalangeHand) || CHARACTER_RIG_PHALANGE_HANDS[0];
  const selectedPhalangeFinger = CHARACTER_RIG_PHALANGE_FINGERS.find((finger) => finger.id === phalangeFinger) || CHARACTER_RIG_PHALANGE_FINGERS[1];
  const visibleRigPoints = useMemo(() => (
    rigPoints
      .filter((point) => {
        if (point.group !== rigMode) return false;
        if (!isPhalangeMode) return true;
        return point.hand === phalangeHand && point.finger === phalangeFinger;
      })
      .map((point) => {
        if (!isPhalangeMode) return point;
        const jointLabel = CHARACTER_RIG_PHALANGE_JOINT_LABELS[point.joint] || `Phalange ${point.joint}`;
        return {
          ...point,
          label: `${getPhalangeHandLabel(point.hand)} - ${getPhalangeFingerLabel(point.finger)} - ${jointLabel}`,
          shortLabel: point.joint || point.shortLabel,
          hideLabel: false,
          size: 0.86,
        };
      })
  ), [isPhalangeMode, phalangeFinger, phalangeHand, rigMode, rigPoints]);
  const visibleRigPointIds = useMemo(() => new Set(visibleRigPoints.map((point) => point.id)), [visibleRigPoints]);
  const effectiveSelectedRigPointId = visibleRigPointIds.has(selectedRigPointId)
    ? selectedRigPointId
    : (visibleRigPoints[0]?.id || '');
  const previewRigPoints = useMemo(() => (
    visibleRigPoints.map((point) => ({
      ...point,
      selected: point.id === effectiveSelectedRigPointId,
    }))
  ), [effectiveSelectedRigPointId, visibleRigPoints]);
  const activePointCount = visibleRigPoints.filter((point) => point.enabled).length;
  const previewModel = selectedModel ? { ...selectedModel, inventory: [] } : null;
  const rigControlsDisabled = !selectedModel;

  const setSelectedModelId = (nextId) => {
    setLocalSelectedModelId(nextId);
    onSelectedModelIdChange?.(nextId);
  };

  const patchSelectedModel = (updater) => {
    if (!selectedModel?.id) return;
    patchProject((draft) => {
      const model = ensureCharacterModels(draft).find((entry) => entry.id === selectedModel.id);
      if (model) updater(model);
    }, { rememberHistory: false });
  };

  const setRigPoint = (pointId, patch) => {
    if (rigControlsDisabled) return;
    setSelectedRigPointId(pointId);
    patchSelectedModel((model) => {
      model.characterRigPoints = updateCharacterRigPoint(model.characterRigPoints, pointId, patch);
    });
  };

  const selectRigPoint = (pointId = '') => {
    if (!pointId) return;
    setSelectedRigPointId(pointId);
  };

  const setAllRigPointsEnabled = (enabled) => {
    if (rigControlsDisabled) return;
    patchSelectedModel((model) => {
      model.characterRigPoints = normalizeCharacterRigPoints(model.characterRigPoints)
        .map((point) => (visibleRigPointIds.has(point.id) ? { ...point, enabled } : point));
    });
  };

  const resetRigPoints = () => {
    if (rigControlsDisabled) return;
    patchSelectedModel((model) => {
      const defaultsById = new Map(normalizeCharacterRigPoints([]).map((point) => [point.id, point]));
      model.characterRigPoints = normalizeCharacterRigPoints(model.characterRigPoints)
        .map((point) => (visibleRigPointIds.has(point.id) ? defaultsById.get(point.id) || point : point));
    });
  };

  const rigSignature = visibleRigPoints
    .map((point) => [point.id, point.enabled ? 1 : 0, point.x, point.y, point.z].join(':'))
    .join('|');

  return (
    <main className="character-rigging-tab">
      <section className="panel character-rigging-controls">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker"><Crosshair size={14} /> Rig personnage</span>
            <h2>Pastilles</h2>
          </div>
          {onSaveAssets ? (
            <button type="button" className="primary-action" onClick={onSaveAssets} disabled={saveInProgress}>
              <Save aria-hidden="true" size={16} />
              <span>{saveInProgress ? 'Sauvegarde...' : 'Sauver'}</span>
            </button>
          ) : null}
        </div>

        <label>
          <span>Personnage</span>
          <select value={selectedModel?.id || ''} onChange={(event) => setSelectedModelId(event.target.value)}>
            {characterModels.map((model) => (
              <option key={model.id} value={model.id}>{model.name || model.modelName || 'Personnage 3D'}</option>
            ))}
          </select>
        </label>

        <div className="character-rigging-actions">
          <button type="button" className="secondary-action" onClick={() => setAllRigPointsEnabled(true)} disabled={rigControlsDisabled}>
            <Sparkles aria-hidden="true" size={16} />
            <span>Activer tout</span>
          </button>
          <button type="button" className="secondary-action" onClick={resetRigPoints} disabled={rigControlsDisabled}>
            <RotateCcw aria-hidden="true" size={16} />
            <span>Reset</span>
          </button>
        </div>

        {saveStatus ? <p className="small-note">{saveStatus}</p> : null}
        <div className="character-rigging-stats" data-rig-signature={rigSignature}>
          <span><UserRound size={14} /> {activePointCount} active{activePointCount > 1 ? 's' : ''}</span>
          <span><Crosshair size={14} /> {visibleRigPoints.length} pastilles</span>
        </div>
      </section>

      <section className="panel character-rigging-preview-panel">
        <React.Suspense fallback={<div className="character3d-preview-loading" />}>
          {previewModel ? (
            <Character3DPreview
              model={previewModel}
              autoPreviewAnimation={false}
              playEmbeddedAnimations={false}
              characterRigMarkers={previewRigPoints}
              onCharacterRigMarkerChange={setRigPoint}
              onCharacterRigMarkerSelect={selectRigPoint}
              cameraZoomDragEnabled={canvasZoomEnabled}
              onCameraZoomChange={setCanvasZoomPercent}
              initialCameraZoom={1.55}
              cameraView={rigCameraView}
            >
              <div className="character-rigging-symmetry-guide" aria-hidden="true" />
              <div className="character3d-preview-head character3d-canvas-overlay">
                <div>
                  <span className="section-kicker"><Crosshair size={14} /> Rig</span>
                  <h2>{selectedModel?.name || selectedModel?.modelName || 'Personnage 3D'}</h2>
                </div>
              </div>
              <div className="character-rigging-side-tools">
                <div className="character-rigging-canvas-tools">
                  <div className="character-rigging-canvas-tool-row">
                    <div className="character-rigging-mode-switch" role="group" aria-label="Mode de pastilles">
                      {CHARACTER_RIG_MODES.map((mode) => {
                        const Icon = mode.icon;
                        return (
                          <button
                            type="button"
                            className={rigMode === mode.id ? 'active' : ''}
                            aria-pressed={rigMode === mode.id}
                            onClick={() => setRigMode(mode.id)}
                            key={mode.id}
                          >
                            <Icon aria-hidden="true" size={14} />
                            <span>{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="character-rigging-zoom-control" role="group" aria-label="Outils camera">
                      <button
                        type="button"
                        className={canvasZoomEnabled ? 'active' : ''}
                        title={canvasZoomEnabled ? 'Zoom souris actif: maintiens clic gauche et glisse haut/bas' : 'Activer le zoom souris'}
                        aria-label={canvasZoomEnabled ? 'Desactiver le zoom souris' : 'Activer le zoom souris'}
                        aria-pressed={canvasZoomEnabled}
                        onClick={() => setCanvasZoomEnabled((current) => !current)}
                      >
                        <ZoomIn aria-hidden="true" size={17} />
                      </button>
                      <output aria-label="Zoom actuel">{canvasZoomPercent}%</output>
                    </div>
                    <button
                      type="button"
                      className="character-rigging-help-trigger"
                      aria-label="Aide pastilles"
                      title="Aide pastilles"
                      onClick={() => setHelpOpen(true)}
                    >
                      <HelpCircle aria-hidden="true" size={17} />
                      <span>Aide</span>
                    </button>
                  </div>
                </div>
              </div>
              <div
                className="character-rigging-view-pole"
                role="group"
                aria-label="Vues NESO"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
              >
                {CHARACTER_RIG_CAMERA_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    className={rigCameraView === view.id ? 'active' : ''}
                    data-view={view.id}
                    title={view.title}
                    aria-label={view.title}
                    aria-pressed={rigCameraView === view.id}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setRigCameraView(view.id);
                    }}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </Character3DPreview>
          ) : (
            <div className="character-rigging-empty-preview">Selectionne un personnage 3D.</div>
          )}
        </React.Suspense>
      </section>

      <section className="panel character-rigging-list-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Points</span>
            <h2>Accroches</h2>
          </div>
        </div>
        {isPhalangeMode ? (
          <div className="character-rigging-phalange-focus character-rigging-phalange-focus-panel" role="group" aria-label="Selection phalanges">
            <div className="character-rigging-phalange-button-set hands" role="group" aria-label="Main">
              {CHARACTER_RIG_PHALANGE_HANDS.map((hand) => (
                <button
                  type="button"
                  className={phalangeHand === hand.id ? 'active' : ''}
                  aria-pressed={phalangeHand === hand.id}
                  onClick={() => setPhalangeHand(hand.id)}
                  key={hand.id}
                >
                  {hand.label}
                </button>
              ))}
            </div>
            <div className="character-rigging-phalange-button-set fingers" role="group" aria-label="Doigt">
              {CHARACTER_RIG_PHALANGE_FINGERS.map((finger) => (
                <button
                  type="button"
                  className={phalangeFinger === finger.id ? 'active' : ''}
                  aria-pressed={phalangeFinger === finger.id}
                  onClick={() => setPhalangeFinger(finger.id)}
                  key={finger.id}
                >
                  {finger.label}
                </button>
              ))}
            </div>
            <output aria-label="Focus phalanges">
              {selectedPhalangeHand.label}
              {' / '}
              {selectedPhalangeFinger.label}
              {' - 1 Base - 2 Milieu - 3 Bout - 4 Pointe'}
            </output>
          </div>
        ) : null}
        <div className="character-rigging-list">
          {visibleRigPoints.map((point) => {
            const isSelected = point.id === effectiveSelectedRigPointId;
            return (
            <article
              className={`character-rigging-row ${point.socket || 'armor'} ${point.enabled ? 'enabled' : ''} ${isSelected ? 'selected' : ''} ${rigControlsDisabled ? 'locked' : ''}`}
              key={point.id}
              aria-disabled={rigControlsDisabled}
              aria-selected={isSelected}
              onClick={() => selectRigPoint(point.id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                selectRigPoint(point.id);
              }}
              role="option"
              tabIndex={rigControlsDisabled ? -1 : 0}
            >
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={point.enabled}
                  disabled={rigControlsDisabled}
                  onChange={(event) => setRigPoint(point.id, { enabled: event.target.checked })}
                />
                <i className="character-rigging-row-color" aria-hidden="true" />
                <b>{point.shortLabel || '?'}</b>
                <span>{point.label}</span>
              </label>
            </article>
            );
          })}
          {!visibleRigPoints.length ? <p className="small-note">Aucune pastille.</p> : null}
        </div>
      </section>
      {helpOpen ? <CharacterRiggingHelpModal onClose={() => setHelpOpen(false)} /> : null}
    </main>
  );
}
