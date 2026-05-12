import { AlertTriangle, CheckCircle2, Clapperboard, Clock3, Dices, DoorOpen, Heart, KeyRound, Map, Puzzle, Star, XCircle } from 'lucide-react';
import { calculateProjectScore } from '../lib/projectScoreEngine';

const metricCards = [
  ['acts', 'Actes', DoorOpen],
  ['scenes', 'Scènes', Map],
  ['items', 'Objets', KeyRound],
  ['enigmas', 'Énigmes', Puzzle],
  ['cinematics', 'Cinématiques', Clapperboard],
];

const dimensionCards = [
  ['structure', 'Structure', DoorOpen],
  ['gameplay', 'Gameplay', Puzzle],
  ['narration', 'Narration', Clapperboard],
  ['coherence', 'Cohérence', Map],
  ['completion', 'Complétion', CheckCircle2],
];

const playerScoreCards = [
  ['time', 'Temps estimé', Clock3],
  ['actions', 'Actions joueur', KeyRound],
  ['complexity', 'Complexité', Puzzle],
];

const feedbackIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const scoreHelp = {
  structure: 'Mesure la richesse de base du projet: actes, scènes, objets, énigmes et cinématiques créés.',
  map: 'Mesure la cohérence du plan: scènes associées à des pièces, départ, liaisons vertes, allers simples validés et problèmes restants.',
  content: 'Mesure la jouabilité: point de départ valide, scènes avec zones d’action utiles et énigmes correctement renseignées.',
  polish: 'Mesure le polish: ambiance des scènes, médias, sons, effets visuels et cinématiques renseignées.',
};

const asCount = (value) => (Array.isArray(value) ? value.length : Number(value || 0));

const getHeroDiagnostics = (heroAnalysis = {}, heroCombat = {}) => {
  const diagnostics = [];
  const push = (level, label, message, metric = '') => diagnostics.push({ level, label, message, metric });

  if (heroAnalysis.enabled && !heroAnalysis.count) {
    push('warning', 'Aucun test de compétence', 'Ajoute au moins un test Hero pour que les compétences servent pendant l’aventure.', '0 test');
  }
  if (heroCombat.enabled && !heroCombat.count) {
    push('warning', 'Aucun combat Hero', 'Ajoute au moins un combat pour exploiter les PV, les compétences et les récompenses.', '0 combat');
  }
  if (asCount(heroAnalysis.withoutSkill)) push('danger', 'Tests sans compétence valide', 'Certains tests pointent vers une compétence absente.', asCount(heroAnalysis.withoutSkill));
  if (asCount(heroAnalysis.withoutDifficulty)) push('warning', 'Tests sans difficulté', 'Donne un seuil clair aux tests: 10, 12, 15...', asCount(heroAnalysis.withoutDifficulty));
  if (asCount(heroAnalysis.withoutFailureBranch)) push('warning', 'Échecs sans conséquence', 'Prévois un message, une perte de PV ou une branche d’échec.', asCount(heroAnalysis.withoutFailureBranch));
  if (asCount(heroAnalysis.costly)) push('danger', 'Coût mana impossible', 'Certains tests coûtent plus que la mana maximale du héros.', asCount(heroAnalysis.costly));
  if (asCount(heroAnalysis.punishing)) push('warning', 'Échecs trop punitifs', 'Certains tests peuvent retirer tous les PV en un seul échec.', asCount(heroAnalysis.punishing));
  if (asCount(heroCombat.withoutEnemy)) push('warning', 'Ennemis sans nom', 'Nomme chaque adversaire pour que le combat soit lisible.', asCount(heroCombat.withoutEnemy));
  if (asCount(heroCombat.withoutEnemyHealth)) push('warning', 'PV ennemi manquants', 'Chaque combat doit avoir des PV ennemis.', asCount(heroCombat.withoutEnemyHealth));
  if (asCount(heroCombat.withoutSkill)) push('danger', 'Combats sans compétence valide', 'Certains combats utilisent une compétence absente.', asCount(heroCombat.withoutSkill));
  if (asCount(heroCombat.withoutDifficulty)) push('warning', 'Combats sans difficulté', 'Ajoute une difficulté d’attaque pour chaque combat.', asCount(heroCombat.withoutDifficulty));
  if (asCount(heroCombat.withoutVictoryBranch) || asCount(heroCombat.withoutDefeatBranch)) {
    push('danger', 'Combats sans issue claire', 'Chaque combat doit avoir une suite de victoire et une suite de défaite.', asCount(heroCombat.withoutVictoryBranch) + asCount(heroCombat.withoutDefeatBranch));
  }
  if (asCount(heroCombat.withoutRewardOrNarrativePayoff)) {
    push('warning', 'Combats sans gain narratif', 'Ajoute une récompense, une révélation ou une scène utile après victoire.', asCount(heroCombat.withoutRewardOrNarrativePayoff));
  }
  if (asCount(heroCombat.lethalEnemyDamage)) push('warning', 'Dégâts ennemis trop forts', 'Certains ennemis peuvent vider tous les PV en une attaque.', asCount(heroCombat.lethalEnemyDamage));

  if (!diagnostics.length && (heroAnalysis.enabled || heroCombat.enabled)) {
    push('success', 'Mode héros cohérent', 'Les tests et combats Hero ont des compétences, difficultés et issues jouables.', 'OK');
  }

  return diagnostics;
};

export default function ScoreTab({ project }) {
  const score = calculateProjectScore(project);
  const metrics = score.metrics || {};
  const dimensions = score.dimensions || {};
  const playerScore = score.playerScore || {};
  const badges = score.badges || [];
  const feedback = score.feedback || [];
  const sections = score.sections || {};
  const connectionCounts = metrics.connectionCounts || {};
  const playtime = metrics.playtimeRange || { min: 0, max: 0 };
  const advancedAnalysis = score.advancedAnalysis || {};
  const heroAnalysis = advancedAnalysis.heroAdventure || {};
  const heroCombat = advancedAnalysis.heroCombat || {};
  const heroConfig = project.heroAdventure || {};
  const hero = heroConfig.hero || {};
  const heroSkills = hero.skills || [];
  const heroItems = (project.items || []).filter((item) => (item.heroItemType || 'none') !== 'none');
  const isHeroMode = Boolean(heroAnalysis.enabled || heroCombat.enabled || heroConfig.enabled || project.creationMode === 'hero_adventure');
  const heroDiagnostics = getHeroDiagnostics(heroAnalysis, heroCombat);
  const heroIssueCount = (metrics.heroSkillCheckIssues || 0) + (metrics.heroCombatIssues || 0);
  const heroSummary = heroIssueCount ? `${heroIssueCount} point(s) à vérifier` : 'Prêt pour playtest';

  return (
    <div className="layout score-layout">
      <section className="panel score-hero-panel" data-tour="score-overview">
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
          <div>
            <span className="score-help-label">Polish <span className="help-dot" data-help={scoreHelp.polish} aria-label={scoreHelp.polish} tabIndex={0}>?</span></span>
            <strong>{sections.polish ?? 0}/0,3</strong>
          </div>
        </div>
      </section>

      <section className="panel score-dimensions-panel" data-tour="score-dimensions">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Scoring multi-dimension</span>
            <h2>Profil du projet</h2>
          </div>
        </div>
        <div className="score-metrics-grid">
          {dimensionCards.map(([key, label, Icon]) => (
            <div className="score-metric-card" key={key}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              <strong>{dimensions[key] ?? 0}/10</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel score-player-panel" data-tour="score-player">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Score basé joueur</span>
            <h2>Expérience estimée</h2>
          </div>
          <strong className="score-mini-total">{playerScore.label || '0,0/10'}</strong>
        </div>
        <div className="score-metrics-grid">
          {playerScoreCards.map(([key, label, Icon]) => {
            const data = playerScore[key] || {};
            const value = key === 'time'
              ? data.label
              : key === 'actions'
                ? `${data.count || 0} action(s)`
                : `${data.value || 0}/10`;
            return (
              <div className="score-metric-card" key={key}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{data.score ?? 0}/10</small>
              </div>
            );
          })}
        </div>
      </section>

      {isHeroMode && (
        <section className="panel score-hero-mode-panel" data-tour="score-hero-mode">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Mode héros</span>
              <h2>Bilan Hero Adventure</h2>
            </div>
            <strong className={`score-mini-total ${heroIssueCount ? 'warn' : 'good'}`}>{heroSummary}</strong>
          </div>
          <div className="score-metrics-grid score-hero-metrics-grid">
            <div className="score-metric-card">
              <Dices size={18} aria-hidden="true" />
              <span>Tests</span>
              <strong>{metrics.heroSkillChecks || heroAnalysis.count || 0}</strong>
              <small>{metrics.heroSkillCheckIssues || 0} problème(s)</small>
            </div>
            <div className="score-metric-card">
              <Puzzle size={18} aria-hidden="true" />
              <span>Combats</span>
              <strong>{metrics.heroCombats || heroCombat.count || 0}</strong>
              <small>{metrics.heroCombatIssues || 0} problème(s)</small>
            </div>
            <div className="score-metric-card">
              <Star size={18} aria-hidden="true" />
              <span>Compétences</span>
              <strong>{heroSkills.length || 0}</strong>
              <small>fiche héros</small>
            </div>
            <div className="score-metric-card">
              <Heart size={18} aria-hidden="true" />
              <span>PV / Mana</span>
              <strong>{Number(hero.maxHealth || hero.health || 0)}/{Number(hero.maxMana || hero.mana || 0)}</strong>
              <small>max héros</small>
            </div>
            <div className="score-metric-card">
              <KeyRound size={18} aria-hidden="true" />
              <span>Objets Hero</span>
              <strong>{heroItems.length}</strong>
              <small>équipements ou potions</small>
            </div>
          </div>
          <div className="score-advice-list score-hero-diagnostics">
            {heroDiagnostics.map((entry) => {
              const Icon = feedbackIcons[entry.level] || AlertTriangle;
              return (
                <div className={`score-advice-card ${entry.level}`} key={`${entry.level}-${entry.label}`}>
                  <Icon size={17} aria-hidden="true" />
                  <span>
                    <strong>{entry.label}</strong>
                    {entry.metric !== '' && <em>{entry.metric}</em>}
                    <small>{entry.message}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {badges.length > 0 && (
        <section className="panel score-badges-panel" data-tour="score-badges">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Badges</span>
              <h2>Forces du projet</h2>
            </div>
          </div>
          <div className="score-badge-grid">
            {badges.map((badge) => (
              <div className={`score-badge-card ${badge.tone}`} key={badge.id}>
                <Star size={17} aria-hidden="true" />
                <span>
                  <strong>{badge.label}</strong>
                  <small>{badge.description}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel score-inventory-panel" data-tour="score-inventory">
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
            <small>{`Basé sur les scènes, énigmes, cinématiques, objets, détours du plan${isHeroMode ? ', combats Hero' : ''}.`}</small>
          </div>
        </div>
      </section>

      <section className="panel score-advice-panel" data-tour="score-advice">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Feedback intelligent</span>
            <h2>Ce que le moteur voit</h2>
          </div>
        </div>
        <div className="score-advice-list">
          {feedback.map((entry) => {
            const Icon = feedbackIcons[entry.level] || AlertTriangle;
            return (
              <div className={`score-advice-card ${entry.level}`} key={`${entry.level}-${entry.label}`}>
                <Icon size={17} aria-hidden="true" />
                <span>
                  <strong>{entry.label}</strong>
                  {entry.metric && <em>{entry.metric}</em>}
                  <small>{entry.message}</small>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel score-conclusion-panel" data-tour="score-conclusion">
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
