import { useCallback } from 'react';
import { createInitialProject } from '../../../shared/data/projectData';
import { upsertProjectAsset } from '../../../shared/services/assetManager';
import { formatStorageSize } from '../../../shared/services/storageQuota';
import {
  IMAGE_UPLOAD_OPTIMIZATION,
  fileToDataURL,
  imageFileToOptimizedBlob,
  uploadFileToSupabase,
} from '../../../shared/utils/fileHelpers';
import { extensionFromMime } from '../../../shared/utils/mediaProjectHelpers';
import { hasRemoteStorageConfig } from '../../../shared/services/remoteSession';

const getMediaImportInfo = (file) => {
  const mimeType = file?.type || '';
  const isImage = mimeType.startsWith('image/');
  const isAudio = mimeType.startsWith('audio/');
  const isVideo = mimeType.startsWith('video/');
  return {
    assetType: isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'unknown',
    folder: isImage ? 'images' : isAudio ? 'audio' : isVideo ? 'video' : 'files',
    isAudio,
    isImage,
    isVideo,
    mediaKind: isVideo ? 'Vidéo' : isAudio ? 'Son' : 'Média',
    shouldOptimizeImage: isImage && !['image/svg+xml', 'image/gif'].includes(mimeType),
  };
};

const validateMediaFile = (file) => {
  if (!file) return '';
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
    return 'Ce fichier est vide ou illisible.';
  }
  return '';
};

const prepareMediaFileForUpload = async (file, mediaInfo) => {
  if (!mediaInfo.shouldOptimizeImage) {
    return {
      file,
      optimized: false,
      originalSize: file.size,
      size: file.size,
    };
  }

  const optimizedBlob = await imageFileToOptimizedBlob(file, IMAGE_UPLOAD_OPTIMIZATION);
  const extension = extensionFromMime(optimizedBlob.type || IMAGE_UPLOAD_OPTIMIZATION.mimeType);
  const optimizedName = /\.[^.]+$/.test(file.name)
    ? file.name.replace(/\.[^.]+$/, `.${extension}`)
    : `${file.name || 'media'}.${extension}`;
  const optimizedFile = optimizedBlob instanceof File
    ? optimizedBlob
    : new File([optimizedBlob], optimizedName, { type: optimizedBlob.type || IMAGE_UPLOAD_OPTIMIZATION.mimeType });
  return {
    file: optimizedFile,
    optimized: true,
    originalSize: file.size,
    size: optimizedFile.size || optimizedBlob.size || file.size,
  };
};

export function useBuilderMediaUpload({
  accountStorageQuotaBytes,
  activeProjectId,
  alertDialog,
  editor,
  getCurrentStorageUsageBytes,
  invalidateStorageUsage,
  preview,
  saveProjectAndAcknowledge,
  setSaveStatus,
  userId,
}) {
  const uploadMediaFile = useCallback(async (file, mediaInfo, preparedMedia = null) => {
    const uploadFile = preparedMedia?.file || file;
    const displayName = file.name || 'media';
    if (!hasRemoteStorageConfig()) {
      return {
        name: displayName,
        optimized: Boolean(preparedMedia?.optimized),
        originalSize: preparedMedia?.originalSize || file.size,
        size: preparedMedia?.size || uploadFile.size || file.size,
        optimizedSize: preparedMedia?.size || uploadFile.size || file.size,
        url: await fileToDataURL(uploadFile),
      };
    }

    const uploaded = await uploadFileToSupabase(uploadFile, {
      userId,
      folder: mediaInfo.folder,
      optimizeImage: false,
      imageOptions: IMAGE_UPLOAD_OPTIMIZATION,
      dedupePublicMedia: true,
    });

    return {
      name: displayName,
      optimized: Boolean(preparedMedia?.optimized || uploaded.optimized),
      originalSize: preparedMedia?.originalSize || uploaded.originalSize || file.size,
      size: uploaded.optimizedSize || preparedMedia?.size || uploadFile.size || file.size,
      optimizedSize: uploaded.optimizedSize || preparedMedia?.size || uploadFile.size || file.size,
      url: uploaded.publicUrl,
    };
  }, [userId]);

  const importMediaAsset = useCallback(async (file, {
    onImported = null,
    useActiveProjectReload = false,
  } = {}) => {
    const validationMessage = validateMediaFile(file);
    if (!file) return null;
    if (validationMessage) {
      setSaveStatus(validationMessage);
      await alertDialog({
        title: 'Import impossible',
        message: validationMessage,
      });
      return null;
    }

    const mediaInfo = getMediaImportInfo(file);

    try {
      const preparedMedia = await prepareMediaFileForUpload(file, mediaInfo);
      const usageBytes = await getCurrentStorageUsageBytes();
      if (usageBytes + preparedMedia.size > accountStorageQuotaBytes) {
        const message = `Stockage insuffisant : ${formatStorageSize(usageBytes)} / ${formatStorageSize(accountStorageQuotaBytes)} utilisés. Ce fichier pèse ${formatStorageSize(preparedMedia.size)}.`;
        setSaveStatus(message);
        await alertDialog({
          title: 'Stockage insuffisant',
          message: `${message}\n\nSupprime des médias inactifs ou augmente le stockage du compte.`,
          variant: 'danger',
        });
        return null;
      }

      const uploaded = await uploadMediaFile(file, mediaInfo, preparedMedia);
      const assetInput = {
        type: mediaInfo.assetType,
        url: uploaded.url,
        name: uploaded.name,
        size: uploaded.size,
      };

      if (typeof onImported === 'function') {
        onImported(uploaded.url, uploaded.name);
      }

      if (useActiveProjectReload) {
        const nextProject = structuredClone(editor.project || createInitialProject());
        const asset = upsertProjectAsset(nextProject, assetInput);

        editor.loadProject(nextProject);
        preview.syncWithProject(nextProject);
        if (userId) await saveProjectAndAcknowledge(nextProject, activeProjectId, {
          tab: editor.tab,
          selectedSceneId: editor.selectedSceneId,
        });
        invalidateStorageUsage();
        setSaveStatus(`Média importé : ${uploaded.name}`);
        return asset;
      }

      editor.patchProject((draft) => {
        upsertProjectAsset(draft, assetInput);
      }, { rememberHistory: false });
      invalidateStorageUsage();

      if (hasRemoteStorageConfig()) {
        const savedPercent = uploaded.optimized && uploaded.originalSize > 0 && uploaded.optimizedSize > 0
          ? Math.round((1 - uploaded.optimizedSize / uploaded.originalSize) * 100)
          : 0;
        const compressionRatio = savedPercent > 0 ? ` (${savedPercent}% plus léger)` : '';
        setSaveStatus(`${mediaInfo.mediaKind} importé${mediaInfo.isImage ? 'e' : ''} dans Supabase${uploaded.optimized ? ' en WebP optimisé' : ''}${compressionRatio} : ${file.name}`);
      } else {
        setSaveStatus(`${mediaInfo.mediaKind} importé${mediaInfo.isImage ? 'e' : ''} localement${mediaInfo.shouldOptimizeImage ? ' en WebP optimisé' : ''} : ${file.name}`);
      }

      return assetInput;
    } catch (error) {
      console.error('Erreur import média', error);
      setSaveStatus('Import média impossible');
      await alertDialog({
        title: 'Import média impossible',
        message: hasRemoteStorageConfig() ?
           "Impossible d'envoyer ce fichier vers Supabase Storage. Vérifie le bucket et les policies."
          : 'Configuration Supabase manquante. Ajoute VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY), VITE_SUPABASE_PUBLIC_ASSETS_BUCKET et VITE_SUPABASE_PRIVATE_DATA_BUCKET.',
        variant: 'danger',
      });
      return null;
    }
  }, [
    accountStorageQuotaBytes,
    activeProjectId,
    alertDialog,
    editor.loadProject,
    editor.patchProject,
    editor.project,
    editor.selectedSceneId,
    editor.tab,
    getCurrentStorageUsageBytes,
    invalidateStorageUsage,
    preview.syncWithProject,
    saveProjectAndAcknowledge,
    setSaveStatus,
    uploadMediaFile,
    userId,
  ]);

  const handleUpload = useCallback(async (event, callback) => {
    try {
      await importMediaAsset(event.target.files?.[0], {
        onImported: callback,
      });
    } finally {
      event.target.value = '';
    }
  }, [importMediaAsset]);

  const importProfileMediaFile = useCallback((file) => importMediaAsset(file, {
    useActiveProjectReload: true,
  }), [importMediaAsset]);

  const uploadGalleryThumbnail = useCallback(async (file) => {
    if (!file) throw new Error('Aucune miniature à envoyer.');

    if (!hasRemoteStorageConfig()) {
      return {
        publicUrl: await fileToDataURL(file),
        storageMode: 'local',
      };
    }

    const result = await uploadFileToSupabase(file, {
      userId,
      folder: 'gallery-thumbnails',
      optimizeImage: false,
    });

    return {
      publicUrl: result.publicUrl,
      storageMode: 'supabase',
    };
  }, [userId]);

  return {
    handleUpload,
    importMediaAsset,
    importProfileMediaFile,
    uploadGalleryThumbnail,
  };
}
