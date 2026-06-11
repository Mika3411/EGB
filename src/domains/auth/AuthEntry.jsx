import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ACCOUNT_PROFILE_TYPE_ESCAPE_ROOM,
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_TYPE_PERSONAL,
  ACCOUNT_TYPE_PRO,
} from '../../shared/services/accountPlans';
import { SUPPORTED_LANGUAGES, useI18n } from '../../shared/i18n';
import LanguageSwitcher from '../../shared/ui/LanguageSwitcher';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  accountType: ACCOUNT_TYPE_PERSONAL,
  profileType: '',
  organization: '',
  country: '',
  language: 'fr',
  acceptedTerms: false,
  marketingConsent: false,
};

const ACCOUNT_PROFILE_TYPE_PLAYER = 'player';
const AUTH_CONTEXTS = {
  'save-project': {
    badge: 'auth.contexts.saveProject.badge',
    intro: 'auth.contexts.saveProject.intro',
    titleLogin: 'auth.contexts.saveProject.titleLogin',
    titleRegister: 'auth.contexts.saveProject.titleRegister',
    loginSubmit: 'auth.contexts.saveProject.loginSubmit',
    registerSubmit: 'auth.contexts.saveProject.registerSubmit',
  },
  'publish-project': {
    badge: 'auth.contexts.publishProject.badge',
    intro: 'auth.contexts.publishProject.intro',
    titleLogin: 'auth.contexts.publishProject.titleLogin',
    titleRegister: 'auth.contexts.publishProject.titleRegister',
    loginSubmit: 'auth.contexts.publishProject.loginSubmit',
    registerSubmit: 'auth.contexts.publishProject.registerSubmit',
  },
};

const proProfileTypes = [
  [ACCOUNT_PROFILE_TYPE_ESCAPE_ROOM, 'Gérant d’escape game / Salle d’escape'],
  ['teacher', 'Enseignant'],
  ['facilitator', 'Animateur / médiateur'],
  ['creator', 'Créateur'],
  ['other', 'Autre'],
];

const personalProfileTypes = [
  [ACCOUNT_PROFILE_TYPE_PLAYER, 'Joueur'],
  ['creator', 'Créateur'],
  ['other', 'Autre'],
];

const getProfileTypesForAccount = (accountType) => (
  accountType === ACCOUNT_TYPE_PRO ? proProfileTypes : personalProfileTypes
);

const getDefaultProfileTypeForAccount = (accountType) => (
  accountType === ACCOUNT_TYPE_PRO ? ACCOUNT_PROFILE_TYPE_ESCAPE_ROOM : ACCOUNT_PROFILE_TYPE_PLAYER
);

const resolveProfileTypeForAccount = (accountType, profileType) => {
  const allowedValues = getProfileTypesForAccount(accountType).map(([value]) => value);
  return allowedValues.includes(profileType)
    ? profileType
    : getDefaultProfileTypeForAccount(accountType);
};

const getOptionLabel = (options, value) => (
  options.find(([optionValue]) => optionValue === value)?.[1] || ''
);

const createInitialForm = (initialForm = {}) => {
  const {
    authIntent: _authIntent,
    ...formDefaults
  } = initialForm || {};
  const accountType = formDefaults.accountType || emptyForm.accountType;
  return {
    ...emptyForm,
    ...formDefaults,
    accountType,
    profileType: resolveProfileTypeForAccount(accountType, formDefaults.profileType),
  };
};

export default function AuthEntry({
  onLogin,
  onRegister,
  onRequestPasswordReset,
  onUpdatePassword,
  onBack,
  initialMode = 'login',
  isPasswordRecovery = false,
  isBusy,
  errorMessage,
  initialForm,
  onLanguageChange,
}) {
  const { language, setLanguage, t } = useI18n();
  const createLocalizedInitialForm = (source = initialForm) => createInitialForm({
    ...(source || {}),
    language: source?.language || language,
  });
  const authContext = AUTH_CONTEXTS[initialForm?.authIntent] || null;
  const shouldStartProfileDetailsOpen = Boolean(
    initialForm?.accountType === ACCOUNT_TYPE_PRO
    || initialForm?.profileType
    || initialForm?.organization
    || initialForm?.country,
  );
  const [mode, setMode] = useState(isPasswordRecovery ? 'reset' : initialMode);
  const [form, setForm] = useState(() => createLocalizedInitialForm(initialForm));
  const [localError, setLocalError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProfileDetailsOpen, setIsProfileDetailsOpen] = useState(shouldStartProfileDetailsOpen);

  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('reset');
      setNotice(t('auth.noticeReset'));
      return;
    }
    setMode(initialMode);
    if (initialMode === 'register') {
      setForm(createLocalizedInitialForm(initialForm));
      setIsProfileDetailsOpen(shouldStartProfileDetailsOpen);
    }
  }, [initialForm, initialMode, isPasswordRecovery, language, shouldStartProfileDetailsOpen, t]);

  useEffect(() => {
    setForm((currentForm) => ({ ...currentForm, language }));
  }, [language]);

  const clearMessages = () => {
    setLocalError('');
    setNotice('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setForm(nextMode === 'register' ? createLocalizedInitialForm(initialForm) : { ...emptyForm, language });
    setIsProfileDetailsOpen(nextMode === 'register' ? shouldStartProfileDetailsOpen : false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    clearMessages();
  };

  const handleChange = (field, value) => {
    if (field === 'language') {
      const nextLanguage = setLanguage(value);
      onLanguageChange?.(nextLanguage);
    }
    setForm((prev) => {
      if (field === 'accountType') {
        return {
          ...prev,
          accountType: value,
          profileType: resolveProfileTypeForAccount(value, prev.profileType),
        };
      }
      return { ...prev, [field]: value };
    });
    clearMessages();
  };

  const validatePassword = () => {
    if (form.password.length < 6) {
      setLocalError(t('auth.errorPasswordLength'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    if (mode === 'forgot') {
      if (!form.email.trim()) {
        setLocalError(t('auth.errorEmailRequired'));
        return;
      }

      try {
        await onRequestPasswordReset({ email: form.email });
        setNotice(t('auth.noticeResetSent'));
      } catch {
        // handled upstream
      }
      return;
    }

    if (mode === 'reset') {
      if (!validatePassword()) return;
      if (form.password !== form.confirmPassword) {
        setLocalError(t('auth.errorPasswordMismatch'));
        return;
      }

      try {
        await onUpdatePassword({ password: form.password });
        setNotice(t('auth.noticePasswordUpdated'));
        setForm({ ...emptyForm, language });
      } catch {
        // handled upstream
      }
      return;
    }

    if (mode === 'register') {
      if (!form.name.trim()) {
        setLocalError(t('auth.errorNameRequired'));
        return;
      }
      if (!form.accountType) {
        setLocalError(t('auth.errorAccountTypeRequired'));
        return;
      }
      if (!form.profileType) {
        setLocalError(t('auth.errorProfileTypeRequired'));
        return;
      }
      if (!form.acceptedTerms) {
        setLocalError(t('auth.errorTermsRequired'));
        return;
      }
    }
    if (!form.email.trim()) {
      setLocalError(t('auth.errorEmailRequired'));
      return;
    }
    if (!validatePassword()) return;
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setLocalError(t('auth.errorPasswordMismatch'));
      return;
    }

    try {
      if (mode === 'login') {
        await onLogin({ email: form.email, password: form.password });
      } else {
        const result = await onRegister(form);
        if (result?.needsEmailConfirmation) {
          setNotice(t('auth.noticeConfirmEmail'));
          setMode('login');
        }
      }
      setForm({ ...emptyForm, language });
    } catch {
      // handled upstream
    }
  };

  const title = mode === 'forgot'
    ? t('auth.titleForgot')
    : mode === 'reset'
      ? t('auth.titleReset')
      : mode === 'register'
        ? t(authContext?.titleRegister || 'auth.titleRegister')
        : t(authContext?.titleLogin || 'auth.titleLogin');
  const badgeLabel = t(authContext?.badge || 'auth.badge');
  const introText = t(authContext?.intro || 'auth.intro');
  const loginSubmitLabel = t(authContext?.loginSubmit || 'auth.loginSubmit');
  const registerSubmitLabel = t(authContext?.registerSubmit || 'auth.registerSubmit');
  const visibleProfileTypes = getProfileTypesForAccount(form.accountType)
    .map(([value, label]) => [value, t(`auth.profileTypes.${value}`, {}, label)]);
  const accountTypeOptions = ACCOUNT_TYPE_OPTIONS
    .map(([value, label]) => [value, t(`auth.accountTypes.${value}`, {}, label)]);
  const accountTypeLabel = getOptionLabel(accountTypeOptions, form.accountType) || t('auth.fallbackPersonal');
  const profileTypeLabel = getOptionLabel(visibleProfileTypes, form.profileType) || t('auth.fallbackProfile');

  return (
    <div className="auth-shell">
      <div className="auth-card panel">
        {onBack && !isPasswordRecovery ? (
          <button type="button" className="auth-back-button secondary-action" onClick={onBack}>
            {t('auth.back')}
          </button>
        ) : null}
        <LanguageSwitcher className="auth-language-switcher" onLanguageChange={onLanguageChange} />
        <div className="auth-hero">
          <span className="auth-badge">{badgeLabel}</span>
          <h2>{title}</h2>
          <p>{introText}</p>
        </div>

        {mode !== 'forgot' && mode !== 'reset' ? (
          <div className="auth-switcher">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>{t('auth.loginTab')}</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>{t('auth.registerTab')}</button>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div>
                <label>{t('auth.name')}</label>
                <input value={form.name} onChange={(event) => handleChange('name', event.target.value)} placeholder={t('auth.namePlaceholder')} />
              </div>

              <details
                className="auth-profile-details"
                open={isProfileDetailsOpen}
                onToggle={(event) => setIsProfileDetailsOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>
                    <strong>{t('auth.profileSummary')}</strong>
                    <small>{accountTypeLabel} · {profileTypeLabel}</small>
                  </span>
                </summary>

                <div className="auth-profile-fields">
                  <div>
                    <label>{t('auth.accountType')}</label>
                    <div className="auth-account-type" role="radiogroup" aria-label={t('auth.accountType')}>
                      {accountTypeOptions.map(([value, label]) => (
                        <label key={value} className={form.accountType === value ? 'selected' : ''}>
                          <input
                            type="radio"
                            name="accountType"
                            value={value}
                            checked={form.accountType === value}
                            onChange={(event) => handleChange('accountType', event.target.value)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label>{t('auth.profileType')}</label>
                    <select value={form.profileType} onChange={(event) => handleChange('profileType', event.target.value)}>
                      <option value="">{t('auth.choose')}</option>
                      {visibleProfileTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label>{t('auth.organization')}</label>
                    <input value={form.organization} onChange={(event) => handleChange('organization', event.target.value)} placeholder={t('auth.organizationPlaceholder')} />
                  </div>

                  <div className="grid-two small-gap">
                    <div>
                      <label>{t('auth.country')}</label>
                      <input value={form.country} onChange={(event) => handleChange('country', event.target.value)} placeholder={t('auth.countryPlaceholder')} />
                    </div>
                    <div>
                      <label>{t('auth.language')}</label>
                      <select value={form.language} onChange={(event) => handleChange('language', event.target.value)}>
                        {SUPPORTED_LANGUAGES.map((entry) => (
                          <option key={entry.code} value={entry.code}>{entry.nativeName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </details>
            </>
          )}

          {mode !== 'reset' ? (
            <div>
              <label>{t('auth.email')}</label>
              <input type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder={t('auth.emailPlaceholder')} />
            </div>
          ) : null}

          {mode !== 'forgot' ? (
            <div>
              <label>{mode === 'reset' ? t('auth.newPassword') : t('auth.password')}</label>
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => handleChange('password', event.target.value)} placeholder={t('auth.passwordPlaceholder')} />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ) : null}

          {mode === 'register' || mode === 'reset' ? (
            <div>
              <label>{t('auth.confirmPassword')}</label>
              <div className="password-field">
                <input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => handleChange('confirmPassword', event.target.value)} placeholder={t('auth.confirmPasswordPlaceholder')} />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? t('auth.hideConfirm') : t('auth.showConfirm')} title={showConfirmPassword ? t('auth.hideConfirm') : t('auth.showConfirm')}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ) : null}

          {mode === 'register' ? (
            <div className="auth-consents">
              <label>
                <input type="checkbox" checked={form.acceptedTerms} onChange={(event) => handleChange('acceptedTerms', event.target.checked)} />
                <span>
                  {t('auth.acceptTermsPrefix')} <a href="/conditions-utilisation.html" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{t('auth.terms')}</a>
                  {' '}{t('auth.acceptTermsJoin')} <a href="/politique-confidentialite.html" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{t('auth.privacy')}</a>.
                </span>
              </label>
              <label>
                <input type="checkbox" checked={form.marketingConsent} onChange={(event) => handleChange('marketingConsent', event.target.checked)} />
                <span>{t('auth.marketingConsent')}</span>
              </label>
            </div>
          ) : null}

          {notice ? <p className="small-note">{notice}</p> : null}
          {(localError || errorMessage) ? <p className="auth-error">{localError || errorMessage}</p> : null}

          <button type="submit" disabled={isBusy}>
            {isBusy
              ? t('auth.busy')
              : mode === 'forgot'
                ? t('auth.sendLink')
                : mode === 'reset'
                  ? t('auth.changePassword')
                  : mode === 'login'
                    ? loginSubmitLabel
                    : registerSubmitLabel}
          </button>

          {mode === 'login' ? (
            <button type="button" className="auth-link-button" onClick={() => switchMode('forgot')}>{t('auth.forgotPassword')}</button>
          ) : null}
          {mode === 'forgot' ? (
            <button type="button" className="auth-link-button" onClick={() => switchMode('login')}>{t('auth.backToLogin')}</button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
