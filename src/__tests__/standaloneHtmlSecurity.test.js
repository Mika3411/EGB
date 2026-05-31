import { describe, expect, it } from 'vitest';
import { buildStandaloneHtml, buildStandaloneModuleFiles } from '../utils/standaloneHtml';
import { buildStandaloneCss } from '../utils/standalone/standaloneCss';

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
  const loadHelpers = new Function(`${helperSource}; return { safeMediaUrl, escapeMediaAttr, cssMediaUrl, cssNumber, cssPercent, safeStylePercent, safeSceneObjectPositionPercent, safeSceneObjectSizePercent, getLayerZIndex, safeCssColor, safeClassToken, safeDataAttr };`);
  return loadHelpers();
};

const expectRenderUsesEscapedMediaUrls = () => {
  const engineJs = getEngineJs();

  expect(engineJs).toContain("src=\"' + escapeMediaAttr(playSceneBackgroundUrl, 'image') + '\"");
  expect(engineJs).toContain("src=\"' + escapeMediaAttr(displayImage, 'image') + '\"");
  expect(engineJs).toContain("src=\"' + escapeMediaAttr(viewerImageSrc, 'image') + '\"");
  expect(engineJs).toContain("background-image:' + cssMediaUrl(imageData, 'image')");
};

const expectDynamicDataAttributesUseSafeDataAttr = () => {
  const engineJs = getEngineJs();

  [
    "data-hotspot-id=\"' + safeDataAttr(spot.id) + '\"",
    "data-scene-object-id=\"' + safeDataAttr(obj.id) + '\"",
    "data-item-id=\"' + safeDataAttr(itemId) + '\"",
    "data-hero-select=\"' + safeDataAttr(activeChoice.id || '') + '\"",
    "data-conversation-reply=\"' + safeDataAttr(reply.id) + '\"",
    "data-effect-index=\"' + safeDataAttr(index) + '\"",
    "data-code-index=\"' + safeDataAttr(index) + '\"",
    "data-code-key=\"' + safeDataAttr(key) + '\"",
    "data-code-length=\"' + safeDataAttr(codeLength) + '\"",
    "data-misc-choice=\"' + safeDataAttr(choice) + '\"",
    "data-misc-order=\"' + safeDataAttr(choice) + '\"",
    "data-misc-order-remove=\"' + safeDataAttr(index) + '\"",
    "data-misc-match-left=\"' + safeDataAttr(pair.left || '') + '\"",
    "data-misc-toggle=\"' + safeDataAttr(choice) + '\"",
    "data-puzzle-index=\"' + safeDataAttr(index) + '\"",
    "data-rotation-index=\"' + safeDataAttr(index) + '\"",
    "data-slot-index=\"' + safeDataAttr(slotIndex) + '\"",
    "data-bank-piece=\"' + safeDataAttr(pieceIndex) + '\"",
  ].forEach((expectedSource) => {
    expect(engineJs).toContain(expectedSource);
  });
};

const expectDynamicClassTokensUseSafeClassToken = () => {
  const engineJs = getEngineJs();

  [
    "player-button-style-' + safeClassToken(PLAYER_BUTTON_STYLE, 'modern')",
    "player-button-font-' + safeClassToken(PLAYER_BUTTON_FONT, 'system')",
    "player-narration-font-' + safeClassToken(PLAYER_NARRATION_FONT, 'system')",
    "scene-visual-effect--' + safeClassToken(playScene.visualEffect, 'none')",
    "scene-visual-effect--' + safeClassToken(zone.effect || 'sparkles', 'sparkles')",
    "anime2d-preset-' + safeClassToken(layer.preset || 'none', 'none')",
    "hero-combat-actor--' + safeClassToken(actor, 'actor')",
    "hero-combat-dice-spotlight--' + safeClassToken(combatRollActor, 'hero')",
    "hero-combat-dice-spotlight--target-' + safeClassToken(combatRollTarget, 'enemy')",
    "safeClassToken(replyColumnClass, 'conversation-player-replies-1')",
    "choice-effect-' + safeClassToken(notice.type || 'effect', 'effect')",
    "ending-card-' + safeClassToken(ending.type || 'neutral', 'neutral')",
  ].forEach((expectedSource) => {
    expect(engineJs).toContain(expectedSource);
  });
};

describe('standalone HTML media URL safety', () => {
  it('blocks unsafe media protocols before HTML attribute rendering', () => {
    const { safeMediaUrl, escapeMediaAttr } = getSecurityHelpers();

    expect(safeMediaUrl('javascript:alert(1)" onerror="window.__pwned=1')).toBe('');
    expect(safeMediaUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeMediaUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe('');
    expect(safeMediaUrl('data:image/svg+xml;charset=utf-8,<svg onload=alert(1)>')).toBe('');
    expect(safeMediaUrl('data:audio/mpeg;base64,AAAA', 'audio')).toBe('');
    expect(escapeMediaAttr('javascript:alert(1)" onerror="window.__pwned=1')).toBe('');
  });

  it('keeps internal asset paths, HTTPS URLs, and data image URLs', () => {
    const { safeMediaUrl } = getSecurityHelpers();
    const svgDataUrl = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M0%200h1v1H0z%22%2F%3E%3C%2Fsvg%3E';

    expect(safeMediaUrl('assets/images/scene.png')).toBe('assets/images/scene.png');
    expect(safeMediaUrl('./assets/images/scene.png')).toBe('./assets/images/scene.png');
    expect(safeMediaUrl('data:image/png;base64,aW1hZ2U=')).toBe('data:image/png;base64,aW1hZ2U=');
    expect(safeMediaUrl(svgDataUrl)).toBe(svgDataUrl);
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

  it('does not emit inline event handlers in generated runtime HTML', () => {
    const engineJs = getEngineJs();

    expect(engineJs).not.toContain(' onload="');
    expect(engineJs).not.toContain(' onerror="');
    expect(engineJs).not.toContain(' onclick="');
  });

  it('keeps standalone event bindings and critical selectors in generated engine', () => {
    const engineJs = getEngineJs();

    expect(engineJs.match(/function bindEvents\(\)/g)).toHaveLength(1);
    expect(engineJs).toContain('bindEvents();');
    [
      '[data-hotspot-id]',
      '[data-scene-object-id]',
      '[data-item-id]',
      '[data-conversation-reply]',
      '#submit-enigma',
      '#hero-combat-action',
    ].forEach((selector) => {
      expect(engineJs).toContain(selector);
    });
  });

  it('binds repeated player controls without duplicate runtime IDs', () => {
    const engineJs = getEngineJs();

    [
      "root.querySelectorAll('#save-game, [data-player-action=\"save-game\"]')",
      "root.querySelectorAll('#load-game, [data-player-action=\"load-game\"]')",
      "root.querySelectorAll('#open-inventory-drawer, [data-player-action=\"open-inventory-drawer\"]')",
      "root.querySelectorAll('#close-inventory-drawer, [data-player-action=\"close-inventory-drawer\"]')",
      'data-player-action="save-game"',
      'data-player-action="load-game"',
      'data-player-action="open-inventory-drawer"',
      'data-player-action="close-inventory-drawer"',
    ].forEach((expectedSource) => {
      expect(engineJs).toContain(expectedSource);
    });

    ['save-game', 'load-game', 'open-inventory-drawer', 'close-inventory-drawer'].forEach((id) => {
      expect(engineJs.match(new RegExp(`id="${id}"`, 'g')) || []).toHaveLength(1);
    });
  });

  it('keeps enigma action buttons visible when fullscreen hides inventory controls', () => {
    const styleCss = buildStandaloneCss();

    expect(styleCss).toContain('body.game-fullscreen .inventory-actions{display:none}');
    expect(styleCss).toContain('#enigma-overlay .inventory-actions,#enigma-overlay .enigma-actions{display:flex}');
    expect(styleCss.indexOf('body.game-fullscreen .inventory-actions{display:none}'))
      .toBeLessThan(styleCss.indexOf('#enigma-overlay .inventory-actions,#enigma-overlay .enigma-actions{display:flex}'));
  });

  it('renders the hidden JSON save import file input used by the import button', () => {
    const engineJs = getEngineJs();

    expect(engineJs).toContain('<input id="import-save-file" type="file" accept=".json,application/json" hidden />');
    expect(engineJs).toContain("document.getElementById('import-save-json')?.addEventListener('click', () => document.getElementById('import-save-file')?.click())");
    expect(engineJs).toContain("document.getElementById('import-save-file')?.addEventListener('change'");
  });

  it('keeps the standalone runtime order and renderer surface stable', () => {
    const moduleFiles = buildStandaloneModuleFiles(makeProject({ backgroundData: 'assets/scenes/review-hall.png' }));
    const { engineJs } = moduleFiles;
    const orderedMarkers = [
      'function getProjectItem(',
      'function bindEvents()',
      'function renderCinematic(',
      'function renderEnigma(',
      'function renderConversationPortrait(',
      'function renderHeroCombatOverlay(',
      'function renderHeroSetupOverlay(',
      'function renderPlayerShell(',
      'function render(shouldSave = true)',
    ];
    const rendererMarkers = [
      'function renderPlayerShell(',
      'function renderPlayerTopbar(',
      'function renderSceneLayer(',
      'function renderSceneBackground(',
      'function renderVisualEffectZones(',
      'function renderHotspots(',
      'function renderSceneObjects(',
      'function renderInlineViewer(',
      'function renderActPreload(',
      'function renderNarrationBar(',
      'function renderInventoryTile(',
      'function renderInventoryGrid(',
      'function renderInventoryDrawer(',
      'function renderFullscreenHud(',
      'function renderHeroCombatOverlay(',
      'function renderHeroSetupOverlay(',
      'function renderCinematic(',
    ];

    expect(buildStandaloneHtml.length).toBe(1);
    expect(buildStandaloneModuleFiles.length).toBe(1);
    expect(Object.keys(moduleFiles)).toEqual(['indexHtml', 'engineJs', 'styleCss']);
    expect(moduleFiles.indexHtml).toContain('<script src="./engine.js"></script>');
    expect(moduleFiles.indexHtml).toContain('<link rel="stylesheet" href="./style.css">');
    expect(moduleFiles.indexHtml).not.toContain('<style>');
    expect(moduleFiles.styleCss).toBe(buildStandaloneCss());
    expect(engineJs).toContain('const project =');
    expect(engineJs).toContain('assets/scenes/review-hall.png');
    expect(engineJs).not.toContain('fetch(');
    expect(engineJs).not.toContain('project.json');
    const legacyHtml = buildStandaloneHtml(makeProject());
    expect(legacyHtml).toContain('<style>');
    expect(legacyHtml).not.toContain('<link rel="stylesheet" href="./style.css">');
    const markerIndexes = orderedMarkers.map((marker) => engineJs.indexOf(marker));
    const missingMarkers = orderedMarkers.filter((_, markerIndex) => markerIndexes[markerIndex] < 0);

    expect(missingMarkers).toEqual([]);
    orderedMarkers.reduce((previousIndex, marker) => {
      const markerIndex = engineJs.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(previousIndex);
      return markerIndex;
    }, -1);
    rendererMarkers.forEach((marker) => {
      expect(engineJs).toContain(marker);
    });
  });

  it('normalizes project-controlled inline CSS values before rendering', () => {
    const {
      cssNumber,
      cssPercent,
      safeStylePercent,
      safeSceneObjectPositionPercent,
      safeSceneObjectSizePercent,
      getLayerZIndex,
      safeCssColor,
      safeClassToken,
      safeDataAttr,
    } = getSecurityHelpers();

    expect(cssPercent('12;left:999', 0)).toBe('0');
    expect(safeStylePercent('12;left:999', 0)).toBe('0%');
    expect(cssPercent(250, 0)).toBe('100');
    expect(safeSceneObjectPositionPercent(-25, 0)).toBe('-25%');
    expect(safeSceneObjectPositionPercent(125, 0)).toBe('125%');
    expect(safeSceneObjectSizePercent(250, 10)).toBe('250%');
    expect(safeSceneObjectSizePercent(-5, 10)).toBe('0%');
    expect(safeSceneObjectSizePercent('12;left:999', 10)).toBe('10%');
    expect(getLayerZIndex({ zIndex: 42 }, 'sceneObject')).toBe('42');
    expect(cssNumber(-99999, 0, -10, 10)).toBe('-10');
    expect(safeCssColor('rgba(120, 83, 36, .74)', 'fallback')).toBe('rgba(120, 83, 36, .74)');
    expect(safeCssColor('#123abc', 'fallback')).toBe('#123abc');
    expect(safeCssColor('292 66% 24%', 'fallback')).toBe('292 66% 24%');
    expect(safeCssColor('red;background:url(https://evil.example/x)', 'fallback')).toBe('fallback');
    expect(safeCssColor('url(https://evil.example/x)', 'fallback')).toBe('fallback');
    expect(safeClassToken('scene-fade_01', 'fallback')).toBe('scene-fade_01');
    expect(safeClassToken('fade danger', 'fallback')).toBe('fallback');
    expect(safeClassToken('"><img', 'fallback')).toBe('fallback');
    expect(safeDataAttr('id" onload="alert(1)')).toBe('id&quot; onload=&quot;alert(1)');
  });

  it('uses CSS and attribute escaping helpers for project-controlled render sinks', () => {
    const engineJs = getEngineJs();

    expect(engineJs).toContain('safeCssColor(project?.ui?.narrationBackground');
    expect(engineJs).toContain('safeStylePercent(zone.x, 0)');
    expect(engineJs).toContain('safeStylePercent(spot.x, 0)');
    expect(engineJs).toContain('safeSceneObjectPositionPercent(obj.x, 0)');
    expect(engineJs).toContain('safeSceneObjectPositionPercent(obj.y, 0)');
    expect(engineJs).toContain('safeSceneObjectSizePercent(obj.width, 10)');
    expect(engineJs).toContain('safeSceneObjectSizePercent(obj.height, 10)');
    expect(engineJs).toContain("getLayerZIndex(obj, 'sceneObject')");
    expect(engineJs).toContain('cssNumber(sceneAspectRatio, 1.6, 0.1, 10)');
    expect(engineJs).toContain('cssNumber(layer.x, 50, -1000, 1000)');
    expect(engineJs).toContain('safeStylePercent(enigma.popupBackgroundX, 50)');
    expect(engineJs).toContain('safeStylePercent(enigma.popupBackgroundY, 50)');
    expect(engineJs).toContain('cssNumber(safeCols * 100, 100, 1, 10000)');
    expect(engineJs).toContain('safeStylePercent(safeCols === 1 ? 0');
    expect(engineJs).toContain('cssNumber(rotation, 0, -3600, 3600)');
    expect(engineJs).toContain('cssNumber(cols, 3, 1, 24)');
    expect(engineJs).toContain("title=\"' + escapeAttr(spot.name || '') + '\"");
    expect(engineJs).toContain("title=\"' + escapeAttr(obj.name || 'Objet') + '\"");
    expect(engineJs).toContain("aria-label=\"' + escapeAttr(obj.name || 'Objet invisible') + '\"");
    expect(engineJs).toContain("aria-label=\"Chargement ' + escapeAttr(cssPercent(state.actPreload.progress, 0)) + '%\"");
    expect(engineJs).toContain("title=\"' + escapeAttr(formatCombatStatusBadge(effect)) + '\"");
    expect(engineJs).toContain("title=\"' + escapeAttr(health + '/' + maxHealth + ' PV') + '\"");
    expect(engineJs).toContain("title=\"' + escapeAttr(mana + '/' + maxMana + ' mana') + '\"");
    expect(engineJs).toContain("class=\"' + escapeAttr(primaryActionClass) + '\"");
    expect(engineJs).toContain("x=\"' + escapeAttr(x) + '\" y=\"' + escapeAttr(y) + '\"");
    expect(engineJs).toContain("value=\"' + escapeAttr(char) + '\"");
    expect(engineJs).toContain("value=\"' + escapeAttr(state.enigmaCodeInput) + '\"");
    expectDynamicDataAttributesUseSafeDataAttr();
    expectDynamicClassTokensUseSafeClassToken();
  });

  it('sanitizes enigma colors before inline style rendering', () => {
    const engineJs = getEngineJs();

    expect(engineJs).toContain("safeCssColor(color, 'transparent')");
    expect(engineJs).toContain("safeCssColor(value, 'transparent')");
    expect(engineJs).toContain("safeCssColor(tone, '260 66% 24%')");
    expect(engineJs).toContain("safeCssColor(face[4], '260 66% 24%')");
    expect(engineJs).toContain("data-enigma-color=\"' + safeDataAttr(value) + '\"");
    expect(engineJs).toContain("data-simon-color=\"' + safeDataAttr(value) + '\"");
  });

  it('routes generated background-image URLs through CSS media escaping', () => {
    const engineJs = getEngineJs();

    [
      "background-image:' + cssMediaUrl(imageData, 'image')",
      "cssMediaUrl(enigmaPopupBackgroundUrl, 'image')",
      "cssMediaUrl(backgroundImageData, 'image')",
      "cssMediaUrl(setupBackgroundImageData, 'image')",
    ].forEach((expectedSource) => {
      expect(engineJs).toContain(expectedSource);
    });

    expect(engineJs).not.toContain("background-image:linear-gradient(180deg,rgba(8,16,30,.44),rgba(8,16,30,.74)),url(' + escapeAttr");
  });

  it('escapes project serialization before inline script extraction', () => {
    const payload = '</script><img src=x onerror=alert(1)>';
    const html = buildStandaloneHtml(makeProject({ name: payload }));
    const scriptStart = html.indexOf('<script>');
    const scriptEnd = html.lastIndexOf('</script>');
    const inlineScript = html.slice(scriptStart + '<script>'.length, scriptEnd);

    expect(inlineScript).toContain('<\\/script><img src=x onerror=alert(1)>');
    expect(inlineScript).not.toContain('</script><img src=x onerror=alert(1)>');
  });
});
