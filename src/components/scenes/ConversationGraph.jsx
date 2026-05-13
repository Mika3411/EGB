import { useState } from 'react';

const CONVERSATION_ACTION_LABELS = {
  node: 'Question',
  dialogue: 'Message',
  item: 'Objet',
  multiple: 'Multiple',
  skill_check: 'Test',
  scene: 'Scène',
  cinematic: 'Cinématique',
  enigma: 'Énigme',
  ending: 'Fin',
  end: 'Fin',
};

export default function ConversationGraph({ conversation, project, getSceneLabel }) {
  const nodes = conversation?.nodes || [];
  const [activeTag, setActiveTag] = useState('');
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const startNodeId = conversation?.startNodeId || nodes[0]?.id || '';
  const graphTags = [...new Set(nodes.flatMap((node) => (node.replies || []).flatMap((reply) => reply.branchTags || [])))].sort();
  const getReplyTargetLabel = (reply) => {
    const actionType = reply.actionType || 'node';
    if (['node', 'dialogue', 'multiple'].includes(actionType)) {
      if (!reply.nextNodeId) return 'Fin conversation';
      const targetNode = nodeById.get(reply.nextNodeId);
      return targetNode ? `Question: ${(targetNode.text || 'Sans texte').slice(0, 46)}` : 'Question manquante';
    }
    if (actionType === 'item') return `Objet: ${project.items.find((item) => item.id === reply.rewardItemId)?.name || 'Aucun'}`;
    if (actionType === 'scene') return `Scène: ${getSceneLabel(reply.targetSceneId) || 'Aucune'}`;
    if (actionType === 'cinematic') return `Cinématique: ${project.cinematics.find((cine) => cine.id === reply.targetCinematicId)?.name || 'Aucune'}`;
    if (actionType === 'enigma') return `Énigme: ${(project.enigmas || []).find((enigma) => enigma.id === reply.enigmaId)?.name || 'Aucune'}`;
    if (actionType === 'ending') {
      const labels = { good: 'Bonne fin', bad: 'Mauvaise fin', secret: 'Fin secrete', neutral: 'Fin neutre' };
      return labels[reply.endingType || 'neutral'] || 'Fin neutre';
    }
    return 'Fin conversation';
  };
  const getReplyConditionLabel = (reply) => {
    const conditionType = reply.conditionType || 'none';
    if (conditionType === 'none') return '';
    if (conditionType === 'has_item') return `Objet: ${project.items.find((item) => item.id === reply.conditionItemId)?.name || 'non choisi'}`;
    if (conditionType === 'visited_scene') return `Scène visitée: ${getSceneLabel(reply.conditionSceneId) || 'non choisie'}`;
    if (conditionType === 'completed_hotspot') {
      const conditionSpot = project.scenes.flatMap((scene) => scene.hotspots || []).find((spot) => spot.id === reply.conditionHotspotId);
      return `Zone utilisée: ${conditionSpot?.name || 'non choisie'}`;
    }
    if (conditionType === 'solved_enigma') return `Énigme résolue: ${(project.enigmas || []).find((enigma) => enigma.id === reply.conditionEnigmaId)?.name || 'non choisie'}`;
    if (conditionType === 'chose_reply') {
      const conditionReply = nodes.flatMap((node) => node.replies || []).find((entry) => entry.id === reply.conditionReplyId);
      return `Choix fait: ${conditionReply?.label || 'non choisi'}`;
    }
    if (conditionType === 'story_variable') {
      const operators = { equals: '=', not_equals: '!=', greater_or_equal: '>=', less_or_equal: '<=', truthy: 'vrai', falsy: 'faux' };
      const operator = reply.conditionVariableOperator || 'equals';
      const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${reply.conditionVariableValue ?? ''}`;
      return `${reply.conditionVariableKey || 'variable'} ${operators[operator] || '='}${valueLabel}`;
    }
    if (conditionType === 'advanced') {
      const mode = (reply.advancedConditionMode || 'all') === 'any' ? 'OU' : 'ET';
      const operators = { equals: '=', not_equals: '!=', greater_or_equal: '>=', less_or_equal: '<=', truthy: 'vrai', falsy: 'faux' };
      const labels = (reply.advancedConditions || []).map((condition) => {
        if (condition.type === 'has_item') return `Objet: ${project.items.find((item) => item.id === condition.itemId)?.name || 'non choisi'}`;
        if (condition.type === 'visited_scene') return `Scène: ${getSceneLabel(condition.sceneId) || 'non choisie'}`;
        if (condition.type === 'completed_hotspot') {
          const conditionSpot = project.scenes.flatMap((scene) => scene.hotspots || []).find((spot) => spot.id === condition.hotspotId);
          return `Zone: ${conditionSpot?.name || 'non choisie'}`;
        }
        if (condition.type === 'solved_enigma') return `Énigme: ${(project.enigmas || []).find((enigma) => enigma.id === condition.enigmaId)?.name || 'non choisie'}`;
        if (condition.type === 'chose_reply') {
          const conditionReply = nodes.flatMap((node) => node.replies || []).find((entry) => entry.id === condition.replyId);
          return `Choix: ${conditionReply?.label || 'non choisi'}`;
        }
        if (condition.type === 'story_variable') {
          const operator = condition.operator || 'equals';
          const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${condition.value ?? ''}`;
          return `${condition.variableKey || 'variable'} ${operators[operator] || '='}${valueLabel}`;
        }
        return 'Condition';
      });
      return labels.length ? `${mode}: ${labels.join(` ${mode} `)}` : 'Conditions avancées incompletes';
    }
    return '';
  };
  const getReplyVariableEffectLabel = (reply) => {
    const operation = reply.storyVariableOperation || 'none';
    if (operation === 'none' || !reply.storyVariableKey) return '';
    if (operation === 'increment') return `${reply.storyVariableKey} +${reply.storyVariableValue || 1}`;
    if (operation === 'decrement') return `${reply.storyVariableKey} -${reply.storyVariableValue || 1}`;
    return `${reply.storyVariableKey} = ${reply.storyVariableValue ?? ''}`;
  };
  const focusEditorTarget = (selector) => {
    const target = document.querySelector(selector);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.classList.add('conversation-graph-focus');
      window.setTimeout(() => target.classList.remove('conversation-graph-focus'), 900);
    }
  };

  if (!nodes.length) return <p className="small-note">Ajoute une question pour afficher l'arbre des choix.</p>;

  return (
    <>
      {graphTags.length ? (
        <div className="conversation-graph-tags">
          <button type="button" className={!activeTag ? 'active' : ''} onClick={() => setActiveTag('')}>Tous</button>
          {graphTags.map((tag) => (
            <button key={tag} type="button" className={activeTag === tag ? 'active' : ''} onClick={() => setActiveTag(tag)}>{tag}</button>
          ))}
        </div>
      ) : null}
      <div className="conversation-graph-canvas" role="img" aria-label="Graphe des questions et réponses">
        {nodes.map((node, index) => (
          <section key={`graph-${node.id}`} className="conversation-graph-column">
            <button type="button" className={`conversation-graph-question ${node.id === startNodeId ? 'is-start' : ''}`} onClick={() => focusEditorTarget(`[data-conversation-node-id="${node.id}"]`)}>
              <div>
                <strong>{node.speaker || 'PNJ'}</strong>
                <span>Q{index + 1}</span>
              </div>
              <p>{node.text || 'Question sans texte'}</p>
              {node.id === startNodeId ? <em>Départ</em> : null}
            </button>
            <div className="conversation-graph-edges">
              {(() => {
                const visibleReplies = (node.replies || []).filter((reply) => !activeTag || (reply.branchTags || []).includes(activeTag));
                return visibleReplies.length ? visibleReplies.map((reply) => {
              const actionType = reply.actionType || 'node';
              const condition = getReplyConditionLabel(reply);
              const variableEffect = getReplyVariableEffectLabel(reply);
              return (
                <button key={`edge-${node.id}-${reply.id}`} type="button" className={`conversation-graph-edge edge-${actionType}`} onClick={() => focusEditorTarget(`[data-conversation-reply-id="${reply.id}"]`)}>
                  <div className="conversation-graph-edge-main">
                    <span>{reply.label || 'Réponse'}</span>
                    <small>{CONVERSATION_ACTION_LABELS[actionType] || actionType} {'->'} {getReplyTargetLabel(reply)}</small>
                  </div>
                  {(reply.branchTags || []).length ? <div className="conversation-graph-tag-list">{reply.branchTags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
                  {condition ? <em>Condition: {condition}</em> : null}
                  {variableEffect ? <em>Variable: {variableEffect}</em> : null}
                </button>
              );
                }) : <span className="conversation-graph-empty">{activeTag ? 'Aucune réponse avec ce tag' : 'Aucune réponse'}</span>;
              })()}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

