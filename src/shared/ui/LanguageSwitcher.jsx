import { Globe2 } from 'lucide-react';
import { useI18n } from '../i18n';

export default function LanguageSwitcher({
  className = '',
  compact = false,
  onLanguageChange,
}) {
  const {
    language,
    setLanguage,
    supportedLanguages,
    t,
  } = useI18n();

  const handleChange = (event) => {
    const nextLanguage = setLanguage(event.target.value);
    onLanguageChange?.(nextLanguage);
  };

  const classNames = [
    'language-switcher',
    compact ? 'language-switcher--compact' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label className={classNames}>
      <Globe2 size={16} aria-hidden="true" focusable="false" />
      <span className="language-switcher-label">{t('language.label')}</span>
      <select
        aria-label={t('language.ariaLabel')}
        value={language}
        onChange={handleChange}
      >
        {supportedLanguages.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {compact ? entry.shortLabel : entry.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
