import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  profileType: '',
  organization: '',
  country: '',
  language: 'fr',
  acceptedTerms: false,
  marketingConsent: false,
};

const profileTypes = [
  ['teacher', 'Enseignant'],
  ['facilitator', 'Animateur / médiateur'],
  ['creator', 'Créateur'],
  ['player', 'Joueur'],
  ['other', 'Autre'],
];

export default function AuthPanel({
  onLogin,
  onRegister,
  onRequestPasswordReset,
  onUpdatePassword,
  onBack,
  initialMode = 'login',
  isPasswordRecovery = false,
  isBusy,
  errorMessage,
}) {
  const [mode, setMode] = useState(isPasswordRecovery ? 'reset' : initialMode);
  const [form, setForm] = useState(emptyForm);
  const [localError, setLocalError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('reset');
      setNotice('Choisis un nouveau mot de passe pour finaliser la réinitialisation.');
      return;
    }
    setMode(initialMode);
  }, [initialMode, isPasswordRecovery]);

  const clearMessages = () => {
    setLocalError('');
    setNotice('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setForm(emptyForm);
    setShowPassword(false);
    setShowConfirmPassword(false);
    clearMessages();
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearMessages();
  };

  const validatePassword = () => {
    if (form.password.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    if (mode === 'forgot') {
      if (!form.email.trim()) {
        setLocalError('L’email est obligatoire.');
        return;
      }

      try {
        await onRequestPasswordReset({ email: form.email });
        setNotice('Un lien unique de réinitialisation vient d’être envoyé. Ouvre ta boîte email pour choisir un nouveau mot de passe.');
      } catch {
        // handled upstream
      }
      return;
    }

    if (mode === 'reset') {
      if (!validatePassword()) return;
      if (form.password !== form.confirmPassword) {
        setLocalError('Les deux mots de passe ne correspondent pas.');
        return;
      }

      try {
        await onUpdatePassword({ password: form.password });
        setNotice('Mot de passe mis à jour. Tu es connecté.');
        setForm(emptyForm);
      } catch {
        // handled upstream
      }
      return;
    }

    if (mode === 'register') {
      if (!form.name.trim()) {
        setLocalError('Le nom est obligatoire.');
        return;
      }
      if (!form.profileType) {
        setLocalError('Choisis un type de profil.');
        return;
      }
      if (!form.acceptedTerms) {
        setLocalError('Tu dois accepter les conditions pour créer un compte.');
        return;
      }
    }
    if (!form.email.trim()) {
      setLocalError('L’email est obligatoire.');
      return;
    }
    if (!validatePassword()) return;
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setLocalError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      if (mode === 'login') {
        await onLogin({ email: form.email, password: form.password });
      } else {
        const result = await onRegister(form);
        if (result?.needsEmailConfirmation) {
          setNotice('Un lien unique de confirmation vient d’être envoyé. Ouvre ta boîte email, puis clique sur ce lien avant de te connecter.');
          setMode('login');
        }
      }
      setForm(emptyForm);
    } catch {
      // handled upstream
    }
  };

  const title = mode === 'forgot'
    ? 'Mot de passe oublié'
    : mode === 'reset'
      ? 'Nouveau mot de passe'
      : mode === 'register'
        ? 'Créer un compte'
        : 'Connexion au builder';

  return (
    <div className="auth-shell">
      <div className="auth-card panel">
        {onBack && !isPasswordRecovery ? (
          <button type="button" className="auth-back-button secondary-action" onClick={onBack}>
            Retour accueil
          </button>
        ) : null}
        <div className="auth-hero">
          <span className="auth-badge">Sauvegarde par compte</span>
          <h2>{title}</h2>
          <p>
            Crée un compte Supabase, connecte-toi, puis tes projets sont synchronisés
            automatiquement pour reprendre là où tu t’es arrêté.
          </p>
        </div>

        {mode !== 'forgot' && mode !== 'reset' ? (
          <div className="auth-switcher">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Connexion</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Inscription</button>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div>
                <label>Nom ou pseudo</label>
                <input value={form.name} onChange={(event) => handleChange('name', event.target.value)} placeholder="Ex. Marion" />
              </div>

              <div>
                <label>Type de profil</label>
                <select value={form.profileType} onChange={(event) => handleChange('profileType', event.target.value)}>
                  <option value="">Choisir...</option>
                  {profileTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>

              <div>
                <label>Organisation</label>
                <input value={form.organization} onChange={(event) => handleChange('organization', event.target.value)} placeholder="École, association, entreprise..." />
              </div>

              <div className="grid-two small-gap">
                <div>
                  <label>Pays</label>
                  <input value={form.country} onChange={(event) => handleChange('country', event.target.value)} placeholder="France" />
                </div>
                <div>
                  <label>Langue</label>
                  <select value={form.language} onChange={(event) => handleChange('language', event.target.value)}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {mode !== 'reset' ? (
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="marion@email.com" />
            </div>
          ) : null}

          {mode !== 'forgot' ? (
            <div>
              <label>{mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}</label>
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => handleChange('password', event.target.value)} placeholder="Minimum 6 caractères" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} title={showPassword ? 'Masquer' : 'Afficher'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ) : null}

          {mode === 'register' || mode === 'reset' ? (
            <div>
              <label>Confirmer le mot de passe</label>
              <div className="password-field">
                <input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => handleChange('confirmPassword', event.target.value)} placeholder="Répète le mot de passe" />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'} title={showConfirmPassword ? 'Masquer' : 'Afficher'}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ) : null}

          {mode === 'register' ? (
            <div className="auth-consents">
              <label>
                <input type="checkbox" checked={form.acceptedTerms} onChange={(event) => handleChange('acceptedTerms', event.target.checked)} />
                <span>J’accepte les conditions d’utilisation.</span>
              </label>
              <label>
                <input type="checkbox" checked={form.marketingConsent} onChange={(event) => handleChange('marketingConsent', event.target.checked)} />
                <span>Je veux recevoir les nouveautés et conseils par email.</span>
              </label>
            </div>
          ) : null}

          {notice ? <p className="small-note">{notice}</p> : null}
          {(localError || errorMessage) ? <p className="auth-error">{localError || errorMessage}</p> : null}

          <button type="submit" disabled={isBusy}>
            {isBusy
              ? 'Patiente…'
              : mode === 'forgot'
                ? 'Envoyer le lien'
                : mode === 'reset'
                  ? 'Changer le mot de passe'
                  : mode === 'login'
                    ? 'Se connecter'
                    : 'Créer le compte'}
          </button>

          {mode === 'login' ? (
            <button type="button" className="auth-link-button" onClick={() => switchMode('forgot')}>Mot de passe oublié</button>
          ) : null}
          {mode === 'forgot' ? (
            <button type="button" className="auth-link-button" onClick={() => switchMode('login')}>Retour à la connexion</button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
