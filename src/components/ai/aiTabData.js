export const FIELD_HELP = {
  title: "Nom du jeu. Si tu laisses vide, l'IA invente un titre cohérent avec le thème.",
  story: "Base narrative du jeu: situation de départ, mystère, objectif final. Vide = l'IA invente.",
  characters: "Personnages importants, alliés, antagonistes, voix entendues, victimes ou suspects. Vide = distribution aléatoire.",
  places: "Lieux imposés ou ambiance géographique. Vide = l'IA choisit les lieux selon le thème.",
  constraints: "Contraintes libres: public visé, choses interdites, twist obligatoire, style d'énigmes, fin souhaitée. Vide = choix aléatoires.",
  theme: "Thème principal de l'histoire: manoir, station spatiale, enquête policière, laboratoire, musée...",
  difficulty: "Influence la complexité des énigmes, le nombre de dépendances et les conditions de déblocage.",
  actCount: "Grandes parties de l'histoire. Un acte contient plusieurs scènes.",
  sceneCount: "Nombre de scènes principales à générer.",
  subsceneCount: "Nombre de sous-scènes rattachées à des scènes principales.",
  itemCount: "Objets d'inventaire qui pourront être trouvés, requis ou combinés.",
  heroBonusObjects: "Demande à l'IA de transformer une partie des objets en potions ou équipements Hero aventure. Les équipements peuvent augmenter une compétence, les PV max ou la mana max.",
  enigmaCount: "Énigmes créées et reliées aux zones d'action.",
  combinationCount: "Obligatoire. Combinaisons d'objets à créer. Exemple: clé + ruban = clé aimantée.",
  cinematicCount: "Cinématiques narratives créées avec des slides textuelles.",
  improve: "L'IA garde la structure de la scène et modifie seulement ambiance, dialogues et objets.",
  mode: "Choisit le type d'aide IA: créer un récit complet, avancer acte par acte, continuer un projet existant ou améliorer une scène précise.",
  tone: "Ambiance d'écriture utilisée pour les textes, dialogues et descriptions. Exemple: mystérieux, drôle, horrifique, poétique, réaliste.",
  duration: "Temps de jeu visé. L'IA s'en sert pour doser le nombre d'étapes, d'indices et de détours narratifs.",
  enrichmentType: "Définit ce que l'étape d'enrichissement doit renforcer en priorité: textes, descriptions visuelles, zones d'action ou tout ensemble.",
  source: "Projet utilisé comme base pour la continuation. Le projet actuel vient de l'éditeur, le JSON importé permet de repartir d'une sauvegarde externe.",
  importJson: "Charge un projet JSON existant pour que l'IA puisse le continuer sans dépendre du projet actuellement ouvert.",
  instruction: "Consigne libre pour guider l'IA. Plus elle est concrète, plus le résultat respectera ton intention.",
  storySummary: "Résumé de l'histoire déjà jouée. Il sert à garder la suite cohérente avec les révélations et enjeux actuels.",
  sceneChronology: "Ordre chronologique canonique. Numérote les scènes dans l'ordre de l'histoire; la suite partira de la dernière ligne.",
  continuationWish: "Direction souhaitée pour la suite. Laisse vide pour demander une suite aléatoire mais cohérente.",
  continuationScene: "Scène exacte depuis laquelle l'histoire doit continuer. La nouvelle scène doit être reliée à celle-ci.",
  extendInstruction: "Ajoute une contrainte ou une idée à la continuation: nouveau lieu, type d'énigme, objet important, révélation, ton souhaité...",
  visualConstraints: "Contraintes données au générateur d'image pour cette scène. Liste les éléments qui doivent être visibles et leur placement approximatif.",
  imagePrompt: "Prompt image fourni par l'IA. Tu peux le retoucher avant de générer l'image correspondante.",
};

export const IMAGE_STYLE_PRESETS = {
  realistic: {
    label: 'Réaliste',
    description: 'cinématique photoréaliste, textures naturelles, lumière de film, profondeur et détails réalistes',
  },
  illustrated: {
    label: 'BD / manga',
    description: 'illustration BD manga adulte, encrage fin, contours expressifs, ombres dessinées, rendu cinématographique stylisé',
  },
};

export const GLOBAL_VISUAL_STYLE_PRESETS = {
  realistic: 'réaliste, mystérieux mais clairement éclairé, manoir ancien, caméra large, zones interactives visibles, ombres détaillées non bouchées',
  illustrated: 'anime / BD adulte, nuit cinématique lisible, contours expressifs, personnages dramatiques, décors détaillés, zones interactives visibles',
};
