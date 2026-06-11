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
  book_hero: [
    makeTemplateBackground('book_hero', 'scene-01-route-brumeuse.png'),
    makeTemplateBackground('book_hero', 'scene-02-porte-noire.png'),
    makeTemplateBackground('book_hero', 'scene-03-marche-abandonne.png'),
    makeTemplateBackground('book_hero', 'scene-04-catacombes.png'),
    makeTemplateBackground('book_hero', 'scene-05-salle-trone.png'),
  ],
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
  magic_forest: [
    makeTemplateBackground('magic_forest', 'scene-01-lisiere-enchantee.png'),
    makeTemplateBackground('magic_forest', 'scene-02-arbre-oracle.png'),
    makeTemplateBackground('magic_forest', 'scene-03-source-lucioles.png'),
  ],
  museum: [
    makeTemplateBackground('museum', 'scene-01-galerie-principale-v2.png'),
    makeTemplateBackground('museum', 'scene-02-reserve-secrete.png'),
    makeTemplateBackground('museum', 'scene-03-salle-artefacts.png'),
  ],
  narrative_investigation: [
    makeTemplateBackground('narrative_investigation', 'scene-01-bureau-detective.png'),
    makeTemplateBackground('narrative_investigation', 'scene-02-appartement-temoin.png'),
    makeTemplateBackground('narrative_investigation', 'scene-03-quai-nuit.png'),
  ],
  narrative_maze: [
    makeTemplateBackground('narrative_maze', 'scene-01-entree-labyrinthe.png'),
    makeTemplateBackground('narrative_maze', 'scene-02-salle-echos.png'),
    makeTemplateBackground('narrative_maze', 'scene-03-centre-mouvant.png'),
  ],
  npc_dialogue: [
    makeTemplateBackground('npc_dialogue', 'scene-01-taverne-calme.png'),
    makeTemplateBackground('npc_dialogue', 'scene-02-arriere-salle.png'),
    makeTemplateBackground('npc_dialogue', 'scene-03-porte-cite.png'),
  ],
  negotiation: [
    makeTemplateBackground('negotiation', 'scene-01-salle-conseil.png'),
    makeTemplateBackground('negotiation', 'scene-02-couloir-apartes.png'),
    makeTemplateBackground('negotiation', 'scene-03-balcon-pacte.png'),
  ],
  survival_choices: [
    makeTemplateBackground('survival_choices', 'scene-01-epave-plage.png'),
    makeTemplateBackground('survival_choices', 'scene-02-foret-humide.png'),
    makeTemplateBackground('survival_choices', 'scene-03-falaise-signal.png'),
  ],
};

const TEMPLATE_BACKGROUND_ROTATIONS = {
  book_hero: TEMPLATE_BACKGROUNDS.book_hero,
  adventure_choices: TEMPLATE_BACKGROUNDS.adventure_choices,
  hero_adventure: TEMPLATE_BACKGROUNDS.hero_adventure,
  manor: TEMPLATE_BACKGROUNDS.manor,
  investigation: TEMPLATE_BACKGROUNDS.investigation,
  laboratory: TEMPLATE_BACKGROUNDS.laboratory,
  magic_forest: TEMPLATE_BACKGROUNDS.magic_forest,
  museum: TEMPLATE_BACKGROUNDS.museum,
  narrative_investigation: TEMPLATE_BACKGROUNDS.narrative_investigation,
  narrative_maze: TEMPLATE_BACKGROUNDS.narrative_maze,
  npc_dialogue: TEMPLATE_BACKGROUNDS.npc_dialogue,
  negotiation: TEMPLATE_BACKGROUNDS.negotiation,
  survival_choices: TEMPLATE_BACKGROUNDS.survival_choices,
  promote: [BACKGROUNDS.prologueCover],
  extend: [BACKGROUNDS.returnCity],
  story: [BACKGROUNDS.prologueCover],
  showcase: [BACKGROUNDS.prologueCover],
};

const TEMPLATE_ITEM_IMAGES = {
  book_hero: {
    'Marque-page d argent': makeTemplateItemImage('book_hero', 'item-marque-page-argent.png'),
    'Lanterne sourde': makeTemplateItemImage('book_hero', 'item-lanterne-sourde.png'),
  },
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
  magic_forest: {
    'Graine d argent': makeTemplateItemImage('magic_forest', 'item-graine-argent.png'),
    'Ecorce gravee': makeTemplateItemImage('magic_forest', 'item-ecorce-gravee.png'),
    'Rosace des lucioles': makeTemplateItemImage('magic_forest', 'item-rosace-lucioles.png'),
  },
  museum: {
    'Clef de reserve': makeTemplateItemImage('museum', 'item-clef-reserve.png'),
    'Cartel ancien': makeTemplateItemImage('museum', 'item-cartel-ancien.png'),
    'Medaille solaire': makeTemplateItemImage('museum', 'item-medaille-solaire.png'),
  },
  narrative_investigation: {
    'Photo froissee': makeTemplateItemImage('narrative_investigation', 'item-photo-froissee.png'),
    'Releve d appels': makeTemplateItemImage('narrative_investigation', 'item-releve-appels.png'),
    'Aveu signe': makeTemplateItemImage('narrative_investigation', 'item-aveu-signe.png'),
  },
  narrative_maze: {
    'Fil rouge': makeTemplateItemImage('narrative_maze', 'item-fil-rouge.png'),
    'Fragment d echo': makeTemplateItemImage('narrative_maze', 'item-fragment-echo.png'),
    'Cle du centre': makeTemplateItemImage('narrative_maze', 'item-cle-centre.png'),
  },
  npc_dialogue: {
    'Sceau dé confiance': makeTemplateItemImage('npc_dialogue', 'item-sceau-confiance.png'),
    'Phrase de passe': makeTemplateItemImage('npc_dialogue', 'item-phrase-passe.png'),
    'Cle de la cite': makeTemplateItemImage('npc_dialogue', 'item-cle-cite.png'),
  },
  negotiation: {
    'Lettre de garantie': makeTemplateItemImage('negotiation', 'item-lettre-garantie.png'),
    'Clause annotee': makeTemplateItemImage('negotiation', 'item-clause-annotee.png'),
    'Pacte scelle': makeTemplateItemImage('negotiation', 'item-pacte-scelle.png'),
  },
  survival_choices: {
    'Gourde intacte': makeTemplateItemImage('survival_choices', 'item-gourde-intacte.png'),
    'Carte detrempee': makeTemplateItemImage('survival_choices', 'item-carte-detrempee.png'),
    'Fumigene de signal': makeTemplateItemImage('survival_choices', 'item-fumigene-signal.png'),
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
