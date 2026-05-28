import {
  PLAYER_RADIUS,
  getCharacterModelScale,
} from '../../utils/rpg3dDomain.js';
import {
  ENEMY_RADIUS,
  addActor,
  addBullet,
  addParticle,
  addPickup,
  clearGroup,
  getActorVisualSignature,
  getCharacterPreset,
  getCharacterRenderMode,
  getEnemyCharacterId,
  getEntityKey,
  getEntityLift,
  getHeroCharacterId,
  isSelectionActive,
  syncEditableDynamicEntities,
  updateDynamicTransforms,
  updateFingerTipsWeaponSockets,
} from './rpg3dSceneBuilders.js';
import {
  getActorMovementFacingTarget,
  hashString,
} from './rpg3dRuntimeModels.js';
import { DYNAMIC_SELECTION_TYPES } from './rpg3dViewportPicking.js';

export const syncViewportDynamicScene = ({
  createViewportModelGetter,
  dynamicFrameRef,
  dynamicGroup,
  getActorSupportHeight,
  getCachedTexture,
  latest,
  liveConfig,
  player,
  playMode,
  queueRender,
  state,
  timestamp,
}) => {
  const now = performance.now();
  const dynamicSelectedKey = [
    DYNAMIC_SELECTION_TYPES.has(latest.selected?.type) ? `${latest.selected.type}:${latest.selected.id}` : 'none',
    (latest.multiSelected || [])
      .filter((entry) => DYNAMIC_SELECTION_TYPES.has(entry?.type))
      .map(getEntityKey)
      .sort()
      .join(','),
  ].join('|');
  const controlledHeroId = playMode ? state.player?.controlledHeroId : '';
  const dynamicHeroes = (liveConfig.heroes || []).filter((hero) => hero.id !== controlledHeroId);
  const dynamicEnemies = playMode ? state.enemies : liveConfig.enemies;
  const dynamicPickups = playMode ? state.pickups : liveConfig.pickups;
  if (playMode) {
    updateDynamicTransforms(dynamicGroup, liveConfig, state, {
      playMode,
      getSupportHeight: getActorSupportHeight,
    });
  } else {
    updateFingerTipsWeaponSockets(dynamicGroup);
  }
  const heroVisualSignature = dynamicHeroes.map((hero) => [
    getActorVisualSignature(hero),
    playMode ? '' : `${Math.round(hero.x)}:${Math.round(hero.y)}`,
  ].join(':')).join(';');
  const enemyVisualSignature = dynamicEnemies.map((enemy) => [
    enemy.id,
    enemy.alert ? 1 : 0,
    playMode ? '' : `${Math.round(enemy.x)}:${Math.round(enemy.y)}`,
    getActorVisualSignature(enemy),
  ].join(':')).join(';');
  const pickupVisualSignature = dynamicPickups.map((pickup) => [
    pickup.id,
    pickup.type,
    Math.round(getEntityLift(pickup)),
    playMode ? '' : `${Math.round(pickup.x)}:${Math.round(pickup.y)}`,
  ].join(':')).join(';');
  const forceSignature = [
    latest.mode,
    dynamicSelectedKey,
    controlledHeroId,
    playMode ? getActorVisualSignature(state.player) : '',
    heroVisualSignature,
    enemyVisualSignature,
    pickupVisualSignature,
  ].join('|');
  const dynamicSignature = forceSignature;
  const minInterval = playMode ? 90 : 1000;
  const shouldRefreshDynamic = dynamicFrameRef.current.forceSignature !== forceSignature
    || (
      dynamicFrameRef.current.signature !== dynamicSignature
      && now - dynamicFrameRef.current.lastTime > minInterval
    );

  if (!shouldRefreshDynamic) return false;
  dynamicFrameRef.current = { signature: dynamicSignature, forceSignature, lastTime: now };
  const getTexture = getCachedTexture();
  const getModel = createViewportModelGetter(() => {
    dynamicFrameRef.current.forceSignature = '';
    queueRender({ followupFrames: 2 });
  });
  if (!playMode) {
    syncEditableDynamicEntities(dynamicGroup, liveConfig, {
      selected: latest.selected,
      multiSelected: latest.multiSelected,
      getTexture,
      getModel,
      animationTime: state.time || timestamp * 0.001,
      getSupportHeight: getActorSupportHeight,
    });
    return true;
  }

  clearGroup(dynamicGroup);
  dynamicPickups.forEach((pickup) => addPickup(dynamicGroup, liveConfig, pickup, isSelectionActive('pickup', pickup.id, latest.selected, latest.multiSelected), state.time || 0));

  state.bullets.forEach((bullet) => addBullet(dynamicGroup, liveConfig, bullet));
  state.particles.forEach((particle, index) => addParticle(dynamicGroup, liveConfig, particle, index));

  dynamicHeroes.forEach((hero) => {
    addActor(dynamicGroup, liveConfig, hero, {
      type: 'hero',
      id: hero.id,
      radius: PLAYER_RADIUS,
      preset: getCharacterPreset(getHeroCharacterId(hero), 'runner'),
      selected: isSelectionActive('hero', hero.id, latest.selected, latest.multiSelected),
      active: false,
      imageData: hero.characterImageData,
      renderMode: getCharacterRenderMode(hero),
      modelScale: getCharacterModelScale(hero),
      animationTime: (state.time || timestamp * 0.001) + Math.abs(hashString(hero.id || 'hero')) * 0.001,
      aimTarget: state.player,
      getTexture,
      getModel,
      useStoredRotation: true,
      editMode: false,
      supportHeight: getActorSupportHeight(hero),
    });
  });

  dynamicEnemies.forEach((enemy) => {
    const enemyPreset = getCharacterPreset(getEnemyCharacterId(enemy), 'guard');
    addActor(dynamicGroup, liveConfig, enemy, {
      type: 'enemy',
      id: enemy.id,
      radius: ENEMY_RADIUS,
      preset: enemyPreset,
      selected: isSelectionActive('enemy', enemy.id, latest.selected, latest.multiSelected),
      active: Boolean(enemy.alert),
      imageData: enemy.characterImageData,
      renderMode: getCharacterRenderMode(enemy),
      modelScale: getCharacterModelScale(enemy),
      animationTime: (state.time || timestamp * 0.001) + Math.abs(hashString(enemy.id || 'enemy')) * 0.001,
      aimTarget: state.player,
      getTexture,
      getModel,
      useStoredRotation: false,
      editMode: false,
      supportHeight: getActorSupportHeight(enemy),
    });
  });

  const playerVisualActor = { ...liveConfig.player, ...player };
  const playerEntityType = controlledHeroId ? 'hero' : 'player';
  const playerEntityId = controlledHeroId || 'player';
  addActor(dynamicGroup, liveConfig, playerVisualActor, {
    type: playerEntityType,
    id: playerEntityId,
    radius: PLAYER_RADIUS,
    preset: getCharacterPreset(getHeroCharacterId(playerVisualActor), 'runner'),
    selected: isSelectionActive(playerEntityType, playerEntityId, latest.selected, latest.multiSelected),
    active: player.dash > 0,
    imageData: playerVisualActor.characterImageData,
    renderMode: getCharacterRenderMode(playerVisualActor),
    modelScale: getCharacterModelScale(playerVisualActor),
    animationTime: state.time || timestamp * 0.001,
    aimTarget: getActorMovementFacingTarget(playerVisualActor),
    getTexture,
    getModel,
    editMode: false,
    supportHeight: getActorSupportHeight(playerVisualActor),
  });
  return true;
};
