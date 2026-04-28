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

export function validateMiscAnswer(enigma, attempt) {
  const mode = enigma.miscMode || 'free-answer';
  if (mode === 'numeric-range') {
    const value = Number(String(attempt).replace(',', '.'));
    const min = Number(enigma.miscMin);
    const max = Number(enigma.miscMax);
    return Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && value >= min && value <= max;
  }
  if (mode === 'exact-number') {
    const value = Number(String(attempt).replace(',', '.'));
    const expected = Number(String(enigma.solutionText || '').replace(',', '.'));
    return Number.isFinite(value) && Number.isFinite(expected) && value === expected;
  }
  if (mode === 'accepted-answers') return (enigma.miscChoices || []).some((answer) => isFlexibleAnswerMatch(attempt, answer));
  if (mode === 'item-select') return attempt === enigma.miscTargetItemId;
  if (mode === 'ordering') return sameNormalizedList(parseJsonValue(attempt, []), enigma.miscChoices || []);
  if (mode === 'matching') {
    const answers = parseJsonValue(attempt, {});
    return (enigma.miscPairs || []).every((pair) => normalizeAnswer(answers[pair.left]) === normalizeAnswer(pair.right));
  }
  if (mode === 'multi-select') return sameNormalizedSet(parseJsonValue(attempt, []), enigma.miscCorrectChoices || []);
  return isFlexibleAnswerMatch(attempt, enigma.solutionText);
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
