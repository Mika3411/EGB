export function getCombinationItem1(combination) {
  return combination?.item1 ?? combination?.itemAId ?? '';
}

export function getCombinationItem2(combination) {
  return combination?.item2 ?? combination?.itemBId ?? '';
}

export function getCombinationResult(combination) {
  return combination?.result ?? combination?.resultItemId ?? '';
}

function hasConditionToken(collection, condition) {
  if (!collection) return false;
  if (Array.isArray(collection)) return collection.includes(condition);
  return Boolean(collection[condition]);
}

function isConditionMet(condition, context) {
  if (!condition) return true;
  if (typeof condition === 'function') return Boolean(condition(context));
  if (hasConditionToken(context.conditions, condition)) return true;
  if (hasConditionToken(context.flags, condition)) return true;
  if (hasConditionToken(context.state, condition)) return true;
  if (context.inventory?.includes(condition)) return true;
  if (condition.startsWith('has_')) return context.inventory?.includes(condition.slice(4));
  if (condition.startsWith('solved_')) return context.solvedEnigmaIds?.includes(condition.slice(7));
  if (condition.startsWith('completed_hotspot_')) return context.completedHotspotIds?.includes(condition.slice(18));
  if (condition.startsWith('completed_combination_')) return context.completedCombinationIds?.includes(condition.slice(22));
  if (condition.startsWith('launched_cinematic_')) return context.launchedCinematicIds?.includes(condition.slice(19));
  return false;
}

export function combineItems(itemA, itemB, combinations, context = {}) {
  const match = (combinations || []).find((combination) => {
    const item1 = getCombinationItem1(combination);
    const item2 = getCombinationItem2(combination);
    return (
      (item1 === itemA && item2 === itemB)
      || (item1 === itemB && item2 === itemA)
    );
  });
  if (!match) return null;

  const conditions = Array.isArray(match.conditions) ? match.conditions : [];
  const unmetConditions = conditions.filter((condition) => !isConditionMet(condition, context));
  return {
    ...match,
    item1: getCombinationItem1(match),
    item2: getCombinationItem2(match),
    result: getCombinationResult(match),
    blocked: unmetConditions.length > 0,
    unmetConditions,
  };
}
