export const COLOR_OPTIONS = [
  ['red', 'Rouge'],
  ['blue', 'Bleu'],
  ['green', 'Vert'],
  ['yellow', 'Jaune'],
  ['purple', 'Violet'],
  ['orange', 'Orange'],
  ['white', 'Blanc'],
  ['black', 'Noir'],
];

export const TYPE_LABELS = {
  code: 'Code lettres / chiffres',
  colors: 'Combinaison de couleurs',
  puzzle: 'Puzzle d’image',
  misc: 'Divers',
};

export const DEPRECATED_ENIGMA_TYPES = new Set(['simon', 'rotation', 'dragdrop']);

export const CODE_SKIN_OPTIONS = [
  ['safe-wheels', 'Roulettes de coffre fort'],
  ['digicode', 'Panneau digicode'],
  ['boxes', 'Cases séparées'],
  ['paper-strip', 'Bande papier / ticket'],
];

export const CODE_SKIN_LABELS = Object.fromEntries(CODE_SKIN_OPTIONS);

export const POPUP_OVERLAY_OPTIONS = [
  ['light', 'Clair'],
  ['medium', 'Moyen'],
  ['dark', 'Sombre'],
];

export const POPUP_OVERLAY_GRADIENTS = {
  light: 'linear-gradient(90deg, rgba(15,23,42,.62), rgba(15,23,42,.28))',
  medium: 'linear-gradient(90deg, rgba(15,23,42,.78), rgba(15,23,42,.48))',
  dark: 'linear-gradient(90deg, rgba(15,23,42,.92), rgba(15,23,42,.68))',
};

export const MISC_MODE_OPTIONS = [
  ['free-answer', 'Question / réponse'],
  ['multiple-choice', 'Choix entre réponses'],
  ['true-false', 'Vrai / Faux'],
  ['ordering', 'Remettre dans l’ordre'],
  ['matching', 'Association par paires'],
  ['fill-blank', 'Mot à trous'],
  ['numeric-range', 'Nombre approximatif'],
  ['multi-select', 'Plusieurs bonnes réponses'],
  ['accepted-answers', 'Réponses alternatives acceptées'],
  ['item-select', 'Objet à sélectionner'],
  ['exact-number', 'Nombre exact'],
];

export const MISC_MODES = new Set(MISC_MODE_OPTIONS.map(([value]) => value));

export const IMAGE_PUZZLE_LOGIC_OPTIONS = [
  ['click-zones', 'Puzzle avec zones cliquables'],
  ['progressive-reveal', 'Révélation progressive'],
  ['classic-grid', 'Puzzle classique'],
];

export const IMAGE_PUZZLE_LOGIC_LABELS = Object.fromEntries(IMAGE_PUZZLE_LOGIC_OPTIONS);

export const IMAGE_CUT_STYLE_OPTIONS = [
  ['straight', 'Lignes droites'],
  ['jigsaw', 'Pièces de puzzle'],
  ['torn', 'Papier déchiré'],
  ['crumpled', 'Papier chiffonné'],
  ['shards', 'Éclats irréguliers'],
  ['strips', 'Bandes verticales'],
];

export const IMAGE_CUT_STYLE_LABELS = Object.fromEntries(IMAGE_CUT_STYLE_OPTIONS);

export const COLOR_SWATCHES = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
  white: '#f8fafc',
  black: '#020617',
};

export const COLOR_LOGIC_OPTIONS = [
  ['sequence', 'Suite à reproduire'],
  ['fixed-code', 'Code fixe'],
  ['position-color', 'Position + couleur'],
  ['mastermind', 'Logique Mastermind'],
  ['hidden-clues', 'Indices cachés dans l’environnement'],
  ['color-map', 'Couleurs → chiffres / lettres'],
  ['timing', 'Couleurs + timing'],
  ['mixing', 'Mélange de couleurs'],
];

export const COLOR_LOGIC_LABELS = Object.fromEntries(COLOR_LOGIC_OPTIONS);

export const FIELD_HELP = {
  list: "Liste des énigmes du projet. Sélectionne une énigme pour modifier sa question, sa solution et ce qu’elle débloque.",
  addEnigma: "Crée une nouvelle énigme à configurer. Elle pourra ensuite être liée à une zone d’action dans l’éditeur de scène.",
  name: "Nom interne de l’énigme. Il sert à la retrouver dans les listes et dans les choix de zones d’action.",
  type: "Détermine l’interface joueur: code à saisir, combinaison de couleurs ou puzzle d’image.",
  question: "Consigne affichée au joueur. Elle doit expliquer quoi faire sans forcément donner la solution.",
  solution: "Réponse exacte attendue pour les énigmes de code. Tu peux utiliser des chiffres, des lettres ou un mélange court.",
  miscMode: "Détermine si l’énigme Divers attend une réponse libre ou propose plusieurs choix.",
  miscChoices: "Liste utilisée comme choix proposés, ordre attendu, ou réponses sélectionnables selon le mode Divers.",
  miscPairs: "Paires attendues pour une énigme d’association.",
  miscRange: "Plage numérique acceptée. Le nombre saisi doit être compris entre le minimum et le maximum inclus.",
  miscTargetItem: "Objet que le joueur doit sélectionner pour valider l’énigme.",
  popupBackground: "Image de fond affichée derrière le contenu de la pop-up joueur pour cette énigme.",
  popupBackgroundCrop: "Recadrage du fond de pop-up: zoom et position de l’image derrière la zone d’écriture.",
  popupBackgroundOverlay: "Intensité du voile sombre placé sur l’image pour garder le texte lisible.",
  codeSkin: "Apparence visuelle du code côté joueur. La solution reste la même, seule l’interface change.",
  colorLogic: "Détermine comment le joueur découvre ou vérifie la combinaison de couleurs.",
  colorSequence: "Suite de couleurs à reproduire. L’ordre est important pour les combinaisons.",
  imagePuzzleLogic: "Détermine la mécanique principale du puzzle image: zones à cliquer, révélation ou grille classique.",
  imageCutStyle: "Détermine la forme visuelle du découpage de l’image: lignes droites, pièces de puzzle, papier déchiré, chiffonné ou fragments.",
  imageSource: "Image utilisée comme base pour les puzzles. Elle sera découpée pendant le jeu.",
  gridRows: "Nombre de lignes du découpage. Plus il y en a, plus l’énigme devient difficile.",
  gridCols: "Nombre de colonnes du découpage. Plus il y en a, plus le joueur manipule de pièces.",
  successMessage: "Texte affiché quand le joueur réussit l’énigme. Idéal pour confirmer la découverte ou donner un nouvel indice.",
  failMessage: "Texte affiché quand la réponse est incorrecte. Il peut guider le joueur sans révéler directement la solution.",
  unlockType: "Action déclenchée après réussite: simplement valider l’énigme, ouvrir une scène ou lancer une cinématique.",
  targetScene: "Scène rendue accessible après réussite si le déblocage choisi est un accès à une scène.",
  targetCinematic: "Cinématique lancée après réussite si le déblocage choisi est une cinématique.",
};
