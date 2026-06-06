import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellDot, CheckCircle2, Copy, ImageUp, UserMinus, Users } from 'lucide-react';
import { showConfirm } from '../../shared/ui/AccessibleDialog';
import {
  AUTHOR_PROFILE_THEME_DEFAULTS,
  AUTHOR_SOCIAL_LINK_TYPES,
  formatAuthorBlogPostDateTime,
  getAuthorSocialLinkUrl,
  normalizeAuthorProfileTheme,
  normalizeAuthorSocialLinks,
  setAuthorSocialLinkUrl,
} from '../../shared/services/authorProfiles';
import { getAllAccounts } from '../../shared/services/authStorage';
import {
  getCreatorFollowState,
  getCreatorLatestActivityAt,
  getFollowersForCreator,
  getUnreadFollowedCreatorActivity,
  markCreatorActivitySeen,
  markFollowedCreatorActivitySeen,
  unfollowCreator,
} from '../../shared/services/creatorFollows';
import {
  cropAuthorProfileImage,
  getAuthorProfileMediaRecommendation,
  readAuthorProfileImageFile,
  readAuthorProfileImageSource,
} from '../../shared/utils/authorProfileMedia';
import { buildAuthorProfileUrl, getAuthorProfileRouteSlug } from '../../shared/utils/publicProjectLinks';
import AuthorProfileImageCropper from './components/AuthorProfileImageCropper';

const getAuthorInitial = (name = '') => String(name || 'Créateur').trim().charAt(0).toUpperCase() || 'C';

const AUTHOR_PROFILE_TABS = [
  ['profile', 'Mettre à jour'],
  ['theme', 'Thème'],
  ['following', 'Créateurs suivis'],
  ['followers', 'Followers'],
];

const AUTHOR_THEME_FIELDS = [
  ['pageBackground', 'Fond de page'],
  ['panelBackground', 'Fond des blocs'],
  ['accentColor', 'Couleur accent'],
  ['textColor', 'Texte principal'],
  ['mutedTextColor', 'Texte secondaire'],
];

const formatFollowDate = (value = '') => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Aucune activité';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const getAccountLabel = (account = null, fallbackId = '') => (
  account?.name || account?.email || `Compte ${String(fallbackId || '').slice(0, 8) || 'inconnu'}`
);

const getCreatorSources = (games = []) => {
  const sourcesById = new Map();
  games.forEach((game) => {
    if (!game.userId || sourcesById.has(game.userId)) return;
    sourcesById.set(game.userId, {
      userId: game.userId,
      displayName: game.authorProfile?.displayName || game.author || '',
      name: game.author || '',
      email: game.authorEmail || '',
    });
  });
  return [...sourcesById.values()];
};

const copyTextToClipboard = async (text = '') => {
  if (!text) throw new Error('Texte vide.');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body?.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand?.('copy');
  textarea.remove();
  if (!didCopy) throw new Error('Copie impossible.');
};

function AuthorAvatarPreview({ avatar = '', displayName = '', onOpenCrop }) {
  const [hasError, setHasError] = useState(false);
  const avatarSrc = String(avatar || '').trim();
  const initial = getAuthorInitial(displayName);

  useEffect(() => {
    setHasError(false);
  }, [avatarSrc]);

  return (
    <button
      type="button"
      className="author-avatar-preview author-media-preview-button"
      aria-label="Recadrer l'avatar auteur"
      onClick={onOpenCrop}
    >
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
    </button>
  );
}

function AuthorBannerPreview({ banner = '', displayName = '', onOpenCrop }) {
  const [hasError, setHasError] = useState(false);
  const bannerSrc = String(banner || '').trim();

  useEffect(() => {
    setHasError(false);
  }, [bannerSrc]);

  return (
    <button
      type="button"
      className="author-banner-preview author-media-preview-button"
      aria-label="Recadrer la bannière auteur"
      onClick={onOpenCrop}
    >
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
    </button>
  );
}

const createAuthorDraft = (authorProfile = {}, user = {}) => ({
  displayName: authorProfile?.displayName || user?.name || user?.email || '',
  tagline: authorProfile?.tagline || '',
  bio: authorProfile?.bio || '',
  website: authorProfile?.website || '',
  avatar: authorProfile?.avatar || '',
  banner: authorProfile?.banner || '',
  theme: normalizeAuthorProfileTheme(authorProfile?.theme),
  socialLinks: normalizeAuthorSocialLinks(authorProfile?.socialLinks, authorProfile?.website),
});

const buildAuthorDraftPayload = (draft = {}) => {
  const socialLinks = normalizeAuthorSocialLinks(draft.socialLinks, draft.website);
  const theme = normalizeAuthorProfileTheme(draft.theme);
  return {
    ...draft,
    website: getAuthorSocialLinkUrl(socialLinks, 'site'),
    avatar: String(draft.avatar || '').trim(),
    banner: String(draft.banner || '').trim(),
    theme,
    socialLinks,
  };
};

export default function AuthorProfileEditor({
  user,
  authorProfile,
  publicGames = [],
  onUpdateAuthorProfile,
  onCreatorFollowsChange,
  onOpenCreator,
  onBack,
}) {
  const [authorDraft, setAuthorDraft] = useState(() => createAuthorDraft(authorProfile, user));
  const [blogDraft, setBlogDraft] = useState({ title: '', body: '' });
  const [mediaError, setMediaError] = useState('');
  const [profileLinkNotice, setProfileLinkNotice] = useState('');
  const [activeAuthorTab, setActiveAuthorTab] = useState('profile');
  const [themePreviewTab, setThemePreviewTab] = useState('creator');
  const [followVersion, setFollowVersion] = useState(0);
  const [imageCrop, setImageCrop] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPan, setCropPan] = useState({ x: 0, y: 0 });
  const [isCropBusy, setIsCropBusy] = useState(false);
  const bannerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setAuthorDraft(createAuthorDraft(authorProfile, user));
  }, [authorProfile, user]);

  const updateSocialLink = (type, url) => {
    setAuthorDraft((draft) => {
      const socialLinks = setAuthorSocialLinkUrl(draft.socialLinks, type, url, draft.website);
      return {
        ...draft,
        website: type === 'site' ? String(url || '') : draft.website,
        socialLinks,
      };
    });
  };

  const updateThemeField = (field, value) => {
    setAuthorDraft((draft) => ({
      ...draft,
      theme: {
        ...normalizeAuthorProfileTheme(draft.theme),
        [field]: String(value || '').trim(),
      },
    }));
  };

  const restoreAuthorTheme = () => {
    setAuthorDraft((draft) => ({
      ...draft,
      theme: normalizeAuthorProfileTheme(authorProfile?.theme),
    }));
  };

  const refreshFollows = () => {
    setFollowVersion((version) => version + 1);
    onCreatorFollowsChange?.();
  };

  const accountMap = useMemo(() => (
    new Map(getAllAccounts().map((account) => [account.id, account]))
  ), [followVersion, user?.id]);

  const unreadCreatorIds = useMemo(() => (
    new Set(getUnreadFollowedCreatorActivity(user?.id, publicGames).map((entry) => entry.creatorId))
  ), [followVersion, publicGames, user?.id]);

  const followedCreators = useMemo(() => {
    const followState = getCreatorFollowState(user?.id);
    return followState.followedCreatorIds.map((creatorId) => {
      const creatorGames = publicGames.filter((game) => game.userId === creatorId);
      const firstGame = creatorGames[0] || {};
      const account = accountMap.get(creatorId);
      const latestAt = getCreatorLatestActivityAt(publicGames, creatorId);
      return {
        creatorId,
        name: firstGame.author || firstGame.authorProfile?.displayName || getAccountLabel(account, creatorId),
        tagline: firstGame.authorProfile?.tagline || '',
        gameCount: creatorGames.length,
        latestAt,
        lastSeenAt: followState.lastSeenAtByCreator[creatorId] || '',
        unread: unreadCreatorIds.has(creatorId),
      };
    });
  }, [accountMap, followVersion, publicGames, unreadCreatorIds, user?.id]);

  const followers = useMemo(() => (
    getFollowersForCreator(user?.id).map((entry) => {
      const account = accountMap.get(entry.followerId);
      return {
        ...entry,
        name: getAccountLabel(account, entry.followerId),
        email: account?.email || '',
      };
    })
  ), [accountMap, followVersion, user?.id]);

  const authorProfileUrl = useMemo(() => {
    const source = {
      userId: user?.id,
      displayName: authorDraft.displayName || authorProfile?.displayName || user?.name || '',
      name: user?.name || '',
      email: user?.email || '',
    };
    return buildAuthorProfileUrl(user?.id, undefined, {
      ...source,
      slug: getAuthorProfileRouteSlug(source, getCreatorSources(publicGames)),
    });
  }, [
    authorDraft.displayName,
    authorProfile?.displayName,
    publicGames,
    user?.email,
    user?.id,
    user?.name,
  ]);

  const markCreatorSeen = (creatorId) => {
    markCreatorActivitySeen(user?.id, creatorId, publicGames);
    refreshFollows();
  };

  const markAllCreatorsSeen = () => {
    markFollowedCreatorActivitySeen(user?.id, publicGames);
    refreshFollows();
  };

  const stopFollowingCreator = async (creatorId) => {
    const confirmed = await showConfirm({
      title: 'Ne plus suivre',
      message: 'Ne plus suivre ce créateur ?',
      confirmLabel: 'Ne plus suivre',
      variant: 'danger',
    });
    if (!confirmed) return;
    unfollowCreator(user?.id, creatorId);
    refreshFollows();
  };

  const removeFollower = async (followerId) => {
    const confirmed = await showConfirm({
      title: 'Retirer le follower',
      message: 'Retirer ce compte de tes followers ?',
      confirmLabel: 'Retirer',
      variant: 'danger',
    });
    if (!confirmed) return;
    unfollowCreator(followerId, user?.id);
    refreshFollows();
  };

  const importAuthorImage = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const image = await readAuthorProfileImageFile(file);
      setImageCrop({ ...image, field });
      setCropZoom(1);
      setCropPan({ x: 0, y: 0 });
      setMediaError('');
    } catch (error) {
      setMediaError(error?.message || "Import de l'image impossible.");
    }
  };

  const openAuthorImageCrop = async (field) => {
    const src = String(authorDraft[field] || '').trim();
    if (!src) {
      const inputRef = field === 'banner' ? bannerInputRef : avatarInputRef;
      inputRef.current?.click();
      return;
    }

    try {
      const image = await readAuthorProfileImageSource(src, field);
      setImageCrop({ ...image, field });
      setCropZoom(1);
      setCropPan({ x: 0, y: 0 });
      setMediaError('');
    } catch (error) {
      setMediaError(error?.message || "Image impossible à recadrer.");
    }
  };

  const confirmAuthorImageCrop = async () => {
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
      setAuthorDraft((draft) => ({ ...draft, [imageCrop.field]: imageData }));
      setImageCrop(null);
      setMediaError('');
    } catch (error) {
      setMediaError(error?.message || "Recadrage de l'image impossible.");
    } finally {
      setIsCropBusy(false);
    }
  };

  const saveAuthorDraft = async (event) => {
    event.preventDefault();
    await onUpdateAuthorProfile?.(buildAuthorDraftPayload(authorDraft));
  };

  const copyAuthorProfileLink = async () => {
    try {
      await copyTextToClipboard(authorProfileUrl);
      setProfileLinkNotice('Lien du profil auteur copié.');
    } catch {
      setProfileLinkNotice('Copie impossible, le lien peut être sélectionné manuellement.');
    }
  };

  const publishBlogPost = async (event) => {
    event.preventDefault();
    const title = blogDraft.title.trim();
    const body = blogDraft.body.trim();
    if (!title || !body) return;
    const post = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.slice(0, 80),
      body: body.slice(0, 600),
      createdAt: new Date().toISOString(),
    };
    const authorPayload = buildAuthorDraftPayload(authorDraft);
    await onUpdateAuthorProfile?.({
      ...(authorProfile || {}),
      ...authorPayload,
      blogPosts: [post, ...(authorProfile?.blogPosts || [])].slice(0, 10),
    });
    setBlogDraft({ title: '', body: '' });
  };

  const deleteBlogPost = async (postId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer l’article',
      message: 'Supprimer cet article ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    const authorPayload = buildAuthorDraftPayload(authorDraft);
    await onUpdateAuthorProfile?.({
      ...(authorProfile || {}),
      ...authorPayload,
      blogPosts: (authorProfile?.blogPosts || []).filter((post) => post.id !== postId),
    });
  };

  const currentTheme = normalizeAuthorProfileTheme(authorDraft.theme);
  const previewName = authorDraft.displayName || user?.name || 'Créateur';
  const previewTagline = authorDraft.tagline || 'Escape games narratifs et énigmes maison';
  const previewBio = authorDraft.bio || 'Présente ton univers, tes thèmes favoris et le rythme de tes créations.';
  const previewBlogPosts = (authorProfile?.blogPosts || []).slice(0, 1);
  const previewGames = publicGames
    .filter((game) => game.userId === user?.id)
    .slice(0, 2);
  const previewGameCards = previewGames.length ? previewGames : [
    {
      key: 'preview-game-1',
      title: 'Crypte des secrets',
      category: 'Mystère',
      durationMinutes: 45,
      difficulty: 'intermédiaire',
      feedback: { average: 4.8 },
      image: '',
    },
    {
      key: 'preview-game-2',
      title: 'Manoir aux horloges',
      category: 'Enquête',
      durationMinutes: 35,
      difficulty: 'facile',
      feedback: { average: 4.5 },
      image: '',
    },
  ];
  const previewPost = previewBlogPosts[0] || {
    id: 'preview-news',
    title: 'Nouvelle salle publiée',
    body: 'Un court message d’actualité apparaît ici avec les couleurs de ta page.',
    createdAt: new Date().toISOString(),
  };
  const previewPostDate = formatAuthorBlogPostDateTime(previewPost.createdAt || previewPost.updatedAt);
  const renderThemePreviewGameCards = () => previewGameCards.map((game) => (
    <article key={game.key || game.projectId || game.title}>
      <span className="author-theme-preview-game-image">
        {game.image ? <img src={game.image} alt="" /> : game.title.charAt(0).toUpperCase()}
      </span>
      <div>
        <strong>{game.title}</strong>
        <p>{game.category || 'Mystère'} · {game.durationMinutes || 45} min</p>
        <small>★ {Number(game.feedback?.average || 4.7).toFixed(1)} · {game.difficulty || 'intermédiaire'}</small>
      </div>
    </article>
  ));

  return (
    <section className="public-author-editor">
      <button type="button" className="secondary-action public-back-button" onClick={onBack}>← Retour au jeu</button>
      <section className="panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="eyebrow">Auteur</span>
            <h2>Profil public</h2>
            <p className="small-note">Cette fiche est visible dans la galerie publique avec tes jeux publiés.</p>
          </div>
        </div>
        <div className="author-profile-tabs" role="tablist" aria-label="Gestion du profil auteur">
          {AUTHOR_PROFILE_TABS.map(([tabId, label]) => {
            const badge = tabId === 'following'
              ? unreadCreatorIds.size
              : tabId === 'followers'
                ? followers.length
                : 0;
            return (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={activeAuthorTab === tabId}
                aria-label={badge ? `${label} ${badge}` : label}
                className={activeAuthorTab === tabId ? 'active' : ''}
                onClick={() => setActiveAuthorTab(tabId)}
              >
                <span>{label}</span>
                {badge ? <strong>{badge}</strong> : null}
              </button>
            );
          })}
        </div>

        <section className="author-profile-share-strip" aria-label="Lien public du profil auteur">
          <div>
            <label htmlFor="author-profile-public-link">Lien public du profil</label>
            <p className="small-note">Ce lien ouvre directement ta fiche auteur dans la galerie.</p>
          </div>
          <div className="author-profile-share-row">
            <input
              id="author-profile-public-link"
              value={authorProfileUrl}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="secondary-action author-profile-copy-link"
              onClick={copyAuthorProfileLink}
              disabled={!authorProfileUrl}
            >
              <Copy size={16} aria-hidden="true" />
              Copier
            </button>
          </div>
          {profileLinkNotice ? <p className="small-note" role="status">{profileLinkNotice}</p> : null}
        </section>

        {activeAuthorTab === 'profile' ? (
        <div className="author-profile-grid">
          <form onSubmit={saveAuthorDraft} className="author-profile-form">
            <div className="author-banner-control">
              <AuthorBannerPreview
                banner={authorDraft.banner}
                displayName={authorDraft.displayName}
                onOpenCrop={() => openAuthorImageCrop('banner')}
              />
              <label className="author-media-label">
                <span>Bannière</span>
                <small>Taille recommandée : {getAuthorProfileMediaRecommendation('banner')}</small>
                <input
                  aria-label="Bannière"
                  value={authorDraft.banner}
                  onChange={(event) => setAuthorDraft((draft) => ({ ...draft, banner: event.target.value }))}
                  placeholder="https://..."
                  maxLength={1000}
                />
              </label>
              <div className="author-media-actions">
                <button type="button" className="secondary-action author-media-upload-button" onClick={() => bannerInputRef.current?.click()}>
                  <ImageUp size={16} />
                  Importer
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => importAuthorImage(event, 'banner')}
                />
              </div>
            </div>
            <div className="author-avatar-control">
              <AuthorAvatarPreview
                avatar={authorDraft.avatar}
                displayName={authorDraft.displayName}
                onOpenCrop={() => openAuthorImageCrop('avatar')}
              />
              <label className="author-media-label">
                <span>Avatar</span>
                <small>Taille recommandée : {getAuthorProfileMediaRecommendation('avatar')}</small>
                <input
                  aria-label="Avatar"
                  value={authorDraft.avatar}
                  onChange={(event) => setAuthorDraft((draft) => ({ ...draft, avatar: event.target.value }))}
                  placeholder="https://..."
                  maxLength={1000}
                />
              </label>
              <div className="author-media-actions">
                <button type="button" className="secondary-action author-media-upload-button" onClick={() => avatarInputRef.current?.click()}>
                  <ImageUp size={16} />
                  Importer
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => importAuthorImage(event, 'avatar')}
                />
              </div>
            </div>
            {mediaError ? <p className="auth-error">{mediaError}</p> : null}
            <label>Nom d’auteur</label>
            <input
              value={authorDraft.displayName}
              onChange={(event) => setAuthorDraft((draft) => ({ ...draft, displayName: event.target.value }))}
              placeholder="Mika"
            />
            <label>Phrase courte</label>
            <input
              value={authorDraft.tagline}
              onChange={(event) => setAuthorDraft((draft) => ({ ...draft, tagline: event.target.value }))}
              placeholder="Escape games narratifs et énigmes maison"
            />
            <label>Bio</label>
            <textarea
              value={authorDraft.bio}
              onChange={(event) => setAuthorDraft((draft) => ({ ...draft, bio: event.target.value }))}
              placeholder="Présente ton style, tes thèmes, ton rythme de création..."
              maxLength={600}
            />
            <fieldset className="social-links-editor author-social-links">
              <legend>Liens</legend>
              <div className="social-links-grid">
                {AUTHOR_SOCIAL_LINK_TYPES.map(({ type, label }) => (
                  <label key={type} htmlFor={`author-social-${type}`}>
                    {label}
                    <input
                      id={`author-social-${type}`}
                      value={getAuthorSocialLinkUrl(authorDraft.socialLinks, type)}
                      onChange={(event) => updateSocialLink(type, event.target.value)}
                      placeholder="https://..."
                      maxLength={1000}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="profile-action-button">Mettre à jour le profil</button>
          </form>

          <div className="author-blog-panel">
            <form onSubmit={publishBlogPost}>
              <h3>Actualité</h3>
              <label>Titre</label>
              <input
                value={blogDraft.title}
                onChange={(event) => setBlogDraft((draft) => ({ ...draft, title: event.target.value }))}
                placeholder="Nouveau décor, nouvelle énigme..."
                maxLength={80}
              />
              <label>Article court</label>
              <textarea
                value={blogDraft.body}
                onChange={(event) => setBlogDraft((draft) => ({ ...draft, body: event.target.value }))}
                placeholder="Partage une actu, un making-of, une note d’auteur..."
                maxLength={600}
              />
              <button type="submit" className="profile-action-button secondary-action">Publier l’actualité</button>
            </form>

            <div className="author-blog-list">
              {(authorProfile?.blogPosts || []).length ? authorProfile.blogPosts.map((post) => (
                <article key={post.id} className="author-blog-card">
                  <strong>{post.title}</strong>
                  {formatAuthorBlogPostDateTime(post.createdAt || post.updatedAt) ? (
                    <time className="author-blog-date" dateTime={post.createdAt || post.updatedAt}>
                      Publié le {formatAuthorBlogPostDateTime(post.createdAt || post.updatedAt)}
                    </time>
                  ) : null}
                  <p>{post.body}</p>
                  <button type="button" className="secondary-action" onClick={() => deleteBlogPost(post.id)}>Supprimer</button>
                </article>
              )) : <p className="small-note">Aucune actualité publiée.</p>}
            </div>
          </div>
        </div>
        ) : null}

        {activeAuthorTab === 'theme' ? (
          <form onSubmit={saveAuthorDraft} className="author-theme-panel">
            <div className="author-theme-head">
              <div>
                <h3>Thème de la page auteur</h3>
                <p className="small-note">Ces couleurs s’appliquent à ta fiche publique dans la galerie.</p>
              </div>
            </div>

            <div className="author-theme-grid">
              <div className="author-theme-fields">
                {AUTHOR_THEME_FIELDS.map(([field, label]) => (
                  <label key={field} className="author-theme-color-field" htmlFor={`author-theme-${field}`}>
                    <span>{label}</span>
                    <div className="author-theme-color-inputs">
                      <input
                        id={`author-theme-${field}`}
                        type="color"
                        value={currentTheme[field]}
                        onChange={(event) => updateThemeField(field, event.target.value)}
                        aria-label={`${label} couleur`}
                      />
                      <input
                        value={authorDraft.theme?.[field] || currentTheme[field]}
                        onChange={(event) => updateThemeField(field, event.target.value)}
                        placeholder={AUTHOR_PROFILE_THEME_DEFAULTS[field]}
                        maxLength={7}
                        aria-label={`${label} hexadécimal`}
                      />
                    </div>
                  </label>
                ))}
                <div className="author-theme-actions">
                  <button type="button" className="secondary-action" onClick={restoreAuthorTheme}>Rétablir</button>
                  <button type="submit" className="profile-action-button">Sauvegarder</button>
                </div>
              </div>

              <div
                className="author-theme-preview"
                aria-label="Aperçu complet de la page auteur"
                style={{
                  '--author-preview-bg': currentTheme.pageBackground,
                  '--author-preview-panel': currentTheme.panelBackground,
                  '--author-preview-accent': currentTheme.accentColor,
                  '--author-preview-text': currentTheme.textColor,
                  '--author-preview-muted': currentTheme.mutedTextColor,
                }}
              >
                <span className="author-theme-preview-back">← Galerie</span>
                <div className="author-theme-preview-banner">
                  {authorDraft.banner ? (
                    <img src={authorDraft.banner} alt="" />
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
                <div className="author-theme-preview-tabs" role="tablist" aria-label="Sections de l’aperçu auteur">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={themePreviewTab === 'creator'}
                    className={themePreviewTab === 'creator' ? 'active' : ''}
                    onClick={() => setThemePreviewTab('creator')}
                  >
                    Créateur
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={themePreviewTab === 'games'}
                    className={themePreviewTab === 'games' ? 'active' : ''}
                    onClick={() => setThemePreviewTab('games')}
                  >
                    Jeux publiés <strong>{previewGameCards.length}</strong>
                  </button>
                </div>

                {themePreviewTab === 'creator' ? (
                  <div className="author-theme-preview-layout">
                    <div className="author-theme-preview-side">
                      <section className="author-theme-preview-card">
                        <div className="author-theme-preview-profile">
                          <div className="author-theme-preview-avatar">
                            {authorDraft.avatar ? (
                              <img src={authorDraft.avatar} alt="" />
                            ) : (
                              <span>{getAuthorInitial(previewName)}</span>
                            )}
                          </div>
                          <div>
                            <span className="author-theme-preview-kicker">Profil créateur</span>
                            <h4>{previewName}</h4>
                            <p>🎮 {previewGameCards.length} jeux créés</p>
                            <p>👥 {followers.length} follower{followers.length > 1 ? 's' : ''}</p>
                            <p>⭐ Moyenne : 4.7</p>
                            <span className="author-theme-preview-follow">Suivre</span>
                          </div>
                        </div>
                      </section>

                      <section className="author-theme-preview-news">
                        <h5>Actualité</h5>
                        <article>
                          <strong>{previewPost.title}</strong>
                          {previewPostDate ? (
                            <time dateTime={previewPost.createdAt || previewPost.updatedAt}>
                              Publié le {previewPostDate}
                            </time>
                          ) : null}
                          <p>{previewPost.body}</p>
                          <span>J’aime · {previewPost.likes || 0}</span>
                        </article>
                      </section>
                    </div>

                    <div className="author-theme-preview-main">
                      <section className="author-theme-preview-about">
                        <div>
                          <span className="author-theme-preview-kicker">À propos de l’auteur</span>
                          <p className="author-theme-preview-tagline">{previewTagline}</p>
                        </div>
                        <p>{previewBio}</p>
                        <div className="author-theme-preview-links">
                          <span>Site</span>
                          <span>Instagram</span>
                          <span>Discord</span>
                        </div>
                      </section>

                      <section className="author-theme-preview-games">
                        <h5>Jeux publiés</h5>
                        <div>
                          {renderThemePreviewGameCards()}
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <section className="author-theme-preview-games author-theme-preview-games-tab">
                    <h5>Jeux publiés</h5>
                    <div>
                      {renderThemePreviewGameCards()}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </form>
        ) : null}

        {activeAuthorTab === 'following' ? (
          <section className="author-follow-panel">
            <div className="author-follow-head">
              <div>
                <h3>Créateurs suivis</h3>
                <p className="small-note">
                  Les nouveautés signalent les jeux publiés et les actualités ajoutées depuis ta dernière lecture.
                </p>
              </div>
              {followedCreators.length ? (
                <button type="button" className="secondary-action" onClick={markAllCreatorsSeen}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Tout marquer comme lu
                </button>
              ) : null}
            </div>

            {followedCreators.length ? (
              <div className="author-follow-list">
                {followedCreators.map((creator) => (
                  <article key={creator.creatorId} className={`author-follow-card${creator.unread ? ' has-unread' : ''}`}>
                    <div className="author-follow-card-main">
                      <span className="author-follow-avatar">{getAuthorInitial(creator.name)}</span>
                      <div>
                        <strong>{creator.name}</strong>
                        {creator.tagline ? <p>{creator.tagline}</p> : null}
                        <small>
                          {creator.gameCount} jeu{creator.gameCount > 1 ? 'x' : ''} publié{creator.gameCount > 1 ? 's' : ''}
                          {' · '}
                          Dernière activité : {formatFollowDate(creator.latestAt)}
                        </small>
                      </div>
                    </div>
                    {creator.unread ? (
                      <span className="author-follow-status unread">
                        <BellDot size={15} aria-hidden="true" />
                        Nouveau
                      </span>
                    ) : (
                      <span className="author-follow-status">
                        <CheckCircle2 size={15} aria-hidden="true" />
                        Lu
                      </span>
                    )}
                    <div className="author-follow-actions">
                      {onOpenCreator ? (
                        <button type="button" className="secondary-action" onClick={() => onOpenCreator(creator.creatorId)}>
                          Voir la fiche
                        </button>
                      ) : null}
                      {creator.unread ? (
                        <button type="button" className="secondary-action" onClick={() => markCreatorSeen(creator.creatorId)}>
                          Marquer comme lu
                        </button>
                      ) : null}
                      <button type="button" className="danger-button" onClick={() => stopFollowingCreator(creator.creatorId)}>
                        <UserMinus size={15} aria-hidden="true" />
                        Ne plus suivre
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="small-note author-follow-empty">Aucun créateur suivi pour le moment.</p>
            )}
          </section>
        ) : null}

        {activeAuthorTab === 'followers' ? (
          <section className="author-follow-panel">
            <div className="author-follow-head">
              <div>
                <h3>Followers</h3>
                <p className="small-note">Les comptes qui suivent ton profil auteur et recevront tes nouveautés publiques.</p>
              </div>
              <span className="author-follow-count">
                <Users size={16} aria-hidden="true" />
                {followers.length}
              </span>
            </div>

            {followers.length ? (
              <div className="author-follow-list">
                {followers.map((follower) => (
                  <article key={follower.followerId} className="author-follow-card compact">
                    <div className="author-follow-card-main">
                      <span className="author-follow-avatar">{getAuthorInitial(follower.name)}</span>
                      <div>
                        <strong>{follower.name}</strong>
                        {follower.email ? <p>{follower.email}</p> : null}
                        <small>Dernière lecture : {formatFollowDate(follower.lastSeenAt)}</small>
                      </div>
                    </div>
                    <div className="author-follow-actions">
                      <button type="button" className="danger-button" onClick={() => removeFollower(follower.followerId)}>
                        <UserMinus size={15} aria-hidden="true" />
                        Retirer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="small-note author-follow-empty">Aucun follower pour le moment.</p>
            )}
          </section>
        ) : null}
        <AuthorProfileImageCropper
          imageCrop={imageCrop}
          cropZoom={cropZoom}
          cropPan={cropPan}
          isCropBusy={isCropBusy}
          onClose={() => setImageCrop(null)}
          onZoomChange={setCropZoom}
          onPanChange={setCropPan}
          onConfirm={confirmAuthorImageCrop}
        />
      </section>
    </section>
  );
}
