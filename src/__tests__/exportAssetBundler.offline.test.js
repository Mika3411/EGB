import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExportProjectWithAssets } from '../utils/exportAssetBundler';

const remotePngUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/remote-background.png';
const remoteWebpUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/remote-poster.webp?token=abc';
const remoteAudioUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/theme';

const makeResponse = (body, {
  arrayBuffer = null,
  contentLength = null,
  contentType = '',
  ok = true,
  status = 200,
  statusText = 'OK',
} = {}) => ({
  ok,
  status,
  statusText,
  headers: {
    get: (name) => {
      const headerName = name.toLowerCase();
      if (headerName === 'content-type') return contentType;
      if (headerName === 'content-length' && contentLength !== null) return String(contentLength);
      return null;
    },
  },
  arrayBuffer: arrayBuffer || (async () => new TextEncoder().encode(body).buffer),
});

const makeRemoteProject = (url = remotePngUrl) => ({
  id: 'offline-assets-test',
  title: 'Offline Assets Test',
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  assets: [{
    id: 'remote-background',
    type: 'image',
    name: 'Remote Background.png',
    url,
  }],
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    actId: 'act-1',
    backgroundData: url,
    backgroundName: 'Hall.png',
    musicData: remoteAudioUrl,
    musicName: 'Theme',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [{
    id: 'key',
    name: 'Key',
    imageData: 'data:image/png;base64,a2V5',
    imageName: 'Key.png',
  }],
  cinematics: [],
  enigmas: [{
    id: 'enigma-1',
    name: 'Intro',
    popupBackgroundData: remoteWebpUrl,
    popupBackgroundName: 'Intro Poster',
  }],
  combinations: [],
  storyVariables: [],
});

const buildWithZip = async (project, options) => {
  const zip = new JSZip();
  const folder = zip.folder('jeu-exporte');
  const exportedProject = await buildExportProjectWithAssets(project, folder, options);
  return { zip, exportedProject };
};

const makeSingleRemoteProject = (url = remotePngUrl) => ({
  id: 'offline-assets-single-remote-test',
  title: 'Offline Assets Single Remote Test',
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  assets: [],
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    actId: 'act-1',
    backgroundData: url,
    backgroundName: 'Hall.png',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [],
  cinematics: [],
  enigmas: [],
  combinations: [],
  storyVariables: [],
});

const makeDuplicateDataUrlProject = () => ({
  id: 'duplicate-data-url-test',
  title: 'Duplicate Data URL Test',
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  assets: [],
  scenes: [{
    id: 'scene-a',
    name: 'Scene A',
    actId: 'act-1',
    backgroundData: 'data:image/png;base64,c2hhcmVk',
    backgroundName: 'Shared.png',
    hotspots: [],
    sceneObjects: [],
  }, {
    id: 'scene-b',
    name: 'Scene B',
    actId: 'act-1',
    backgroundData: 'data:image/png;base64,c2hhcmVk',
    backgroundName: 'Other Name.png',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [],
  cinematics: [],
  enigmas: [],
  combinations: [],
  storyVariables: [],
});

const makeDistinctDataUrlProject = () => ({
  ...makeDuplicateDataUrlProject(),
  scenes: [{
    ...makeDuplicateDataUrlProject().scenes[0],
    backgroundData: 'data:image/png;base64,Zmlyc3Q=',
    backgroundName: 'Same Name.png',
  }, {
    ...makeDuplicateDataUrlProject().scenes[1],
    backgroundData: 'data:image/png;base64,c2Vjb25k',
    backgroundName: 'Same Name.png',
  }],
});

const zipFiles = (zip) => Object.keys(zip.files);

describe('export asset bundler offline assets', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the default online behavior without fetching remote URLs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { zip, exportedProject } = await buildWithZip(makeRemoteProject());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(exportedProject.assets[0].url).toBe(remotePngUrl);
    expect(exportedProject.scenes[0].backgroundData).toBe(remotePngUrl);
    expect(exportedProject.scenes[0].musicData).toBe(remoteAudioUrl);
    expect(zip.file('jeu-exporte/offline-assets-report.json')).toBeNull();
  });

  it('fetches remote assets, adds them to the zip and rewrites Supabase URLs when enabled', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === remotePngUrl) return makeResponse('png-bytes', { contentType: 'image/png' });
      if (url === remoteAudioUrl) return makeResponse('mp3-bytes', { contentType: 'audio/mpeg' });
      if (url === remoteWebpUrl) return makeResponse('webp-bytes');
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { zip, exportedProject } = await buildWithZip(makeRemoteProject(), { exportOfflineAssets: true });
    const files = zipFiles(zip);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(exportedProject.assets[0].url).toMatch(/^assets\/images\/remote-background-png-[a-f0-9]{8}\.png$/);
    expect(exportedProject.scenes[0].backgroundData).toBe(exportedProject.assets[0].url);
    expect(exportedProject.scenes[0].musicData).toMatch(/^assets\/audio\/theme-[a-f0-9]{8}\.mp3$/);
    expect(exportedProject.enigmas[0].popupBackgroundData).toMatch(/^assets\/enigmas\/intro-poster-[a-f0-9]{8}\.webp$/);
    expect(files).toContain(`jeu-exporte/${exportedProject.assets[0].url}`);
    expect(files).toContain(`jeu-exporte/${exportedProject.scenes[0].musicData}`);
    expect(files).toContain(`jeu-exporte/${exportedProject.enigmas[0].popupBackgroundData}`);
    expect(zip.file('jeu-exporte/offline-assets-report.json')).toBeNull();
  });

  it('keeps data URLs bundling while offline remote assets are enabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse('remote-bytes', { contentType: 'image/png' })));

    const { zip, exportedProject } = await buildWithZip(makeRemoteProject(), { exportOfflineAssets: true });

    expect(exportedProject.items[0].imageData).toBe('assets/items/key-png.png');
    expect(await zip.file('jeu-exporte/assets/items/key-png.png').async('string')).toBe('key');
  });

  it('exports the same data URL once and rewrites every JSON reference to the first asset path', async () => {
    const { zip, exportedProject } = await buildWithZip(makeDuplicateDataUrlProject());
    const files = zipFiles(zip).filter((file) => file.startsWith('jeu-exporte/assets/scenes/') && file.endsWith('.png'));

    expect(files).toEqual(['jeu-exporte/assets/scenes/shared-png.png']);
    expect(exportedProject.scenes[0].backgroundData).toBe('assets/scenes/shared-png.png');
    expect(exportedProject.scenes[1].backgroundData).toBe(exportedProject.scenes[0].backgroundData);
    expect(await zip.file('jeu-exporte/assets/scenes/shared-png.png').async('string')).toBe('shared');
  });

  it('keeps distinct data URLs with the same preferred name as distinct files', async () => {
    const { zip, exportedProject } = await buildWithZip(makeDistinctDataUrlProject());
    const files = zipFiles(zip).filter((file) => file.startsWith('jeu-exporte/assets/scenes/') && file.endsWith('.png'));

    expect(files).toEqual([
      'jeu-exporte/assets/scenes/same-name-png.png',
      'jeu-exporte/assets/scenes/same-name-png-2.png',
    ]);
    expect(exportedProject.scenes[0].backgroundData).toBe('assets/scenes/same-name-png.png');
    expect(exportedProject.scenes[1].backgroundData).toBe('assets/scenes/same-name-png-2.png');
    expect(await zip.file('jeu-exporte/assets/scenes/same-name-png.png').async('string')).toBe('first');
    expect(await zip.file('jeu-exporte/assets/scenes/same-name-png-2.png').async('string')).toBe('second');
  });

  it('keeps failed remote URLs and writes offline-assets-report.json', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === remotePngUrl) return makeResponse('missing', { ok: false, status: 404, statusText: 'Not Found' });
      return makeResponse('ok', { contentType: 'audio/mpeg' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { zip, exportedProject } = await buildWithZip(makeRemoteProject(), { exportOfflineAssets: true });
    const report = JSON.parse(await zip.file('jeu-exporte/offline-assets-report.json').async('string'));

    expect(exportedProject.assets[0].url).toBe(remotePngUrl);
    expect(exportedProject.scenes[0].backgroundData).toBe(remotePngUrl);
    expect(report).toEqual({
      warnings: [{
        url: remotePngUrl,
        paths: ['assets[0].url', 'scenes[0].backgroundData'],
        message: 'Not Found',
        status: 404,
      }],
    });
  });

  it('keeps remote URLs and writes a warning when a remote fetch times out', async () => {
    let fetchSignal = null;
    const fetchMock = vi.fn((_url, init) => {
      fetchSignal = init?.signal || null;
      return new Promise(() => {});
    });
    vi.stubGlobal('fetch', fetchMock);

    const { zip, exportedProject } = await buildWithZip(makeSingleRemoteProject(), {
      exportOfflineAssets: true,
      offlineAssetFetchTimeoutMs: 1,
    });
    const report = JSON.parse(await zip.file('jeu-exporte/offline-assets-report.json').async('string'));

    expect(fetchSignal?.aborted).toBe(true);
    expect(exportedProject.scenes[0].backgroundData).toBe(remotePngUrl);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toMatchObject({
      url: remotePngUrl,
      paths: ['scenes[0].backgroundData'],
      message: 'Remote asset request timed out after 1 ms.',
    });
  });

  it('keeps remote URLs and writes a warning when arrayBuffer fails', async () => {
    const arrayBuffer = vi.fn(async () => {
      throw new Error('stream failed');
    });
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse('broken', { arrayBuffer, contentType: 'image/png' })));

    const { zip, exportedProject } = await buildWithZip(makeSingleRemoteProject(), { exportOfflineAssets: true });
    const report = JSON.parse(await zip.file('jeu-exporte/offline-assets-report.json').async('string'));

    expect(arrayBuffer).toHaveBeenCalledTimes(1);
    expect(exportedProject.scenes[0].backgroundData).toBe(remotePngUrl);
    expect(report.warnings).toEqual([{
      url: remotePngUrl,
      paths: ['scenes[0].backgroundData'],
      message: 'stream failed',
    }]);
  });

  it('skips arrayBuffer and keeps the remote URL when Content-Length exceeds the offline limit', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse('too-large', {
      arrayBuffer,
      contentLength: 2048,
      contentType: 'image/png',
    })));

    const { zip, exportedProject } = await buildWithZip(makeSingleRemoteProject(), {
      exportOfflineAssets: true,
      offlineAssetMaxBytes: 1024,
    });
    const report = JSON.parse(await zip.file('jeu-exporte/offline-assets-report.json').async('string'));

    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(exportedProject.scenes[0].backgroundData).toBe(remotePngUrl);
    expect(report.warnings).toEqual([{
      url: remotePngUrl,
      paths: ['scenes[0].backgroundData'],
      message: 'Remote asset is too large (2048 bytes, limit 1024 bytes).',
    }]);
  });

  it('keeps signed URLs in project.json but redacts sensitive query params in the offline report', async () => {
    const signedUrl = 'https://project.supabase.co/storage/v1/object/sign/game-media/signed.png?token=secret-token&signature=secret-signature&expires=999999&access_token=secret-access&refresh_token=secret-refresh&key=secret-key&apikey=secret-apikey&safe=visible';
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse('forbidden', {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })));

    const { zip, exportedProject } = await buildWithZip(makeSingleRemoteProject(signedUrl), { exportOfflineAssets: true });
    const report = JSON.parse(await zip.file('jeu-exporte/offline-assets-report.json').async('string'));
    const reportText = JSON.stringify(report);

    expect(exportedProject.scenes[0].backgroundData).toBe(signedUrl);
    expect(report.warnings[0].url).toContain('safe=visible');
    [
      'token',
      'signature',
      'expires',
      'access_token',
      'refresh_token',
      'key',
      'apikey',
    ].forEach((paramName) => {
      expect(report.warnings[0].url).toContain(`${paramName}=[redacted]`);
    });
    [
      'secret-token',
      'secret-signature',
      '999999',
      'secret-access',
      'secret-refresh',
      'secret-key',
      'secret-apikey',
    ].forEach((secretValue) => {
      expect(reportText).not.toContain(secretValue);
    });
  });

  it('downloads the same remote URL once and rewrites every reference to one local file', async () => {
    const fetchMock = vi.fn(async () => makeResponse('png-bytes', { contentType: 'image/png' }));
    vi.stubGlobal('fetch', fetchMock);

    const { zip, exportedProject } = await buildWithZip(makeRemoteProject(), { exportOfflineAssets: true });
    const files = zipFiles(zip).filter((file) => file.includes('/remote-background-png-'));

    expect(fetchMock.mock.calls.filter(([url]) => url === remotePngUrl)).toHaveLength(1);
    expect(exportedProject.assets[0].url).toBe(exportedProject.scenes[0].backgroundData);
    expect(files).toHaveLength(1);
  });

  it('uses stable names without timestamps', async () => {
    const fetchMock = vi.fn(async () => makeResponse('png-bytes', { contentType: 'image/png' }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await buildWithZip(makeRemoteProject(), { exportOfflineAssets: true });
    const second = await buildWithZip(makeRemoteProject(), { exportOfflineAssets: true });

    expect(first.exportedProject.assets[0].url).toBe(second.exportedProject.assets[0].url);
    expect(first.exportedProject.assets[0].url).toMatch(/^assets\/images\/remote-background-png-[a-f0-9]{8}\.png$/);
  });
});
