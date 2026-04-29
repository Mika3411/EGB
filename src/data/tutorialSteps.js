import { makeCombination, makeEnigma, makeLogicRule, makeRouteMap } from './projectData';

export const BUILDER_TUTORIAL_TABS = ['scenes', 'editor', 'map', 'cinematics', 'combinations', 'enigmas', 'logic', 'ai'];

const makeTutorialEndStep = (tab, selector) => ({
  tab,
  selector,
  title: 'A toi de jouer',
  body: 'Bravo {name}, tu as fait le tour de ce parcours. Familiarise-toi tranquillement avec cet environnement, puis cree ton propre projet depuis Profil. PS : ce projet-ci ne sera pas enregistre.',
  action: 'Clique sur Terminer quand tu es pret a explorer librement.',
  celebration: true,
});

export const BUILDER_TUTORIAL_STEPS = [
  {
    tab: 'scenes',
    selector: '[data-tour="scene-name"]',
    title: 'Nom de la scene',
    body: 'On commence tranquille, {name}. Donne un petit nom a ta scene, quelque chose que tu reconnaitras vite quand ton jeu aura grandi. Exemple : Salon du grand-pere.',
    action: 'Ecris au moins 3 caracteres dans le champ. Tu peux essayer : Salon du grand-pere.',
    completeWhen: { type: 'input-min', selector: '[data-tour="scene-name"] input', min: 3 },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-act"]',
    title: 'Ranger dans un acte',
    body: 'Ici, tu ranges ta scene dans un chapitre. Pense aux actes comme aux grandes etapes de ton histoire.',
    action: 'Ouvre le menu Acte ou clique dans cette zone pour confirmer que tu as repere le rangement.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-intro"]',
    title: 'Introduction',
    body: 'C est le premier souffle de la scene. Ecris ce que le joueur ressent ou remarque en arrivant. Exemple : Une horloge arretee domine la piece.',
    action: 'Ecris une petite phrase d introduction. Tu peux essayer : Une horloge arretee domine la piece.',
    completeWhen: { type: 'input-min', selector: '[data-tour="scene-intro"] input', min: 10 },
  },
  {
    tab: 'scenes',
    tutorial: 'scenes',
    selector: '[data-tour-tab="media"]',
    title: 'Passer aux medias',
    body: 'Maintenant, {name}, on prepare l ambiance au bon endroit. Clique sur Media : c est la que vivent les images de scene, les effets et la musique.',
    action: 'Clique sur l onglet Media.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour="media-background-image"]',
    title: 'Image de la scene',
    body: 'Choisis le decor principal de ta scene. Le bouton peut deja afficher un nom de fichier, c est normal : clique dessus et je t ouvre la fausse fenetre Windows avec les images du projet.',
    action: 'Clique sur le bouton de l image de fond, puis choisis une image du projet.',
    completeWhen: { type: 'fake-file', target: 'scene-background' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour="media-visual-effect"]',
    title: 'Effet visuel',
    body: 'Une image montre le lieu. Un effet donne la sensation. Choisis une ambiance visible, meme simple, pour voir tout de suite ce que ca change.',
    action: 'Choisis un effet autre que Aucune.',
    completeWhen: { type: 'project-scene-field-not', field: 'visualEffect', value: 'none' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour="media-music"]',
    title: 'Musique',
    body: 'Derniere couche d ambiance : le son. Prends une musique exemple, juste pour comprendre comment elle s attache a la scene.',
    action: 'Clique sur Importer une musique, puis choisis un son.',
    completeWhen: { type: 'fake-file', target: 'scene-music' },
  },
  {
    tab: 'media',
    tutorial: 'scenes',
    selector: '[data-tour-tab="scenes"]',
    title: 'Retour a la scene',
    body: 'Parfait. Maintenant on retourne dans Scenes pour voir le vrai resultat dans l editeur, avec ton image et l effet que tu viens de choisir.',
    action: 'Clique sur l onglet Scenes.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'scenes',
    selector: '[data-tour="scene-canvas"]',
    title: 'Image plus effet',
    body: 'Regarde le rendu dans l editeur : ton decor est pose, et l effet visuel est applique dessus. C est exactement le retour qu il faut avant de continuer.',
    action: 'Clique une fois sur l editeur pour valider que tu as vu le resultat.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="inventory"]',
    title: 'Inventaire',
    body: 'Les objets sont les petits moteurs d un escape game. Une cle, une note, une torche : chacun peut servir plus tard.',
    action: 'Clique sur la zone Inventaire pour la reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-create"]',
    title: 'Creer un objet',
    body: 'On va creer un vrai objet d inventaire. C est souvent comme ca qu on donne au joueur une cle, une preuve ou un indice.',
    action: 'Clique sur + Objet.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-name"]',
    title: 'Nommer l objet',
    body: 'Donne-lui un nom lisible pour le joueur. Exemple : Cle rouillee.',
    action: 'Ecris au moins 3 caracteres. Tu peux essayer : Cle rouillee.',
    completeWhen: { type: 'input-min', selector: '[data-tour="object-name"]', min: 3 },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-image"]',
    title: 'Choisir une image',
    body: 'Pour apprendre sans toucher a tes vrais fichiers, je t ouvre une fausse fenetre Windows. Choisis une image exemple pour ton objet.',
    action: 'Choisis une image dans la fausse fenetre Windows.',
    completeWhen: { type: 'fake-file' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="object-image"]',
    title: 'Petite astuce image',
    body: 'Astuce pour la suite, {name} : quand tu peux, choisis des images sans fond, comme des PNG transparents. Elles se fondent beaucoup mieux dans le decor et ton objet aura l air vraiment pose dans la scene.',
    action: 'Clique sur le bouton Suivant quand tu as garde cette astuce en tete.',
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-add-menu"]',
    title: 'Ajouter l objet dans la scene',
    body: 'Ton objet existe maintenant dans l inventaire. Super. Maintenant on va le poser dans la scene pour que le joueur puisse le voir et le ramasser.',
    action: 'Clique sur le menu Ajouter dans la barre de l editeur.',
    completeWhen: { type: 'details-open', selector: '[data-tour="scene-add-menu"]' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-add-visible-object"]',
    title: 'Objet visible',
    body: 'Choisis Objet visible. Le builder va reprendre le nom et l image de ton objet, puis le placer au centre du canvas.',
    action: 'Clique sur Objet visible.',
    completeWhen: { type: 'project-scene-object-created' },
  },
  {
    tab: 'scenes',
    selector: '[data-tour="scene-object-on-canvas"]',
    title: 'Placer l objet',
    body: 'Le voila dans la scene. Attrape-le et deplace-le a l endroit qui te semble logique. C est comme ca que tu caches une cle, une note ou un indice.',
    action: 'Fais glisser l objet dans le canvas pour le placer.',
    completeWhen: { type: 'project-scene-object-moved' },
  },
  makeTutorialEndStep('scenes', '[data-tour="scene-canvas"]'),
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-canvas"]',
    title: 'Editeur de scene',
    body: 'Ici, {name}, tu construis ce que le joueur verra vraiment. Le decor sert de base, puis tu poses dessus des zones cliquables, des objets visibles et des effets locaux.',
    action: 'Clique une fois dans l editeur pour prendre tes reperes.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-menu"]',
    title: 'Menu Ajouter',
    body: 'Ce menu est ta petite boite a outils du canvas. On va commencer par une zone d action : une partie invisible ou visible que le joueur pourra cliquer.',
    action: 'Ouvre le menu Ajouter.',
    completeWhen: { type: 'details-open', selector: '[data-tour="scene-add-menu"]' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-hotspot"]',
    title: 'Zone d action',
    body: 'Choisis Zone d action. Le builder va poser une nouvelle zone au centre, puis on la deplacera ensemble.',
    action: 'Clique sur Zone d action.',
    completeWhen: { type: 'project-hotspot-created' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-on-canvas"]',
    title: 'Placer la zone',
    body: 'La zone est maintenant dans le canvas. Deplace-la sur un endroit qui pourrait reagir au clic : une porte, un tiroir, un tableau, un detail curieux.',
    action: 'Fais glisser la zone dans le canvas.',
    completeWhen: { type: 'project-hotspot-moved' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="selected-zone-panel"]',
    title: 'Zone selectionnee',
    body: 'Ce panneau est la fiche complete de la zone. Tu y retrouves son nom, sa position, sa taille, l action au clic, le dialogue, les destinations, les enigmes, les sons et les images liees.',
    action: 'Clique dans ce panneau pour le reperer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-geometry"]',
    title: 'Position et taille',
    body: 'X et Y placent le centre de la zone. Largeur et hauteur reglent la surface cliquable. C est utile pour rendre une cible confortable, surtout sur mobile.',
    action: 'Clique dans les reglages de position ou de taille.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-action"]',
    title: 'Action au clic',
    body: 'L action decide ce que la zone fait pour le joueur : parler, donner un objet, changer de scene ou lancer une cinematique. Pour l instant, garde Dialogue, c est parfait pour tester.',
    action: 'Clique sur le menu Action pour le confirmer.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="hotspot-dialogue"]',
    title: 'Dialogue de zone',
    body: 'Ecris le retour que le joueur lira quand il clique ici. Exemple : Le bois grince, mais le tiroir reste bloque.',
    action: 'Ecris au moins 8 caracteres. Tu peux essayer : Le bois grince, mais rien ne bouge.',
    completeWhen: { type: 'input-min', selector: '[data-tour="hotspot-dialogue"]', min: 8 },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-menu"]',
    title: 'Ajouter une zone visuelle',
    body: 'Maintenant, on ajoute une zone visuelle. Elle ne remplace pas l action : elle sert a attirer l oeil, ajouter une ambiance ou signaler un endroit important.',
    action: 'Ouvre a nouveau le menu Ajouter.',
    completeWhen: { type: 'details-open', selector: '[data-tour="scene-add-menu"]' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="scene-add-visual-zone"]',
    title: 'Zone visuelle',
    body: 'Choisis Zone visuelle. Elle va apparaitre dans le canvas avec un effet local que tu pourras placer ou regler ensuite.',
    action: 'Clique sur Zone visuelle.',
    completeWhen: { type: 'project-visual-zone-created' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour="visual-zone-on-canvas"]',
    title: 'Placer l effet',
    body: 'Deplace cette zone visuelle autour de l endroit que tu veux faire ressortir. C est pratique pour un reflet, une poussiere magique, une lumiere ou une zone suspecte.',
    action: 'Fais glisser la zone visuelle dans le canvas.',
    completeWhen: { type: 'project-visual-zone-moved' },
  },
  {
    tab: 'scenes',
    tutorial: 'editor',
    selector: '[data-tour-tab="preview"]',
    title: 'Voir le resultat',
    body: 'On passe maintenant en Preview. C est la meilleure habitude a prendre : tu construis, puis tu testes tout de suite comme un joueur.',
    action: 'Clique sur l onglet Preview.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'preview',
    tutorial: 'editor',
    selector: '[data-tour="preview-player"]',
    title: 'Resultat jouable',
    body: 'Voila le rendu cote joueur. Ta scene, tes zones et tes effets doivent se comprendre ici, sans avoir besoin de regarder les reglages.',
    action: 'Clique une fois dans le preview pour valider que tu as vu le resultat.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'preview',
    tutorial: 'editor',
    selector: '[data-tour="preview-player"]',
    title: 'A toi de jouer',
    body: 'Bravo {name}, tu as fait le tour de ce parcours. Familiarise-toi tranquillement avec cet environnement, puis cree ton propre projet depuis Profil. PS : ce projet-ci ne sera pas enregistre.',
    action: 'Clique sur Terminer quand tu es pret a explorer librement.',
    celebration: true,
  },
  {
    tab: 'media',
    selector: '[data-tour-tab="media"]',
    title: 'Medias',
    body: 'L onglet Media rassemble les images, sons et fonds utilises par tes scenes.',
  },
  {
    tab: 'map',
    selector: '[data-tour="map-add-room"]',
    title: 'Ajouter des pieces',
    body: 'On va dessiner le chemin du joueur. Ajoute une piece a la main, ou laisse le builder partir de tes scenes existantes.',
    action: 'Clique sur Piece ou Depuis scenes.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'map',
    selector: '[data-tour="map-board"]',
    title: 'Organiser la carte',
    body: 'Cette carte t aide a voir ton jeu d un seul coup d oeil. Elle sert aussi a verifier que les connexions entre les differentes pieces sont bien presentes. Deplace les pieces comme si tu posais le plan sur une table.',
    action: 'Clique une piece sur la carte.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'map',
    selector: '[data-tour="map-room-detail"]',
    title: 'Lier une scene',
    body: 'Chaque piece peut pointer vers une vraie scene. C est le pont entre ton plan mental et le jeu jouable.',
    action: 'Clique dans le detail ou modifie un champ de la piece.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'map',
    selector: '[data-tour="map-diagnostics"]',
    title: 'Verifier les liaisons',
    body: 'Cette partie joue un peu le role du copilote. Elle te montre ce qui risque de coincer avant que les joueurs le decouvrent.',
  },
  makeTutorialEndStep('map', '[data-tour="map-diagnostics"]'),
  {
    tab: 'cinematics',
    selector: '[data-tour-tab="cinematics"]',
    title: 'Cinematiques',
    body: 'Ajoute des transitions, introductions ou fins de jeu sous forme de sequences.',
  },
  makeTutorialEndStep('cinematics', '[data-tour-tab="cinematics"]'),
  {
    tab: 'combinations',
    selector: '[data-tour="combination-add"]',
    title: 'Creer une combinaison',
    body: 'Les combinaisons donnent ce petit plaisir de deduction. Deux objets, une idee, et hop : un nouveau resultat.',
    action: 'Clique sur + Combinaison.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'combinations',
    selector: '[data-tour="combination-items"]',
    title: 'Choisir les ingredients',
    body: 'Choisis les deux objets que le joueur devra rapprocher. Imagine la logique : qu est-ce qui ferait sens dans l histoire ?',
    action: 'Choisis ou confirme un objet dans les ingredients.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'combinations',
    selector: '[data-tour="combination-result"]',
    title: 'Definir le resultat',
    body: 'Le resultat, c est la recompense. Il peut devenir une cle pour la suite, au sens propre ou au sens narratif.',
    action: 'Choisis ou confirme le resultat.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'combinations',
    selector: '[data-tour="combination-message"]',
    title: 'Message joueur',
    body: 'Ecris un petit retour pour le joueur. Un bon message confirme la reussite et peut glisser un indice discret.',
    action: 'Ecris un message d au moins 8 caracteres.',
    completeWhen: { type: 'input-min', selector: '[data-tour="combination-message"]', min: 8 },
  },
  makeTutorialEndStep('combinations', '[data-tour="combination-message"]'),
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-list"]',
    title: 'Liste des enigmes',
    body: 'Bienvenue dans la fabrique a casse-tetes, {name}. Ici, tu crees les enigmes que tes zones pourront lancer.',
    action: 'Clique dans la liste des enigmes pour la prendre en main.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-identity"]',
    title: 'Nom et type',
    body: 'Donne une identite a ton enigme. Le type change la maniere dont le joueur va interagir avec elle.',
    action: 'Clique dans le nom ou le type de l enigme.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-question"]',
    title: 'Consigne',
    body: 'La consigne doit aider sans tout donner. Parle au joueur comme si tu lui tendais un indice, pas comme si tu lisais un manuel.',
    action: 'Ecris une consigne d au moins 10 caracteres.',
    completeWhen: { type: 'input-min', selector: '[data-tour="enigma-question"]', min: 10 },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-solution"]',
    title: 'Solution',
    body: 'Ici, tu poses la vraie reponse. C est le petit secret que le moteur va comparer a ce que le joueur tente.',
    action: 'Ecris une solution, meme courte.',
    completeWhen: { type: 'input-min', selector: '[data-tour="enigma-solution"]', min: 1 },
  },
  {
    tab: 'enigmas',
    selector: '[data-tour="enigma-unlock"]',
    title: 'Deblocage',
    body: 'Quand le joueur reussit, il faut que le monde reagisse. Tu peux simplement valider, ouvrir une scene ou lancer une cinematique.',
    action: 'Clique dans la zone de deblocage ou change un select.',
    completeWhen: { type: 'interact' },
  },
  makeTutorialEndStep('enigmas', '[data-tour="enigma-unlock"]'),
  {
    tab: 'logic',
    selector: '[data-tour="logic-scene-tree"]',
    title: 'Choisir la scene',
    body: 'La logique peut impressionner au debut, mais on va y aller doucement. D abord, choisis la scene dont tu veux regler le comportement.',
    action: 'Clique une scene dans la colonne.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-zones"]',
    title: 'Zones d action',
    body: 'Chaque zone peut avoir une action simple, puis des exceptions. C est comme dire : normalement cette porte parle, mais si le joueur a la cle, elle s ouvre.',
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-add-rule"]',
    title: 'Ajouter une regle',
    body: 'Une regle, c est un petit â€œsi... alors...â€. Si le joueur a tel objet, alors la zone reagit autrement.',
    action: 'Clique sur + Regle.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-condition"]',
    title: 'Condition',
    body: 'La condition est le declencheur. Prends ton temps ici : c est souvent ce qui fait qu une enigme devient vraiment satisfaisante.',
    action: 'Change ou confirme la condition.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-action"]',
    title: 'Action declenchee',
    body: 'Maintenant, choisis la consequence. Quand la condition est vraie, que doit-il se passer pour le joueur ?',
    action: 'Change ou confirme l action declenchee.',
    completeWhen: { type: 'interact' },
  },
  {
    tab: 'logic',
    selector: '[data-tour="logic-visible-objects"]',
    title: 'Objets visibles',
    body: 'Les objets visibles peuvent eux aussi raconter quelque chose : une image a inspecter, un objet a ramasser, ou un indice qui disparait apres usage.',
  },
  makeTutorialEndStep('logic', '[data-tour="logic-visible-objects"]'),
  {
    tab: 'score',
    selector: '[data-tour-tab="score"]',
    title: 'Bilan',
    body: 'Consulte la qualite globale du projet et les points a corriger avant de publier.',
  },
  {
    tab: 'ai',
    selector: '[data-tour-tab="ai"]',
    title: 'IA',
    body: 'Utilise l IA pour generer ou ameliorer des idees, des scenes et certains contenus.',
  },
  makeTutorialEndStep('ai', '[data-tour-tab="ai"]'),
  {
    tab: 'shop',
    selector: '[data-tour-tab="shop"]',
    title: 'Boutique',
    body: 'Retrouve les options liees aux contenus et services complementaires du builder.',
  },
  {
    tab: 'preview',
    selector: '[data-tour-tab="preview"]',
    title: 'Preview',
    body: 'Teste ton jeu comme un joueur avant de le publier, pour verifier les dialogues, enigmes et transitions.',
  },
];

export const getTutorialStepIndexes = (tab) => BUILDER_TUTORIAL_STEPS
  .map((step, index) => ({ step, index }))
  .filter(({ step }) => (step.tutorial || step.tab) === tab)
  .map(({ index }) => index);

const getProjectRecordName = (project) =>
  project?.name || project?.data?.title || project?.data?.name || '';

export const getTutorialName = (user) => {
  const label = user?.name || user?.pseudo || user?.username || user?.email?.split('@')?.[0] || '';
  return String(label || '').trim();
};

export const personalizeTutorialText = (text, userName) => String(text || '').replaceAll('{name}', userName || 'toi');

export const getTutorialInputValue = (selector) => {
  const field = document.querySelector(selector);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value || '';
  }
  return '';
};

export const getTutorialInputField = (selector) => {
  const target = document.querySelector(selector);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return target;
  }
  return target?.querySelector?.('input, textarea, select') || null;
};

export const doRectsOverlap = (a, b, padding = 0) => (
  a.left < b.left + b.width + padding
  && a.left + a.width + padding > b.left
  && a.top < b.top + b.height + padding
  && a.top + a.height + padding > b.top
);

const getSelectedTutorialScene = (project) => (project?.scenes || [])[0] || null;

export const isTutorialStepComplete = (step, interactedSteps, project) => {
  if (!step?.completeWhen) return true;
  const rule = step.completeWhen;
  if (rule.type === 'interact') return interactedSteps.has(step.selector);
  if (rule.type === 'fake-file') return interactedSteps.has(`fake-file:${step.selector}`);
  if (rule.type === 'input-min') return getTutorialInputValue(rule.selector).trim().length >= (rule.min || 1);
  if (rule.type === 'select-not') return getTutorialInputValue(rule.selector) !== rule.value;
  if (rule.type === 'details-open') return Boolean(document.querySelector(`${rule.selector}[open]`));
  if (rule.type === 'project-scene-field-not') {
    const scene = getSelectedTutorialScene(project);
    return Boolean(scene && (scene[rule.field] || '') !== rule.value);
  }
  if (rule.type === 'project-scene-object-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.sceneObjects || []).some((object) => object.tutorialCreated));
  }
  if (rule.type === 'project-scene-object-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.sceneObjects || []).filter((object) => object.tutorialCreated).some((object) => (
      Math.abs((Number(object.x) || 0) - 50) > 1 || Math.abs((Number(object.y) || 0) - 50) > 1
    )));
  }
  if (rule.type === 'project-hotspot-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.hotspots || []).some((hotspot) => hotspot.tutorialCreated));
  }
  if (rule.type === 'project-hotspot-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.hotspots || []).filter((hotspot) => hotspot.tutorialCreated).some((hotspot) => (
      Math.abs((Number(hotspot.x) || 0) - 50) > 1 || Math.abs((Number(hotspot.y) || 0) - 50) > 1
    )));
  }
  if (rule.type === 'project-visual-zone-created') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).some((zone) => zone.tutorialCreated));
  }
  if (rule.type === 'project-visual-zone-moved') {
    const scene = getSelectedTutorialScene(project);
    return Boolean((scene?.visualEffectZones || []).filter((zone) => zone.tutorialCreated).some((zone) => (
      Math.abs((Number(zone.x) || 0) - 50) > 1 || Math.abs((Number(zone.y) || 0) - 50) > 1
    )));
  }
  return true;
};

export const makeTutorialImageDataUrl = (label, color) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="28" fill="#111827"/>
      <rect x="34" y="42" width="172" height="136" rx="16" fill="${color}"/>
      <circle cx="84" cy="88" r="22" fill="#f8fafc" opacity=".9"/>
      <path d="M50 162 L98 118 L132 146 L158 112 L198 162 Z" fill="#f8fafc" opacity=".82"/>
      <text x="120" y="210" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#e5e7eb">${label}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const makeTutorialFileIconDataUrl = (label, color = '#2563eb') => makeTutorialImageDataUrl(label, color);

const FAKE_WINDOWS_IMAGES = [
  { name: 'cle-rouillee.png', label: 'Cle', color: '#b45309' },
  { name: 'lettre-cachetee.png', label: 'Lettre', color: '#7c3aed' },
  { name: 'montre-arretee.png', label: 'Montre', color: '#2563eb' },
];

const FAKE_WINDOWS_AUDIO = [
  {
    name: 'ambiance-manoir.mp3',
    label: 'Ambiance manoir',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
  {
    name: 'tic-tac-sourd.mp3',
    label: 'Tic tac sourd',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
  {
    name: 'vent-couloir.mp3',
    label: 'Vent couloir',
    dataUrl: 'data:audio/mpeg;base64,',
    isReal: false,
  },
];

const getFakeWindowAudioOptions = (project) => {
  const tutorialAudio = Array.isArray(project?.tutorialExampleAudio) ? project.tutorialExampleAudio : [];
  const realAudio = (tutorialAudio.length ? tutorialAudio : (project?.scenes || []))
    .filter((scene) => scene.musicData)
    .map((scene) => ({
      name: scene.musicName || `${scene.name || 'musique'}.mp3`,
      label: scene.name || 'Musique',
      dataUrl: scene.musicData,
      isReal: true,
    }));

  const uniqueAudio = [];
  const seenAudio = new Set();
  realAudio.forEach((audio) => {
    const key = audio.dataUrl || audio.name;
    if (seenAudio.has(key)) return;
    seenAudio.add(key);
    uniqueAudio.push(audio);
  });

  return uniqueAudio.length ? uniqueAudio.slice(0, 1) : FAKE_WINDOWS_AUDIO.slice(0, 1);
};

export const getFakeWindowImageOptions = (project, target = 'object') => {
  if (target === 'scene-music') return getFakeWindowAudioOptions(project);
  const tutorialSceneImages = Array.isArray(project?.tutorialExampleImages) ? project.tutorialExampleImages : [];
  const source = target === 'scene-background'
    ? (tutorialSceneImages.length ? tutorialSceneImages : (project?.scenes || [])).map((scene) => ({
      imageData: scene.backgroundData,
      imageName: scene.backgroundName,
      name: scene.name,
    }))
    : (project?.items || []);

  const realImages = source
    .filter((item) => item.imageData)
    .slice(0, 6)
    .map((item) => ({
      name: item.imageName || `${item.name || 'objet'}.png`,
      label: item.name || 'Objet',
      dataUrl: item.imageData,
      isReal: true,
    }));

  if (realImages.length) return realImages;

  return FAKE_WINDOWS_IMAGES.map((file) => ({
    ...file,
    dataUrl: makeTutorialImageDataUrl(file.label, file.color),
    isReal: false,
  }));
};

export const prepareProjectForTutorial = (project, tab) => {
  const nextProject = structuredClone(project);
  if (tab === 'scenes') {
    const existingTutorialImages = Array.isArray(nextProject.tutorialExampleImages) ? nextProject.tutorialExampleImages : [];
    const existingTutorialAudio = Array.isArray(nextProject.tutorialExampleAudio) ? nextProject.tutorialExampleAudio : [];
    const sceneImageExamples = (nextProject.scenes || [])
      .filter((scene) => scene.backgroundData)
      .map((scene) => ({
        name: scene.name,
        backgroundData: scene.backgroundData,
        backgroundName: scene.backgroundName,
      }));
    const sceneAudioExamples = (nextProject.scenes || [])
      .filter((scene) => scene.musicData)
      .map((scene) => ({
        name: scene.name,
        musicData: scene.musicData,
        musicName: scene.musicName,
      }));
    nextProject.tutorialExampleImages = existingTutorialImages.length ? existingTutorialImages : sceneImageExamples;
    nextProject.tutorialExampleAudio = existingTutorialAudio.length ? existingTutorialAudio : sceneAudioExamples;
    const scene = nextProject.scenes?.[0];
    if (scene) {
      scene.name = '';
      scene.introText = '';
      scene.backgroundData = '';
      scene.backgroundName = '';
      scene.musicData = '';
      scene.musicName = '';
      scene.musicLoop = true;
      scene.visualEffect = 'none';
      if (!Array.isArray(scene.hotspots) || scene.hotspots.length === 0) {
        scene.hotspots = [{
          id: `hotspot_${Date.now().toString(36)}`,
          name: '',
          x: 50,
          y: 50,
          width: 14,
          height: 12,
          actionType: 'dialogue',
          dialogue: '',
          requiredItemId: '',
          consumeRequiredItemOnUse: false,
          rewardItemId: '',
          targetSceneId: '',
          targetCinematicId: '',
          enigmaId: '',
          requiredHotspotId: '',
          lockedMessage: '',
          objectImageData: '',
          objectImageName: '',
          hasSecondAction: false,
          secondActionType: 'dialogue',
          secondDialogue: '',
          secondRequiredItemId: '',
          secondConsumeRequiredItemOnUse: false,
          secondRewardItemId: '',
          secondTargetSceneId: '',
          secondTargetCinematicId: '',
          secondEnigmaId: '',
          secondObjectImageData: '',
          secondObjectImageName: '',
          logicRules: [],
        }];
      } else {
        scene.hotspots[0].name = '';
        scene.hotspots[0].actionType = 'dialogue';
      }
    }
  }
  if (tab === 'editor') {
    const scene = nextProject.scenes?.[0];
    if (scene) {
      scene.hotspots = (scene.hotspots || []).map((hotspot) => ({
        ...hotspot,
        tutorialCreated: false,
      }));
      scene.visualEffectZones = (scene.visualEffectZones || []).map((zone) => ({
        ...zone,
        tutorialCreated: false,
      }));
      scene.sceneObjects = (scene.sceneObjects || []).map((object) => ({
        ...object,
        tutorialCreated: false,
      }));
    }
  }
  if (tab === 'map') {
    if (!nextProject.routeMap) nextProject.routeMap = makeRouteMap();
    if (!Array.isArray(nextProject.routeMap.rooms) || nextProject.routeMap.rooms.length === 0) {
      const firstScene = nextProject.scenes?.[0];
      nextProject.routeMap.rooms = [{
        id: `room_${Date.now().toString(36)}`,
        name: firstScene?.name || 'Piece de depart',
        sceneId: firstScene?.id || '',
        x: 28,
        y: 42,
        type: 'start',
      }];
    }
  }
  if (tab === 'combinations' && (!Array.isArray(nextProject.combinations) || nextProject.combinations.length === 0)) {
    if (!Array.isArray(nextProject.combinations)) nextProject.combinations = [];
    nextProject.combinations.push(makeCombination());
  }
  if (tab === 'enigmas' && (!Array.isArray(nextProject.enigmas) || nextProject.enigmas.length === 0)) {
    if (!Array.isArray(nextProject.enigmas)) nextProject.enigmas = [];
    nextProject.enigmas.push(makeEnigma());
  }
  if (tab === 'logic') {
    const scene = nextProject.scenes?.[0];
    const hotspot = scene?.hotspots?.[0];
    if (hotspot && (!Array.isArray(hotspot.logicRules) || hotspot.logicRules.length === 0)) {
      hotspot.logicRules = [makeLogicRule()];
    }
  }
  return nextProject;
};
