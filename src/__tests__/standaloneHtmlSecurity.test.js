import { describe, expect, it } from 'vitest';
import { buildStandaloneModuleFiles } from '../utils/standaloneHtml';

const makeProject = (scene = {}) => ({
  title: 'Projet export',
  acts: [],
  scenes: [{
    id: 'scene-1',
    name: 'Salle',
    hotspots: [],
    sceneObjects: [],
    ...scene,
  }],
  items: [],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
});

const getEngineJs = (project = makeProject()) => buildStandaloneModuleFiles(project).engineJs;

const getSecurityHelpers = () => {
  const engineJs = getEngineJs();
  const start = engineJs.indexOf('function safeHtml');
  const end = engineJs.indexOf('function clampPercent');
  const helperSource = engineJs.slice(start, end);
  const loadHelpers = new Function(`${helperSource}; return { safeMediaUrl, escapeMediaAttr, cssMediaUrl };`);
  return loadHelpers();
};

const expectRenderUsesEscapedMediaUrls = () => {
  const engineJs = getEngineJs();

  expect(engineJs).toContain("src=\"' + escapeMediaAttr(playSceneBackgroundUrl, 'image') + '\"");
  expect(engineJs).toContain("src=\"' + escapeMediaAttr(displayImage, 'image') + '\"");
  expect(engineJs).toContain("src=\"' + escapeMediaAttr(viewerImageSrc, 'image') + '\"");
  expect(engineJs).toContain("background-image:' + cssMediaUrl(imageData, 'image')");
};

describe('standalone HTML media URL safety', () => {
  it('blocks unsafe media protocols before HTML attribute rendering', () => {
    const { safeMediaUrl, escapeMediaAttr } = getSecurityHelpers();

    expect(safeMediaUrl('javascript:alert(1)" onerror="window.__pwned=1')).toBe('');
    expect(safeMediaUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeMediaUrl('data:audio/mpeg;base64,AAAA', 'audio')).toBe('');
    expect(escapeMediaAttr('javascript:alert(1)" onerror="window.__pwned=1')).toBe('');
  });

  it('keeps internal asset paths, HTTPS URLs, and data image URLs', () => {
    const { safeMediaUrl } = getSecurityHelpers();

    expect(safeMediaUrl('assets/images/scene.png')).toBe('assets/images/scene.png');
    expect(safeMediaUrl('./assets/images/scene.png')).toBe('./assets/images/scene.png');
    expect(safeMediaUrl('data:image/png;base64,aW1hZ2U=')).toBe('data:image/png;base64,aW1hZ2U=');
    expect(safeMediaUrl('https://cdn.example.test/scene.png')).toBe('https://cdn.example.test/scene.png');
  });

  it('escapes allowed HTTPS media URLs before innerHTML injection', () => {
    const { escapeMediaAttr } = getSecurityHelpers();

    const escaped = escapeMediaAttr('https://cdn.example.test/scene.png?name=" onerror="alert(1)');

    expect(escaped).toContain('https://cdn.example.test/scene.png');
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain('" onerror=');
  });

  it('uses the media escaping helpers in generated innerHTML and CSS URL sinks', () => {
    expectRenderUsesEscapedMediaUrls();
  });
});
