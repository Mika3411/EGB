import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Crosshair,
  Download,
  HeartPulse,
  Map as MapIcon,
  MousePointer2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Square,
  Sword,
  Zap,
} from 'lucide-react';

const PLAYER_RADIUS = 18;
const ENEMY_RADIUS = 16;
const BULLET_RADIUS = 4;
const DASH_DURATION = 0.16;
const PICKUP_RADIUS = 15;

const ARCADE_CHARACTER_PRESETS = [
  { id: 'runner', label: 'Aventurier', body: '#d7b56d', accent: '#67e8f9', face: '#f0c9a5', weapon: '#e0f7ff' },
  { id: 'knight', label: 'Chevalier', body: '#94a3b8', accent: '#f8fafc', face: '#e7c39e', weapon: '#cbd5e1' },
  { id: 'mage', label: 'Mage', body: '#8b5cf6', accent: '#c4b5fd', face: '#f0c9a5', weapon: '#f5d0fe' },
  { id: 'ranger', label: 'Rodeuse', body: '#22c55e', accent: '#86efac', face: '#e7c39e', weapon: '#bbf7d0' },
  { id: 'guard', label: 'Garde rouge', body: '#ef4444', accent: '#fca5a5', face: '#d8a47f', weapon: '#fecaca' },
  { id: 'sniper', label: 'Tireur jaune', body: '#facc15', accent: '#fde68a', face: '#e7c39e', weapon: '#fef3c7' },
  { id: 'brute', label: 'Brute orange', body: '#f97316', accent: '#fed7aa', face: '#c8875c', weapon: '#ffedd5' },
  { id: 'shadow', label: 'Ombre', body: '#64748b', accent: '#a78bfa', face: '#cbd5e1', weapon: '#ddd6fe' },
];

const PLAYER_CHARACTER_IDS = ['runner', 'knight', 'mage', 'ranger', 'shadow'];
const ENEMY_CHARACTER_IDS = ['guard', 'sniper', 'brute', 'shadow', 'knight', 'mage', 'ranger'];
const DEFAULT_ENEMY_CHARACTER_BY_ROLE = {
  rifle: 'guard',
  sniper: 'sniper',
  brute: 'brute',
};

const getCharacterPreset = (id = 'runner', fallbackId = 'runner') => (
  ARCADE_CHARACTER_PRESETS.find((preset) => preset.id === id)
  || ARCADE_CHARACTER_PRESETS.find((preset) => preset.id === fallbackId)
  || ARCADE_CHARACTER_PRESETS[0]
);

const getEnemyCharacterId = (enemy = {}) => enemy.character || DEFAULT_ENEMY_CHARACTER_BY_ROLE[enemy.role] || 'guard';
const getCharacterOptions = (ids) => ids.map((id) => getCharacterPreset(id));
const PLAYER_CHARACTER_OPTIONS = getCharacterOptions(PLAYER_CHARACTER_IDS);
const ENEMY_CHARACTER_OPTIONS = getCharacterOptions(ENEMY_CHARACTER_IDS);

const DEFAULT_ARCADE_CONFIG = {
  meta: {
    title: 'Mission Arcade',
  },
  world: {
    width: 4200,
    height: 2800,
    grid: 120,
  },
  player: {
    x: 340,
    y: 410,
    character: 'runner',
    characterImageData: '',
    health: 18,
    maxHealth: 18,
    mana: 10,
    maxMana: 10,
    speed: 260,
    dashSpeed: 680,
    dashCooldown: 0.9,
    bulletSpeed: 680,
    fireRate: 0.13,
    skills: [
      { id: 'force', name: 'Force', value: 3, manaCost: 0 },
      { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
      { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
    ],
    powers: [
      { id: 'flamme', name: 'Flamme', type: 'fire', manaCost: 2, force: 4 },
    ],
  },
  ai: {
    visionRange: 850,
    obstacleAvoidance: 56,
    aggression: 1,
  },
  obstacles: [
    { id: 'wall-1', x: 430, y: 260, w: 520, h: 110 },
    { id: 'wall-2', x: 1160, y: 390, w: 150, h: 560 },
    { id: 'wall-3', x: 1660, y: 210, w: 680, h: 120 },
    { id: 'wall-4', x: 2600, y: 410, w: 190, h: 650 },
    { id: 'wall-5', x: 3160, y: 220, w: 570, h: 110 },
    { id: 'wall-6', x: 300, y: 910, w: 280, h: 720 },
    { id: 'wall-7', x: 790, y: 1210, w: 730, h: 130 },
    { id: 'wall-8', x: 1880, y: 910, w: 170, h: 680 },
    { id: 'wall-9', x: 2310, y: 1430, w: 780, h: 120 },
    { id: 'wall-10', x: 3480, y: 920, w: 210, h: 760 },
    { id: 'wall-11', x: 600, y: 2030, w: 700, h: 130 },
    { id: 'wall-12', x: 1540, y: 1880, w: 170, h: 600 },
    { id: 'wall-13', x: 2150, y: 2140, w: 640, h: 120 },
    { id: 'wall-14', x: 3150, y: 2050, w: 740, h: 130 },
  ],
  props: [
    { id: 'prop-1', x: 690, y: 690, r: 34 },
    { id: 'prop-2', x: 910, y: 1830, r: 38 },
    { id: 'prop-3', x: 1410, y: 760, r: 28 },
    { id: 'prop-4', x: 2190, y: 620, r: 34 },
    { id: 'prop-5', x: 2460, y: 1830, r: 36 },
    { id: 'prop-6', x: 3040, y: 670, r: 30 },
    { id: 'prop-7', x: 3320, y: 1850, r: 34 },
    { id: 'prop-8', x: 3820, y: 630, r: 28 },
  ],
  enemies: [
    { id: 'enemy-1', x: 960, y: 560, role: 'rifle', character: 'guard', characterImageData: '', combatEnemyName: 'Garde', combatEnemyMaxHealth: 8, combatEnemyStrength: 2, combatEnemyMaxMana: 0, combatEnemyPowerDamage: 0 },
    { id: 'enemy-2', x: 1530, y: 1050, role: 'rifle', character: 'guard', characterImageData: '', combatEnemyName: 'Patrouilleur', combatEnemyMaxHealth: 8, combatEnemyStrength: 2, combatEnemyMaxMana: 0, combatEnemyPowerDamage: 0 },
    { id: 'enemy-3', x: 2190, y: 780, role: 'sniper', character: 'sniper', characterImageData: '', combatEnemyName: 'Tireur', combatEnemyMaxHealth: 7, combatEnemyStrength: 3, combatEnemyMaxMana: 2, combatEnemyPowerDamage: 4 },
    { id: 'enemy-4', x: 2810, y: 1260, role: 'rifle', character: 'guard', characterImageData: '', combatEnemyName: 'Garde', combatEnemyMaxHealth: 8, combatEnemyStrength: 2, combatEnemyMaxMana: 0, combatEnemyPowerDamage: 0 },
    { id: 'enemy-5', x: 3450, y: 610, role: 'brute', character: 'brute', characterImageData: '', combatEnemyName: 'Brute', combatEnemyMaxHealth: 14, combatEnemyStrength: 4, combatEnemyMaxMana: 0, combatEnemyPowerDamage: 0 },
    { id: 'enemy-6', x: 3860, y: 1490, role: 'rifle', character: 'guard', characterImageData: '', combatEnemyName: 'Garde', combatEnemyMaxHealth: 8, combatEnemyStrength: 2, combatEnemyMaxMana: 0, combatEnemyPowerDamage: 0 },
    { id: 'enemy-7', x: 1020, y: 2320, role: 'rifle', character: 'guard', characterImageData: '', combatEnemyName: 'Patrouilleur', combatEnemyMaxHealth: 8, combatEnemyStrength: 2, combatEnemyMaxMana: 0, combatEnemyPowerDamage: 0 },
    { id: 'enemy-8', x: 1990, y: 2050, role: 'sniper', character: 'sniper', characterImageData: '', combatEnemyName: 'Tireur', combatEnemyMaxHealth: 7, combatEnemyStrength: 3, combatEnemyMaxMana: 2, combatEnemyPowerDamage: 4 },
    { id: 'enemy-9', x: 3330, y: 2310, role: 'brute', character: 'brute', characterImageData: '', combatEnemyName: 'Brute', combatEnemyMaxHealth: 14, combatEnemyStrength: 4, combatEnemyMaxMana: 0, combatEnemyPowerDamage: 0 },
  ],
  pickups: [
    { id: 'pickup-1', x: 1360, y: 460, type: 'health' },
    { id: 'pickup-2', x: 2360, y: 1110, type: 'mana' },
    { id: 'pickup-3', x: 720, y: 1740, type: 'health' },
    { id: 'pickup-4', x: 3720, y: 2050, type: 'mana' },
  ],
};

const TOOL_OPTIONS = [
  { id: 'select', label: 'Selection', icon: MousePointer2 },
  { id: 'obstacle', label: 'Mur', icon: Square },
  { id: 'enemy', label: 'Ennemi', icon: Crosshair },
  { id: 'pickup', label: 'Bonus', icon: HeartPulse },
  { id: 'prop', label: 'Decor', icon: Box },
  { id: 'spawn', label: 'Depart', icon: Shield },
];

const cloneConfig = (config = DEFAULT_ARCADE_CONFIG) => structuredClone(config);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const normalize = (x, y) => {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};
const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const getPowerColor = (type = 'fire') => ({
  lightning: '#c4b5fd',
  water: '#67e8f9',
  earth: '#86efac',
  fire: '#f97316',
}[type] || '#f97316');

const readArcadeImageFile = (file) => new Promise((resolve, reject) => {
  if (!file) return resolve('');
  if (!file.type?.startsWith('image/')) return reject(new Error('Le fichier selectionne doit etre une image.'));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result || '');
  reader.onerror = () => reject(reader.error || new Error("Impossible de charger l'image."));
  reader.readAsDataURL(file);
});

const getCachedImage = (cache, src) => {
  if (!src) return null;
  const cached = cache.get(src);
  if (cached) return cached.complete && cached.naturalWidth ? cached : null;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {};
  image.onerror = () => cache.delete(src);
  image.src = src;
  cache.set(src, image);
  return null;
};

const rectCircleOverlap = (rect, circle) => {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.r;
};

const pushCircleOutOfRect = (circle, rect) => {
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

const hasLineOfSight = (from, to, obstacles) => {
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

const getEnemyStats = (enemy = {}) => {
  const role = enemy.role || 'rifle';
  const base = role === 'sniper'
    ? { healthScale: 7, speed: 98, range: 560, delay: 1.45, bulletSpeed: 560, spread: 0.02, score: 130 }
    : role === 'brute'
      ? { healthScale: 9, speed: 92, range: 260, delay: 0.95, bulletSpeed: 390, spread: 0.16, score: 160 }
      : { healthScale: 7, speed: 112, range: 380, delay: 0.72, bulletSpeed: 430, spread: 0.08, score: 100 };
  const maxHealth = Math.max(1, Number(enemy.combatEnemyMaxHealth) || 8);
  const strength = Math.max(0, Number(enemy.combatEnemyStrength) || 2);
  return {
    ...base,
    hp: maxHealth * base.healthScale,
    damage: Math.max(1, strength * 4),
    powerDamage: Math.max(0, Number(enemy.combatEnemyPowerDamage) || 0) * 5,
    maxMana: Math.max(0, Number(enemy.combatEnemyMaxMana) || 0),
    powerManaCost: Math.max(0, Number(enemy.combatEnemyPowerManaCost) || 3),
    powerUsageChance: Math.max(0, Math.min(100, Number(enemy.combatEnemyPowerUsageChance) || 25)),
  };
};

const createEnemyRuntime = (enemy, index) => {
  const stats = getEnemyStats(enemy);
  return {
    ...enemy,
    vx: 0,
    vy: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    mana: stats.maxMana,
    maxMana: stats.maxMana,
    shootTimer: 0.25 + (index % 4) * 0.18,
    strafeTimer: 0,
    strafeDir: index % 2 === 0 ? 1 : -1,
    alert: 0,
  };
};

const createInitialState = (config) => ({
  player: {
    x: config.player.x,
    y: config.player.y,
    vx: 0,
    vy: 0,
    hp: config.player.health,
    maxHp: config.player.maxHealth,
    mana: config.player.mana,
    maxMana: config.player.maxMana,
    dash: 0,
    dashCooldown: 0,
    shootCooldown: 0,
    powerCooldown: 0,
    moveTarget: null,
  },
  bullets: [],
  enemies: config.enemies.map(createEnemyRuntime),
  pickups: config.pickups.map((pickup) => ({ ...pickup })),
  particles: [],
  score: 0,
  time: 0,
  gameOver: false,
  victory: false,
});

const findEntityAt = (config, point) => {
  const obstacle = [...config.obstacles].reverse().find((item) => (
    point.x >= item.x && point.x <= item.x + item.w && point.y >= item.y && point.y <= item.y + item.h
  ));
  if (obstacle) return { type: 'obstacle', id: obstacle.id };
  const enemy = [...config.enemies].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 26);
  if (enemy) return { type: 'enemy', id: enemy.id };
  const pickup = [...config.pickups].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 25);
  if (pickup) return { type: 'pickup', id: pickup.id };
  const prop = [...config.props].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= item.r + 8);
  if (prop) return { type: 'prop', id: prop.id };
  if (Math.hypot(point.x - config.player.x, point.y - config.player.y) <= 28) return { type: 'spawn', id: 'player' };
  return null;
};

const getSelectedEntity = (config, selected) => {
  if (!selected) return null;
  if (selected.type === 'spawn') return { type: 'spawn', item: config.player };
  const collectionName = selected.type === 'obstacle' ? 'obstacles' : selected.type === 'enemy' ? 'enemies' : selected.type === 'pickup' ? 'pickups' : 'props';
  return { type: selected.type, item: config[collectionName].find((item) => item.id === selected.id) };
};

const drawRoundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

const drawWorldFloor = (ctx, config, time = 0) => {
  const tileSize = Math.max(80, config.world.grid);
  ctx.fillStyle = '#17100d';
  ctx.fillRect(0, 0, config.world.width, config.world.height);

  for (let x = 0; x <= config.world.width; x += tileSize) {
    for (let y = 0; y <= config.world.height; y += tileSize) {
      const shade = ((x / tileSize + y / tileSize) % 2) ? 'rgba(45, 31, 25, .5)' : 'rgba(30, 22, 19, .72)';
      ctx.fillStyle = shade;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = 'rgba(112, 74, 45, .16)';
      ctx.strokeRect(x + 2.5, y + 2.5, tileSize - 5, tileSize - 5);
    }
  }

  ctx.strokeStyle = 'rgba(238, 116, 38, .13)';
  ctx.lineWidth = 2;
  for (let x = 220; x <= config.world.width; x += 520) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(x) * 90, config.world.height);
    ctx.stroke();
  }

  for (let i = 0; i < 42; i += 1) {
    const x = (i * 337) % config.world.width;
    const y = (i * 593) % config.world.height;
    const pulse = 0.45 + Math.sin(time * 2 + i) * 0.18;
    ctx.fillStyle = `rgba(249, 115, 22, ${pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, 12 + (i % 5) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawCharacterImage = (ctx, actor, radius, image, preset, selected, stateIntensity = 0, aim = { x: 1, y: 0 }) => {
  const width = radius * 3.2;
  const height = radius * 3.55;
  ctx.save();
  ctx.shadowBlur = selected ? 24 : 12 + stateIntensity * 8;
  ctx.shadowColor = preset.accent;
  ctx.drawImage(image, actor.x - width / 2, actor.y - height * 0.58, width, height);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = selected ? '#f8fbff' : preset.accent;
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.beginPath();
  ctx.ellipse(actor.x, actor.y - height * 0.08, width * 0.46, height * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = preset.weapon;
  ctx.lineWidth = selected ? 5 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(actor.x + aim.x * radius * 0.65, actor.y + aim.y * radius * 0.65);
  ctx.lineTo(actor.x + aim.x * radius * 1.9, actor.y + aim.y * radius * 1.9);
  ctx.stroke();
  ctx.restore();
};

const drawArcadeCharacter = (ctx, actor, {
  radius,
  aim,
  preset,
  selected = false,
  active = false,
  image = null,
  time = 0,
}) => {
  const stateIntensity = active ? 1 : 0;
  if (image) {
    drawCharacterImage(ctx, actor, radius, image, preset, selected, stateIntensity, aim);
    return;
  }

  const pulse = active ? Math.sin(time * 8) * 0.12 : 0;
  const angle = Math.atan2(aim.y, aim.x);
  ctx.save();
  ctx.translate(actor.x, actor.y);
  ctx.rotate(angle);
  ctx.shadowBlur = selected ? 22 : 8 + stateIntensity * 12;
  ctx.shadowColor = preset.accent;

  ctx.fillStyle = selected ? '#f8fbff' : preset.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * (1 + pulse), radius * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = preset.accent;
  ctx.beginPath();
  ctx.ellipse(-radius * 0.16, 0, radius * 0.36, radius * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = preset.face;
  ctx.beginPath();
  ctx.arc(radius * 0.42, -radius * 0.32, radius * 0.47, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(12, 7, 6, .58)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(radius * 0.5, -radius * 0.38);
  ctx.lineTo(radius * 0.86, -radius * 0.4);
  ctx.stroke();

  ctx.strokeStyle = preset.weapon;
  ctx.lineWidth = selected ? 5 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(radius * 0.46, radius * 0.2);
  ctx.lineTo(radius * 1.82, radius * 0.28);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, .34)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.04, 0.2, Math.PI * 1.4);
  ctx.stroke();
  ctx.restore();
};

function ArcadeMode() {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const keysRef = useRef(new Set());
  const pointerRef = useRef({ x: 0, y: 0, shooting: false, worldX: 0, worldY: 0 });
  const animationRef = useRef(0);
  const lastFrameRef = useRef(0);
  const cameraRef = useRef({ x: 0, y: 0, width: 1, height: 1 });
  const imageCacheRef = useRef(new Map());
  const [config, setConfig] = useState(() => cloneConfig());
  const configRef = useRef(config);
  const stateRef = useRef(createInitialState(config));
  const [mode, setMode] = useState('edit');
  const [tool, setTool] = useState('select');
  const [selected, setSelected] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [snapshot, setSnapshot] = useState(() => createInitialState(config));

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const resetGame = useCallback((nextConfig = configRef.current) => {
    stateRef.current = createInitialState(nextConfig);
    lastFrameRef.current = 0;
    setSnapshot(stateRef.current);
  }, []);

  const patchConfig = useCallback((recipe, shouldReset = true) => {
    setConfig((current) => {
      const next = cloneConfig(current);
      recipe(next);
      configRef.current = next;
      if (shouldReset) resetGame(next);
      return next;
    });
  }, [resetGame]);

  const setPlayerCharacterImage = useCallback(async (file) => {
    if (!file) return;
    try {
      const imageData = await readArcadeImageFile(file);
      setMediaError('');
      patchConfig((next) => {
        next.player.characterImageData = imageData;
      });
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    }
  }, [patchConfig]);

  const setSelectedEnemyCharacterImage = useCallback(async (file) => {
    if (!file || selected?.type !== 'enemy') return;
    const target = { ...selected };
    try {
      const imageData = await readArcadeImageFile(file);
      setMediaError('');
      patchConfig((next) => {
        const selectedEntity = getSelectedEntity(next, target);
        if (selectedEntity?.item) selectedEntity.item.characterImageData = imageData;
      });
    } catch (error) {
      setMediaError(error?.message || "Impossible de charger l'image.");
    }
  }, [patchConfig, selected]);

  const resolveMapCollision = useCallback((entity, radius) => {
    const liveConfig = configRef.current;
    let next = {
      ...entity,
      x: clamp(entity.x, radius, liveConfig.world.width - radius),
      y: clamp(entity.y, radius, liveConfig.world.height - radius),
      r: radius,
    };
    liveConfig.obstacles.forEach((obstacle) => {
      next = pushCircleOutOfRect(next, obstacle);
    });
    return { ...entity, x: next.x, y: next.y };
  }, []);

  const spawnParticles = useCallback((x, y, color, count = 8) => {
    const particles = stateRef.current.particles;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color,
      });
    }
  }, []);

  const fireBullet = useCallback((owner, from, target, speed, damage, color, spread = 0) => {
    const angle = Math.atan2(target.y - from.y, target.x - from.x) + (Math.random() - 0.5) * spread;
    stateRef.current.bullets.push({
      id: `${owner}-${performance.now()}-${Math.random()}`,
      owner,
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      color,
      life: owner === 'player' ? 1.2 : 1.85,
    });
  }, []);

  const updateGame = useCallback((dt) => {
    const liveConfig = configRef.current;
    const state = stateRef.current;
    if (mode !== 'play' || state.gameOver || state.victory) return;
    state.time += dt;
    const player = state.player;
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
    const input = normalize(inputX, inputY);

    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
    player.powerCooldown = Math.max(0, player.powerCooldown - dt);
    if (keys.has('Space') && player.dashCooldown <= 0 && (input.x || input.y)) {
      player.dash = DASH_DURATION;
      player.dashCooldown = liveConfig.player.dashCooldown;
    }
    if (player.dash > 0) {
      player.dash -= dt;
      player.vx = input.x * liveConfig.player.dashSpeed;
      player.vy = input.y * liveConfig.player.dashSpeed;
    } else {
      player.vx = input.x * liveConfig.player.speed;
      player.vy = input.y * liveConfig.player.speed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    Object.assign(player, resolveMapCollision(player, PLAYER_RADIUS));

    if ((aim.shooting || keys.has('KeyF')) && player.shootCooldown <= 0) {
      const attackSkill = liveConfig.player.skills?.[0] || { value: 3, manaCost: 0 };
      const manaCost = Math.max(0, Number(attackSkill.manaCost) || 0);
      if (player.mana >= manaCost) {
        player.mana -= manaCost;
        fireBullet('player', player, { x: aim.worldX, y: aim.worldY }, liveConfig.player.bulletSpeed, Math.max(1, (Number(attackSkill.value) || 0) * 7), '#8df7ff', 0.05);
      }
      player.shootCooldown = liveConfig.player.fireRate;
      spawnParticles(player.x, player.y, '#8df7ff', 2);
    }

    const power = liveConfig.player.powers?.[0];
    if ((keys.has('KeyQ') || keys.has('KeyE')) && power && player.powerCooldown <= 0) {
      const manaCost = Math.max(0, Number(power.manaCost) || 0);
      if (player.mana >= manaCost) {
        player.mana -= manaCost;
        player.powerCooldown = 0.65;
        const color = getPowerColor(power.type);
        fireBullet('player', player, { x: aim.worldX, y: aim.worldY }, liveConfig.player.bulletSpeed * 0.86, Math.max(1, (Number(power.force) || 0) * 10), color, 0.02);
        spawnParticles(player.x, player.y, color, 12);
      }
    }

    state.pickups = state.pickups.filter((pickup) => {
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > 34) return true;
      if (pickup.type === 'health') player.hp = Math.min(player.maxHp, player.hp + 28);
      if (pickup.type === 'mana') player.mana = Math.min(player.maxMana, player.mana + 4);
      if (pickup.type === 'energy') player.dashCooldown = 0;
      spawnParticles(pickup.x, pickup.y, pickup.type === 'health' ? '#7ef29d' : pickup.type === 'mana' ? '#67e8f9' : '#ffdf6c', 14);
      return false;
    });

    state.enemies.forEach((enemy) => {
      const stats = getEnemyStats(enemy);
      const toPlayer = normalize(player.x - enemy.x, player.y - enemy.y);
      const playerDistance = distance(enemy, player);
      const canSee = hasLineOfSight(enemy, player, liveConfig.obstacles);
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

      liveConfig.obstacles.forEach((obstacle) => {
        const expanded = {
          x: obstacle.x - liveConfig.ai.obstacleAvoidance,
          y: obstacle.y - liveConfig.ai.obstacleAvoidance,
          w: obstacle.w + liveConfig.ai.obstacleAvoidance * 2,
          h: obstacle.h + liveConfig.ai.obstacleAvoidance * 2,
        };
        if (rectCircleOverlap(expanded, { x: enemy.x, y: enemy.y, r: 1 })) {
          const center = { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h / 2 };
          const away = normalize(enemy.x - center.x, enemy.y - center.y);
          moveX += away.x * 1.1;
          moveY += away.y * 1.1;
        }
      });

      const move = normalize(moveX, moveY);
      enemy.vx = move.x * stats.speed * liveConfig.ai.aggression;
      enemy.vy = move.y * stats.speed * liveConfig.ai.aggression;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      Object.assign(enemy, resolveMapCollision(enemy, ENEMY_RADIUS));

      enemy.shootTimer -= dt;
      if (enemy.alert && canSee && enemy.shootTimer <= 0) {
        const canUsePower = stats.powerDamage > 0 && enemy.mana >= stats.powerManaCost && Math.random() * 100 < stats.powerUsageChance;
        if (canUsePower) enemy.mana -= stats.powerManaCost;
        fireBullet(
          'enemy',
          enemy,
          player,
          stats.bulletSpeed,
          canUsePower ? stats.powerDamage : stats.damage,
          canUsePower ? '#c4b5fd' : enemy.role === 'brute' ? '#ffb36d' : '#ff776d',
          stats.spread,
        );
        if (enemy.role === 'brute') {
          fireBullet('enemy', enemy, { x: player.x + 40, y: player.y }, 390, 8, '#ffb36d', 0.18);
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
        if (liveConfig.obstacles.some((obstacle) => rectCircleOverlap(obstacle, { x: bullet.x, y: bullet.y, r: BULLET_RADIUS }))) {
          spawnParticles(bullet.x, bullet.y, '#9fb0cc', 5);
          return false;
        }
        if (bullet.owner === 'player') {
          const target = state.enemies.find((enemy) => Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < ENEMY_RADIUS + BULLET_RADIUS);
          if (!target) return true;
          target.hp -= bullet.damage;
          state.score += 12;
          spawnParticles(bullet.x, bullet.y, '#8df7ff', 7);
          return false;
        }
        if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER_RADIUS + BULLET_RADIUS) {
          player.hp -= bullet.damage;
          spawnParticles(bullet.x, bullet.y, '#ff776d', 10);
          if (player.hp <= 0) state.gameOver = true;
          return false;
        }
        return true;
      });

    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp > 0) return true;
      state.score += getEnemyStats(enemy).score;
      spawnParticles(enemy.x, enemy.y, '#ffdf6c', 18);
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

    if (state.enemies.length === 0) state.victory = true;
  }, [fireBullet, mode, resolveMapCollision, spawnParticles]);

  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    const bounds = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(bounds.width));
    const height = Math.max(280, Math.floor(bounds.height));
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const liveConfig = configRef.current;
    const state = stateRef.current;
    const actor = mode === 'play' ? state.player : liveConfig.player;
    const camera = {
      x: clamp(actor.x - width / 2, 0, Math.max(0, liveConfig.world.width - width)),
      y: clamp(actor.y - height / 2, 0, Math.max(0, liveConfig.world.height - height)),
      width,
      height,
    };
    cameraRef.current = camera;
    pointerRef.current.worldX = pointerRef.current.x + camera.x;
    pointerRef.current.worldY = pointerRef.current.y + camera.y;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b0706';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawWorldFloor(ctx, liveConfig, state.time);
    ctx.strokeStyle = 'rgba(185, 118, 58, .08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= liveConfig.world.width; x += liveConfig.world.grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, liveConfig.world.height);
      ctx.stroke();
    }
    for (let y = 0; y <= liveConfig.world.height; y += liveConfig.world.grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(liveConfig.world.width, y);
      ctx.stroke();
    }

    liveConfig.props.forEach((prop) => {
      const isSelected = selected?.type === 'prop' && selected.id === prop.id;
      ctx.fillStyle = isSelected ? 'rgba(214, 160, 76, .92)' : 'rgba(74, 50, 35, .86)';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 197, 112, .16)';
      ctx.beginPath();
      ctx.arc(prop.x - 8, prop.y - 7, prop.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 199, 133, .22)';
      ctx.stroke();
    });

    liveConfig.obstacles.forEach((obstacle) => {
      const isSelected = selected?.type === 'obstacle' && selected.id === obstacle.id;
      ctx.fillStyle = isSelected ? 'rgba(95, 57, 42, .98)' : 'rgba(38, 31, 29, .96)';
      drawRoundedRect(ctx, obstacle.x, obstacle.y, obstacle.w, obstacle.h, 10);
      ctx.fillStyle = 'rgba(255, 166, 77, .1)';
      drawRoundedRect(ctx, obstacle.x + 8, obstacle.y + 8, Math.max(8, obstacle.w - 16), 8, 4);
      ctx.strokeStyle = isSelected ? '#f59e0b' : 'rgba(185, 118, 58, .28)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(obstacle.x + 0.5, obstacle.y + 0.5, obstacle.w - 1, obstacle.h - 1);
      ctx.strokeStyle = 'rgba(0, 0, 0, .45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(obstacle.x + 12, obstacle.y + obstacle.h - 8);
      ctx.lineTo(obstacle.x + obstacle.w - 12, obstacle.y + obstacle.h - 8);
      ctx.stroke();
    });

    const pickupsToDraw = mode === 'play' ? state.pickups : liveConfig.pickups;
    pickupsToDraw.forEach((pickup) => {
      const isSelected = selected?.type === 'pickup' && selected.id === pickup.id;
      ctx.fillStyle = pickup.type === 'health' ? '#dc2626' : pickup.type === 'mana' ? '#2563eb' : '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, PICKUP_RADIUS + (mode === 'play' ? Math.sin(state.time * 5) * 2 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isSelected ? '#f8fbff' : 'rgba(255, 224, 178, .62)';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
    });

    state.bullets.forEach((bullet) => {
      ctx.fillStyle = bullet.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    const enemiesToDraw = mode === 'play' ? state.enemies : liveConfig.enemies;
    enemiesToDraw.forEach((enemy) => {
      const isSelected = selected?.type === 'enemy' && selected.id === enemy.id;
      const enemyPreset = getCharacterPreset(getEnemyCharacterId(enemy), 'guard');
      const enemyImage = getCachedImage(imageCacheRef.current, enemy.characterImageData);
      const target = mode === 'play' ? state.player : liveConfig.player;
      const aim = normalize(target.x - enemy.x, target.y - enemy.y);
      drawArcadeCharacter(ctx, enemy, {
        radius: ENEMY_RADIUS,
        aim,
        preset: enemyPreset,
        selected: isSelected,
        active: Boolean(enemy.alert),
        image: enemyImage,
        time: state.time,
      });
      if (mode === 'play') {
        ctx.fillStyle = 'rgba(0,0,0,.36)';
        ctx.fillRect(enemy.x - 21, enemy.y - 31, 42, 5);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(enemy.x - 21, enemy.y - 31, 42 * (enemy.hp / enemy.maxHp), 5);
      }
    });

    const player = mode === 'play' ? state.player : liveConfig.player;
    const aim = normalize(pointerRef.current.worldX - player.x, pointerRef.current.worldY - player.y);
    if (mode === 'play' && state.player.moveTarget) {
      ctx.strokeStyle = 'rgba(245, 158, 11, .58)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.player.moveTarget.x, state.player.moveTarget.y, 18 + Math.sin(state.time * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(state.player.moveTarget.x - 9, state.player.moveTarget.y);
      ctx.lineTo(state.player.moveTarget.x + 9, state.player.moveTarget.y);
      ctx.moveTo(state.player.moveTarget.x, state.player.moveTarget.y - 9);
      ctx.lineTo(state.player.moveTarget.x, state.player.moveTarget.y + 9);
      ctx.stroke();
    }
    const playerPreset = getCharacterPreset(liveConfig.player.character || 'runner', 'runner');
    const playerImage = getCachedImage(imageCacheRef.current, liveConfig.player.characterImageData);
    drawArcadeCharacter(ctx, player, {
      radius: PLAYER_RADIUS,
      aim,
      preset: playerPreset,
      selected: mode === 'edit' && selected?.type === 'spawn',
      active: player.dash > 0,
      image: playerImage,
      time: state.time,
    });

    state.particles.forEach((particle) => {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    ctx.strokeStyle = 'rgba(245, 158, 11, .62)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pointerRef.current.x, pointerRef.current.y, 15, 0, Math.PI * 2);
    ctx.moveTo(pointerRef.current.x - 22, pointerRef.current.y);
    ctx.lineTo(pointerRef.current.x - 8, pointerRef.current.y);
    ctx.moveTo(pointerRef.current.x + 8, pointerRef.current.y);
    ctx.lineTo(pointerRef.current.x + 22, pointerRef.current.y);
    ctx.moveTo(pointerRef.current.x, pointerRef.current.y - 22);
    ctx.lineTo(pointerRef.current.x, pointerRef.current.y - 8);
    ctx.moveTo(pointerRef.current.x, pointerRef.current.y + 8);
    ctx.lineTo(pointerRef.current.x, pointerRef.current.y + 22);
    ctx.stroke();

    ctx.fillStyle = 'rgba(12, 7, 6, .82)';
    drawRoundedRect(ctx, width - 182, 16, 166, 112, 8);
    const mapScaleX = 146 / liveConfig.world.width;
    const mapScaleY = 88 / liveConfig.world.height;
    ctx.fillStyle = 'rgba(245, 158, 11, .1)';
    ctx.fillRect(width - 172, 34, 146, 88);
    liveConfig.enemies.forEach((enemy) => {
      ctx.fillStyle = getCharacterPreset(getEnemyCharacterId(enemy), 'guard').body;
      ctx.fillRect(width - 172 + enemy.x * mapScaleX - 2, 34 + enemy.y * mapScaleY - 2, 4, 4);
    });
    ctx.fillStyle = getCharacterPreset(liveConfig.player.character || 'runner', 'runner').body;
    ctx.fillRect(width - 172 + player.x * mapScaleX - 3, 34 + player.y * mapScaleY - 3, 6, 6);

    if (mode === 'play' && (state.gameOver || state.victory || isPaused)) {
      ctx.fillStyle = 'rgba(8, 4, 3, .74)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f8fbff';
      ctx.font = '800 28px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(state.victory ? 'Zone nettoyee' : state.gameOver ? 'Signal perdu' : 'Pause', width / 2, height / 2 - 8);
      ctx.font = '600 14px Inter, Arial';
      ctx.fillStyle = '#d6b985';
      ctx.fillText('Reprendre ou relancer depuis le panneau de controle.', width / 2, height / 2 + 22);
      ctx.textAlign = 'start';
    }
  }, [isPaused, mode, selected]);

  useEffect(() => {
    const loop = (timestamp) => {
      const last = lastFrameRef.current || timestamp;
      const dt = Math.min(0.033, (timestamp - last) / 1000);
      lastFrameRef.current = timestamp;
      if (!isPaused) updateGame(dt);
      renderGame();
      if (Math.floor(timestamp / 120) !== Math.floor(last / 120)) {
        setSnapshot({ ...stateRef.current, player: { ...stateRef.current.player } });
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPaused, renderGame, updateGame]);

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
  }, []);

  const updatePointer = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = event.clientX - rect.left;
    pointerRef.current.y = event.clientY - rect.top;
  }, []);

  const updateEntity = useCallback((field, rawValue) => {
    const value = Number.isNaN(Number(rawValue)) ? rawValue : Number(rawValue);
    patchConfig((next) => {
      const selectedEntity = getSelectedEntity(next, selected);
      if (!selectedEntity?.item) return;
      selectedEntity.item[field] = value;
      if (field === 'x') selectedEntity.item.x = clamp(value, 0, next.world.width);
      if (field === 'y') selectedEntity.item.y = clamp(value, 0, next.world.height);
    });
  }, [patchConfig, selected]);

  const deleteSelected = useCallback(() => {
    if (!selected || selected.type === 'spawn') return;
    patchConfig((next) => {
      const key = selected.type === 'obstacle' ? 'obstacles' : selected.type === 'enemy' ? 'enemies' : selected.type === 'pickup' ? 'pickups' : 'props';
      next[key] = next[key].filter((item) => item.id !== selected.id);
    });
    setSelected(null);
  }, [patchConfig, selected]);

  const handleCanvasClick = useCallback((event) => {
    updatePointer(event);
    if (mode === 'play') {
      if (event.button === 0) {
        const liveConfig = configRef.current;
        stateRef.current.player.moveTarget = {
          x: clamp(pointerRef.current.worldX, PLAYER_RADIUS, liveConfig.world.width - PLAYER_RADIUS),
          y: clamp(pointerRef.current.worldY, PLAYER_RADIUS, liveConfig.world.height - PLAYER_RADIUS),
        };
      }
      return;
    }
    if (mode !== 'edit') return;
    const point = {
      x: clamp(pointerRef.current.worldX, 0, configRef.current.world.width),
      y: clamp(pointerRef.current.worldY, 0, configRef.current.world.height),
    };
    if (tool === 'select') {
      setSelected(findEntityAt(configRef.current, point));
      return;
    }
    patchConfig((next) => {
      if (tool === 'spawn') {
        next.player.x = Math.round(point.x);
        next.player.y = Math.round(point.y);
        setSelected({ type: 'spawn', id: 'player' });
      }
      if (tool === 'obstacle') {
        const item = { id: createId('wall'), x: Math.round(point.x - 90), y: Math.round(point.y - 35), w: 180, h: 70 };
        next.obstacles.push(item);
        setSelected({ type: 'obstacle', id: item.id });
      }
      if (tool === 'enemy') {
        const item = {
          id: createId('enemy'),
          x: Math.round(point.x),
          y: Math.round(point.y),
          role: 'rifle',
          character: 'guard',
          characterImageData: '',
          combatEnemyName: 'Ennemi',
          combatEnemyMaxHealth: 8,
          combatEnemyStrength: 2,
          combatEnemyMaxMana: 0,
          combatEnemyPowerManaCost: 3,
          combatEnemyPowerDamage: 0,
          combatEnemyPowerUsageChance: 25,
        };
        next.enemies.push(item);
        setSelected({ type: 'enemy', id: item.id });
      }
      if (tool === 'pickup') {
        const item = { id: createId('pickup'), x: Math.round(point.x), y: Math.round(point.y), type: 'health' };
        next.pickups.push(item);
        setSelected({ type: 'pickup', id: item.id });
      }
      if (tool === 'prop') {
        const item = { id: createId('prop'), x: Math.round(point.x), y: Math.round(point.y), r: 34 };
        next.props.push(item);
        setSelected({ type: 'prop', id: item.id });
      }
    });
  }, [mode, patchConfig, tool, updatePointer]);

  const exportConfig = useCallback(async () => {
    const payload = JSON.stringify(config, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
  }, [config]);

  const selectedEntity = useMemo(() => getSelectedEntity(config, selected), [config, selected]);
  const playerHealth = Math.max(0, Math.round(snapshot.player.hp));
  const playerMana = Math.max(0, Math.round(snapshot.player.mana));
  const dashReady = snapshot.player.dashCooldown <= 0;
  const playMode = mode === 'play';
  const forceSkill = config.player.skills[0] || { name: 'Force', value: 0, manaCost: 0 };
  const mainPower = config.player.powers[0] || { name: 'Pouvoir', type: 'fire', manaCost: 0, force: 0 };
  const playerCharacterPreset = getCharacterPreset(config.player.character || 'runner', 'runner');
  const selectedEnemyCharacterPreset = selectedEntity?.type === 'enemy'
    ? getCharacterPreset(getEnemyCharacterId(selectedEntity.item), 'guard')
    : null;

  return (
    <main className="arcade-shell arcade-builder-shell">
      <section className="arcade-hud" aria-label="Arcade no-code builder">
        <div>
          <span className="arcade-kicker"><Sparkles size={15} /> No-code sandbox</span>
          <h1>Arcade Builder</h1>
        </div>
        <div className="arcade-stats" aria-label="Statistiques">
          <span><Shield size={16} /> {playMode ? `${playerHealth}/${snapshot.player.maxHp} PV` : `${config.player.health}/${config.player.maxHealth} PV`}</span>
          <span><Crosshair size={16} /> {playMode ? snapshot.enemies.length : config.enemies.length}</span>
          <span><Zap size={16} /> {playMode ? `${playerMana}/${snapshot.player.maxMana} Mana` : `${config.player.mana}/${config.player.maxMana} Mana`}</span>
          <span><MapIcon size={16} /> {config.world.width} x {config.world.height}</span>
        </div>
        <div className="arcade-actions">
          <button
            type="button"
            className={playMode ? 'secondary-action' : 'button like'}
            onClick={() => {
              const nextMode = playMode ? 'edit' : 'play';
              setMode(nextMode);
              setIsPaused(false);
              resetGame();
            }}
          >
            {playMode ? <MousePointer2 size={16} /> : <Play size={16} />}
            <span>{playMode ? 'Editer' : 'Tester'}</span>
          </button>
          <button type="button" className="secondary-action" onClick={() => playMode ? setIsPaused((paused) => !paused) : resetGame()}>
            {playMode && !isPaused ? <Pause size={16} /> : <RotateCcw size={16} />}
            <span>{playMode ? (isPaused ? 'Reprendre' : 'Pause') : 'Recharger'}</span>
          </button>
        </div>
      </section>

      <section className="arcade-builder-layout">
        <aside className="arcade-builder-panel" aria-label="Outils de creation">
          <div className="arcade-panel-section">
            <h2>Outils</h2>
            <div className="arcade-tool-grid">
              {TOOL_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={tool === option.id ? 'active' : ''}
                    onClick={() => {
                      setTool(option.id);
                      if (option.id !== 'select') setMode('edit');
                    }}
                  >
                    <Icon size={16} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="arcade-panel-section">
            <h2>Map</h2>
            <label>
              Largeur
              <input type="number" min="1200" max="9000" step="100" value={config.world.width} onChange={(event) => patchConfig((next) => { next.world.width = Number(event.target.value); })} />
            </label>
            <label>
              Hauteur
              <input type="number" min="900" max="7000" step="100" value={config.world.height} onChange={(event) => patchConfig((next) => { next.world.height = Number(event.target.value); })} />
            </label>
            <label>
              Grille
              <input type="number" min="40" max="240" step="20" value={config.world.grid} onChange={(event) => patchConfig((next) => { next.world.grid = Number(event.target.value); }, false)} />
            </label>
          </div>

          <div className="arcade-panel-section">
            <h2>Heros</h2>
            <label>
              Personnage principal
              <select value={config.player.character || 'runner'} onChange={(event) => patchConfig((next) => { next.player.character = event.target.value; })}>
                {PLAYER_CHARACTER_OPTIONS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
            <div className="arcade-character-summary">
              <span
                className="arcade-character-token"
                style={{ '--arcade-character-body': playerCharacterPreset.body, '--arcade-character-accent': playerCharacterPreset.accent }}
              >
                {config.player.characterImageData ? <img src={config.player.characterImageData} alt="" /> : null}
              </span>
              <div>
                <strong>{playerCharacterPreset.label}</strong>
                <small>{config.player.characterImageData ? 'Image personnalisee' : 'Preset arcade'}</small>
              </div>
            </div>
            <label className="button like secondary-action arcade-file-button">
              Importer image heros
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  setPlayerCharacterImage(file);
                }}
              />
            </label>
            {config.player.characterImageData ? (
              <button type="button" className="secondary-action" onClick={() => {
                setMediaError('');
                patchConfig((next) => { next.player.characterImageData = ''; });
              }}>Retirer image heros</button>
            ) : null}
            {mediaError ? <p className="arcade-empty-state">{mediaError}</p> : null}
            <label>
              PV actuels
              <input type="number" min="0" max={config.player.maxHealth} value={config.player.health} onChange={(event) => patchConfig((next) => { next.player.health = clamp(Number(event.target.value), 0, next.player.maxHealth); })} />
            </label>
            <label>
              PV max
              <input type="number" min="1" max="999" value={config.player.maxHealth} onChange={(event) => patchConfig((next) => { next.player.maxHealth = Math.max(1, Number(event.target.value)); next.player.health = clamp(next.player.health, 0, next.player.maxHealth); })} />
            </label>
            <label>
              Mana actuelle
              <input type="number" min="0" max={config.player.maxMana} value={config.player.mana} onChange={(event) => patchConfig((next) => { next.player.mana = clamp(Number(event.target.value), 0, next.player.maxMana); })} />
            </label>
            <label>
              Mana max
              <input type="number" min="0" max="999" value={config.player.maxMana} onChange={(event) => patchConfig((next) => { next.player.maxMana = Math.max(0, Number(event.target.value)); next.player.mana = clamp(next.player.mana, 0, next.player.maxMana); })} />
            </label>
            <label>
              Vitesse joueur
              <input type="range" min="140" max="420" value={config.player.speed} onChange={(event) => patchConfig((next) => { next.player.speed = Number(event.target.value); })} />
            </label>
          </div>

          <div className="arcade-panel-section">
            <h2>Competence & pouvoir</h2>
            <label>
              Competence attaque
              <input value={forceSkill.name} onChange={(event) => patchConfig((next) => { next.player.skills[0].name = event.target.value; })} />
            </label>
            <label>
              Bonus competence
              <input type="number" min="-20" max="50" value={forceSkill.value} onChange={(event) => patchConfig((next) => { next.player.skills[0].value = Number(event.target.value); })} />
            </label>
            <label>
              Cout mana attaque
              <input type="number" min="0" max="99" value={forceSkill.manaCost} onChange={(event) => patchConfig((next) => { next.player.skills[0].manaCost = Number(event.target.value); })} />
            </label>
            <label>
              Pouvoir
              <input value={mainPower.name} onChange={(event) => patchConfig((next) => { next.player.powers[0].name = event.target.value; })} />
            </label>
            <label>
              Force pouvoir
              <input type="number" min="0" max="999" value={mainPower.force} onChange={(event) => patchConfig((next) => { next.player.powers[0].force = Number(event.target.value); })} />
            </label>
            <label>
              Cout mana pouvoir
              <input type="number" min="0" max="999" value={mainPower.manaCost} onChange={(event) => patchConfig((next) => { next.player.powers[0].manaCost = Number(event.target.value); })} />
            </label>
            <label>
              Element pouvoir
              <select value={mainPower.type} onChange={(event) => patchConfig((next) => { next.player.powers[0].type = event.target.value; })}>
                <option value="fire">Feu</option>
                <option value="water">Eau</option>
                <option value="earth">Terre</option>
                <option value="lightning">Foudre</option>
              </select>
            </label>
          </div>

          <div className="arcade-panel-section">
            <h2>IA temps reel</h2>
            <label>
              Vision ennemis
              <input type="range" min="300" max="1400" step="50" value={config.ai.visionRange} onChange={(event) => patchConfig((next) => { next.ai.visionRange = Number(event.target.value); })} />
            </label>
            <label>
              Aggressivite IA
              <input type="range" min="0.6" max="1.6" step="0.1" value={config.ai.aggression} onChange={(event) => patchConfig((next) => { next.ai.aggression = Number(event.target.value); })} />
            </label>
          </div>
        </aside>

        <section className="arcade-stage" ref={wrapperRef}>
          <canvas
            ref={canvasRef}
            className="arcade-canvas"
            aria-label="Editeur arcade 2D no-code"
            onClick={handleCanvasClick}
            onContextMenu={(event) => event.preventDefault()}
            onMouseMove={updatePointer}
            onMouseDown={(event) => {
              updatePointer(event);
              if (mode === 'play' && event.button === 2) {
                event.preventDefault();
                pointerRef.current.shooting = true;
              }
            }}
            onMouseUp={(event) => {
              if (event.button === 2) pointerRef.current.shooting = false;
            }}
            onMouseLeave={() => {
              pointerRef.current.shooting = false;
            }}
          />
        </section>

        <aside className="arcade-builder-panel" aria-label="Inspecteur">
          <div className="arcade-panel-section">
            <h2>Inspecteur</h2>
            {!selectedEntity?.item ? (
              <p className="arcade-empty-state">Selectionne un objet ou choisis un outil, puis clique sur la carte.</p>
            ) : (
              <div className="arcade-inspector">
                <span className="arcade-selected-type">{selectedEntity.type}</span>
                <label>
                  X
                  <input type="number" value={Math.round(selectedEntity.item.x)} onChange={(event) => updateEntity('x', event.target.value)} />
                </label>
                <label>
                  Y
                  <input type="number" value={Math.round(selectedEntity.item.y)} onChange={(event) => updateEntity('y', event.target.value)} />
                </label>
                {selectedEntity.type === 'obstacle' && (
                  <>
                    <label>
                      Largeur
                      <input type="number" min="30" value={Math.round(selectedEntity.item.w)} onChange={(event) => updateEntity('w', event.target.value)} />
                    </label>
                    <label>
                      Hauteur
                      <input type="number" min="30" value={Math.round(selectedEntity.item.h)} onChange={(event) => updateEntity('h', event.target.value)} />
                    </label>
                  </>
                )}
                {selectedEntity.type === 'enemy' && (
                  <>
                    <label>
                      Nom combat
                      <input value={selectedEntity.item.combatEnemyName || ''} onChange={(event) => updateEntity('combatEnemyName', event.target.value)} />
                    </label>
                    <label>
                      Type IA
                      <select value={selectedEntity.item.role} onChange={(event) => updateEntity('role', event.target.value)}>
                        <option value="rifle">Rifle</option>
                        <option value="sniper">Sniper</option>
                        <option value="brute">Brute</option>
                      </select>
                    </label>
                    <label>
                      Personnage
                      <select value={getEnemyCharacterId(selectedEntity.item)} onChange={(event) => updateEntity('character', event.target.value)}>
                        {ENEMY_CHARACTER_OPTIONS.map((preset) => (
                          <option key={preset.id} value={preset.id}>{preset.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="arcade-character-summary">
                      <span
                        className="arcade-character-token"
                        style={{
                          '--arcade-character-body': selectedEnemyCharacterPreset?.body || '#ef4444',
                          '--arcade-character-accent': selectedEnemyCharacterPreset?.accent || '#fca5a5',
                        }}
                      >
                        {selectedEntity.item.characterImageData ? <img src={selectedEntity.item.characterImageData} alt="" /> : null}
                      </span>
                      <div>
                        <strong>{selectedEnemyCharacterPreset?.label || 'Ennemi'}</strong>
                        <small>{selectedEntity.item.characterImageData ? 'Image personnalisee' : 'Preset arcade'}</small>
                      </div>
                    </div>
                    <label className="button like secondary-action arcade-file-button">
                      Importer image ennemi
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          setSelectedEnemyCharacterImage(file);
                        }}
                      />
                    </label>
                    {selectedEntity.item.characterImageData ? (
                      <button type="button" className="secondary-action" onClick={() => {
                        setMediaError('');
                        patchConfig((next) => {
                          const currentEnemy = getSelectedEntity(next, selected);
                          if (currentEnemy?.item) currentEnemy.item.characterImageData = '';
                        });
                      }}>Retirer image ennemi</button>
                    ) : null}
                    {mediaError ? <p className="arcade-empty-state">{mediaError}</p> : null}
                    <label>
                      PV ennemi
                      <input type="number" min="1" max="999" value={selectedEntity.item.combatEnemyMaxHealth || 8} onChange={(event) => updateEntity('combatEnemyMaxHealth', event.target.value)} />
                    </label>
                    <label>
                      Force
                      <input type="number" min="0" max="999" value={selectedEntity.item.combatEnemyStrength || 2} onChange={(event) => updateEntity('combatEnemyStrength', event.target.value)} />
                    </label>
                    <label>
                      Mana ennemi
                      <input type="number" min="0" max="999" value={selectedEntity.item.combatEnemyMaxMana || 0} onChange={(event) => updateEntity('combatEnemyMaxMana', event.target.value)} />
                    </label>
                    <label>
                      Pouvoir degats
                      <input type="number" min="0" max="999" value={selectedEntity.item.combatEnemyPowerDamage || 0} onChange={(event) => updateEntity('combatEnemyPowerDamage', event.target.value)} />
                    </label>
                    <label>
                      Tendance pouvoir %
                      <input type="number" min="0" max="100" value={selectedEntity.item.combatEnemyPowerUsageChance || 25} onChange={(event) => updateEntity('combatEnemyPowerUsageChance', event.target.value)} />
                    </label>
                  </>
                )}
                {selectedEntity.type === 'pickup' && (
                  <label>
                    Bonus
                    <select value={selectedEntity.item.type} onChange={(event) => updateEntity('type', event.target.value)}>
                      <option value="health">Soin</option>
                      <option value="mana">Mana</option>
                      <option value="energy">Dash</option>
                    </select>
                  </label>
                )}
                {selectedEntity.type === 'prop' && (
                  <label>
                    Taille
                    <input type="number" min="12" max="120" value={Math.round(selectedEntity.item.r)} onChange={(event) => updateEntity('r', event.target.value)} />
                  </label>
                )}
                {selectedEntity.type !== 'spawn' && (
                  <button type="button" className="danger-button" onClick={deleteSelected}>Supprimer</button>
                )}
              </div>
            )}
          </div>

          <div className="arcade-panel-section arcade-library">
            <h2>Elements</h2>
            <button type="button" onClick={() => setTool('obstacle')}><Plus size={15} /> Mur</button>
            <button type="button" onClick={() => setTool('enemy')}><Sword size={15} /> Ennemi</button>
            <button type="button" onClick={() => setTool('pickup')}><HeartPulse size={15} /> Bonus</button>
            <button type="button" onClick={exportConfig}><Download size={15} /> Copier JSON</button>
          </div>
        </aside>
      </section>

      <section className="arcade-controls" aria-label="Controles">
        <span>{playMode ? 'Clic gauche: deplacement' : 'Selection: choisir un objet'}</span>
        <span>{playMode ? 'Clic droit maintenu: tir' : 'Outils: clique pour placer'}</span>
        <span>{playMode ? `Espace: dash ${dashReady ? 'pret' : 'en recharge'}` : 'Inspecteur: modifie sans code'}</span>
        <span>{playMode ? 'Q/E: pouvoir mana' : 'PV, mana, competences et pouvoirs alignes Hero'}</span>
        <span>P: pause</span>
      </section>
    </main>
  );
}

export default ArcadeMode;
