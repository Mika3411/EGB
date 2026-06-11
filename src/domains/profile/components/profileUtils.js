export const formatDate = (value) => {
  if (!value) return 'Jamais';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Date inconnue';
  }
};

export const CREATION_TEMPLATES = [
  ['empty', 'Projet vide'],
  ['book_hero', 'Livre dont vous êtes le héros'],
  ['adventure_choices', 'Narration choix multiples'],
  ['hero_adventure', 'Aventure de héros'],
  ['narrative_investigation', 'Enquête narrative'],
  ['magic_forest', 'Forêt magique'],
  ['survival_choices', 'Survie'],
  ['npc_dialogue', 'Dialogue PNJ'],
  ['negotiation', 'Négociation'],
  ['narrative_maze', 'Labyrinthe narratif'],
  ['manor', 'Manoir hanté'],
  ['investigation', 'Enquête policière'],
  ['laboratory', 'Laboratoire'],
  ['museum', 'Musée'],
];

export const PUBLIC_CATEGORIES = ['Horreur', 'Enquête', 'Aventure', 'Science-fiction', 'Fantastique', 'Historique', 'Autre'];
export const AGE_RATINGS = ['Tout public', '+18 ans'];
export const PROFILE_TUTORIAL_CARDS = [
  ['profile', 'Profil', 'Comprendre le tableau de bord, les cartes d’action et les pages du profil.'],
  ['scenes', 'Scènes', 'Créer des lieux, placer les zones et tester les passages.'],
  ['media', 'Média', 'Régler images, sons, transitions et ambiance de scène.'],
  ['map', 'Plan', 'Relier les pièces et vérifier les connexions du parcours.'],
  ['adventure', 'Narration', 'Construire des choix multiples, variables et fins narratives.'],
  ['hero', 'Héros', 'Configurer fiche personnage, PV, mana, compétences et tests.'],
  ['combat', 'Combat', 'Préparer ennemis, arènes, pouvoirs et équilibrage.'],
  ['cinematics', 'Cinématiques', 'Composer les séquences narratives et leurs sorties.'],
  ['animation', 'Animation', 'Assembler storyboard, calques, mouvements et prévisualisation.'],
  ['combinations', 'Combinaisons', 'Relier deux objets et définir le résultat obtenu.'],
  ['enigmas', 'Énigmes', 'Créer un défi, régler sa solution et son affichage joueur.'],
  ['logic', 'Logique', 'Déclencher des conséquences selon les actions du joueur.'],
  ['preview', 'Tester', 'Tester le jeu comme un joueur avant de publier.'],
  ['ai', 'IA', 'Utiliser l’assistant IA, les brouillons et les crédits.'],
  ['score', 'Bilan', 'Lire les alertes, points forts, notes et temps estimé.'],
];
