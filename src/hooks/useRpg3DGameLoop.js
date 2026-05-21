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
  isFlatTileLikeProp,
} from '../utils/rpg3dDomain.js';
import { isPointInActionZone } from '../utils/rpg3dMapEditing.js';

export const ENEMY_RADIUS = 16;
export const BULLET_RADIUS = 4;
export const DASH_DURATION = 0.16;
export const ARCADE_MAX_PARTICLES = 90;
export const ARCADE_SNAPSHOT_INTERVAL_MS = 320;
const ARCADE_FALLBACK_FRAME_DT = 1 / 60;
const PLAYER_PATH_CLEARANCE = 6;
const PLAYER_PATH_SAMPLE_STEP = 8;
const PLAYER_PATH_CORRIDOR_MARGIN = 180;
const PLAYER_PATH_MAX_OBSTACLES = 96;
const PLAYER_PATH_REACHED_DISTANCE = PLAYER_RADIUS + 4;
const PLAYER_CONTINUOUS_MOVE_DISTANCE = PLAYER_RADIUS + 180;

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const normalizeVector = (x, y) => {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};

const PLAYER_MOVE_KEY_CODES = {
  left: ['KeyA', 'KeyQ', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'KeyZ', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
};

const PLAYER_PREVENT_DEFAULT_KEYS = new Set([
  'Space',
  ...PLAYER_MOVE_KEY_CODES.left,
  ...PLAYER_MOVE_KEY_CODES.right,
  ...PLAYER_MOVE_KEY_CODES.up,
  ...PLAYER_MOVE_KEY_CODES.down,
]);

const hasAnyKey = (keys, codes = []) => codes.some((code) => keys.has(code));
const isPlayerMoveKeyCode = (code) => (
  hasAnyKey(new Set([code]), [
    ...PLAYER_MOVE_KEY_CODES.left,
    ...PLAYER_MOVE_KEY_CODES.right,
    ...PLAYER_MOVE_KEY_CODES.up,
    ...PLAYER_MOVE_KEY_CODES.down,
  ])
);

export const getPlayerKeyboardInput = (keys = new Set()) => {
  let inputX = 0;
  let inputY = 0;
  if (hasAnyKey(keys, PLAYER_MOVE_KEY_CODES.left)) inputX -= 1;
  if (hasAnyKey(keys, PLAYER_MOVE_KEY_CODES.right)) inputX += 1;
  if (hasAnyKey(keys, PLAYER_MOVE_KEY_CODES.up)) inputY -= 1;
  if (hasAnyKey(keys, PLAYER_MOVE_KEY_CODES.down)) inputY += 1;
  return { inputX, inputY };
};

const getPositivePlayerControlNumber = (source = {}, field, fallback) => {
  const value = getPlayerControlNumber(source, field, fallback);
  return value > 0 ? value : fallback;
};

const getFiniteRuntimeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

const shouldPropBlockRuntimeMovement = (prop = {}) => (
  Boolean(prop.blocksMovement)
  && !isFlatTileLikeProp(prop)
);

export const getBlockingObstacles = (config = {}) => [
  ...(config.obstacles || []),
  ...((config.reliefs || []).filter((relief) => relief.blocksMovement).map(getReliefRuntimeRect)),
  ...((config.props || []).filter(shouldPropBlockRuntimeMovement).map(getPropRuntimeRect)),
];

export const getBlockingObstaclesForEntityMove = (obstacles = [], entity = {}, radius = PLAYER_RADIUS) => {
  const previousCircle = {
    x: getFiniteRuntimeNumber(entity.x, 0),
    y: getFiniteRuntimeNumber(entity.y, 0),
    r: radius,
  };
  return obstacles.filter((obstacle) => !rectCircleOverlap(obstacle, previousCircle));
};

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

const getRuntimeWorldBounds = (config = DEFAULT_ARCADE_CONFIG, radius = PLAYER_RADIUS) => {
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const width = getFiniteRuntimeNumber(world.width, DEFAULT_ARCADE_CONFIG.world.width);
  const height = getFiniteRuntimeNumber(world.height, DEFAULT_ARCADE_CONFIG.world.height);
  return {
    width,
    height,
    minX: radius,
    minY: radius,
    maxX: Math.max(radius, width - radius),
    maxY: Math.max(radius, height - radius),
  };
};

const clampRuntimePoint = (point = {}, bounds) => ({
  x: clamp(getFiniteRuntimeNumber(point.x, bounds.width / 2), bounds.minX, bounds.maxX),
  y: clamp(getFiniteRuntimeNumber(point.y, bounds.height / 2), bounds.minY, bounds.maxY),
});

const expandRuntimeObstacleForPath = (obstacle = {}, radius = PLAYER_RADIUS, clearance = PLAYER_PATH_CLEARANCE) => {
  const padding = Math.max(0, radius + clearance);
  return {
    x: getFiniteRuntimeNumber(obstacle.x, 0) - padding,
    y: getFiniteRuntimeNumber(obstacle.y, 0) - padding,
    w: Math.max(0, getFiniteRuntimeNumber(obstacle.w, 0)) + padding * 2,
    h: Math.max(0, getFiniteRuntimeNumber(obstacle.h, 0)) + padding * 2,
  };
};

const isPointInsideRuntimeRect = (point = {}, rect = {}, tolerance = 0.001) => (
  point.x > rect.x + tolerance
  && point.x < rect.x + rect.w - tolerance
  && point.y > rect.y + tolerance
  && point.y < rect.y + rect.h - tolerance
);

const isPathPointBlocked = (point, obstacles) => obstacles.some((obstacle) => isPointInsideRuntimeRect(point, obstacle));

const pushPathPointOutOfRect = (point = {}, rect = {}) => {
  if (!isPointInsideRuntimeRect(point, rect, 0)) return point;
  const left = Math.abs(point.x - rect.x);
  const right = Math.abs(rect.x + rect.w - point.x);
  const top = Math.abs(point.y - rect.y);
  const bottom = Math.abs(rect.y + rect.h - point.y);
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { ...point, x: rect.x };
  if (min === right) return { ...point, x: rect.x + rect.w };
  if (min === top) return { ...point, y: rect.y };
  return { ...point, y: rect.y + rect.h };
};

const getRectCenter = (rect = {}) => ({
  x: getFiniteRuntimeNumber(rect.x, 0) + Math.max(0, getFiniteRuntimeNumber(rect.w, 0)) / 2,
  y: getFiniteRuntimeNumber(rect.y, 0) + Math.max(0, getFiniteRuntimeNumber(rect.h, 0)) / 2,
});

const distancePointToSegment = (point, from, to) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return distance(point, from);
  const t = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq, 0, 1);
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
};

const getRelevantPathObstacles = (obstacles, from, to) => {
  if (obstacles.length <= PLAYER_PATH_MAX_OBSTACLES) return obstacles;
  const minX = Math.min(from.x, to.x) - PLAYER_PATH_CORRIDOR_MARGIN;
  const maxX = Math.max(from.x, to.x) + PLAYER_PATH_CORRIDOR_MARGIN;
  const minY = Math.min(from.y, to.y) - PLAYER_PATH_CORRIDOR_MARGIN;
  const maxY = Math.max(from.y, to.y) + PLAYER_PATH_CORRIDOR_MARGIN;
  return obstacles
    .map((obstacle) => ({
      obstacle,
      corridor: !(
        obstacle.x > maxX
        || obstacle.x + obstacle.w < minX
        || obstacle.y > maxY
        || obstacle.y + obstacle.h < minY
      ),
      distanceToRoute: distancePointToSegment(getRectCenter(obstacle), from, to),
    }))
    .sort((left, right) => {
      if (left.corridor !== right.corridor) return left.corridor ? -1 : 1;
      return left.distanceToRoute - right.distanceToRoute;
    })
    .slice(0, PLAYER_PATH_MAX_OBSTACLES)
    .map((entry) => entry.obstacle);
};

export const hasPathLineOfSight = (from, to, obstacles = []) => {
  const segmentDistance = distance(from, to);
  const steps = Math.max(2, Math.ceil(segmentDistance / PLAYER_PATH_SAMPLE_STEP));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
    if (isPathPointBlocked(point, obstacles)) return false;
  }
  return true;
};

const normalizePathTarget = (target, obstacles, bounds) => {
  let point = clampRuntimePoint(target, bounds);
  for (let pass = 0; pass < 8; pass += 1) {
    const blocker = obstacles.find((obstacle) => isPointInsideRuntimeRect(point, obstacle, 0));
    if (!blocker) break;
    point = clampRuntimePoint(pushPathPointOutOfRect(point, blocker), bounds);
  }
  return point;
};

const getPathNodeKey = (point = {}) => `${Math.round(point.x * 10)}:${Math.round(point.y * 10)}`;

const buildPathNodes = (start, target, obstacles, bounds) => {
  const nodes = [start, target];
  const seen = new Set(nodes.map(getPathNodeKey));
  obstacles.forEach((obstacle) => {
    [
      { x: obstacle.x, y: obstacle.y },
      { x: obstacle.x + obstacle.w, y: obstacle.y },
      { x: obstacle.x, y: obstacle.y + obstacle.h },
      { x: obstacle.x + obstacle.w, y: obstacle.y + obstacle.h },
    ].forEach((corner) => {
      const point = clampRuntimePoint(corner, bounds);
      const key = getPathNodeKey(point);
      if (seen.has(key) || isPathPointBlocked(point, obstacles)) return;
      seen.add(key);
      nodes.push(point);
    });
  });
  return nodes;
};

const smoothPath = (path, start, obstacles) => {
  if (path.length <= 1) return path;
  const smoothed = [];
  let anchor = start;
  let index = 0;
  while (index < path.length) {
    let nextIndex = path.length - 1;
    while (nextIndex > index && !hasPathLineOfSight(anchor, path[nextIndex], obstacles)) {
      nextIndex -= 1;
    }
    smoothed.push(path[nextIndex]);
    anchor = path[nextIndex];
    index = nextIndex + 1;
  }
  return smoothed;
};

export const findPlayerPath = (from, target, config = DEFAULT_ARCADE_CONFIG, radius = PLAYER_RADIUS) => {
  if (!from || !target) return [];
  const bounds = getRuntimeWorldBounds(config, radius);
  const start = clampRuntimePoint(from, bounds);
  const expandedObstacles = getBlockingObstacles(config)
    .map((obstacle) => expandRuntimeObstacleForPath(obstacle, radius))
    .filter((obstacle) => obstacle.w > 0 && obstacle.h > 0);
  const pathObstacles = getRelevantPathObstacles(expandedObstacles, start, clampRuntimePoint(target, bounds));
  const finalTarget = normalizePathTarget(target, pathObstacles, bounds);
  if (distance(start, finalTarget) < PLAYER_PATH_REACHED_DISTANCE) return [];
  if (hasPathLineOfSight(start, finalTarget, pathObstacles)) return [finalTarget];

  const nodes = buildPathNodes(start, finalTarget, pathObstacles, bounds);
  const targetIndex = 1;
  const open = new Set([0]);
  const closed = new Set();
  const cameFrom = new Map();
  const gScore = new Array(nodes.length).fill(Infinity);
  const fScore = new Array(nodes.length).fill(Infinity);
  gScore[0] = 0;
  fScore[0] = distance(nodes[0], nodes[targetIndex]);
  const edgeCache = new Map();
  const canConnect = (leftIndex, rightIndex) => {
    const key = leftIndex < rightIndex ? `${leftIndex}:${rightIndex}` : `${rightIndex}:${leftIndex}`;
    if (!edgeCache.has(key)) {
      edgeCache.set(key, hasPathLineOfSight(nodes[leftIndex], nodes[rightIndex], pathObstacles));
    }
    return edgeCache.get(key);
  };

  while (open.size) {
    let current = null;
    open.forEach((index) => {
      if (current === null || fScore[index] < fScore[current]) current = index;
    });
    if (current === targetIndex) {
      const path = [];
      let step = current;
      while (step !== 0) {
        path.unshift(nodes[step]);
        step = cameFrom.get(step);
        if (step === undefined) return [finalTarget];
      }
      return smoothPath(path, start, pathObstacles);
    }
    open.delete(current);
    closed.add(current);
    for (let neighbor = 1; neighbor < nodes.length; neighbor += 1) {
      if (neighbor === current || closed.has(neighbor) || !canConnect(current, neighbor)) continue;
      const tentativeScore = gScore[current] + distance(nodes[current], nodes[neighbor]);
      if (tentativeScore >= gScore[neighbor]) continue;
      cameFrom.set(neighbor, current);
      gScore[neighbor] = tentativeScore;
      fScore[neighbor] = tentativeScore + distance(nodes[neighbor], nodes[targetIndex]);
      open.add(neighbor);
    }
  }

  return [finalTarget];
};

export const resolveMapCollision = (entity, radius, config = DEFAULT_ARCADE_CONFIG, blockingObstacles = null) => {
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const worldWidth = getFiniteRuntimeNumber(world.width, DEFAULT_ARCADE_CONFIG.world.width);
  const worldHeight = getFiniteRuntimeNumber(world.height, DEFAULT_ARCADE_CONFIG.world.height);
  const currentX = getFiniteRuntimeNumber(entity.x, worldWidth / 2);
  const currentY = getFiniteRuntimeNumber(entity.y, worldHeight / 2);
  let next = {
    ...entity,
    x: clamp(currentX, radius, worldWidth - radius),
    y: clamp(currentY, radius, worldHeight - radius),
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

const getContinuousMoveTarget = (player = {}, config = DEFAULT_ARCADE_CONFIG, direction = { x: 0, y: 0 }) => {
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const worldWidth = getFiniteRuntimeNumber(world.width, DEFAULT_ARCADE_CONFIG.world.width);
  const worldHeight = getFiniteRuntimeNumber(world.height, DEFAULT_ARCADE_CONFIG.world.height);
  const playerX = getFiniteRuntimeNumber(player.x, worldWidth / 2);
  const playerY = getFiniteRuntimeNumber(player.y, worldHeight / 2);
  return {
    x: clamp(playerX + direction.x * PLAYER_CONTINUOUS_MOVE_DISTANCE, PLAYER_RADIUS, Math.max(PLAYER_RADIUS, worldWidth - PLAYER_RADIUS)),
    y: clamp(playerY + direction.y * PLAYER_CONTINUOUS_MOVE_DISTANCE, PLAYER_RADIUS, Math.max(PLAYER_RADIUS, worldHeight - PLAYER_RADIUS)),
  };
};

const getPlayerStoredMoveDirection = (player = {}) => {
  const x = Number(player.moveDirection?.x);
  const y = Number(player.moveDirection?.y);
  return Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) > 0.001
    ? normalizeVector(x, y)
    : null;
};

export const clearPlayerMoveTarget = (state, { stopVelocity = true } = {}) => {
  const player = state?.player;
  if (!player) return false;
  player.moveTarget = null;
  player.movePath = [];
  player.moveContinuous = false;
  player.moveDirection = null;
  if (stopVelocity) {
    player.vx = 0;
    player.vy = 0;
  }
  return true;
};

export const applyPlayerMoveTarget = (state, config, point, options = {}) => {
  if (!point) return clearPlayerMoveTarget(state);
  const liveConfig = config || DEFAULT_ARCADE_CONFIG;
  const player = state?.player;
  if (!player || !liveConfig?.world) return false;
  const continuous = Boolean(options.continuous);
  const target = {
    x: clamp(Number(point.x) || 0, PLAYER_RADIUS, liveConfig.world.width - PLAYER_RADIUS),
    y: clamp(Number(point.y) || 0, PLAYER_RADIUS, liveConfig.world.height - PLAYER_RADIUS),
  };
  const deltaX = target.x - player.x;
  const deltaY = target.y - player.y;
  const targetDistance = Math.hypot(deltaX, deltaY);
  const nextDirection = targetDistance > 0.001
    ? normalizeVector(deltaX, deltaY)
    : getPlayerStoredMoveDirection(player);
  player.moveContinuous = continuous;
  player.moveDirection = nextDirection;
  if (!nextDirection && continuous) {
    player.moveTarget = null;
    player.movePath = [];
    player.vx = 0;
    player.vy = 0;
    return true;
  }
  const effectiveTarget = continuous && targetDistance < PLAYER_PATH_REACHED_DISTANCE && nextDirection
    ? getContinuousMoveTarget(player, liveConfig, nextDirection)
    : target;
  const effectiveDistance = Math.hypot(effectiveTarget.x - player.x, effectiveTarget.y - player.y);
  if (effectiveDistance < PLAYER_RADIUS + 4) {
    if (!continuous) clearPlayerMoveTarget(state);
  } else {
    player.moveTarget = effectiveTarget;
    player.movePath = findPlayerPath(player, effectiveTarget, liveConfig, PLAYER_RADIUS);
    const firstTarget = player.movePath[0] || effectiveTarget;
    const input = normalizeVector(firstTarget.x - player.x, firstTarget.y - player.y);
    const playerControl = getControlledPlayerSource(liveConfig, player.controlledHeroId);
    const speed = player.dash > 0
      ? getPositivePlayerControlNumber(playerControl, 'dashSpeed', DEFAULT_ARCADE_CONFIG.player.dashSpeed)
      : getPositivePlayerControlNumber(playerControl, 'speed', DEFAULT_ARCADE_CONFIG.player.speed);
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
  onActionZoneTriggered,
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
    const world = liveConfig.world || DEFAULT_ARCADE_CONFIG.world;
    player.x = getFiniteRuntimeNumber(player.x, (Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width) / 2);
    player.y = getFiniteRuntimeNumber(player.y, (Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height) / 2);

    let { inputX, inputY } = getPlayerKeyboardInput(keys);
    const hasKeyboardMove = Boolean(inputX || inputY);
    if (!hasKeyboardMove && player.moveTarget) {
      if (!Array.isArray(player.movePath)) player.movePath = [];
      while (player.movePath.length && Math.hypot(player.movePath[0].x - player.x, player.movePath[0].y - player.y) < PLAYER_PATH_REACHED_DISTANCE) {
        player.movePath.shift();
      }
      const targetDistance = Math.hypot(player.moveTarget.x - player.x, player.moveTarget.y - player.y);
      if (targetDistance < PLAYER_PATH_REACHED_DISTANCE) {
        const continuousDirection = player.moveContinuous ? getPlayerStoredMoveDirection(player) : null;
        if (continuousDirection) {
          const nextTarget = getContinuousMoveTarget(player, liveConfig, continuousDirection);
          player.moveTarget = nextTarget;
          player.movePath = findPlayerPath(player, nextTarget, liveConfig, PLAYER_RADIUS);
          const routeTarget = player.movePath[0] || nextTarget;
          inputX = routeTarget.x - player.x;
          inputY = routeTarget.y - player.y;
        } else {
          clearPlayerMoveTarget(state, { stopVelocity: false });
        }
      } else {
        if (!player.movePath.length) player.movePath = findPlayerPath(player, player.moveTarget, liveConfig, PLAYER_RADIUS);
        const routeTarget = player.movePath[0] || player.moveTarget;
        inputX = routeTarget.x - player.x;
        inputY = routeTarget.y - player.y;
      }
    }
    if (hasKeyboardMove) {
      clearPlayerMoveTarget(state, { stopVelocity: false });
    }
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
      const dashSpeed = getPositivePlayerControlNumber(playerControl, 'dashSpeed', DEFAULT_ARCADE_CONFIG.player.dashSpeed);
      player.vx = input.x * dashSpeed;
      player.vy = input.y * dashSpeed;
    } else {
      const speed = getPositivePlayerControlNumber(playerControl, 'speed', DEFAULT_ARCADE_CONFIG.player.speed);
      player.vx = input.x * speed;
      player.vy = input.y * speed;
    }
    const playerMoveObstacles = getBlockingObstaclesForEntityMove(blockingObstacles, player, PLAYER_RADIUS);
    const previousPlayerX = player.x;
    const previousPlayerY = player.y;
    const intendedPlayerMove = Math.hypot(player.vx * dt, player.vy * dt);
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    Object.assign(player, resolveRuntimeMapCollision(player, PLAYER_RADIUS, playerMoveObstacles));
    const actualPlayerMove = Math.hypot(player.x - previousPlayerX, player.y - previousPlayerY);
    if (!hasKeyboardMove && player.moveTarget && intendedPlayerMove > 0.25 && actualPlayerMove < intendedPlayerMove * 0.35) {
      player.movePath = findPlayerPath(player, player.moveTarget, liveConfig, PLAYER_RADIUS);
    }

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
    if (keys.has('KeyE') && power && player.powerCooldown <= 0) {
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
        onActionZoneTriggered?.(activeActionZone, { actionType });
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
      const enemyMoveObstacles = getBlockingObstaclesForEntityMove(blockingObstacles, enemy, ENEMY_RADIUS);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      Object.assign(enemy, resolveRuntimeMapCollision(enemy, ENEMY_RADIUS, enemyMoveObstacles));

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
    onActionZoneTriggered,
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
      const frameDt = (timestamp - last) / 1000;
      const dt = Math.min(0.033, frameDt > 0 ? frameDt : ARCADE_FALLBACK_FRAME_DT);
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
      if (PLAYER_PREVENT_DEFAULT_KEYS.has(event.code)) event.preventDefault();
      if (event.code === 'KeyP') setIsPaused((paused) => !paused);
      else if (isPlayerMoveKeyCode(event.code)) setIsPaused(false);
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

  const setPlayerMoveTarget = useCallback((point, options = {}) => {
    if (applyPlayerMoveTarget(stateRef.current, configRef.current || DEFAULT_ARCADE_CONFIG, point, options)) {
      setIsPaused(false);
      setSnapshot({ ...stateRef.current, player: { ...stateRef.current.player } });
    }
  }, [configRef, setIsPaused, setSnapshot, stateRef]);

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
