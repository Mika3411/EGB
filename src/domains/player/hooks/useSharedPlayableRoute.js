import { useEffect, useRef } from 'react';
import { normalizeProject } from '../../../shared/data/projectData';
import { loadProjectRecordsForUser } from '../../../shared/services/authStorage';
import { loadPublicProject } from '../../../shared/services/publicGalleryStorage';
import { getAuthorProfileSlugFromPath } from '../../../shared/utils/publicProjectLinks';

export function useSharedPlayableRoute({ editor, preview, setScreen, setSharedLoadStatus }) {
  const sharedRouteRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playUserId = params.get('playUser') || params.get('user');
    const playProjectId = params.get('playProject') || params.get('project');
    const galleryMode = params.get('gallery');
    const galleryGame = params.get('game') || '';
    const galleryCreator = params.get('creator') || '';
    const galleryCreatorSlug = getAuthorProfileSlugFromPath();

    if (galleryMode || galleryCreatorSlug) {
      sharedRouteRef.current = true;
      window.__escapeInitialGalleryGame = galleryGame;
      window.__escapeInitialGalleryCreator = galleryCreator;
      window.__escapeInitialGalleryCreatorSlug = galleryCreatorSlug;
      setScreen('gallery');
      return undefined;
    }

    if (!playUserId || !playProjectId) return undefined;

    sharedRouteRef.current = true;
    let isCancelled = false;

    async function loadSharedProject() {
      setScreen('shared-preview');
      setSharedLoadStatus('Chargement du jeu...');

      try {
        const publicProject = await loadPublicProject(playUserId, playProjectId);
        const records = publicProject ? [] : await loadProjectRecordsForUser(playUserId);
        const record = (records || []).find((entry) => entry.id === playProjectId);
        const sharedProject = publicProject || record?.shareState?.publishedData || record?.data || record?.project || record;
        if (!sharedProject) throw new Error('Projet introuvable.');

        const projectToLoad = normalizeProject(sharedProject);
        if (isCancelled) return;
        editor.loadProject(projectToLoad);
        preview.syncWithProject(projectToLoad);
        editor.setTab('preview');
        setSharedLoadStatus('');
      } catch (error) {
        console.error('Erreur de chargement du lien jouable', error);
        if (!isCancelled) setSharedLoadStatus('Lien jouable indisponible.');
      }
    }

    loadSharedProject();

    return () => {
      isCancelled = true;
    };
  }, []);

  return sharedRouteRef;
}
