import { useCallback, useEffect, useRef } from 'react';
import {
  DEFAULT_ARCADE_CONFIG,
  PLAYER_RADIUS,
  clamp,
  getActionZoneType,
  getControlledPlayerSource,
  getEnemyStats,
  getPlayerControlNumber,
  getPropHeight,
  getPropWidth,
  getReliefHeight,
  getReliefWidth,
} from '../utils/rpg3dDomain.js';
import { isPointInActionZone } from '../utils/rpg3dMapEditing.js';

export const ENEMY_RADIUS = 16;
export const BULLET_RADIUS = 4;
export const DASH_DURATION = 0.16;
export const ARCADE_MAX_PARTICLES = 90;
export const ARCADE_SNAPSHOT_INTERVAL_MS = 320;

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const normalizeVector = (x, y) => {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};

export const getRuntimePowerColor = (type = 'fire') => ({
  lightning: '#c4b5fd',
  water: '#67e8f9',
  earth: '#86efac',
  fire: '#f97316',
}[type] || '#f97316');

export const getPropRuntimeRect = (prop = {}) => ({
  x: prop.x - getPropWidth(prop) / 2,
  y: prop.y - getPropHeight(prop) / 2,
  w: getPropWidth(prop),
  h: getPropHeight(prop),
});

export const getReliefRuntimeRect = (relief = {}) => ({
  x: relief.x - getReliefWidth(relief) / 2,
  y: relief.y - getReliefHeight(relief) / 2,
  w: getReliefWidth(relief),
  h: getReliefHeight(relief),
});

export const getBlockingObstacles = (config = {}) => [
  ...(config.obstacles || []),
  ...((config.reliefs || []).filter((relief) => relief.blocksMovement).map(getReliefRuntimeRect)),
  ...((config.props || []).filter((prop) => prop.blocksMovement).map(getPropRuntimeRect)),
];

export const rectCircleOverlap = (rect, circle) => {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.r;
};

export const pushCircleOutOfRect = (circle, rect) => {
  if (!rectCircleOverlap(rect, circle)) return circle;
  const left = Math.abs(circle.x - rect.x);
  const right = Math.abs(rect.x + rect.w - circle.x);
  const top = Math.abs(circle.y - rect.y);
  const bottom = Math.abs(rect.y + rect.h - circle.y);
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { ...circle, x: rect.x - circle.r };
  if (min === right) return { ...circle, x: rect.x + rect.w + circle.r };
  if (min === top) return { ...circle, y: rect.y - circle.r };
  return { ...circle, y: rect.y + rect.h + circle.r };
};

export const hasLineOfSight = (from, to, obstacles) => {
  const steps = Math.max(8, Math.ceil(distance(from, to) / 42));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      r: 7,
    };
    if (obstacles.some((obstacle) => rectCircleOverlap(obstacle, point))) return false;
  }
  return true;
};

export const resolveMapCollision = (entity, radius, config = DEFAULT_ARCADE_CONFIG, blockingObstacles = null) => {
  let next = {
    ...entity,
    x: clamp(entity.x, radius, config.world.width - radius),
    y: clamp(entity.y, radius, config.world.height - radius),
    r: radius,
  };
  const obstacles = blockingObstacles || getBlockingObstacles(config);
  obstacles.forEach((obstacle) => {
    next = pushCircleOutOfRect(next, obstacle);
  });
  return { ...entity, x: next.x, y: next.y };
};

export const emitParticles = (
  state,
  x,
  y,
  color,
  count = 8,
  { random = Math.random, maxParticles = ARCADE_MAX_PARTICLES } = {},
) => {
  const particles = state.particles || [];
  state.particles = particles;
  if (particles.length > maxParticles) {
    particles.splice(0, particles.length - maxParticles);
  }
  const availableSlots = Math.max(0, maxParticles - particles.length);
  const particleCount = Math.min(count, availableSlots);
  for (let i = 0; i < particleCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const speed = 55 + random() * 160;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + random() * 0.35,
      maxLife: 0.7,
      color,
    });
  }
  return particles;
};

export const createBullet = (
  owner,
  from,
  target,
  speed,
  damage,
  color,
  spread = 0,
  { random = Math.random, now = () => performance.now() } = {},
) => {
  const angle = Math.atan2(target.y - from.y, target.x - from.x) + (random() - 0.5) * spread;
  return {
    id: `${owner}-${now()}-${random()}`,
    owner,
    x: from.x,
    y: from.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    color,
    life: owner === 'player' ? 1.2 : 1.85,
  };
};

export const fireBullet = (state, owner, from, target, speed, damage, color, spread = 0, options = {}) => {
  state.bullets = Array.isArray(state.bullets) ? state.bullets : [];
  const bullet = createBullet(owner, from, target, speed, damage, color, spread, options);
  state.bullets.push(bullet);
  return bullet;
};

export const applyPlayerMoveTarget = (state, config, point) => {
  if (!point) return false;
  const liveConfig = config || DEFAULT_ARCADE_CONFIG;
  const player = state?.player;
  if (!player || !liveConfig?.world) return false;
  const target = {
    x: clamp(Number(point.x) || 0, PLAYER_RADIUS, liveConfig.world.width - PLAYER_RADIUS),
    y: clamp(Number(point.y) || 0, PLAYER_RADIUS, liveConfig.world.height - PLAYER_RADIUS),
  };
  const deltaX = target.x - player.x;
  const deltaY = target.y - player.y;
  const targetDistance = Math.hypot(deltaX, deltaY);
  if (targetDistance < PLAYER_RADIUS + 4) {
    player.moveTarget = null;
    player.vx = 0;
    player.vy = 0;
  } else {
    player.moveTarget = target;
    const input = normalizeVector(deltaX, deltaY);
    const playerControl = getControlledPlayerSource(liveConfig, player.controlledHeroId);
    const speed = player.dash > 0
      ? getPlayerControlNumber(playerControl, 'dashSpeed', DEFAULT_ARCADE_CONFIG.player.dashSpeed)
      : getPlayerControlNumber(playerControl, 'speed', DEFAULT_ARCADE_CONFIG.player.speed);
    player.vx = input.x * speed;
    player.vy = input.y * speed;
  }
  return true;
};

export function useRpg3DGameLoop({
  activateRpg3DCanvasPortal,
  actionZoneTriggerRef,
  configRef,
  getActionZoneNpcLabel,
  getNpcChoiceItems,
  getNpcInteractionMode,
  getNpcQuestionText,
  isPaused,
  lastFrameRef,
  mode,
  setActiveNpcChoice,
  setIsPaused,
  setSnapshot,
  snapshot,
  stateRef,
  workspaceTab,
}) {
  const keysRef = useRef(new Set());
  const pointerRef = useRef({ x: 0, y: 0, shooting: false, worldX: 0, worldY: 0, hasWorldPoint: false });
  const animationRef = useRef(0);
  const snapshotFrameRef = useRef(0);
  const fallbackLastFrameRef = useRef(0);
  const runtimeLastFrameRef = lastFrameRef || fallbackLastFrameRef;

  const clearInputState = useCallback(() => {
    keysRef.current.clear();
    pointerRef.current.shooting = false;
  }, []);

  const emitRuntimeParticles = useCallback((x, y, color, count = 8) => {
    emitParticles(stateRef.current, x, y, color, count);
  }, [stateRef]);

  const fireRuntimeBullet = useCallback((owner, from, target, speed, damage, color, spread = 0) => {
    fireBullet(stateRef.current, owner, from, target, speed, damage, color, spread);
  }, [stateRef]);

  const resolveRuntimeMapCollision = useCallback((entity, radius, blockingObstacles = null) => (
    resolveMapCollision(entity, radius, configRef.current, blockingObstacles)
  ), [configRef]);

  const updateGame = useCallback((dt) => {
    const liveConfig = configRef.current;
    const state = stateRef.current;
    const hasConfiguredEnemies = (liveConfig.enemies || []).length > 0;
    if (!hasConfiguredEnemies && state.victory) state.victory = false;
    if (mode !== 'play' || state.gameOver || state.victory) return;
    state.time += dt;
    state.actionMessageTimer = Math.max(0, (Number(state.actionMessageTimer) || 0) - dt);
    if (state.actionMessageTimer <= 0) state.actionMessage = '';
    const blockingObstacles = getBlockingObstacles(liveConfig);
    const player = state.player;
    const playerControl = getControlledPlayerSource(liveConfig, player.controlledHeroId);
    const keys = keysRef.current;
    const aim = pointerRef.current;

    let inputX = 0;
    let inputY = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) inputY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) inputY += 1;
    const hasKeyboardMove = Boolean(inputX || inputY);
    if (!hasKeyboardMove && player.moveTarget) {
      const targetDistance = Math.hypot(player.moveTarget.x - player.x, player.moveTarget.y - player.y);
      if (targetDistance < PLAYER_RADIUS + 4) {
        player.moveTarget = null;
      } else {
        inputX = player.moveTarget.x - player.x;
        inputY = player.moveTarget.y - player.y;
      }
    }
    if (hasKeyboardMove) player.moveTarget = null;
    const input = normalizeVector(inputX, inputY);

    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
    player.powerCooldown = Math.max(0, player.powerCooldown - dt);
    player.attackTimer = Math.max(0, (Number(player.attackTimer) || 0) - dt);
    if (keys.has('Space') && player.dashCooldown <= 0 && (input.x || input.y)) {
      player.dash = DASH_DURATION;
      player.dashCooldown = getPlayerControlNumber(playerControl, 'dashCooldown', DEFAULT_ARCADE_CONFIG.player.dashCooldown);
    }
    if (player.dash > 0) {
      player.dash -= dt;
      const dashSpeed = getPlayerControlNumber(playerControl, 'dashSpeed', DEFAULT_ARCADE_CONFIG.player.dashSpeed);
      player.vx = input.x * dashSpeed;
      player.vy = input.y * dashSpeed;
    } else {
      const speed = getPlayerControlNumber(playerControl, 'speed', DEFAULT_ARCADE_CONFIG.player.speed);
      player.vx = input.x * speed;
      player.vy = input.y * speed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    Object.assign(player, resolveRuntimeMapCollision(player, PLAYER_RADIUS, blockingObstacles));

    if ((aim.shooting || keys.has('KeyF')) && player.shootCooldown <= 0) {
      const attackSkill = playerControl.skills?.[0] || { value: 3, manaCost: 0 };
      const manaCost = Math.max(0, Number(attackSkill.manaCost) || 0);
      if (player.mana >= manaCost) {
        player.mana -= manaCost;
        player.attackTimer = 0.34;
        const bulletSpeed = getPlayerControlNumber(playerControl, 'bulletSpeed', DEFAULT_ARCADE_CONFIG.player.bulletSpeed);
        fireRuntimeBullet('player', player, { x: aim.worldX, y: aim.worldY }, bulletSpeed, Math.max(1, (Number(attackSkill.value) || 0) * 7), '#8df7ff', 0.05);
      }
      player.shootCooldown = getPlayerControlNumber(playerControl, 'fireRate', DEFAULT_ARCADE_CONFIG.player.fireRate);
      emitRuntimeParticles(player.x, player.y, '#8df7ff', 2);
    }

    const power = playerControl.powers?.[0];
    if ((keys.has('KeyQ') || keys.has('KeyE')) && power && player.powerCooldown <= 0) {
      const manaCost = Math.max(0, Number(power.manaCost) || 0);
      if (player.mana >= manaCost) {
        player.mana -= manaCost;
        player.powerCooldown = 0.65;
        player.attackTimer = 0.45;
        const color = getRuntimePowerColor(power.type);
        const bulletSpeed = getPlayerControlNumber(playerControl, 'bulletSpeed', DEFAULT_ARCADE_CONFIG.player.bulletSpeed);
        fireRuntimeBullet('player', player, { x: aim.worldX, y: aim.worldY }, bulletSpeed * 0.86, Math.max(1, (Number(power.force) || 0) * 10), color, 0.02);
        emitRuntimeParticles(player.x, player.y, color, 12);
      }
    }

    state.pickups = state.pickups.filter((pickup) => {
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > 34) return true;
      if (pickup.type === 'health') player.hp = Math.min(player.maxHp, player.hp + 28);
      if (pickup.type === 'mana') player.mana = Math.min(player.maxMana, player.mana + 4);
      if (pickup.type === 'energy') player.dashCooldown = 0;
      emitRuntimeParticles(pickup.x, pickup.y, pickup.type === 'health' ? '#7ef29d' : pickup.type === 'mana' ? '#67e8f9' : '#ffdf6c', 14);
      return false;
    });

    const activeActionZone = (liveConfig.actionZones || []).find((zone) => isPointInActionZone(zone, player));
    if (activeActionZone) {
      const now = performance.now();
      const actionType = getActionZoneType(activeActionZone);
      const triggerKey = `${actionType}:${activeActionZone.id || ''}:${activeActionZone.targetCanvasId || ''}:${activeActionZone.targetNpcId || ''}`;
      if (now >= (actionZoneTriggerRef.current.cooldownUntil || 0) && actionZoneTriggerRef.current.key !== triggerKey) {
        actionZoneTriggerRef.current = { key: triggerKey, cooldownUntil: now + 950 };
        if (actionType === 'portal' && activeActionZone.targetCanvasId) {
          emitRuntimeParticles(player.x, player.y, '#38bdf8', 18);
          if (activateRpg3DCanvasPortal(activeActionZone.targetCanvasId)) return;
        } else if (actionType === 'npcAction') {
          if (getNpcInteractionMode(activeActionZone) === 'multipleChoice') {
            setActiveNpcChoice({
              zoneId: activeActionZone.id,
              speaker: getActionZoneNpcLabel(liveConfig, activeActionZone.targetNpcId),
              question: getNpcQuestionText(activeActionZone),
              choices: getNpcChoiceItems(activeActionZone).filter((choice) => String(choice.label || '').trim()),
            });
            setIsPaused(true);
            emitRuntimeParticles(player.x, player.y, '#facc15', 12);
          } else {
            state.actionMessage = activeActionZone.message || activeActionZone.npcAction || 'Action PNJ';
            state.actionMessageTimer = 2.4;
            emitRuntimeParticles(player.x, player.y, '#facc15', 12);
          }
        }
      }
    } else if (actionZoneTriggerRef.current.key) {
      actionZoneTriggerRef.current = { key: '', cooldownUntil: actionZoneTriggerRef.current.cooldownUntil || 0 };
    }

    state.enemies.forEach((enemy) => {
      const stats = getEnemyStats(enemy);
      const toPlayer = normalizeVector(player.x - enemy.x, player.y - enemy.y);
      const playerDistance = distance(enemy, player);
      const canSee = playerDistance < liveConfig.ai.visionRange && hasLineOfSight(enemy, player, blockingObstacles);
      enemy.alert = canSee && playerDistance < liveConfig.ai.visionRange ? 1 : Math.max(0, enemy.alert - dt * 0.35);
      enemy.strafeTimer -= dt;
      if (enemy.strafeTimer <= 0) {
        enemy.strafeTimer = 0.8 + Math.random() * 1.2;
        enemy.strafeDir *= -1;
      }
      const rangeMove = playerDistance > stats.range ? 1 : playerDistance < stats.range - 110 ? -0.8 : 0.1;
      const strafe = enemy.alert ? enemy.strafeDir * 0.68 : 0;
      let moveX = toPlayer.x * rangeMove + -toPlayer.y * strafe;
      let moveY = toPlayer.y * rangeMove + toPlayer.x * strafe;

      blockingObstacles.forEach((obstacle) => {
        const expanded = {
          x: obstacle.x - liveConfig.ai.obstacleAvoidance,
          y: obstacle.y - liveConfig.ai.obstacleAvoidance,
          w: obstacle.w + liveConfig.ai.obstacleAvoidance * 2,
          h: obstacle.h + liveConfig.ai.obstacleAvoidance * 2,
        };
        if (rectCircleOverlap(expanded, { x: enemy.x, y: enemy.y, r: 1 })) {
          const center = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h / 2 };
          const away = normalizeVector(enemy.x - center.x, enemy.y - center.y);
          moveX += away.x * 1.1;
          moveY += away.y * 1.1;
        }
      });

      const move = normalizeVector(moveX, moveY);
      enemy.vx = move.x * stats.speed * liveConfig.ai.aggression;
      enemy.vy = move.y * stats.speed * liveConfig.ai.aggression;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      Object.assign(enemy, resolveRuntimeMapCollision(enemy, ENEMY_RADIUS, blockingObstacles));

      enemy.shootTimer -= dt;
      enemy.attackTimer = Math.max(0, (Number(enemy.attackTimer) || 0) - dt);
      if (enemy.alert && canSee && enemy.shootTimer <= 0) {
        const canUsePower = stats.powerDamage > 0 && enemy.mana >= stats.powerManaCost && Math.random() * 100 < stats.powerUsageChance;
        if (canUsePower) enemy.mana -= stats.powerManaCost;
        const baseShotDamage = canUsePower ? stats.powerDamage : stats.damage;
        const isCriticalShot = Math.random() * 100 < stats.criticalChance;
        const shotDamage = Math.max(1, Math.round(baseShotDamage * (isCriticalShot ? stats.criticalMultiplier : 1)));
        fireRuntimeBullet(
          'enemy',
          enemy,
          player,
          stats.bulletSpeed,
          shotDamage,
          isCriticalShot ? '#fde047' : canUsePower ? '#c4b5fd' : enemy.role === 'brute' ? '#ffb36d' : '#ff776d',
          stats.spread,
        );
        enemy.attackTimer = 0.35;
        if (enemy.role === 'brute') {
          fireRuntimeBullet('enemy', enemy, { x: player.x + 40, y: player.y }, 390, 8, '#ffb36d', 0.18);
        }
        enemy.shootTimer = stats.delay;
      }
    });

    state.bullets = state.bullets
      .map((bullet) => ({
        ...bullet,
        x: bullet.x + bullet.vx * dt,
        y: bullet.y + bullet.vy * dt,
        life: bullet.life - dt,
      }))
      .filter((bullet) => {
        if (bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > liveConfig.world.width || bullet.y > liveConfig.world.height) return false;
        if (blockingObstacles.some((obstacle) => rectCircleOverlap(obstacle, { x: bullet.x, y: bullet.y, r: BULLET_RADIUS }))) {
          emitRuntimeParticles(bullet.x, bullet.y, '#9fb0cc', 5);
          return false;
        }
        if (bullet.owner === 'player') {
          const target = state.enemies.find((enemy) => Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < ENEMY_RADIUS + BULLET_RADIUS);
          if (!target) return true;
          target.hp -= bullet.damage;
          state.score += 12;
          emitRuntimeParticles(bullet.x, bullet.y, '#8df7ff', 7);
          return false;
        }
        if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER_RADIUS + BULLET_RADIUS) {
          player.hp -= bullet.damage;
          emitRuntimeParticles(bullet.x, bullet.y, '#ff776d', 10);
          if (player.hp <= 0) state.gameOver = true;
          return false;
        }
        return true;
      });

    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp > 0) return true;
      state.score += getEnemyStats(enemy).score;
      emitRuntimeParticles(enemy.x, enemy.y, '#ffdf6c', 18);
      return false;
    });

    state.particles = state.particles
      .map((particle) => ({
        ...particle,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        life: particle.life - dt,
        vx: particle.vx * 0.92,
        vy: particle.vy * 0.92,
      }))
      .filter((particle) => particle.life > 0);

    if (hasConfiguredEnemies && state.enemies.length === 0) state.victory = true;
  }, [
    actionZoneTriggerRef,
    activateRpg3DCanvasPortal,
    configRef,
    fireRuntimeBullet,
    getActionZoneNpcLabel,
    getNpcChoiceItems,
    getNpcInteractionMode,
    getNpcQuestionText,
    mode,
    resolveRuntimeMapCollision,
    setActiveNpcChoice,
    setIsPaused,
    emitRuntimeParticles,
    stateRef,
  ]);

  useEffect(() => {
    if (mode !== 'play' || workspaceTab !== 'arcade') {
      runtimeLastFrameRef.current = 0;
      return undefined;
    }

    const loop = (timestamp) => {
      const last = runtimeLastFrameRef.current || timestamp;
      const dt = Math.min(0.033, (timestamp - last) / 1000);
      runtimeLastFrameRef.current = timestamp;
      if (!isPaused) updateGame(dt);
      if (timestamp - snapshotFrameRef.current > ARCADE_SNAPSHOT_INTERVAL_MS) {
        snapshotFrameRef.current = timestamp;
        const nextState = stateRef.current;
        const nextActionMessage = nextState.actionMessageTimer > 0 ? nextState.actionMessage : '';
        const nextDashReady = nextState.player.dashCooldown <= 0;
        setSnapshot((current) => {
          const currentActionMessage = current.actionMessageTimer > 0 ? current.actionMessage : '';
          const currentDashReady = current.player.dashCooldown <= 0;
          if (currentActionMessage === nextActionMessage && currentDashReady === nextDashReady) return current;
          return {
            ...nextState,
            actionMessage: nextActionMessage,
            player: { ...nextState.player },
          };
        });
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPaused, mode, runtimeLastFrameRef, setSnapshot, stateRef, updateGame, workspaceTab]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.code === 'KeyP') setIsPaused((paused) => !paused);
      keysRef.current.add(event.code);
    };
    const handleKeyUp = (event) => keysRef.current.delete(event.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setIsPaused]);

  const updateWorldPointer = useCallback(({ x, y, screenX, screenY }) => {
    if (Number.isFinite(screenX)) pointerRef.current.x = screenX;
    if (Number.isFinite(screenY)) pointerRef.current.y = screenY;
    if (Number.isFinite(x)) {
      pointerRef.current.worldX = x;
      pointerRef.current.hasWorldPoint = true;
    }
    if (Number.isFinite(y)) {
      pointerRef.current.worldY = y;
      pointerRef.current.hasWorldPoint = true;
    }
  }, []);

  const setPointerShooting = useCallback((shooting) => {
    pointerRef.current.shooting = shooting;
  }, []);

  const setPlayerMoveTarget = useCallback((point) => {
    if (applyPlayerMoveTarget(stateRef.current, configRef.current || DEFAULT_ARCADE_CONFIG, point)) {
      setSnapshot({ ...stateRef.current, player: { ...stateRef.current.player } });
    }
  }, [configRef, setSnapshot, stateRef]);

  return {
    clearInputState,
    keysRef,
    pointerRef,
    setPlayerMoveTarget,
    setPointerShooting,
    snapshot,
    stateRef,
    updateGame,
    updateWorldPointer,
  };
}

export default useRpg3DGameLoop;
