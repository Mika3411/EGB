export const CHARACTER_RIG_POINT_MIN = -0.35;
export const CHARACTER_RIG_POINT_MAX = 1.35;

export const CHARACTER_RIG_POINT_GROUPS = {
  body: 'body',
  phalanges: 'phalanges',
};

const CHARACTER_BODY_RIG_POINT_DEFINITIONS = [
  { id: 'right-hand', label: 'Poignet droit', shortLabel: 'MD', x: 0.76, y: 0.48, z: 0.68, socket: 'weapon', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'left-hand', label: 'Poignet gauche', shortLabel: 'MG', x: 0.24, y: 0.48, z: 0.68, socket: 'weapon', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'right-elbow', label: 'Coude droit', shortLabel: 'CD', x: 0.74, y: 0.58, z: 0.54, socket: 'shield', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'left-elbow', label: 'Coude gauche', shortLabel: 'CG', x: 0.26, y: 0.58, z: 0.54, socket: 'shield', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'right-shoulder', label: 'Epaule droite', shortLabel: 'ED', x: 0.66, y: 0.76, z: 0.52, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'left-shoulder', label: 'Epaule gauche', shortLabel: 'EG', x: 0.34, y: 0.76, z: 0.52, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'neck', label: 'Cou', shortLabel: 'CO', x: 0.5, y: 0.83, z: 0.58, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'mouth', label: 'Bouche', shortLabel: 'BO', x: 0.5, y: 0.91, z: 0.68, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'lower-belly', label: 'Bassin', shortLabel: 'BA', x: 0.5, y: 0.42, z: 0.54, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'right-groin-fold', label: 'Aine droite', shortLabel: 'AD', x: 0.58, y: 0.34, z: 0.54, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'left-groin-fold', label: 'Aine gauche', shortLabel: 'AG', x: 0.42, y: 0.34, z: 0.54, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'right-knee', label: 'Genou droit', shortLabel: 'GD', x: 0.58, y: 0.22, z: 0.54, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'left-knee', label: 'Genou gauche', shortLabel: 'GG', x: 0.42, y: 0.22, z: 0.54, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'right-ankle', label: 'Cheville droite', shortLabel: 'CHD', x: 0.57, y: 0.08, z: 0.56, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'left-ankle', label: 'Cheville gauche', shortLabel: 'CHG', x: 0.43, y: 0.08, z: 0.56, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'right-foot', label: 'Pied droit', shortLabel: 'PD', x: 0.59, y: 0.03, z: 0.68, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
  { id: 'left-foot', label: 'Pied gauche', shortLabel: 'PG', x: 0.41, y: 0.03, z: 0.68, socket: 'armor', group: CHARACTER_RIG_POINT_GROUPS.body },
];

const PHALANGE_HANDS = [
  { id: 'right', label: 'Main droite', systemPrefix: 'Right', centerX: 0.76, side: 1 },
  { id: 'left', label: 'Main gauche', systemPrefix: 'Left', centerX: 0.24, side: -1 },
];

const PHALANGE_FINGERS = [
  { id: 'thumb', systemName: 'Thumb', baseX: 0.07, tipX: 0.15, baseY: 0.51, tipY: 0.42, z: 0.69 },
  { id: 'index', systemName: 'Index', baseX: 0.03, tipX: 0.07, baseY: 0.5, tipY: 0.35, z: 0.68 },
  { id: 'middle', systemName: 'Middle', baseX: 0, tipX: 0, baseY: 0.5, tipY: 0.32, z: 0.68 },
  { id: 'ring', systemName: 'Ring', baseX: -0.03, tipX: -0.06, baseY: 0.5, tipY: 0.36, z: 0.68 },
  { id: 'pinky', systemName: 'Pinky', baseX: -0.06, tipX: -0.1, baseY: 0.49, tipY: 0.4, z: 0.69 },
];

const PHALANGE_JOINTS = [
  { id: '1', segment: 1, ratio: 0 },
  { id: '2', segment: 2, ratio: 0.5 },
  { id: '3', segment: 3, ratio: 1 },
  { id: '4', segment: 4, ratio: 1.16 },
];

const getPhalangePointId = (handId, fingerId, jointId) => (
  `${handId}-phalange-${fingerId}-${jointId}`
);

const makeCharacterPhalangeRigPointDefinitions = () => PHALANGE_HANDS.flatMap((hand) => (
  PHALANGE_FINGERS.flatMap((finger) => {
    let previousPointId = '';
    return PHALANGE_JOINTS.map((joint) => {
      const pointId = getPhalangePointId(hand.id, finger.id, joint.id);
      const systemName = `${hand.systemPrefix}${finger.systemName}${joint.segment}`;
      const point = {
        id: pointId,
        label: systemName,
        shortLabel: `${finger.systemName}${joint.segment}`,
        x: hand.centerX + hand.side * (finger.baseX + (finger.tipX - finger.baseX) * joint.ratio),
        y: finger.baseY + (finger.tipY - finger.baseY) * joint.ratio,
        z: finger.z,
        socket: 'finger',
        group: CHARACTER_RIG_POINT_GROUPS.phalanges,
        hand: hand.id,
        finger: finger.id,
        joint: joint.id,
        connectTo: previousPointId,
        hideLabel: true,
        size: 0.72,
      };
      previousPointId = pointId;
      return point;
    });
  })
));

export const CHARACTER_RIG_POINT_DEFINITIONS = [
  ...CHARACTER_BODY_RIG_POINT_DEFINITIONS,
  ...makeCharacterPhalangeRigPointDefinitions(),
];

export const CHARACTER_RIG_POINT_IDS = CHARACTER_RIG_POINT_DEFINITIONS.map((point) => point.id);

const CHARACTER_RIG_POINT_BY_ID = new Map(
  CHARACTER_RIG_POINT_DEFINITIONS.map((point) => [point.id, point]),
);

export const CHARACTER_RIG_CORE_ARMOR_GRIP_POINT_IDS = [
  'left-shoulder',
  'right-shoulder',
  'left-elbow',
  'right-elbow',
  'lower-belly',
];

const CHARACTER_RIG_CORE_ARMOR_GRIP_POINT_SET = new Set(CHARACTER_RIG_CORE_ARMOR_GRIP_POINT_IDS);

const CHARACTER_RIG_ARMOR_GRIP_OVERRIDES = {
  'left-shoulder': { role: 'shoulder', arm: 'left', defaultX: -0.45, defaultY: 0.55, defaultZ: 0 },
  'right-shoulder': { role: 'shoulder', arm: 'right', defaultX: 0.45, defaultY: 0.55, defaultZ: 0 },
  'left-elbow': { role: 'elbow', arm: 'left', defaultX: -0.65, defaultY: 0.05, defaultZ: 0 },
  'right-elbow': { role: 'elbow', arm: 'right', defaultX: 0.65, defaultY: 0.05, defaultZ: 0 },
  'lower-belly': { role: 'lower-belly', defaultX: 0, defaultY: -0.55, defaultZ: 0 },
};

const roundArmorGripDefaultValue = (value) => (
  Math.round(Math.max(-2, Math.min(2, Number(value) || 0)) * 1000) / 1000
);

const getArmorGripSuffixFromRigPointId = (id = '') => (
  String(id || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join('')
);

const getArmorGripDefaultsFromCharacterPoint = (point = {}) => {
  const override = CHARACTER_RIG_ARMOR_GRIP_OVERRIDES[point.id];
  if (override) return override;
  return {
    defaultX: roundArmorGripDefaultValue((Number(point.x) - 0.5) * 2.8),
    defaultY: roundArmorGripDefaultValue((Number(point.y) - 0.5) * 2.4),
    defaultZ: roundArmorGripDefaultValue((Number(point.z) - 0.5) * 1.2),
  };
};

export const CHARACTER_RIG_ARMOR_GRIP_POINTS = CHARACTER_RIG_POINT_DEFINITIONS.map((point) => ({
  ...getArmorGripDefaultsFromCharacterPoint(point),
  id: point.id,
  suffix: getArmorGripSuffixFromRigPointId(point.id),
  rigPointId: point.id,
  label: point.label,
  shortLabel: point.shortLabel,
  group: point.group || CHARACTER_RIG_POINT_GROUPS.body,
  hand: point.hand || '',
  finger: point.finger || '',
  joint: point.joint || '',
  characterX: point.x,
  characterY: point.y,
  characterZ: point.z,
  core: CHARACTER_RIG_CORE_ARMOR_GRIP_POINT_SET.has(point.id),
}));

export const getCharacterRigPointDefinition = (id = '') => (
  CHARACTER_RIG_POINT_BY_ID.get(id) || null
);

export const clampCharacterRigPointValue = (value, fallback = 0.5) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(CHARACTER_RIG_POINT_MIN, Math.min(CHARACTER_RIG_POINT_MAX, numeric));
};

export const roundCharacterRigPointValue = (value, fallback = 0.5) => (
  Math.round(clampCharacterRigPointValue(value, fallback) * 1000) / 1000
);

export const normalizeCharacterRigPoint = (point = {}, definition = null) => {
  const base = definition || getCharacterRigPointDefinition(point?.id);
  if (!base) return null;
  return {
    id: base.id,
    label: base.label,
    shortLabel: base.shortLabel,
    socket: base.socket,
    group: base.group || CHARACTER_RIG_POINT_GROUPS.body,
    hand: base.hand || '',
    finger: base.finger || '',
    joint: base.joint || '',
    connectTo: base.connectTo || '',
    hideLabel: Boolean(base.hideLabel),
    size: Number.isFinite(Number(base.size)) ? Number(base.size) : 1,
    enabled: Boolean(point?.enabled),
    x: roundCharacterRigPointValue(point?.x, base.x),
    y: roundCharacterRigPointValue(point?.y, base.y),
    z: roundCharacterRigPointValue(point?.z, base.z),
  };
};

export const normalizeCharacterRigPoints = (points = []) => {
  const sourceById = new Map(
    (Array.isArray(points) ? points : [])
      .filter((point) => point && typeof point === 'object')
      .map((point) => [String(point.id || ''), point]),
  );
  return CHARACTER_RIG_POINT_DEFINITIONS.map((definition) => (
    normalizeCharacterRigPoint(sourceById.get(definition.id) || {}, definition)
  )).filter(Boolean);
};

export const getCharacterRigPointById = (points = [], id = '') => (
  normalizeCharacterRigPoints(points).find((point) => point.id === id) || null
);

export const getCharacterRigPointsByGroup = (points = [], group = CHARACTER_RIG_POINT_GROUPS.body) => (
  normalizeCharacterRigPoints(points).filter((point) => point.group === group)
);

export const getEnabledCharacterRigPointById = (points = [], id = '') => {
  const point = getCharacterRigPointById(points, id);
  return point?.enabled ? point : null;
};

export const updateCharacterRigPoint = (points = [], id = '', patch = {}) => (
  normalizeCharacterRigPoints(points).map((point) => (
    point.id === id
      ? normalizeCharacterRigPoint({ ...point, ...patch, id }, getCharacterRigPointDefinition(id))
      : point
  )).filter(Boolean)
);

export const getCharacterRigSignature = (points = []) => (
  normalizeCharacterRigPoints(points)
    .map((point) => [
      point.id,
      point.enabled ? 1 : 0,
      point.x,
      point.y,
      point.z,
    ].join(':'))
    .join('|')
);
