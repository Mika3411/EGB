import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gift,
  Link2,
  MapPinned,
  Palette,
  Pause,
  Play,
  QrCode,
  ScanLine,
  Sparkles,
  Ticket,
} from 'lucide-react';
import bannerImage from '../../assets/header-banner.png';
import aiActionsImage from '../../assets/landing-ai-actions.png';
import builderPreviewImage from '../../assets/landing-builder-home.jpeg';
import cinematicsImage from '../../assets/landing-cinematics.png';
import conditionsImage from '../../assets/landing-conditions.png';
import creationModeImage from '../../assets/landing-creation-mode.png';
import enigmasImage from '../../assets/landing-enigmas.png';
import gameGalleryImage from '../../assets/landing-game-gallery.png';
import galleryPageImage from '../../assets/landing-gallery-page.png';
import inventoryImage from '../../assets/landing-inventory.png';
import linkTestsImage from '../../assets/landing-link-tests.jpeg';
import playerPageImage from '../../assets/landing-player-page.png';
import ratingImage from '../../assets/landing-rating.png';
import reviewsImage from '../../assets/landing-reviews.png';
import scoreBilanImage from '../../assets/landing-score-bilan.png';
import { ACCOUNT_TYPE_PRO } from '../../shared/services/accountPlans';

const featureCards = [
  ['À vos couleurs', 'Remplacez les images, textes et zones cliquables du template par l’ambiance de votre salle.'],
  ['Structure simple', 'Une scène principale suffit pour créer une porte d’entrée claire avant ou après la partie.'],
  ['Actions au choix', 'Ajoutez les boutons utiles à votre contexte : indice, map, bonus, bon cadeau, avis ou autre salle.'],
  ['Sans remplacer vos outils', 'Escape Game Studio complète votre site et vos supports existants avec une couche interactive dédiée à l’immersion.', 'landing-card-wide'],
];

const workflowSteps = [
  'Choisir le moment : avant, après ou bonus.',
  'Remplacer les visuels et les textes.',
  'Placer les boutons d’action.',
  'Tester le rendu sur mobile.',
  'Publier quand le parcours tient debout.',
];

const proofItems = [
  {
    title: 'Base prête à jouer',
    text: 'Un modèle court, déjà structuré.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Personnalisation rapide',
    text: 'Images, textes et boutons à vos couleurs.',
    icon: Sparkles,
  },
  {
    title: 'Gratuit établissement',
    text: 'Accès offert quand la page est rattachée à une salle vérifiée.',
    icon: QrCode,
  },
  {
    title: 'Sortie libre',
    text: 'Finissez sur votre action clé.',
    icon: CalendarCheck,
  },
];

const playerPreviewPoints = [
  'Une page mobile à vos couleurs, sans accès au builder.',
  'Un texte court, une ambiance, quelques boutons clairs.',
  'Une sortie vers vos propres pages : réservation, cadeau, avis, suite.',
];

const businessAnswers = [
  ['Temps de création', 'Un premier prologue simple se prépare en 15 à 30 minutes à partir d’un template, hors création de nouveaux visuels.'],
  ['Prix', 'Gratuit pour les établissements vérifiés. Les packs payants restent optionnels pour gagner du temps ou enrichir vos pages.'],
  ['Vérification', 'Envoyez une preuve que vous contrôlez la salle : email professionnel, accès à la fiche Google Business, extrait Kbis, facture ou document administratif récent au nom de l’établissement. Une page contact publique ne suffit pas.'],
  ['Hébergement', 'Inclus pour les pages publiées par un établissement vérifié. Vous pouvez aussi exporter un ZIP autonome.'],
  ['QR exportable', 'Oui. Les établissements vérifiés peuvent générer et télécharger un QR code PNG vers la version joueur publiée.'],
  ['Statistiques de clic', 'Incluses pour les liens Pro : clics totaux, 7 jours, 30 jours, visiteurs uniques et détail par zone cliquée.'],
  ['Logiciel de réservation', 'Compatibilité par lien externe : le dernier bouton peut envoyer vers votre propre outil. Pas d’intégration native requise.'],
  ['RGPD', 'Aucun compte joueur n’est nécessaire pour jouer. Les données de clic restent limitées à la mesure du parcours et la politique de confidentialité encadre l’usage.'],
];

const marketingTabs = [
  {
    id: 'prologue',
    label: 'Prologue',
    icon: Sparkles,
    kicker: 'Avant la partie',
    title: 'Personnalisez une page prologue avant l’accueil.',
    description: 'Installez le ton avant l’arrivée : une image forte, quelques lignes d’histoire, deux ou trois interactions et les joueurs entrent déjà dans votre univers.',
    bullets: [
      'Briefing immersif avant l’arrivée en salle.',
      'Images, textes et zones cliquables aux couleurs de votre salle.',
      'Consignes intégrées sans casser la narration.',
      'Action finale adaptée à votre organisation.',
    ],
    cards: [
      ['Page d’avant-partie', 'Un modèle court qui prépare les joueurs sans alourdir l’accueil.'],
      ['Accueil plus fluide', 'Les joueurs arrivent déjà engagés dans l’univers.'],
      ['Univers renforcé', 'Chaque prologue reprend vos couleurs, votre histoire et vos visuels.'],
      ['Repères utiles', 'Ajoutez les éléments pratiques sans les sortir de la fiction.'],
    ],
  },
  {
    id: 'epilogue',
    label: 'Épilogue',
    icon: BadgeCheck,
    kicker: 'Après la sortie',
    title: 'Personnalisez une page épilogue après la sortie.',
    description: 'Après la photo d’équipe, donnez une vraie conclusion : débrief, scène cachée, score narratif, message du personnage ou récompense liée à leur partie.',
    bullets: [
      'Conclusion narrative après la partie physique.',
      'Récompense ou scène secrète selon le résultat.',
      'Invitation naturelle à prolonger l’expérience.',
      'Support réutilisable sur comptoir, photo souvenir ou page post-game.',
    ],
    cards: [
      ['Débrief immersif', 'Donnez une vraie fin à l’histoire au lieu d’un simple message.'],
      ['Avis mieux contextualisé', 'Demandez un retour quand l’émotion est encore chaude.'],
      ['Suite naturelle', 'Présentez la salle qui continue le mieux l’aventure.'],
      ['Page souvenir', 'Les joueurs repartent avec une page jouable liée à leur équipe.'],
    ],
  },
  {
    id: 'bonus',
    label: 'Bonus',
    icon: Gift,
    kicker: 'Réactivation',
    title: 'Déclinez le template en bonus, indice ou teaser.',
    description: 'Utilisez le même format pour une mini-mission, un teaser de nouvelle salle ou une chasse aux indices liée à votre marque. Le tout reste léger à produire.',
    bullets: [
      'Page autonome pour relancer votre audience.',
      'Teaser jouable pour une salle à venir.',
      'Indices, objets, cinématiques et conditions simples.',
      'Fin ouverte vers l’action de votre choix.',
    ],
    cards: [
      ['Newsletter', 'Remplacez une annonce statique par une mission à résoudre.'],
      ['Réseaux sociaux', 'Diffusez une accroche jouable plutôt qu’un visuel statique.'],
      ['Événement local', 'Créez une expérience courte pour salon, office ou partenariat.'],
      ['Fidélisation', 'Offrez une suite aux équipes qui ont déjà terminé une salle.'],
    ],
  },
];

const galleryItems = [
  {
    title: 'Template jouable',
    kicker: 'No-code',
    description: 'Personnalisez une page prête à jouer avec images, textes, zones cliquables et liens externes.',
    image: builderPreviewImage,
    alt: 'Aperçu du builder avec une scène et ses zones interactives',
  },
  {
    title: 'Départ rapide',
    kicker: 'Prologue ou bonus',
    description: 'Partez d’un mode guidé, d’un template ou d’une structure vide selon le niveau de contrôle voulu.',
    image: creationModeImage,
    alt: "Mode de création avec templates et bouton d'aide guidée",
  },
  {
    title: 'Tests de clics',
    kicker: 'Test joueur',
    description: 'Vérifiez le comportement de chaque zone avant de mettre le support en circulation.',
    image: linkTestsImage,
    alt: 'Plan du jeu avec test des liens et parcours joueur en temps réel',
  },
  {
    title: 'Validation',
    kicker: 'Contrôle qualité',
    description: 'Relisez le bilan, les blocages potentiels et la cohérence globale avant de diffuser au public.',
    image: scoreBilanImage,
    alt: 'Bilan du projet avec note globale, scores par dimension et expérience estimée',
  },
  {
    title: 'Publication',
    kicker: 'Lien partageable',
    description: 'Générez une version autonome que vos joueurs peuvent ouvrir sans accéder au builder.',
    image: galleryPageImage,
    alt: 'Galerie publique avec les escape games à découvrir',
  },
  {
    title: 'Page joueur',
    kicker: 'Mobile ready',
    description: 'Les joueurs ouvrent l’expérience, suivent le scénario et retrouvent vos appels à l’action.',
    image: playerPageImage,
    alt: 'Page joueur avec image du jeu, note et avis',
  },
];

const builderProofItems = [
  {
    title: 'Builder complet',
    text: 'Structurez scènes, objets, énigmes, cinématiques et conditions depuis un seul studio.',
    icon: Palette,
  },
  {
    title: 'Logique testable',
    text: 'Reliez les actions, vérifiez les sorties et corrigez les blocages avant publication.',
    icon: CheckCircle2,
  },
  {
    title: 'IA optionnelle',
    text: 'Démarrez plus vite avec des propositions, puis gardez la main sur chaque détail.',
    icon: Sparkles,
  },
  {
    title: 'Partage joueur',
    text: 'Publiez une version jouable pour tester, montrer ou diffuser votre escape game.',
    icon: Link2,
  },
];

const builderFeatureCards = [
  ['Création guidée', 'Partez d’un projet vide, d’un template narratif ou d’un mode héros selon le type d’expérience à construire.'],
  ['Scènes interactives', 'Placez des zones cliquables, textes, images, sons, objets et effets visuels dans chaque écran.'],
  ['Énigmes et conditions', 'Ajoutez codes, choix, inventaire, embranchements, règles logiques et fins alternatives.'],
  ['Bilan avant publication', 'Le score de projet aide à repérer incohérences, liens cassés, parcours incomplets et risques de gameplay.', 'landing-card-wide'],
];

const builderWorkflowSteps = [
  'Créer un projet ou choisir un template.',
  'Composer les scènes et les zones interactives.',
  'Ajouter objets, énigmes, règles et cinématiques.',
  'Tester le parcours joueur complet.',
  'Publier ou partager une version jouable.',
];

const builderGalleryItems = [
  galleryItems[0],
  galleryItems[1],
  {
    title: 'Média et ambiance',
    kicker: 'Personnalisation',
    description: 'Ajoutez images, musiques, fonds, objets et effets pour donner une identité claire à chaque scène.',
    image: inventoryImage,
    alt: 'Inventaire et médias utilisés dans un escape game',
  },
  {
    title: 'Énigmes',
    kicker: 'Gameplay',
    description: 'Codes, choix, validations et retours joueur permettent de construire un vrai parcours interactif.',
    image: enigmasImage,
    alt: 'Création d’une énigme dans le builder',
  },
  {
    title: 'Logique',
    kicker: 'Conditions',
    description: 'Déclenchez des actions selon les objets, scènes visitées, énigmes résolues ou décisions du joueur.',
    image: conditionsImage,
    alt: 'Configuration des conditions dans le builder',
  },
  galleryItems[3],
];

const demoProofItems = [
  {
    title: 'Sans compte',
    text: 'Ouvrez un projet prêt à modifier depuis la landing, sans passer par l’inscription.',
    icon: Play,
  },
  {
    title: 'Projet guidé',
    text: 'Un mini escape game avec scènes, objet, énigme et logique de passage.',
    icon: MapPinned,
  },
  {
    title: 'Test joueur',
    text: 'Passez immédiatement de l’édition à l’aperçu pour sentir le parcours réel.',
    icon: CheckCircle2,
  },
  {
    title: 'Conversion simple',
    text: 'Créez un compte seulement quand vous voulez sauvegarder durablement ou publier.',
    icon: Link2,
  },
];

const demoFeatureCards = [
  ['Projet prérempli', 'La démo charge un musée verrouillé avec trois scènes, une clé, un symbole et une sortie à débloquer.'],
  ['Édition réelle', 'Modifiez le titre, les textes, les zones cliquables ou l’énigme comme dans le builder complet.'],
  ['Aperçu immédiat', 'L’onglet Preview permet de jouer le parcours sans ouvrir un autre outil.'],
  ['Sans engagement', 'Les changements restent temporaires tant qu’aucun compte n’est créé.', 'landing-card-wide'],
];

const demoWorkflowSteps = [
  'Ouvrir la démo depuis la landing.',
  'Modifier une scène ou une zone interactive.',
  'Changer une réponse d’énigme.',
  'Tester le parcours joueur.',
  'Créer un compte pour sauvegarder et publier.',
];

const demoGalleryItems = [
  {
    title: 'Démo Musée',
    kicker: 'Bac à sable',
    description: 'Un mini escape game prêt à ouvrir pour comprendre le builder par le geste.',
    image: builderPreviewImage,
    alt: 'Aperçu du builder utilisé comme démonstration',
  },
  builderGalleryItems[3],
  builderGalleryItems[4],
  galleryItems[3],
];

const landingModeTabs = [
  { id: 'demo', label: 'Démo', icon: Play },
  { id: 'builder', label: 'Je crée un jeu', icon: Palette },
  { id: 'pros', label: 'Je suis une salle', icon: BriefcaseBusiness },
];

const landingModeContent = {
  builder: {
    heroImage: builderPreviewImage,
    heroKicker: 'Builder no-code',
    heroTitle: 'Créez un escape game interactif, testable et partageable.',
    heroDescription: 'Escape Game Studio rassemble scènes, énigmes, objets, cinématiques, règles logiques et validation dans un builder pensé pour construire une expérience jouable sans développement.',
    heroNote: 'Un studio complet pour passer d’une idée à un parcours joueur vérifié.',
    primaryCta: 'Créer un jeu',
    secondaryCta: 'Voir le builder',
    points: ['Scènes', 'Énigmes', 'Objets', 'Cinématiques', 'Publication'],
    proofItems: builderProofItems,
    galleryItems: builderGalleryItems,
    featureCards: builderFeatureCards,
    workflowSteps: builderWorkflowSteps,
    audience: {
      kicker: 'Builder',
      title: 'Tout ce qu’il faut pour construire un parcours interactif.',
      description: 'Le builder sert à composer l’expérience, vérifier la logique et préparer une version jouable propre, que ce soit pour un prototype, une aventure narrative ou un jeu publié.',
      panelKicker: 'Création',
      panelTitle: 'Passez de la structure au gameplay sans changer d’outil.',
      panelDescription: 'Vous créez les scènes, placez les zones interactives, ajoutez les énigmes et testez le chemin joueur dans le même espace.',
      bullets: [
        'Templates de départ, mode guidé et projet vide.',
        'Scènes avec médias, textes, objets, sons et effets.',
        'Énigmes, conditions, inventaire et embranchements.',
        'Preview joueur et bilan de cohérence avant diffusion.',
      ],
      note: 'Le builder reste utilisable pour des jeux complets, des prototypes, des aventures narratives ou des extensions Pro.',
      cta: 'Ouvrir le builder',
      cards: [
        ['Scènes', 'Organisez les lieux, écrans, transitions et zones interactives.'],
        ['Gameplay', 'Ajoutez objets, énigmes, choix, conditions et récompenses.'],
        ['Narration', 'Insérez dialogues, cinématiques, introductions et fins.'],
        ['Validation', 'Testez les liens, le score et les points de blocage avant publication.'],
      ],
    },
    flow: {
      kicker: 'Production',
      title: 'Construisez, testez, corrigez, publiez.',
      description: 'Le builder met l’accent sur la fiabilité du parcours : chaque lien, condition et action peut être relu avant que le joueur ne lance l’expérience.',
      steps: [
        ['Composer', 'Créez vos scènes, ajoutez les médias et placez les zones importantes.', Palette],
        ['Tester', 'Parcourez les scènes comme un joueur et repérez les impasses.', CheckCircle2],
        ['Partager', 'Publiez une version jouable ou gardez le projet comme prototype.', Link2],
      ],
    },
    production: {
      kicker: 'Studio',
      title: 'Un atelier dense pour créer des jeux, pas une simple page vitrine.',
      description: 'Chaque écran peut combiner narration, interaction, inventaire, énigmes et conditions. Le builder vous aide à garder une structure lisible même quand le parcours devient plus riche.',
      note: 'L’IA peut accélérer le départ, mais la construction reste entièrement éditable.',
      cta: 'Créer un projet',
    },
    diffusion: {
      kicker: 'Publication',
      title: 'Publiez une version jouable quand le parcours est prêt.',
      description: 'La galerie, les liens publics, les avis et les aperçus joueur permettent de montrer votre création sans envoyer quelqu’un dans le builder.',
      cta: 'Explorer la galerie',
    },
    final: {
      icon: Sparkles,
      title: 'Lancez votre prochain escape game interactif.',
      description: 'Créez le projet, testez la logique et partagez une version jouable quand tout tient debout.',
      primary: 'Créer mon compte',
      secondary: 'Voir le builder',
      tertiary: 'Voir la galerie',
    },
  },
  demo: {
    heroImage: builderPreviewImage,
    heroKicker: 'Démo sans inscription',
    heroTitle: 'Essayez le builder avec un escape game déjà prêt.',
    heroDescription: 'Ouvrez un projet temporaire, modifiez une scène, testez une énigme et lancez l’aperçu joueur sans créer de compte.',
    heroNote: 'Sans inscription: touchez au vrai builder avant de créer un compte.',
    primaryCta: 'Essayer la démo sans compte',
    secondaryCta: 'Créer un compte',
    points: ['Sans inscription', 'Projet prérempli', 'Édition réelle', 'Preview joueur', 'Sauvegarde ensuite'],
    proofItems: demoProofItems,
    galleryItems: demoGalleryItems,
    featureCards: demoFeatureCards,
    workflowSteps: demoWorkflowSteps,
    audience: {
      kicker: 'Bac à sable',
      title: 'Une démo qui se manipule, pas seulement une capture d’écran.',
      description: 'Le visiteur arrive dans un vrai projet de musée verrouillé. Il peut changer les éléments clés, tester le parcours et comprendre ce que le builder produit.',
      panelKicker: 'Projet démo',
      panelTitle: 'Trois scènes pour voir tout le cycle de création.',
      panelDescription: 'La démo montre la boucle essentielle : composer une scène, régler une interaction, vérifier une énigme et passer dans l’aperçu joueur.',
      bullets: [
        'Projet temporaire non publié et non synchronisé.',
        'Scènes, objets, énigme et logique déjà configurés.',
        'Accès aux onglets clés du builder pour explorer librement.',
        'Création de compte proposée seulement pour sauvegarder durablement.',
      ],
      note: 'La publication, le QR code public et la synchronisation cloud restent réservés au compte.',
      cta: 'Lancer la démo sans compte',
      cards: [
        ['Galerie principale', 'Le joueur trouve la clé et comprend le point de départ.'],
        ['Réserve secrète', 'Une énigme simple valide la logique de progression.'],
        ['Salle de l’artefact', 'La fin montre la version jouable du parcours.'],
        ['Preview', 'Le créateur teste le jeu comme un joueur avant de s’inscrire.'],
      ],
    },
    flow: {
      kicker: 'Essai',
      title: 'Ouvrir, modifier, jouer.',
      description: 'La démo concentre le builder sur les gestes qui font comprendre le produit : éditer, relier et tester.',
      steps: [
        ['Ouvrir', 'Le projet Musée verrouillé se charge en mode temporaire.', Play],
        ['Modifier', 'Changez un texte, une zone cliquable ou la réponse de l’énigme.', Palette],
        ['Tester', 'Passez dans l’aperçu joueur pour vérifier le parcours.', CheckCircle2],
      ],
    },
    production: {
      kicker: 'Limites claires',
      title: 'La démo donne accès au cœur du builder sans créer de faux compte.',
      description: 'Elle reste volontairement temporaire : assez ouverte pour essayer, assez cadrée pour garder la sauvegarde, la publication et le cloud comme prochaines étapes naturelles.',
      note: 'Idéal pour transformer la curiosité de la landing en prise en main immédiate.',
      cta: 'Lancer la démo sans compte',
    },
    diffusion: {
      kicker: 'Après essai',
      title: 'Sauvegardez ou publiez quand le projet vous parle.',
      description: 'Une fois la démo comprise, l’inscription permet de conserver les projets, publier une version jouable et partager un lien public.',
      cta: 'Créer un compte',
    },
    final: {
      icon: Play,
      title: 'Testez le builder avant de vous inscrire.',
      description: 'Lancez un projet temporaire, touchez aux scènes et jouez le résultat en quelques minutes.',
      primary: 'Essayer la démo sans compte',
      secondary: 'Créer mon compte',
      tertiary: 'Voir la galerie',
    },
  },
  pros: {
    heroImage: builderPreviewImage,
    heroKicker: 'Pour les salles d’escape game',
    heroTitle: 'Créez une page bonus à vos couleurs pour vos joueurs.',
    heroDescription: 'Partez d’une page prête à jouer, remplacez images et textes, ajoutez quelques boutons puis publiez un lien ou un QR code.',
    heroNote: 'Gratuit pour les établissements vérifiés. Packs optionnels.',
    primaryCta: 'Créer gratuitement',
    secondaryCta: 'Voir côté joueur',
    points: ['Template page', 'Prologue', 'Épilogue', 'Bonus QR', 'Liens externes'],
    proofItems,
    galleryItems,
    featureCards,
    workflowSteps,
    audience: {
      kicker: 'Cas d’usage',
      title: 'Une page personnalisable entre votre univers et vos propres liens.',
      description: 'Le studio ajoute un template rapide à personnaliser, sans remplacer votre site ni vos outils existants.',
    },
    flow: {
      kicker: 'Mise en place',
      title: 'Du modèle au support terrain.',
      description: 'Le studio garde le travail volontairement court : vous habillez le modèle, vous vérifiez l’expérience, puis vous l’utilisez là où vos joueurs la verront.',
      steps: [
        ['Habillez', 'Visuels, textes et ambiance reprennent le vocabulaire de votre salle.', Palette],
        ['Contrôlez', 'Chaque interaction est relue avant d’être donnée aux joueurs.', ScanLine],
        ['Mettez en circulation', 'Affiche, comptoir, photo souvenir, site ou autre support existant.', Ticket],
      ],
    },
    production: {
      kicker: 'Contrôle',
      title: 'Le point important : aucun clic ne doit surprendre.',
      description: 'Un prologue ou un épilogue doit rester lisible. Le builder sert à vérifier la hiérarchie de la page, le placement des zones et la cohérence du parcours avant de le montrer au public.',
      note: 'L’IA peut aider à démarrer, mais le cœur du produit reste votre mise en scène et le contrôle du résultat.',
      cta: 'Créer gratuitement',
    },
    diffusion: {
      kicker: 'Supports',
      title: 'Utilisez-le là où l’expérience déborde déjà de la salle.',
        description: 'Avant l’accueil, après la photo d’équipe, sur un comptoir, dans une vitrine ou sur une page dédiée : le format sert surtout à garder le joueur dans votre univers au bon moment.',
      cta: 'Explorer la galerie',
    },
    final: {
      icon: MapPinned,
      title: 'Donnez une suite courte et claire à votre salle.',
      description: 'Choisissez un modèle, adaptez-le à votre décor, testez-le comme un joueur et publiez-le gratuitement après vérification de votre établissement.',
      primary: 'Créer un compte gratuit',
      secondary: 'Voir les cas d’usage',
      tertiary: 'Voir la galerie',
    },
  },
};

export default function LandingExperience({ onLogin, onRegister, onOpenGallery, onStartDemo }) {
  const [activeLandingMode, setActiveLandingMode] = useState('demo');
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryPaused, setIsGalleryPaused] = useState(false);
  const [activeMarketingTab, setActiveMarketingTab] = useState('prologue');
  const activeLandingContent = landingModeContent[activeLandingMode] || landingModeContent.builder;
  const activeGalleryItems = activeLandingContent.galleryItems;
  const activeGalleryItem = activeGalleryItems[activeGalleryIndex] || activeGalleryItems[0];
  const activeMarketing = marketingTabs.find((tab) => tab.id === activeMarketingTab) || marketingTabs[0];

  useEffect(() => {
    setActiveGalleryIndex(0);
    setIsGalleryPaused(false);
  }, [activeLandingMode]);

  useEffect(() => {
    if (!activeGalleryItems.length) return undefined;
    if (isGalleryPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveGalleryIndex((currentIndex) => (currentIndex + 1) % activeGalleryItems.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeGalleryItems.length, isGalleryPaused]);

  const showPreviousGalleryItem = () => {
    setActiveGalleryIndex((currentIndex) => (currentIndex - 1 + activeGalleryItems.length) % activeGalleryItems.length);
  };

  const showNextGalleryItem = () => {
    setActiveGalleryIndex((currentIndex) => (currentIndex + 1) % activeGalleryItems.length);
  };

  const openMarketingUseCases = () => {
    setActiveLandingMode('pros');
    setActiveMarketingTab('prologue');
    window.requestAnimationFrame(() => {
      document.getElementById('landing-audience')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openCurrentAudience = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('landing-audience')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openProPlayerExample = () => {
    setActiveLandingMode('pros');
    window.requestAnimationFrame(() => {
      document.getElementById('landing-player-example')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const isDemoMode = activeLandingMode === 'demo';
  const launchDemo = typeof onStartDemo === 'function' ? onStartDemo : onRegister;
  const registerForActiveMode = () => onRegister?.(activeLandingMode === 'pros' ? { accountType: ACCOUNT_TYPE_PRO } : undefined);
  const runPrimaryAction = isDemoMode ? launchDemo : registerForActiveMode;
  const runHeroSecondaryAction = isDemoMode
    ? registerForActiveMode
    : activeLandingMode === 'pros' ? openProPlayerExample : openCurrentAudience;
  const runFinalSecondaryAction = isDemoMode
    ? registerForActiveMode
    : activeLandingMode === 'pros' ? openMarketingUseCases : openCurrentAudience;
  const runAudienceAction = isDemoMode ? launchDemo : registerForActiveMode;
  const runProductionAction = isDemoMode ? launchDemo : registerForActiveMode;
  const runDiffusionAction = isDemoMode ? registerForActiveMode : onOpenGallery;

  const FinalIcon = activeLandingContent.final.icon;
  const businessQuestionsSection = activeLandingMode === 'pros' ? (
    <section className="landing-section">
      <div className="landing-section-head">
        <span className="section-kicker">Questions de gérant</span>
        <h2>Les réponses avant de tester.</h2>
        <p>Le but est de savoir vite si le format peut s’ajouter à votre exploitation sans chantier technique.</p>
      </div>
      <div className="landing-card-grid">
        {businessAnswers.map(([title, text]) => (
          <article className="landing-card" key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  ) : null;

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <img
          className="landing-hero-bg"
          src={activeLandingContent.heroImage}
          alt=""
          aria-hidden="true"
        />
        <nav className="landing-nav">
          <img src={bannerImage} alt="Escape Game Studio" />
          <div className="landing-nav-actions">
            <button type="button" className="secondary-action" onClick={openMarketingUseCases}>Cas d’usage</button>
            <button type="button" className="secondary-action" onClick={onOpenGallery}>Galerie</button>
            <button type="button" onClick={onLogin}>Connexion</button>
          </div>
        </nav>

        <div className="landing-hero-content">
          <div className="landing-mode-tabs" role="tablist" aria-label="Choisir votre profil">
            {landingModeTabs.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                role="tab"
                id={`landing-mode-tab-${id}`}
                aria-selected={activeLandingMode === id}
                aria-controls={`landing-mode-panel-${id}`}
                className={activeLandingMode === id ? 'is-active' : ''}
                key={id}
                onClick={() => setActiveLandingMode(id)}
              >
                <Icon size={18} aria-hidden="true" focusable="false" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div id={`landing-mode-panel-${activeLandingMode}`} role="tabpanel" aria-labelledby={`landing-mode-tab-${activeLandingMode}`}>
            <span className="section-kicker">{activeLandingContent.heroKicker}</span>
            <h1>{activeLandingContent.heroTitle}</h1>
            <p>{activeLandingContent.heroDescription}</p>
          </div>
          <div className="landing-free-note">
            {activeLandingContent.heroNote}
          </div>
          <div className="landing-hero-actions">
            <button type="button" className="landing-cta-primary" onClick={runPrimaryAction}>{activeLandingContent.primaryCta}</button>
            <button type="button" className="secondary-action landing-cta-secondary" onClick={runHeroSecondaryAction}>{activeLandingContent.secondaryCta}</button>
          </div>
          <ul className="landing-hero-points" aria-label="Points forts">
            {activeLandingContent.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>

      {businessQuestionsSection}

      {activeLandingMode === 'pros' ? (
        <section className="landing-section landing-player-preview landing-player-preview--copy-only" id="landing-player-example">
          <div className="landing-section-copy">
            <span className="section-kicker">Côté joueur</span>
            <h2>Vos joueurs voient une page finie à vos couleurs.</h2>
            <p>Une expérience courte, lisible sur mobile, avec votre ambiance et les actions que vous choisissez.</p>
            <ul className="landing-player-preview-list">
              {playerPreviewPoints.map((point) => (
                <li key={point}>
                  <CheckCircle2 size={18} aria-hidden="true" focusable="false" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="landing-proof-strip" aria-label="Résumé du produit">
        {activeLandingContent.proofItems.map(({ title, text, icon: Icon }) => (
          <article key={title}>
            <Icon size={22} aria-hidden="true" focusable="false" />
            <strong>{title}</strong>
            <span>{text}</span>
          </article>
        ))}
      </section>

      <section className="landing-section landing-audience" id="landing-audience">
        <div className="landing-section-head">
          <span className="section-kicker">{activeLandingContent.audience.kicker}</span>
          <h2>{activeLandingContent.audience.title}</h2>
          <p>{activeLandingContent.audience.description}</p>
        </div>

        {activeLandingMode === 'pros' ? (
          <>
            <div className="landing-audience-tabs" role="tablist" aria-label="Choisir un cas d’usage">
              {marketingTabs.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  role="tab"
                  id={`landing-tab-${id}`}
                  aria-selected={activeMarketing.id === id}
                  aria-controls={`landing-panel-${id}`}
                  className={activeMarketing.id === id ? 'is-active' : ''}
                  key={id}
                  onClick={() => setActiveMarketingTab(id)}
                >
                  <Icon size={18} aria-hidden="true" focusable="false" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div
              className="landing-audience-panel"
              role="tabpanel"
              id={`landing-panel-${activeMarketing.id}`}
              aria-labelledby={`landing-tab-${activeMarketing.id}`}
            >
              <div className="landing-audience-copy">
                <span className="section-kicker">{activeMarketing.kicker}</span>
                <h3>{activeMarketing.title}</h3>
                <p>{activeMarketing.description}</p>
                <ul className="landing-audience-points">
                  {activeMarketing.bullets.map((bullet) => (
                    <li key={bullet}>
                      <CheckCircle2 size={18} aria-hidden="true" focusable="false" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="landing-pro-note">
                  <Link2 size={18} aria-hidden="true" focusable="false" />
                  <span>Gardez le dernier bouton cohérent avec le moment : préparer, conclure, offrir ou prolonger.</span>
                </div>
                <button type="button" className="landing-cta-primary" onClick={registerForActiveMode}>
                  Construire ce parcours
                </button>
              </div>

              <div className="landing-audience-cards">
                {activeMarketing.cards.map(([title, text]) => (
                  <article className="landing-audience-card" key={title}>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </article>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="landing-audience-panel">
            <div className="landing-audience-copy">
              <span className="section-kicker">{activeLandingContent.audience.panelKicker}</span>
              <h3>{activeLandingContent.audience.panelTitle}</h3>
              <p>{activeLandingContent.audience.panelDescription}</p>
              <ul className="landing-audience-points">
                {activeLandingContent.audience.bullets.map((bullet) => (
                  <li key={bullet}>
                    <CheckCircle2 size={18} aria-hidden="true" focusable="false" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="landing-pro-note">
                <Link2 size={18} aria-hidden="true" focusable="false" />
                <span>{activeLandingContent.audience.note}</span>
              </div>
              <button type="button" className="landing-cta-primary" onClick={runAudienceAction}>
                {activeLandingContent.audience.cta}
              </button>
            </div>

            <div className="landing-audience-cards">
              {activeLandingContent.audience.cards.map(([title, text]) => (
                <article className="landing-audience-card" key={title}>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="landing-section landing-qr-flow" aria-label="Mise en place">
        <div className="landing-section-head">
          <span className="section-kicker">{activeLandingContent.flow.kicker}</span>
          <h2>{activeLandingContent.flow.title}</h2>
          <p>{activeLandingContent.flow.description}</p>
        </div>
        <div className="landing-qr-steps">
          {activeLandingContent.flow.steps.map(([title, text, Icon]) => (
            <article key={title}>
              <Icon size={22} aria-hidden="true" focusable="false" />
              <strong>{title}</strong>
              <span>{text}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-dynamic-gallery" aria-label="Galerie dynamique du produit">
        <div className="landing-gallery-stage with-image">
          <img
            key={activeGalleryItem.title}
            className="landing-gallery-active-image"
            src={activeGalleryItem.image}
            alt={activeGalleryItem.alt}
          />
          <div className="landing-gallery-controls">
            <button
              type="button"
              className="landing-gallery-control"
              onClick={showPreviousGalleryItem}
              aria-label="Aperçu précédent"
              title="Aperçu précédent"
            >
              <ChevronLeft size={20} aria-hidden="true" focusable="false" />
            </button>
            <button
              type="button"
              className="landing-gallery-control"
              onClick={() => setIsGalleryPaused((paused) => !paused)}
              aria-label={isGalleryPaused ? 'Relancer la galerie' : 'Mettre la galerie en pause'}
              title={isGalleryPaused ? 'Relancer la galerie' : 'Mettre la galerie en pause'}
            >
              {isGalleryPaused ? (
                <Play size={18} aria-hidden="true" focusable="false" />
              ) : (
                <Pause size={18} aria-hidden="true" focusable="false" />
              )}
            </button>
            <button
              type="button"
              className="landing-gallery-control"
              onClick={showNextGalleryItem}
              aria-label="Aperçu suivant"
              title="Aperçu suivant"
            >
              <ChevronRight size={20} aria-hidden="true" focusable="false" />
            </button>
          </div>
          <div className="landing-gallery-stage-caption">
            <span className="section-kicker">{activeGalleryItem.kicker}</span>
            <h2>{activeGalleryItem.title}</h2>
            <p>{activeGalleryItem.description}</p>
          </div>
        </div>

        <div className="landing-gallery-thumbs" aria-label="Choisir un aperçu">
          {activeGalleryItems.map((item, index) => (
            <button
              type="button"
              className={[
                'landing-gallery-thumb',
                index === activeGalleryIndex ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              key={item.title}
              onClick={() => setActiveGalleryIndex(index)}
              aria-pressed={index === activeGalleryIndex}
            >
              <img src={item.image} alt="" aria-hidden="true" />
              <span>
                <strong>{item.title}</strong>
                <small>{item.kicker}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="landing-gallery-progress" aria-hidden="true">
          {activeGalleryItems.map((item, index) => (
            <span
              className={index === activeGalleryIndex ? 'is-active' : ''}
              key={item.title}
            />
          ))}
        </div>
      </section>

      <section className="landing-section landing-features">
        <div className="landing-section-head">
          <span className="section-kicker">Ce que vous ajoutez</span>
          <h2>{activeLandingMode === 'pros' ? 'Un habillage rapide pour vos moments avant et après jeu.' : 'Un builder pour transformer une idée en parcours jouable.'}</h2>
          <p>
            {activeLandingMode === 'pros'
              ? 'Vous ne refaites pas tout votre marketing : vous ajoutez un point de contact jouable, aux couleurs de vos salles, facile à tester et à partager.'
              : 'Vous gardez une vision claire de la structure, des médias, des interactions et des contrôles avant de publier.'}
          </p>
        </div>
        <div className="landing-card-grid">
          {activeLandingContent.featureCards.map(([title, text, cardClassName]) => (
            <article className={['landing-card', cardClassName].filter(Boolean).join(' ')} key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-split landing-split-product">
        <div className="landing-section-copy">
          <span className="section-kicker">{activeLandingContent.production.kicker}</span>
          <h2>{activeLandingContent.production.title}</h2>
          <p>{activeLandingContent.production.description}</p>
          <p className="landing-note">
            {activeLandingContent.production.note}
          </p>
          <button type="button" className="secondary-action" onClick={runProductionAction}>{activeLandingContent.production.cta}</button>
        </div>
        <div className="landing-highlight-grid">
          <div className="landing-highlight-shot wide">
            <img src={scoreBilanImage} alt="Bilan automatique avec scores de cohérence, structure et gameplay" />
            <span>Bilan automatique</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={linkTestsImage} alt="Test de liaisons entre scènes et sorties jouables" />
            <span>Tests de liens</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={conditionsImage} alt="Configuration d'une règle conditionnelle dans le builder" />
            <span>Conditions</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={inventoryImage} alt="Inventaire d'objets utilisables dans un escape game" />
            <span>Objets</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={enigmasImage} alt="Création d'une énigme avec code et apparence joueur" />
            <span>Énigmes</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={cinematicsImage} alt="Éditeur de cinématique avec plusieurs slides et narrations" />
            <span>Cinématiques</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={aiActionsImage} alt="Interface IA avec génération complète, mode progressif, continuation et amélioration de scène" />
            <span>IA optionnelle</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-split landing-split-gallery">
        <div className="landing-section-copy">
          <span className="section-kicker">{activeLandingContent.diffusion.kicker}</span>
          <h2>{activeLandingContent.diffusion.title}</h2>
          <p>{activeLandingContent.diffusion.description}</p>
          <button type="button" className="landing-cta-primary" onClick={runDiffusionAction}>{activeLandingContent.diffusion.cta}</button>
        </div>
        <div className="landing-gallery-preview">
          <div className="landing-gallery-card wide with-image">
            <img src={gameGalleryImage} alt="Liste de jeux publiés dans la galerie" />
          </div>
          <div className="landing-gallery-card with-image">
            <img src={ratingImage} alt="Paramètres de publication avec note et bouton publier" />
          </div>
          <div className="landing-gallery-card with-image">
            <img src={reviewsImage} alt="Formulaire d'avis avec note en étoiles" />
          </div>
        </div>
      </section>

      <section className="landing-section landing-workflow">
        <div className="landing-section-head">
          <span className="section-kicker">Méthode</span>
          <h2>{activeLandingMode === 'pros' ? 'Adapter, vérifier, mettre en circulation.' : 'Créer, relier, tester, publier.'}</h2>
          <p>{activeLandingMode === 'pros' ? 'La valeur est dans la sobriété : une page claire, quelques interactions utiles et un contrôle complet avant publication.' : 'La bonne expérience tient dans la clarté du parcours : une structure lisible, des interactions cohérentes et un test joueur complet.'}</p>
        </div>
        <div className="landing-steps">
          {activeLandingContent.workflowSteps.map((step, index) => (
            <div className="landing-step" key={step}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <FinalIcon size={30} aria-hidden="true" focusable="false" />
        <h2>{activeLandingContent.final.title}</h2>
        <p>{activeLandingContent.final.description}</p>
        <div className="landing-final-actions">
          <button type="button" className="landing-cta-primary" onClick={runPrimaryAction}>{activeLandingContent.final.primary}</button>
          <button type="button" className="secondary-action" onClick={runFinalSecondaryAction}>{activeLandingContent.final.secondary}</button>
          <button type="button" className="secondary-action" onClick={onOpenGallery}>{activeLandingContent.final.tertiary}</button>
        </div>
      </section>
    </main>
  );
}
