const DEFAULT_PROTECTED_REFERENCE_TERMS = [
  'disney',
  'pixar',
  'mickey mouse',
  'mickey',
  'minnie mouse',
  'harry potter',
  'hogwarts',
  'star wars',
  'darth vader',
  'lightsaber',
  'marvel',
  'avengers',
  'spider-man',
  'spiderman',
  'batman',
  'superman',
  'wonder woman',
  'pokemon',
  'pikachu',
  'mario',
  'luigi',
  'zelda',
  'jurassic park',
  'lord of the rings',
  'game of thrones',
  'stranger things',
  'barbie',
  'lego',
  'minecraft',
  'fortnite',
  'roblox',
  'nike',
  'adidas',
  'coca-cola',
  'coca cola',
  'pepsi',
  'mcdonald',
];

const PROMPT_ABUSE_PATTERNS = [
  /ignore (?:all )?(?:previous|prior|system) instructions/i,
  /ignore les instructions/i,
  /contourne (?:la )?(?:moderation|securite|politique)/i,
  /desactive (?:la )?(?:moderation|securite)/i,
  /bypass (?:safety|moderation|policy)/i,
  /jailbreak/i,
  /do anything now/i,
  /reveal (?:the )?system prompt/i,
  /affiche (?:le )?prompt systeme/i,
];

const splitEnvList = (value = '') => String(value || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

export const normalizeModerationText = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeTerm = (value = '') => normalizeModerationText(value);

const includesTerm = (normalizedText, term) => {
  const normalizedTerm = normalizeTerm(term);
  if (!normalizedTerm) return false;
  return ` ${normalizedText} `.includes(` ${normalizedTerm} `);
};

const moderationInputToText = (input) => {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input.map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry?.type === 'text') return entry.text || '';
      return '';
    }).filter(Boolean).join('\n\n');
  }
  return '';
};

const truncateText = (value = '', maxLength = 20000) => {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const clampModerationInput = (input, maxTextLength) => {
  if (typeof input === 'string') return truncateText(input, maxTextLength);
  if (!Array.isArray(input)) return input;
  return input.map((entry) => {
    if (typeof entry === 'string') return truncateText(entry, maxTextLength);
    if (entry?.type === 'text') return { ...entry, text: truncateText(entry.text, maxTextLength) };
    return entry;
  });
};

export const getAiModerationConfig = (env = {}) => ({
  disabled: String(env.AI_MODERATION_DISABLED || '').toLowerCase() === 'true',
  model: env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
  maxTextLength: Math.max(1000, Number(env.AI_MODERATION_MAX_TEXT_CHARS || 20000)),
  blockProtectedReferences: String(env.AI_MODERATION_BLOCK_PROTECTED_REFERENCES || '').toLowerCase() !== 'false',
  extraBlockedTerms: splitEnvList(env.AI_MODERATION_BLOCK_TERMS),
});

export const scanLocalAiPolicy = (input, config = getAiModerationConfig()) => {
  const text = moderationInputToText(input);
  const normalizedText = normalizeModerationText(text);
  if (!normalizedText) return [];

  const findings = [];
  PROMPT_ABUSE_PATTERNS.forEach((pattern) => {
    if (pattern.test(text) || pattern.test(normalizedText)) {
      findings.push({
        code: 'prompt_abuse',
        label: 'instruction de contournement',
      });
    }
  });

  const protectedTerms = config.blockProtectedReferences ? DEFAULT_PROTECTED_REFERENCE_TERMS : [];
  [...protectedTerms, ...(config.extraBlockedTerms || [])].forEach((term) => {
    if (includesTerm(normalizedText, term)) {
      findings.push({
        code: 'protected_reference',
        label: `reference protegee: ${term}`,
      });
    }
  });

  return findings;
};

export const summarizeModerationResult = (payload = {}) => {
  const results = Array.isArray(payload.results) ? payload.results : [];
  const categories = [...new Set(results.flatMap((result) => (
    Object.entries(result.categories || {})
      .filter(([, flagged]) => Boolean(flagged))
      .map(([category]) => category)
  )))];
  return {
    flagged: results.some((result) => Boolean(result.flagged)) || categories.length > 0,
    categories,
  };
};

const makeAiModerationError = ({ stage = 'input', findings = [], categories = [] } = {}) => {
  const isInput = stage.startsWith('input');
  const details = [
    ...findings.map((finding) => finding.label),
    ...categories,
  ].filter(Boolean);
  const error = new Error(isInput
    ? `Demande IA refusee par la moderation${details.length ? `: ${details.slice(0, 3).join(', ')}` : ''}.`
    : `Contenu IA refuse par la moderation${details.length ? `: ${details.slice(0, 3).join(', ')}` : ''}. Credits rembourses.`
  );
  error.statusCode = isInput ? 400 : 502;
  error.status = error.statusCode;
  error.code = isInput ? 'AI_MODERATION_BLOCKED_INPUT' : 'AI_MODERATION_BLOCKED_OUTPUT';
  error.moderation = {
    findings,
    categories,
    stage,
  };
  return error;
};

export const makeImageModerationInput = (imageUrl, contextText = '') => [
  ...(contextText ? [{ type: 'text', text: contextText }] : []),
  {
    type: 'image_url',
    image_url: { url: imageUrl },
  },
];

export const assertAiContentAllowed = async ({
  input,
  openaiFetch,
  env = {},
  stage = 'input',
} = {}) => {
  const config = getAiModerationConfig(env);
  if (config.disabled) return { ok: true, skipped: true };

  const findings = scanLocalAiPolicy(input, config);
  if (findings.length) throw makeAiModerationError({ stage, findings });

  if (typeof openaiFetch !== 'function') {
    const error = new Error('Moderation IA indisponible.');
    error.statusCode = 500;
    error.status = 500;
    error.code = 'AI_MODERATION_UNAVAILABLE';
    throw error;
  }

  const payload = await openaiFetch('moderations', {
    model: config.model,
    input: clampModerationInput(input, config.maxTextLength),
  });
  const summary = summarizeModerationResult(payload);
  if (summary.flagged) throw makeAiModerationError({ stage, categories: summary.categories });
  return {
    ok: true,
    ...summary,
  };
};
