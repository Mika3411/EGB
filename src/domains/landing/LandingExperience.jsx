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

const featureCards = [
  ['À vos couleurs', 'Ajoutez vos visuels, votre ton, vos consignes et l’ambiance de votre salle dans une extension jouable.'],
  ['Partage QR code', 'Posez le QR code sur un flyer, une affiche, un email, un comptoir ou un ticket de fin de partie.'],
  ['Retour réservation', 'Ajoutez vos liens de réservation, bons cadeaux, salles similaires ou campagnes saisonnières.'],
  ['Sans remplacer vos outils', 'Escape Game Studio complète votre site, votre billetterie et vos campagnes marketing avec une couche interactive dédiée à l’immersion.', 'landing-card-wide'],
];

const workflowSteps = [
  'Choisir un prologue, un épilogue ou un bonus.',
  'Habiller l’expérience avec votre univers.',
  'Tester le parcours joueur avant diffusion.',
  'Partager par lien ou QR code.',
  'Renvoyer vers vos réservations.',
];

const proofItems = [
  {
    title: 'Gardez vos outils',
    text: 'Le studio se place autour de votre site, vos emails et votre billetterie.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Ajoutez l’interactif',
    text: 'Transformez un simple lien en mini-expérience jouable et mémorable.',
    icon: Sparkles,
  },
  {
    title: 'Diffusez par QR',
    text: 'Un scan suffit pour lancer un prologue, un épilogue ou une mission bonus.',
    icon: QrCode,
  },
  {
    title: 'Ramenez au booking',
    text: 'La fin du parcours peut pointer vers vos réservations ou offres ciblées.',
    icon: CalendarCheck,
  },
];

const marketingTabs = [
  {
    id: 'prologue',
    label: 'Prologue',
    icon: Sparkles,
    kicker: 'Avant la partie',
    title: 'Mettez les joueurs dans l’histoire avant même l’accueil.',
    description: 'Envoyez un lien ou un QR code après réservation pour introduire le scénario, poser un mystère et préparer les joueurs sans changer votre organisation sur place.',
    bullets: [
      'Briefing immersif avant l’arrivée en salle.',
      'Mini-énigme d’introduction pour installer le ton.',
      'Consignes intégrées sans casser la narration.',
      'Lien final vers confirmation, accès ou autre salle à réserver.',
    ],
    cards: [
      ['Email de réservation', 'Ajoutez une expérience jouable dans vos messages avant le jour J.'],
      ['Accueil plus fluide', 'Les joueurs arrivent déjà engagés dans l’univers.'],
      ['Univers renforcé', 'Chaque prologue reprend vos couleurs, votre histoire et vos visuels.'],
      ['Campagnes saisonnières', 'Créez des entrées spéciales pour Halloween, Noël ou une nouveauté.'],
    ],
  },
  {
    id: 'epilogue',
    label: 'Épilogue',
    icon: BadgeCheck,
    kicker: 'Après la sortie',
    title: 'Transformez la fin de partie en souvenir et en nouveau point de contact.',
    description: 'Après la photo d’équipe, donnez un QR code qui prolonge l’histoire : débrief, scène cachée, score narratif, message du personnage ou appel à revenir.',
    bullets: [
      'Conclusion narrative après la partie physique.',
      'Récompense ou scène secrète selon le résultat.',
      'Lien vers avis, bons cadeaux ou prochaine salle.',
      'Support réutilisable sur comptoir, photo souvenir ou email post-game.',
    ],
    cards: [
      ['Débrief immersif', 'Donnez une vraie fin à l’histoire au lieu d’un simple message.'],
      ['Avis mieux contextualisé', 'Demandez un retour quand l’émotion est encore chaude.'],
      ['Cross-sell naturel', 'Présentez la salle qui continue le mieux l’aventure.'],
      ['Souvenir partageable', 'Les joueurs repartent avec un objet numérique lié à leur équipe.'],
    ],
  },
  {
    id: 'bonus',
    label: 'Bonus',
    icon: Gift,
    kicker: 'Réactivation',
    title: 'Créez des missions bonus qui font revenir vos anciens joueurs.',
    description: 'Lancez une enquête courte, un teaser de nouvelle salle ou une chasse aux indices liée à votre marque. Le tout jouable sur mobile, sans développement sur mesure.',
    bullets: [
      'Mini-campagne autonome pour relancer votre audience.',
      'Teaser jouable pour une salle à venir.',
      'Indices, objets, cinématiques et conditions simples.',
      'Sortie vers réservation, liste d’attente ou offre cadeau.',
    ],
    cards: [
      ['Newsletter', 'Remplacez une annonce statique par une mission à résoudre.'],
      ['Réseaux sociaux', 'Diffusez un lien court qui donne envie de scanner et jouer.'],
      ['Événement local', 'Créez une expérience courte pour salon, office ou partenariat.'],
      ['Fidélisation', 'Offrez une suite aux équipes qui ont déjà terminé une salle.'],
    ],
  },
];

const galleryItems = [
  {
    title: 'Studio de campagne',
    kicker: 'No-code',
    description: 'Créez une extension courte avec scènes, textes, objets, énigmes, cinématiques et règles simples.',
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
    title: 'Parcours QR',
    kicker: 'Test joueur',
    description: 'Vérifiez que chaque interaction mène au bon écran avant d’imprimer ou d’envoyer le lien.',
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
    description: 'Publiez une version jouable et partagez-la par QR code, email, page dédiée ou support physique.',
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

export default function LandingExperience({ onLogin, onRegister, onOpenGallery }) {
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryPaused, setIsGalleryPaused] = useState(false);
  const [activeMarketingTab, setActiveMarketingTab] = useState('prologue');
  const activeGalleryItem = galleryItems[activeGalleryIndex] || galleryItems[0];
  const activeMarketing = marketingTabs.find((tab) => tab.id === activeMarketingTab) || marketingTabs[0];

  useEffect(() => {
    if (isGalleryPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveGalleryIndex((currentIndex) => (currentIndex + 1) % galleryItems.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isGalleryPaused]);

  const showPreviousGalleryItem = () => {
    setActiveGalleryIndex((currentIndex) => (currentIndex - 1 + galleryItems.length) % galleryItems.length);
  };

  const showNextGalleryItem = () => {
    setActiveGalleryIndex((currentIndex) => (currentIndex + 1) % galleryItems.length);
  };

  const openMarketingUseCases = () => {
    setActiveMarketingTab('prologue');
    window.requestAnimationFrame(() => {
      document.getElementById('landing-audience')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <img
          className="landing-hero-bg"
          src={builderPreviewImage}
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
          <span className="section-kicker">Pour les salles d’escape game</span>
          <h1>Gardez vos outils. Ajoutez une couche interactive à votre marketing.</h1>
          <p>
            Avec Escape Game Studio, créez des prologues, épilogues et expériences bonus
            aux couleurs de votre salle. Partagez-les par QR code, prolongez l’immersion
            de vos joueurs et renvoyez-les vers vos réservations.
          </p>
          <div className="landing-free-note">
            Une extension jouable pour ce qui se passe avant, après et autour de la partie physique.
          </div>
          <div className="landing-hero-actions">
            <button type="button" className="landing-cta-primary" onClick={onRegister}>Créer une expérience bonus</button>
            <button type="button" className="secondary-action landing-cta-secondary" onClick={openMarketingUseCases}>Voir le parcours QR</button>
          </div>
          <ul className="landing-hero-points" aria-label="Points forts">
            <li>Prologues</li>
            <li>Épilogues</li>
            <li>Bonus mobile</li>
            <li>QR code</li>
            <li>Lien réservation</li>
          </ul>
        </div>
      </section>

      <section className="landing-proof-strip" aria-label="Résumé du produit">
        {proofItems.map(({ title, text, icon: Icon }) => (
          <article key={title}>
            <Icon size={22} aria-hidden="true" focusable="false" />
            <strong>{title}</strong>
            <span>{text}</span>
          </article>
        ))}
      </section>

      <section className="landing-section landing-audience" id="landing-audience">
        <div className="landing-section-head">
          <span className="section-kicker">Cas d’usage</span>
          <h2>Une couche marketing interactive pour vos salles physiques.</h2>
          <p>
            Le studio ne remplace ni votre jeu en salle, ni votre site, ni votre billetterie.
            Il ajoute un format jouable, rapide à diffuser, qui renforce l’immersion et guide
            les joueurs vers l’action suivante.
          </p>
        </div>

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
              <span>La sortie peut pointer vers votre module de réservation, une page cadeau, un avis ou une prochaine salle.</span>
            </div>
            <button type="button" className="landing-cta-primary" onClick={onRegister}>
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
      </section>

      <section className="landing-section landing-qr-flow" aria-label="Parcours QR code">
        <div className="landing-section-head">
          <span className="section-kicker">Parcours QR</span>
          <h2>Un scan, une expérience, une action mesurable.</h2>
          <p>
            Vous créez l’extension dans le studio, vous la diffusez sur vos supports,
            puis vous terminez le parcours avec l’appel à l’action adapté à votre campagne.
          </p>
        </div>
        <div className="landing-qr-steps">
          <article>
            <Palette size={22} aria-hidden="true" focusable="false" />
            <strong>Créez aux couleurs de la salle</strong>
            <span>Scènes, images, cinématiques, objets et textes reprennent votre univers.</span>
          </article>
          <article>
            <ScanLine size={22} aria-hidden="true" focusable="false" />
            <strong>Diffusez partout</strong>
            <span>QR code sur place, lien dans l’email de réservation ou teaser social.</span>
          </article>
          <article>
            <Ticket size={22} aria-hidden="true" focusable="false" />
            <strong>Convertissez l’attention</strong>
            <span>Réservation, bon cadeau, avis, liste d’attente ou découverte d’une autre salle.</span>
          </article>
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
          {galleryItems.map((item, index) => (
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
          {galleryItems.map((item, index) => (
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
          <h2>Un format immersif entre votre communication et vos réservations.</h2>
          <p>
            Vous ne refaites pas tout votre marketing : vous ajoutez un point de contact
            jouable, aux couleurs de vos salles, facile à tester et à partager.
          </p>
        </div>
        <div className="landing-card-grid">
          {featureCards.map(([title, text, cardClassName]) => (
            <article className={['landing-card', cardClassName].filter(Boolean).join(' ')} key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-split landing-split-product">
        <div className="landing-section-copy">
          <span className="section-kicker">Production rapide</span>
          <h2>Le studio sert à créer vite, mais surtout à ne pas publier un parcours cassé.</h2>
          <p>
            Un bonus marketing doit être court, clair et fiable. Escape Game Studio permet
            de relier les écrans, tester les sorties, ajouter des conditions et vérifier la
            cohérence avant d’imprimer votre QR code.
          </p>
          <p className="landing-note">
            L’IA peut aider à démarrer, mais le cœur du produit reste le parcours joueur, la logique et la validation.
          </p>
          <button type="button" className="secondary-action" onClick={onRegister}>Créer une extension</button>
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
          <span className="section-kicker">Diffusion</span>
          <h2>Chaque QR code devient une porte d’entrée vers votre univers.</h2>
          <p>
            Placez l’expérience sur une affiche, un email, une photo souvenir, une page
            campagne ou un comptoir. Les joueurs lancent la version publiée et retrouvent
            ensuite vos prochaines actions : réserver, offrir, laisser un avis ou découvrir une autre salle.
          </p>
          <button type="button" className="landing-cta-primary" onClick={onOpenGallery}>Explorer la galerie</button>
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
          <h2>Créer, tester, diffuser, convertir.</h2>
          <p>Le bon format n’est pas une page de plus : c’est un mini-parcours qui accompagne le joueur jusqu’à l’action suivante.</p>
        </div>
        <div className="landing-steps">
          {workflowSteps.map((step, index) => (
            <div className="landing-step" key={step}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <MapPinned size={30} aria-hidden="true" focusable="false" />
        <h2>Ajoutez une extension jouable à votre prochaine salle.</h2>
        <p>
          Créez un prologue, un épilogue ou un bonus, partagez-le par QR code et guidez
          vos joueurs vers la prochaine réservation.
        </p>
        <div className="landing-final-actions">
          <button type="button" className="landing-cta-primary" onClick={onRegister}>Créer mon compte</button>
          <button type="button" className="secondary-action" onClick={openMarketingUseCases}>Voir les cas d’usage</button>
          <button type="button" className="secondary-action" onClick={onOpenGallery}>Voir la galerie</button>
        </div>
      </section>
    </main>
  );
}
