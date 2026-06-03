import { ExternalLink, Image, Mic, Music, PenLine, Scissors } from 'lucide-react';

const resourceGroups = [
  {
    id: 'images',
    label: 'Images',
    tools: [
      {
        id: 'remove-bg',
        need: 'Supprimer un fond',
        name: 'remove.bg',
        description: 'Isole rapidement un objet ou un personnage pour le placer dans une scene.',
        url: 'https://www.remove.bg/',
        Icon: Scissors,
      },
      {
        id: 'photopea',
        need: 'Retoucher une image',
        name: 'Photopea',
        description: 'Edite PNG, WEBP, PSD ou image de decor directement dans le navigateur.',
        url: 'https://www.photopea.com/',
        Icon: Image,
      },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    tools: [
      {
        id: 'freesound',
        need: 'Trouver un son',
        name: 'Freesound',
        description: 'Cherche bruitages, ambiances et sons courts pour objets, portes ou enigmes.',
        url: 'https://freesound.org/',
        Icon: Music,
      },
      {
        id: 'elevenlabs',
        need: 'Generer une voix',
        name: 'ElevenLabs',
        description: 'Cree une voix off ou une replique courte pour une cinematique.',
        url: 'https://elevenlabs.io/',
        Icon: Mic,
      },
    ],
  },
  {
    id: 'writing',
    label: 'Texte et ressources',
    tools: [
      {
        id: 'deepl-write',
        need: 'Corriger un texte',
        name: 'DeepL Write',
        description: 'Relis dialogues, indices et descriptions avant publication.',
        url: 'https://www.deepl.com/write',
        Icon: PenLine,
      },
      {
        id: 'pixabay',
        need: 'Trouver une image',
        name: 'Pixabay',
        description: 'Trouve une photo ou une illustration libre pour decor, ambiance ou miniature.',
        url: 'https://pixabay.com/',
        Icon: Image,
      },
    ],
  },
];

const quickNeeds = [
  ['Fond transparent', 'remove.bg'],
  ['Retouche rapide', 'Photopea'],
  ['Bruitages', 'Freesound'],
  ['Voix off', 'ElevenLabs'],
  ['Correction texte', 'DeepL Write'],
  ['Images libres', 'Pixabay'],
];

export default function ResourcesTab() {
  return (
    <div className="layout resources-layout">
      <section className="panel side resources-summary-panel">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Outils</span>
            <h2>Ressources createur</h2>
          </div>
          <span className="status-badge soft">Sans 3D</span>
        </div>
        <p className="small-note">
          Une selection courte pour completer Escape Game Studio quand il faut preparer un visuel, un son, une voix ou un texte.
        </p>
        <div className="resources-need-list" aria-label="Besoins rapides">
          {quickNeeds.map(([need, tool]) => (
            <span key={need}>
              <strong>{need}</strong>
              <small>{tool}</small>
            </span>
          ))}
        </div>
      </section>

      <section className="panel main resources-main-panel">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Raccourcis utiles</span>
            <h2>Choisis selon ton besoin</h2>
          </div>
        </div>
        <div className="resources-group-stack">
          {resourceGroups.map((group) => (
            <section className="resources-group" key={group.id} aria-labelledby={`resources-${group.id}`}>
              <h3 id={`resources-${group.id}`}>{group.label}</h3>
              <div className="resources-card-grid">
                {group.tools.map(({ id, need, name, description, url, Icon }) => (
                  <article className="resources-card" key={id}>
                    <Icon aria-hidden="true" size={20} strokeWidth={2.1} />
                    <div>
                      <span>{need}</span>
                      <strong>{name}</strong>
                      <p>{description}</p>
                      <a className="secondary-action resources-link" href={url} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden="true" size={15} strokeWidth={2.2} />
                        <span>Ouvrir</span>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
