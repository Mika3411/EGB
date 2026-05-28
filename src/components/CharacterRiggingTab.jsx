import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Fingerprint,
  FlipHorizontal2,
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
  roundCharacterRigPointValue,
  updateCharacterRigPoint,
} from '../utils/rpg3dCharacterRig.js';

const Character3DPreview = React.lazy(() => import('./rpg3d/Character3DPreview.jsx'));
const CHARACTER_RIG_HELP_HUMANOID_IMAGE = '/assets/character-rig-help-humanoid.png';
const CHARACTER_RIG_HELP_HANDS_IMAGE = '/assets/character-rig-help-hands.png';

const ensureCharacterModels = (draft) => {
  if (!Array.isArray(draft.characterModels3d)) draft.characterModels3d = [];
  return draft.characterModels3d;
};

const CHARACTER_RIG_LEGEND = [
  {
    id: 'weapon',
    label: 'Arme',
    details: [
      { code: 'POD', label: 'Poignet droit' },
      { code: 'POG', label: 'Poignet gauche' },
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

const getOppositeRigPointId = (pointId = '') => {
  if (pointId.startsWith('right-')) return `left-${pointId.slice('right-'.length)}`;
  if (pointId.startsWith('left-')) return `right-${pointId.slice('left-'.length)}`;
  return '';
};

const clampRigSymmetryAxis = (value) => Math.min(0.95, Math.max(0.05, Number(value) || 0.5));
const CHARACTER_RIG_SYMMETRY_AXIS_STEP = 0.02;

const mirrorRigPointPatch = (patch = {}, axisX = 0.5) => {
  const mirroredPatch = { ...patch };
  const numericX = Number(patch.x);
  if (Number.isFinite(numericX)) {
    mirroredPatch.x = roundCharacterRigPointValue((clampRigSymmetryAxis(axisX) * 2) - numericX);
  }
  return mirroredPatch;
};

const CHARACTER_RIG_HELP_BODY_MARKERS = [
  { id: 'mouth', label: 'BO', socket: 'armor', x: 100, y: 36 },
  { id: 'neck', label: 'CO', socket: 'armor', x: 100, y: 52 },
  { id: 'left-shoulder', label: 'EG', socket: 'armor', x: 77, y: 64 },
  { id: 'right-shoulder', label: 'ED', socket: 'armor', x: 123, y: 64 },
  { id: 'left-elbow', label: 'CG', socket: 'shield', x: 61, y: 93 },
  { id: 'right-elbow', label: 'CD', socket: 'shield', x: 140, y: 93 },
  { id: 'left-hand', label: 'POG', socket: 'weapon', x: 42, y: 117 },
  { id: 'right-hand', label: 'POD', socket: 'weapon', x: 158, y: 117 },
  { id: 'lower-belly', label: 'BA', socket: 'armor', x: 100, y: 115 },
  { id: 'left-groin-fold', label: 'AG', socket: 'armor', x: 89, y: 123 },
  { id: 'right-groin-fold', label: 'AD', socket: 'armor', x: 111, y: 123 },
  { id: 'left-knee', label: 'GG', socket: 'armor', x: 80, y: 175 },
  { id: 'right-knee', label: 'GD', socket: 'armor', x: 116, y: 175 },
  { id: 'left-ankle', label: 'CHG', socket: 'armor', x: 80, y: 222 },
  { id: 'right-ankle', label: 'CHD', socket: 'armor', x: 121, y: 222 },
  { id: 'left-foot', label: 'PG', socket: 'armor', x: 73, y: 238 },
  { id: 'right-foot', label: 'PD', socket: 'armor', x: 129, y: 238 },
];

const CHARACTER_RIG_HELP_FINGER_PATHS = [
  { id: 'right-thumb', points: [{ x: 309, y: 382 }, { x: 229, y: 441 }, { x: 161, y: 504 }, { x: 84, y: 550 }] },
  { id: 'right-index', points: [{ x: 230, y: 625 }, { x: 190, y: 730 }, { x: 165, y: 830 }, { x: 135, y: 850 }] },
  { id: 'right-middle', points: [{ x: 303, y: 670 }, { x: 264, y: 766 }, { x: 232, y: 832 }, { x: 202, y: 921 }] },
  { id: 'right-ring', points: [{ x: 370, y: 679 }, { x: 343, y: 779 }, { x: 298, y: 834 }, { x: 296, y: 914 }] },
  { id: 'right-pinky', points: [{ x: 443, y: 679 }, { x: 432, y: 746 }, { x: 425, y: 850 }, { x: 414, y: 921 }] },
  { id: 'left-thumb', points: [{ x: 1139, y: 382 }, { x: 1219, y: 441 }, { x: 1287, y: 504 }, { x: 1364, y: 550 }] },
  { id: 'left-index', points: [{ x: 1218, y: 625 }, { x: 1258, y: 730 }, { x: 1283, y: 830 }, { x: 1313, y: 850 }] },
  { id: 'left-middle', points: [{ x: 1145, y: 670 }, { x: 1184, y: 766 }, { x: 1216, y: 832 }, { x: 1246, y: 921 }] },
  { id: 'left-ring', points: [{ x: 1078, y: 679 }, { x: 1105, y: 779 }, { x: 1150, y: 834 }, { x: 1152, y: 914 }] },
  { id: 'left-pinky', points: [{ x: 1005, y: 679 }, { x: 1016, y: 746 }, { x: 1023, y: 850 }, { x: 1034, y: 921 }] },
];

function CharacterRiggingHelpModal({ onClose }) {
  const fingerMarkers = useMemo(() => (
    CHARACTER_RIG_HELP_FINGER_PATHS.flatMap((path) => (
      path.points.map((point, index) => ({
        id: `${path.id}-${index + 1}`,
        pathId: path.id,
        pointIndex: index,
        ...point,
      }))
    ))
  ), []);

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
            <button type="button" aria-label="Fermer l'aide pastilles" onClick={onClose}>
              <X aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
        <div className="character-rigging-help-body">
          <div className="character-rigging-help-examples">
            <div className="character-rigging-help-figure body" role="img" aria-label="Humanoid 2D exemple pastilles">
              <img className="character-rigging-help-image" src={CHARACTER_RIG_HELP_HUMANOID_IMAGE} alt="" aria-hidden="true" />
              <svg
                className="character-rigging-help-overlay"
                viewBox="0 0 200 268"
                aria-hidden="true"
              >
                <line className="character-rigging-help-center" x1="100" y1="10" x2="100" y2="252" />
                {CHARACTER_RIG_HELP_BODY_MARKERS.map((marker) => (
                  <g
                    className={`character-rigging-help-body-marker ${marker.socket}`}
                    key={marker.id}
                  >
                    <circle cx={marker.x} cy={marker.y} r="5.8" />
                    <text x={marker.x} y={marker.y + 2.2}>{marker.label}</text>
                  </g>
                ))}
              </svg>
            </div>
            <div className="character-rigging-help-figure hands" role="img" aria-label="Mains exemple pastilles phalanges">
              <img className="character-rigging-help-image" src={CHARACTER_RIG_HELP_HANDS_IMAGE} alt="" aria-hidden="true" />
              <svg
                className="character-rigging-help-overlay"
                viewBox="0 0 1448 1086"
                aria-hidden="true"
              >
                <line className="character-rigging-help-hands-separator" x1="724" y1="0" x2="724" y2="1086" />
                {CHARACTER_RIG_HELP_FINGER_PATHS.map((path) => (
                  <polyline
                    className="character-rigging-help-finger-line"
                    key={path.id}
                    points={path.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  />
                ))}
                {fingerMarkers.map((marker) => (
                  <circle
                    className="character-rigging-help-marker finger"
                    key={marker.id}
                    cx={marker.x}
                    cy={marker.y}
                    r="9"
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
  const [symmetryEnabled, setSymmetryEnabled] = useState(false);
  const [symmetryAxisX, setSymmetryAxisX] = useState(0.5);
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
    const oppositePointId = symmetryEnabled ? getOppositeRigPointId(pointId) : '';
    patchSelectedModel((model) => {
      let nextRigPoints = updateCharacterRigPoint(model.characterRigPoints, pointId, patch);
      if (oppositePointId) {
        nextRigPoints = updateCharacterRigPoint(nextRigPoints, oppositePointId, mirrorRigPointPatch(patch, symmetryAxisX));
      }
      model.characterRigPoints = nextRigPoints;
    });
  };

  const moveSymmetryAxis = (direction = 0) => {
    setSymmetryAxisX((current) => clampRigSymmetryAxis(
      current + (Number(direction) || 0) * CHARACTER_RIG_SYMMETRY_AXIS_STEP,
    ));
  };

  const stopCanvasPointerEvent = (event) => {
    event.stopPropagation();
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
              <div
                className="character-rigging-symmetry-guide"
                style={{ left: `${symmetryAxisX * 100}%` }}
                data-axis-percent={Math.round(symmetryAxisX * 100)}
                aria-hidden="true"
              />
              <div className="character-rigging-symmetry-axis-controls" role="group" aria-label="Axe de symetrie">
                <button
                  type="button"
                  className="character-rigging-symmetry-axis-button left"
                  aria-label="Deplacer l'axe de symetrie vers la gauche"
                  title="Deplacer l'axe vers la gauche"
                  onPointerDown={stopCanvasPointerEvent}
                  onPointerUp={stopCanvasPointerEvent}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveSymmetryAxis(-1);
                  }}
                >
                  <ArrowLeft aria-hidden="true" size={17} />
                </button>
                <button
                  type="button"
                  className="character-rigging-symmetry-axis-button right"
                  aria-label="Deplacer l'axe de symetrie vers la droite"
                  title="Deplacer l'axe vers la droite"
                  onPointerDown={stopCanvasPointerEvent}
                  onPointerUp={stopCanvasPointerEvent}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveSymmetryAxis(1);
                  }}
                >
                  <ArrowRight aria-hidden="true" size={17} />
                </button>
              </div>
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
                    <button
                      type="button"
                      className={`character-rigging-symmetry-toggle${symmetryEnabled ? ' active' : ''}`}
                      aria-label={symmetryEnabled ? 'Desactiver la symetrie des pastilles' : 'Activer la symetrie des pastilles'}
                      aria-pressed={symmetryEnabled}
                      title={symmetryEnabled ? 'Symetrie active' : 'Activer la symetrie gauche droite'}
                      onClick={() => setSymmetryEnabled((current) => !current)}
                    >
                      <FlipHorizontal2 aria-hidden="true" size={15} />
                      <span>Symetrie</span>
                    </button>
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
