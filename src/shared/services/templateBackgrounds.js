const TEMPLATE_BACKGROUND_WIDTH = 1672;
const TEMPLATE_BACKGROUND_HEIGHT = 941;
const TEMPLATE_BACKGROUND_ASPECT_RATIO = TEMPLATE_BACKGROUND_WIDTH / TEMPLATE_BACKGROUND_HEIGHT;

const makeGeneratedBackground = (path) => ({
  data: `/assets/generated/${path}`,
  name: path.split('/').pop(),
  width: TEMPLATE_BACKGROUND_WIDTH,
  height: TEMPLATE_BACKGROUND_HEIGHT,
  aspectRatio: TEMPLATE_BACKGROUND_ASPECT_RATIO,
});

const makeTemplateBackground = (templateId, name) => (
  makeGeneratedBackground(`templates/${templateId}/${name}`)
);

const makeTemplateItemImage = (templateId, name) => ({
  data: `/assets/generated/templates/${templateId}/${name}`,
  name,
});

const BACKGROUNDS = {
  prologueCover: makeGeneratedBackground('prologue-caverne/cover-caverne-merveilles.png'),
  souk: makeGeneratedBackground('prologue-caverne/scene-01-ruelle-souk.png'),
  desert: makeGeneratedBackground('prologue-caverne/scene-02-piste-sables.png'),
  caveDoor: makeGeneratedBackground('prologue-caverne/scene-03-devant-caverne.png'),
  caveExit: makeGeneratedBackground('epilogue-caverne/scene-01-sortie-caverne.png'),
  seal: makeGeneratedBackground('epilogue-caverne/scene-02-sceau-retour.png'),
  returnCity: makeGeneratedBackground('epilogue-caverne/scene-03-retour-ville.png'),
};

const TEMPLATE_BACKGROUNDS = {
  adventure_choices: [
    makeTemplateBackground('adventure_choices', 'scene-01-croisee-chemins.png'),
    makeTemplateBackground('adventure_choices', 'scene-02-sentier-foret.png'),
    makeTemplateBackground('adventure_choices', 'scene-03-tour-guetteur.png'),
  ],
  hero_adventure: [
    makeTemplateBackground('hero_adventure', 'scene-01-camp-heros.png'),
    makeTemplateBackground('hero_adventure', 'scene-02-pont-ruines.png'),
    makeTemplateBackground('hero_adventure', 'scene-03-sanctuaire-oublie.png'),
  ],
  manor: [
    makeTemplateBackground('manor', 'scene-01-hall-manoir.png'),
    makeTemplateBackground('manor', 'scene-02-bibliotheque-interdite.png'),
    makeTemplateBackground('manor', 'scene-03-chambre-verrouillee.png'),
  ],
  investigation: [
    makeTemplateBackground('investigation', 'scene-01-bureau-inspecteur.png'),
    makeTemplateBackground('investigation', 'scene-02-scene-crime.png'),
    makeTemplateBackground('investigation', 'scene-03-archives-commissariat.png'),
  ],
  laboratory: [
    makeTemplateBackground('laboratory', 'scene-01-sas-entree.png'),
    makeTemplateBackground('laboratory', 'scene-02-salle-experiences.png'),
    makeTemplateBackground('laboratory', 'scene-03-reacteur-instable.png'),
  ],
  museum: [
    makeTemplateBackground('museum', 'scene-01-galerie-principale.png'),
    makeTemplateBackground('museum', 'scene-02-reserve-secrete.png'),
    makeTemplateBackground('museum', 'scene-03-salle-artefacts.png'),
  ],
};

const TEMPLATE_BACKGROUND_ROTATIONS = {
  book_hero: [BACKGROUNDS.souk, BACKGROUNDS.caveDoor, BACKGROUNDS.returnCity, BACKGROUNDS.caveExit, BACKGROUNDS.seal],
  adventure_choices: TEMPLATE_BACKGROUNDS.adventure_choices,
  hero_adventure: TEMPLATE_BACKGROUNDS.hero_adventure,
  manor: TEMPLATE_BACKGROUNDS.manor,
  investigation: TEMPLATE_BACKGROUNDS.investigation,
  laboratory: TEMPLATE_BACKGROUNDS.laboratory,
  museum: TEMPLATE_BACKGROUNDS.museum,
  promote: [BACKGROUNDS.prologueCover],
  extend: [BACKGROUNDS.returnCity],
  story: [BACKGROUNDS.prologueCover],
  showcase: [BACKGROUNDS.prologueCover],
};

const TEMPLATE_ITEM_IMAGES = {
  adventure_choices: {
    'Jeton du guide': makeTemplateItemImage('adventure_choices', 'item-jeton-guide.png'),
    'Carte de la vallee': makeTemplateItemImage('adventure_choices', 'item-carte-vallee.png'),
    'Sceau du guetteur': makeTemplateItemImage('adventure_choices', 'item-sceau-guetteur.png'),
  },
  hero_adventure: {
    'Relique ancienne': makeTemplateItemImage('hero_adventure', 'item-relique-ancienne.png'),
    'Potion de soin': makeTemplateItemImage('hero_adventure', 'item-potion-soin.png'),
    'Potion de mana': makeTemplateItemImage('hero_adventure', 'item-potion-mana.png'),
    'Lame d entrainement': makeTemplateItemImage('hero_adventure', 'item-lame-entrainement.png'),
  },
  manor: {
    'Clef de la bibliotheque': makeTemplateItemImage('manor', 'item-clef-bibliotheque.png'),
    'Portrait dechire': makeTemplateItemImage('manor', 'item-portrait-dechire.png'),
    'Sceau de cire noire': makeTemplateItemImage('manor', 'item-sceau-cire-noire.png'),
  },
  investigation: {
    'Badge de scene': makeTemplateItemImage('investigation', 'item-badge-scene.png'),
    'Ticket humide': makeTemplateItemImage('investigation', 'item-ticket-humide.png'),
    'Dossier classe C-17': makeTemplateItemImage('investigation', 'item-dossier-c17.png'),
  },
  laboratory: {
    'Carte de securite': makeTemplateItemImage('laboratory', 'item-carte-securite.png'),
    'Echantillon bleu': makeTemplateItemImage('laboratory', 'item-echantillon-bleu.png'),
    'Module de controle': makeTemplateItemImage('laboratory', 'item-module-controle.png'),
  },
  museum: {
    'Clef de reserve': makeTemplateItemImage('museum', 'item-clef-reserve.png'),
    'Cartel ancien': makeTemplateItemImage('museum', 'item-cartel-ancien.png'),
    'Medaille solaire': makeTemplateItemImage('museum', 'item-medaille-solaire.png'),
  },
};

export const getTemplateBackground = (templateId, index = 0) => {
  const rotation = TEMPLATE_BACKGROUND_ROTATIONS[templateId] || [];
  if (!rotation.length) return null;
  return rotation[Math.abs(index) % rotation.length] || null;
};

export const withTemplateSceneBackground = (scene, templateId, index = 0) => {
  if (!scene || scene.backgroundId || scene.backgroundData) return scene;
  const background = getTemplateBackground(templateId, index);
  if (!background) return scene;
  return {
    ...scene,
    backgroundData: background.data,
    backgroundName: background.name,
    backgroundWidth: background.width,
    backgroundHeight: background.height,
    backgroundAspectRatio: background.aspectRatio,
  };
};

export const applyTemplateBackgrounds = (scenes, templateId) => (
  scenes.map((scene, index) => withTemplateSceneBackground(scene, templateId, index))
);

export const withTemplateItemImages = (items, templateId) => {
  const imagesByName = TEMPLATE_ITEM_IMAGES[templateId] || {};
  if (!imagesByName || !Object.keys(imagesByName).length) return items;
  return items.map((item) => {
    if (!item || item.imageData) return item;
    const image = imagesByName[item.name];
    if (!image) return item;
    return {
      ...item,
      imageData: image.data,
      imageName: image.name,
    };
  });
};
