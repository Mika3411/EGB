import { useCallback, useState } from 'react';
import { makeCharacter3DModel, makeDecor3DModel } from '../../../../shared/data/projectData.js';
import { getStudioModelSource } from '../../../../shared/utils/rpg3dAssetsCore.js';
import {
  getCharacterModelAxisScale,
  getDecorMaterialBrightness,
  getFloorTileWorldSize,
  getFloorZeroZ,
  getPropHeight,
  getPropModelHeight,
  getPropWidth,
  getStudioDecorKindId,
} from '../../../../shared/utils/rpg3dDomain.js';
import { getSelectedEntity } from '../../../../shared/utils/rpg3dMapEditing.js';

export function useRpg3DStudioAssets({
  applyCharacterModelToActor,
  beginEntityPlacement,
  createId,
  getCurrentPlacementPoint,
  getDecorImportRenderMode,
  getDecorModelWorldSize,
  getModelRotationValue,
  getStudioCharacterRenderMode,
  guessCharacterRenderMode,
  guessPropRenderMode,
  markAutosaveDirty,
  patchConfig,
  patchStudioProject,
  pushHistorySnapshot,
  readArcadeImageFile,
  selected,
  setMediaError,
  setStudioProject,
  setWorkspaceTab,
  shouldPropBlockByMode,
  studioProject,
  studioProjectRef,
} = {}) {
  const [studioSelection, setStudioSelection] = useState({
    characterModelId: '',
    decorModelId: '',
  });

  const createStudioCharacter = useCallback(() => {
    const next = makeCharacter3DModel({
      name: `Personnage 3D ${(studioProject.characterModels3d || []).length + 1}`,
      role: 'npc',
      shape: 'glb',
    });
    patchStudioProject((draft) => {
      draft.characterModels3d = Array.isArray(draft.characterModels3d) ? draft.characterModels3d : [];
      draft.characterModels3d.push(next);
    });
    setStudioSelection((current) => ({ ...current, characterModelId: next.id }));
    setWorkspaceTab('characters3d');
  }, [patchStudioProject, setWorkspaceTab, studioProject.characterModels3d]);

  const createStudioDecor = useCallback(() => {
    const next = makeDecor3DModel({
      name: `Objet 3D ${(studioProject.decorModels3d || []).length + 1}`,
      kind: 'decor',
    });
    patchStudioProject((draft) => {
      draft.decorModels3d = Array.isArray(draft.decorModels3d) ? draft.decorModels3d : [];
      draft.decorModels3d.push(next);
    });
    setStudioSelection((current) => ({ ...current, decorModelId: next.id }));
    setWorkspaceTab('decors3d');
  }, [patchStudioProject, setWorkspaceTab, studioProject.decorModels3d]);

  const renameStudioCharacter = useCallback((modelId, name) => {
    patchStudioProject((draft) => {
      const model = (draft.characterModels3d || []).find((entry) => entry.id === modelId);
      if (model) model.name = name;
    });
  }, [patchStudioProject]);

  const renameStudioDecor = useCallback((modelId, name) => {
    patchStudioProject((draft) => {
      const model = (draft.decorModels3d || []).find((entry) => entry.id === modelId);
      if (model) model.name = name;
    });
  }, [patchStudioProject]);

  const deleteStudioCharacter = useCallback((modelId) => {
    patchStudioProject((draft) => {
      draft.characterModels3d = (draft.characterModels3d || []).filter((model) => model.id !== modelId);
    });
    patchConfig((next) => {
      if (next.player.characterModel3dId === modelId) applyCharacterModelToActor(next.player, null);
      (next.heroes || []).forEach((hero) => {
        if (hero.characterModel3dId === modelId) applyCharacterModelToActor(hero, null);
      });
      (next.enemies || []).forEach((enemy) => {
        if (enemy.characterModel3dId === modelId) applyCharacterModelToActor(enemy, null);
      });
    }, false);
    setStudioSelection((current) => (
      current.characterModelId === modelId ? { ...current, characterModelId: '' } : current
    ));
  }, [applyCharacterModelToActor, patchConfig, patchStudioProject]);

  const deleteStudioDecor = useCallback((modelId) => {
    patchStudioProject((draft) => {
      draft.decorModels3d = (draft.decorModels3d || []).filter((model) => model.id !== modelId);
    });
    setStudioSelection((current) => (
      current.decorModelId === modelId ? { ...current, decorModelId: '' } : current
    ));
  }, [patchStudioProject]);

  const editStudioCharacter = useCallback((modelId) => {
    setStudioSelection((current) => ({ ...current, characterModelId: modelId }));
    setWorkspaceTab('characters3d');
  }, [setWorkspaceTab]);

  const editStudioDecor = useCallback((modelId) => {
    setStudioSelection((current) => ({ ...current, decorModelId: modelId }));
    setWorkspaceTab('decors3d');
  }, [setWorkspaceTab]);

  const handleStudioUpload = useCallback(async (event, callback) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imageData = await readArcadeImageFile(file);
      const asset = {
        id: createId('arcade-asset'),
        name: file.name || 'image',
        type: 'image',
        url: imageData,
        size: file.size || 0,
        storageMode: 'local',
      };
      pushHistorySnapshot();
      setStudioProject((current) => {
        const next = {
          ...current,
          mediaAssets: [asset, ...(current.mediaAssets || []).filter((item) => item.url !== imageData)],
        };
        studioProjectRef.current = next;
        return next;
      });
      markAutosaveDirty();
      setMediaError('');
      callback?.(imageData, asset.name);
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    } finally {
      event.target.value = '';
    }
  }, [createId, markAutosaveDirty, pushHistorySnapshot, readArcadeImageFile, setMediaError, setStudioProject, studioProjectRef]);

  const setPlayerCharacterImage = useCallback(async (file) => {
    if (!file) return;
    try {
      const imageData = await readArcadeImageFile(file);
      setMediaError('');
      patchConfig((next) => {
        const hadImage = Boolean(next.player.characterImageData);
        next.player.characterImageData = imageData;
        next.player.characterImageName = file.name || 'heros';
        next.player.characterModel3dId = '';
        next.player.characterModelUrl = '';
        next.player.characterModelName = '';
        next.player.characterModelResources = [];
        next.player.characterModelAnimations = {};
        if (!hadImage) next.player.characterRenderMode = guessCharacterRenderMode(file.name || '');
        if (!next.player.characterModelScale) next.player.characterModelScale = 1;
        if (!next.player.characterModelScaleX) next.player.characterModelScaleX = next.player.characterModelScale;
        if (!next.player.characterModelScaleY) next.player.characterModelScaleY = next.player.characterModelScale;
        if (!next.player.characterModelScaleZ) next.player.characterModelScaleZ = next.player.characterModelScale;
        next.player.characterModelScaleProportional = next.player.characterModelScaleProportional !== false;
        next.player.characterMaterialBrightness = 1;
      });
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    }
  }, [guessCharacterRenderMode, patchConfig, readArcadeImageFile, setMediaError]);

  const setSelectedPropImage = useCallback(async (file) => {
    if (!file || selected?.type !== 'prop') return;
    const target = { ...selected };
    try {
      const imageData = await readArcadeImageFile(file);
      setMediaError('');
      patchConfig((next) => {
        const selectedEntity = getSelectedEntity(next, target);
        if (!selectedEntity?.item) return;
        const prop = selectedEntity.item;
        const renderMode = prop.renderMode || guessPropRenderMode(file.name || '');
        prop.imageData = imageData;
        prop.imageName = file.name || 'decor';
        prop.renderMode = renderMode;
        prop.blocksMovement = shouldPropBlockByMode(renderMode);
        if (renderMode === 'floor') {
          const tileSize = getFloorTileWorldSize(prop);
          prop.floorZeroZ = getFloorZeroZ(prop);
          prop.w = tileSize;
          prop.h = tileSize;
          prop.r = Math.round(tileSize / 2);
          prop.modelHeight = 12;
        } else {
          prop.w = Math.round(getPropWidth(prop));
          prop.h = Math.round(getPropHeight(prop));
          prop.modelHeight = Math.round(getPropModelHeight(prop));
        }
      });
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    }
  }, [guessPropRenderMode, patchConfig, readArcadeImageFile, selected, setMediaError, shouldPropBlockByMode]);

  const importStudioCharacterToCanvas = useCallback((model) => {
    if (!model) return;
    let placedEntity = null;
    patchConfig((next) => {
      const position = getCurrentPlacementPoint(next);
      const axisScale = getCharacterModelAxisScale(model);
      if ((model.role || 'hero') === 'hero') {
        next.heroes = Array.isArray(next.heroes) ? next.heroes : [];
        const item = {
          id: createId('hero'),
          name: model.name || 'Héros',
          x: position.x,
          y: position.y,
          z: 0,
          rotation: 0,
          character: 'runner',
          characterImageData: '',
          characterImageName: '',
          characterModel3dId: '',
          characterModelUrl: '',
          characterModelName: '',
          characterModelResources: [],
          characterModelAnimations: {},
          characterRenderMode: getStudioCharacterRenderMode(model),
          characterModelScale: axisScale.y,
          characterModelScaleX: axisScale.x,
          characterModelScaleY: axisScale.y,
          characterModelScaleZ: axisScale.z,
          characterModelScaleProportional: model.characterModelScaleProportional !== false,
          characterMaterialBrightness: 1,
          sourceCharacterRole: 'hero',
        };
        if (getStudioModelSource(model)) applyCharacterModelToActor(item, model, studioProject.decorModels3d || []);
        next.heroes.push(item);
        placedEntity = { type: 'hero', id: item.id };
        return;
      }

      next.enemies = Array.isArray(next.enemies) ? next.enemies : [];
      const item = {
        id: createId('enemy'),
        x: position.x,
        y: position.y,
        z: 0,
        rotation: 0,
        role: 'rifle',
        character: 'guard',
        characterImageData: '',
        characterImageName: '',
        characterModel3dId: '',
        characterModelUrl: '',
        characterModelName: '',
        characterModelResources: [],
        characterModelAnimations: {},
        characterRenderMode: getStudioCharacterRenderMode(model),
        characterModelScale: axisScale.y,
        characterModelScaleX: axisScale.x,
        characterModelScaleY: axisScale.y,
        characterModelScaleZ: axisScale.z,
        characterModelScaleProportional: model.characterModelScaleProportional !== false,
        characterMaterialBrightness: 1,
        sourceCharacterRole: model.role || 'enemy',
        combatEnemyName: model.name || 'Personnage',
        combatEnemyMaxHealth: 8,
        combatEnemyStrength: 2,
        combatEnemyMaxMana: 0,
        combatEnemyPowerManaCost: 3,
        combatEnemyPowerDamage: 0,
        combatEnemyPowerUsageChance: 25,
      };
      if (getStudioModelSource(model)) applyCharacterModelToActor(item, model, studioProject.decorModels3d || []);
      next.enemies.push(item);
      placedEntity = { type: 'enemy', id: item.id };
    });
    beginEntityPlacement(placedEntity);
  }, [
    applyCharacterModelToActor,
    beginEntityPlacement,
    createId,
    getCurrentPlacementPoint,
    getStudioCharacterRenderMode,
    patchConfig,
    studioProject.decorModels3d,
  ]);

  const importStudioDecorToCanvas = useCallback((model) => {
    if (!model) return;
    let placedEntity = null;
    patchConfig((next) => {
      next.props = Array.isArray(next.props) ? next.props : [];
      const position = getCurrentPlacementPoint(next);
      const renderMode = getDecorImportRenderMode(model);
      const source = getStudioModelSource(model);
      const size = getDecorModelWorldSize(model);
      const tileSize = renderMode === 'floor' ? Math.max(size.width, size.depth) : 0;
      const item = {
        id: createId('prop'),
        name: model.name || 'Objet 3D',
        decorKind: getStudioDecorKindId(model.kind),
        x: position.x,
        y: position.y,
        z: 0,
        floorZeroZ: getFloorZeroZ(model),
        rotation: 0,
        modelRotationX: getModelRotationValue(model, 'modelRotationX'),
        modelRotationY: getModelRotationValue(model, 'modelRotationY'),
        modelRotationZ: getModelRotationValue(model, 'modelRotationZ'),
        modelCenterOnOrigin: Boolean(model.modelCenterOnOrigin),
        modelFlushToGround: Boolean(model.modelFlushToGround),
        r: Math.round((tileSize || Math.max(size.width, size.depth)) / 2),
        w: tileSize || size.width,
        h: tileSize || size.depth,
        modelHeight: renderMode === 'floor' ? 12 : size.height,
        renderMode,
        blocksMovement: model.collision ?? shouldPropBlockByMode(renderMode),
        imageData: source ? '' : (model.imageData || ''),
        imageName: source ? '' : (model.imageName || ''),
        repeatTexture: source ? false : Boolean(model.repeatTexture),
        decorModel3dId: model.id || '',
        decorModelUrl: source,
        decorModelName: model.modelName || model.name || '',
        decorLocalModelFileId: model.localModelFileId || '',
        modelFormat: model.modelFormat || '',
        modelFileSize: Number(model.modelFileSize) || 0,
        modelResources: Array.isArray(model.modelResources) ? model.modelResources : [],
        materialBrightness: getDecorMaterialBrightness(model),
        decorModelScale: 1,
        baseColor: model.baseColor || '#64748b',
        accentColor: model.accentColor || '#f59e0b',
        roofColor: model.roofColor || '#7f1d1d',
      };
      next.props.push(item);
      placedEntity = { type: 'prop', id: item.id };
    });
    beginEntityPlacement(placedEntity);
  }, [
    beginEntityPlacement,
    createId,
    getCurrentPlacementPoint,
    getDecorImportRenderMode,
    getDecorModelWorldSize,
    getModelRotationValue,
    patchConfig,
    shouldPropBlockByMode,
  ]);

  return {
    createStudioCharacter,
    createStudioDecor,
    deleteStudioCharacter,
    deleteStudioDecor,
    editStudioCharacter,
    editStudioDecor,
    handleStudioUpload,
    importStudioCharacterToCanvas,
    importStudioDecorToCanvas,
    renameStudioCharacter,
    renameStudioDecor,
    setPlayerCharacterImage,
    setSelectedPropImage,
    setStudioSelection,
    studioSelection,
  };
}

export default useRpg3DStudioAssets;
