const endpoint = import.meta.env.VITE_AI_IMAGE_ENDPOINT || '/api/image';

const makeAiHeaders = (userId) => ({
  'Content-Type': 'application/json',
  ...(userId ? { 'X-AI-User-Id': userId } : {}),
});

const svgDataUrl = (title, subtitle, hue = 218) => {
  const safeTitle = String(title || 'Image IA').slice(0, 42);
  const safeSubtitle = String(subtitle || 'Escape game').slice(0, 70);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 58%, 12%)"/>
      <stop offset="0.55" stop-color="hsl(${(hue + 34) % 360}, 48%, 20%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 76) % 360}, 46%, 10%)"/>
    </linearGradient>
    <radialGradient id="light" cx="68%" cy="24%" r="44%">
      <stop offset="0" stop-color="rgba(255,255,255,.24)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect width="1280" height="720" fill="url(#light)"/>
  <path d="M0 560 C180 505 310 610 480 560 C680 498 835 642 1030 566 C1140 523 1212 520 1280 548 L1280 720 L0 720 Z" fill="rgba(0,0,0,.28)"/>
  <rect x="74" y="72" width="1132" height="576" rx="28" fill="rgba(2,6,23,.22)" stroke="rgba(255,255,255,.16)" stroke-width="2"/>
  <text x="110" y="552" fill="#f8fbff" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="54" font-weight="800">${safeTitle}</text>
  <text x="112" y="606" fill="#cbd5e1" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="26">${safeSubtitle}</text>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const parseImageResponse = (payload) => {
  if (!payload) throw new Error('Réponse image vide.');
  const imageData = payload.imageData || payload.dataUrl || payload.url || payload.image?.dataUrl || payload.image?.url;
  if (!imageData) throw new Error('Réponse image sans imageData.');
  return {
    imageData,
    imageName: payload.imageName || payload.name || 'image-ia.png',
    elements: Array.isArray(payload.elements) ? payload.elements : [],
  };
};

const correctionSettings = {
  subtle: { gamma: 0.82, liftBase: 0.18, brightness: 0.015, contrast: 1.06, saturation: 1.02 },
  balanced: { gamma: 0.74, liftBase: 0.28, brightness: 0.025, contrast: 1.1, saturation: 1.03 },
  strong: { gamma: 0.66, liftBase: 0.38, brightness: 0.035, contrast: 1.12, saturation: 1.02 },
};

const enhanceSceneImage = async (imageData, level = 'balanced') => {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return imageData;
  if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) return imageData;
  if (level === 'none') return imageData;
  const settings = correctionSettings[level] || correctionSettings.balanced;

  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });
  image.src = imageData;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return imageData;

  context.drawImage(image, 0, 0);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index] / 255;
    const g = data[index + 1] / 255;
    const b = data[index + 2] / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const shadowLift = Math.max(0, 0.42 - luminance) * settings.liftBase;
    const adjust = (channel) => {
      const lifted = Math.pow(channel, settings.gamma) + shadowLift + settings.brightness;
      const contrasted = ((lifted - 0.5) * settings.contrast) + 0.5;
      return Math.max(0, Math.min(1, contrasted));
    };

    data[index] = Math.round(adjust(r) * 255);
    data[index + 1] = Math.round(adjust(g) * 255);
    data[index + 2] = Math.round(adjust(b) * 255);
  }

  context.putImageData(frame, 0, 0);
  return canvas.toDataURL('image/png', 0.94);
};

const formatConstraints = (constraints) => String(constraints || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => (line.startsWith('-') ? line : `- ${line}`))
  .join('\n');

const relationFromHotspot = (hotspot, targetSceneName) => {
  const label = `${hotspot?.name || ''} ${hotspot?.dialogue || ''}`.toLowerCase();
  if (label.includes('droite')) return `porte à droite vers ${targetSceneName}`;
  if (label.includes('gauche')) return `porte à gauche vers ${targetSceneName}`;
  if (label.includes('arrière') || label.includes('fond')) return `passage arrière vers ${targetSceneName}`;
  if (label.includes('escalier')) return `escalier vers ${targetSceneName}`;
  return `${hotspot?.name || 'passage'} vers ${targetSceneName}`;
};

export const buildGlobalSceneLayout = (project = {}) => {
  const scenes = project.scenes || [];
  return scenes.reduce((layout, scene) => {
    const links = {};
    (scene.hotspots || []).forEach((hotspot) => {
      if (!hotspot.targetSceneId) return;
      const target = scenes.find((entry) => entry.id === hotspot.targetSceneId);
      if (!target) return;
      const relation = relationFromHotspot(hotspot, target.name);
      if (relation.includes('droite')) links.right = target.name;
      else if (relation.includes('gauche')) links.left = target.name;
      else if (relation.includes('arrière')) links.back = target.name;
      else links[hotspot.name || target.name] = target.name;
    });
    layout[scene.name] = links;
    return layout;
  }, {});
};

export const getConnectedScenes = (project = {}, scene = {}) => {
  const scenes = project.scenes || [];
  return (scene.hotspots || [])
    .filter((hotspot) => hotspot.targetSceneId)
    .map((hotspot) => {
      const target = scenes.find((entry) => entry.id === hotspot.targetSceneId);
      if (!target) return null;
      return {
        name: target.name,
        relation: relationFromHotspot(hotspot, target.name),
      };
    })
    .filter(Boolean);
};

const inferElementsFromConstraints = (constraints) => formatConstraints(constraints)
  .split('\n')
  .map((line, index) => {
    const text = line.replace(/^-\s*/, '');
    const lower = text.toLowerCase();
    const x = lower.includes('droite') ? 84 : lower.includes('gauche') ? 18 : lower.includes('centre') ? 50 : 28 + ((index * 22) % 48);
    const y = lower.includes('table') ? 62 : lower.includes('fenêtre') ? 36 : lower.includes('porte') ? 50 : 44 + ((index * 12) % 30);
    const width = lower.includes('table') ? 30 : lower.includes('porte') ? 12 : lower.includes('fenêtre') ? 18 : 14;
    const height = lower.includes('porte') ? 40 : lower.includes('table') ? 20 : lower.includes('fenêtre') ? 24 : 12;
    return {
      id: text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `element_${index + 1}`,
      label: text.replace(/^(une?|la|le|des?)\s+/i, ''),
      x,
      y,
      width,
      height,
    };
  })
  .filter((entry) => entry.label);

const buildPrompt = ({ type, entity, projectTitle, visualConstraints, visualContext, variant }) => {
  if (type === 'item') {
    const isThumbnail = variant === 'thumbnail';
    return `
Objet d'inventaire pour un escape game: ${entity?.name}.
Style lisible, isolé, iconique, cohérent avec "${projectTitle}".
Style d'image: ${visualContext?.style || 'rendu cohérent avec le projet'}.

Contraintes obligatoires:
- PNG détouré sur fond transparent avec canal alpha.
- Un seul objet au centre, entier, sans recadrage.
- Format ${isThumbnail ? 'miniature carrée simple, détails réduits, lisible en 64x64 pixels' : 'objet complet plus détaillé'}.
- Aucun décor, aucune table, aucun mur, aucune pièce, aucun support.
- Aucun texte, aucun logo, aucune étiquette lisible.
- Ne pas dessiner de carré blanc, gris, noir ou coloré derrière l'objet.
- Ombre douce autorisée uniquement si elle reste dans la transparence et ne crée pas un fond visible.
- L'image doit pouvoir être posée directement par-dessus une scène.
`.trim();
  }
  if (type === 'cinematic') {
    return `
Image cinématique 16:9 pour un escape game.

Cinématique: ${entity?.cinematicName || entity?.name || projectTitle || 'Cinématique'}
Slide: ${entity?.name || 'Slide'}
Narration: ${entity?.narration || 'Révélation narrative.'}
Thème global: ${visualContext?.globalTheme || projectTitle || 'escape game'}
Style visuel: ${visualContext?.style || 'réaliste, cinématographique, lisible, dramatique'}

Contraintes:
- Image large 16:9, composition cinématographique.
- Aucun texte incrusté dans l'image.
- Montrer la révélation, la transition ou l'ambiance décrite par la narration.
- Rester cohérent avec les scènes et objets du projet.
- Lumière lisible, détails visibles, pas d'image trop noire.
`.trim();
  }
  const safeStyle = String(visualContext?.style || 'réaliste, atmosphère mystérieuse mais clairement éclairée, caméra large, contraste suffisant pour un jeu cliquable')
    .replace(/\bsombre\b/gi, 'mystérieux')
    .replace(/\btrès noir\b/gi, 'lisible');
  const constraints = formatConstraints(visualConstraints);
  const connectedScenes = visualContext?.connectedScenes || [];
  const connectedText = connectedScenes.length ?
     connectedScenes.map((entry) => `- ${entry.relation}`).join('\n')
    : '- Aucune connexion explicite connue.';
  return ` ?
Tu génères une scène pour un escape game.

Scène actuelle: ${entity?.name}
Résumé narratif: ${entity?.introText || 'Scène interactive.'}
Thème global: ${visualContext?.globalTheme || projectTitle || 'escape game'}
Style visuel: ${safeStyle}, éclairage de jeu vidéo lisible, luminosité globale moyenne, pas de sous-exposition ?
Héritage visuel: ${visualContext?.visualInheritance || 'même époque, mêmes matériaux, mêmes portes, même lumière'}

Contraintes visuelles OBLIGATOIRES:
${constraints || '- Décor large et lisible permettant de placer des zones interactives.'}

Interdiction importante:
- Ne montre aucun objet d'inventaire dans l'image de scène, même s'il est mentionné par une zone, une récompense ou une condition. L'utilisateur doit pouvoir ajouter/cacher ces objets lui-même ensuite.
- Tu peux montrer les supports, meubles, cachettes, mécanismes, portes, tiroirs, boîtes, marques et indices non-inventaire, mais pas l'objet collectable lui-même.

La scène doit être cohérente avec les scènes adjacentes:
${connectedText}

Carte globale des pièces:
${JSON.stringify(visualContext?.layout || {}, null, 2)}

Chaque élément important doit être clairement visible et positionné logiquement dans l’image.
La caméra doit être large pour permettre l’interaction.
Ne crée pas de contradiction visuelle avec les pièces connectées.
Priorité UX absolue: l’image doit être utilisable comme écran de jeu. Exposition moyenne claire, détails visibles dans les ombres, aucun centre noir, aucun couloir ou arrière-plan complètement bouché. Ajoute une lumière d’appoint douce et diffuse si nécessaire, en plus des bougies, lampes ou ouvertures visibles. Même dans un tunnel ou une cave, les murs, le sol, les portes et le fond doivent rester visibles.
Les zones interactives doivent rester repérables au premier coup d’œil, avec silhouettes nettes, bords lisibles et contraste local. Une ambiance mystérieuse est autorisée, mais pas une image sous-exposée.
Évite absolument: image trop noire, noirs bouchés, grand tunnel noir au centre, objet important noyé dans l’ombre, vignettage excessif, flou décoratif. Le décor complet doit rester inspectable.

Réponse attendue de l'API image:
{
  "imageData": "data:image/...",
  "imageName": "scene.png",
  "elements": [
    { "id": "door", "label": "Porte", "x": 85, "y": 50, "width": 12, "height": 40 }
  ]
}
`.trim();
};

export async function generateAiImage({ type, entity, projectTitle, project, visualConstraints = '', visualContext = {}, regenerate = false, readabilityLevel = 'balanced', userId = '', variant = '' }) {
  const prompt = buildPrompt({ type, entity, projectTitle, visualConstraints, visualContext, variant });
  const elements = inferElementsFromConstraints(visualConstraints);
  if (endpoint) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: makeAiHeaders(userId),
      body: JSON.stringify({
        type,
        entity,
        userId,
        projectTitle,
        projectContext: project,
        visualConstraints,
        visualContext,
        prompt,
        regenerate,
        variant,
        responseFormat: 'escape-game-image-with-elements',
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload.error || `API image indisponible (${response.status}).`);
      error.status = response.status;
      error.code = payload.code;
      error.balance = payload.balance;
      error.required = payload.required;
      throw error;
    }
    const parsed = parseImageResponse(await response.json());
    return type === 'scene' ?
       { ...parsed, imageData: await enhanceSceneImage(parsed.imageData, readabilityLevel) }
      : parsed;
  }

  const hue = Array.from(String(entity?.id || entity?.name || type))
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return {
    imageData: svgDataUrl(entity?.name, type === 'item' ? 'Objet généré à la demande' : entity?.introText, hue),
    imageName: `${type}-${entity?.id || Date.now()}.svg`,
    elements,
    warning: 'API image non configurée: image de prévisualisation locale.',
  };
}
