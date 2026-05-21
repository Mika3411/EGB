import * as THREE from 'three';

import {
  TERRAIN_PAINT_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_SHAPE,
  clamp,
  getFloorZeroZ,
  getHexColor,
  getPropHeight,
  getPropRenderMode,
  getPropWidth,
  getTerrainPaintColor,
  getTerrainPaintOpacity,
  getTerrainPaintPoints,
  getTerrainPaintRadius,
  getTerrainPaintShape,
  normalizeModelRotation as normalizeModelRotationDegrees,
} from '../../utils/rpg3dDomain.js';

import {
  getImageSignature,
} from './rpg3dRuntimeModels.js';

import {
  WORLD_SCALE,
} from './rpg3dSceneShared.js';

const createFloorTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#172033';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 64) {
    for (let y = 0; y < canvas.height; y += 64) {
      ctx.fillStyle = ((x + y) / 64) % 2 ? '#223149' : '#182538';
      ctx.fillRect(x, y, 64, 64);
      ctx.strokeStyle = 'rgba(103, 232, 249, .12)';
      ctx.strokeRect(x + 0.5, y + 0.5, 63, 63);
    }
  }
  ctx.strokeStyle = 'rgba(245, 158, 11, .18)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 410);
  ctx.bezierCurveTo(145, 340, 260, 520, 512, 390);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const createTerrainPaintPolygonGeometry = (radiusWorld, shape) => {
  const points = shape === 'triangle'
    ? Array.from({ length: 3 }, (_, index) => {
      const angle = Math.PI / 2 + index * ((Math.PI * 2) / 3);
      return { x: Math.cos(angle) * radiusWorld, y: Math.sin(angle) * radiusWorld };
    })
    : [
      { x: -radiusWorld, y: -radiusWorld },
      { x: radiusWorld, y: -radiusWorld },
      { x: radiusWorld, y: radiusWorld },
      { x: -radiusWorld, y: radiusWorld },
    ];
  const path = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  path.closePath();
  return {
    fillGeometry: new THREE.ShapeGeometry(path),
    outlineGeometry: new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, point.y, 0))),
  };
};

const createTerrainPaintPreview = (
  radius = TERRAIN_PAINT_DEFAULT_RADIUS,
  color = TERRAIN_PAINT_DEFAULT_COLOR,
  shape = TERRAIN_PAINT_DEFAULT_SHAPE,
) => {
  const radiusWorld = Math.max(0.08, getTerrainPaintRadius({ radius }) * WORLD_SCALE);
  const previewColor = getHexColor(color, TERRAIN_PAINT_DEFAULT_COLOR);
  const previewShape = getTerrainPaintShape({ shape });
  const group = new THREE.Group();
  group.userData.previewRadius = radiusWorld;
  group.userData.previewColor = previewColor;
  group.userData.previewShape = previewShape;

  const fillMaterial = new THREE.MeshBasicMaterial({
    color: previewColor,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  });

  if (previewShape === 'round') {
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radiusWorld, 64), fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    fill.renderOrder = 90;
    group.add(fill);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radiusWorld * 0.96, radiusWorld * 1.02, 64),
      new THREE.MeshBasicMaterial({
        color: previewColor,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    ring.renderOrder = 91;
    group.add(ring);
  } else {
    const { fillGeometry, outlineGeometry } = createTerrainPaintPolygonGeometry(radiusWorld, previewShape);
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    fill.renderOrder = 90;
    group.add(fill);

    const outline = new THREE.LineLoop(outlineGeometry, new THREE.LineBasicMaterial({
      color: previewColor,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: true,
    }));
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.002;
    outline.renderOrder = 91;
    group.add(outline);
  }

  return group;
};

const FLOOR_TEXTURE_CONTINUITY_GAP_WORLD = 24;

const getFloorContinuityKey = (prop = {}) => {
  if (getPropRenderMode(prop) !== 'floor' || !prop.imageData) return '';
  return [
    getImageSignature(prop.imageData),
    prop.imageName || '',
    Math.round(normalizeModelRotationDegrees(prop.rotation || 0)),
    Math.round(getFloorZeroZ(prop) * 10),
  ].join(':');
};

const getFloorTileBounds = (prop = {}) => {
  const width = getPropWidth(prop);
  const height = getPropHeight(prop);
  const x = Number(prop.x) || 0;
  const y = Number(prop.y) || 0;
  return {
    prop,
    width,
    height,
    x,
    y,
    minX: x - width / 2,
    maxX: x + width / 2,
    minY: y - height / 2,
    maxY: y + height / 2,
  };
};

const getRangeGap = (minA, maxA, minB, maxB) => {
  if (maxA < minB) return minB - maxA;
  if (maxB < minA) return minA - maxB;
  return 0;
};

const getRangeOverlap = (minA, maxA, minB, maxB) => (
  Math.max(0, Math.min(maxA, maxB) - Math.max(minA, minB))
);

const areFloorTilesConnected = (left, right) => {
  const gapX = getRangeGap(left.minX, left.maxX, right.minX, right.maxX);
  const gapY = getRangeGap(left.minY, left.maxY, right.minY, right.maxY);
  const overlapX = getRangeOverlap(left.minX, left.maxX, right.minX, right.maxX);
  const overlapY = getRangeOverlap(left.minY, left.maxY, right.minY, right.maxY);
  return (
    gapX <= FLOOR_TEXTURE_CONTINUITY_GAP_WORLD && overlapY > 1
  ) || (
    gapY <= FLOOR_TEXTURE_CONTINUITY_GAP_WORLD && overlapX > 1
  );
};

const buildContinuousFloorUvMap = (props = []) => {
  const byKey = new Map();
  props.forEach((prop) => {
    const key = getFloorContinuityKey(prop);
    if (!key) return;
    const bounds = getFloorTileBounds(prop);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(bounds);
  });

  const uvMap = new Map();
  byKey.forEach((tiles) => {
    const remaining = new Set(tiles);
    while (remaining.size) {
      const first = remaining.values().next().value;
      remaining.delete(first);
      const component = [first];
      for (let index = 0; index < component.length; index += 1) {
        const current = component[index];
        [...remaining].forEach((candidate) => {
          if (!areFloorTilesConnected(current, candidate)) return;
          remaining.delete(candidate);
          component.push(candidate);
        });
      }
      if (component.length <= 1) continue;
      const groupBounds = component.reduce((bounds, tile) => ({
        minX: Math.min(bounds.minX, tile.minX),
        maxX: Math.max(bounds.maxX, tile.maxX),
        minY: Math.min(bounds.minY, tile.minY),
        maxY: Math.max(bounds.maxY, tile.maxY),
      }), {
        minX: component[0].minX,
        maxX: component[0].maxX,
        minY: component[0].minY,
        maxY: component[0].maxY,
      });
      const groupWidth = Math.max(1, groupBounds.maxX - groupBounds.minX);
      const groupHeight = Math.max(1, groupBounds.maxY - groupBounds.minY);
      component.forEach((tile) => {
        uvMap.set(tile.prop.id, {
          ...groupBounds,
          width: groupWidth,
          height: groupHeight,
          tileCenterX: tile.x,
          tileCenterY: tile.y,
        });
      });
    }
  });
  return uvMap;
};

const applyContinuousFloorUvs = (geometry, mapping = null) => {
  if (!geometry || !mapping) return geometry;
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  if (!positions || !uvs) return geometry;
  for (let index = 0; index < positions.count; index += 1) {
    const worldX = mapping.tileCenterX + positions.getX(index) / WORLD_SCALE;
    const worldY = mapping.tileCenterY - positions.getY(index) / WORLD_SCALE;
    const u = clamp((worldX - mapping.minX) / mapping.width, 0, 1);
    const v = clamp(1 - ((worldY - mapping.minY) / mapping.height), 0, 1);
    uvs.setXY(index, u, v);
  }
  uvs.needsUpdate = true;
  return geometry;
};

const getTerrainPaintVisualSignature = (stroke = {}) => [
  stroke.id || '',
  getTerrainPaintColor(stroke),
  Math.round(getTerrainPaintRadius(stroke)),
  Math.round(getTerrainPaintOpacity(stroke) * 100),
  getTerrainPaintShape(stroke),
  getTerrainPaintPoints(stroke).map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(';'),
].join(':');

const getTerrainPaintLayerSignature = (config = {}) => {
  const world = config.world || {};
  return [
    Number(world.width) || 0,
    Number(world.height) || 0,
    (config.terrainPaintStrokes || []).map(getTerrainPaintVisualSignature).join(';'),
  ].join('|');
};

const getCanvasRgba = (hexColor, opacity = 1) => {
  const color = new THREE.Color(getHexColor(hexColor, TERRAIN_PAINT_DEFAULT_COLOR));
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${clamp(opacity, 0, 1)})`;
};

const addTerrainBrushStampPath = (ctx, point, radius, shape) => {
  if (shape === 'square') {
    ctx.rect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    return;
  }
  if (shape === 'triangle') {
    for (let index = 0; index < 3; index += 1) {
      const angle = -Math.PI / 2 + index * ((Math.PI * 2) / 3);
      const x = point.x + Math.cos(angle) * radius;
      const y = point.y + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(point.x + radius, point.y);
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
};

const drawTerrainPaintMask = (ctx, points, radius, shape, toCanvasPoint, style) => {
  ctx.fillStyle = style;
  ctx.strokeStyle = style;
  if (shape === 'round' && points.length > 1) {
    ctx.lineWidth = radius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const start = toCanvasPoint(points[0]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    points.slice(1).forEach((point) => {
      const canvasPoint = toCanvasPoint(point);
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    });
    ctx.stroke();
    return;
  }

  const stampSpacing = Math.max(1, radius * 0.35);
  let previous = toCanvasPoint(points[0]);
  ctx.beginPath();
  addTerrainBrushStampPath(ctx, previous, radius, shape);
  points.slice(1).forEach((point) => {
    const current = toCanvasPoint(point);
    const distanceToPrevious = Math.hypot(current.x - previous.x, current.y - previous.y);
    const steps = Math.max(1, Math.ceil(distanceToPrevious / stampSpacing));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      addTerrainBrushStampPath(ctx, {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      }, radius, shape);
    }
    previous = current;
  });
  ctx.fill();
};

const drawTerrainPaintStroke = (ctx, config = {}, stroke = {}, scale = 1) => {
  const points = getTerrainPaintPoints(stroke);
  if (!points.length) return;
  const radius = Math.max(1, getTerrainPaintRadius(stroke) * scale);
  const shape = getTerrainPaintShape(stroke);
  const toCanvasPoint = (point) => ({
    x: point.x * scale,
    y: point.y * scale,
  });

  const width = ctx.canvas?.width || 0;
  const height = ctx.canvas?.height || 0;
  if (!width || !height) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  drawTerrainPaintMask(ctx, points, radius, shape, toCanvasPoint, '#000000');
  ctx.globalCompositeOperation = 'source-over';
  drawTerrainPaintMask(
    ctx,
    points,
    radius,
    shape,
    toCanvasPoint,
    getCanvasRgba(getTerrainPaintColor(stroke), getTerrainPaintOpacity(stroke)),
  );
  ctx.restore();
};

const createTerrainPaintTexture = (config = {}) => {
  const strokes = (config.terrainPaintStrokes || []).filter((stroke) => getTerrainPaintPoints(stroke).length);
  if (!strokes.length) return null;
  const worldWidth = Math.max(1, Number(config.world?.width) || 1);
  const worldHeight = Math.max(1, Number(config.world?.height) || 1);
  const maxCanvasSide = 1536;
  const scale = maxCanvasSide / Math.max(worldWidth, worldHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(64, Math.round(worldWidth * scale));
  canvas.height = Math.max(64, Math.round(worldHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach((stroke) => drawTerrainPaintStroke(ctx, config, stroke, scale));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

const addTerrainPaintLayer = (group, config = {}) => {
  const texture = createTerrainPaintTexture(config);
  if (!texture) return;
  const width = Math.max(1, Number(config.world?.width) || 1) * WORLD_SCALE;
  const depth = Math.max(1, Number(config.world?.height) || 1) * WORLD_SCALE;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    roughness: 0.95,
    metalness: 0,
    depthWrite: false,
    depthTest: true,
  });
  material.userData.disposeTextures = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.065;
  mesh.renderOrder = 18;
  mesh.receiveShadow = true;
  group.add(mesh);
};

export {
  createFloorTexture,
  createTerrainPaintPolygonGeometry,
  createTerrainPaintPreview,
  FLOOR_TEXTURE_CONTINUITY_GAP_WORLD,
  getFloorContinuityKey,
  getFloorTileBounds,
  getRangeGap,
  getRangeOverlap,
  areFloorTilesConnected,
  buildContinuousFloorUvMap,
  applyContinuousFloorUvs,
  getTerrainPaintVisualSignature,
  getTerrainPaintLayerSignature,
  getCanvasRgba,
  addTerrainBrushStampPath,
  drawTerrainPaintMask,
  drawTerrainPaintStroke,
  createTerrainPaintTexture,
  addTerrainPaintLayer,
};
