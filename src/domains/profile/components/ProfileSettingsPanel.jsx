import { Eye, EyeOff, ImageUp, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  AUTHOR_SOCIAL_LINK_TYPES,
  getAuthorSocialLinkUrl,
  normalizeAuthorSocialLinks,
  setAuthorSocialLinkUrl,
} from '../../../shared/services/authorProfiles';
import { getAccountTypeLabel } from '../../../shared/services/accountPlans';
import {
  cropAuthorProfileImage,
  getAuthorProfileMediaRecommendation,
  readAuthorProfileImageFile,
} from '../../../shared/utils/authorProfileMedia';
import AuthorProfileImageCropper from './AuthorProfileImageCropper';

const getAuthorInitial = (name = '') => String(name || 'Créateur').trim().charAt(0).toUpperCase() || 'C';

function ProfileAvatarPreview({ avatar = '', displayName = '' }) {
  const [hasError, setHasError] = useState(false);
  const avatarSrc = String(avatar || '').trim();
  const initial = getAuthorInitial(displayName);

  useEffect(() => {
    setHasError(false);
  }, [avatarSrc]);

  return (
    <div className="profile-avatar-preview" aria-label="Aperçu avatar auteur">
      {avatarSrc && !hasError ? (
        <img
          src={avatarSrc}
          alt={`Avatar de ${displayName || 'l’auteur'}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function ProfileBannerPreview({ banner = '', displayName = '' }) {
  const [hasError, setHasError] = useState(false);
  const bannerSrc = String(banner || '').trim();

  useEffect(() => {
    setHasError(false);
  }, [bannerSrc]);

  return (
    <div className="profile-banner-preview" aria-label="Aperçu bannière auteur">
      {bannerSrc && !hasError ? (
        <img
          src={bannerSrc}
          alt={`Bannière de ${displayName || 'l’auteur'}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}

const createProfileDraft = (authorProfile = {}, user = {}) => ({
  displayName: authorProfile?.displayName || user?.name || user?.email || '',
  tagline: authorProfile?.tagline || '',
  bio: authorProfile?.bio || '',
  website: authorProfile?.website || '',
  avatar: authorProfile?.avatar || '',
  banner: authorProfile?.banner || '',
  socialLinks: normalizeAuthorSocialLinks(authorProfile?.socialLinks, authorProfile?.website),
});

const buildProfileDraftPayload = (draft = {}) => {
  const socialLinks = normalizeAuthorSocialLinks(draft.socialLinks, draft.website);
  return {
    ...draft,
    website: getAuthorSocialLinkUrl(socialLinks, 'site'),
    avatar: String(draft.avatar || '').trim(),
    banner: String(draft.banner || '').trim(),
    socialLinks,
  };
};

export default function ProfileSettingsPanel({
  user,
  authorProfile,
  isBusy = false,
  onUpdateAuthorProfile,
  onUpdatePassword,
}) {
  const [profileDraft, setProfileDraft] = useState(() => createProfileDraft(authorProfile, user));
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', password: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [imageCrop, setImageCrop] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPan, setCropPan] = useState({ x: 0, y: 0 });
  const [isCropBusy, setIsCropBusy] = useState(false);
  const bannerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setProfileDraft(createProfileDraft(authorProfile, user));
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

  const updateSocialLink = (type, url) => {
    setProfileDraft((draft) => {
      const socialLinks = setAuthorSocialLinkUrl(draft.socialLinks, type, url, draft.website);
      return {
        ...draft,
        website: type === 'site' ? String(url || '') : draft.website,
        socialLinks,
      };
    });
    setProfileNotice('');
  };

  const importProfileImage = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const image = await readAuthorProfileImageFile(file);
      setImageCrop({ ...image, field });
      setCropZoom(1);
      setCropPan({ x: 0, y: 0 });
      setProfileNotice('');
      setMediaError('');
    } catch (error) {
      setMediaError(error?.message || "Import de l'image impossible.");
    }
  };

  const confirmProfileImageCrop = async () => {
    if (!imageCrop) return;
    setIsCropBusy(true);
    try {
      const imageData = await cropAuthorProfileImage({
        src: imageCrop.src,
        sourceWidth: imageCrop.width,
        sourceHeight: imageCrop.height,
        target: imageCrop.field,
        zoom: cropZoom,
        panX: cropPan.x,
        panY: cropPan.y,
      });
      setProfileDraft((draft) => ({ ...draft, [imageCrop.field]: imageData }));
      setImageCrop(null);
      setProfileNotice('');
      setMediaError('');
    } catch (error) {
      setMediaError(error?.message || "Recadrage de l'image impossible.");
    } finally {
      setIsCropBusy(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    await onUpdateAuthorProfile?.(buildProfileDraftPayload(profileDraft));
    setProfileNotice('Informations du profil mises à jour.');
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
      setPasswordNotice('Mot de passe mis à jour.');
    } catch (error) {
      setPasswordError(error?.message || 'Mise à jour du mot de passe impossible.');
    }
  };

  return (
    <section className="panel profile-settings-panel" data-tour="profile-settings-section">
      <div className="panel-head panel-head-stack">
        <div>
          <span className="eyebrow">Compte</span>
          <h2>Profil et sécurité</h2>
          <p className="small-note">Modifie tes informations publiques et ton accès au compte.</p>
        </div>
      </div>

      <div className="profile-settings-grid">
        <form className="profile-settings-form" onSubmit={saveProfile} data-tour="profile-public-identity">
          <h3>Informations du profil</h3>
          <ProfileBannerPreview banner={profileDraft.banner} displayName={profileDraft.displayName} />
          <label htmlFor="profile-banner" className="profile-media-label">
            <span>Bannière auteur</span>
            <small>Taille recommandée : {getAuthorProfileMediaRecommendation('banner')}</small>
          </label>
          <input
            id="profile-banner"
            aria-label="Bannière auteur"
            value={profileDraft.banner}
            onChange={(event) => updateProfileField('banner', event.target.value)}
            placeholder="https://..."
            maxLength={1000}
          />
          <div className="profile-media-actions">
            <button type="button" className="secondary-action profile-media-upload-button" onClick={() => bannerInputRef.current?.click()}>
              <ImageUp size={16} />
              Importer
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => importProfileImage(event, 'banner')}
            />
          </div>
          <div className="profile-avatar-control">
            <ProfileAvatarPreview avatar={profileDraft.avatar} displayName={profileDraft.displayName} />
            <label htmlFor="profile-avatar" className="profile-media-label">
              <span>Avatar auteur</span>
              <small>Taille recommandée : {getAuthorProfileMediaRecommendation('avatar')}</small>
            </label>
            <input
              id="profile-avatar"
              aria-label="Avatar auteur"
              value={profileDraft.avatar}
              onChange={(event) => updateProfileField('avatar', event.target.value)}
              placeholder="https://..."
              maxLength={1000}
            />
            <div className="profile-media-actions">
              <button type="button" className="secondary-action profile-media-upload-button" onClick={() => avatarInputRef.current?.click()}>
                <ImageUp size={16} />
                Importer
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => importProfileImage(event, 'avatar')}
              />
            </div>
          </div>
          {mediaError ? <p className="auth-error">{mediaError}</p> : null}
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
          <fieldset className="social-links-editor profile-social-links">
            <legend>Liens</legend>
            <div className="social-links-grid">
              {AUTHOR_SOCIAL_LINK_TYPES.map(({ type, label }) => (
                <label key={type} htmlFor={`profile-social-${type}`}>
                  {label}
                  <input
                    id={`profile-social-${type}`}
                    value={getAuthorSocialLinkUrl(profileDraft.socialLinks, type)}
                    onChange={(event) => updateSocialLink(type, event.target.value)}
                    placeholder="https://..."
                    maxLength={1000}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          {profileNotice ? <p className="small-note">{profileNotice}</p> : null}
          <button type="submit" className="profile-action-button" disabled={isBusy} data-tour="profile-save-public-identity">
            <Save size={16} />
            Enregistrer le profil
          </button>
        </form>

        <form className="profile-settings-form" onSubmit={savePassword} data-tour="profile-security-form">
          <h3>Compte et mot de passe</h3>
          <label>Email du compte</label>
          <input value={user?.email || ''} readOnly />
          <label>Type de compte</label>
          <input value={getAccountTypeLabel(user)} readOnly />
          {user?.organization ? (
            <>
              <label>Organisation / activité</label>
              <input value={user.organization} readOnly />
            </>
          ) : null}
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
      <AuthorProfileImageCropper
        imageCrop={imageCrop}
        cropZoom={cropZoom}
        cropPan={cropPan}
        isCropBusy={isCropBusy}
        onClose={() => setImageCrop(null)}
        onZoomChange={setCropZoom}
        onPanChange={setCropPan}
        onConfirm={confirmProfileImageCrop}
      />
    </section>
  );
}
