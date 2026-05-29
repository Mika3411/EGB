import { validateProject } from './projectValidation';
import {
  PROJECT_SAFETY_LIMITS,
  normalizeParsedProjectKeys,
} from './projectSafetyValidation';

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

const countUtf8Bytes = (value = '') => {
  const text = String(value || '');
  return textEncoder ? textEncoder.encode(text).length : text.length * 2;
};

const createProjectImportError = (message, code, validation = null) => {
  const error = new Error(message);
  error.name = 'ProjectImportError';
  error.code = code;
  error.validation = validation;
  return error;
};

const looksLikeProjectPayload = (value) => (
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && (
    Array.isArray(value.scenes)
    || Array.isArray(value['sc\u00e8nes'])
    || Array.isArray(value.acts)
    || typeof value.title === 'string'
    || (value.start && typeof value.start === 'object')
  )
);

const unwrapProjectPayload = (payload) => {
  if (looksLikeProjectPayload(payload?.project)) return payload.project;
  if (looksLikeProjectPayload(payload?.data?.project)) return payload.data.project;
  if (looksLikeProjectPayload(payload?.data)) return payload.data;
  return payload;
};

export const formatProjectImportError = (error) => (
  error?.message || 'Import impossible : le fichier projet est invalide.'
);

export const parseImportedProjectJson = (text, {
  maxJsonBytes = PROJECT_SAFETY_LIMITS.projectMaxJsonBytes,
} = {}) => {
  const raw = String(text || '').trim();
  if (!raw) {
    throw createProjectImportError('Import impossible : le fichier JSON est vide.', 'PROJECT_IMPORT_EMPTY');
  }

  const byteLength = countUtf8Bytes(raw);
  if (byteLength > maxJsonBytes) {
    throw createProjectImportError(
      `Import impossible : fichier trop volumineux (${Math.round(byteLength / 1024 / 1024)} Mo, limite ${Math.round(maxJsonBytes / 1024 / 1024)} Mo).`,
      'PROJECT_IMPORT_TOO_LARGE',
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw createProjectImportError(
      'Import impossible : JSON illisible. Vérifie que le fichier n’est pas tronqué ou modifié à la main.',
      'PROJECT_IMPORT_INVALID_JSON',
    );
  }
};

export const validateImportedProjectPayload = (payload) => {
  const projectPayload = normalizeParsedProjectKeys(unwrapProjectPayload(payload));
  const validation = validateProject(projectPayload);
  if (!validation.ok) {
    const details = validation.errors.slice(0, 3).join(' ');
    throw createProjectImportError(
      `Import refusé : ${details || 'structure de projet invalide.'}`,
      'PROJECT_IMPORT_VALIDATION_FAILED',
      validation,
    );
  }
  return {
    project: validation.project,
    warnings: validation.warnings,
  };
};

export const importProjectFromJsonText = (text, options = {}) => (
  validateImportedProjectPayload(parseImportedProjectJson(text, options))
);
