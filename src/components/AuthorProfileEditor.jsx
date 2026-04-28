import React, { useEffect, useState } from 'react';

export default function AuthorProfileEditor({
  user,
  authorProfile,
  onUpdateAuthorProfile,
  onBack,
}) {
  const [authorDraft, setAuthorDraft] = useState(() => ({
    displayName: authorProfile?.displayName || user?.name || user?.email || '',
    tagline: authorProfile?.tagline || '',
    bio: authorProfile?.bio || '',
    website: authorProfile?.website || '',
  }));
  const [blogDraft, setBlogDraft] = useState({ title: '', body: '' });

  useEffect(() => {
    setAuthorDraft({
      displayName: authorProfile?.displayName || user?.name || user?.email || '',
      tagline: authorProfile?.tagline || '',
      bio: authorProfile?.bio || '',
      website: authorProfile?.website || '',
    });
  }, [authorProfile, user]);

  const saveAuthorDraft = async (event) => {
    event.preventDefault();
    await onUpdateAuthorProfile?.(authorDraft);
  };

  const publishBlogPost = async (event) => {
    event.preventDefault();
    const title = blogDraft.title.trim();
    const body = blogDraft.body.trim();
    if (!title || !body) return;
    const post = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.slice(0, 80),
      body: body.slice(0, 600),
      createdAt: new Date().toISOString(),
    };
    await onUpdateAuthorProfile?.({
      ...(authorProfile || {}),
      ...authorDraft,
      blogPosts: [post, ...(authorProfile?.blogPosts || [])].slice(0, 10),
    });
    setBlogDraft({ title: '', body: '' });
  };

  const deleteBlogPost = async (postId) => {
    if (!window.confirm('Supprimer cet article ?')) return;
    await onUpdateAuthorProfile?.({
      ...(authorProfile || {}),
      ...authorDraft,
      blogPosts: (authorProfile?.blogPosts || []).filter((post) => post.id !== postId),
    });
  };

  return (
    <section className="public-author-editor">
      <button type="button" className="secondary-action public-back-button" onClick={onBack}>← Retour au jeu</button>
      <section className="panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="eyebrow">Auteur</span>
            <h2>Profil public</h2>
            <p className="small-note">Cette fiche est visible dans la galerie publique avec tes jeux publiés.</p>
          </div>
        </div>
        <div className="author-profile-grid">
          <form onSubmit={saveAuthorDraft} className="author-profile-form">
            <label>Nom d’auteur</label>
            <input
              value={authorDraft.displayName}
              onChange={(event) => setAuthorDraft((draft) => ({ ...draft, displayName: event.target.value }))}
              placeholder="Mika"
            />
            <label>Phrase courte</label>
            <input
              value={authorDraft.tagline}
              onChange={(event) => setAuthorDraft((draft) => ({ ...draft, tagline: event.target.value }))}
              placeholder="Escape games narratifs et énigmes maison"
            />
            <label>Bio</label>
            <textarea
              value={authorDraft.bio}
              onChange={(event) => setAuthorDraft((draft) => ({ ...draft, bio: event.target.value }))}
              placeholder="Présente ton style, tes thèmes, ton rythme de création..."
              maxLength={600}
            />
            <label>Site ou réseau</label>
            <input
              value={authorDraft.website}
              onChange={(event) => setAuthorDraft((draft) => ({ ...draft, website: event.target.value }))}
              placeholder="https://..."
            />
            <button type="submit" className="profile-action-button">Mettre à jour le profil</button>
          </form>

          <div className="author-blog-panel">
            <form onSubmit={publishBlogPost}>
              <h3>Mini blog</h3>
              <label>Titre</label>
              <input
                value={blogDraft.title}
                onChange={(event) => setBlogDraft((draft) => ({ ...draft, title: event.target.value }))}
                placeholder="Nouveau décor, nouvelle énigme..."
                maxLength={80}
              />
              <label>Article court</label>
              <textarea
                value={blogDraft.body}
                onChange={(event) => setBlogDraft((draft) => ({ ...draft, body: event.target.value }))}
                placeholder="Partage une actu, un making-of, une note d’auteur..."
                maxLength={600}
              />
              <button type="submit" className="profile-action-button secondary-action">Publier l’article</button>
            </form>

            <div className="author-blog-list">
              {(authorProfile?.blogPosts || []).length ? authorProfile.blogPosts.map((post) => (
                <article key={post.id} className="author-blog-card">
                  <strong>{post.title}</strong>
                  <p>{post.body}</p>
                  <button type="button" className="secondary-action" onClick={() => deleteBlogPost(post.id)}>Supprimer</button>
                </article>
              )) : <p className="small-note">Aucun article publié.</p>}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
