export function sameColorSequence(left = [], right = []) {
  return left.length === right.length && left.every((color, index) => color === right[index]);
}

export function normalizeAnswer(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isFlexibleAnswerMatch(attempt = '', expected = '') {
  const cleanAttempt = normalizeAnswer(attempt);
  const cleanExpected = normalizeAnswer(expected);
  return Boolean(cleanExpected && cleanAttempt.includes(cleanExpected));
}

export function parseJsonValue(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

export function sameNormalizedList(left = [], right = []) {
  return left.length === right.length && left.every((entry, index) => normalizeAnswer(entry) === normalizeAnswer(right[index]));
}

export function sameNormalizedSet(left = [], right = []) {
  const cleanLeft = left.map(normalizeAnswer).sort();
  const cleanRight = right.map(normalizeAnswer).sort();
  return sameNormalizedList(cleanLeft, cleanRight);
}

export const miscAnswerHandlers = {
  'numeric-range': (enigma, attempt) => {
    const value = Number(String(attempt).replace(',', '.'));
    const min = Number(enigma.miscMin);
    const max = Number(enigma.miscMax);
    return Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && value >= min && value <= max;
  },
  'exact-number': (enigma, attempt) => {
    const value = Number(String(attempt).replace(',', '.'));
    const expected = Number(String(enigma.solutionText || '').replace(',', '.'));
    return Number.isFinite(value) && Number.isFinite(expected) && value === expected;
  },
  'accepted-answers': (enigma, attempt) => (enigma.miscChoices || []).some((answer) => isFlexibleAnswerMatch(attempt, answer)),
  'item-select': (enigma, attempt) => attempt === enigma.miscTargetItemId,
  ordering: (enigma, attempt) => sameNormalizedList(parseJsonValue(attempt, []), enigma.miscChoices || []),
  matching: (enigma, attempt) => {
    const answers = parseJsonValue(attempt, {});
    return (enigma.miscPairs || []).every((pair) => normalizeAnswer(answers[pair.left]) === normalizeAnswer(pair.right));
  },
  'multi-select': (enigma, attempt) => sameNormalizedSet(parseJsonValue(attempt, []), enigma.miscCorrectChoices || []),
  default: (enigma, attempt) => isFlexibleAnswerMatch(attempt, enigma.solutionText),
};

export function validateMiscAnswer(enigma, attempt) {
  const mode = enigma.miscMode || 'free-answer';
  return (miscAnswerHandlers[mode] || miscAnswerHandlers.default)(enigma, attempt);
}

export function shuffledIndices(count) {
  const values = Array.from({ length: count }, (_, index) => index);
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  if (values.every((value, index) => value === index) && values.length > 1) {
    [values[0], values[1]] = [values[1], values[0]];
  }
  return values;
}

export function randomRotations(count) {
  return Array.from({ length: count }, () => [0, 90, 180, 270][Math.floor(Math.random() * 4)]);
}

export function usesImage(type) {
  return ['puzzle', 'rotation', 'dragdrop'].includes(type);
}

export function usesColorSequence(type) {
  return type === 'colors';
}

export function usesEditorImageEnigma(type) {
  return type === 'puzzle';
}

const MISC_MODE_VALUES = new Set([
  'free-answer',
  'fill-blank',
  'multiple-choice',
  'true-false',
  'ordering',
  'matching',
  'numeric-range',
  'exact-number',
  'item-select',
  'multi-select',
  'accepted-answers',
]);

export function ensureEnigmaTypeDefaults(enigma, type) {
  if (type === 'code' && !enigma.codeSkin) {
    enigma.codeSkin = 'safe-wheels';
  }
  if (type === 'misc') {
    enigma.miscMode = MISC_MODE_VALUES.has(enigma.miscMode) ? enigma.miscMode : 'free-answer';
    enigma.miscChoices = Array.isArray(enigma.miscChoices) && enigma.miscChoices.length ? enigma.miscChoices : ['Réponse A', 'Réponse B', 'Réponse C'];
    enigma.miscCorrectChoices = Array.isArray(enigma.miscCorrectChoices) ? enigma.miscCorrectChoices : [];
    enigma.miscPairs = Array.isArray(enigma.miscPairs) && enigma.miscPairs.length ? enigma.miscPairs : [
      { left: 'Symbole', right: 'Signification' },
      { left: 'Clé', right: 'Serrure' },
    ];
    enigma.miscTargetItemId = enigma.miscTargetItemId || '';
  }
  if (usesColorSequence(type) && !Array.isArray(enigma.solutionColors)) {
    enigma.solutionColors = ['red', 'blue', 'green'];
  }
  if (type === 'colors' && !enigma.colorLogic) {
    enigma.colorLogic = 'sequence';
  }
  if (!usesColorSequence(type)) {
    enigma.solutionColors = Array.isArray(enigma.solutionColors) ? enigma.solutionColors : [];
  }
  if (usesEditorImageEnigma(type)) {
    enigma.gridRows = Number(enigma.gridRows) || 3;
    enigma.gridCols = Number(enigma.gridCols) || 3;
    enigma.imagePuzzleLogic = enigma.imagePuzzleLogic || 'classic-grid';
    enigma.imageCutStyle = enigma.imageCutStyle || 'straight';
  }
}

export function createEnigmaEditorModel(enigma = {}) {
  const type = enigma?.type || '';
  return {
    solutionPreview: String(enigma?.solutionText || '1990').slice(0, 8).split(''),
    selectedCodeSkin: enigma?.codeSkin || 'safe-wheels',
    colorPreview: (enigma?.solutionColors?.length ? enigma.solutionColors : ['red', 'blue', 'yellow', 'green']).slice(0, 8),
    selectedColorLogic: enigma?.colorLogic || 'sequence',
    selectedImagePuzzleLogic: enigma?.imagePuzzleLogic || 'classic-grid',
    selectedImageCutStyle: enigma?.imageCutStyle || 'straight',
    hasRightPreview: type === 'code' || type === 'colors' || type === 'misc' || usesEditorImageEnigma(type),
    selectedMiscMode: enigma?.miscMode || 'free-answer',
  };
}

const getConfiguredPieceCount = (config = {}, state = {}) => (
  Math.max(4, Number(state.pieceCount) || (Number(config.gridRows) || 3) * (Number(config.gridCols) || 3))
);

const getContextAnswer = (answer = {}, key, fallback = '') => (
  answer && typeof answer === 'object' && !Array.isArray(answer) ? answer[key] : fallback
);

const createStandardHandler = ({
  validate = () => true,
  start = () => ({}),
  checkAnswer = () => false,
  getHint = () => '',
  isComplete = (config, state = {}) => Boolean(state.isComplete),
} = {}) => ({
  validate,
  start,
  checkAnswer,
  getHint,
  isComplete,
});

const defaultAnswerHandler = {
  validate: (config = {}) => Boolean(config),
  start: () => ({}),
  checkAnswer: (config = {}, answer = {}) => (
    normalizeAnswer(getContextAnswer(answer, 'codeInput', answer)) === normalizeAnswer(config.solutionText)
  ),
  getHint: (config = {}) => String(config.question || 'Observe les indices disponibles.'),
  isComplete: (config = {}, state = {}) => (
    Boolean(state.isComplete)
    || normalizeAnswer(state.codeInput) === normalizeAnswer(config.solutionText)
  ),
};

export const enigmaHandlers = {
  code: createStandardHandler(defaultAnswerHandler),
  password: createStandardHandler(defaultAnswerHandler),
  text: createStandardHandler(defaultAnswerHandler),
  colors: createStandardHandler({
    validate: (config = {}) => Array.isArray(config.solutionColors),
    start: () => ({ colorAttempt: [] }),
    checkAnswer: (config = {}, answer = {}) => sameColorSequence(getContextAnswer(answer, 'colorAttempt', []), config.solutionColors || []),
    getHint: (config = {}) => `Reproduis ${Math.max(0, (config.solutionColors || []).length)} couleur(s) dans le bon ordre.`,
    isComplete: (config = {}, state = {}) => sameColorSequence(state.colorAttempt || [], config.solutionColors || []),
  }),
  simon: createStandardHandler({
    validate: (config = {}) => Array.isArray(config.solutionColors),
    start: () => ({ colorAttempt: [], simonPlayerTurn: false }),
    checkAnswer: (config = {}, answer = {}) => sameColorSequence(getContextAnswer(answer, 'colorAttempt', []), config.solutionColors || []),
    getHint: (config = {}) => `Mémorise ${Math.max(0, (config.solutionColors || []).length)} couleur(s), puis rejoue-les.`,
    isComplete: (config = {}, state = {}) => sameColorSequence(state.colorAttempt || [], config.solutionColors || []),
  }),
  misc: createStandardHandler({
    validate: (config = {}) => Boolean(config.miscMode || config.solutionText || config.miscChoices?.length),
    start: () => ({ codeInput: '' }),
    checkAnswer: (config = {}, answer = {}) => validateMiscAnswer(config, getContextAnswer(answer, 'codeInput', answer)),
    getHint: (config = {}) => String(config.question || 'Lis bien la consigne.'),
    isComplete: (config = {}, state = {}) => validateMiscAnswer(config, state.codeInput),
  }),
  puzzle: createStandardHandler({
    validate: (config = {}) => usesImage(config.type),
    start: (config = {}, state = {}) => ({ puzzleOrder: shuffledIndices(getConfiguredPieceCount(config, state)) }),
    checkAnswer: (config = {}, answer = {}) => (
      getContextAnswer(answer, 'puzzleOrder', []).every((pieceIndex, index) => pieceIndex === index)
    ),
    getHint: () => 'Remets chaque pièce à sa place.',
    isComplete: (config = {}, state = {}) => (state.puzzleOrder || []).every((pieceIndex, index) => pieceIndex === index),
  }),
  dragdrop: createStandardHandler({
    validate: (config = {}) => usesImage(config.type),
    start: (config = {}, state = {}) => {
      const pieceCount = getConfiguredPieceCount(config, state);
      return {
      dragBank: shuffledIndices(pieceCount),
      dragSlots: Array.from({ length: pieceCount }, () => null),
      };
    },
    checkAnswer: (config = {}, answer = {}) => (
      getContextAnswer(answer, 'dragSlots', []).every((pieceIndex, index) => pieceIndex === index)
    ),
    getHint: () => 'Dépose chaque pièce dans la bonne case.',
    isComplete: (config = {}, state = {}) => (state.dragSlots || []).every((pieceIndex, index) => pieceIndex === index),
  }),
  rotation: createStandardHandler({
    validate: (config = {}) => usesImage(config.type),
    start: (config = {}, state = {}) => ({ rotationAngles: randomRotations(getConfiguredPieceCount(config, state)) }),
    checkAnswer: (config = {}, answer = {}) => (
      getContextAnswer(answer, 'rotationAngles', []).every((angle) => Number(angle || 0) % 360 === 0)
    ),
    getHint: () => 'Oriente toutes les pièces dans le bon sens.',
    isComplete: (config = {}, state = {}) => (state.rotationAngles || []).every((angle) => Number(angle || 0) % 360 === 0),
  }),
  default: createStandardHandler(defaultAnswerHandler),
};

export function getEnigmaHandler(type) {
  return enigmaHandlers[type] || enigmaHandlers.default;
}

export function createEnigmaRuntime(config = {}) {
  const handler = getEnigmaHandler(config.type);
  return {
    validate: () => handler.validate(config),
    start: (state = {}) => handler.start(config, state),
    checkAnswer: (answer = {}, state = {}) => handler.checkAnswer(config, answer, state),
    getHint: (state = {}) => handler.getHint(config, state),
    isComplete: (state = {}) => handler.isComplete(config, state),
  };
}

export function getEnigmaInitialState(enigma, pieceCount) {
  return createEnigmaRuntime(enigma).start({ pieceCount });
}

export function validateEnigmaAnswer(enigma, context = {}) {
  return createEnigmaRuntime(enigma).checkAnswer(context, context);
}
