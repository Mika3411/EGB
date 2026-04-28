import { CheckCircle2, Clapperboard, Clock3, DoorOpen, KeyRound, Lightbulb, Map, Puzzle, Star } from 'lucide-react';
import { calculateProjectScore } from '../utils/projectScore';

const metricCards = [
  ['acts', 'Actes', DoorOpen],
  ['scenes', 'Scènes', Map],
  ['items', 'Objets', KeyRound],
  ['enigmas', 'Énigmes', Puzzle],
  ['cinematics', 'Cinématiques', Clapperboard],
];

const scoreHelp = {
  structure: 'Mesure la richesse de base du projet: actes, scènes, objets, énigmes et cinématiques créés.',
  map: 'Mesure la cohérence du plan: scènes associées à des pièces, départ, liaisons vertes, allers simples validés et problèmes restants.',
  content: 'Mesure la jouabilité: point de départ valide, scènes avec zones d’action utiles et énigmes correctement renseignées.',
};

export default function ScoreTab({ project }) {
  const score = calculateProjectScore(project);
  const metrics = score.metrics || {};
  const sections = score.sections || {};
  const connectionCounts = metrics.connectionCounts || {};
  const playtime = metrics.playtimeRange || { min: 0, max: 0 };

  return (
    <div className="layout score-layout">
      <section className="panel score-hero-panel">
        <div className="score-hero-main">
          <span className="section-kicker">Bilan</span>
          <h2>Note globale</h2>
          <div className={`score-big ${score.tone}`}>
            <Star size={26} aria-hidden="true" />
            <strong>{score.label}</strong>
          </div>
          <p>{score.conclusion}</p>
        </div>
        <div className="score-section-grid">
          <div>
            <span className="score-help-label">Structure <span className="help-dot" data-help={scoreHelp.structure} aria-label={scoreHelp.structure} tabIndex={0}>?</span></span>
            <strong>{sections.structure ?? 0}/4</strong>
          </div>
          <div>
            <span className="score-help-label">Plan <span className="help-dot" data-help={scoreHelp.map} aria-label={scoreHelp.map} tabIndex={0}>?</span></span>
            <strong>{sections.map ?? 0}/3,7</strong>
          </div>
          <div>
            <span className="score-help-label">Contenu <span className="help-dot" data-help={scoreHelp.content} aria-label={scoreHelp.content} tabIndex={0}>?</span></span>
            <strong>{sections.content ?? 0}/2</strong>
          </div>
        </div>
      </section>

      <section className="panel score-inventory-panel">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Inventaire projet</span>
            <h2>Éléments créés</h2>
          </div>
        </div>
        <div className="score-metrics-grid">
          {metricCards.map(([key, label, Icon]) => (
            <div className="score-metric-card" key={key}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              <strong>{metrics[key] || 0}</strong>
            </div>
          ))}
        </div>
        <div className="score-connection-summary">
          <div><span>Scènes mappées</span><strong>{metrics.mappedScenes || 0}/{metrics.scenes || 0}</strong></div>
          <div><span>Liaisons vertes</span><strong>{connectionCounts.ok || 0}</strong></div>
          <div><span>Allers simples validés</span><strong>{connectionCounts.accepted || 0}</strong></div>
          <div><span>À vérifier</span><strong>{(connectionCounts.partial || 0) + (connectionCounts.missing || 0)}</strong></div>
        </div>
        <div className="score-playtime-card">
          <Clock3 size={19} aria-hidden="true" />
          <div>
            <span>Temps de jeu approximatif</span>
            <strong>{playtime.min}-{playtime.max} min</strong>
            <small>Basé sur les scènes, énigmes, cinématiques, objets et détours du plan.</small>
          </div>
        </div>
      </section>

      <section className="panel score-advice-panel">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Conseils</span>
            <h2>Améliorer la note</h2>
          </div>
        </div>
        <div className="score-advice-list">
          {(score.advice || []).map((advice) => (
            <div className="score-advice-card" key={advice}>
              <Lightbulb size={17} aria-hidden="true" />
              <span>{advice}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel score-conclusion-panel">
        <CheckCircle2 size={20} aria-hidden="true" />
        <div>
          <h2>Conclusion</h2>
          <p>{score.conclusion}</p>
          <small>{score.summary}</small>
        </div>
      </section>
    </div>
  );
}
