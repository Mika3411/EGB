import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExportProjectWithAssets } from '../utils/exportAssetBundler';

const remotePngUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/remote-background.png';
const remoteWebpUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/remote-poster.webp?token=abc';
const remoteAudioUrl = 'https://project.supabase.co/storage/v1/object/public/game-media/theme';

const makeResponse = (body, { contentType = '', ok = true, status = 200, statusText = 'OK' } = {}) => ({
  ok,
  status,
  statusText,
  headers: {
    get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null),
  },
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
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
