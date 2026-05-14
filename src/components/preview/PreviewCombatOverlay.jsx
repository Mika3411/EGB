import { useEffect, useRef, useState } from 'react';
import { DoorOpen, Dices, Package, Shield, Sparkles, Swords } from 'lucide-react';
import { getHeroForceValue, getStatusEffectLabel } from '../../lib/combatEngine.js';

const getStatusBadgeClass = (type = '') => (
  String(type || 'status').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
);

const getStatusEffectParts = (effect = {}) => {
  const type = effect.type || effect.statusType || '';
  const label = getStatusEffectLabel(type) || 'Statut';
  const amount = Math.max(0, Number(effect.amount) || 0);
  const duration = Math.max(0, Number(effect.duration) || 0);
  const details = [
    type && type !== 'stun' && amount ? String(amount) : '',
    duration ? `${duration}t` : '',
  ].filter(Boolean);

  return {
    type,
    label,
    meta: details.join(' · '),
  };
};

const formatStatusEffectBadge = (effect = {}) => {
  const { label, meta } = getStatusEffectParts(effect);
  return meta ? `${label} ${meta}` : label;
};

const normalizeCombatJournalText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const splitCombatJournalText = (value = '') => (
  normalizeCombatJournalText(value).match(/[^.!?]+[.!?]?/g) || []
).map((entry) => entry.trim()).filter(Boolean);

const COMBAT_D20_CHARGE_MAX_MS = 1400;

const COMBAT_D20_RESULT_FACE_ID = 'f16';

const COMBAT_D20_FACES = [
  { id: 'f01', transform: 'matrix3d(0.80902,-0.5,0.30902,0,0.11026,0.6455,0.75576,0,-0.57735,-0.57735,0.57735,0,-48.84346,-30.18692,-8.34346,1)', tone: '252 66% 24%' },
  { id: 'f02', transform: 'matrix3d(0.5,-0.30902,-0.80902,0,0.86603,0.17841,0.46709,0,0,-0.93417,0.35682,0,-40.5,-35.34346,21.84346,1)', tone: '260 66% 24%' },
  { id: 'f03', transform: 'matrix3d(-0.5,0.30902,-0.80902,0,0.86603,0.17841,-0.46709,0,0,-0.93417,-0.35682,0,-13.5,-52.03038,21.84346,1)', tone: '268 66% 24%' },
  { id: 'f04', transform: 'matrix3d(-0.80902,0.5,0.30902,0,0.11026,0.6455,-0.75576,0,-0.57735,-0.57735,-0.57735,0,-5.15654,-57.18692,-8.34346,1)', tone: '276 66% 24%' },
  { id: 'f05', transform: 'matrix3d(0,0,1,0,-0.35682,0.93417,0,0,-0.93417,-0.35682,0,0,-27,-43.68692,-27,1)', tone: '284 66% 24%' },
  { id: 'f06', transform: 'matrix3d(0.80902,0.5,-0.30902,0,-0.11026,0.6455,0.75576,0,0.57735,-0.57735,0.57735,0,5.15654,-57.18692,8.34346,1)', tone: '292 66% 24%' },
  { id: 'f07', transform: 'matrix3d(0.80902,0.5,0.30902,0,-0.46709,0.86603,-0.17841,0,-0.35682,0,0.93417,0,-21.84346,-40.5,35.34346,1)', tone: '300 66% 24%' },
  { id: 'f08', transform: 'matrix3d(0.30902,0.80902,0.5,0,0.17841,0.46709,-0.86603,0,-0.93417,0.35682,0,0,-52.03038,-21.84346,13.5,1)', tone: '252 66% 24%' },
  { id: 'f09', transform: 'matrix3d(0,1,0,0,0.93417,0,-0.35682,0,-0.35682,0,-0.93417,0,-43.68692,-27,-27,1)', tone: '260 66% 24%' },
  { id: 'f10', transform: 'matrix3d(0.30902,0.80902,-0.5,0,0.75576,0.11026,0.6455,0,0.57735,-0.57735,-0.57735,0,-8.34346,-48.84346,-30.18692,1)', tone: '268 66% 24%' },
  { id: 'f11', transform: 'matrix3d(-0.80902,0.5,0.30902,0,-0.11026,-0.6455,0.75576,0,0.57735,0.57735,0.57735,0,48.84346,30.18692,-8.34346,1)', tone: '276 66% 24%' },
  { id: 'f12', transform: 'matrix3d(-0.5,0.30902,-0.80902,0,-0.86603,-0.17841,0.46709,0,0,0.93417,0.35682,0,40.5,35.34346,21.84346,1)', tone: '284 66% 24%' },
  { id: 'f13', transform: 'matrix3d(0.5,-0.30902,-0.80902,0,-0.86603,-0.17841,-0.46709,0,0,0.93417,-0.35682,0,13.5,52.03038,21.84346,1)', tone: '292 66% 24%' },
  { id: 'f14', transform: 'matrix3d(0.80902,-0.5,0.30902,0,-0.11026,-0.6455,-0.75576,0,0.57735,0.57735,-0.57735,0,5.15654,57.18692,-8.34346,1)', tone: '300 66% 24%' },
  { id: 'f15', transform: 'matrix3d(0,0,1,0,0.35682,-0.93417,0,0,0.93417,0.35682,0,0,27,43.68692,-27,1)', tone: '252 66% 24%' },
  { id: 'f16', transform: 'matrix3d(-0.80902,-0.5,0.30902,0,0.46709,-0.86603,-0.17841,0,0.35682,0,0.93417,0,21.84346,40.5,35.34346,1)', tone: '260 66% 24%' },
  { id: 'f17', transform: 'matrix3d(-0.80902,-0.5,-0.30902,0,0.11026,-0.6455,0.75576,0,-0.57735,0.57735,0.57735,0,-5.15654,57.18692,8.34346,1)', tone: '268 66% 24%' },
  { id: 'f18', transform: 'matrix3d(-0.30902,-0.80902,-0.5,0,-0.75576,-0.11026,0.6455,0,-0.57735,0.57735,-0.57735,0,8.34346,48.84346,-30.18692,1)', tone: '276 66% 24%' },
  { id: 'f19', transform: 'matrix3d(0,-1,0,0,-0.93417,0,-0.35682,0,0.35682,0,-0.93417,0,43.68692,27,-27,1)', tone: '284 66% 24%' },
  { id: 'f20', transform: 'matrix3d(-0.30902,-0.80902,0.5,0,-0.17841,-0.46709,-0.86603,0,0.93417,-0.35682,0,0,52.03038,21.84346,13.5,1)', tone: '292 66% 24%' },
];

const COMBAT_D20_SVG_FACES = [
  { id: 'top-left', points: '60,4 27,17 42,36', x: 43, y: 20, tone: '268 64% 31%' },
  { id: 'top-center', points: '60,4 42,36 78,36', x: 60, y: 26, tone: '276 66% 35%' },
  { id: 'top-right', points: '60,4 78,36 93,17', x: 77, y: 20, tone: '258 62% 27%' },
  { id: 'left-upper', points: '27,17 9,48 42,36', x: 27, y: 35, tone: '286 62% 29%' },
  { id: 'right-upper', points: '93,17 78,36 111,48', x: 93, y: 35, tone: '252 58% 23%' },
  { id: 'left-middle', points: '9,48 22,86 60,70', x: 30, y: 67, tone: '282 66% 25%' },
  { id: 'left-core', points: '9,48 60,70 42,36', x: 38, y: 52, tone: '270 72% 33%' },
  { id: 'result', points: '42,36 60,70 78,36', x: 60, y: 48, tone: '265 74% 38%', result: true },
  { id: 'right-core', points: '78,36 60,70 111,48', x: 82, y: 52, tone: '260 70% 28%' },
  { id: 'right-middle', points: '111,48 60,70 98,86', x: 90, y: 67, tone: '250 62% 20%' },
  { id: 'bottom-left', points: '22,86 60,108 60,70', x: 48, y: 88, tone: '272 72% 23%' },
  { id: 'bottom-right', points: '60,70 60,108 98,86', x: 72, y: 88, tone: '262 70% 18%' },
];

const D20_PHI = (1 + Math.sqrt(5)) / 2;
const D20_VERTICES = [
  [-1, D20_PHI, 0],
  [1, D20_PHI, 0],
  [-1, -D20_PHI, 0],
  [1, -D20_PHI, 0],
  [0, -1, D20_PHI],
  [0, 1, D20_PHI],
  [0, -1, -D20_PHI],
  [0, 1, -D20_PHI],
  [D20_PHI, 0, -1],
  [D20_PHI, 0, 1],
  [-D20_PHI, 0, -1],
  [-D20_PHI, 0, 1],
].map((vertex) => {
  const length = Math.hypot(vertex[0], vertex[1], vertex[2]) || 1;
  return [vertex[0] / length, vertex[1] / length, vertex[2] / length];
});

const D20_FACE_INDICES = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

const getCombatD20FaceValues = (displayedValue) => {
  const primaryValue = Math.max(1, Math.min(20, Number(displayedValue) || 20));
  const fallbackValues = Array.from({ length: 20 }, (_, index) => index + 1).filter((value) => value !== primaryValue);
  let fallbackIndex = 0;

  return COMBAT_D20_SVG_FACES.map((face) => {
    if (face.result) return primaryValue;
    const value = fallbackValues[fallbackIndex % fallbackValues.length];
    fallbackIndex += 1;
    return value;
  });
};

const rotateD20Point = ([x, y, z], angleX, angleY, angleZ) => {
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;
  const cosZ = Math.cos(angleZ);
  const sinZ = Math.sin(angleZ);
  return [
    x2 * cosZ - y1 * sinZ,
    x2 * sinZ + y1 * cosZ,
    z2,
  ];
};

const subtractD20Point = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const dotD20Point = (a, b) => (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);

const crossD20Point = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const normalizeD20Point = (point) => {
  const length = Math.hypot(point[0], point[1], point[2]) || 1;
  return [point[0] / length, point[1] / length, point[2] / length];
};

const getD20ProjectedFaceArea = (points = []) => {
  if (points.length < 3) return 0;
  return Math.abs(
    (points[0].x * (points[1].y - points[2].y))
    + (points[1].x * (points[2].y - points[0].y))
    + (points[2].x * (points[0].y - points[1].y))
  ) / 2;
};

const getD20ProjectedFaceMinEdge = (points = []) => {
  if (points.length < 3) return 0;
  return Math.min(
    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
    Math.hypot(points[1].x - points[2].x, points[1].y - points[2].y),
    Math.hypot(points[2].x - points[0].x, points[2].y - points[0].y),
  );
};

const getD20FaceOrientation = (faceIndex) => {
  const indices = D20_FACE_INDICES[faceIndex] || D20_FACE_INDICES[0];
  const vertices = indices.map((vertexIndex) => D20_VERTICES[vertexIndex]);
  const center = vertices.reduce((sum, vertex) => [
    sum[0] + vertex[0] / 3,
    sum[1] + vertex[1] / 3,
    sum[2] + vertex[2] / 3,
  ], [0, 0, 0]);
  let normal = normalizeD20Point(crossD20Point(
    subtractD20Point(vertices[1], vertices[0]),
    subtractD20Point(vertices[2], vertices[0]),
  ));

  if (dotD20Point(normal, center) < 0) {
    normal = [-normal[0], -normal[1], -normal[2]];
  }

  const topVertex = vertices[0];
  let up = subtractD20Point(topVertex, center);
  up = normalizeD20Point(subtractD20Point(up, [
    normal[0] * dotD20Point(up, normal),
    normal[1] * dotD20Point(up, normal),
    normal[2] * dotD20Point(up, normal),
  ]));
  const right = normalizeD20Point(crossD20Point(up, normal));

  return { normal, right, up };
};

const orientD20PointToFace = (point, orientation, roll = 0) => {
  const x = dotD20Point(point, orientation.right);
  const y = -dotD20Point(point, orientation.up);
  const z = dotD20Point(point, orientation.normal);
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);

  return [
    (x * cos) - (y * sin),
    (x * sin) + (y * cos),
    z,
  ];
};

const clampD20Unit = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const smoothD20Progress = (value) => {
  const progress = clampD20Unit(value);
  return progress * progress * (3 - (2 * progress));
};

const getD20RotationMatrix = (angleX, angleY, angleZ) => {
  const xAxis = rotateD20Point([1, 0, 0], angleX, angleY, angleZ);
  const yAxis = rotateD20Point([0, 1, 0], angleX, angleY, angleZ);
  const zAxis = rotateD20Point([0, 0, 1], angleX, angleY, angleZ);

  return [
    [xAxis[0], yAxis[0], zAxis[0]],
    [xAxis[1], yAxis[1], zAxis[1]],
    [xAxis[2], yAxis[2], zAxis[2]],
  ];
};

const getD20FaceRotationMatrix = (orientation, roll = 0) => {
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const baseX = orientation.right.map((value) => -value);
  const baseY = orientation.up.map((value) => -value);

  return [
    baseX.map((value, index) => (cos * value) - (sin * baseY[index])),
    baseX.map((value, index) => (sin * value) + (cos * baseY[index])),
    orientation.normal,
  ];
};

const applyD20MatrixToPoint = ([x, y, z], matrix) => [
  (matrix[0][0] * x) + (matrix[0][1] * y) + (matrix[0][2] * z),
  (matrix[1][0] * x) + (matrix[1][1] * y) + (matrix[1][2] * z),
  (matrix[2][0] * x) + (matrix[2][1] * y) + (matrix[2][2] * z),
];

const normalizeD20Quaternion = ([x, y, z, w]) => {
  const length = Math.hypot(x, y, z, w) || 1;
  return [x / length, y / length, z / length, w / length];
};

const d20MatrixToQuaternion = (matrix) => {
  const m00 = matrix[0][0];
  const m01 = matrix[0][1];
  const m02 = matrix[0][2];
  const m10 = matrix[1][0];
  const m11 = matrix[1][1];
  const m12 = matrix[1][2];
  const m20 = matrix[2][0];
  const m21 = matrix[2][1];
  const m22 = matrix[2][2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    return normalizeD20Quaternion([
      (m21 - m12) / scale,
      (m02 - m20) / scale,
      (m10 - m01) / scale,
      .25 * scale,
    ]);
  }
  if (m00 > m11 && m00 > m22) {
    const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return normalizeD20Quaternion([
      .25 * scale,
      (m01 + m10) / scale,
      (m02 + m20) / scale,
      (m21 - m12) / scale,
    ]);
  }
  if (m11 > m22) {
    const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return normalizeD20Quaternion([
      (m01 + m10) / scale,
      .25 * scale,
      (m12 + m21) / scale,
      (m02 - m20) / scale,
    ]);
  }

  const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return normalizeD20Quaternion([
    (m02 + m20) / scale,
    (m12 + m21) / scale,
    .25 * scale,
    (m10 - m01) / scale,
  ]);
};

const d20QuaternionToMatrix = ([x, y, z, w]) => {
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return [
    [1 - (2 * (yy + zz)), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - (2 * (xx + zz)), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - (2 * (xx + yy))],
  ];
};

const slerpD20Quaternion = (fromQuaternion, toQuaternion, progress) => {
  const t = clampD20Unit(progress);
  let target = toQuaternion;
  let dot = fromQuaternion.reduce((sum, value, index) => sum + (value * target[index]), 0);

  if (dot < 0) {
    target = target.map((value) => -value);
    dot = -dot;
  }
  if (dot > .9995) {
    return normalizeD20Quaternion(fromQuaternion.map((value, index) => value + ((target[index] - value) * t)));
  }

  const theta0 = Math.acos(Math.max(-1, Math.min(1, dot)));
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0) || 1;
  const scaleFrom = Math.cos(theta) - (dot * sinTheta / sinTheta0);
  const scaleTo = sinTheta / sinTheta0;

  return normalizeD20Quaternion(fromQuaternion.map((value, index) => (value * scaleFrom) + (target[index] * scaleTo)));
};

const mixD20RotationMatrices = (fromMatrix, toMatrix, progress) => d20QuaternionToMatrix(
  slerpD20Quaternion(d20MatrixToQuaternion(fromMatrix), d20MatrixToQuaternion(toMatrix), progress),
);

const createD20MotionState = () => ({
  active: false,
  settled: false,
  notified: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  spin: 0,
  angularVelocity: 0,
  lastSpeed: 0,
  lockProgress: 0,
  restFrames: 0,
  force: .35,
  launchId: 0,
  launchedAt: 0,
  impact: 0,
  impactEdge: '',
  lastTime: 0,
});

const getD20MotionMetrics = (canvas) => {
  const bounds = canvas.getBoundingClientRect();
  const dieBounds = canvas.parentElement?.getBoundingClientRect?.() || bounds;
  const arenaBounds = canvas.closest?.('.hero-combat-dice-spotlight')?.getBoundingClientRect?.() || bounds;
  const dieSize = Math.max(1, Math.min(dieBounds.width || bounds.width, dieBounds.height || bounds.height));
  const radius = dieSize * .52;
  const centerX = bounds.width / 2;
  const centerY = bounds.height / 2;
  const margin = 5;
  const minX = (arenaBounds.left - bounds.left) + radius + margin - centerX;
  const maxX = (arenaBounds.right - bounds.left) - radius - margin - centerX;
  const minY = (arenaBounds.top - bounds.top) + radius + margin - centerY;
  const maxY = (arenaBounds.bottom - bounds.top) - radius - margin - centerY;

  return {
    bounds,
    radius,
    minX: Math.min(0, minX),
    maxX: Math.max(0, maxX),
    minY: Math.min(0, minY),
    maxY: Math.max(0, maxY),
  };
};

const updateD20Motion = (canvas, time, motion, launch = {}) => {
  const metrics = getD20MotionMetrics(canvas);
  const force = Math.max(.18, Math.min(1, Number(launch.force) || .35));
  const launchId = Number(launch.id) || 0;
  if (!motion.active || motion.launchId !== launchId) {
    const direction = Math.random() < .5 ? -1 : 1;
    motion.active = true;
    motion.settled = false;
    motion.notified = false;
    motion.x = 0;
    motion.y = metrics.maxY * .36;
    motion.vx = direction * (.14 + force * .44 + Math.random() * .1);
    motion.vy = -(.22 + force * .54 + Math.random() * .1);
    motion.spin = Math.random() * Math.PI * 2;
    motion.angularVelocity = .044 + (force * .046);
    motion.lastSpeed = Math.hypot(motion.vx, motion.vy);
    motion.lockProgress = 0;
    motion.restFrames = 0;
    motion.force = force;
    motion.launchId = launchId;
    motion.launchedAt = time;
    motion.impact = 0;
    motion.impactEdge = '';
    motion.lastTime = time;
    return motion;
  }
  if (motion.settled) {
    motion.impact = Math.max(0, motion.impact - .08);
    motion.lockProgress = 1;
    motion.lastTime = time;
    return motion;
  }

  const delta = Math.max(10, Math.min(34, time - (motion.lastTime || time)));
  motion.lastTime = time;
  const elapsed = time - (motion.launchedAt || time);
  const frameRatio = delta / 16.67;
  const slowDownStart = 250 + (motion.force * 650);
  const slowDownProgress = Math.max(0, Math.min(1, (elapsed - slowDownStart) / 3200));
  const slowDown = slowDownProgress * slowDownProgress * (3 - (2 * slowDownProgress));
  const remainingEnergy = 1 - slowDown;
  motion.vy += (.00058 + (motion.force * .00024)) * (.18 + remainingEnergy * .82) * delta;
  motion.x += motion.vx * delta;
  motion.y += motion.vy * delta;
  motion.impact = Math.max(0, motion.impact - (delta / 150));
  motion.vx *= Math.pow(.994 - (slowDown * .022), frameRatio);
  motion.vy *= Math.pow(.998 - (slowDown * .012), frameRatio);
  motion.angularVelocity *= Math.pow(.996 - (slowDown * .018), frameRatio);
  motion.angularVelocity = Math.min(motion.angularVelocity, .008 + ((1 - slowDown) * (.078 + motion.force * .022)));

  let impactEdge = '';
  const sideBounce = (.76 + (motion.force * .16)) * (1 - (slowDown * .28));
  const floorBounce = (.7 + (motion.force * .16)) * (1 - (slowDown * .34));
  if (motion.x < metrics.minX) {
    motion.x = metrics.minX;
    motion.vx = Math.abs(motion.vx) * sideBounce;
    motion.vy += (Math.random() - .5) * .035;
    impactEdge = 'left';
  } else if (motion.x > metrics.maxX) {
    motion.x = metrics.maxX;
    motion.vx = -Math.abs(motion.vx) * sideBounce;
    motion.vy += (Math.random() - .5) * .035;
    impactEdge = 'right';
  }

  if (motion.y < metrics.minY) {
    motion.y = metrics.minY;
    motion.vy = Math.abs(motion.vy) * floorBounce;
    motion.vx += (Math.random() - .5) * .03;
    impactEdge = 'top';
  } else if (motion.y > metrics.maxY) {
    motion.y = metrics.maxY;
    motion.vy = -Math.abs(motion.vy) * floorBounce;
    motion.vx += (Math.random() - .5) * .035;
    if (Math.abs(motion.vy) < .045 && elapsed > 900) motion.vy = 0;
    motion.vx *= .96 - (slowDown * .16);
    impactEdge = 'bottom';
  }

  if (impactEdge) {
    motion.impact = 1;
    motion.impactEdge = impactEdge;
    const bounceSpin = (.006 + (motion.force * .004)) * Math.max(0, remainingEnergy - .24);
    motion.angularVelocity = Math.min(.078, motion.angularVelocity + bounceSpin);
  }

  let speed = Math.hypot(motion.vx, motion.vy);
  if (slowDownProgress > .03) {
    const previousSpeed = motion.lastSpeed || speed;
    const speedDrop = (.004 + (slowDown * .028)) * frameRatio;
    const energyCeiling = .018 + remainingEnergy * (.62 + motion.force * .16);
    const maxAllowedSpeed = Math.max(.018, Math.min(energyCeiling, previousSpeed * Math.max(.72, 1 - speedDrop)));
    if (speed > maxAllowedSpeed) {
      const scale = maxAllowedSpeed / speed;
      motion.vx *= scale;
      motion.vy *= scale;
      speed = maxAllowedSpeed;
    }
    motion.angularVelocity = Math.min(
      motion.angularVelocity,
      .007 + remainingEnergy * (.08 + motion.force * .02),
    );
  }
  motion.lastSpeed = speed;
  const onFloor = Math.abs(motion.y - metrics.maxY) < .75;
  const minimumFlight = slowDownStart + 3600;
  const canLockResult = onFloor && slowDownProgress > .97 && elapsed > minimumFlight && speed < .045;
  if (canLockResult || motion.lockProgress > 0) {
    motion.lockProgress = Math.min(1, (motion.lockProgress || 0) + (delta / 980));
    motion.vx *= Math.pow(.88, frameRatio);
    motion.vy *= Math.pow(.82, frameRatio);
    motion.angularVelocity *= Math.pow(.9, frameRatio);
  }
  if (onFloor && motion.lockProgress >= .98 && speed < .024 && motion.angularVelocity < .009) {
    motion.restFrames += 1;
  } else {
    motion.restFrames = 0;
  }
  if (motion.restFrames > 18) {
    motion.settled = true;
    motion.x = Math.max(metrics.minX, Math.min(metrics.maxX, motion.x));
    motion.y = metrics.maxY;
    motion.vx = 0;
    motion.vy = 0;
    motion.angularVelocity = 0;
    motion.lockProgress = 1;
    return motion;
  }

  motion.vx = Math.max(-.58, Math.min(.58, motion.vx));
  motion.vy = Math.max(-.68, Math.min(.68, motion.vy));
  motion.spin += delta * motion.angularVelocity;
  return motion;
};

const drawCombatD20 = (canvas, options = {}) => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const bounds = canvas.getBoundingClientRect();
  const dieBounds = canvas.parentElement?.getBoundingClientRect?.() || bounds;
  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(1, Math.round(bounds.width * pixelRatio));
  const height = Math.max(1, Math.round(bounds.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);

  const time = options.time || 0;
  const rolling = Boolean(options.rolling);
  const displayValue = Number.isFinite(Number(options.value)) ? Math.round(Number(options.value)) : 20;
  const faceNumber = Math.max(1, Math.min(20, Number(options.faceNumber ?? displayValue) || 20));
  const resultFace = faceNumber - 1;
  const dieSize = Math.max(1, Math.min(dieBounds.width || bounds.width, dieBounds.height || bounds.height));
  const impact = rolling ? Math.max(0, Math.min(1, Number(options.motion?.impact) || 0)) : 0;
  const radius = dieSize * .52 * (1 + impact * .04);
  const centerX = (bounds.width / 2) + (rolling ? Number(options.motion?.x) || 0 : 0);
  const centerY = (bounds.height / 2) + (rolling ? Number(options.motion?.y) || 0 : 0);
  const spin = Number(options.motion?.spin) || time * .006;
  const angleX = rolling ? -0.48 + spin * .62 : -0.46;
  const angleY = rolling ? 0.42 + spin * .47 : 0.52;
  const angleZ = rolling ? spin * .9 : -0.18;
  const cameraDistance = 4.2;
  const light = normalizeD20Point([-0.55, -0.7, 1.1]);
  const resultOrientation = getD20FaceOrientation(resultFace);
  const currentMatrix = getD20RotationMatrix(angleX, angleY, angleZ);
  const resultMatrix = getD20FaceRotationMatrix(resultOrientation, -0.05);
  const lockProgress = rolling ? clampD20Unit(options.motion?.lockProgress) : 1;
  const rotationMatrix = !rolling || lockProgress >= 1
    ? resultMatrix
    : lockProgress <= 0
    ? currentMatrix
    : mixD20RotationMatrices(currentMatrix, resultMatrix, lockProgress);
  const rotatedVertices = D20_VERTICES.map((vertex) => applyD20MatrixToPoint(vertex, rotationMatrix));
  const projectedVertices = rotatedVertices.map(([x, y, z]) => {
    const perspective = cameraDistance / (cameraDistance - z);
    return {
      x: centerX + x * radius * perspective,
      y: centerY + y * radius * perspective,
      z,
      perspective,
    };
  });

  const faceValues = Array.from({ length: 20 }, (_, index) => index + 1);
  const frontFace = rolling
    ? D20_FACE_INDICES
      .map((indices, index) => {
        const averageZ = indices.reduce((sum, vertexIndex) => sum + rotatedVertices[vertexIndex][2], 0) / 3;
        return { index, averageZ };
      })
      .sort((a, b) => b.averageZ - a.averageZ)[0]?.index ?? 0
    : resultFace;
  if (!rolling) {
    faceValues[frontFace] = displayValue;
  }

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, .42)';
  context.shadowBlur = 22;
  context.shadowOffsetY = 14;
  context.beginPath();
  context.ellipse(centerX, centerY + radius * .72, radius * .68, radius * .18, 0, 0, Math.PI * 2);
  context.fillStyle = 'rgba(0, 0, 0, .38)';
  context.fill();
  context.restore();

  if (rolling && impact > 0) {
    const edge = options.motion?.impactEdge || '';
    const isHorizontalWall = edge === 'top' || edge === 'bottom';
    const direction = edge === 'left' || edge === 'top' ? -1 : 1;
    context.save();
    context.globalAlpha = Math.min(.9, impact);
    context.strokeStyle = 'rgba(253, 224, 71, .86)';
    context.lineWidth = 2.2;
    context.shadowColor = 'rgba(251, 191, 36, .74)';
    context.shadowBlur = 12;
    context.beginPath();
    if (isHorizontalWall) {
      const y = centerY + direction * radius * .92;
      context.moveTo(centerX - radius * .46, y);
      context.lineTo(centerX + radius * .46, y);
    } else {
      const x = centerX + direction * radius * .92;
      context.moveTo(x, centerY - radius * .46);
      context.lineTo(x, centerY + radius * .46);
    }
    context.stroke();
    context.restore();
  }

  const faces = D20_FACE_INDICES.map((indices, index) => {
    const points = indices.map((vertexIndex) => projectedVertices[vertexIndex]);
    const vertices = indices.map((vertexIndex) => rotatedVertices[vertexIndex]);
    let normal = normalizeD20Point(crossD20Point(
      subtractD20Point(vertices[1], vertices[0]),
      subtractD20Point(vertices[2], vertices[0]),
    ));
    const centroid = vertices.reduce((sum, vertex) => [
      sum[0] + vertex[0] / 3,
      sum[1] + vertex[1] / 3,
      sum[2] + vertex[2] / 3,
    ], [0, 0, 0]);
    if ((normal[0] * centroid[0] + normal[1] * centroid[1] + normal[2] * centroid[2]) < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
    }
    const averageZ = points.reduce((sum, point) => sum + point.z, 0) / 3;
    const lightAmount = Math.max(0, normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
    const visible = normal[2] > -0.14;
    return { index, points, vertices, normal, averageZ, lightAmount, visible };
  }).sort((a, b) => a.averageZ - b.averageZ);

  faces.forEach((face) => {
    const isFrontFace = face.index === frontFace;
    const hue = isFrontFace ? 266 : 256 + ((face.index * 7) % 32);
    const lightness = Math.round((face.visible ? 18 : 9) + face.lightAmount * 28 + (isFrontFace ? 7 : 0));
    context.beginPath();
    face.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.fillStyle = `hsl(${hue} 70% ${Math.max(8, Math.min(52, lightness))}%)`;
    context.strokeStyle = isFrontFace ? 'rgba(253, 224, 71, .66)' : 'rgba(226, 232, 240, .32)';
    context.lineWidth = isFrontFace ? 1.6 : 1;
    context.fill();
    context.stroke();

    const gradient = context.createLinearGradient(face.points[0].x, face.points[0].y, face.points[2].x, face.points[2].y);
    gradient.addColorStop(0, 'rgba(255, 255, 255, .18)');
    gradient.addColorStop(.48, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, .26)');
    context.fillStyle = gradient;
    context.fill();
  });

  faces.filter((face) => face.visible).forEach((face) => {
    const center = face.points.reduce((sum, point) => ({
      x: sum.x + point.x / 3,
      y: sum.y + point.y / 3,
      z: sum.z + point.z / 3,
    }), { x: 0, y: 0, z: 0 });
    const isFrontFace = face.index === frontFace;
    const faceArea = getD20ProjectedFaceArea(face.points);
    const minEdge = getD20ProjectedFaceMinEdge(face.points);
    const label = String(faceValues[face.index]);
    if (!isFrontFace && (face.normal[2] < .34 || faceArea < 270 || minEdge < 20)) return;
    const [topPoint, ...basePoints] = [...face.points].sort((a, b) => a.y - b.y);
    const [leftBasePoint, rightBasePoint] = basePoints.sort((a, b) => a.x - b.x);
    const baseVector = {
      x: rightBasePoint.x - leftBasePoint.x,
      y: rightBasePoint.y - leftBasePoint.y,
    };
    const baseLength = Math.hypot(baseVector.x, baseVector.y) || 1;
    const baseMidPoint = {
      x: (leftBasePoint.x + rightBasePoint.x) / 2,
      y: (leftBasePoint.y + rightBasePoint.y) / 2,
    };
    const heightVector = {
      x: baseMidPoint.x - topPoint.x,
      y: baseMidPoint.y - topPoint.y,
    };
    const heightLength = Math.hypot(heightVector.x, heightVector.y) || 1;
    const labelScale = Math.min(
      isFrontFace ? 23 : 13,
      baseLength / (label.length > 1 ? 3.2 : 2.55),
      heightLength * (isFrontFace ? .52 : .52),
    );
    if (!isFrontFace && labelScale < 8.4) return;
    const xAxis = {
      x: (baseVector.x / baseLength) * labelScale,
      y: (baseVector.y / baseLength) * labelScale,
    };
    const yAxis = {
      x: (heightVector.x / heightLength) * labelScale,
      y: (heightVector.y / heightLength) * labelScale,
    };
    context.save();
    context.beginPath();
    face.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.clip();
    context.translate(center.x, center.y);
    context.transform(xAxis.x, xAxis.y, yAxis.x, yAxis.y, 0, 0);
    context.globalAlpha = isFrontFace ? 1 : Math.min(.92, .52 + face.normal[2]);
    context.font = '950 1px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = isFrontFace ? .15 : .13;
    context.strokeStyle = isFrontFace ? 'rgba(30, 10, 54, .86)' : 'rgba(22, 8, 41, .78)';
    context.fillStyle = isFrontFace ? '#fff7ed' : '#fef3c7';
    context.strokeText(label, 0, 0);
    context.fillText(label, 0, 0);
    context.restore();
  });
};

function CombatD20Canvas({
  value = 20,
  faceNumber = value,
  rolling = false,
  launchForce = .35,
  launchId = 0,
  onSettle,
}) {
  const canvasRef = useRef(null);
  const motionRef = useRef(createD20MotionState());
  const onSettleRef = useRef(onSettle);

  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let animationFrame = 0;

    const render = (time) => {
      const motion = motionRef.current;
      if (rolling) {
        updateD20Motion(canvas, time, motion, { force: launchForce, id: launchId });
      } else {
        Object.assign(motion, createD20MotionState());
      }
      drawCombatD20(canvas, { value, faceNumber, rolling, time, motion });
      if (rolling && motion.settled && !motion.notified) {
        motion.notified = true;
        window.setTimeout(() => onSettleRef.current?.(), 180);
      }
      if (rolling && !motion.settled) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    render(window.performance.now());

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [faceNumber, launchForce, launchId, rolling, value]);

  return <canvas className="hero-d20-canvas" ref={canvasRef} width="132" height="132" aria-hidden="true" />;
}

const clampCombatHeadline = (value = '') => {
  const text = normalizeCombatJournalText(value);
  if (text.length <= 72) return text;
  return `${text.slice(0, 69).replace(/\s+\S*$/, '')}...`;
};

export default function PreviewCombatOverlay({
  activeHeroCombat = null,
  heroCombatStates = {},
  isHeroAdventure = false,
  heroAdventure = {},
  heroState = {},
  playSceneBackgroundUrl = '',
  lastDiceRoll = null,
  inventory = [],
  selectedHeroCombatPowerId = '',
  setSelectedHeroCombatPowerId = () => {},
  heroCombatEffectLocked = false,
  isHeroDefeated = false,
  heroCombatRolling = false,
  heroCombatDieFace = 1,
  heroDiceSkin = 'classic',
  heroCombatRollIntervalRef,
  heroCombatAutoStopTimeoutRef,
  heroCombatDieFaceRef,
  setHeroCombatDieFace,
  setHeroCombatRolling,
  attemptSurvivalHeroCombat,
  rollActiveEnemyCombat,
  attackActiveHeroCombat,
  attemptEscapeHeroCombat,
  closeHeroCombat,
  openInventoryItem,
  project,
  Anime2DPreviewComponent,
  getCombatEntryValue,
  getCombatActorMedia,
}) {
  const [heroCombatCharging, setHeroCombatCharging] = useState(false);
  const [heroCombatCharge, setHeroCombatCharge] = useState(0);
  const [heroCombatLaunchForce, setHeroCombatLaunchForce] = useState(.35);
  const [heroCombatLaunchId, setHeroCombatLaunchId] = useState(0);
  const heroCombatChargeFrameRef = useRef(0);
  const heroCombatChargeStartRef = useRef(0);
  const heroCombatChargingRef = useRef(false);
  const heroCombatRollSettledRef = useRef(false);
  const heroCombatPendingRollRef = useRef(null);

  useEffect(() => () => {
    if (heroCombatChargeFrameRef.current) {
      window.cancelAnimationFrame(heroCombatChargeFrameRef.current);
    }
  }, []);

  if (!activeHeroCombat || !isHeroAdventure) return null;

  const renderHeroCombatEffectMedia = (effect) => {
    const media = effect?.media;
    if (!media) return null;
    const audioNode = media.audioData ? (
      <audio src={media.audioData} autoPlay preload="auto" style={{ display: 'none' }} />
    ) : null;
    if (media.mediaType === 'anime2d' && media.anime2dSpec) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--anime">
            <Anime2DPreviewComponent spec={media.anime2dSpec} project={project} />
          </span>
        </>
      );
    }
    if (media.mediaType === 'video' && media.videoData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--video">
            <video src={media.videoData} autoPlay muted playsInline />
          </span>
        </>
      );
    }
    if (media.mediaType === 'image' && media.imageData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--image">
            <img src={media.imageData} alt="" />
          </span>
        </>
      );
    }
    if (media.mediaType === 'visual' && media.visualEffect && media.visualEffect !== 'none') {
      return (
        <>
          {audioNode}
          <span className={`hero-combat-fx-visual hero-combat-fx-visual--${media.visualEffect}`} aria-hidden="true" />
        </>
      );
    }
    return audioNode;
  };

  const renderHeroCombatActor = (media, label, side, vitals = {}, visualEffects = [], actorMeta = {}) => {
    const maxHealth = Math.max(1, Number(vitals.maxHealth) || 1);
    const health = Math.max(0, Math.min(maxHealth, Number(vitals.health) || 0));
    const maxMana = Math.max(0, Number(vitals.maxMana) || 0);
    const mana = Math.max(0, Math.min(maxMana, Number(vitals.mana) || 0));
    const healthPercent = (health / maxHealth) * 100;
    const manaPercent = maxMana > 0 ? (mana / maxMana) * 100 : 0;
    const statusEffects = Array.isArray(actorMeta.statusEffects) ? actorMeta.statusEffects : [];
    const initiative = Number.isFinite(Number(actorMeta.initiative)) ? Number(actorMeta.initiative) : 0;
    const isActiveActor = Boolean(actorMeta.isActive);
    const actorEffects = visualEffects.filter((effect) => effect.target === side);
    const actorVisualEffect = actorEffects.find((effect) => (
      effect?.media?.mediaType === 'visual'
      && effect.media.visualEffect
      && effect.media.visualEffect !== 'none'
    ))?.media?.visualEffect || '';
    const actorVisualEffectClass = actorVisualEffect ? `hero-combat-actor--visual-${actorVisualEffect}` : '';
    const actorEffectLabel = actorEffects.find((effect) => ['damage', 'death', 'heal'].includes(effect.type || ''))?.text
      || actorEffects.find((effect) => effect.type === 'critical')?.text
      || actorEffects.find((effect) => effect.text)?.text
      || (actorVisualEffect ? 'Effet actif' : '');

    return (
      <div className={`hero-combat-actor hero-combat-actor--${side} ${actorVisualEffectClass} ${media.mediaType === 'anime2d' && media.anime2dSpec ? 'has-anime' : media.imageData ? 'has-image' : 'is-empty'}`}>
        <div className="hero-combat-actor-head">
          <span>
            <small>{side === 'hero' ? 'Héros' : 'Adversaire'}</small>
            <strong>{label}</strong>
          </span>
          <em className={isActiveActor ? 'is-active' : ''}>{isActiveActor ? 'À jouer' : `Init ${initiative}`}</em>
        </div>
        <div className="hero-combat-actor-bars" aria-label={`Jauges ${label}`}>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--health">
            <span>PV</span>
            <strong>{health}/{maxHealth}</strong>
            <i style={{ width: `${healthPercent}%` }} />
          </div>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--mana">
            <span>Mana</span>
            <strong>{mana}/{maxMana}</strong>
            <i style={{ width: `${manaPercent}%` }} />
          </div>
        </div>
        <div className="hero-combat-actor-status-row" aria-label={`Statuts ${label}`}>
          {statusEffects.length ? statusEffects.map((effect, index) => {
            const status = getStatusEffectParts(effect);
            const statusClass = getStatusBadgeClass(status.type);
            return (
              <span
                key={`${status.type || 'status'}-${index}`}
                className={`hero-combat-status-badge hero-combat-status-badge--${statusClass}`}
                title={formatStatusEffectBadge(effect)}
              >
                <span className={`hero-combat-status-icon hero-combat-status-icon--${statusClass}`} aria-hidden="true" />
                <span className="hero-combat-status-copy">
                  <strong>{status.label}</strong>
                  {status.meta ? <small>{status.meta}</small> : null}
                </span>
              </span>
            );
          }) : (
            <span className="hero-combat-status-badge is-empty">Aucun statut</span>
          )}
          {actorEffectLabel ? <span className="hero-combat-status-badge hero-combat-status-badge--effect">{actorEffectLabel}</span> : null}
        </div>
        <div className={`hero-combat-actor-media ${actorVisualEffect ? `hero-combat-actor-media--visual-${actorVisualEffect}` : ''}`}>
          {media.mediaType === 'anime2d' && media.anime2dSpec ? (
            <Anime2DPreviewComponent spec={media.anime2dSpec} project={project} />
          ) : media.imageData ? (
            <img src={media.imageData} alt={label} />
          ) : (
            <span>{label.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        {actorEffects.length ? (
          <div className="hero-combat-actor-fx" aria-live="polite">
            {actorEffects.map((effect, index) => (
              <span
                key={effect.id}
                className={`hero-combat-fx hero-combat-fx--${effect.type || 'damage'} ${effect.media ? 'hero-combat-fx--has-media' : ''}`}
                style={{ '--fx-delay': `${index * 90}ms`, '--fx-offset': `${index * 12}px` }}
              >
                {renderHeroCombatEffectMedia(effect)}
                <span className="hero-combat-fx-text">{effect.text}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const entry = activeHeroCombat.entry || {};
  const combatSettings = heroAdventure.combat || {};
  const backgroundImageData = entry.combatBackgroundImageData || combatSettings.backgroundImageData || playSceneBackgroundUrl || '';
  const heroMedia = getCombatActorMedia(entry, combatSettings, 'hero', heroState?.characterImageData || '');
  const enemyMedia = getCombatActorMedia(entry, combatSettings, 'enemy');
  const heroLabel = heroState?.name || 'Heros';
  const enemyLabel = activeHeroCombat.enemyName || entry.combatEnemyName || combatSettings.enemyName || 'Ennemi';
  const enemyMaxHealth = Math.max(1, Number(activeHeroCombat.enemyMaxHealth) || Number(entry.combatEnemyMaxHealth) || 1);
  const enemyHealth = Math.max(0, Math.min(enemyMaxHealth, Number(activeHeroCombat.enemyHealth) || 0));
  const enemyMaxMana = Math.max(0, Number(activeHeroCombat.enemyMaxMana) || Number(entry.combatEnemyMaxMana) || Number(combatSettings.enemyMaxMana) || 0);
  const enemyMana = Math.max(0, Math.min(enemyMaxMana, Number(activeHeroCombat.enemyMana) || 0));
  const heroMaxHealth = Math.max(1, Number(heroState?.maxHealth) || 1);
  const heroHealth = Math.max(0, Math.min(heroMaxHealth, Number(heroState?.health) || 0));
  const heroMaxMana = Math.max(0, Number(heroState?.maxMana) || 0);
  const heroMana = Math.max(0, Math.min(heroMaxMana, Number(heroState?.mana) || 0));
  const heroPowers = Array.isArray(heroState?.powers) ? heroState.powers : [];
  const combatManaCost = Math.max(0, Number(entry.combatManaCost) || 0);
  const diceSides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
  const selectedCombatSkill = (Array.isArray(heroState?.skills) ? heroState.skills : []).find((skill) => skill.id === entry.combatSkillId)
    || (Array.isArray(heroState?.skills) ? heroState.skills[0] : null);
  const heroForce = getHeroForceValue(heroState, selectedCombatSkill?.id || '');
  const heroDieDamagePercent = Math.max(0, Number(getCombatEntryValue(entry, 'combatHeroDieDamagePercent', combatSettings.heroDieDamagePercent || 0)) || 0);
  const estimatedDieDamage = Math.max(0, Math.round(((diceSides + 1) / 2) * (heroDieDamagePercent / 100)));
  const estimatePowerDamage = (power = null) => Math.max(0, heroForce + estimatedDieDamage + Math.max(0, Number(power?.force) || 0));
  const formatManaCost = (value) => `${Math.max(0, Number(value) || 0)} mana`;
  const formatDamageEstimate = (value) => `~${Math.max(0, Number(value) || 0)} dégâts`;
  const describePowerEffect = (power = {}) => {
    if (power.statusType === 'shield') return `Bouclier ${Math.max(0, Number(power.statusAmount) || Number(power.force) || 0)}`;
    if (Number(power.healHealth) > 0 || Number(power.healMana) > 0) {
      return [
        Number(power.healHealth) > 0 ? `PV +${Math.max(0, Number(power.healHealth) || 0)}` : '',
        Number(power.healMana) > 0 ? `Mana +${Math.max(0, Number(power.healMana) || 0)}` : '',
      ].filter(Boolean).join(' · ');
    }
    if (power.statusType) return `${getStatusEffectLabel(power.statusType)} ${Math.max(0, Number(power.statusAmount) || 0)}`;
    return formatDamageEstimate(estimatePowerDamage(power));
  };
  const currentCombatState = heroCombatStates?.[activeHeroCombat.id] || {};
  const heroStatusEffects = Array.isArray(currentCombatState.heroStatusEffects)
    ? currentCombatState.heroStatusEffects
    : Array.isArray(activeHeroCombat.heroStatusEffects)
    ? activeHeroCombat.heroStatusEffects
    : [];
  const enemyStatusEffects = Array.isArray(currentCombatState.enemyStatusEffects)
    ? currentCombatState.enemyStatusEffects
    : Array.isArray(activeHeroCombat.enemyStatusEffects)
    ? activeHeroCombat.enemyStatusEffects
    : [];
  const heroInitiative = Number.isFinite(Number(activeHeroCombat.heroInitiative))
    ? Number(activeHeroCombat.heroInitiative)
    : Math.max(-999, Math.min(999, Number(heroState?.initiative) || 0));
  const enemyInitiativeFallback = getCombatEntryValue(entry, 'combatEnemyInitiative', combatSettings.enemyInitiative || 0);
  const enemyInitiative = Number.isFinite(Number(activeHeroCombat.enemyInitiative))
    ? Number(activeHeroCombat.enemyInitiative)
    : Math.max(-999, Math.min(999, Number(enemyInitiativeFallback) || 0));
  const selectedHeroCombatPower = heroPowers.find((power) => power.id === selectedHeroCombatPowerId) || null;
  const selectedHeroCombatPowerMissing = Boolean(selectedHeroCombatPowerId && !selectedHeroCombatPower);
  const selectedHeroCombatPowerManaCost = selectedHeroCombatPower ? Math.max(0, Number(selectedHeroCombatPower.manaCost) || 0) : 0;
  const selectedHeroCombatManaCost = combatManaCost + selectedHeroCombatPowerManaCost;
  const selectedHeroCombatManaUnavailable = selectedHeroCombatManaCost > heroMana;
  const selectedHeroCombatActionLabel = selectedHeroCombatPower
    ? `Utiliser ${selectedHeroCombatPower.name || 'Pouvoir'}`
    : 'Attaque normale';
  const showDice = getCombatEntryValue(entry, 'combatShowDice', combatSettings.showDice !== false) !== false;
  const lastCombatRoll = activeHeroCombat.lastEnemyRoll
    || activeHeroCombat.lastRoll
    || (['hero_combat', 'enemy_combat', 'hero_combat_escape', 'hero_combat_survival'].includes(lastDiceRoll?.actionType) ? lastDiceRoll : null);
  const overlayStyle = backgroundImageData
    ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.18), rgba(2,6,23,.82)), url(${backgroundImageData})` }
    : undefined;
  const isEnded = ['victory', 'defeat'].includes(activeHeroCombat.status);
  const isEnemyTurn = activeHeroCombat.phase === 'enemy';
  const isSurvivalTurn = activeHeroCombat.phase === 'survival';
  const enemyCunning = Math.max(1, Number(getCombatEntryValue(entry, 'combatEnemyCunning', combatSettings.enemyCunning || 10)) || 10);
  const attackPowers = heroPowers.filter((power) => power.statusType !== 'shield');
  const defensePowers = heroPowers.filter((power) => power.statusType === 'shield');
  const firstAvailablePower = attackPowers.find((power) => combatManaCost + Math.max(0, Number(power.manaCost) || 0) <= heroMana) || null;
  const firstDefensePower = defensePowers.find((power) => combatManaCost + Math.max(0, Number(power.manaCost) || 0) <= heroMana) || null;
  const isSelectedDefensePower = selectedHeroCombatPower?.statusType === 'shield';
  const inventoryItems = Array.isArray(inventory)
    ? inventory.map((itemId) => project?.items?.find((item) => item.id === itemId)).filter(Boolean)
    : [];
  const usableCombatItems = inventoryItems.filter((item) => (
    (item.heroItemType === 'health_potion' && heroHealth < heroMaxHealth)
    || (item.heroItemType === 'mana_potion' && heroMana < heroMaxMana)
  ));
  const firstUsableCombatItem = usableCombatItems[0] || null;
  const describeCombatItem = (item = {}) => {
    if (item.heroItemType === 'health_potion') return `PV +${Math.max(1, Number(item.heroItemAmount) || 4)}`;
    if (item.heroItemType === 'mana_potion') return `Mana +${Math.max(1, Number(item.heroItemAmount) || 3)}`;
    return 'Objet';
  };
  const combatVisualEffects = Array.isArray(activeHeroCombat.visualEffects) ? activeHeroCombat.visualEffects : [];
  const isCombatEffectLocked = heroCombatEffectLocked && combatVisualEffects.length > 0;
  const combatPrimaryActionLabel = isEnded
    ? 'Combat terminé'
    : isCombatEffectLocked
    ? 'Impact...'
    : heroCombatCharging
    ? 'Charge...'
    : heroCombatRolling && isEnemyTurn
    ? 'La riposte roule...'
    : isEnemyTurn
    ? 'Maintenir la riposte'
    : heroCombatRolling
    ? 'Le dé roule...'
    : isSurvivalTurn
    ? 'Maintenir Survie'
    : `Maintenir ${selectedHeroCombatActionLabel}`;
  const CombatPrimaryIcon = isEnemyTurn || isSurvivalTurn || heroCombatRolling || heroCombatCharging ? Dices : Swords;
  const combatPrimaryActionClass = [
    'hero-combat-main-action',
    isEnemyTurn ? 'is-enemy' : '',
    isSurvivalTurn ? 'is-survival' : '',
    heroCombatCharging ? 'is-charging' : '',
    heroCombatRolling ? 'is-rolling' : '',
    isCombatEffectLocked ? 'is-impact' : '',
  ].filter(Boolean).join(' ');
  const combatRollActionType = heroCombatRolling || heroCombatCharging
    ? (isEnemyTurn ? 'enemy_combat' : isSurvivalTurn ? 'hero_combat_survival' : 'hero_combat')
    : lastCombatRoll?.actionType || '';
  const combatRollActor = combatRollActionType === 'enemy_combat' ? 'enemy' : 'hero';
  const combatRollTarget = combatRollActionType === 'enemy_combat'
    ? 'hero'
    : combatRollActionType === 'hero_combat_survival'
    ? 'hero'
    : 'enemy';
  const combatRollImpactDamageEffect = !heroCombatRolling && !heroCombatCharging && lastCombatRoll
    ? combatVisualEffects.find((effect) => (
      effect?.target === combatRollTarget
      && ['damage', 'death', 'heal'].includes(effect.type || '')
      && effect.text
    ))
    : null;
  const combatRollImpactSpecialEffect = !heroCombatRolling && !heroCombatCharging && lastCombatRoll
    ? combatVisualEffects.find((effect) => (
      effect?.target === combatRollTarget
      && effect.type === 'critical'
      && effect.text
    ))
    : null;
  const combatRollImpactEffect = combatRollImpactDamageEffect || combatRollImpactSpecialEffect;
  const combatRollRawValue = lastCombatRoll
    ? Math.max(1, Math.min(20, Number(lastCombatRoll.raw) || Number(lastCombatRoll.total) || 20))
    : '';
  const combatRollRawNumber = Number(combatRollRawValue);
  const combatRollTotalNumber = Number(lastCombatRoll?.total);
  const combatRollResultValue = lastCombatRoll
    ? (Number.isFinite(combatRollTotalNumber) ? Math.round(combatRollTotalNumber) : combatRollRawValue)
    : '';
  const combatRollModifier = Number(lastCombatRoll?.modifier);
  const combatRollIsAdditive = lastCombatRoll
    && Number.isFinite(combatRollRawNumber)
    && Number.isFinite(combatRollModifier)
    && Number.isFinite(combatRollTotalNumber)
    && Math.round(combatRollRawNumber + combatRollModifier) === Math.round(combatRollTotalNumber);
  const combatRollFormula = lastCombatRoll && Number(combatRollResultValue) !== Number(combatRollRawValue)
    ? combatRollIsAdditive
      ? `De ${combatRollRawValue}${combatRollModifier >= 0 ? ' +' : ' '}${combatRollModifier}`
      : `De ${combatRollRawValue} -> ${combatRollResultValue}`
    : '';
  const combatRollResultFace = combatRollRawValue || Math.max(1, Math.min(20, Number(combatRollResultValue) || 20));
  const showCombatRollResult = Boolean(lastCombatRoll && !heroCombatRolling && !heroCombatCharging);
  const combatRollResultKey = lastCombatRoll
    ? `${lastCombatRoll.id || 'roll'}-${lastCombatRoll.actionType || 'combat'}-${lastCombatRoll.raw}-${lastCombatRoll.total}-${activeHeroCombat.message || ''}`
    : 'combat-roll-empty';
  const combatRollHasCritical = showCombatRollResult && Boolean(
    lastCombatRoll?.isCriticalSuccess
    || lastCombatRoll?.heroCritical
    || combatVisualEffects.some((effect) => effect.type === 'critical')
  );
  const combatRollHasFailure = Boolean(showCombatRollResult && (lastCombatRoll?.isCriticalFailure || lastCombatRoll?.success === false));
  const combatRollDamage = Number(lastCombatRoll?.damage);
  const combatRollHasDamageValue = showCombatRollResult && Number.isFinite(combatRollDamage);
  const combatRollHasNoDamage = Boolean(combatRollHasDamageValue && combatRollDamage <= 0 && combatRollActionType !== 'hero_combat_survival');
  const combatRollNoDamageText = lastCombatRoll?.dodged
    ? 'Esquivé'
    : Number(lastCombatRoll?.damageBlocked) > 0
    ? 'Bloqué'
    : combatRollActionType === 'enemy_combat'
    ? 'Héros indemne'
    : 'Aucun dégât';
  const combatRollImpactText = combatRollImpactEffect?.text
    || (combatRollHasFailure ? 'Raté' : combatRollHasNoDamage ? combatRollNoDamageText : combatRollHasCritical ? 'Critique' : '');
  const combatRollKickerLabel = showCombatRollResult
    ? combatRollActionType === 'enemy_combat'
      ? 'Riposte'
      : combatRollActionType === 'hero_combat_survival'
      ? 'Survie'
      : 'Jet du héros'
    : heroAdventure.dice?.label || 'Dé';
  const combatDiceSpotlightClass = [
    'hero-combat-dice-spotlight',
    heroCombatCharging ? 'is-charging' : '',
    heroCombatRolling ? 'is-rolling' : '',
    showCombatRollResult ? 'has-result' : '',
    combatRollHasCritical ? 'is-critical' : '',
    combatRollHasFailure || combatRollHasNoDamage ? 'is-failure' : '',
    `hero-combat-dice-spotlight--${combatRollActor}`,
    `hero-combat-dice-spotlight--target-${combatRollTarget}`,
  ].filter(Boolean).join(' ');
  const combatJournalMessage = normalizeCombatJournalText(activeHeroCombat.message || 'Le combat commence.');
  const combatJournalHistory = (
    Array.isArray(activeHeroCombat.history) && activeHeroCombat.history.length
      ? activeHeroCombat.history
      : [combatJournalMessage]
  ).map(normalizeCombatJournalText).filter(Boolean).slice(-8);
  const combatJournalSentences = splitCombatJournalText(combatJournalMessage);
  const combatJournalDetail = combatJournalSentences.length > 1
    ? combatJournalSentences.slice(1).join(' ')
    : combatJournalMessage;
  const combatJournalHeadline = clampCombatHeadline(
    isEnded
      ? activeHeroCombat.status === 'victory'
        ? 'Victoire remportée.'
        : 'Le héros tombe.'
      : combatRollImpactText
      || (isCombatEffectLocked
        ? 'Impact en cours...'
        : isEnemyTurn
        ? 'La riposte se prépare.'
        : isSurvivalTurn
        ? 'Dernier souffle.'
        : selectedHeroCombatPower
        ? `${selectedHeroCombatPower.name || 'Pouvoir'} est prêt.`
        : 'À toi de jouer.')
  );
  const canChooseHeroAction = !isEnded && !isEnemyTurn && !isSurvivalTurn && !isHeroDefeated && !isCombatEffectLocked;
  const handleCombatExit = () => {
    if (isEnded) {
      closeHeroCombat?.();
      return;
    }
    if (!isEnemyTurn && !isSurvivalTurn && !heroCombatRolling && !heroCombatCharging && !isCombatEffectLocked && attemptEscapeHeroCombat) {
      attemptEscapeHeroCombat();
    }
  };
  const combatActionHandler = (rawRoll) => (
    isSurvivalTurn
      ? attemptSurvivalHeroCombat?.({ rawRoll })
      : isEnemyTurn
      ? rollActiveEnemyCombat?.({ rawRoll })
      : attackActiveHeroCombat?.(selectedHeroCombatPower?.id || '', { rawRoll })
  );
  const combatActionDisabled = isEnded
    || (!isSurvivalTurn && isHeroDefeated)
    || isCombatEffectLocked
    || (isSurvivalTurn ? !attemptSurvivalHeroCombat : isEnemyTurn ? !rollActiveEnemyCombat : !attackActiveHeroCombat)
    || (!isEnemyTurn && !isSurvivalTurn && (selectedHeroCombatPowerMissing || selectedHeroCombatManaUnavailable));
  const clearHeroCombatChargeFrame = () => {
    if (heroCombatChargeFrameRef.current) {
      window.cancelAnimationFrame(heroCombatChargeFrameRef.current);
      heroCombatChargeFrameRef.current = 0;
    }
  };
  const updateHeroCombatCharge = () => {
    if (!heroCombatChargingRef.current) return;
    const elapsed = window.performance.now() - heroCombatChargeStartRef.current;
    const nextCharge = Math.max(0, Math.min(1, elapsed / COMBAT_D20_CHARGE_MAX_MS));
    setHeroCombatCharge(nextCharge);
    heroCombatChargeFrameRef.current = window.requestAnimationFrame(updateHeroCombatCharge);
  };
  const finishHeroCombatRoll = () => {
    if (heroCombatRollSettledRef.current) return;
    heroCombatRollSettledRef.current = true;
    if (heroCombatRollIntervalRef.current) {
      window.clearInterval(heroCombatRollIntervalRef.current);
      heroCombatRollIntervalRef.current = null;
    }
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
      heroCombatAutoStopTimeoutRef.current = null;
    }
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const finalRaw = Math.max(1, Math.min(sides, Number(heroCombatPendingRollRef.current || heroCombatDieFaceRef.current) || 1));
    heroCombatPendingRollRef.current = null;
    setHeroCombatRolling(false);
    setHeroCombatCharging(false);
    setHeroCombatCharge(0);
    combatActionHandler(finalRaw);
  };
  const cancelHeroCombatCharge = () => {
    heroCombatChargingRef.current = false;
    heroCombatPendingRollRef.current = null;
    clearHeroCombatChargeFrame();
    setHeroCombatCharging(false);
    setHeroCombatCharge(0);
  };
  const startHeroCombatCharge = () => {
    if (combatActionDisabled || heroCombatRolling || heroCombatCharging || isCombatEffectLocked) return;
    if (heroCombatRollIntervalRef.current) {
      window.clearInterval(heroCombatRollIntervalRef.current);
      heroCombatRollIntervalRef.current = null;
    }
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
      heroCombatAutoStopTimeoutRef.current = null;
    }
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const initialFace = Number(lastCombatRoll?.raw) || Math.floor(Math.random() * sides) + 1;
    heroCombatPendingRollRef.current = null;
    heroCombatDieFaceRef.current = Math.max(1, Math.min(sides, initialFace));
    setHeroCombatDieFace(heroCombatDieFaceRef.current);
    setHeroCombatCharge(0);
    setHeroCombatLaunchForce(.35);
    setHeroCombatCharging(true);
    heroCombatChargingRef.current = true;
    heroCombatChargeStartRef.current = window.performance.now();
    clearHeroCombatChargeFrame();
    heroCombatChargeFrameRef.current = window.requestAnimationFrame(updateHeroCombatCharge);
  };
  const launchHeroCombatRoll = () => {
    if (!heroCombatChargingRef.current || heroCombatRolling) return;
    const elapsed = window.performance.now() - heroCombatChargeStartRef.current;
    const force = Math.max(.18, Math.min(1, elapsed / COMBAT_D20_CHARGE_MAX_MS));
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const finalFace = Math.floor(Math.random() * sides) + 1;
    heroCombatChargingRef.current = false;
    clearHeroCombatChargeFrame();
    setHeroCombatCharging(false);
    setHeroCombatCharge(force);
    setHeroCombatLaunchForce(force);
    setHeroCombatLaunchId((current) => current + 1);
    heroCombatRollSettledRef.current = false;
    heroCombatPendingRollRef.current = finalFace;
    heroCombatDieFaceRef.current = finalFace;
    setHeroCombatDieFace(finalFace);
    setHeroCombatRolling(true);
    if (heroCombatRollIntervalRef.current) window.clearInterval(heroCombatRollIntervalRef.current);
    heroCombatRollIntervalRef.current = null;
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
    }
    heroCombatAutoStopTimeoutRef.current = window.setTimeout(() => {
      finishHeroCombatRoll();
    }, Math.round(7600 + (force * 3200)));
  };
  const handleHeroCombatPressStart = (event) => {
    if (event?.button != null && event.button !== 0) return;
    event?.preventDefault?.();
    try {
      if (event?.pointerId != null) event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is only an interaction enhancement.
    }
    startHeroCombatCharge();
  };
  const handleHeroCombatPressEnd = (event) => {
    event?.preventDefault?.();
    try {
      if (event?.pointerId != null) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore browsers that already released capture.
    }
    launchHeroCombatRoll();
  };
  const handleHeroCombatPressCancel = () => {
    cancelHeroCombatCharge();
  };
  const handleHeroCombatKeyDown = (event) => {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
    event.preventDefault();
    startHeroCombatCharge();
  };
  const handleHeroCombatKeyUp = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    launchHeroCombatRoll();
  };
  const displayedCombatDieFace = heroCombatRolling || heroCombatCharging ? heroCombatDieFace : combatRollRawValue || '?';
  const displayedCombatDieResultFace = heroCombatRolling || heroCombatCharging ? heroCombatDieFace : combatRollResultFace;

  return (
    <div className={`hero-combat-overlay hero-combat-overlay--${activeHeroCombat.status || 'active'}${isEnemyTurn ? ' hero-combat-overlay--enemy-turn' : ''}`} style={overlayStyle}>
      <div className="hero-combat-topline">
        <span>{isSurvivalTurn ? 'Survie' : isEnemyTurn ? 'Tour ennemi' : `Tour ${activeHeroCombat.round || 1}`}</span>
        <strong>{enemyLabel}</strong>
        {isEnded ? (
          <button type="button" className="secondary-action compact" onClick={handleCombatExit}>
            {activeHeroCombat.pendingSceneId ? 'Continuer' : 'Revenir a la scene'}
          </button>
        ) : null}
      </div>

      <div className="hero-combat-stage">
        {renderHeroCombatActor(heroMedia, heroLabel, 'hero', {
          health: heroHealth,
          maxHealth: heroMaxHealth,
          mana: heroMana,
          maxMana: heroMaxMana,
        }, combatVisualEffects, {
          initiative: heroInitiative,
          isActive: !isEnemyTurn && !isSurvivalTurn && !isEnded,
          statusEffects: heroStatusEffects,
        })}

        {showDice ? (
          <div className={combatDiceSpotlightClass}>
            <span className="hero-combat-dice-aura" aria-hidden="true" />
            <button
              type="button"
              className={`hero-combat-die-button ${heroCombatCharging ? 'is-charging' : ''} ${heroCombatRolling ? 'is-rolling' : ''} ${showCombatRollResult ? 'has-result' : ''}`}
              onPointerDown={handleHeroCombatPressStart}
              onPointerUp={handleHeroCombatPressEnd}
              onPointerCancel={handleHeroCombatPressCancel}
              onKeyDown={handleHeroCombatKeyDown}
              onKeyUp={handleHeroCombatKeyUp}
              onClick={(event) => event.preventDefault()}
              disabled={combatActionDisabled || heroCombatRolling}
            >
              <span className={`hero-combat-die hero-d20 hero-die-face hero-die-face--${heroDiceSkin} ${heroCombatCharging ? 'is-charging' : ''} ${heroCombatRolling ? 'is-rolling' : ''} ${showCombatRollResult ? 'has-result' : ''}`}>
                <CombatD20Canvas
                  value={displayedCombatDieFace}
                  faceNumber={displayedCombatDieResultFace}
                  rolling={heroCombatRolling}
                  launchForce={heroCombatLaunchForce}
                  launchId={heroCombatLaunchId}
                  onSettle={finishHeroCombatRoll}
                />
                <span className="hero-roll-die-value">{displayedCombatDieFace}</span>
              </span>
            </button>
            {showCombatRollResult ? (
              <>
                <span key={`${combatRollResultKey}-burst`} className="hero-combat-dice-result-burst" aria-hidden="true">
                  {combatRollResultValue}
                </span>
                <span key={`${combatRollResultKey}-trail`} className="hero-combat-dice-impact-trail" aria-hidden="true">
                  {combatRollImpactText ? <span>{combatRollImpactText}</span> : null}
                </span>
              </>
            ) : null}
            <strong>
              <span className="hero-combat-dice-kicker">{heroCombatCharging ? 'Force' : heroCombatRolling ? 'Lancer...' : combatRollKickerLabel}</span>
              {heroCombatCharging ? `${Math.round(heroCombatCharge * 100)}%` : heroCombatRolling ? '...' : showCombatRollResult ? `${combatRollResultValue} total` : heroAdventure.dice?.label || 'De'}
              {showCombatRollResult && combatRollFormula ? <em>{combatRollFormula}</em> : null}
            </strong>
            <small>{isEnded ? 'Combat termine' : isCombatEffectLocked ? 'Impact...' : heroCombatCharging ? 'Relache pour lancer' : heroCombatRolling ? 'Le de roule...' : isEnemyTurn ? 'Maintiens pour la riposte' : isSurvivalTurn ? 'Maintiens Survie' : 'Maintiens pour charger'}</small>
            <span className={`hero-combat-force-meter ${heroCombatCharging ? 'is-charging' : ''} ${heroCombatRolling ? 'is-launched' : ''}`} aria-hidden="true">
              <span style={{ width: `${Math.round((heroCombatCharging ? heroCombatCharge : heroCombatRolling ? heroCombatLaunchForce : 0) * 100)}%` }} />
            </span>
          </div>
        ) : null}

        {renderHeroCombatActor(enemyMedia, enemyLabel, 'enemy', {
          health: enemyHealth,
          maxHealth: enemyMaxHealth,
          mana: enemyMana,
          maxMana: enemyMaxMana,
        }, combatVisualEffects, {
          initiative: enemyInitiative,
          isActive: isEnemyTurn && !isEnded,
          statusEffects: enemyStatusEffects,
        })}
      </div>

      <div className="hero-combat-log">
        <div className="hero-combat-journal" role="status" aria-live="polite">
          <span className="hero-combat-journal-kicker">Journal</span>
          <strong className="hero-combat-journal-headline">{combatJournalHeadline}</strong>
          {combatJournalDetail ? <p>{combatJournalDetail}</p> : null}
          {combatJournalHistory.length ? (
            <details className="hero-combat-journal-history">
              <summary>Historique ({combatJournalHistory.length})</summary>
              <ol>
                {[...combatJournalHistory].reverse().map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
        {isSurvivalTurn && !isEnded ? (
          <div className="hero-combat-survival-card" role="status" aria-live="polite">
            <strong>Survie</strong>
            <span>Lance le de pour tenter de rester a 1 PV.</span>
          </div>
        ) : null}
        {!isEnemyTurn && !isSurvivalTurn && !isEnded ? (
          <div className="hero-combat-action-panel">
            <div className="hero-combat-action-bar" aria-label="Barre d'action du heros">
              <button
                type="button"
                className={`hero-combat-action-button ${!selectedHeroCombatPower ? 'active' : ''}`}
                onClick={() => setSelectedHeroCombatPowerId('')}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || combatManaCost > heroMana}
                title={combatManaCost > heroMana ? 'Mana insuffisante' : 'Attaque normale'}
              >
                <Swords size={17} aria-hidden="true" />
                <strong>Attaque</strong>
                <span>{formatManaCost(combatManaCost)} · {formatDamageEstimate(estimatePowerDamage(null))}</span>
              </button>
              <button
                type="button"
                className={`hero-combat-action-button ${selectedHeroCombatPower && !isSelectedDefensePower ? 'active' : ''}`}
                onClick={() => firstAvailablePower && setSelectedHeroCombatPowerId(firstAvailablePower.id)}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || !attackPowers.length || !firstAvailablePower}
                title={!attackPowers.length ? 'Aucun pouvoir offensif' : !firstAvailablePower ? 'Mana insuffisante' : 'Choisir un pouvoir'}
              >
                <Sparkles size={17} aria-hidden="true" />
                <strong>Pouvoir</strong>
                <span>{attackPowers.length ? (firstAvailablePower ? `${formatManaCost(combatManaCost + Math.max(0, Number(firstAvailablePower.manaCost) || 0))} · ${describePowerEffect(firstAvailablePower)}` : 'Mana insuffisante') : 'Aucun pouvoir'}</span>
              </button>
              <button
                type="button"
                className="hero-combat-action-button"
                onClick={() => firstUsableCombatItem && openInventoryItem?.(firstUsableCombatItem.id)}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || !firstUsableCombatItem}
                title={!firstUsableCombatItem ? 'Aucun objet utile maintenant' : `Utiliser ${firstUsableCombatItem.name || 'objet'}`}
              >
                <Package size={17} aria-hidden="true" />
                <strong>Objet</strong>
                <span>{firstUsableCombatItem ? `${firstUsableCombatItem.name || 'Objet'} · ${describeCombatItem(firstUsableCombatItem)}` : 'Aucun objet'}</span>
              </button>
              <button
                type="button"
                className={`hero-combat-action-button ${isSelectedDefensePower ? 'active' : ''}`}
                onClick={() => firstDefensePower && setSelectedHeroCombatPowerId(firstDefensePower.id)}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || !defensePowers.length || !firstDefensePower}
                title={!defensePowers.length ? 'Aucun pouvoir de bouclier' : !firstDefensePower ? 'Mana insuffisante' : 'Choisir une défense'}
              >
                <Shield size={17} aria-hidden="true" />
                <strong>Défense</strong>
                <span>{defensePowers.length ? (firstDefensePower ? `${formatManaCost(combatManaCost + Math.max(0, Number(firstDefensePower.manaCost) || 0))} · ${describePowerEffect(firstDefensePower)}` : 'Mana insuffisante') : 'Aucun bouclier'}</span>
              </button>
              <button
                type="button"
                className="hero-combat-action-button is-danger"
                onClick={handleCombatExit}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging}
                title="Tenter de fuir"
              >
                <DoorOpen size={17} aria-hidden="true" />
                <strong>Fuir</strong>
                <span>Ruse vs {enemyCunning}</span>
              </button>
            </div>
            {heroPowers.length ? (
              <div className="hero-combat-power-strip" aria-label="Pouvoirs du heros">
                {heroPowers.map((power) => {
                  const manaCost = Math.max(0, Number(power.manaCost) || 0);
                  const totalManaCost = combatManaCost + manaCost;
                  const disabled = !canChooseHeroAction || totalManaCost > heroMana;
                  return (
                    <button
                      key={power.id}
                      type="button"
                      className={`hero-combat-power-chip ${selectedHeroCombatPowerId === power.id ? 'active' : ''} ${power.statusType === 'shield' ? 'is-defense' : ''}`}
                      onClick={() => setSelectedHeroCombatPowerId(power.id)}
                      disabled={disabled || heroCombatRolling || heroCombatCharging || isCombatEffectLocked}
                      title={disabled && totalManaCost > heroMana ? 'Mana insuffisante' : describePowerEffect(power)}
                    >
                      <strong>{power.name || 'Pouvoir'}</strong>
                      <span>{formatManaCost(totalManaCost)} · {describePowerEffect(power)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="inline-actions">
          <button
            type="button"
            className={combatPrimaryActionClass}
            onPointerDown={showDice ? handleHeroCombatPressStart : undefined}
            onPointerUp={showDice ? handleHeroCombatPressEnd : undefined}
            onPointerCancel={showDice ? handleHeroCombatPressCancel : undefined}
            onKeyDown={showDice ? handleHeroCombatKeyDown : undefined}
            onKeyUp={showDice ? handleHeroCombatKeyUp : undefined}
            onClick={showDice ? (event) => event.preventDefault() : () => combatActionHandler()}
            disabled={combatActionDisabled || heroCombatRolling}
          >
            <CombatPrimaryIcon size={18} aria-hidden="true" />
            <span>{combatPrimaryActionLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
