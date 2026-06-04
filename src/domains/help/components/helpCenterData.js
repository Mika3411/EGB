export const HELP_MODES = [
  ['manual', "Mode d'emploi"],
  ['faq', 'FAQ'],
  ['missions', 'Missions'],
  ['tutorials', 'Didacticiel'],
  ['forum', 'Forum'],
];

export const HELP_FORUM_STORAGE_KEY = 'escapeGameBuilder.helpForum.v1';

export const HELP_FORUM_CATEGORIES = [
  ['rules', 'Règles', 'Les règles a respecter avant de poster dans le forum.'],
  ['help', 'Entraide', 'Question, blocage, bug de logique ou besoin de regard exterieur.'],
  ['tips', 'Conseils', 'Astuce de creation, méthode, structure narrative ou retour d expérience.'],
  ['promotion', 'Promotion', 'Lien vers un jeu publié, appel à testeurs ou présentation de projet.'],
];

export const HELP_FORUM_DEFAULT_POSTS = [
  {
    id: 'welcome-rules',
    category: 'rules',
    author: 'Escape Game Builder',
    title: 'Règles du forum',
    body: "Avant de poster, reste courtois, clair et utile. Pas d'insultes, de harcèlement, de contenu illégal, de spam, de liens trompeurs ou de promotion répétitive. Pour l'entraide, donne assez de contexte pour qu'on comprenne le problème. Pour les conseils, partage une méthode applicable. Pour la promotion, présente ton jeu honnêtement : durée, public visé, type d'expérience et ce que tu attends comme retour. Les sujets hors cadre peuvent être supprimés.",
    link: '',
    replies: [],
    readOnly: true,
    createdAt: '2026-01-01T08:59:00.000Z',
    updatedAt: '2026-01-01T08:59:00.000Z',
  },
  {
    id: 'welcome-help',
    category: 'help',
    author: 'Escape Game Builder',
    title: "Bienvenue dans l'entraide",
    body: "Utilise cette catégorie pour demander un coup de main : énigme qui ne se lance pas, branche narrative bloquée, condition logique incomprise, bug d'export ou doute sur une scène. Plus ton message donne le contexte, plus les autres créateurs peuvent t'aider vite.",
    link: '',
    replies: [],
    readOnly: true,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  },
  {
    id: 'welcome-tips',
    category: 'tips',
    author: 'Escape Game Builder',
    title: 'Partager une méthode ou une astuce',
    body: "Cette catégorie sert aux conseils : comment structurer un acte, rendre un indice plus clair, tester une aventure ? choix multiples, doser la difficulté, organiser les médias ou préparer une publication. Partage ce qui t'a fait gagner du temps.",
    link: '',
    replies: [],
    readOnly: true,
    createdAt: '2026-01-01T09:01:00.000Z',
    updatedAt: '2026-01-01T09:01:00.000Z',
  },
  {
    id: 'welcome-promotion',
    category: 'promotion',
    author: 'Escape Game Builder',
    title: 'Presenter un jeu ou chercher des testeurs',
    body: "Poste ici les liens de jeux publiés, appels ? testeurs, versions bêta, pages de galerie ou demandes de retours. Décris le type d'expérience, la durée estimée, le public visé et ce que tu veux vérifier : ambiance, énigmes, branches, difficulté ou bugs.",
    link: '',
    replies: [],
    readOnly: true,
    createdAt: '2026-01-01T09:02:00.000Z',
    updatedAt: '2026-01-01T09:02:00.000Z',
  },
];

export const HELP_TUTORIAL_OPTIONS = [
  ['guided_creation', 'Démarrage guidé', 'Construire la première boucle jouable sur le vrai projet : deux scènes, image, sortie cliquable, scène cible et test Preview.'],
  ['profile', 'Profil', 'Comprendre le tableau dé bord, créer ou reprendre un projet, importer une sauvegarde, tester, partager et publier.'],
  ['scenes', 'Scènes', 'Créer une scène, utiliser le canvas, poser des objets visibles, régler les zones d’action et tester le résultat.'],
  ['media', 'Média', 'Régler les images, sons, effets globaux, transitions, minuteurs et aperçus de scène.'],
  ['map', 'Plan', 'Organiser les pièces, relier le parcours, vérifier les connexions réelles et repérer les scènes isolées.'],
  ['adventure', 'Narration', 'Contrôler les conversations a choix multiples, les réponses cachées, les variables d’histoire, les fins et les erreurs de branchement.'],
  ['hero', 'Héros', 'Configurer la fiche Hero Adventure : dé principal, PV, mana, compétences, critiques, puis relier ces valeurs aux tests, combats et objets héros.'],
  ['combat', 'Combat', 'Centraliser les combats Hero Adventure : sources, arène, ennemis, pouvoirs, IA, équilibrage, effets et test direct en Preview.'],
  ['cinematics', 'Cinématiques', 'Construire une séquence narrative avec slides ou vidéo, régler le démarrage du jeu et définir l’action de fin.'],
  ['animation', 'Animation', 'Composer une séquence 2D avec storyboard, calques, retouches, mouvements, verrouillage et prévisualisation.'],
  ['combinations', 'Combinaisons', 'Relier deux objets entre eux, choisir un résultat utile et écrire un retour clair pour le joueur.'],
  ['enigmas', 'Énigmes', 'Créer un défi, régler sa solution, son apparence joueur, son fond de pop-up et son déblocage.'],
  ['logic', 'Logique', 'Déclencher des conséquences selon les objets, énigmes, zones franchies, combinaisons, choix narratifs ou conditions héros.'],
  ['preview', 'Preview', 'Tester le rendu joueur, les dialogues, l’inventaire, les énigmes, les transitions et les sauvegardes.'],
  ['score', 'Bilan', 'Lire la note globale, les dimensions, les points forts, les alertes et le temps de jeu estimé.'],
  ['ai', 'IA', 'Utiliser l’assistant IA, comprendre les crédits, les modes, les brouillons, les validations et les générations d images.'],
];
export const BEGINNER_HELP_TUTORIAL_OPTIONS = new Set(['guided_creation', 'profile', 'scenes', 'media', 'enigmas', 'ai', 'preview']);
export const INTERMEDIATE_HELP_TUTORIAL_OPTIONS = new Set(['guided_creation', 'profile', 'scenes', 'media', 'map', 'hero', 'combat', 'cinematics', 'enigmas', 'ai', 'preview']);

export const BEGINNER_MANUAL_SECTIONS = [
  {
    title: 'Commencer en mode débutant',
    content: [
      'Le mode débutant sert à construire une boucle jouable simple : des scènes, des objets, des zones cliquables, des énigmes et un test en Preview.',
      '',
      'Ordre conseillé :',
      '',
      '1. Crée les scènes principales.',
      '2. Crée les objets utiles dans **Objets**.',
      '3. Ajoute une image de fond dans **Média**.',
      '4. Place les objets visibles et zones cliquables dans **Scènes**.',
      '5. Crée les énigmes dans **Énigmes**.',
      '6. Relie chaque énigme à une zone avec **Énigme liée**.',
      '7. Teste le parcours dans **Preview**.',
    ],
  },
  {
    title: 'Scènes et zones cliquables',
    content: [
      'Dans **Scènes**, la navigation de gauche choisit le lieu, le bloc Général règle le nom et l’introduction, et le canvas sert à placer les objets visibles et les zones cliquables.',
      '',
      'Le menu **Ajouter** du canvas permet de créer une zone d’action ou un objet visible. Le panneau de droite règle ensuite la position, la taille, le dialogue, la destination ou l’objet donné.',
      '',
      'Actions utiles en débutant :',
      '',
      '- **Dialogue** : affiche un texte au joueur.',
      '- **Dialogue + objet** : affiche un texte et donne un objet.',
      '- **Changer de scène** : envoie le joueur vers une autre scène.',
      '',
      'Le champ **Énigme liée** permet de demander une énigme avant de déclencher la suite de la zone.',
    ],
  },
  {
    title: 'Objets',
    content: [
      'Dans **Objets**, crée les éléments que le joueur pourra obtenir ou utiliser comme indices.',
      '',
      'Pour chaque objet, règle surtout :',
      '',
      '- son nom ;',
      '- son image ou son emoji de secours.',
      '',
      'Pour donner un objet au joueur, sélectionne une zone dans **Scènes** et choisis une action qui donne un objet, ou place un objet visible lié à l’inventaire.',
    ],
  },
  {
    title: 'Énigmes',
    content: [
      'Dans **Énigmes**, crée un défi avec une consigne claire et une solution.',
      '',
      'Ensuite, retourne dans **Scènes**, sélectionne la zone concernée et choisis cette énigme dans **Énigme liée**.',
      '',
      'Teste toujours l’énigme en **Preview** après l’avoir reliée à une zone.',
    ],
  },
  {
    title: 'Média',
    content: [
      'Dans **Média**, règle principalement l’image de fond de chaque scène, les effets, les transitions et les sons si ton jeu en a besoin.',
      '',
      'L’aperçu Média vérifie l’ambiance. Pour tester les clics et l’inventaire, passe ensuite dans **Preview**.',
      '',
      'Commence simple : une image lisible par scène vaut mieux qu’un réglage visuel compliqué.',
    ],
  },
  {
    title: 'Preview et sauvegardes',
    content: [
      'La **Preview** montre ce que verra le joueur. Utilise-la après chaque scène, objet ou énigme importante.',
      '',
      'Avant une grosse modification, fais un export JSON pour garder une sauvegarde de ton projet.',
    ],
  },
];

export const BEGINNER_FAQ_ITEMS = [
  {
    question: 'Par quoi commencer en mode débutant ?',
    answer: 'Commence par créer une scène, crée les objets utiles dans Objets, ajoute une image dans Média, place un objet visible ou une zone cliquable dans Scènes, puis teste en Preview. Ensuite ajoute une énigme et teste à nouveau.',
  },
  {
    question: 'Comment lier une énigme à une zone ?',
    answer: 'Crée l’énigme dans l’onglet Énigmes. Puis retourne dans Scènes, sélectionne la zone concernée et choisis cette énigme dans le champ Énigme liée.',
  },
  {
    question: 'Quelle différence entre une scène et une sous-scène ?',
    answer: 'Une scène est un lieu principal. Une sous-scène sert plutôt à montrer un détail ou une variation du même lieu, comme un coffre ouvert ou un document agrandi.',
  },
  {
    question: 'Pourquoi tester souvent en Preview ?',
    answer: 'La Preview permet de vérifier ce que voit vraiment le joueur : textes, zones cliquables, objets obtenus, énigmes et changements de scène.',
  },
  {
    question: 'Pourquoi mon objet n’apparaît pas dans l’inventaire ?',
    answer: 'Vérifie que l’objet existe dans l’onglet Objets, puis que la zone qui doit le donner utilise bien une action qui ajoute cet objet, ou que l’objet visible placé dans Scènes est lié au bon objet d’inventaire.',
  },
  {
    question: 'Pourquoi une énigme créée ne se lance pas ?',
    answer: 'Créer une énigme ne suffit pas. Il faut la relier à une zone dans Scènes avec le champ Énigme liée, puis tester cette zone en Preview.',
  },
  {
    question: 'Est-ce que les didacticiels modifient mon vrai projet ?',
    answer: 'Les didacticiels du builder utilisent un projet temporaire quand c’est nécessaire. Le parcours Profil explique la page actuelle sans créer de projet tout seul.',
  },
  {
    question: 'Quand faire un export JSON ?',
    answer: 'Fais un export JSON avant une grosse modification, avant suppression, avant publication, ou quand une version fonctionne bien.',
  },
];

export const FAQ_ITEMS = [
  {
    question: 'Par quoi commencer quand on découvre le builder ?',
    answer: "Commence par le didacticiel Profil pour comprendre les projets, puis Scènes pour créer les lieux, Objets pour préparer l’inventaire et Média pour poser l’ambiance. Reviens ensuite dans Scènes pour placer objets visibles et zones cliquables. Pour un mode choix multiples, ajoute Narration afin de vérifier les branches. Pour une Hero Adventure, enchaîne Héros, Combat et Preview. Passe ensuite par Énigmes, Logique, Plan et Bilan.",
  },
  {
    question: 'Quelle différence entre une scène et une sous-scène ?',
    answer: 'Une scène est un lieu principal du parcours. Une sous-scène est un détail, un gros plan ou une variation rattachée à ce lieu : tiroir ouvert, coffre, document agrandi, couloir secondaire, version après action. Utilise les sous-scènes pour éviter de multiplier les lieux principaux.',
  },
  {
    question: 'Pourquoi tester souvent en Preview ?',
    answer: 'La Preview montre ce que voit vraiment le joueur. Elle permet de vérifier les dialogues, les zones cliquables, les objets gagnés, l’inventaire, les combinaisons, les énigmes, les transitions, les minuteurs et les changements de scène. Teste après chaque grosse modification : une erreur récente est beaucoup plus facile à retrouver.',
  },
  {
    question: 'À quoi sert le Plan ?',
    answer: "Le Plan sert à voir le parcours d'un seul coup d'œil et à comparer ton intention avec les vraies transitions du jeu. Il aide à repérer les scènes isolées, les retours manquants, les liaisons partielles et les allers simples volontaires.",
  },
  {
    question: 'À quoi sert la Logique narrative dans le Plan ?',
    answer: "Elle résume les choix créés dans les conversations : réponses cachées, variables d'histoire, actions multiples et fins. C'est pratique pour vérifier qu'une bonne fin, une mauvaise fin ou une fin secrète a bien un chemin atteignable.",
  },
  {
    question: 'Comment créer une aventure ? choix multiples ?',
    answer: 'Dans Scènes, mets une zone en action Conversation texte, puis ouvre Modifier la conversation. Ajoute les questions du PNJ, les réponses du joueur, les conditions simples ou avancées combinées en ET/OU, les variables d’histoire, les médias par réponse et les fins. Ensuite ouvre l’onglet Narration pour corriger les branches, puis teste chaque chemin en Preview.',
  },
  {
    question: 'À quoi sert l’onglet Narration ?',
    answer: 'Il sert de tableau de bord narratif. Il compte les choix, réponses cachées, variables et fins, puis signale les problèmes : cible manquante, condition incomplète, variable testée mais jamais modifiée, chemin impossible par plage de variable ou fin sans titre. Il aide à sécuriser une histoire ramifiée avant le test joueur.',
  },
  {
    question: 'Comment lire une grosse conversation ? branches ?',
    answer: 'Dans la pop-up Modifier la conversation, utilise le graphe interactif. Il affiche les questions, les réponses, les flèches vers les suites, les conditions, les variables et les fins. Clique un nœud ou une flèche pour revenir directement au bloc à corriger.',
  },
  {
    question: 'Pourquoi déclarer les variables d’histoire ?',
    answer: 'Le registre officiel évite les fautes de nom entre les réponses. Chaque variable a un type, une valeur de départ, une description et un nom lisible pour le journal joueur. Si une conversation utilise une variable non déclarée, l’onglet Narration affiche une alerte et propose de la déclarer.',
  },
  {
    question: 'À quoi sert le journal joueur ?',
    answer: 'Le journal joueur affiche en Preview et dans l’export les choix déjà faits, les indices ou objets obtenus, et les variables importantes avec un libellé clair. Dans Narration > Variables, active ou désactive l’affichage d’une variable dans le journal et donne-lui un nom lisible.',
  },
  {
    question: 'Comment tester rapidement une branche narrative ?',
    answer: 'Dans l’onglet Narration, utilise le Simulateur de branches. Coche les objets que le joueur possède, marque les énigmes résolues et règle les variables. Le panneau indique alors les réponses visibles, les réponses bloquées et les fins accessibles.',
  },
  {
    question: 'Comment documenter le scénario pour debug ?',
    answer: 'Utilise le bouton Fiche auteur HTML dans la barre du projet. Il exporte une page HTML imprimable avec la vue globale, les branches de conversation, conditions simples ou combinées, effets multiples, variables, fins, objets cités, chemins possibles détectés et transitions de scènes.',
  },
  {
    question: 'Comment retrouver partout où une variable ou un objet est utilisé ?',
    answer: 'Dans l’onglet Narration, utilise Recherche globale narrative. Tape le nom d’une variable, d’un objet, d’une fin, d’une réponse ou un morceau de dialogue. Les résultats indiquent les usages dans les réponses, conditions, effets, fins et diagnostics, avec des boutons pour ouvrir la conversation concernée.',
  },
  {
    question: 'À quoi servent les tags de branche ?',
    answer: 'Les tags de branche sont des étiquettes internes sur les réponses de conversation, par exemple voie_foret, voie_tour, secret ou danger. Ils permettent de filtrer le graphe interactif, de retrouver une branche dans la recherche narrative et de filtrer la fiche auteur HTML.',
  },
  {
    question: 'O? noter mes intentions de scénario ?',
    answer: 'Dans la pop-up Conversation, chaque question et chaque réponse possède une Note auteur. Elle n’est jamais visible par le joueur : elle sert à noter une intention, un indice à placer, une conséquence à vérifier ou une branche à revoir. Ces notes apparaissent dans la recherche narrative et la fiche auteur HTML.',
  },
  {
    question: 'Comment créer une Hero Adventure avec dé, PV, mana et compétences ?',
    answer: 'Crée un projet avec le template Hero Adventure, puis règle la fiche dans l’onglet Héros. Dans Scènes, choisis une zone et utilise Test de compétence ou Combat simple pour automatiser le jet, la difficulté, les coûts de mana, les pertes de PV, les récompenses et les branches de réussite ou d’échec. Teste ensuite dans Preview.',
  },
  {
    question: 'Le jet de dé déclenche-t-il automatiquement une branche ?',
    answer: 'Oui, si tu utilises une action Test de compétence ou Combat simple. Le joueur clique, le jeu lance le dé, ajoute le bonus de compétence, compare à la difficulté et applique la conséquence configurée. Un jet libre depuis le panneau Hero reste surtout un outil de test ou de narration.',
  },
  {
    question: 'Comment fonctionnent les objets héros ?',
    answer: 'Dans l’éditeur d’objet, choisis Effet héros. Une potion de soin rend des PV, une potion de mana rend de la mana, et un équipement ajoute un bonus à une compétence une seule fois. En Preview, le joueur clique l’objet dans l’inventaire pour appliquer l’effet.',
  },
  {
    question: 'Est-ce que la Hero Adventure fonctionne dans l’export jeu ?',
    answer: 'Oui. L’export reprend la fiche héros, les PV, la mana, les tests de compétence, les combats simples, les objets héros, les conditions de logique héros et les sauvegardes joueur. Après un changement de règle, de coût de mana, d’objet ou de scène cible, refais un export et reteste le fichier joueur.',
  },
  {
    question: 'Pourquoi une réponse cachée ou une fin secrète n’apparaît pas ?',
    answer: 'Sa condition n’est probablement pas remplie. Vérifie l’objet requis, la scène visitée, l’énigme résolue, le choix précédent, la variable d’histoire ou une condition avancée combinée. Avec ET, toutes les conditions doivent être vraies. Avec OU, une seule suffit. Les noms de variables doivent être identiques partout, par exemple confiance_du_guide. L’onglet Narration peut aussi signaler une condition incomplète ou une variable jamais modifiée.',
  },
  {
    question: 'Comment détecter une fin impossible ?',
    answer: 'L’onglet Narration calcule une plage minimale et maximale pour les variables numériques. Si une fin demande par exemple confiance_du_guide >= 3 mais que les réponses ne peuvent monter qu à 2, le diagnostic signale une fin probablement impossible et te ramène à la réponse concernée.',
  },
  {
    question: 'Quand utiliser la Logique ?',
    answer: 'Utilise la Logique quand une action doit dépendre d’une condition : posséder un objet, ne pas le posséder, avoir résolu une énigme, avoir lancé une cinématique, avoir réussi une combinaison, franchi une zone, clique une deuxième fois, ou vérifier un état Hero Adventure comme PV bas, mana suffisante, dernier jet réussi ou compétence utilisée. Commence simple : une condition, une conséquence, puis teste.',
  },
  {
    question: 'Est-ce que les didacticiels modifient mon vrai projet ?',
    answer: "Les didacticiels du builder utilisent un projet temporaire quand c'est nécessaire. Le parcours Profil explique la page actuelle sans créer de projet tout seul. Quand un parcours ouvre l’éditeur, le statut indique que le projet de didacticiel n'est pas enregistré.",
  },
  {
    question: 'Que vérifier avant de publier ?',
    answer: 'Teste le jeu du début à la fin, vérifie le point de départ, les zones non reliées, les énigmes sans solution, les objets impossibles à obtenir, les combinaisons utiles, les combats trop faciles ou bloquants, les cinématiques avec action de fin, le Plan, le Bilan, la catégorie, la mention d\'âge et la miniature.',
  },
  {
    question: 'Pourquoi mon objet n’apparaît pas dans l’inventaire ?',
    answer: 'Vérifie que l’objet existe dans la liste d’inventaire, que la zone ou l’objet visible utilise le bon objet lié, et que le mode d’interaction ajoute bien l’objet à l’inventaire. Si une règle logique remplace l’action normale, elle peut aussi empêcher le gain.',
  },
  {
    question: 'Pourquoi une énigme créée ne se lance pas ?',
    answer: 'Une énigme créée dans l’onglet Énigmes n est pas automatiquement jouable. Il faut la relier à une zone d’action, à une règle logique ou à un déclencheur. Teste ensuite la zone dans Preview pour vérifier que la pop-up s ouvre au bon moment.',
  },
  {
    question: 'Comment éviter que le joueur reste bloqué ?',
    answer: 'Ajoute des indices progressifs : dialogue de zone, message d’échec, image pop-up, objet visible, cinématique courte ou deuxième action après un clic inutile. Si plusieurs testeurs bloquent au même endroit, rends l’indice plus visible ou simplifie la dépendance.',
  },
  {
    question: 'À quoi servent les effets et sons de scène ?',
    answer: 'Ils renforcent l’ambiance et guident l’attention. Un effet global donne une couleur à toute la scène, une zone visuelle attire l’œil sur un endroit précis, la musique installe le rythme et un son secondaire ajoute une présence locale. Dose-les pour garder les indices lisibles.',
  },
  {
    question: 'Quand faire un export JSON ?',
    answer: 'Fais un export JSON avant une grosse modification, avant une génération IA sur un projet avancé, avant suppression, avant publication et quand une version fonctionne bien. Le JSON sert à reprendre l’édition, contrairement ? l’export jeu qui sert aux joueurs.',
  },
];
