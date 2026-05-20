import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cuboid,
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
import { formatBytes } from '../utils/glbOptimizer';
import Character3DPreview from './rpg3d/Character3DPreview.jsx';
import {
  CHARACTER_ANIMATION_SLOTS,
  CHARACTER_MATERIAL_BRIGHTNESS_MAX,
  CHARACTER_MATERIAL_BRIGHTNESS_MIN,
  CHARACTER_MODEL_SCALE_MAX,
  CHARACTER_MODEL_SCALE_MIN,
  getAnimationSource,
  getCharacterModelAxisScale,
  getCharacterImportFileInfo,
  getCharacterMaterialBrightness,
  getEmbeddedAnimationSignature,
  getPreviewAnimationSlot,
  getPreviewLightIntensity,
  getPreviewLightOrientation,
  isCharacterModelScaleProportional,
  isHeavyLocalFbxAsset,
  numberValue,
  readCharacterAnimationImport,
  readCharacterModelImport,
  resizeAxesProportionally,
  summarizeEmbeddedAnimationClips,
} from '../utils/rpg3dModelImport';
import {
  THREE_MODEL_ACCEPT,
  getThreeModelFormatLabel,
  getThreeModelSource,
} from '../utils/threeGltfUtils';
import {
  createLocalModelFileId,
  forgetRpg3DLocalBlobFile,
  rememberRpg3DLocalBlobFile,
} from '../utils/rpg3dAssetsStorage.js';
import HelpLabel from './forms/HelpLabel.jsx';

const ROLE_OPTIONS = [
  { id: 'hero', label: 'Heros', icon: Shield },
  { id: 'enemy', label: 'Ennemi', icon: Swords },
  { id: 'npc', label: 'PNJ', icon: User },
];

const CHARACTER_FIELD_HELP = {
  name: 'Nom interne et visible du personnage dans les listes du builder 3D.',
  glbImport: 'Charge ou remplace le modele 3D du personnage au format .glb, .fbx, .obj ou .zip. Pour un FBX avec dossier .fbm, importe un zip contenant le FBX et ses textures.',
  animationImport: 'Ajoute un FBX/GLB d animation qui utilise le meme squelette que le modele principal. La marche joue pendant le deplacement, l attaque pendant le tir ou le sort.',
  characterModelScale: 'Regle les axes du personnage quand il est place sur la carte RPG 3D. X elargit, Y regle la profondeur, Z regle la hauteur.',
  materialBrightness: 'Regle la luminosite de ce personnage quand il est place sur la carte RPG 3D.',
  previewLightIntensity: 'Regle la puissance de l eclairage dans l apercu personnage. Cela aide a verifier les volumes et les textures.',
  previewLightOrientation: 'Tourne la lumiere principale autour du personnage pour controler les ombres dans l apercu.',
};

const CharacterHelpLabel = ({ children, help }) => (
  <HelpLabel as="span" className="builder3d-help-label" help={help}>{children}</HelpLabel>
);

const ensureCharacterModels = (draft) => {
  if (!Array.isArray(draft.characterModels3d)) draft.characterModels3d = [];
  return draft.characterModels3d;
};

const FieldRange = ({ label, help, value, min, max, step = 0.05, onChange }) => (
  <label className="character3d-range">
    <span>
      <CharacterHelpLabel help={help}>{label}</CharacterHelpLabel>
      <em>{Number(value).toFixed(step < 1 ? 2 : 0)}</em>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const CHARACTER_SCALE_AXES = [
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
const toCharacterUserAxes = (axisScale = {}) => ({
  x: axisScale.x,
  y: axisScale.z,
  z: axisScale.y,
});

export default function Character3DTab({
  project,
  patchProject,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  onSaveAssets,
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
  const localModelUrlsRef = useRef(new Map());
  const localAnimationUrlsRef = useRef(new Map());
  const bootstrappedModelRef = useRef(false);
  const [previewAnimationSlot, setPreviewAnimationSlot] = useState('');
  const [embeddedAnimationInfoByModelId, setEmbeddedAnimationInfoByModelId] = useState({});
  const [axisScaleDraft, setAxisScaleDraft] = useState({ modelId: '', x: '', y: '', z: '' });

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
  const selectedModelSource = selectedModel ? getThreeModelSource(selectedModel) : '';
  const previewModel = useMemo(() => selectedModel || makeCharacter3DModel({ name: 'Nouveau personnage' }), [selectedModel]);
  const selectedEmbeddedAnimations = selectedModel?.id ? embeddedAnimationInfoByModelId[selectedModel.id] || [] : [];
  const selectedRole = selectedModel?.role || previewModel.role || 'hero';
  const cardRoleOptions = ['enemy', 'hero', 'npc']
    .map((roleId) => ROLE_OPTIONS.find((option) => option.id === roleId))
    .filter(Boolean);
  const canImportRoleGlb = Boolean(selectedModel);

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

  const setSelectedModelFile = useCallback(async (file) => {
    if (!file || !selectedModelId) return;
    const fileInfo = getCharacterImportFileInfo(file);
    const { archiveFormat, modelFormat, isZip } = fileInfo;
    if (!modelFormat && !archiveFormat) {
      setCopyStatus('Choisis un fichier .glb, .fbx, .obj ou .zip');
      return;
    }
    if (archiveFormat && archiveFormat !== 'zip') {
      setCopyStatus('Archive 3D non supportee');
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
    setCopyStatus(isZip ? 'Lecture ZIP...' : modelFormat === 'glb' ? 'Optimisation GLB...' : `Import ${importLabel}...`);
    try {
      const {
        zipBundle,
        sourceFormat,
        isGlb,
        optimization,
        optimizedFile,
        modelData,
        modelFileSize,
      } = await readCharacterModelImport(file, fileInfo);
      if (isZip) setCopyStatus(`ZIP: ${getThreeModelFormatLabel(sourceFormat)} + ${zipBundle.modelResources.length} texture${zipBundle.modelResources.length > 1 ? 's' : ''}`);
      const localModelFileId = createLocalModelFileId('character', selectedModelId, optimizedFile);
      const modelUrl = URL.createObjectURL(optimizedFile);
      rememberRpg3DLocalBlobFile(modelUrl, optimizedFile, localModelFileId);
      localModelUrlsRef.current.set(selectedModelId, modelUrl);
      patchSelectedModel((model) => {
        model.shape = 'glb';
        model.modelUrl = modelUrl;
        model.modelData = modelData || '';
        model.localModelFileId = localModelFileId;
        model.modelName = optimizedFile.name || file.name || `modele.${sourceFormat}`;
        model.modelFormat = sourceFormat;
        model.modelFileSize = modelFileSize;
        model.modelResources = zipBundle?.modelResources || [];
      });
      setEmbeddedAnimationInfoByModelId((current) => {
        const next = { ...current };
        delete next[selectedModelId];
        return next;
      });
      setCopyStatus(isGlb && optimization.optimized
        ? `GLB allege ${formatBytes(optimization.originalSize)} -> ${formatBytes(optimization.optimizedSize)}`
        : isGlb && optimization.skipped
          ? `GLB optimise charge sans recompression${modelData ? '' : ' en local'}`
          : isZip
          ? `ZIP charge: ${getThreeModelFormatLabel(sourceFormat)} + ${zipBundle.modelResources.length} texture${zipBundle.modelResources.length > 1 ? 's' : ''}${modelData ? '' : ' en local'}${isHeavyLocalFbxAsset({ modelFormat: sourceFormat, modelUrl, modelFileSize }) ? ' - preview GLB conseille' : ''}`
          : `${getThreeModelFormatLabel(sourceFormat)} charge${modelData ? '' : ' en local'}${isHeavyLocalFbxAsset({ modelFormat: sourceFormat, modelUrl, modelFileSize }) ? ' - preview GLB conseille' : ''}`);
    } catch {
      setCopyStatus('Import du modele 3D impossible');
    } finally {
      setImportInProgress(false);
    }
  }, [patchSelectedModel, selectedModelId]);

  const setSelectedAnimationFile = useCallback(async (slot, file) => {
    if (!file || !selectedModelId || !CHARACTER_ANIMATION_SLOTS.some((entry) => entry.id === slot)) return;
    const fileInfo = getCharacterImportFileInfo(file);
    const { archiveFormat, modelFormat, isZip } = fileInfo;
    if (!modelFormat && !archiveFormat) {
      setCopyStatus('Choisis une animation .glb, .fbx ou .zip');
      return;
    }
    if (archiveFormat && archiveFormat !== 'zip') {
      setCopyStatus('Archive animation non supportee');
      return;
    }
    const animationKey = `${selectedModelId}:${slot}`;
    const previousUrl = localAnimationUrlsRef.current.get(animationKey);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localAnimationUrlsRef.current.delete(animationKey);
    setImportInProgress(true);
    setCopyStatus(isZip ? 'Lecture ZIP animation...' : `Import animation ${getThreeModelFormatLabel(modelFormat)}...`);
    try {
      const {
        zipBundle,
        sourceFile,
        sourceFormat,
        animationData,
        modelFileSize,
      } = await readCharacterAnimationImport(file, fileInfo);
      const localModelFileId = createLocalModelFileId(`character-animation-${slot}`, selectedModelId, sourceFile);
      const animationUrl = URL.createObjectURL(sourceFile);
      rememberRpg3DLocalBlobFile(animationUrl, sourceFile, localModelFileId);
      localAnimationUrlsRef.current.set(animationKey, animationUrl);
      patchSelectedModel((model) => {
        model.modelAnimations = {
          ...(model.modelAnimations || {}),
          [slot]: {
            modelUrl: animationUrl,
            modelData: animationData || '',
            localModelFileId,
            modelName: sourceFile.name || file.name || `animation-${slot}.${sourceFormat}`,
            modelFormat: sourceFormat,
            modelFileSize,
            modelResources: zipBundle?.modelResources || [],
          },
        };
      });
      setPreviewAnimationSlot(slot);
      const slotLabel = CHARACTER_ANIMATION_SLOTS.find((entry) => entry.id === slot)?.label || slot;
      setCopyStatus(`${slotLabel}: animation ${getThreeModelFormatLabel(sourceFormat)} chargee${animationData ? '' : ' en local'}`);
    } catch {
      setCopyStatus('Import animation impossible');
    } finally {
      setImportInProgress(false);
    }
  }, [patchSelectedModel, selectedModelId]);

  const removeSelectedAnimation = useCallback((slot) => {
    if (!selectedModelId) return;
    const animationKey = `${selectedModelId}:${slot}`;
    const previousUrl = localAnimationUrlsRef.current.get(animationKey);
    if (previousUrl) {
      forgetRpg3DLocalBlobFile(previousUrl);
      URL.revokeObjectURL(previousUrl);
    }
    localAnimationUrlsRef.current.delete(animationKey);
    patchSelectedModel((model) => {
      const nextAnimations = { ...(model.modelAnimations || {}) };
      delete nextAnimations[slot];
      model.modelAnimations = nextAnimations;
    });
    setPreviewAnimationSlot((current) => (current === slot ? '' : current));
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
            <p className="small-note">{models.length} modele{models.length > 1 ? 's' : ''}</p>
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
                  <small>{modelRole.label} - {model.modelName || 'Aucun modele importe'}</small>
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
        <div className="character3d-card-role-buttons" role="group" aria-label="Role du personnage">
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
        <div className="character3d-preview-head">
          <div>
            <span className="section-kicker"><Cuboid size={14} /> Modele</span>
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
              title={previewFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
              aria-label={previewFullscreen ? 'Quitter le plein ecran' : 'Activer le plein ecran'}
              aria-pressed={previewFullscreen}
              onClick={togglePreviewFullscreen}
            >
              {previewFullscreen ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
            </button>
          </div>
        </div>

        <Character3DPreview
          model={previewModel}
          animationSlot={previewAnimationSlot}
          onAnimationClipsLoaded={handlePreviewAnimationClipsLoaded}
        />
      </section>

      {showInspectorPanel ? (
      <section className="panel character3d-editor-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Reglages</span>
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
        {saveStatus ? <p className="character3d-save-status" role="status">{saveStatus}</p> : null}
        {saveInProgress ? <div className="character3d-progress character3d-progress-save" role="progressbar" aria-label="Sauvegarde en cours"><span /></div> : null}
        {copyStatus ? <p className="character3d-import-status" role="status">{copyStatus}</p> : null}
        {importInProgress ? <div className="character3d-progress character3d-progress-import" role="progressbar" aria-label="Import en cours"><span /></div> : null}

        {selectedModel ? (
          <div className="character3d-form">
            <label>
              <CharacterHelpLabel help={CHARACTER_FIELD_HELP.name}>Nom</CharacterHelpLabel>
              <input value={selectedModel.name || ''} onChange={(event) => patchSelectedModel((model) => { model.name = event.target.value; })} />
            </label>

            {canImportRoleGlb ? (
              <>
                <CharacterHelpLabel help={CHARACTER_FIELD_HELP.glbImport}>Modele 3D</CharacterHelpLabel>
                <label className="button like full secondary-action character3d-file-button">
                  <Upload aria-hidden="true" size={16} />
                  <span>{selectedModel.modelName ? 'Remplacer modele 3D' : 'Importer modele 3D'}</span>
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
              })}>
                Retirer modele 3D
              </button>
            ) : null}

            {selectedModelSource ? (
              <>
                {selectedEmbeddedAnimations.length ? (
                  <div className="character3d-embedded-animations">
                    <CharacterHelpLabel help="Ces clips sont inclus directement dans le FBX/GLB importe via Modele 3D. Ils peuvent deja servir au preview et au test sans import marche/attaque separe.">
                      Animations incluses
                    </CharacterHelpLabel>
                    <div className="character3d-embedded-animation-list">
                      {selectedEmbeddedAnimations.map((clip) => (
                        <span key={`${clip.name}:${clip.duration}:${clip.trackCount}`}>
                          {clip.name} - {clip.duration.toFixed(2)}s
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {selectedModelSource ? (
              <div className="character3d-animation-imports">
                <CharacterHelpLabel help={CHARACTER_FIELD_HELP.animationImport}>Animations</CharacterHelpLabel>
                {CHARACTER_ANIMATION_SLOTS.map((slot) => {
                  const animation = selectedModel.modelAnimations?.[slot.id] || {};
                  const hasAnimation = Boolean(getAnimationSource(animation));
                  return (
                    <div className="character3d-animation-row" key={slot.id}>
                      <label className="button like full secondary-action character3d-file-button">
                        <Upload aria-hidden="true" size={16} />
                        <span>{hasAnimation ? `Remplacer ${slot.label.toLowerCase()}` : `Importer ${slot.label.toLowerCase()}`}</span>
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
                      {hasAnimation ? (
                        <div className="character3d-animation-meta">
                          <small>{slot.importedLabel}: {animation.modelName || 'animation 3D'}</small>
                          <button
                            type="button"
                            className={`secondary-action compact ${getPreviewAnimationSlot(selectedModel, previewAnimationSlot) === slot.id ? 'active' : ''}`}
                            onClick={() => setPreviewAnimationSlot(slot.id)}
                          >
                            Apercu
                          </button>
                          <button type="button" className="secondary-action compact" onClick={() => removeSelectedAnimation(slot.id)}>
                            Retirer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

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
            <FieldRange
              label="Lumiere carte"
              help={CHARACTER_FIELD_HELP.materialBrightness}
              min={CHARACTER_MATERIAL_BRIGHTNESS_MIN}
              max={CHARACTER_MATERIAL_BRIGHTNESS_MAX}
              step="0.05"
              value={getCharacterMaterialBrightness(selectedModel)}
              onChange={(value) => patchSelectedModel((model) => { model.materialBrightness = value; }, { rememberHistory: false })}
            />
            <FieldRange
              label="Lumiere apercu"
              help={CHARACTER_FIELD_HELP.previewLightIntensity}
              min="0.2"
              max="2.5"
              step="0.05"
              value={getPreviewLightIntensity(selectedModel)}
              onChange={(value) => patchSelectedModel((model) => { model.previewLightIntensity = value; }, { rememberHistory: false })}
            />
            <FieldRange
              label="Orientation lumiere"
              help={CHARACTER_FIELD_HELP.previewLightOrientation}
              min="-180"
              max="180"
              step="1"
              value={getPreviewLightOrientation(selectedModel)}
              onChange={(value) => patchSelectedModel((model) => { model.previewLightOrientation = value; }, { rememberHistory: false })}
            />
          </div>
        ) : (
          <div className="empty-state-inline">Aucun personnage 3D.</div>
        )}
      </section>
      ) : null}
    </main>
  );
}
