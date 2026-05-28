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
  ['book_hero', 'Livre dont vous etes le heros'],
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
export const PROFILE_TUTORIAL_OPTIONS = [
  ['profile', 'Profil'],
  ['guided_creation', 'Démarrage guidé'],
  ['scenes', 'Scènes'],
  ['media', 'Média'],
  ['editor', 'Éditeur'],
  ['map', 'Plan'],
  ['adventure', 'Narration'],
  ['hero', 'Héros'],
  ['combat', 'Combat'],
  ['cinematics', 'Cinématiques'],
  ['animation', 'Animation'],
  ['combinations', 'Combinaisons'],
  ['enigmas', 'Énigmes'],
  ['logic', 'Logique'],
  ['preview', 'Preview'],
  ['ai', 'IA'],
  ['score', 'Bilan'],
];
