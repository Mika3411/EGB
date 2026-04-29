import { useMemo, useState } from 'react';
import helpText from '../MODE_EMPLOI.md?raw';

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

export default function HelpTab() {
  const help = useMemo(() => parseHelpSections(helpText), []);
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
            <span className="section-kicker">Mode d'emploi</span>
            <h2>Aide</h2>
          </div>
        </div>

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
      </aside>

      <article className="panel help-content-panel">
        {activeSection ? (
          <>
            <div className="panel-head help-content-head">
              <div>
                <span className="section-kicker">Aide</span>
                <h2>{help.title}</h2>
                <p className="small-note">{activeSection.title}</p>
              </div>
            </div>
            <HelpContent markdown={activeSection.content.join('\n').trim()} />
          </>
        ) : (
          <p>Aucune aide disponible.</p>
        )}
      </article>
    </div>
  );
}
