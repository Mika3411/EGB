import { useEffect, useRef } from 'react';

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

export default CombatD20Canvas;
