import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, PlayCircle, Trophy } from 'lucide-react';
import helpText from '../MODE_EMPLOI.md?raw';
import { getCreatorMissionProgress } from '../data/creatorMissions';
import {
  canUseSupabaseForum,
  createForumPostInSupabase,
  createForumReplyInSupabase,
  deleteForumPostFromSupabase,
  deleteForumReplyFromSupabase,
  loadForumPostsFromSupabase,
  subscribeToForumChanges,
  updateForumPostInSupabase,
  updateForumReplyInSupabase,
} from '../lib/forumStorage';
import { showConfirm } from './AccessibleDialog';

import {
  BEGINNER_FAQ_ITEMS,
  BEGINNER_HELP_TUTORIAL_OPTIONS,
  BEGINNER_MANUAL_SECTIONS,
  FAQ_ITEMS,
  HELP_FORUM_CATEGORIES,
  HELP_FORUM_DEFAULT_POSTS,
  HELP_FORUM_STORAGE_KEY,
  HELP_MODES,
  HELP_TUTORIAL_OPTIONS,
  INTERMEDIATE_HELP_TUTORIAL_OPTIONS,
} from './help/helpTabData.js';

const parseHelpSections = (source) => {
  const lines = String(source || '').split(/\r?\n/);
  const title = lines.find((line) => line.startsWith('# '))?.replace(/^#\s+/, '').trim() || 'Aide';
  const intro = [];
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (line.startsWith('# ')) return;

    const sectionMatch = line.match(/^##\s+(?:\d+\.\s*)?(.+)$/);
    if (sectionMatch) {
      if (current) sections.push(current);
      current = {
        title: sectionMatch[1].trim(),
        content: [],
      };
      return;
    }

    if (current) {
      current.content.push(line);
    } else if (line.trim()) {
      intro.push(line);
    }
  });

  if (current) sections.push(current);
  return { title, intro: intro.join('\n'), sections };
};

const renderInline = (text) => (
  String(text).split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  })
);

const pushList = (blocks, list) => {
  if (!list) return null;
  blocks.push(list);
  return null;
};

const parseMarkdownBlocks = (markdown) => {
  const lines = String(markdown || '').split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      list = pushList(blocks, list);
      return;
    }

    const heading = trimmed.match(/^###\s+(.+)$/);
    if (heading) {
      flushParagraph();
      list = pushList(blocks, list);
      blocks.push({ type: 'heading', text: heading[1] });
      return;
    }

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      list = pushList(blocks, list);
      blocks.push({ type: 'quote', text: quote[1] });
      return;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== 'ordered') {
        list = pushList(blocks, list);
        list = { type: 'ordered', items: [] };
      }
      list.items.push(ordered[2]);
      return;
    }

    const unordered = trimmed.match(/^-\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!list || list.type !== 'unordered') {
        list = pushList(blocks, list);
        list = { type: 'unordered', items: [] };
      }
      list.items.push(unordered[1]);
      return;
    }

    list = pushList(blocks, list);
    paragraph.push(trimmed);
  });

  flushParagraph();
  pushList(blocks, list);
  return blocks;
};

const HelpContent = ({ markdown }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(markdown), [markdown]);

  return (
    <div className="help-readable">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return <h3 key={index}>{renderInline(block.text)}</h3>;
        }
        if (block.type === 'paragraph') {
          return <p key={index}>{renderInline(block.text)}</p>;
        }
        if (block.type === 'quote') {
          return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
        }
        if (block.type === 'ordered') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
            </ol>
          );
        }
        if (block.type === 'unordered') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
};

const createForumId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `forum-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const readForumPosts = () => {
  if (typeof window === 'undefined') return [];
  try {
    const posts = JSON.parse(window.localStorage.getItem(HELP_FORUM_STORAGE_KEY) || '[]');
    return mergeForumDefaultPosts(Array.isArray(posts) ? posts : []);
  } catch {
    return HELP_FORUM_DEFAULT_POSTS;
  }
};

const mergeForumDefaultPosts = (posts = []) => {
  const safePosts = Array.isArray(posts) ? posts : [];
  const existingIds = new Set(safePosts.map((post) => post.id));
  return [
    ...safePosts,
    ...HELP_FORUM_DEFAULT_POSTS.filter((post) => !existingIds.has(post.id)),
  ];
};

const writeForumPosts = (posts) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HELP_FORUM_STORAGE_KEY, JSON.stringify(posts));
};

const getForumCategoryLabel = (category) => (
  HELP_FORUM_CATEGORIES.find(([value]) => value === category)?.[1] || 'Entraide'
);

const getForumUserId = (user) => user?.id || user?.email || 'local-user';

const getForumUserName = (user) => (
  user?.name
  || user?.pseudo
  || user?.username
  || user?.email?.split('@')?.[0]
  || 'Createur'
);

const normalizeForumPostsForUser = (posts, currentUserId) => {
  const defaultIds = new Set(HELP_FORUM_DEFAULT_POSTS.map((post) => post.id));
  return mergeForumDefaultPosts(posts).map((post) => {
    const isDefaultPost = defaultIds.has(post.id);
    return {
      ...post,
      ownerId: post.ownerId || (!isDefaultPost ? currentUserId : ''),
      replies: (post.replies || []).map((reply) => ({
        ...reply,
        ownerId: reply.ownerId || (!isDefaultPost ? currentUserId : ''),
      })),
    };
  });
};

const formatForumDate = (value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
};

const HelpForum = ({ user }) => {
  const currentUserId = getForumUserId(user);
  const currentUserName = getForumUserName(user);
  const [posts, setPosts] = useState(() => normalizeForumPostsForUser(readForumPosts(), currentUserId));
  const [activeCategory, setActiveCategory] = useState('all');
  const [draft, setDraft] = useState({
    category: 'help',
    author: currentUserName,
    title: '',
    body: '',
    link: '',
  });
  const [replyDrafts, setReplyDrafts] = useState({});
  const [editingPostId, setEditingPostId] = useState('');
  const [editingPostDraft, setEditingPostDraft] = useState({ category: 'help', title: '', body: '', link: '' });
  const [editingReplyId, setEditingReplyId] = useState('');
  const [editingReplyDraft, setEditingReplyDraft] = useState('');
  const [error, setError] = useState('');
  const [forumStatus, setForumStatus] = useState(() => (canUseSupabaseForum() ? 'Connexion Supabase...' : 'Forum local'));
  const [forumStorageMode, setForumStorageMode] = useState(() => (canUseSupabaseForum() ? 'loading' : 'local'));
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [forumSearch, setForumSearch] = useState('');

  useEffect(() => {
    setPosts((currentPosts) => normalizeForumPostsForUser(currentPosts, currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    writeForumPosts(posts);
  }, [posts]);

  useEffect(() => {
    let cancelled = false;

    const loadRemotePosts = async () => {
      if (!canUseSupabaseForum()) {
        setForumStorageMode('local');
        setForumStatus('Forum local');
        return;
      }

      try {
        const remotePosts = await loadForumPostsFromSupabase();
        if (cancelled) return;
        if (remotePosts) {
          setPosts(normalizeForumPostsForUser(remotePosts, currentUserId));
          setForumStorageMode('supabase');
          setForumStatus('Forum synchronise avec Supabase');
          return;
        }
        setForumStorageMode('local');
        setForumStatus('Tables forum Supabase absentes : mode local');
      } catch (loadError) {
        if (cancelled) return;
        setForumStorageMode('local');
        setForumStatus(`Supabase indisponible : ${loadError.message || 'mode local'}`);
      }
    };

    loadRemotePosts();
    const unsubscribe = subscribeToForumChanges(() => {
      loadRemotePosts();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUserId]);

  const visiblePosts = useMemo(() => {
    const normalizedSearch = forumSearch.trim().toLowerCase();
    return [...posts]
      .filter((post) => activeCategory === 'all' || post.category === activeCategory)
      .filter((post) => {
        if (!normalizedSearch) return true;
        const searchableText = [
          post.title,
          post.body,
          post.author,
          post.link,
          getForumCategoryLabel(post.category),
          ...(post.replies || []).flatMap((reply) => [reply.author, reply.body]),
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(normalizedSearch);
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [activeCategory, forumSearch, posts]);

  const submitPost = async (event) => {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    const link = draft.link.trim();
    if (!title || !body) {
      setError('Titre et message sont obligatoires.');
      return;
    }
    const timestamp = new Date().toISOString();
    const post = {
      id: createForumId(),
      category: draft.category,
      author: draft.author.trim() || currentUserName,
      ownerId: currentUserId,
      title: title.slice(0, 120),
      body: body.slice(0, 1200),
      link,
      replies: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    try {
      if (forumStorageMode === 'supabase') {
        const remotePost = await createForumPostInSupabase({ post, userId: currentUserId });
        if (remotePost) {
          setPosts((currentPosts) => [remotePost, ...currentPosts.filter((entry) => entry.id !== remotePost.id)]);
        } else {
          setForumStorageMode('local');
          setForumStatus('Tables forum Supabase absentes : mode local');
          setPosts((currentPosts) => [post, ...currentPosts]);
        }
      } else {
        setPosts((currentPosts) => [post, ...currentPosts]);
      }
      setDraft({ category: 'help', author: draft.author || currentUserName, title: '', body: '', link: '' });
      setError('');
      setIsComposerOpen(false);
    } catch (submitError) {
      setError(submitError.message || 'Publication impossible avec Supabase.');
    }
  };

  const submitReply = async (event, postId) => {
    event.preventDefault();
    const replyText = String(replyDrafts[postId] || '').trim();
    if (!replyText) return;
    const reply = {
      id: createForumId(),
      author: currentUserName,
      ownerId: currentUserId,
      body: replyText.slice(0, 800),
      createdAt: new Date().toISOString(),
    };
    try {
      const savedReply = forumStorageMode === 'supabase'
        ? await createForumReplyInSupabase({ postId, reply, userId: currentUserId })
        : reply;
      const nextReply = savedReply || reply;
      setPosts((currentPosts) => currentPosts.map((post) => (
        post.id === postId
          ? { ...post, replies: [...(post.replies || []), nextReply], updatedAt: nextReply.createdAt }
          : post
      )));
      setReplyDrafts((currentDrafts) => ({ ...currentDrafts, [postId]: '' }));
      setError('');
    } catch (submitError) {
      setError(submitError.message || 'Réponse impossible avec Supabase.');
    }
  };

  const canEditPost = (post) => !post.readOnly && post.ownerId === currentUserId;
  const canEditReply = (reply) => reply.ownerId === currentUserId;

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditingPostDraft({
      category: post.category || 'help',
      title: post.title || '',
      body: post.body || '',
      link: post.link || '',
    });
  };

  const submitPostEdit = async (event, postId) => {
    event.preventDefault();
    const title = editingPostDraft.title.trim();
    const body = editingPostDraft.body.trim();
    if (!title || !body) return;
    const timestamp = new Date().toISOString();
    const patch = {
      category: editingPostDraft.category,
      title: title.slice(0, 120),
      body: body.slice(0, 1200),
      link: editingPostDraft.link.trim(),
      updatedAt: timestamp,
    };
    try {
      if (forumStorageMode === 'supabase') {
        await updateForumPostInSupabase({ postId, patch, userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.map((post) => (
        post.id === postId && canEditPost(post)
          ? { ...post, ...patch }
          : post
      )));
      setEditingPostId('');
      setError('');
    } catch (submitError) {
      setError(submitError.message || 'Modification impossible avec Supabase.');
    }
  };

  const startEditReply = (reply) => {
    setEditingReplyId(reply.id);
    setEditingReplyDraft(reply.body || '');
  };

  const submitReplyEdit = async (event, postId, replyId) => {
    event.preventDefault();
    const body = editingReplyDraft.trim();
    if (!body) return;
    const timestamp = new Date().toISOString();
    try {
      if (forumStorageMode === 'supabase') {
        await updateForumReplyInSupabase({ replyId, body: body.slice(0, 800), userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          updatedAt: timestamp,
          replies: (post.replies || []).map((reply) => (
            reply.id === replyId && canEditReply(reply)
              ? { ...reply, body: body.slice(0, 800), updatedAt: timestamp }
              : reply
          )),
        };
      }));
      setEditingReplyId('');
      setEditingReplyDraft('');
      setError('');
    } catch (submitError) {
      setError(submitError.message || 'Modification impossible avec Supabase.');
    }
  };

  const deletePost = async (postId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer le sujet',
      message: 'Supprimer ce sujet du forum ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      if (forumStorageMode === 'supabase') {
        await deleteForumPostFromSupabase({ postId, userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId || !canEditPost(post)));
      setError('');
    } catch (deleteError) {
      setError(deleteError.message || 'Suppression impossible avec Supabase.');
    }
  };

  const deleteReply = async (postId, replyId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer la réponse',
      message: 'Supprimer cette réponse du forum ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      if (forumStorageMode === 'supabase') {
        await deleteForumReplyFromSupabase({ replyId, userId: currentUserId });
      }
      setPosts((currentPosts) => currentPosts.map((post) => {
        if (post.id !== postId) return post;
        const replies = (post.replies || []).filter((reply) => reply.id !== replyId || !canEditReply(reply));
        return { ...post, replies, updatedAt: new Date().toISOString() };
      }));
      setError('');
    } catch (deleteError) {
      setError(deleteError.message || 'Suppression impossible avec Supabase.');
    }
  };

  return (
    <div className="help-forum">
      <div className="help-forum-toolbar">
        <label className="help-forum-search">
          <span>Recherche mots clés</span>
          <input
            type="search"
            value={forumSearch}
            onChange={(event) => setForumSearch(event.target.value)}
            placeholder="Énigme, bug, lien, auteur..."
          />
        </label>
        <div className="help-forum-toolbar-actions">
          <span className={`project-sync-badge ${forumStorageMode === 'supabase' ? 'synced' : 'offline'}`}>
            {forumStatus}
          </span>
          {forumSearch ? (
            <button type="button" className="secondary-action" onClick={() => setForumSearch('')}>Effacer</button>
          ) : null}
          <button type="button" className="profile-action-button" onClick={() => setIsComposerOpen(true)}>
            Ouvrir nouveau sujet
          </button>
        </div>
      </div>

      {isComposerOpen ? (
        <div className="help-forum-modal-backdrop" role="presentation" onMouseDown={() => setIsComposerOpen(false)}>
          <div className="help-forum-modal panel" role="dialog" aria-modal="true" aria-labelledby="help-forum-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-head">
              <div>
                <span className="section-kicker">Forum</span>
                <h2 id="help-forum-modal-title">Nouveau sujet</h2>
              </div>
              <button type="button" className="secondary-action" onClick={() => setIsComposerOpen(false)}>Fermer</button>
            </div>
            <form className="help-forum-composer" onSubmit={submitPost}>
              <div className="grid-two small-gap">
                <div>
                  <label>Catégorie</label>
                  <select
                    value={draft.category}
                    onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, category: event.target.value }))}
                  >
                    {HELP_FORUM_CATEGORIES.filter(([value]) => value !== 'rules').map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Nom affiche</label>
                  <input
                    value={draft.author}
                    onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, author: event.target.value }))}
                    placeholder="Createur"
                  />
                </div>
              </div>
              <label>Titre du sujet</label>
              <input
                value={draft.title}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
                placeholder="Ex. Comment rendre cette énigme moins obscure ?"
                maxLength={120}
              />
              <label>Message</label>
              <textarea
                value={draft.body}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, body: event.target.value }))}
                placeholder="Explique ton blocage, ton conseil, ou présente ton jeu..."
                maxLength={1200}
              />
              <label>Lien de jeu ou ressource</label>
              <input
                value={draft.link}
                onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, link: event.target.value }))}
                placeholder="https://..."
              />
              {error ? <p className="auth-error">{error}</p> : null}
              <div className="help-forum-modal-actions">
                <button type="button" className="secondary-action" onClick={() => setIsComposerOpen(false)}>Annuler</button>
                <button type="submit" className="profile-action-button">Publier le sujet</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="help-forum-board">
        <nav className="help-forum-filters" aria-label="Filtrer le forum">
          <button type="button" className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>
            Tous
          </button>
          {HELP_FORUM_CATEGORIES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={activeCategory === value ? 'active' : ''}
              onClick={() => setActiveCategory(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="help-forum-list">
          {visiblePosts.length ? visiblePosts.map((post) => (
            <article key={post.id} className={`help-forum-post ${post.category}`}>
              <div className="help-forum-post-head">
                <div>
                  <span className="section-kicker">{getForumCategoryLabel(post.category)}</span>
                  <h3>{post.title}</h3>
                  <p className="small-note">
                    {post.author || 'Createur'} - {formatForumDate(post.createdAt)}
                  </p>
                </div>
                {canEditPost(post) ? (
                  <div className="help-forum-actions">
                    <button type="button" className="secondary-action compact" onClick={() => startEditPost(post)}>Modifier</button>
                    <button type="button" className="danger-button compact" onClick={() => deletePost(post.id)}>Supprimer</button>
                  </div>
                ) : null}
              </div>
              {editingPostId === post.id ? (
                <form className="help-forum-edit-form" onSubmit={(event) => submitPostEdit(event, post.id)}>
                  <select
                    value={editingPostDraft.category}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, category: event.target.value }))}
                  >
                    {HELP_FORUM_CATEGORIES.filter(([value]) => value !== 'rules').map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    value={editingPostDraft.title}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
                    maxLength={120}
                  />
                  <textarea
                    value={editingPostDraft.body}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, body: event.target.value }))}
                    maxLength={1200}
                  />
                  <input
                    value={editingPostDraft.link}
                    onChange={(event) => setEditingPostDraft((currentDraft) => ({ ...currentDraft, link: event.target.value }))}
                    placeholder="https://..."
                  />
                  <div className="help-forum-actions">
                    <button type="button" className="secondary-action" onClick={() => setEditingPostId('')}>Annuler</button>
                    <button type="submit" className="profile-action-button">Enregistrer</button>
                  </div>
                </form>
              ) : (
                <>
                  <p>{post.body}</p>
                  {post.link ? (
                    <a className="help-forum-link" href={post.link} target="_blank" rel="noreferrer">
                      Ouvrir le lien partage
                    </a>
                  ) : null}
                </>
              )}
              {(post.replies || []).length ? (
                <div className="help-forum-replies">
                  {post.replies.map((reply) => (
                    <div key={reply.id} className="help-forum-reply">
                      <div className="help-forum-reply-head">
                        <div>
                          <strong>{reply.author || 'Createur'}</strong>
                          <span>{formatForumDate(reply.createdAt)}</span>
                        </div>
                        {canEditReply(reply) ? (
                          <div className="help-forum-actions">
                            <button type="button" className="secondary-action compact" onClick={() => startEditReply(reply)}>Modifier</button>
                            <button type="button" className="danger-button compact" onClick={() => deleteReply(post.id, reply.id)}>Supprimer</button>
                          </div>
                        ) : null}
                      </div>
                      {editingReplyId === reply.id ? (
                        <form className="help-forum-edit-form" onSubmit={(event) => submitReplyEdit(event, post.id, reply.id)}>
                          <textarea
                            value={editingReplyDraft}
                            onChange={(event) => setEditingReplyDraft(event.target.value)}
                            maxLength={800}
                          />
                          <div className="help-forum-actions">
                            <button type="button" className="secondary-action" onClick={() => setEditingReplyId('')}>Annuler</button>
                            <button type="submit" className="profile-action-button">Enregistrer</button>
                          </div>
                        </form>
                      ) : (
                        <p>{reply.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {!post.readOnly ? (
                <form className="help-forum-reply-form" onSubmit={(event) => submitReply(event, post.id)}>
                  <input
                    value={replyDrafts[post.id] || ''}
                    onChange={(event) => setReplyDrafts((currentDrafts) => ({ ...currentDrafts, [post.id]: event.target.value }))}
                    placeholder="Répondre à ce sujet..."
                  />
                  <button type="submit" className="secondary-action">Repondre</button>
                </form>
              ) : (
                <p className="small-note">Sujet d'information : les réponses sont desactivees.</p>
              )}
            </article>
          )) : (
            <div className="empty-state-inline">
              <div>
                <strong>Aucun sujet pour le moment</strong>
                <p className="small-note">Publie une question, un conseil ou un lien de jeu pour amorcer le forum.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function CreatorMissionPanel({ progress, onStartTutorial }) {
  const progressPercent = progress.totalCount
    ? Math.round((progress.completedCount / progress.totalCount) * 100)
    : 0;

  return (
    <div className="creator-missions">
      <div className="creator-mission-summary">
        <div>
          <span className="section-kicker">Progression</span>
          <h3>Mode missions créateur</h3>
          <p className="small-note">
            Une feuille de route pour construire un premier escape game jouable, testable, puis publié.
          </p>
        </div>
        <strong>{progress.completedCount}/{progress.totalCount}</strong>
      </div>

      <div
        className="creator-mission-progress"
        role="progressbar"
        aria-label="Progression des missions créateur"
        aria-valuenow={progress.completedCount}
        aria-valuemin={0}
        aria-valuemax={progress.totalCount}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="creator-mission-list">
        {progress.missions.map((mission) => (
          <article
            key={mission.id}
            className={`creator-mission-card${mission.isComplete ? ' done' : ''}`}
          >
            <span className="creator-mission-status" aria-hidden="true">
              {mission.isComplete ? <CheckCircle2 size={21} /> : <Circle size={21} />}
            </span>
            <div className="creator-mission-body">
              <span>Mission {mission.number}</span>
              <strong>{mission.title}</strong>
              <p>{mission.description}</p>
            </div>
            {mission.tutorialTab ? (
              <button
                type="button"
                className="secondary-action creator-mission-action"
                onClick={() => onStartTutorial?.(mission.tutorialTab)}
              >
                <PlayCircle size={16} aria-hidden="true" />
                {mission.isComplete ? 'Rejouer le guide' : mission.actionLabel}
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {progress.allDone ? (
        <div className="creator-mission-badge">
          <Trophy size={22} aria-hidden="true" />
          <strong>{progress.badgeLabel}</strong>
        </div>
      ) : null}
    </div>
  );
}

export default function HelpTab({ user, project = null, projectRecord = null, projectMode = 'expert', onStartTutorial }) {
  const help = useMemo(() => parseHelpSections(helpText), []);
  const [activeMode, setActiveMode] = useState('manual');
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState('');
  const manualSections = useMemo(() => (
    projectMode === 'beginner' ? BEGINNER_MANUAL_SECTIONS : help.sections
  ), [help.sections, projectMode]);
  const visibleFaqItems = projectMode === 'beginner' ? BEGINNER_FAQ_ITEMS : FAQ_ITEMS;
  const visibleTutorialOptions = useMemo(() => (
    projectMode === 'beginner'
      ? HELP_TUTORIAL_OPTIONS.filter(([value]) => BEGINNER_HELP_TUTORIAL_OPTIONS.has(value))
      : projectMode === 'intermediate'
        ? HELP_TUTORIAL_OPTIONS.filter(([value]) => INTERMEDIATE_HELP_TUTORIAL_OPTIONS.has(value))
        : HELP_TUTORIAL_OPTIONS
  ), [projectMode]);
  const missionProgress = useMemo(
    () => getCreatorMissionProgress(project, projectRecord),
    [project, projectRecord],
  );
  useEffect(() => {
    if (activeIndex >= manualSections.length) setActiveIndex(0);
  }, [activeIndex, manualSections.length]);
  const activeSection = manualSections[activeIndex] || manualSections[0];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredSections = normalizedSearch
    ? manualSections
      .map((section, index) => ({ ...section, index }))
      .filter((section) => (
        section.title.toLowerCase().includes(normalizedSearch)
        || section.content.join('\n').toLowerCase().includes(normalizedSearch)
      ))
    : manualSections.map((section, index) => ({ ...section, index }));

  return (
    <div className="help-layout">
      <aside className="panel help-nav-card">
        <div className="panel-head panel-head-stack help-panel-head">
          <div>
            <span className="section-kicker">Aide</span>
            <h2>Aide</h2>
          </div>
        </div>

        <div className="help-mode-switch" role="tablist" aria-label="Sections principales de l'aide">
          {HELP_MODES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeMode === value}
              className={activeMode === value ? 'active' : ''}
              onClick={() => setActiveMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeMode === 'manual' ? (
          <>
            <label className="help-search">
              <span>Rechercher dans l'aide</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Scène, énigme, export..."
              />
            </label>

            <nav className="help-section-nav" aria-label="Sections d'aide">
              {filteredSections.map((section) => (
                <button
                  key={section.title}
                  type="button"
                  aria-current={section.index === activeIndex ? 'page' : undefined}
                  className={`help-nav-item${section.index === activeIndex ? ' active' : ''}`}
                  onClick={() => setActiveIndex(section.index)}
                >
                  <span>{String(section.index + 1).padStart(2, '0')}</span>
                  <strong>{section.title}</strong>
                </button>
              ))}
              {!filteredSections.length ? (
                <p className="small-note help-empty-search">Aucune section trouvée.</p>
              ) : null}
            </nav>
          </>
        ) : null}
      </aside>

      <article className="panel help-content-panel">
        {activeMode === 'manual' && activeSection ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Mode d'emploi</span>
                <h2>{help.title}</h2>
                <p className="small-note">{activeSection.title}</p>
              </div>
            </div>
            <HelpContent markdown={activeSection.content.join('\n').trim()} />
          </>
        ) : null}

        {activeMode === 'faq' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">FAQ</span>
                <h2>Questions frequentes</h2>
                <p className="small-note">Les réponses rapides aux blocages les plus courants.</p>
              </div>
            </div>
            <div className="help-faq-list">
              {visibleFaqItems.map((item) => (
                <details key={item.question} className="help-faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </>
        ) : null}

        {activeMode === 'missions' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Missions</span>
                <h2>Créer son premier jeu</h2>
                <p className="small-note">Avance étape par étape, avec validation automatique dès que ton projet remplit l’objectif.</p>
              </div>
            </div>
            <CreatorMissionPanel progress={missionProgress} onStartTutorial={onStartTutorial} />
          </>
        ) : null}

        {activeMode === 'tutorials' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Didacticiel</span>
                <h2>Choisir un parcours</h2>
                <p className="small-note">Lance un parcours guide pour apprendre une partie précise du builder.</p>
              </div>
            </div>
            <div className="help-tutorial-grid">
              {visibleTutorialOptions.map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  className="help-tutorial-card"
                  onClick={() => onStartTutorial?.(value)}
                >
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {activeMode === 'forum' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Forum</span>
                <h2>Entraide, conseils et jeux ? tester</h2>
                <p className="small-note">Pose une question, partage une astuce ou fais la promotion d'un lien de jeu.</p>
              </div>
            </div>
            <HelpForum user={user} />
          </>
        ) : null}

        {activeMode === 'manual' && !activeSection ? (
          <p>Aucune aide disponible.</p>
        ) : null}
      </article>
    </div>
  );
}
