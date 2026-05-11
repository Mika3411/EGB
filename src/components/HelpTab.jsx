import { useEffect, useMemo, useState } from 'react';
import helpText from '../MODE_EMPLOI.md?raw';
import {
  canUseSupabaseForum,
  createForumPostInSupabase,
  createForumReplyInSupabase,
  deleteForumPostFromSupabase,
  deleteForumReplyFromSupabase,
  loadForumPostsFromSupabase,
  subscribeToForumChanges,
  updateForumPostInSupabase,
  updateForumReplyInSupabase,
} from '../lib/forumStorage';
import { showConfirm } from './AccessibleDialog';

const HELP_MODES = [
  ['manual', "Mode d'emploi"],
  ['faq', 'FAQ'],
  ['tutorials', 'Didacticiel'],
  ['forum', 'Forum'],
];

const HELP_FORUM_STORAGE_KEY = 'escapeGameBuilder.helpForum.v1';

const HELP_FORUM_CATEGORIES = [
  ['rules', 'Règles', 'Les règles a respecter avant de poster dans le forum.'],
  ['help', 'Entraide', 'Question, blocage, bug de logique ou besoin de regard exterieur.'],
  ['tips', 'Conseils', 'Astuce de creation, méthode, structure narrative ou retour d expérience.'],
  ['promotion', 'Promotion', 'Lien vers un jeu publié, appel à testeurs ou présentation de projet.'],
];

const HELP_FORUM_DEFAULT_POSTS = [
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

const HELP_TUTORIAL_OPTIONS = [
  ['profile', 'Profil', 'Comprendre le tableau dé bord, créer ou reprendre un projet, importer une sauvegarde, tester, partager et publier.'],
  ['scenes', 'Scènes', 'Créer une scène, choisir son acte, poser une ambiance, ajouter des objets et préparer les médias essentiels.'],
  ['media', 'Média', 'Régler les images, sons, effets globaux, transitions, minuteurs et aperçus de scène.'],
  ['editor', 'Éditeur', 'Manipuler le canvas, ajouter des zones cliquables, des conversations texte, des objets visibles, des effets locaux, puis tester le rendu joueur.'],
  ['map', 'Plan', 'Organiser les pièces, relier le parcours, vérifier les connexions réelles et repérer les scènes isolées.'],
  ['adventure', 'Narration', 'Contrôler les conversations a choix multiples, les réponses cachées, les variables d’histoire, les fins et les erreurs de branchement.'],
  ['hero', 'Héros', 'Configurer la fiche Hero Adventure : dé principal, PV, mana, compétences, critiques, puis relier ces valeurs aux tests, combats et objets héros.'],
  ['cinematics', 'Cinématiques', 'Construire une séquence narrative avec slides ou vidéo, régler le démarrage du jeu et définir l’action de fin.'],
  ['animation', 'Animation', 'Composer une séquence 2D avec storyboard, calques, retouches, mouvements, verrouillage et prévisualisation.'],
  ['combinations', 'Combinaisons', 'Relier deux objets entre eux, choisir un résultat utile et ecrire un retour clair pour le joueur.'],
  ['enigmas', 'Énigmes', 'Créer un défi, régler sa solution, son apparence joueur, son fond de pop-up et son déblocage.'],
  ['logic', 'Logique', 'Declencher des conséquences selon les objets, énigmes, zones franchies, combinaisons, choix narratifs ou conditions héros.'],
  ['preview', 'Preview', 'Tester le rendu joueur, les dialogues, l’inventaire, les énigmes, les transitions et les sauvegardes.'],
  ['score', 'Bilan', 'Lire la note globale, les dimensions, les points forts, les alertes et le temps de jeu estime.'],
  ['ai', 'IA', 'Utiliser l’assistant IA, comprendre les crédits, les modes, les brouillons, les validations et les generations d images.'],
];

const BEGINNER_HELP_TUTORIAL_OPTIONS = new Set(['profile', 'scenes', 'media', 'editor', 'enigmas', 'ai', 'preview']);
const INTERMEDIATE_HELP_TUTORIAL_OPTIONS = new Set(['profile', 'scenes', 'media', 'editor', 'map', 'cinematics', 'enigmas', 'ai', 'preview']);

const BEGINNER_MANUAL_SECTIONS = [
  {
    title: 'Commencer en mode débutant',
    content: [
      'Le mode débutant sert à construire une boucle jouable simple : des scènes, des objets, des zones cliquables, des énigmes et un test en Preview.',
      '',
      'Ordre conseillé :',
      '',
      '1. Crée les scènes principales.',
      '2. Ajoute une image de fond dans **Média**.',
      '3. Place des zones cliquables dans **Scènes**.',
      '4. Crée les objets utiles dans **Objets**.',
      '5. Crée les énigmes dans **Énigmes**.',
      '6. Relie chaque énigme à une zone avec **Énigme liée**.',
      '7. Teste le parcours dans **Preview**.',
    ],
  },
  {
    title: 'Scènes et zones cliquables',
    content: [
      'Dans **Scènes**, une zone cliquable déclenche une action simple.',
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
      'Pour donner un objet au joueur, sélectionne une zone dans **Scènes**, puis choisis une action qui donne un objet.',
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
      'Dans **Média**, règle principalement l’image de fond de chaque scène et les sons si ton jeu en a besoin.',
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

const BEGINNER_FAQ_ITEMS = [
  {
    question: 'Par quoi commencer en mode débutant ?',
    answer: 'Commence par créer une scène, ajoute son image dans Média, place une zone cliquable, puis teste en Preview. Ensuite ajoute un objet ou une énigme, et teste à nouveau.',
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
    answer: 'Vérifie que l’objet existe dans l’onglet Objets, puis que la zone qui doit le donner utilise bien une action qui ajoute cet objet.',
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

const FAQ_ITEMS = [
  {
    question: 'Par quoi commencer quand on decouvre le builder ?',
    answer: 'Commence par le didacticiel Profil pour comprendre les projets, puis Scènes et Éditeur pour créer les lieux, objets et zones cliquables. Pour un mode choix multiples, ajoute Narration afin de vérifier les branches. Passe ensuite par Énigmes, Logique, Plan et Preview. Le plus simple est de créer une petite boucle jouable, de la tester, puis de l enrichir.',
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
    answer: 'Il sert de tableau dé bord narratif. Il compte les choix, réponses cachées, variables et fins, puis signale les problèmes : cible manquante, condition incomplète, variable testée mais jamais modifiée, chemin impossible par plage de variable ou fin sans titre. Il aide à sécuriser une histoire ramifiée avant le test joueur.',
  },
  {
    question: 'Comment lire une grosse conversation ? branches ?',
    answer: 'Dans la pop-up Modifier la conversation, utilise le graphe interactif. Il affiche les questions, les réponses, les flèches vers les suites, les conditions, les variables et les fins. Clique un nœud ou une flèche pour revenir directement au bloc à corriger.',
  },
  {
    question: 'Pourquoi déclarer les variables d’histoire ?',
    answer: 'Le registre officiel évite les fautes de nom entre les réponses. Chaque variable à un type, une valeur de départ, une description et un nom lisible pour le journal joueur. Si une conversation utilise une variable non déclarée, l’onglet Narration affiche une alerte et propose de la déclarer.',
  },
  {
    question: 'À quoi sert le journal joueur ?',
    answer: 'Le journal joueur affiche en Preview et dans l’export les choix déjà faits, les indices ou objets obtenus, et les variables importantes avec un libellé clair. Dans Narration > Variables, active ou desactive l’affichage d’une variable dans le journal et donne-lui un nom lisible.',
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
    question: 'Comment retrouver partout où une variable ou un objet est utilise ?',
    answer: 'Dans l’onglet Narration, utilise Recherche globale narrative. Tape le nom d’une variable, d’un objet, d’une fin, d’une réponse ou un morceau dé dialogue. Les résultats indiquent les usages dans les réponses, conditions, effets, fins et diagnostics, avec des boutons pour ouvrir la conversation concernée.',
  },
  {
    question: 'À quoi servent les tags de branche ?',
    answer: 'Les tags de branche sont des etiquettes internes sur les réponses de conversation, par exemple voie_foret, voie_tour, secret ou danger. Ils permettent de filtrer le graphe interactif, de retrouver une branche dans la recherche narrative et de filtrer la fiche auteur HTML.',
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
    answer: 'Teste le jeu du d?but ? la fin, vérifie le point de départ, les zones non reliées, les énigmes sans solution, les objets impossibles a obtenir, les combinaisons utiles, les cinématiques avec action de fin, le Plan, le Bilan, la catégorie, la mention d??ge et la miniature.',
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

const parseHelpSections = (source) => {
  const lines = String(source || '').split(/\r?\n/);
  const title = lines.find((line) => line.startsWith('# '))?.replace(/^#\s+/, '').trim() || 'Aide';
  const intro = [];
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (line.startsWith('# ')) return;

    const sectionMatch = line.match(/^##\s+(?:\d+\.\s*)?(.+)$/);
    if (sectionMatch) {
      if (current) sections.push(current);
      current = {
        title: sectionMatch[1].trim(),
        content: [],
      };
      return;
    }

    if (current) {
      current.content.push(line);
    } else if (line.trim()) {
      intro.push(line);
    }
  });

  if (current) sections.push(current);
  return { title, intro: intro.join('\n'), sections };
};

const renderInline = (text) => (
  String(text).split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  })
);

const pushList = (blocks, list) => {
  if (!list) return null;
  blocks.push(list);
  return null;
};

const parseMarkdownBlocks = (markdown) => {
  const lines = String(markdown || '').split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      list = pushList(blocks, list);
      return;
    }

    const heading = trimmed.match(/^###\s+(.+)$/);
    if (heading) {
      flushParagraph();
      list = pushList(blocks, list);
      blocks.push({ type: 'heading', text: heading[1] });
      return;
    }

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      list = pushList(blocks, list);
      blocks.push({ type: 'quote', text: quote[1] });
      return;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== 'ordered') {
        list = pushList(blocks, list);
        list = { type: 'ordered', items: [] };
      }
      list.items.push(ordered[2]);
      return;
    }

    const unordered = trimmed.match(/^-\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!list || list.type !== 'unordered') {
        list = pushList(blocks, list);
        list = { type: 'unordered', items: [] };
      }
      list.items.push(unordered[1]);
      return;
    }

    list = pushList(blocks, list);
    paragraph.push(trimmed);
  });

  flushParagraph();
  pushList(blocks, list);
  return blocks;
};

const HelpContent = ({ markdown }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);

  return (
    <div className="help-readable">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return <h3 key={index}>{renderInline(block.text)}</h3>;
        }
        if (block.type === 'paragraph') {
          return <p key={index}>{renderInline(block.text)}</p>;
        }
        if (block.type === 'quote') {
          return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
        }
        if (block.type === 'ordered') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
            </ol>
          );
        }
        if (block.type === 'unordered') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
};

const createForumId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `forum-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const readForumPosts = () => {
  if (typeof window === 'undefined') return [];
  try {
    const posts = JSON.parse(window.localStorage.getItem(HELP_FORUM_STORAGE_KEY) || '[]');
    return mergeForumDefaultPosts(Array.isArray(posts) ? posts : []);
  } catch {
    return HELP_FORUM_DEFAULT_POSTS;
  }
};

const mergeForumDefaultPosts = (posts = []) => {
  const safePosts = Array.isArray(posts) ? posts : [];
  const existingIds = new Set(safePosts.map((post) => post.id));
  return [
    ...safePosts,
    ...HELP_FORUM_DEFAULT_POSTS.filter((post) => !existingIds.has(post.id)),
  ];
};

const writeForumPosts = (posts) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HELP_FORUM_STORAGE_KEY, JSON.stringify(posts));
};

const getForumCategoryLabel = (category) => (
  HELP_FORUM_CATEGORIES.find(([value]) => value === category)?.[1] || 'Entraide'
);

const getForumUserId = (user) => user?.id || user?.email || 'local-user';

const getForumUserName = (user) => (
  user?.name
  || user?.pseudo
  || user?.username
  || user?.email?.split('@')?.[0]
  || 'Createur'
);

const normalizeForumPostsForUser = (posts, currentUserId) => {
  const defaultIds = new Set(HELP_FORUM_DEFAULT_POSTS.map((post) => post.id));
  return mergeForumDefaultPosts(posts).map((post) => {
    const isDefaultPost = defaultIds.has(post.id);
    return {
      ...post,
      ownerId: post.ownerId || (!isDefaultPost ? currentUserId : ''),
      replies: (post.replies || []).map((reply) => ({
        ...reply,
        ownerId: reply.ownerId || (!isDefaultPost ? currentUserId : ''),
      })),
    };
  });
};

const formatForumDate = (value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
};

const HelpForum = ({ user }) => {
  const currentUserId = getForumUserId(user);
  const currentUserName = getForumUserName(user);
  const [posts, setPosts] = useState(() => normalizeForumPostsForUser(readForumPosts(), currentUserId));
  const [activeCategory, setActiveCategory] = useState('all');
  const [draft, setDraft] = useState({
    category: 'help',
    author: currentUserName,
    title: '',
    body: '',
    link: '',
  });
  const [replyDrafts, setReplyDrafts] = useState({});
  const [editingPostId, setEditingPostId] = useState('');
  const [editingPostDraft, setEditingPostDraft] = useState({ category: 'help', title: '', body: '', link: '' });
  const [editingReplyId, setEditingReplyId] = useState('');
  const [editingReplyDraft, setEditingReplyDraft] = useState('');
  const [error, setError] = useState('');
  const [forumStatus, setForumStatus] = useState(() => (canUseSupabaseForum() ? 'Connexion Supabase...' : 'Forum local'));
  const [forumStorageMode, setForumStorageMode] = useState(() => (canUseSupabaseForum() ? 'loading' : 'local'));
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [forumSearch, setForumSearch] = useState('');

  useEffect(() => {
    setPosts((currentPosts) => normalizeForumPostsForUser(currentPosts, currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    writeForumPosts(posts);
  }, [posts]);

  useEffect(() => {
    let cancelled = false;

    const loadRemotePosts = async () => {
      if (!canUseSupabaseForum()) {
        setForumStorageMode('local');
        setForumStatus('Forum local');
        return;
      }

      try {
        const remotePosts = await loadForumPostsFromSupabase();
        if (cancelled) return;
        if (remotePosts) {
          setPosts(normalizeForumPostsForUser(remotePosts, currentUserId));
          setForumStorageMode('supabase');
          setForumStatus('Forum synchronise avec Supabase');
          return;
        }
        setForumStorageMode('local');
        setForumStatus('Tables forum Supabase absentes : mode local');
      } catch (loadError) {
        if (cancelled) return;
        setForumStorageMode('local');
        setForumStatus(`Supabase indisponible : ${loadError.message || 'mode local'}`);
      }
    };

    loadRemotePosts();
    const unsubscribe = subscribeToForumChanges(() => {
      loadRemotePosts();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUserId]);

  const visiblePosts = useMemo(() => {
    const normalizedSearch = forumSearch.trim().toLowerCase();
    return [...posts]
      .filter((post) => activeCategory === 'all' || post.category === activeCategory)
      .filter((post) => {
        if (!normalizedSearch) return true;
        const searchableText = [
          post.title,
          post.body,
          post.author,
          post.link,
          getForumCategoryLabel(post.category),
          ...(post.replies || []).flatMap((reply) => [reply.author, reply.body]),
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(normalizedSearch);
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [activeCategory, forumSearch, posts]);

  const submitPost = async (event) => {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    const link = draft.link.trim();
    if (!title || !body) {
      setError('Titre et message sont obligatoires.');
      return;
    }
    const timestamp = new Date().toISOString();
    const post = {
      id: createForumId(),
      category: draft.category,
      author: draft.author.trim() || currentUserName,
      ownerId: currentUserId,
      title: title.slice(0, 120),
      body: body.slice(0, 1200),
      link,
      replies: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    try {
      if (forumStorageMode === 'supabase') {
        const remotePost = await createForumPostInSupabase({ post, userId: currentUserId });
        if (remotePost) {
          setPosts((currentPosts) => [remotePost, ...currentPosts.filter((entry) => entry.id !== remotePost.id)]);
        } else {
          setForumStorageMode('local');
          setForumStatus('Tables forum Supabase absentes : mode local');
          setPosts((currentPosts) => [post, ...currentPosts]);
        }
      } else {
        setPosts((currentPosts) => [post, ...currentPosts]);
      }
      setDraft({ category: 'help', author: draft.author || currentUserName, title: '', body: '', link: '' });
      setError('');
      setIsComposerOpen(false);
    } catch (submitError) {
      setError(submitError.message || 'Publication impossible avec Supabase.');
    }
  };

  const submitReply = async (event, postId) => {
    event.preventDefault();
    const replyText = String(replyDrafts[postId] || '').trim();
    if (!replyText) return;
    const reply = {
      id: createForumId(),
      author: currentUserName,
      ownerId: currentUserId,
      body: replyText.slice(0, 800),
      createdAt: new Date().toISOString(),
    };
    try {
      const savedReply = forumStorageMode === 'supabase'
        ? await createForumReplyInSupabase({ postId, reply, userId: currentUserId })
        : reply;
      const nextReply = savedReply || reply;
      setPosts((currentPosts) => currentPosts.map((post) => (
        post.id === postId
          ? { ...post, replies: [...(post.replies || []), nextReply], updatedAt: nextReply.createdAt }
          : post
      )));
      setReplyDrafts((currentDrafts) => ({ ...currentDrafts, [postId]: '' }));
      setError('');
    } catch (submitError) {
      setError(submitError.message || 'Réponse impossible avec Supabase.');
    }
  };

  const canEditPost = (post) => !post.readOnly && post.ownerId === currentUserId;
  const canEditReply = (reply) => reply.ownerId === currentUserId;

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditingPostDraft({
      category: post.category || 'help',
      title: post.title || '',
      body: post.body || '',
      link: post.link || '',
    });
  };

  const submitPostEdit = async (event, postId) => {
    event.preventDefault();
    const title = editingPostDraft.title.trim();
    const body = editingPostDraft.body.trim();
    if (!title || !body) return;
    const timestamp = new Date().toISOString();
    const patch = {
      category: editingPostDraft.category,
      title: title.slice(0, 120),
      body: body.slice(0, 1200),
      link: editingPostDraft.link.trim(),
      updatedAt: timestamp,
    };
    try {
      if (forumStorageMode === 'supabase') {
        await updateForumPostInSupabase({ postId, patch, userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.map((post) => (
        post.id === postId && canEditPost(post)
          ? { ...post, ...patch }
          : post
      )));
      setEditingPostId('');
      setError('');
    } catch (submitError) {
      setError(submitError.message || 'Modification impossible avec Supabase.');
    }
  };

  const startEditReply = (reply) => {
    setEditingReplyId(reply.id);
    setEditingReplyDraft(reply.body || '');
  };

  const submitReplyEdit = async (event, postId, replyId) => {
    event.preventDefault();
    const body = editingReplyDraft.trim();
    if (!body) return;
    const timestamp = new Date().toISOString();
    try {
      if (forumStorageMode === 'supabase') {
        await updateForumReplyInSupabase({ replyId, body: body.slice(0, 800), userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          updatedAt: timestamp,
          replies: (post.replies || []).map((reply) => (
            reply.id === replyId && canEditReply(reply)
              ? { ...reply, body: body.slice(0, 800), updatedAt: timestamp }
              : reply
          )),
        };
      }));
      setEditingReplyId('');
      setEditingReplyDraft('');
      setError('');
    } catch (submitError) {
      setError(submitError.message || 'Modification impossible avec Supabase.');
    }
  };

  const deletePost = async (postId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer le sujet',
      message: 'Supprimer ce sujet du forum ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      if (forumStorageMode === 'supabase') {
        await deleteForumPostFromSupabase({ postId, userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId || !canEditPost(post)));
      setError('');
    } catch (deleteError) {
      setError(deleteError.message || 'Suppression impossible avec Supabase.');
    }
  };

  const deleteReply = async (postId, replyId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer la réponse',
      message: 'Supprimer cette réponse du forum ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      if (forumStorageMode === 'supabase') {
        await deleteForumReplyFromSupabase({ replyId, userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.map((post) => {
        if (post.id !== postId) return post;
        const replies = (post.replies || []).filter((reply) => reply.id !== replyId || !canEditReply(reply));
        return { ...post, replies, updatedAt: new Date().toISOString() };
      }));
      setError('');
    } catch (deleteError) {
      setError(deleteError.message || 'Suppression impossible avec Supabase.');
    }
  };

  return (
    <div className="help-forum">
      <div className="help-forum-toolbar">
        <label className="help-forum-search">
          <span>Recherche mots clés</span>
          <input
            type="search"
            value={forumSearch}
            onChange={(event) => setForumSearch(event.target.value)}
            placeholder="Énigme, bug, lien, auteur..."
          />
        </label>
        <div className="help-forum-toolbar-actions">
          <span className={`project-sync-badge ${forumStorageMode === 'supabase' ? 'synced' : 'offline'}`}>
            {forumStatus}
          </span>
          {forumSearch ? (
            <button type="button" className="secondary-action" onClick={() => setForumSearch('')}>Effacer</button>
          ) : null}
          <button type="button" className="profile-action-button" onClick={() => setIsComposerOpen(true)}>
            Ouvrir nouveau sujet
          </button>
        </div>
      </div>

      {isComposerOpen ? (
        <div className="help-forum-modal-backdrop" role="presentation" onMouseDown={() => setIsComposerOpen(false)}>
          <div className="help-forum-modal panel" role="dialog" aria-modal="true" aria-labelledby="help-forum-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <div>
                <span className="section-kicker">Forum</span>
                <h2 id="help-forum-modal-title">Nouveau sujet</h2>
              </div>
              <button type="button" className="secondary-action" onClick={() => setIsComposerOpen(false)}>Fermer</button>
            </div>
            <form className="help-forum-composer" onSubmit={submitPost}>
              <div className="grid-two small-gap">
                <div>
                  <label>Catégorie</label>
                  <select
                    value={draft.category}
                    onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, category: event.target.value }))}
                  >
                    {HELP_FORUM_CATEGORIES.filter(([value]) => value !== 'rules').map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Nom affiche</label>
                  <input
                    value={draft.author}
                    onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, author: event.target.value }))}
                    placeholder="Createur"
                  />
                </div>
              </div>
              <label>Titre du sujet</label>
              <input
                value={draft.title}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
                placeholder="Ex. Comment rendre cette énigme moins obscure ?"
                maxLength={120}
              />
              <label>Message</label>
              <textarea
                value={draft.body}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, body: event.target.value }))}
                placeholder="Explique ton blocage, ton conseil, ou présente ton jeu..."
                maxLength={1200}
              />
              <label>Lien de jeu ou ressource</label>
              <input
                value={draft.link}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, link: event.target.value }))}
                placeholder="https://..."
              />
              {error ? <p className="auth-error">{error}</p> : null}
              <div className="help-forum-modal-actions">
                <button type="button" className="secondary-action" onClick={() => setIsComposerOpen(false)}>Annuler</button>
                <button type="submit" className="profile-action-button">Publier le sujet</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="help-forum-board">
        <nav className="help-forum-filters" aria-label="Filtrer le forum">
          <button type="button" className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>
            Tous
          </button>
          {HELP_FORUM_CATEGORIES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={activeCategory === value ? 'active' : ''}
              onClick={() => setActiveCategory(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="help-forum-list">
          {visiblePosts.length ? visiblePosts.map((post) => (
            <article key={post.id} className={`help-forum-post ${post.category}`}>
              <div className="help-forum-post-head">
                <div>
                  <span className="section-kicker">{getForumCategoryLabel(post.category)}</span>
                  <h3>{post.title}</h3>
                  <p className="small-note">
                    {post.author || 'Createur'} - {formatForumDate(post.createdAt)}
                  </p>
                </div>
                {canEditPost(post) ? (
                  <div className="help-forum-actions">
                    <button type="button" className="secondary-action compact" onClick={() => startEditPost(post)}>Modifier</button>
                    <button type="button" className="danger-button compact" onClick={() => deletePost(post.id)}>Supprimer</button>
                  </div>
                ) : null}
              </div>
              {editingPostId === post.id ? (
                <form className="help-forum-edit-form" onSubmit={(event) => submitPostEdit(event, post.id)}>
                  <select
                    value={editingPostDraft.category}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, category: event.target.value }))}
                  >
                    {HELP_FORUM_CATEGORIES.filter(([value]) => value !== 'rules').map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    value={editingPostDraft.title}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
                    maxLength={120}
                  />
                  <textarea
                    value={editingPostDraft.body}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, body: event.target.value }))}
                    maxLength={1200}
                  />
                  <input
                    value={editingPostDraft.link}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, link: event.target.value }))}
                    placeholder="https://..."
                  />
                  <div className="help-forum-actions">
                    <button type="button" className="secondary-action" onClick={() => setEditingPostId('')}>Annuler</button>
                    <button type="submit" className="profile-action-button">Enregistrer</button>
                  </div>
                </form>
              ) : (
                <>
                  <p>{post.body}</p>
                  {post.link ? (
                    <a className="help-forum-link" href={post.link} target="_blank" rel="noreferrer">
                      Ouvrir le lien partage
                    </a>
                  ) : null}
                </>
              )}
              {(post.replies || []).length ? (
                <div className="help-forum-replies">
                  {post.replies.map((reply) => (
                    <div key={reply.id} className="help-forum-reply">
                      <div className="help-forum-reply-head">
                        <div>
                          <strong>{reply.author || 'Createur'}</strong>
                          <span>{formatForumDate(reply.createdAt)}</span>
                        </div>
                        {canEditReply(reply) ? (
                          <div className="help-forum-actions">
                            <button type="button" className="secondary-action compact" onClick={() => startEditReply(reply)}>Modifier</button>
                            <button type="button" className="danger-button compact" onClick={() => deleteReply(post.id, reply.id)}>Supprimer</button>
                          </div>
                        ) : null}
                      </div>
                      {editingReplyId === reply.id ? (
                        <form className="help-forum-edit-form" onSubmit={(event) => submitReplyEdit(event, post.id, reply.id)}>
                          <textarea
                            value={editingReplyDraft}
                            onChange={(event) => setEditingReplyDraft(event.target.value)}
                            maxLength={800}
                          />
                          <div className="help-forum-actions">
                            <button type="button" className="secondary-action" onClick={() => setEditingReplyId('')}>Annuler</button>
                            <button type="submit" className="profile-action-button">Enregistrer</button>
                          </div>
                        </form>
                      ) : (
                        <p>{reply.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {!post.readOnly ? (
                <form className="help-forum-reply-form" onSubmit={(event) => submitReply(event, post.id)}>
                  <input
                    value={replyDrafts[post.id] || ''}
                    onChange={(event) => setReplyDrafts((currentDrafts) => ({ ...currentDrafts, [post.id]: event.target.value }))}
                    placeholder="Répondre à ce sujet..."
                  />
                  <button type="submit" className="secondary-action">Repondre</button>
                </form>
              ) : (
                <p className="small-note">Sujet d'information : les réponses sont desactivees.</p>
              )}
            </article>
          )) : (
            <div className="empty-state-inline">
              <div>
                <strong>Aucun sujet pour le moment</strong>
                <p className="small-note">Publie une question, un conseil ou un lien de jeu pour amorcer le forum.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function HelpTab({ user, projectMode = 'expert', onStartTutorial }) {
  const help = useMemo(() => parseHelpSections(helpText), []);
  const [activeMode, setActiveMode] = useState('manual');
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState('');
  const manualSections = useMemo(() => (
    projectMode === 'beginner' ? BEGINNER_MANUAL_SECTIONS : help.sections
  ), [help.sections, projectMode]);
  const visibleFaqItems = projectMode === 'beginner' ? BEGINNER_FAQ_ITEMS : FAQ_ITEMS;
  const visibleTutorialOptions = useMemo(() => (
    projectMode === 'beginner'
      ? HELP_TUTORIAL_OPTIONS.filter(([value]) => BEGINNER_HELP_TUTORIAL_OPTIONS.has(value))
      : projectMode === 'intermediate'
        ? HELP_TUTORIAL_OPTIONS.filter(([value]) => INTERMEDIATE_HELP_TUTORIAL_OPTIONS.has(value))
        : HELP_TUTORIAL_OPTIONS
  ), [projectMode]);
  useEffect(() => {
    if (activeIndex >= manualSections.length) setActiveIndex(0);
  }, [activeIndex, manualSections.length]);
  const activeSection = manualSections[activeIndex] || manualSections[0];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredSections = normalizedSearch
    ? manualSections
      .map((section, index) => ({ ...section, index }))
      .filter((section) => (
        section.title.toLowerCase().includes(normalizedSearch)
        || section.content.join('\n').toLowerCase().includes(normalizedSearch)
      ))
    : manualSections.map((section, index) => ({ ...section, index }));

  return (
    <div className="help-layout">
      <aside className="panel help-nav-card">
        <div className="panel-head panel-head-stack help-panel-head">
          <div>
            <span className="section-kicker">Aide</span>
            <h2>Aide</h2>
          </div>
        </div>

        <div className="help-mode-switch" role="tablist" aria-label="Sections principales de l'aide">
          {HELP_MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeMode === value}
              className={activeMode === value ? 'active' : ''}
              onClick={() => setActiveMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeMode === 'manual' ? (
          <>
            <label className="help-search">
              <span>Rechercher dans l'aide</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Scène, énigme, export..."
              />
            </label>

            <nav className="help-section-nav" aria-label="Sections d'aide">
              {filteredSections.map((section) => (
                <button
                  key={section.title}
                  type="button"
                  aria-current={section.index === activeIndex ? 'page' : undefined}
                  className={`help-nav-item${section.index === activeIndex ? ' active' : ''}`}
                  onClick={() => setActiveIndex(section.index)}
                >
                  <span>{String(section.index + 1).padStart(2, '0')}</span>
                  <strong>{section.title}</strong>
                </button>
              ))}
              {!filteredSections.length ? (
                <p className="small-note help-empty-search">Aucune section trouvée.</p>
              ) : null}
            </nav>
          </>
        ) : null}
      </aside>

      <article className="panel help-content-panel">
        {activeMode === 'manual' && activeSection ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Mode d'emploi</span>
                <h2>{help.title}</h2>
                <p className="small-note">{activeSection.title}</p>
              </div>
            </div>
            <HelpContent markdown={activeSection.content.join('\n').trim()} />
          </>
        ) : null}

        {activeMode === 'faq' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">FAQ</span>
                <h2>Questions frequentes</h2>
                <p className="small-note">Les réponses rapides aux blocages les plus courants.</p>
              </div>
            </div>
            <div className="help-faq-list">
              {visibleFaqItems.map((item) => (
                <details key={item.question} className="help-faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </>
        ) : null}

        {activeMode === 'tutorials' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Didacticiel</span>
                <h2>Choisir un parcours</h2>
                <p className="small-note">Lance un parcours guide pour apprendre une partie précise du builder.</p>
              </div>
            </div>
            <div className="help-tutorial-grid">
              {visibleTutorialOptions.map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  className="help-tutorial-card"
                  onClick={() => onStartTutorial?.(value)}
                >
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {activeMode === 'forum' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Forum</span>
                <h2>Entraide, conseils et jeux ? tester</h2>
                <p className="small-note">Pose une question, partage une astuce ou fais la promotion d'un lien de jeu.</p>
              </div>
            </div>
            <HelpForum user={user} />
          </>
        ) : null}

        {activeMode === 'manual' && !activeSection ? (
          <p>Aucune aide disponible.</p>
        ) : null}
      </article>
    </div>
  );
}
