import { normalizeProject } from '../data/projectData';

const TEMPLATE_TITLES = {
  empty: 'Projet vide',
  manor: 'Manoir hanté',
  investigation: 'Enquête policière',
  laboratory: 'Laboratoire',
  museum: 'Musée',
};

const SCENE_THEMES = {
  manor: ['Hall du manoir', 'Bibliothèque interdite', 'Chambre verrouillée'],
  investigation: ['Bureau de l’inspecteur', 'Scène de crime', 'Archives du commissariat'],
  laboratory: ['Sas d’entrée', 'Salle des expériences', 'Réacteur instable'],
  museum: ['Galerie principale', 'Réserve secrète', 'Salle des artefacts'],
};

const SCENE_INTROS = {
  manor: [
    'La porte du manoir grince derrière toi. Quelque chose t’observe.',
    'Des livres anciens cachent peut-être le premier indice.',
    'La chambre semble intacte, mais la serrure raconte autre chose.',
  ],
  investigation: [
    'Un dossier urgent t’attend sur le bureau.',
    'Chaque détail de la pièce peut devenir une preuve.',
    'Les archives contiennent des noms que personne ne veut revoir.',
  ],
  laboratory: [
    'Les néons clignotent. Le protocole d’urgence est actif.',
    'Des instruments bourdonnent autour d’une expérience inachevée.',
    'Le réacteur pulse lentement, comme un compte à rebours.',
  ],
  museum: [
    'Le musée est fermé, mais une vitrine vient de s’ouvrir.',
    'La réserve conserve les pièces que le public ne doit jamais voir.',
    'Un artefact manque. Sa place vide semble presque lumineuse.',
  ],
};

export function applyCreationTemplate(baseProject, templateId, name) {
  const project = normalizeProject(baseProject);
  project.title = name || TEMPLATE_TITLES[templateId] || 'Nouveau projet';

  if (templateId === 'empty') {
    project.acts = [{ ...project.acts[0], name: 'Acte I' }];
    project.scenes = project.scenes.slice(0, 1).map((scene) => ({
      ...scene,
      name: 'Scène de départ',
      parentSceneId: '',
      introText: 'Décris ici le point de départ de ton escape game.',
      hotspots: [],
    }));
    project.items = [];
    project.combinations = [];
    project.cinematics = [];
    project.enigmas = [];
    project.start = { type: 'scene', targetSceneId: project.scenes[0]?.id || '', targetCinematicId: '' };
    return normalizeProject(project);
  }

  const sceneThemes = SCENE_THEMES[templateId];
  if (sceneThemes) {
    project.scenes = project.scenes.slice(0, 3).map((scene, index) => ({
      ...scene,
      name: sceneThemes[index] || scene.name,
      parentSceneId: index === 1 ? project.scenes[0]?.id || '' : '',
      introText: SCENE_INTROS[templateId][index],
    }));
    project.start = { type: 'scene', targetSceneId: project.scenes[0]?.id || '', targetCinematicId: '' };
  }

  return normalizeProject(project);
}
