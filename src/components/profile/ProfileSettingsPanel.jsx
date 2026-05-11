import { Eye, EyeOff, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ProfileSettingsPanel({
  user,
  authorProfile,
  isBusy = false,
  onUpdateAuthorProfile,
  onUpdatePassword,
}) {
  const [profileDraft, setProfileDraft] = useState(() => ({
    displayName: authorProfile?.displayName || user?.name || user?.email || '',
    tagline: authorProfile?.tagline || '',
    bio: authorProfile?.bio || '',
    website: authorProfile?.website || '',
  }));
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', password: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setProfileDraft({
      displayName: authorProfile?.displayName || user?.name || user?.email || '',
      tagline: authorProfile?.tagline || '',
      bio: authorProfile?.bio || '',
      website: authorProfile?.website || '',
    });
  }, [authorProfile, user]);

  const updateProfileField = (field, value) => {
    setProfileDraft((draft) => ({ ...draft, [field]: value }));
    setProfileNotice('');
  };

  const updatePasswordField = (field, value) => {
    setPasswordDraft((draft) => ({ ...draft, [field]: value }));
    setPasswordError('');
    setPasswordNotice('');
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    await onUpdateAuthorProfile?.(profileDraft);
    setProfileNotice('Informations du profil mises a jour.');
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!passwordDraft.currentPassword) {
      setPasswordError('Confirme avec ton mot de passe actuel.');
      return;
    }
    if (passwordDraft.password.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (passwordDraft.password !== passwordDraft.confirmPassword) {
      setPasswordError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      await onUpdatePassword?.({
        currentPassword: passwordDraft.currentPassword,
        password: passwordDraft.password,
      });
      setPasswordDraft({ currentPassword: '', password: '', confirmPassword: '' });
      setPasswordNotice('Mot de passe mis a jour.');
    } catch (error) {
      setPasswordError(error?.message || 'Mise a jour du mot de passe impossible.');
    }
  };

  return (
    <section className="panel profile-settings-panel" data-tour="profile-settings-section">
      <div className="panel-head panel-head-stack">
        <div>
          <span className="eyebrow">Compte</span>
          <h2>Profil et securite</h2>
          <p className="small-note">Modifie tes informations publiques et ton acces au compte.</p>
        </div>
      </div>

      <div className="profile-settings-grid">
        <form className="profile-settings-form" onSubmit={saveProfile}>
          <h3>Informations du profil</h3>
          <label>Nom affiche</label>
          <input
            value={profileDraft.displayName}
            onChange={(event) => updateProfileField('displayName', event.target.value)}
            placeholder={user?.name || 'Nom public'}
          />
          <label>Phrase courte</label>
          <input
            value={profileDraft.tagline}
            onChange={(event) => updateProfileField('tagline', event.target.value)}
            placeholder="Escape games narratifs et énigmes maison"
          />
          <label>Bio</label>
          <textarea
            value={profileDraft.bio}
            onChange={(event) => updateProfileField('bio', event.target.value)}
            maxLength={600}
            placeholder="Présente ton style, tes thèmes, ton rythme de création..."
          />
          <label>Site ou reseau</label>
          <input
            value={profileDraft.website}
            onChange={(event) => updateProfileField('website', event.target.value)}
            placeholder="https://..."
          />
          {profileNotice ? <p className="small-note">{profileNotice}</p> : null}
          <button type="submit" className="profile-action-button" disabled={isBusy}>
            <Save size={16} />
            Enregistrer le profil
          </button>
        </form>

        <form className="profile-settings-form" onSubmit={savePassword}>
          <h3>Mot de passe</h3>
          <label>Email du compte</label>
          <input value={user?.email || ''} readOnly />
          <label>Mot de passe actuel</label>
          <div className="password-field">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={passwordDraft.currentPassword}
              onChange={(event) => updatePasswordField('currentPassword', event.target.value)}
              placeholder="Confirme ton mot de passe actuel"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((value) => !value)}
              aria-label={showCurrentPassword ? 'Masquer le mot de passe actuel' : 'Afficher le mot de passe actuel'}
              title={showCurrentPassword ? 'Masquer' : 'Afficher'}
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <label>Nouveau mot de passe</label>
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordDraft.password}
              onChange={(event) => updatePasswordField('password', event.target.value)}
              placeholder="Minimum 6 caractères"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              title={showPassword ? 'Masquer' : 'Afficher'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <label>Confirmer le mot de passe</label>
          <div className="password-field">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={passwordDraft.confirmPassword}
              onChange={(event) => updatePasswordField('confirmPassword', event.target.value)}
              placeholder="Repete le mot de passe"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
              title={showConfirmPassword ? 'Masquer' : 'Afficher'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {passwordNotice ? <p className="small-note">{passwordNotice}</p> : null}
          {passwordError ? <p className="auth-error">{passwordError}</p> : null}
          <button type="submit" className="profile-action-button" disabled={isBusy}>
            <Save size={16} />
            Changer le mot de passe
          </button>
        </form>
      </div>
    </section>
  );
}
