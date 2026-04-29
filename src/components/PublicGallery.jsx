import React, { useEffect, useMemo, useState } from 'react';
import AuthorProfileEditor from './AuthorProfileEditor';
import {
  commentPublicGame,
  getGameKey,
  getPublicGames,
  incrementPublicGamePlay,
  ratePublicGame,
} from '../lib/publicGalleryStorage';

const formatRating = (value) => (Number(value || 0) ? Number(value).toFixed(1) : 'Nouveau');

const AGE_FILTERS = [
  ['all', 'Tous'],
  ['safe', 'Sans mature'],
  ['mature', 'Mature inclus'],
];

const makePlayUrl = (game) => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('playUser', game.userId);
  url.searchParams.set('playProject', game.projectId);
  return url.toString();
};

function GalleryImage({ src, alt = '', eager = false, fallback }) {
  const [hasError, setHasError] = useState(false);
  if (!src || hasError) return fallback || null;

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

function Stars({ value = 0, onChange }) {
  return (
    <div className="public-stars" aria-label="Notation">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? 'active' : ''}
          onClick={() => onChange?.(star)}
          aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function GameCard({ game, onOpenGame, onOpenCreator, onPlay }) {
  const fallback = <span>{game.title.charAt(0).toUpperCase()}</span>;
  return (
    <article className="public-game-card">
      <button type="button" className="public-game-image" onClick={() => onOpenGame(game.key)}>
        <GalleryImage src={game.image} fallback={fallback} />
      </button>
      <div className="public-game-body">
        <div className="public-card-head">
          <button type="button" className="public-title-button" onClick={() => onOpenGame(game.key)}>
            {game.title}
          </button>
          <div className="public-card-pills">
            <span className="public-rating-pill">★ {formatRating(game.feedback.average)}</span>
            <span className={`public-age-pill ${game.isMature ? 'mature' : ''}`}>{game.isMature ? '🔞 +18' : game.ageRating}</span>
          </div>
        </div>
        <button type="button" className="public-author-link" onClick={() => onOpenCreator(game.userId)}>
          par {game.author}
        </button>
        <div className="public-play-count">▶ {game.plays} partie{game.plays > 1 ? 's' : ''} jouée{game.plays > 1 ? 's' : ''}</div>
        <div className="public-meta-row">
          <span>{game.category}</span>
          <span>{game.durationMinutes} min</span>
          <span>{game.difficulty}</span>
          <span>{game.feedback.votes} vote{game.feedback.votes > 1 ? 's' : ''}</span>
        </div>
        {game.badges.length ? (
          <div className="public-badges">
            {game.badges.map((badge) => <span key={badge}>{badge}</span>)}
          </div>
        ) : null}
        <button type="button" className="public-play-button" onClick={() => onPlay(game)}>
          ▶ Jouer
        </button>
      </div>
    </article>
  );
}

export default function PublicGallery({
  user,
  authorProfile,
  initialGameKey = '',
  initialCreatorId = '',
  onUpdateAuthorProfile,
  onSignup,
  onClose,
}) {
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState(initialGameKey ? 'game' : initialCreatorId ? 'creator' : 'discover');
  const [selectedGameKey, setSelectedGameKey] = useState(initialGameKey);
  const [selectedCreatorId, setSelectedCreatorId] = useState(initialCreatorId);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('all');
  const [commentText, setCommentText] = useState('');

  const refreshGames = async () => {
    setIsLoading(true);
    const nextGames = await getPublicGames({ currentUser: user });
    setGames(nextGames);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshGames();
  }, [user?.id]);

  const openDiscover = () => {
    setView('discover');
    setSelectedGameKey('');
    setSelectedCreatorId('');
  };

  const openGame = (gameKey) => {
    setView('game');
    setSelectedGameKey(gameKey);
    setCommentText('');
  };

  const openCreator = (creatorId) => {
    setView('creator');
    setSelectedCreatorId(creatorId);
  };

  const openAuthorEditor = () => {
    setView('author-editor');
  };

  const playGame = (game) => {
    incrementPublicGamePlay(game.key);
    window.open(makePlayUrl(game), '_blank', 'noopener,noreferrer');
    refreshGames();
  };

  const selectedGame = useMemo(
    () => games.find((game) => game.key === selectedGameKey) || null,
    [games, selectedGameKey],
  );

  const selectedCreatorGames = useMemo(
    () => games.filter((game) => game.userId === selectedCreatorId),
    [games, selectedCreatorId],
  );

  const filterOptions = useMemo(() => ({
    categories: [...new Set(games.map((game) => game.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
    difficulties: [...new Set(games.map((game) => game.difficulty).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
  }), [games]);

  const discoverSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = games.filter((game) => (
      (!categoryFilter || game.category === categoryFilter)
      && (!difficultyFilter || game.difficulty === difficultyFilter)
      && (ageFilter !== 'safe' || !game.isMature)
      && (
        !query
        || game.title.toLowerCase().includes(query)
        || game.author.toLowerCase().includes(query)
        || game.difficulty.toLowerCase().includes(query)
        || game.category.toLowerCase().includes(query)
        || game.ageRating.toLowerCase().includes(query)
      )
    ));
    const byScore = [...filtered].sort((a, b) => b.feedback.score - a.feedback.score);
    const byPlays = [...filtered].sort((a, b) => (b.plays + b.feedback.score * 0.5) - (a.plays + a.feedback.score * 0.5));
    const byTrend = [...filtered].sort((a, b) => (
      (b.plays24h * 8 + b.plays7d * 1.5 + b.feedback.score)
      - (a.plays24h * 8 + a.plays7d * 1.5 + a.feedback.score)
    ));
    const byWeek = [...filtered].sort((a, b) => (
      (b.plays7d * 2 + b.feedback.score * 1.6 + b.feedback.votes * 0.25)
      - (a.plays7d * 2 + a.feedback.score * 1.6 + a.feedback.votes * 0.25)
    ));
    const byDate = [...filtered].sort((a, b) => new Date(b.publishedAt || b.updatedAt || 0) - new Date(a.publishedAt || a.updatedAt || 0));
    const random = [...filtered].sort(() => Math.random() - 0.5);
    const categorySections = [...new Set(filtered.map((game) => game.category))]
      .sort((a, b) => a.localeCompare(b, 'fr'))
      .map((category) => ({
        category,
        entries: filtered
          .filter((game) => game.category === category)
          .sort((a, b) => (b.plays + b.feedback.score) - (a.plays + a.feedback.score))
          .slice(0, 6),
      }));

    return {
      filtered,
      categorySections,
      trending: byTrend.slice(0, 6),
      weekTop: byWeek.slice(0, 6),
      popular: byPlays.slice(0, 6),
      newest: byDate.slice(0, 6),
      topRated: byScore.slice(0, 6),
      random: random.slice(0, 3),
    };
  }, [ageFilter, categoryFilter, difficultyFilter, games, search]);

  const rateSelectedGame = (rating) => {
    if (!selectedGame) return;
    ratePublicGame({
      gameKey: selectedGame.key,
      userId: user?.id || 'guest',
      rating,
    });
    refreshGames();
  };

  const submitComment = (event) => {
    event.preventDefault();
    if (!selectedGame) return;
    commentPublicGame({
      gameKey: selectedGame.key,
      userId: user?.id || 'guest',
      authorName: user?.name || user?.email || 'Joueur',
      text: commentText,
    });
    setCommentText('');
    refreshGames();
  };

  const creatorAverage = selectedCreatorGames.length ?
     selectedCreatorGames.reduce((sum, game) => sum + game.feedback.average, 0) / selectedCreatorGames.length
    : 0;
  const creatorName = selectedCreatorGames[0]?.author || 'Créateur';
  const creatorProfile = selectedCreatorGames[0]?.authorProfile || {};
  const currentUserRating = selectedGame?.feedback.ratings.find((entry) => entry.userId === (user?.id || 'guest'))?.rating || 0;

  return (
    <main className="public-gallery-shell">
      <header className="public-gallery-topbar">
        <div>
          <span className="eyebrow">Galerie publique</span>
          <h1>Escape games à découvrir</h1>
        </div>
        <div className="toolbar">
          <button type="button" className="secondary-action" onClick={openDiscover}>Découverte</button>
          {user?.id ? <button type="button" className="secondary-action" onClick={openAuthorEditor}>Mon ? profil auteur</button> : null}
          {onClose ? <button type="button" className="secondary-action" onClick={onClose}>Builder</button> : null}
        </div>
      </header>

      {!user?.id ? (
        <section className="public-builder-cta">
          <div>
            <strong>Crée ton compte builder</strong>
            <p>Transforme tes idées en escape game jouable, publiable et partageable en quelques clics.</p>
          </div>
          <button type="button" onClick={onSignup}>Inscription</button>
        </section>
      ) : null}

      {isLoading ? (
        <section className="panel public-empty-panel">Chargement de la galerie...</section>
      ) : null}

      {!isLoading && view === 'discover' ? (
        <>
          <section className="panel public-discovery-panel">
            <div className="public-discovery-head">
              <div>
                <h2>Découverte</h2>
                <p className="small-note">{games.length} jeu{games.length > 1 ? 'x' : ''} publié{games.length > 1 ? 's' : ''}</p>
              </div>
              <div className="public-filter-grid">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher un jeu, un auteur, une difficulté" />
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">Catégorie</option>
                  {filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
                  <option value="">Difficulté</option>
                  {filterOptions.difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
                </select>
                <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)}>
                  {AGE_FILTERS.map(([value, label]) => <option key={value} value={value}>Âge : {label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {[
            ['🔥 Tendance 24h', discoverSections.trending],
            ['⭐ Top semaine', discoverSections.weekTop],
            ['🔥 Les plus populaires', discoverSections.popular],
            ['🆕 Nouveaux jeux', discoverSections.newest],
            ['🎲 Aléatoire', discoverSections.random],
          ].map(([title, entries]) => (
            <section key={title} className="panel public-section">
              <div className="panel-head">
                <h2>{title}</h2>
              </div>
              {entries.length ? (
                <div className="public-game-grid">
                  {entries.map((game) => (
                    <GameCard key={`${title}-${game.key}`} game={game} onOpenGame={openGame} onOpenCreator={openCreator} onPlay={playGame} />
                  ))}
                </div>
              ) : (
                <div className="empty-state-inline">Aucun jeu publié pour le moment.</div>
              )}
            </section>
          ))}

          {discoverSections.categorySections.map(({ category, entries }) => (
            <section key={`category-${category}`} className="panel public-section">
              <div className="panel-head">
                <h2>{category}</h2>
              </div>
              <div className="public-game-grid">
                {entries.map((game) => (
                  <GameCard key={`category-${category}-${game.key}`} game={game} onOpenGame={openGame} onOpenCreator={openCreator} onPlay={playGame} />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : null}

      {!isLoading && view === 'game' && selectedGame ? (
        <section className="public-game-page">
          <button type="button" className="secondary-action public-back-button" onClick={openDiscover}>← Galerie</button>
          <div className="public-game-hero panel">
            <div className="public-game-cover">
              <GalleryImage
                src={selectedGame.image}
                eager
                fallback={<span>{selectedGame.title.charAt(0).toUpperCase()}</span>}
              />
            </div>
            <div className="public-game-details">
              <div>
                <span className="eyebrow">Page jeu</span>
                <h2>{selectedGame.title}</h2>
                <button type="button" className="public-author-link" onClick={() => openCreator(selectedGame.userId)}>
                  Auteur : {selectedGame.author}
                </button>
              </div>
              {user?.id === selectedGame.userId ? (
                <button type="button" className="profile-publish-button public-author-manage-button" onClick={openAuthorEditor}>
                  Gérer mon profil auteur ?
                </button>
              ) : null}
              <div className="public-score-line">
                <strong>★ {formatRating(selectedGame.feedback.average)}</strong>
                <span>({selectedGame.feedback.votes} vote{selectedGame.feedback.votes > 1 ? 's' : ''})</span>
              </div>
              <div className="public-game-facts">
                <span>{selectedGame.category}</span>
                <span className={selectedGame.isMature ? 'public-fact-mature' : ''}>{selectedGame.isMature ? '🔞 +18' : selectedGame.ageRating}</span>
                <span>⏱ {selectedGame.durationMinutes} min</span>
                <span>🧠 difficulté : {selectedGame.difficulty}</span>
                <span>▶ {selectedGame.plays} partie{selectedGame.plays > 1 ? 's' : ''} jouée{selectedGame.plays > 1 ? 's' : ''}</span>
                <span>🔥 {selectedGame.plays24h} sur 24h</span>
                <span>⭐ {selectedGame.plays7d} cette semaine</span>
              </div>
              {selectedGame.isMature ? (
                <div className="public-mature-warning">
                  <strong>🔞 Jeu réservé aux adultes</strong>
                  <p>Ce jeu est signalé comme contenu mature par son créateur. Il est destiné aux joueurs de 18 ans et plus.</p>
                </div>
              ) : null}
              {selectedGame.badges.length ? <div className="public-badges">{selectedGame.badges.map((badge) => <span key={badge}>{badge}</span>)}</div> : null}
              <button type="button" className="public-main-cta" onClick={() => playGame(selectedGame)}>▶ Jouer maintenant</button>
            </div>
          </div>

          <div className="public-game-columns">
            <section className="panel">
              <h2>Noter</h2>
              <Stars value={currentUserRating} onChange={rateSelectedGame} />
              <form onSubmit={submitComment} className="public-comment-form">
                <label htmlFor="public-comment">Avis court</label>
                <textarea
                  id="public-comment"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="énigmes cool mais un peu facile"
                  maxLength={180}
                />
                <button type="submit">Envoyer l’avis</button>
              </form>
            </section>
            <section className="panel">
              <h2>Avis</h2>
              {selectedGame.feedback.comments.length ? (
                <div className="public-comments">
                  {selectedGame.feedback.comments.map((comment) => (
                    <blockquote key={comment.id}>
                      “{comment.text}”
                      <cite>{comment.authorName}</cite>
                    </blockquote>
                  ))}
                </div>
              ) : (
                <p className="small-note">Aucun avis pour l’instant.</p>
              )}
            </section>
          </div>
        </section>
      ) : null}

      {!isLoading && view === 'author-editor' ? (
        <AuthorProfileEditor
          user={user}
          authorProfile={authorProfile}
          onUpdateAuthorProfile={async (profile) => {
            await onUpdateAuthorProfile?.(profile);
            await refreshGames();
          }}
          onBack={() => setView(selectedGameKey ? 'game' : 'discover')}
        />
      ) : null}

      {!isLoading && view === 'creator' ? (
        <section className="public-creator-page">
          <button type="button" className="secondary-action public-back-button" onClick={openDiscover}>← Galerie</button>
          <section className="panel public-creator-card">
            <div className="public-avatar">{creatorName.charAt(0).toUpperCase()}</div>
            <div>
              <span className="eyebrow">Profil créateur</span>
              <h2>{creatorName}</h2>
              {creatorProfile.tagline ? <p className="public-creator-tagline">{creatorProfile.tagline}</p> : null}
              {creatorProfile.bio ? <p className="small-note public-creator-bio">{creatorProfile.bio}</p> : null}
              {creatorProfile.website ? (
                <a className="public-creator-link" href={creatorProfile.website} target="_blank" rel="noreferrer">
                  Site auteur ?
                </a>
              ) : null}
              <p className="small-note">🎮 {selectedCreatorGames.length} jeu{selectedCreatorGames.length > 1 ? 'x' : ''} créé{selectedCreatorGames.length > 1 ? 's' : ''}</p>
              <p className="small-note">⭐ Moyenne : {formatRating(creatorAverage)}</p>
            </div>
          </section>
          {creatorProfile.blogPosts?.length ? (
            <section className="panel public-section">
              <div className="panel-head">
                <h2>Mini blog</h2>
              </div>
              <div className="public-blog-grid">
                {creatorProfile.blogPosts.map((post) => (
                  <article key={post.id} className="public-blog-card">
                    <strong>{post.title}</strong>
                    <p>{post.body}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section className="panel public-section">
            <div className="public-game-grid">
              {selectedCreatorGames.map((game) => (
                <GameCard key={getGameKey(game.userId, game.projectId)} game={game} onOpenGame={openGame} onOpenCreator={openCreator} onPlay={playGame} />
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}
