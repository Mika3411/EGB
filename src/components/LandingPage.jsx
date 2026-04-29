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
  ['Gratuit pour créer', "Construis tes projets sans payer. Seules les fonctions d'IA utilisent des crédits."],
  ['Sans code', 'Crée des scènes, objets, énigmes, cinématiques et règles de logique avec des formulaires simples.'],
  ['Prêt à partager', 'Publie dans la galerie ou exporte une version jouable de ton escape game.'],
];

const workflowSteps = [
  'Choisis un modèle ou pars de zéro.',
  'Ajoute tes scènes, indices et objets.',
  'Ajoute ta logique, tes énigmes et tes cinématiques.',
  'Teste, publie, partage.',
];

export default function LandingPage({ onLogin, onRegister, onOpenGallery }) {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <nav className="landing-nav">
          <img src={bannerImage} alt="Escape Game Studio" />
          <div>
            <button type="button" className="secondary-action" onClick={onOpenGallery}>Galerie</button>
            <button type="button" onClick={onLogin}>Connexion</button>
          </div>
        </nav>

        <div className="landing-hero-grid">
          <div className="landing-hero-content">
            <span className="section-kicker">Builder no-code</span>
            <h1>Crée ton escape game en ligne, sans code.</h1>
            <p>
              Construis des scènes interactives, des objets, des énigmes, des cinématiques,
              de la logique conditionnelle et un parcours jouable directement dans le navigateur.
            </p>
            <div className="landing-free-note">
              Gratuit pour créer et publier. IA optionnelle avec crédits.
            </div>
            <div className="landing-hero-actions">
              <button type="button" onClick={onRegister}>Commencer gratuitement</button>
              <button type="button" className="secondary-action" onClick={onOpenGallery}>Voir la galerie</button>
            </div>
          </div>

          <div className="landing-hero-visual" aria-label="Emplacement pour capture de l'application">
            <div className="landing-visual-toolbar">
              <span />
              <span />
              <span />
            </div>
            <img src={builderPreviewImage} alt="Aperçu de l'éditeur visuel Escape Game Studio" />
          </div>
        </div>
      </section>

      <section className="landing-image-band" aria-label="Aperçus à remplacer par vos images">
        <div className="landing-image-slot main with-image">
          <img src={builderPreviewImage} alt="Aperçu du builder avec une scène et ses zones interactives" />
        </div>
        <div className="landing-image-slot with-image">
          <img src={galleryPageImage} alt="Galerie publique avec les escape games à découvrir" />
        </div>
        <div className="landing-image-slot with-image">
          <img src={playerPageImage} alt="Page joueur avec image du jeu, note et avis" />
        </div>
      </section>

      <section className="landing-section landing-features">
        <div className="landing-section-head">
          <span className="section-kicker">Facile</span>
          <h2>Un studio complet, pensé pour les créateurs.</h2>
          <p>Tu ne programmes pas : tu remplis, tu places, tu relies et tu testes.</p>
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

      <section className="landing-section landing-split">
        <div>
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
            <img src={cinematicsImage} alt="Éditeur de cinématique avec plusieurs slides et narrations" />
            <span>Cinématiques</span>
          </div>
          <div className="landing-highlight-shot wide">
            <img src={aiImage} alt="Assistant IA générant des scènes, objets et contraintes visuelles" />
            <span>IA optionnelle</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-split">
        <div>
          <span className="section-kicker">Boutique</span>
          <h2>Des packs de projets complets, uniques, prêts à continuer.</h2>
          <p>
            La boutique permet d'acheter des packs de projets complets : une base déjà structurée,
            avec scènes, idées, ambiance et progression. Tu peux ensuite les compléter, les modifier
            et continuer l'histoire à ta façon dans le builder.
          </p>
        </div>
        <div className="landing-shop-preview">
          <div className="landing-shop-card">
            <span>Pack projet complet</span>
            <strong>À compléter</strong>
          </div>
          <div className="landing-shop-card">
            <span>Univers unique</span>
            <strong>À personnaliser</strong>
          </div>
          <div className="landing-shop-card">
            <span>Suite possible</span>
            <strong>À continuer</strong>
          </div>
        </div>
      </section>

      <section className="landing-section landing-split">
        <div>
          <span className="section-kicker">Galerie</span>
          <h2>Publie tes jeux et laisse les joueurs les découvrir.</h2>
          <p>
            La galerie met en avant les escape games publics, les auteurs, les catégories,
            les avis et les parties jouées.
          </p>
          <button type="button" onClick={onOpenGallery}>Explorer la galerie</button>
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
        <p>Crée un compte gratuitement, choisis un modèle ou un pack, puis commence à assembler ton premier parcours.</p>
        <button type="button" onClick={onRegister}>Créer mon compte</button>
      </section>
    </main>
  );
}
