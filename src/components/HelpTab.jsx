import { useMemo, useState } from 'react';
import helpText from '../MODE_EMPLOI.md?raw';

const HELP_MODES = [
  ['manual', "Mode d'emploi"],
  ['faq', 'FAQ'],
  ['tutorials', 'Didacticiel'],
];

const HELP_TUTORIAL_OPTIONS = [
  ['profile', 'Profil', 'Comprendre la page de depart, les projets, les imports et la publication.'],
  ['scenes', 'Scenes', 'Creer une scene, poser une ambiance, ajouter des objets et medias.'],
  ['editor', 'Editeur', 'Ajouter des zones cliquables, zones visuelles et tester le rendu joueur.'],
  ['map', 'Plan', 'Organiser les pieces et verifier les connexions du parcours.'],
  ['cinematics', 'Cinematiques', 'Construire une sequence narrative avec images, textes et transitions.'],
  ['combinations', 'Combinaisons', 'Relier des objets entre eux pour creer de nouveaux resultats.'],
  ['enigmas', 'Enigmes', 'Creer un code, une apparence joueur et une validation claire.'],
  ['logic', 'Logique', 'Declencher des consequences selon les actions, objets ou zones franchies.'],
  ['ai', 'IA', 'Utiliser l assistant IA, comprendre les credits, brouillons et generations.'],
];

const FAQ_ITEMS = [
  {
    question: 'Par quoi commencer quand on decouvre le builder ?',
    answer: 'Commence par le didacticiel Profil, puis Scenes, Editeur et Logique. Ces parcours donnent les bases pour creer un jeu jouable : lieux, interactions et consequences.',
  },
  {
    question: 'Quelle difference entre une scene et une sous-scene ?',
    answer: 'Une scene est un lieu principal. Une sous-scene est un detail ou une variation rattachee a ce lieu : tiroir ouvert, coffre, gros plan, couloir secondaire.',
  },
  {
    question: 'Pourquoi tester souvent en Preview ?',
    answer: 'La Preview montre ce que voit le joueur. Elle permet de verifier les dialogues, les zones cliquables, les enigmes, les objets gagnes et les changements de scene.',
  },
  {
    question: 'A quoi sert le Plan ?',
    answer: 'Le Plan sert a voir le parcours d un seul coup d oeil et a verifier que les connexions entre les pieces sont bien presentes.',
  },
  {
    question: 'Quand utiliser la Logique ?',
    answer: 'Utilise la Logique quand une action doit dependre d une condition : posseder un objet, avoir traverse une zone, resoudre une enigme, puis declencher une consequence.',
  },
  {
    question: 'Est-ce que les didacticiels modifient mon vrai projet ?',
    answer: 'Les didacticiels du builder utilisent un projet temporaire quand c est necessaire. Le didacticiel Profil explique la page actuelle sans creer de projet tout seul.',
  },
  {
    question: 'Que verifier avant de publier ?',
    answer: 'Teste le jeu, verifie les zones non reliees, les enigmes sans solution, la categorie, la mention d age et la miniature de galerie.',
  },
];

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

export default function HelpTab({ onStartTutorial }) {
  const help = useMemo(() => parseHelpSections(helpText), []);
  const [activeMode, setActiveMode] = useState('manual');
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState('');
  const activeSection = help.sections[activeIndex] || help.sections[0];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredSections = normalizedSearch
    ? help.sections
      .map((section, index) => ({ ...section, index }))
      .filter((section) => (
        section.title.toLowerCase().includes(normalizedSearch)
        || section.content.join('\n').toLowerCase().includes(normalizedSearch)
      ))
    : help.sections.map((section, index) => ({ ...section, index }));

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
                placeholder="Scene, enigme, export..."
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
                <p className="small-note help-empty-search">Aucune section trouvee.</p>
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
                <p className="small-note">Les reponses rapides aux blocages les plus courants.</p>
              </div>
            </div>
            <div className="help-faq-list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="help-faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </>
        ) : null}

        {activeMode === 'tutorials' ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Didacticiel</span>
                <h2>Choisir un parcours</h2>
                <p className="small-note">Lance un parcours guide pour apprendre une partie precise du builder.</p>
              </div>
            </div>
            <div className="help-tutorial-grid">
              {HELP_TUTORIAL_OPTIONS.map(([value, label, description]) => (
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

        {activeMode === 'manual' && !activeSection ? (
          <p>Aucune aide disponible.</p>
        ) : null}
      </article>
    </div>
  );
}
