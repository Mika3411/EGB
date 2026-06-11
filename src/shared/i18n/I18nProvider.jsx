import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { canUseLocalStorage } from '../utils/storageHelpers';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
} from './translations';
import { useDeepPanelDomTranslations } from './deepPanelAutoTranslations';

const supportedLanguageCodes = new Set(SUPPORTED_LANGUAGES.map((language) => language.code));

export const normalizeLanguage = (value = '') => {
  const directValue = String(value || '').trim().toLowerCase();
  if (supportedLanguageCodes.has(directValue)) return directValue;
  const baseValue = directValue.split(/[-_]/)[0];
  return supportedLanguageCodes.has(baseValue) ? baseValue : DEFAULT_LANGUAGE;
};

export const hasStoredLanguagePreference = () => {
  if (!canUseLocalStorage()) return false;
  return Boolean(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
};

export const readPreferredLanguage = () => {
  if (canUseLocalStorage()) {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage) return normalizeLanguage(storedLanguage);
  }

  if (typeof navigator !== 'undefined') {
    const browserLanguage = navigator.languages?.[0] || navigator.language || '';
    if (browserLanguage) return normalizeLanguage(browserLanguage);
  }

  return DEFAULT_LANGUAGE;
};

export const writePreferredLanguage = (language) => {
  if (!canUseLocalStorage()) return false;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
    return true;
  } catch {
    return false;
  }
};

export const getLanguageDefinition = (language) => (
  SUPPORTED_LANGUAGES.find((entry) => entry.code === normalizeLanguage(language))
  || SUPPORTED_LANGUAGES.find((entry) => entry.code === DEFAULT_LANGUAGE)
);

const getNestedValue = (source, path) => String(path || '')
  .split('.')
  .filter(Boolean)
  .reduce((current, key) => (
    current && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined
  ), source);

const interpolate = (value, params = {}) => {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(params || {}, key) ? String(params[key]) : ''
  ));
};

const I18nContext = createContext({
  language: DEFAULT_LANGUAGE,
  languageDefinition: getLanguageDefinition(DEFAULT_LANGUAGE),
  setLanguage: () => DEFAULT_LANGUAGE,
  t: (key, params, fallback) => fallback || key,
  tObject: () => undefined,
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(readPreferredLanguage);
  useDeepPanelDomTranslations(language);

  const setLanguage = useCallback((nextLanguage) => {
    const normalizedLanguage = normalizeLanguage(nextLanguage);
    writePreferredLanguage(normalizedLanguage);
    setLanguageState(normalizedLanguage);
    return normalizedLanguage;
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const languageDefinition = getLanguageDefinition(language);
    document.documentElement.lang = languageDefinition?.locale || language;
  }, [language]);

  const tObject = useCallback((key, fallback = undefined) => {
    const translatedValue = getNestedValue(TRANSLATIONS[language], key);
    if (translatedValue !== undefined) return translatedValue;
    const defaultValue = getNestedValue(TRANSLATIONS[DEFAULT_LANGUAGE], key);
    return defaultValue !== undefined ? defaultValue : fallback;
  }, [language]);

  const t = useCallback((key, params = {}, fallback = '') => {
    const translatedValue = tObject(key);
    if (typeof translatedValue === 'string') return interpolate(translatedValue, params);
    if (typeof fallback === 'string' && fallback) return interpolate(fallback, params);
    return key;
  }, [tObject]);

  const value = useMemo(() => ({
    language,
    languageDefinition: getLanguageDefinition(language),
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    t,
    tObject,
  }), [language, setLanguage, t, tObject]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
