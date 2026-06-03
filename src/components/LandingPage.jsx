import bannerImage from '../assets/header-banner.png';
import aiImage from '../assets/landing-ai.png';
import builderPreviewImage from '../assets/landing-builder-preview.png';
import cinematicsImage from '../assets/landing-cinematics.png';
import conditionsImage from '../assets/landing-conditions.png';
import enigmasImage from '../assets/landing-enigmas.png';
import gameGalleryImage from '../assets/landing-game-gallery.png';
import galleryPageImage from '../assets/landing-gallery-page.png';
import inventoryImage from '../assets/landing-inventory.png';
import playerPageImage from '../assets/landing-player-page.png';
import ratingImage from '../assets/landing-rating.png';
import reviewsImage from '../assets/landing-reviews.png';

const featureCards = [
  ['Studio no-code', 'Scènes, objets, indices, énigmes et logique se construisent avec des formulaires et des zones visuelles.'],
  ['Gratuit pour créer', "Tu peux construire, tester et publier sans payer. L'IA reste une aide optionnelle avec crédits."],
  ['Jouable tout de suite', 'Prévisualise le parcours côté joueur, corrige les blocages et partage quand tout est prêt.'],
];

const workflowSteps = [
  'Pose la structure du jeu.',
  'Ajoute indices, objets et énigmes.',
  'Relie les conditions et les scènes.',
  'Teste, publie, partage.',
];

const proofItems = [
  ['No-code', 'Un builder visuel pour assembler le jeu sans développement.'],
  ['Gratuit', 'Création, test et publication restent accessibles gratuitement.'],
  ['IA optionnelle', "L'assistant accélère la création, sans devenir obligatoire."],
];

export default function LandingPage({ onLogin, onRegister, onOpenGallery }) {
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
            et une logique conditionnelle dans un studio sombre, rapide et pensé pour produire.
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

      <section className="landing-image-band" aria-label="Aperçus du produit">
        <div className="landing-image-slot main with-image">
          <img src={builderPreviewImage} alt="Aperçu du builder avec une scène et ses zones interactives" />
          <span>Builder</span>
        </div>
        <div className="landing-image-slot with-image">
          <img src={galleryPageImage} alt="Galerie publique avec les escape games à découvrir" />
          <span>Galerie</span>
        </div>
        <div className="landing-image-slot with-image">
          <img src={playerPageImage} alt="Page joueur avec image du jeu, note et avis" />
          <span>Joueur</span>
        </div>
      </section>

      <section className="landing-section landing-features">
        <div className="landing-section-head">
          <span className="section-kicker">Facile</span>
          <h2>Un studio complet, pensé pour les créateurs.</h2>
          <p>Tu ne programmes pas : tu remplis, tu places, tu relies et tu testes dans le même espace de travail.</p>
        </div>
        <div className="landing-card-grid">
          {featureCards.map(([title, text]) => (
            <article className="landing-card" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-split landing-split-product">
        <div className="landing-section-copy">
          <span className="section-kicker">Logique & IA</span>
          <h2>Des jeux plus riches, sans devenir développeur.</h2>
          <p>
            Crée des règles conditionnelles : objets requis, portes verrouillées, scènes débloquées,
            énigmes réussies, cinématiques lancées ou deuxièmes clics. Et si tu veux aller plus vite,
            l'IA peut t'aider à générer, continuer ou améliorer un projet.
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
            <img src={aiImage} alt="Assistant IA générant des scènes, objets et contraintes visuelles" />
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
