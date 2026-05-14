export const shouldRunTextGenerationAsync = (body = {}) => (
  body.responseFormat === 'escape-game-project-json'
  && body.mode !== 'repair_item_names'
  && !body.runInline
);
