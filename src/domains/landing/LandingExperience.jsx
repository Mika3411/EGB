import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
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
  ['Studio no-code', "Mode Débutant, templates, aide guidée, scènes, objets et logique se construisent avec des formulaires et des zones visuelles."],
  ['Gratuit pour créer', "Tu peux construire, tester et publier sans payer. L'IA reste une aide optionnelle avec crédits."],
  ['Jouable tout de suite', 'Prévisualise le parcours côté joueur, corrige les blocages et partage quand tout est prêt.'],
  ['Plan & tests de liens', 'Visualise les scènes sur une carte, teste chaque liaison et repère les sorties bloquées en temps réel.', 'landing-card-wide'],
];

const workflowSteps = [
  'Pose la structure du jeu et son plan.',
  'Ajoute indices, objets et énigmes.',
  'Teste les liens et le parcours en temps réel.',
  'Corrige les blocages, publie et partage.',
];

const proofItems = [
  ['No-code', 'Un builder visuel pour assembler le jeu sans développement.'],
  ['Débutant', "Pas besoin d'être expert : tu peux commencer simple et monter en puissance plus tard."],
  ['Gratuit', 'Création, test et publication restent accessibles gratuitement.'],
  ['IA optionnelle', "L'assistant accélère la création, sans devenir obligatoire."],
];

const galleryItems = [
  {
    title: 'Builder',
    kicker: 'Éditeur visuel',
    description: 'Construis tes scènes, place les zones interactives et règle chaque détail dans le même espace.',
    image: builderPreviewImage,
    alt: 'Aperçu du builder avec une scène et ses zones interactives',
  },
  {
    title: 'Mode Débutant',
    kicker: 'Sans expertise',
    description: "Commence en Débutant, pars d'un template ou lance l'aide guidée. Tu peux passer en Intermédiaire ou Expert plus tard.",
    image: creationModeImage,
    alt: "Mode de création Débutant avec templates et bouton d'aide guidée",
  },
  {
    title: 'Plan & liens',
    kicker: 'Parcours en direct',
    description: 'Teste les liaisons entre les pièces, vois les sorties jouables et repère les blocages avant publication.',
    image: linkTestsImage,
    alt: 'Plan du jeu avec test des liens et parcours joueur en temps réel',
  },
  {
    title: 'Galerie',
    kicker: 'Publication',
    description: 'Présente tes jeux publics avec catégories, tendances et accès direct au lancement côté joueur.',
    image: galleryPageImage,
    alt: 'Galerie publique avec les escape games à découvrir',
  },
  {
    title: 'Joueur',
    kicker: 'Page de jeu',
    description: "Affiche la fiche du jeu, les avis, la note et l'appel à l'action pour commencer la partie.",
    image: playerPageImage,
    alt: 'Page joueur avec image du jeu, note et avis',
  },
  {
    title: 'Bilan',
    kicker: 'Score & conseils',
    description: 'Lis la note globale, les dimensions du projet, le temps estimé et les points à améliorer.',
    image: scoreBilanImage,
    alt: 'Bilan du projet avec note globale, scores par dimension et expérience estimée',
  },
];

export default function LandingExperience({ onLogin, onRegister, onOpenGallery }) {
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryPaused, setIsGalleryPaused] = useState(false);
  const activeGalleryItem = galleryItems[activeGalleryIndex] || galleryItems[0];

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
            <button type="button" className="secondary-action" onClick={onOpenGallery}>Galerie</button>
            <button type="button" onClick={onLogin}>Connexion</button>
          </div>
        </nav>

        <div className="landing-hero-content">
          <span className="section-kicker">Builder no-code</span>
          <h1>Crée ton escape game en ligne, sans code.</h1>
          <p>
            Assemble des scènes interactives, des objets, des énigmes, des cinématiques
            et une logique conditionnelle. Visualise le plan, teste les liens et suis le
            parcours joueur en temps réel avant de publier. Pas besoin d'être expert :
            démarre en Débutant, puis ajoute de la profondeur quand tu veux.
          </p>
          <div className="landing-free-note">
            Gratuit pour créer et publier. IA optionnelle avec crédits.
          </div>
          <div className="landing-hero-actions">
            <button type="button" className="landing-cta-primary" onClick={onRegister}>Commencer gratuitement</button>
            <button type="button" className="secondary-action landing-cta-secondary" onClick={onOpenGallery}>Voir des jeux publiés</button>
          </div>
          <ul className="landing-hero-points" aria-label="Points forts">
            <li>Éditeur visuel</li>
            <li>Plan interactif</li>
            <li>Test des liens</li>
            <li>Prévisualisation joueur</li>
            <li>Publication galerie</li>
          </ul>
        </div>
      </section>

      <section className="landing-proof-strip" aria-label="Résumé du produit">
        {proofItems.map(([title, text]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{text}</span>
          </article>
        ))}
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
          <span className="section-kicker">Facile</span>
          <h2>Un studio complet, pensé pour les créateurs.</h2>
          <p>Tu ne programmes pas : tu remplis, tu places, tu relies et tu testes dans le même espace de travail.</p>
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
          <span className="section-kicker">Logique, plan & IA</span>
          <h2>Des jeux plus riches, sans devenir développeur.</h2>
          <p>
            Crée des règles conditionnelles : objets requis, portes verrouillées, scènes débloquées,
            énigmes réussies, cinématiques lancées ou deuxièmes clics. Le plan te montre les
            liaisons entre les pièces, les sorties jouables et les blocages pendant que tu testes
            le parcours. Et si tu veux aller plus vite, l'IA peut t'aider à générer, continuer ou
            améliorer un projet.
          </p>
          <p className="landing-note">
            Le builder reste gratuit. Les outils IA sont optionnels et consomment des crédits.
          </p>
          <button type="button" className="secondary-action" onClick={onRegister}>Créer un projet gratuit</button>
        </div>
        <div className="landing-highlight-grid">
          <div className="landing-highlight-shot">
            <img src={conditionsImage} alt="Configuration d'une règle conditionnelle dans le builder" />
            <span>Conditions</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={inventoryImage} alt="Inventaire d'objets utilisables dans un escape game" />
            <span>Inventaire</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={enigmasImage} alt="Création d'une énigme avec code et apparence joueur" />
            <span>Énigmes</span>
          </div>
          <div className="landing-highlight-shot">
            <img src={cinematicsImage} alt="Éditeur de cinematic avec plusieurs slides et narrations" />
            <span>Cinématiques</span>
          </div>
          <div className="landing-highlight-shot wide">
            <img src={aiActionsImage} alt="Interface IA avec génération complète, mode progressif, continuation et amélioration de scène" />
            <span>IA optionnelle</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-split landing-split-gallery">
        <div className="landing-section-copy">
          <span className="section-kicker">Galerie</span>
          <h2>Publie tes jeux et laisse les joueurs les découvrir.</h2>
          <p>
            La galerie met en avant les escape games publics, les auteurs, les catégories,
            les avis et les parties jouées.
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
          <h2>De l'idée au jeu jouable en quelques étapes.</h2>
          <p>Un parcours court pour démarrer, puis assez de profondeur pour produire un vrai jeu.</p>
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
        <h2>Prêt à construire un escape game sans code ?</h2>
        <p>Crée un compte gratuitement, pars d'une idée simple, puis assemble ton premier parcours jouable.</p>
        <div className="landing-final-actions">
          <button type="button" className="landing-cta-primary" onClick={onRegister}>Créer mon compte</button>
          <button type="button" className="secondary-action" onClick={onOpenGallery}>Voir la galerie</button>
        </div>
      </section>
    </main>
  );
}
