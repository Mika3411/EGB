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
  ['manor', 'Manoir hanté'],
  ['investigation', 'Enquête policière'],
  ['laboratory', 'Laboratoire'],
  ['museum', 'Musée'],
];

export const PUBLIC_CATEGORIES = ['Horreur', 'Enquête', 'Aventure', 'Science-fiction', 'Fantastique', 'Historique', 'Autre'];
export const AGE_RATINGS = ['Tout public', '+18 ans'];
export const PROFILE_TUTORIAL_OPTIONS = [
  ['profile', 'Profil'],
  ['scenes', 'Scenes'],
  ['editor', 'Éditeur'],
  ['map', 'Plan'],
  ['cinematics', 'Cinematics'],
  ['animation', 'Animation'],
  ['combinations', 'Combinaisons'],
  ['enigmas', 'Enigmes'],
  ['logic', 'Logique'],
  ['ai', 'IA'],
];
