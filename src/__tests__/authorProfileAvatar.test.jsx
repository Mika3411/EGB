import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import GalleryBrowser from '../domains/gallery/GalleryBrowser';
import AuthorProfileEditor from '../domains/profile/AuthorProfileEditor';
import ProfileSettingsPanel from '../domains/profile/components/ProfileSettingsPanel';
import { saveAllAccounts } from '../shared/services/authStorage';
import { getAuthorProfile, saveAuthorProfile } from '../shared/services/authorProfiles';
import { followCreator, isFollowingCreator } from '../shared/services/creatorFollows';

const PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';
const originalFileReader = globalThis.FileReader;
const originalImage = globalThis.Image;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalThis.FileReader = originalFileReader;
  globalThis.Image = originalImage;
  vi.restoreAllMocks();
});

const createPublicProject = () => ({
  id: 'project-1',
  name: 'Crypte test',
  data: {
    title: 'Crypte test',
    description: 'Une crypte publique',
    scenes: [],
    enigmas: [],
  },
  shareState: {
    isPublic: true,
    publishedAt: '2026-01-01T00:00:00.000Z',
  },
});

const installProfileImageImportMocks = ({ width = 2000, height = 800, dataUrl = 'data:image/png;base64,source', croppedUrl = 'data:image/webp;base64,cropped' } = {}) => {
  globalThis.FileReader = class {
    result = dataUrl;
    onload = null;
    onerror = null;

    readAsDataURL() {
      queueMicrotask(() => this.onload?.());
    }
  };

  globalThis.Image = class {
    naturalWidth = width;
    naturalHeight = height;
    width = width;
    height = height;
    onload = null;
    onerror = null;

    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }

    get src() {
      return this._src;
    }
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(croppedUrl);
};

describe('author profile media', () => {
  test('limite la banniere galerie a la decouverte des jeux', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    const { container, unmount } = render(<GalleryBrowser />);
    expect(container.querySelector('.public-gallery-banner')).toBeTruthy();

    unmount();
    const creatorView = render(<GalleryBrowser initialCreatorId="creator-1" />);
    expect(await screen.findByText('Profil créateur', {}, { timeout: 3000 })).toBeTruthy();
    expect(creatorView.container.querySelector('.public-gallery-banner')).toBeNull();
  });

  test('sauvegarde les medias et liens sociaux depuis l editeur', async () => {
    const onUpdateAuthorProfile = vi.fn();
    render(
      <AuthorProfileEditor
        user={{ id: 'creator-1', name: 'Mika Studio', email: 'mika@example.test' }}
        authorProfile={{ displayName: 'Mika Studio', avatar: '', banner: '' }}
        onUpdateAuthorProfile={onUpdateAuthorProfile}
      />,
    );

    fireEvent.change(screen.getByLabelText('Bannière'), {
      target: { value: '  https://cdn.example.test/mika-banner.png  ' },
    });
    fireEvent.change(screen.getByLabelText('Avatar'), {
      target: { value: '  https://cdn.example.test/mika-logo.png  ' },
    });
    fireEvent.change(screen.getByLabelText('Site'), {
      target: { value: '  https://mika.example.test  ' },
    });
    fireEvent.change(screen.getByLabelText('Instagram'), {
      target: { value: '  https://instagram.example.test/mika  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour le profil' }));

    await waitFor(() => {
      expect(onUpdateAuthorProfile).toHaveBeenCalledWith(expect.objectContaining({
        website: 'https://mika.example.test',
        avatar: 'https://cdn.example.test/mika-logo.png',
        banner: 'https://cdn.example.test/mika-banner.png',
        socialLinks: expect.arrayContaining([
          { type: 'site', url: 'https://mika.example.test' },
          { type: 'instagram', url: 'https://instagram.example.test/mika' },
        ]),
      }));
    });
  });

  test('recadre une banniere importee depuis l editeur auteur', async () => {
    installProfileImageImportMocks({ croppedUrl: 'data:image/webp;base64,banner-cropped' });
    const onUpdateAuthorProfile = vi.fn();
    const { container } = render(
      <AuthorProfileEditor
        user={{ id: 'creator-1', name: 'Mika Studio', email: 'mika@example.test' }}
        authorProfile={{ displayName: 'Mika Studio', avatar: '', banner: '' }}
        onUpdateAuthorProfile={onUpdateAuthorProfile}
      />,
    );

    fireEvent.change(container.querySelectorAll('input[type="file"]')[0], {
      target: { files: [new File(['banner'], 'banner.png', { type: 'image/png' })] },
    });

    expect(await screen.findByRole('dialog', { name: 'Recadrer bannière' })).toBeTruthy();
    const cropPreview = container.querySelector('.thumbnail-crop-preview.author-banner');
    vi.spyOn(cropPreview, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 300,
      bottom: 120,
      width: 300,
      height: 120,
      toJSON: () => {},
    });
    fireEvent.pointerDown(cropPreview, { pointerId: 1, clientX: 100, clientY: 50, button: 0 });
    fireEvent.pointerMove(cropPreview, { pointerId: 1, clientX: 130, clientY: 70 });
    fireEvent.pointerUp(cropPreview, { pointerId: 1, clientX: 130, clientY: 70 });
    await waitFor(() => {
      const image = cropPreview.querySelector('img');
      expect(image.style.width).toBe('100%');
      expect(image.style.height).toBe('200%');
      expect(image.style.transform).toContain('translate(-50%, -50%)');
      expect(image.style.left).toBe('50%');
      expect(image.style.top).toContain('66.66');
    });
    expect(container.querySelector('input[type="range"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zoomer' }));
    await waitFor(() => {
      const image = cropPreview.querySelector('img');
      expect(image.style.width).toBe('110%');
      expect(image.style.height).toBe('220%');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Valider bannière' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Recadrer bannière' })).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour le profil' }));

    await waitFor(() => {
      expect(onUpdateAuthorProfile).toHaveBeenCalledWith(expect.objectContaining({
        banner: 'data:image/webp;base64,banner-cropped',
      }));
    });
  });

  test('sauvegarde la banniere et les liens depuis les reglages du profil', async () => {
    const onUpdateAuthorProfile = vi.fn();
    render(
      <ProfileSettingsPanel
        user={{ id: 'creator-1', name: 'Mika Studio', email: 'mika@example.test' }}
        authorProfile={{ displayName: 'Mika Studio', banner: '' }}
        onUpdateAuthorProfile={onUpdateAuthorProfile}
      />,
    );

    fireEvent.change(screen.getByLabelText('Bannière auteur'), {
      target: { value: '  https://cdn.example.test/profile-banner.png  ' },
    });
    fireEvent.change(screen.getByLabelText('YouTube'), {
      target: { value: '  https://youtube.example.test/mika  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));

    await waitFor(() => {
      expect(onUpdateAuthorProfile).toHaveBeenCalledWith(expect.objectContaining({
        banner: 'https://cdn.example.test/profile-banner.png',
        socialLinks: expect.arrayContaining([
          { type: 'youtube', url: 'https://youtube.example.test/mika' },
        ]),
      }));
    });
  });

  test('recadre un avatar importe depuis les reglages du profil', async () => {
    installProfileImageImportMocks({ width: 900, height: 1200, croppedUrl: 'data:image/webp;base64/avatar-cropped' });
    const onUpdateAuthorProfile = vi.fn();
    const { container } = render(
      <ProfileSettingsPanel
        user={{ id: 'creator-1', name: 'Mika Studio', email: 'mika@example.test' }}
        authorProfile={{ displayName: 'Mika Studio', avatar: '', banner: '' }}
        onUpdateAuthorProfile={onUpdateAuthorProfile}
      />,
    );

    fireEvent.change(container.querySelectorAll('input[type="file"]')[1], {
      target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] },
    });

    expect(await screen.findByRole('dialog', { name: 'Recadrer avatar' })).toBeTruthy();
    const cropPreview = container.querySelector('.thumbnail-crop-preview.author-avatar');
    await waitFor(() => {
      const image = cropPreview.querySelector('img');
      expect(image.style.width).toBe('100%');
      expect(image.style.height).toBe('133.3333%');
      expect(image.style.left).toBe('50%');
      expect(image.style.top).toBe('50%');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Valider avatar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Recadrer avatar' })).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));

    await waitFor(() => {
      expect(onUpdateAuthorProfile).toHaveBeenCalledWith(expect.objectContaining({
        avatar: 'data:image/webp;base64/avatar-cropped',
      }));
    });
  });

  test('affiche l avatar public du createur quand il existe', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      avatar: 'https://cdn.example.test/mika-logo.png',
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(<GalleryBrowser initialCreatorId="creator-1" />);

    const avatar = await screen.findByAltText('Avatar de Mika Studio');
    expect(avatar.getAttribute('src')).toBe('https://cdn.example.test/mika-logo.png');
  });

  test('affiche la banniere publique du createur quand elle existe', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      banner: 'https://cdn.example.test/mika-banner.png',
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(<GalleryBrowser initialCreatorId="creator-1" />);

    const banner = await screen.findByAltText('Bannière de Mika Studio');
    expect(banner.getAttribute('src')).toBe('https://cdn.example.test/mika-banner.png');
  });

  test('affiche seulement les liens sociaux publics renseignes', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      socialLinks: [
        { type: 'site', url: 'mika.example.test' },
        { type: 'instagram', url: 'https://instagram.example.test/mika' },
        { type: 'youtube', url: '' },
        { type: 'linkedin', url: 'https://linkedin.example.test/in/mika' },
      ],
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(<GalleryBrowser initialCreatorId="creator-1" />);

    expect((await screen.findByRole('link', { name: 'Site' })).getAttribute('href')).toBe('https://mika.example.test');
    expect(screen.getByRole('link', { name: 'Instagram' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'YouTube' })).toBeNull();
  });

  test('affiche un bloc a propos auteur compact avec date de mise a jour', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      tagline: 'Mystères artisanaux',
      bio: 'Je fabrique des escape games narratifs pour petits groupes.',
      socialLinks: [
        { type: 'site', url: 'https://mika.example.test' },
        { type: 'discord', url: 'https://discord.example.test/mika' },
      ],
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(<GalleryBrowser initialCreatorId="creator-1" />);

    expect(await screen.findByText('À propos de l’auteur')).toBeTruthy();
    expect(screen.getAllByText('Mika Studio').length).toBeGreaterThan(0);
    expect(screen.getByText('Mystères artisanaux')).toBeTruthy();
    expect(screen.getByText('Je fabrique des escape games narratifs pour petits groupes.')).toBeTruthy();
    expect(screen.getByText(/Mis à jour le/i)).toBeTruthy();
    expect(screen.getByText('Liens')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Site' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Discord' })).toBeTruthy();
  });

  test('sépare le profil createur et les jeux publies en onglets', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      bio: 'Profil auteur visible dans le premier onglet.',
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(<GalleryBrowser initialCreatorId="creator-1" />);

    expect(await screen.findByRole('tab', { name: 'Créateur' })).toBeTruthy();
    expect(screen.getByText('Profil auteur visible dans le premier onglet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Crypte test' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Jeux publiés 1' }));

    expect(await screen.findByRole('button', { name: 'Crypte test' })).toBeTruthy();
    expect(screen.queryByText('Profil auteur visible dans le premier onglet.')).toBeNull();
  });

  test('place l actualite dans la colonne createur', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      blogPosts: [{ id: 'post-1', title: 'Ouverture du carnet', body: 'Une actu courte.' }],
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    const { container } = render(<GalleryBrowser initialCreatorId="creator-1" />);

    const newsTitle = await screen.findByText('Actualité');
    const newsPanel = newsTitle.closest('.public-author-news');
    expect(newsPanel).toBeTruthy();
    expect(container.querySelector('.public-creator-side .public-author-news')).toBe(newsPanel);
    expect(container.querySelector('.public-creator-overview > .public-author-about')).toBeTruthy();
  });

  test('permet de liker une actualite publique', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      blogPosts: [{ id: 'post-1', title: 'Ouverture du carnet', body: 'Une actu courte.' }],
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(<GalleryBrowser initialCreatorId="creator-1" />);

    const likeButton = await screen.findByRole('button', { name: 'Liker Ouverture du carnet' });
    expect(likeButton.textContent).toContain('J’aime');
    expect(likeButton.textContent).toContain('0');

    fireEvent.click(likeButton);

    const unlikeButton = await screen.findByRole('button', { name: 'Retirer le like de Ouverture du carnet' });
    expect(unlikeButton.textContent).toContain('Aimé');
    expect(unlikeButton.textContent).toContain('1');
    expect(getAuthorProfile('creator-1').blogPosts[0]).toMatchObject({
      likes: 1,
      likedBy: [window.localStorage.getItem('escapeGameBuilder.publicVisitorId')],
    });
  });

  test('permet a un compte de suivre un createur public', async () => {
    saveAllAccounts([
      { id: 'creator-1', name: 'Mika', email: 'mika@example.test' },
      { id: 'follower-1', name: 'Lecteur', email: 'lecteur@example.test' },
    ]);
    saveAuthorProfile('creator-1', { displayName: 'Mika Studio' });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(
      <GalleryBrowser
        user={{ id: 'follower-1', name: 'Lecteur', email: 'lecteur@example.test' }}
        initialCreatorId="creator-1"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Suivre' }));

    expect(isFollowingCreator('follower-1', 'creator-1')).toBe(true);
    expect(await screen.findByRole('button', { name: 'Suivi' })).toBeTruthy();
  });

  test('signale les nouvelles actualites des createurs suivis sur le profil auteur', async () => {
    saveAllAccounts([
      { id: 'creator-1', name: 'Mika', email: 'mika@example.test' },
      { id: 'follower-1', name: 'Lecteur', email: 'lecteur@example.test' },
    ]);
    followCreator('follower-1', 'creator-1', '2026-01-01T00:00:00.000Z');
    saveAuthorProfile('creator-1', {
      displayName: 'Mika Studio',
      blogPosts: [{
        id: 'post-1',
        title: 'Nouvelle salle',
        body: 'Une nouvelle actualité.',
        createdAt: '2026-01-02T00:00:00.000Z',
      }],
    });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    const { container } = render(
      <GalleryBrowser
        user={{ id: 'follower-1', name: 'Lecteur', email: 'lecteur@example.test' }}
        authorProfile={{ displayName: 'Lecteur' }}
      />,
    );

    await screen.findByRole('button', { name: 'Mon profil auteur, nouveautés des créateurs suivis' });
    expect(container.querySelector('.public-profile-notification-dot')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mon profil auteur, nouveautés des créateurs suivis' }));
    expect(container.querySelector('.public-profile-notification-dot')).toBeTruthy();

    fireEvent.click(await screen.findByRole('tab', { name: 'Créateurs suivis 1' }));
    expect(await screen.findByText('Nouveau')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));

    await waitFor(() => {
      expect(container.querySelector('.public-profile-notification-dot')).toBeNull();
    });
    expect(await screen.findByText('Lu')).toBeTruthy();
  });

  test('affiche les followers dans mon profil auteur', async () => {
    saveAllAccounts([
      { id: 'creator-1', name: 'Mika', email: 'mika@example.test' },
      { id: 'follower-1', name: 'Lecteur', email: 'lecteur@example.test' },
    ]);
    followCreator('follower-1', 'creator-1', '2026-01-01T00:00:00.000Z');

    render(
      <AuthorProfileEditor
        user={{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }}
        authorProfile={{ displayName: 'Mika Studio' }}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Followers 1' }));

    expect(await screen.findByText('Lecteur')).toBeTruthy();
    expect(screen.getByText('lecteur@example.test')).toBeTruthy();
    expect(screen.getByText(/Dernière lecture/i)).toBeTruthy();
  });

  test('conserve l initiale publique sans avatar', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', { displayName: 'Mika Studio', avatar: '' });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    render(<GalleryBrowser initialCreatorId="creator-1" />);

    await waitFor(() => {
      expect(screen.getByText('M')).toBeTruthy();
    });
    expect(screen.queryByAltText('Avatar de Mika Studio')).toBeNull();
  });

  test('affiche un fallback de banniere publique sans image', async () => {
    saveAllAccounts([{ id: 'creator-1', name: 'Mika', email: 'mika@example.test' }]);
    saveAuthorProfile('creator-1', { displayName: 'Mika Studio', banner: '' });
    window.localStorage.setItem(`${PROJECTS_KEY_PREFIX}.creator-1`, JSON.stringify([createPublicProject()]));

    const { container } = render(<GalleryBrowser initialCreatorId="creator-1" />);

    await waitFor(() => {
      expect(container.querySelector('.public-creator-banner-fallback')).toBeTruthy();
    });
    expect(screen.queryByAltText('Bannière de Mika Studio')).toBeNull();
  });
});
