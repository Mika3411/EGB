const freezeTabs = (tabs) => Object.freeze(tabs);

const freezeModeTabs = (groups) => Object.freeze({
  primary: freezeTabs(groups.primary || []),
  creation: freezeTabs(groups.creation || []),
  assistant: freezeTabs(groups.assistant || []),
  utility: freezeTabs(groups.utility || []),
});

export const CLASSIC_BUILDER_TAB_GROUP_KEYS = freezeTabs(['primary', 'creation', 'assistant', 'utility']);

export const CLASSIC_BUILDER_PROJECT_MODES = freezeTabs([
  'beginner',
  'intermediate',
  'expert',
  'adventure',
  'hero_adventure',
]);

export const CLASSIC_BUILDER_VISIBLE_TABS_BY_MODE = Object.freeze({
  beginner: freezeModeTabs({
    primary: ['scenes', 'media', 'preview'],
    creation: ['objects', 'enigmas'],
    assistant: ['ai'],
    utility: ['shop', 'help'],
  }),
  intermediate: freezeModeTabs({
    primary: ['scenes', 'media', 'map', 'preview'],
    creation: ['objects', 'cinematics', 'enigmas'],
    assistant: ['ai'],
    utility: ['shop', 'help'],
  }),
  expert: freezeModeTabs({
    primary: ['scenes', 'media', 'map', 'preview'],
    creation: ['objects', 'cinematics', 'enigmas', 'combinations', 'logic', 'animation'],
    assistant: ['ai'],
    utility: ['shop', 'help', 'score'],
  }),
  adventure: freezeModeTabs({
    primary: ['scenes', 'media', 'map', 'adventure', 'preview'],
    creation: ['objects', 'cinematics', 'enigmas', 'logic', 'animation'],
    utility: ['shop', 'help', 'score'],
  }),
  hero_adventure: freezeModeTabs({
    primary: ['scenes', 'media', 'map', 'adventure', 'hero', 'combat', 'preview'],
    creation: ['objects', 'cinematics', 'enigmas', 'logic', 'animation'],
    assistant: ['ai'],
    utility: ['shop', 'help', 'score'],
  }),
});

const flattenTabGroups = (groups) => CLASSIC_BUILDER_TAB_GROUP_KEYS.flatMap((groupKey) => groups[groupKey] || []);

export const CLASSIC_BUILDER_TABS = freezeTabs([
  ...new Set(CLASSIC_BUILDER_PROJECT_MODES.flatMap((mode) => (
    flattenTabGroups(CLASSIC_BUILDER_VISIBLE_TABS_BY_MODE[mode])
  ))),
]);

export const getClassicBuilderProjectMode = (mode) => (
  CLASSIC_BUILDER_PROJECT_MODES.includes(mode) ? mode : 'expert'
);

export const getClassicBuilderTabGroupsForMode = (mode) => (
  CLASSIC_BUILDER_VISIBLE_TABS_BY_MODE[getClassicBuilderProjectMode(mode)]
);

export const getClassicBuilderTabValuesForMode = (mode) => (
  flattenTabGroups(getClassicBuilderTabGroupsForMode(mode))
);

export const isClassicBuilderTab = (tab) => CLASSIC_BUILDER_TABS.includes(tab);

export const isClassicBuilderTabVisibleForMode = (tab, mode) => (
  getClassicBuilderTabValuesForMode(mode).includes(tab)
);
