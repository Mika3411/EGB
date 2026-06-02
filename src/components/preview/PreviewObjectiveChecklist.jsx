import { getObjectiveRouteStatuses } from '../../lib/conditionEngine.js';

export default function PreviewObjectiveChecklist({
  checklist = null,
  conditionContext = {},
  compact = false,
}) {
  const routes = Array.isArray(checklist?.routes) ? checklist.routes : [];
  if (!checklist || !routes.length) return null;

  const routeStates = getObjectiveRouteStatuses({ ...conditionContext, objectiveChecklist: checklist });
  const readyRouteCount = routeStates.filter((route) => route.ready).length;

  return (
    <div className={`adventure-objective-card ${compact ? 'compact' : ''}`}>
      <div className="panel-head">
        <div>
          <h3>{checklist.title || 'Objectif'}</h3>
          {checklist.description ? <p className="small-note">{checklist.description}</p> : null}
        </div>
        <span className={`objective-status-pill ${readyRouteCount ? 'ready' : ''}`}>
          {readyRouteCount ? `${readyRouteCount} objectif validé` : 'À accomplir'}
        </span>
      </div>
      <div className="adventure-objective-routes">
        {routeStates.map((route) => (
          <section key={route.id} className={`adventure-objective-route ${route.ready ? 'complete' : ''}`}>
            <div className="adventure-objective-route-head">
              <strong>{route.label || 'Voie'}</strong>
              {route.ready ? <span>Validé</span> : null}
            </div>
            {route.ready && route.successText ? <small>{route.successText}</small> : null}
            <ul className="adventure-objective-conditions">
              {route.checks.map((check) => (
                <li key={check.id} className={check.ready ? 'complete' : ''}>
                  <span aria-hidden="true">{check.ready ? '✓' : '•'}</span>
                  <span>{check.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
