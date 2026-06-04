import { describe, expect, test } from 'vitest';
import {
  estimateDataUrlByteLength,
  estimateOfflineExportSize,
  formatOfflineExportSizeEstimate,
  getOfflineExportEstimateMessage,
} from '../shared/utils/offlineExportEstimate';

const ONE_MIB = 1024 * 1024;

describe('offlineExportEstimate', () => {
  test('estime les data URLs et les tailles distantes connues', () => {
    const remoteBackgroundUrl = 'https://storage.example.test/public/backgrounds/scene.png';
    const project = {
      scenes: [{
        name: 'Salle test',
        backgroundData: remoteBackgroundUrl,
        musicData: 'data:audio/mpeg;base64,aGVsbG8=',
      }],
      remoteMediaMetadata: [{
        url: remoteBackgroundUrl,
        sizeBytes: 18 * ONE_MIB,
      }],
    };

    const estimate = estimateOfflineExportSize(project);

    expect(estimate.dataUrlBytes).toBe(5);
    expect(estimate.remoteBytes).toBe(18 * ONE_MIB);
    expect(estimate.estimatedBytes).toBe(18 * ONE_MIB + 5);
    expect(estimate.knownRemoteCount).toBe(1);
    expect(getOfflineExportEstimateMessage(project)).toBe('Export hors ligne estimé : ~18 Mo');
  });

  test('deduplique les memes URLs distantes pour l estimation', () => {
    const remoteImageUrl = 'https://storage.example.test/public/images/item.png';
    const project = {
      scenes: [{
        backgroundData: remoteImageUrl,
        hotspots: [{ objectImageData: remoteImageUrl }],
      }],
    };

    const estimate = estimateOfflineExportSize(project);

    expect(estimate.remoteCount).toBe(1);
    expect(estimate.unknownRemoteCount).toBe(1);
    expect(estimate.remoteBytes).toBe(0);
    expect(getOfflineExportEstimateMessage(project)).toBe('Export hors ligne estimé : taille à confirmer (1 média sans taille connue)');
  });

  test('deduplique les memes data URLs pour refleter le bundler', () => {
    const sharedDataUrl = 'data:text/plain;base64,aGVsbG8=';
    const project = {
      scenes: [{
        backgroundData: sharedDataUrl,
      }, {
        backgroundData: sharedDataUrl,
      }],
    };

    const estimate = estimateOfflineExportSize(project);

    expect(estimate.dataUrlCount).toBe(1);
    expect(estimate.dataUrlBytes).toBe(5);
    expect(estimate.mediaCount).toBe(1);
  });

  test('ignore les assets de bibliotheque non utilises par le jeu actif', () => {
    const usedUrl = 'https://storage.example.test/public/images/used.png';
    const unusedUrl = 'https://storage.example.test/public/images/unused.png';
    const project = {
      assets: [{
        id: 'unused-library-image',
        type: 'image',
        url: unusedUrl,
        size: 180 * ONE_MIB,
      }],
      scenes: [{
        backgroundData: usedUrl,
      }],
      remoteMediaMetadata: [{
        url: usedUrl,
        sizeBytes: 4 * ONE_MIB,
      }],
    };

    const estimate = estimateOfflineExportSize(project);

    expect(estimate.remoteCount).toBe(1);
    expect(estimate.remoteBytes).toBe(4 * ONE_MIB);
  });

  test('compte un asset de bibliotheque utilise par identifiant', () => {
    const usedUrl = 'https://storage.example.test/public/images/used-by-id.png';
    const project = {
      assets: [{
        id: 'asset-background',
        type: 'image',
        url: usedUrl,
        size: 6 * ONE_MIB,
      }],
      scenes: [{
        backgroundId: 'asset-background',
        backgroundData: '',
      }],
    };

    const estimate = estimateOfflineExportSize(project);

    expect(estimate.remoteCount).toBe(1);
    expect(estimate.remoteBytes).toBe(6 * ONE_MIB);
    expect(getOfflineExportEstimateMessage(project)).toBe('Export hors ligne estimé : ~6 Mo');
  });

  test('annonce les medias inconnus sans les gonfler avec une taille arbitraire', () => {
    const project = {
      scenes: [{
        backgroundData: 'https://storage.example.test/public/images/unknown.png',
        musicData: 'data:audio/mpeg;base64,aGVsbG8=',
      }],
    };

    const estimate = estimateOfflineExportSize(project);

    expect(estimate.estimatedBytes).toBe(5);
    expect(estimate.unknownRemoteCount).toBe(1);
    expect(getOfflineExportEstimateMessage(project)).toBe('Export hors ligne estimé : moins de 1 Mo (+ 1 média sans taille connue)');
  });

  test('utilise les tailles connues de la mediatheque sans compter les autres projets', () => {
    const activeUrl = 'https://storage.example.test/public/images/active.png';
    const otherProjectUrl = 'https://storage.example.test/public/images/other-project.png';
    const project = {
      scenes: [{
        backgroundData: activeUrl,
      }],
    };

    const estimate = estimateOfflineExportSize(project, {
      knownAssets: [{
        url: activeUrl,
        storageBytes: 11 * ONE_MIB,
      }, {
        url: otherProjectUrl,
        storageBytes: 90 * ONE_MIB,
      }],
    });

    expect(estimate.remoteCount).toBe(1);
    expect(estimate.remoteBytes).toBe(11 * ONE_MIB);
    expect(estimate.estimatedBytes).toBe(11 * ONE_MIB);
    expect(getOfflineExportEstimateMessage(project, {
      knownAssets: [{ url: activeUrl, storageBytes: 11 * ONE_MIB }],
    })).toBe('Export hors ligne estimé : ~11 Mo');
  });

  test('deduplique les URLs Supabase signees par objet de stockage pour l estimation', () => {
    const signedUrlA = 'https://project.supabase.co/storage/v1/object/sign/game-media/audio/0422.mp3?token=aaa&expires=111';
    const signedUrlB = 'https://project.supabase.co/storage/v1/object/sign/game-media/audio/0422.mp3?token=bbb&expires=222';
    const project = {
      scenes: [{
        musicData: signedUrlB,
      }, {
        musicData: signedUrlA,
      }],
    };

    const estimate = estimateOfflineExportSize(project, {
      knownAssets: [{ url: signedUrlA, storageBytes: 3 * ONE_MIB }],
    });

    expect(estimate.remoteCount).toBe(1);
    expect(estimate.remoteBytes).toBe(3 * ONE_MIB);
    expect(estimate.unknownRemoteCount).toBe(0);
  });

  test('deduplique les copies audio connues par nom normalise et taille pour l estimation', () => {
    const audioUrlA = 'https://project.supabase.co/storage/v1/object/public/game-media/audio/0422-a.mp3';
    const audioUrlB = 'https://project.supabase.co/storage/v1/object/public/game-media/audio/0422-b.mp3';
    const project = {
      scenes: [{
        musicData: audioUrlA,
        musicName: '0422.MP3',
      }, {
        musicData: audioUrlB,
        musicName: '0422(1).MP3',
      }],
    };

    const estimate = estimateOfflineExportSize(project, {
      knownAssets: [{
        url: audioUrlA,
        name: '0422.MP3',
        type: 'audio',
        storageBytes: 3 * ONE_MIB,
      }, {
        url: audioUrlB,
        name: '0422(1).MP3',
        type: 'audio',
        storageBytes: 3 * ONE_MIB,
      }],
    });

    expect(estimate.remoteCount).toBe(1);
    expect(estimate.remoteBytes).toBe(3 * ONE_MIB);
    expect(estimate.unknownRemoteCount).toBe(0);
  });

  test('deduplique les references distantes avec le meme nom de fichier meme sans taille connue', () => {
    const project = {
      scenes: [{
        musicData: 'https://project.supabase.co/storage/v1/object/public/game-media/audio/first-copy.mp3',
        musicName: '0422.MP3',
      }, {
        musicData: 'https://project.supabase.co/storage/v1/object/public/game-media/audio/second-copy.mp3',
        musicName: '0422.MP3',
      }],
    };

    const estimate = estimateOfflineExportSize(project);

    expect(estimate.remoteCount).toBe(1);
    expect(estimate.unknownRemoteCount).toBe(1);
  });

  test('ignore les references hors allowlist standalone historique', () => {
    const project = {
      rpg3dCanvases: [{
        config: {
          mediaAssets: [{
            type: 'image',
            url: 'https://storage.example.test/public/library/unused.png',
          }],
        },
      }],
    };

    expect(estimateOfflineExportSize(project)).toMatchObject({
      estimatedBytes: 0,
      mediaCount: 0,
      remoteCount: 0,
    });
  });

  test('formate les petites tailles et les data URLs', () => {
    expect(estimateDataUrlByteLength('data:text/plain;base64,aGVsbG8=')).toBe(5);
    expect(formatOfflineExportSizeEstimate(512 * 1024)).toBe('moins de 1 Mo');
    expect(formatOfflineExportSizeEstimate(3.5 * ONE_MIB)).toBe('~3,5 Mo');
  });
});
