import NumberInput from '../forms/NumberInput.jsx';
import MediaSourcePicker from '../MediaSourcePicker.jsx';
import { showConfirm } from '../AccessibleDialog';
import { HelpLabel } from './SceneEditorChrome.jsx';
import ConversationEditorModal from './ConversationEditorModal.jsx';
import ConversationGraph from './ConversationGraph.jsx';
import HotspotActionFields, { HeroMalusFields, SkillCheckFields } from './HotspotActionFields.jsx';

const makeAdvancedCondition = () => ({
  id: `advanced_condition_${Math.random().toString(36).slice(2, 10)}`,
  type: 'has_item',
  itemId: '',
  sceneId: '',
  hotspotId: '',
  enigmaId: '',
  replyId: '',
  variableKey: '',
  operator: 'equals',
  value: '',
});

const makeConversationEffect = (type = 'message') => ({
  id: `effect_${Math.random().toString(36).slice(2, 10)}`,
  type,
  message: '',
  itemId: '',
  variableKey: '',
  value: type === 'increment_variable' || type === 'decrement_variable' ? '1' : '',
  journalTitle: '',
  journalDetail: '',
  nextNodeId: '',
  targetSceneId: '',
  targetCinematicId: '',
  enigmaId: '',
  endingType: 'neutral',
  endingTitle: '',
  endingSummary: '',
});

const CONVERSATION_EFFECT_BUTTONS = [
  ['message', '+ Message'],
  ['add_item', '+ Objet'],
  ['heal_health', '+ PV'],
  ['heal_mana', '+ Mana'],
  ['set_variable', '+ Variable'],
  ['journal', '+ Journal'],
  ['next_node', '+ Aller vers...'],
];

const CONVERSATION_EFFECT_LABELS = {
  message: 'Message',
  add_item: 'Donner objet',
  remove_item: 'Retirer objet',
  heal_health: 'Soigner PV',
  heal_mana: 'Rendre mana',
  set_variable: 'Definir variable',
  increment_variable: 'Ajouter variable',
  decrement_variable: 'Retirer variable',
  journal: 'Journal',
  next_node: 'Question suivante',
  scene: 'Sc?ne',
  cinematic: 'Cin?matique',
  enigma: '?nigme',
  ending: 'Fin',
};

const BEGINNER_HOTSPOT_ACTION_TYPES = new Set(['dialogue', 'dialogue_item', 'scene']);

export default function HotspotInspectorPanel({
  selectedHotspot,
  selectedHotspotId,
  selectedSceneId,
  project,
  patchProject,
  renderShapeControls,
  canUseQuickLogic = false,
  openQuickLogicForTarget,
  isBeginnerMode = false,
  conversationEditorOpen = false,
  setConversationEditorOpen,
  addConversationQuestion,
  getSceneLabel,
  mediaLibrary = [],
  handleUpload,
  isHeroAdventureProject = false,
  heroSkills = [],
  deleteHotspot,
}) {
  const selectedHotspotActionType = selectedHotspot?.actionType || 'dialogue';
  const displayedHotspotActionType = isBeginnerMode && !BEGINNER_HOTSPOT_ACTION_TYPES.has(selectedHotspotActionType)
    ? 'dialogue'
    : selectedHotspotActionType;

  if (!selectedHotspot) return null;

  return (
    <>
                      <HelpLabel help="Nom de la zone d’action dans l’éditeur. Choisis un nom qui décrit l’intention, par exemple “Porte verrouillée”.">Nom</HelpLabel>
                      <input data-tour="hotspot-name" value={selectedHotspot.name} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.name = e.target.value;
                      })} />
                      <div className="grid-two small-gap" data-tour="hotspot-geometry">
                        <div><HelpLabel help="Position horizontale du centre de la zone, en pourcentage de la largeur de l’image.">X</HelpLabel><NumberInput value={selectedHotspot.x} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.x = nextValue; })} /></div>
                        <div><HelpLabel help="Position verticale du centre de la zone, en pourcentage de la hauteur de l’image.">Y</HelpLabel><NumberInput value={selectedHotspot.y} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.y = nextValue; })} /></div>
                        <div><HelpLabel help="Largeur de la zone cliquable. Augmente-la si le joueur risque de manquer la cible.">Largeur</HelpLabel><NumberInput value={selectedHotspot.width} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.width = nextValue; })} /></div>
                        <div><HelpLabel help="Hauteur de la zone cliquable. Une zone trop petite peut être difficile à trouvér sur mobile.">Hauteur</HelpLabel><NumberInput value={selectedHotspot.height} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.height = nextValue; })} /></div>
                      </div>
                      {renderShapeControls('hotspot', selectedHotspotId)}
                      {canUseQuickLogic ? (
                        <button type="button" className="secondary-action full" onClick={() => openQuickLogicForTarget('hotspot', selectedHotspotId)}>
                          Logique
                        </button>
                      ) : null}
                      <HelpLabel help="Action principale déclenchée par cette zone après validation des prérequis éventuels : dialogue, objet, changement de scène ou cinematic.">Action</HelpLabel>
                      <select data-tour="hotspot-action" value={displayedHotspotActionType} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.actionType = e.target.value;
                      })}>
                        <option value="dialogue">Dialogue</option>
                        {!isBeginnerMode ? <option value="conversation">Conversation texte</option> : null}
                        {!isBeginnerMode ? <option value="skill_check">Test de compétence</option> : null}
                        {!isBeginnerMode ? <option value="hero_combat">Combat simple</option> : null}
                        <option value="dialogue_item">Dialogue + objet</option>
                        <option value="scene">Changer de scène</option>
                        {!isBeginnerMode ? <option value="cinematic">Lancer une cinématique</option> : null}
                      </select>
                      {!isBeginnerMode && selectedHotspot.actionType === 'conversation' ? (
                        <button type="button" className="secondary-action full" data-tour="conversation-editor-button" onClick={() => setConversationEditorOpen(true)}>
                          Modifier la conversation
                        </button>
                      ) : null}
                      {!isBeginnerMode && selectedHotspot.actionType === 'conversation' && conversationEditorOpen ? (
                        <ConversationEditorModal onClose={() => setConversationEditorOpen(false)} onAddQuestion={addConversationQuestion}>
                            <div className="conversation-flow-map" data-tour="conversation-flow-map">
                              <div className="conversation-flow-head">
                                <strong>Graphe interactif</strong>
                                <span>{selectedHotspot.conversation?.nodes?.length || 0} question(s) - {(selectedHotspot.conversation?.nodes || []).reduce((total, node) => total + (node.replies?.length || 0), 0)} réponse(s)</span>
                              </div>
                              <ConversationGraph conversation={selectedHotspot.conversation} project={project} getSceneLabel={getSceneLabel} />
                              {false && (selectedHotspot.conversation?.nodes || []).length ? (
                                <div className="conversation-flow-grid">
                                  {(selectedHotspot.conversation?.nodes || []).map((node) => {
                                    const getReplyTargetLabel = (reply) => {
                                      const actionType = reply.actionType || 'node';
                                      if (actionType === 'node') {
                                        if (!reply.nextNodeId) return 'Fin';
                                        const targetNode = selectedHotspot.conversation?.nodes?.find((entry) => entry.id === reply.nextNodeId);
                                        return targetNode ? `Question: ${(targetNode.text || 'Sans texte').slice(0, 42)}` : 'Question manquante';
                                      }
                                      if (actionType === 'multiple') {
                                        if (!reply.nextNodeId) return 'Actions multiples -> Fin';
                                        const targetNode = selectedHotspot.conversation?.nodes?.find((entry) => entry.id === reply.nextNodeId);
                                        return targetNode ? `Actions multiples -> Question: ${(targetNode.text || 'Sans texte').slice(0, 32)}` : 'Actions multiples -> Question manquante';
                                      }
                                      if (actionType === 'dialogue') return 'Message';
                                      if (actionType === 'item') return `Objet: ${project.items.find((item) => item.id === reply.rewardItemId)?.name || 'Aucun'}`;
                                      if (actionType === 'scene') return `Scène: ${getSceneLabel(reply.targetSceneId) || 'Aucune'}`;
                                      if (actionType === 'cinematic') return `Cinématique: ${project.cinematics.find((cine) => cine.id === reply.targetCinematicId)?.name || 'Aucune'}`;
                                      if (actionType === 'enigma') return `Énigme: ${(project.enigmas || []).find((enigma) => enigma.id === reply.enigmaId)?.name || 'Aucune'}`;
                                      if (actionType === 'ending') {
                                        const endingLabels = { good: 'Bonne fin', bad: 'Mauvaise fin', secret: 'Fin secrete', neutral: 'Fin neutre' };
                                        return `Fin: ${endingLabels[reply.endingType || 'neutral'] || 'Fin neutre'}`;
                                      }
                                      return 'Fin';
                                    };
                                    const getReplyConditionLabel = (reply) => {
                                      const conditionType = reply.conditionType || 'none';
                                      if (conditionType === 'none') return '';
                                      if (conditionType === 'has_item') return `Débloquée si objet: ${project.items.find((item) => item.id === reply.conditionItemId)?.name || 'non choisi'}`;
                                      if (conditionType === 'visited_scene') return `Débloquée si scène visitée: ${getSceneLabel(reply.conditionSceneId) || 'non choisie'}`;
                                      if (conditionType === 'completed_hotspot') {
                                        const conditionSpot = project.scenes.flatMap((scene) => scene.hotspots || []).find((spot) => spot.id === reply.conditionHotspotId);
                                        return `Débloquée si zone utilisée: ${conditionSpot?.name || 'non choisie'}`;
                                      }
                                      if (conditionType === 'solved_enigma') return `Débloquée si énigme résolue: ${(project.enigmas || []).find((enigma) => enigma.id === reply.conditionEnigmaId)?.name || 'non choisie'}`;
                                      if (conditionType === 'chose_reply') {
                                        const conditionReply = (selectedHotspot.conversation?.nodes || []).flatMap((entry) => entry.replies || []).find((entry) => entry.id === reply.conditionReplyId);
                                        return `Débloquée si choix fait: ${conditionReply?.label || 'non choisi'}`;
                                      }
                                      if (conditionType === 'story_variable') {
                                        const operatorLabels = {
                                          equals: '=',
                                          not_equals: '!=',
                                          greater_or_equal: '>=',
                                          less_or_equal: '<=',
                                          truthy: 'vrai',
                                          falsy: 'faux',
                                        };
                                        const operator = reply.conditionVariableOperator || 'equals';
                                        const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${reply.conditionVariableValue ?? ''}`;
                                        return `Débloquée si ${reply.conditionVariableKey || 'variable'} ${operatorLabels[operator] || '='}${valueLabel}`;
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

                                    return (
                                      <div key={`flow-${node.id}`} className="conversation-flow-node">
                                        <div className="conversation-flow-node-title">
                                          <strong>{node.speaker || 'PNJ'}</strong>
                                          {selectedHotspot.conversation?.startNodeId === node.id ? <span>Départ</span> : null}
                                        </div>
                                        <p>{node.text || 'Question sans texte'}</p>
                                        <div className="conversation-flow-replies">
                                          {(node.replies || []).length ? (node.replies || []).map((reply) => (
                                            <div key={`flow-${node.id}-${reply.id}`} className="conversation-flow-reply">
                                              <span>{reply.label || 'Réponse'}</span>
                                              <small>{getReplyTargetLabel(reply)}</small>
                                              {getReplyConditionLabel(reply) ? <em>{getReplyConditionLabel(reply)}</em> : null}
                                              {getReplyVariableEffectLabel(reply) ? <em>{getReplyVariableEffectLabel(reply)}</em> : null}
                                            </div>
                                          )) : <em>Aucune réponse</em>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="small-note">Ajoute une question pour afficher l'arbre des choix.</p>
                              )}
                            </div>
                            {(selectedHotspot.conversation?.nodes || []).map((node, nodeIndex) => (
                            <div key={node.id} className="logic-rule-card" data-conversation-node-id={node.id}>
                              <HelpLabel help="Nom affiché en haut de la bulle dé dialogue. Utilise le nom du PNJ ou laisse PNJ si ce n'est pas important.">Interlocuteur</HelpLabel>
                              <input value={node.speaker || ''} placeholder="PNJ" onChange={(e) => patchProject((draft) => {
                                const targetNode = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex];
                                if (targetNode) targetNode.speaker = e.target.value;
                              })} />
                              <HelpLabel help="Texte dit par le PNJ avant que le joueur choisisse une réponse. C'est une question, une information ou une réaction.">Question / texte du PNJ</HelpLabel>
                              <textarea value={node.text || ''} onChange={(e) => patchProject((draft) => {
                                const targetNode = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex];
                                if (targetNode) targetNode.text = e.target.value;
                              })} />
                              <HelpLabel help="Note interne non visible par le joueur. Sert a noter l intention de la question, un indice à placer, une branche à revoir ou une idée de mise en scène.">Note auteur question</HelpLabel>
                              <textarea value={node.authorNote || ''} placeholder="Intention, indice à placer, ? revoir..." onChange={(e) => patchProject((draft) => {
                                const targetNode = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex];
                                if (targetNode) targetNode.authorNote = e.target.value;
                              })} />
                              <label className="adventure-inline-check">
                                <input type="checkbox" checked={Boolean(node.askOnce)} onChange={(e) => patchProject((draft) => {
                                  const targetNode = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex];
                                  if (targetNode) targetNode.askOnce = e.target.checked;
                                })} />
                                Ne poser cette question qu'une seule fois
                              </label>
                              <button type="button" className="secondary-action full" onClick={() => patchProject((draft) => {
                                const targetNode = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex];
                                if (targetNode) targetNode.replies = [...(targetNode.replies || []), { id: `reply-${Math.random().toString(36).slice(2, 8)}`, label: 'Nouvelle réponse', actionType: 'node', nextNodeId: '', dialogue: '' }];
                              })}>+ Réponse</button>
                              {(node.replies || []).map((reply, replyIndex) => (
                                <div key={reply.id} className="nested-editor-card" data-conversation-reply-id={reply.id}>
                                  <div className="conversation-reply-head">
                                    <strong>Réponse {replyIndex + 1}</strong>
                                    <div className="conversation-reply-actions">
                                      <button type="button" className="secondary-action compact" onClick={() => patchProject((draft) => {
                                        const replies = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies;
                                        if (!replies) return;
                                        const sourceReply = replies[replyIndex];
                                        if (!sourceReply) return;
                                        replies.splice(replyIndex + 1, 0, { ...sourceReply, id: `reply-${Math.random().toString(36).slice(2, 8)}`, label: `${sourceReply.label || 'Réponse'} copie` });
                                      })}>Dupliquer</button>
                                      <button type="button" className="danger-button compact" onClick={() => patchProject((draft) => {
                                        const targetNode = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex];
                                        if (targetNode?.replies) targetNode.replies.splice(replyIndex, 1);
                                      })}>Supprimer</button>
                                    </div>
                                  </div>
                                  <HelpLabel help="Texte du bouton que le joueur va cliquer dans la conversation.">Réponse du joueur</HelpLabel>
                                  <input value={reply.label || ''} placeholder="Réponse du joueur" onChange={(e) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) targetReply.label = e.target.value;
                                  })} />
                                  <label className="adventure-inline-check">
                                    <input type="checkbox" checked={Boolean(reply.hideAfterChosen)} onChange={(e) => patchProject((draft) => {
                                      const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                      if (targetReply) targetReply.hideAfterChosen = e.target.checked;
                                    })} />
                                    Masquer cette réponse après l'avoir choisie
                                  </label>
                                  <div className="conversation-effects-editor">
                                    <HelpLabel help="Quand le joueur clique cette réponse, les réponses cochees ici disparaissent pour le reste de la partie. Utile pour des choix qui s'excluent sans bloquer toute la question.">Masquer d'autres réponses après ce choix</HelpLabel>
                                    <div className="adventure-simulator-pill-list">
                                      {(selectedHotspot.conversation?.nodes || [])
                                        .flatMap((conversationNode) => (conversationNode.replies || []).map((targetReply) => ({
                                          node: conversationNode,
                                          reply: targetReply,
                                        })))
                                        .filter((entry) => entry.reply.id && entry.reply.id !== reply.id)
                                        .map((entry) => {
                                          const selectedIds = Array.isArray(reply.hideReplyIdsAfterChosen) ? reply.hideReplyIdsAfterChosen : [];
                                          return (
                                            <label key={`${reply.id}-hides-${entry.reply.id}`} className="adventure-simulator-pill">
                                              <input type="checkbox" checked={selectedIds.includes(entry.reply.id)} onChange={(e) => patchProject((draft) => {
                                                const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                                if (!targetReply) return;
                                                const currentIds = Array.isArray(targetReply.hideReplyIdsAfterChosen) ? targetReply.hideReplyIdsAfterChosen : [];
                                                targetReply.hideReplyIdsAfterChosen = e.target.checked
                                                  ? [...new Set([...currentIds, entry.reply.id])]
                                                  : currentIds.filter((id) => id !== entry.reply.id);
                                              })} />
                                              <span>{entry.reply.label || 'Réponse'}{entry.node.id !== node.id ? ` (${entry.node.speaker || 'Question suivante'})` : ''}</span>
                                            </label>
                                          );
                                        })}
                                      {(selectedHotspot.conversation?.nodes || []).reduce((total, conversationNode) => total + (conversationNode.replies || []).filter((targetReply) => targetReply.id && targetReply.id !== reply.id).length, 0) ? null : (
                                        <small className="adventure-muted">Ajoute une autre réponse pour pouvoir la masquer.</small>
                                      )}
                                    </div>
                                  </div>
                                  <HelpLabel help="Etiquettes internes separees par des virgules pour organiser les branches : voie_foret, voie_tour, secret, danger. Elles servent au filtre du graphe, à la recherche et à la fiche auteur.">Tags de branche</HelpLabel>
                                  <input value={(reply.branchTags || []).join(', ')} placeholder="voie_foret, secret, danger" onChange={(e) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) targetReply.branchTags = parseBranchTags(e.target.value);
                                  })} />
                                  <HelpLabel help="Note interne non visible par le joueur. Exemples : intention de ce choix, conséquence à vérifier, indice à ajouter dans une scène, branche à retravailler.">Note auteur réponse</HelpLabel>
                                  <textarea value={reply.authorNote || ''} placeholder="Intention, indice à placer, ? revoir..." onChange={(e) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) targetReply.authorNote = e.target.value;
                                  })} />
                                  <HelpLabel help="Choisit la conséquence de cette réponse : aller vers une autre question, afficher un message, donner un objet, changer de scène, lancer une cinématique, ouvrir une énigme ou terminer.">Suite après cette réponse</HelpLabel>
                                  <select value={reply.actionType || 'node'} onChange={(e) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) targetReply.actionType = e.target.value;
                                  })}>
                                    <option value="node">Autre question</option>
                                    <option value="dialogue">Message</option>
                                    <option value="item">Objet</option>
                                    <option value="multiple">Actions multiples</option>
                                    <option value="skill_check">Test de compétence</option>
                                    <option value="scene">Scène</option>
                                    <option value="cinematic">Cinématique</option>
                                    <option value="enigma">Énigme</option>
                                    <option value="ending">Fin d'aventure</option>
                                    <option value="end">Fin</option>
                                  </select>
                                  <HelpLabel help="Message affiché après le choix. Il peut confirmer l'action, donner un indice ou servir de réponse courte avant la suite.">Message après ce choix</HelpLabel>
                                  <textarea value={reply.dialogue || ''} placeholder="Message après ce choix" onChange={(e) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) targetReply.dialogue = e.target.value;
                                  })} />
                                  <div className="conversation-response-media-grid">
                                    <div>
                                      <HelpLabel help="Image affichée au joueur quand il choisit cette réponse. Utile pour montrer un indice, un lieu, un objet ou une reaction.">Image après réponse</HelpLabel>
                                      <MediaSourcePicker className="button like full secondary-action" accept="image/*" handleUpload={handleUpload} mediaLibrary={mediaLibrary} onSelect={(data, name) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) {
                                          targetReply.responseImageData = data;
                                          targetReply.responseImageName = name;
                                        }
                                      })}>{reply.responseImageName || 'Importer une image'}</MediaSourcePicker>
                                    </div>
                                    <div>
                                      <HelpLabel help="Son court joue au moment du choix : bruit, sting musical, voix ou effet de confirmation.">Son après réponse</HelpLabel>
                                      <MediaSourcePicker className="button like full secondary-action" accept="audio/*" handleUpload={handleUpload} mediaLibrary={mediaLibrary} onSelect={(data, name) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) {
                                          targetReply.responseSoundData = data;
                                          targetReply.responseSoundName = name;
                                        }
                                      })}>{reply.responseSoundName || 'Importer un son'}</MediaSourcePicker>
                                    </div>
                                    <div>
                                      <HelpLabel help="Portrait affiche dans la conversation après ce choix. Pratique pour montrer que le PNJ change d'expression ou qu'un autre interlocuteur prend la parole.">Portrait PNJ</HelpLabel>
                                      <MediaSourcePicker className="button like full secondary-action" accept="image/*" handleUpload={handleUpload} mediaLibrary={mediaLibrary} onSelect={(data, name) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) {
                                          targetReply.npcPortraitData = data;
                                          targetReply.npcPortraitName = name;
                                        }
                                      })}>{reply.npcPortraitName || 'Importer un portrait'}</MediaSourcePicker>
                                    </div>
                                    <div>
                                      <HelpLabel help="Ambiance lancée en fond léger après cette réponse. Elle sert à donner une couleur sonore à la branche choisie.">Ambiance</HelpLabel>
                                      <MediaSourcePicker className="button like full secondary-action" accept="audio/*" handleUpload={handleUpload} mediaLibrary={mediaLibrary} onSelect={(data, name) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) {
                                          targetReply.ambienceSoundData = data;
                                          targetReply.ambienceSoundName = name;
                                        }
                                      })}>{reply.ambienceSoundName || 'Importer une ambiance'}</MediaSourcePicker>
                                    </div>
                                  </div>
                                  <HelpLabel help="Cache cette réponse tant que la condition n'est pas remplie. Exemple : afficher “Je connais le mot de passe” seulement après avoir trouvé l'indice.">Réponse cachée / débloquée</HelpLabel>
                                  <select value={reply.conditionType || 'none'} onChange={(e) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) {
                                      targetReply.conditionType = e.target.value;
                                      if (e.target.value === 'none') {
                                        targetReply.conditionItemId = '';
                                        targetReply.conditionSceneId = '';
                                        targetReply.conditionHotspotId = '';
                                        targetReply.conditionEnigmaId = '';
                                        targetReply.conditionReplyId = '';
                                      }
                                    }
                                  })}>
                                    <option value="none">Visible tout de suite</option>
                                    <option value="has_item">Débloquée par un objet / indice</option>
                                    <option value="visited_scene">Débloquée par une scène visitée</option>
                                    <option value="completed_hotspot">Débloquée par une zone utilisée</option>
                                    <option value="solved_enigma">Débloquée par une énigme résolue</option>
                                    <option value="chose_reply">Débloquée par un choix précédent</option>
                                    <option value="story_variable">Débloquée par une variable d'histoire</option>
                                    <option value="advanced">Conditions avancées combinées</option>
                                  </select>
                                  {(reply.conditionType || 'none') === 'has_item' ? (
                                    <>
                                      <HelpLabel help="Objet nécessaire pour voir cette réponse.">Objet requis</HelpLabel>
                                      <select value={reply.conditionItemId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.conditionItemId = e.target.value;
                                      })}>
                                        <option value="">Choisir un objet</option>
                                        {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.conditionType || 'none') === 'visited_scene' ? (
                                    <>
                                      <HelpLabel help="Scène que le joueur doit avoir visitée pour voir cette réponse.">Scène visitée</HelpLabel>
                                      <select value={reply.conditionSceneId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.conditionSceneId = e.target.value;
                                      })}>
                                        <option value="">Choisir une scène</option>
                                        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.conditionType || 'none') === 'completed_hotspot' ? (
                                    <>
                                      <HelpLabel help="Zone qui doit avoir ete utilisée avant que cette réponse apparaisse.">Zone déjà utilisée</HelpLabel>
                                      <select value={reply.conditionHotspotId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.conditionHotspotId = e.target.value;
                                      })}>
                                        <option value="">Choisir une zone</option>
                                        {project.scenes.flatMap((scene) => (scene.hotspots || []).map((spot) => (
                                          <option key={spot.id} value={spot.id}>{getSceneLabel(scene.id)} - {spot.name}</option>
                                        )))}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.conditionType || 'none') === 'solved_enigma' ? (
                                    <>
                                      <HelpLabel help="Énigme qui doit être résolue avant que cette réponse apparaisse.">Énigme résolue</HelpLabel>
                                      <select value={reply.conditionEnigmaId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.conditionEnigmaId = e.target.value;
                                      })}>
                                        <option value="">Choisir une énigme</option>
                                        {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.conditionType || 'none') === 'chose_reply' ? (
                                    <>
                                      <HelpLabel help="Choix qui doit avoir ete clique avant que cette réponse apparaisse.">Choix précédent</HelpLabel>
                                      <select value={reply.conditionReplyId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.conditionReplyId = e.target.value;
                                      })}>
                                        <option value="">Choisir une réponse</option>
                                        {(selectedHotspot.conversation?.nodes || []).flatMap((conditionNode) => (conditionNode.replies || []).filter((conditionReply) => conditionReply.id !== reply.id).map((conditionReply) => (
                                          <option key={conditionReply.id} value={conditionReply.id}>{conditionReply.label || 'Réponse'} - {(conditionNode.text || 'Question').slice(0, 32)}</option>
                                        )))}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.conditionType || 'none') === 'story_variable' ? (
                                    <>
                                      <HelpLabel help="Nom exact de la variable à tester, par exemple confiance_du_guide ou alerte_tour.">Variable testee</HelpLabel>
                                      <input value={reply.conditionVariableKey || ''} placeholder="confiance_du_guide" onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.conditionVariableKey = e.target.value;
                                      })} />
                                      <HelpLabel help="Comparaison utilisée pour decider si cette réponse est visible.">Comparaison</HelpLabel>
                                      <select value={reply.conditionVariableOperator || 'equals'} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.conditionVariableOperator = e.target.value;
                                      })}>
                                        <option value="equals">Egal a</option>
                                        <option value="not_equals">Different de</option>
                                        <option value="greater_or_equal">Superieur ou egal</option>
                                        <option value="less_or_equal">Inferieur ou egal</option>
                                        <option value="truthy">Vrai / rempli</option>
                                        <option value="falsy">Faux / vide</option>
                                      </select>
                                      {!['truthy', 'falsy'].includes(reply.conditionVariableOperator || 'equals') ? (
                                        <>
                                          <HelpLabel help="Valeur attendue. Pour un compteur, écris un nombre. Pour un booléen, écris true ou false.">Valeur attendue</HelpLabel>
                                          <input value={reply.conditionVariableValue ?? ''} placeholder="1, true, false..." onChange={(e) => patchProject((draft) => {
                                            const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                            if (targetReply) targetReply.conditionVariableValue = e.target.value;
                                          })} />
                                        </>
                                      ) : null}
                                    </>
                                  ) : null}
                                  {(reply.conditionType || 'none') === 'advanced' ? (
                                    <div className="conversation-advanced-condition-list">
                                      <div className="conversation-advanced-condition-head">
                                        <HelpLabel help="Choisis ET pour exiger toutes les conditions, ou OU pour accepter au moins une condition. Exemple : Objet possède ET confiance_du_guide >= 2.">Combinaison</HelpLabel>
                                        <select value={reply.advancedConditionMode || 'all'} onChange={(e) => patchProject((draft) => {
                                          const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                          if (targetReply) targetReply.advancedConditionMode = e.target.value;
                                        })}>
                                          <option value="all">Toutes les conditions (ET)</option>
                                          <option value="any">Au moins une condition (OU)</option>
                                        </select>
                                      </div>
                                      {(reply.advancedConditions || []).map((condition, conditionIndex) => (
                                        <div key={condition.id || conditionIndex} className="conversation-advanced-condition-row">
                                          <select value={condition.type || 'has_item'} onChange={(e) => patchProject((draft) => {
                                            const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                            const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                            if (targetCondition) targetCondition.type = e.target.value;
                                          })}>
                                            <option value="has_item">Objet possède</option>
                                            <option value="visited_scene">Scène visitée</option>
                                            <option value="completed_hotspot">Zone utilisée</option>
                                            <option value="solved_enigma">Énigme résolue</option>
                                            <option value="chose_reply">Choix précédent</option>
                                            <option value="story_variable">Variable d'histoire</option>
                                          </select>
                                          {(condition.type || 'has_item') === 'has_item' ? (
                                            <select value={condition.itemId || ''} onChange={(e) => patchProject((draft) => {
                                              const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                              const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                              if (targetCondition) targetCondition.itemId = e.target.value;
                                            })}>
                                              <option value="">Objet</option>
                                              {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                                            </select>
                                          ) : null}
                                          {(condition.type || 'has_item') === 'visited_scene' ? (
                                            <select value={condition.sceneId || ''} onChange={(e) => patchProject((draft) => {
                                              const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                              const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                              if (targetCondition) targetCondition.sceneId = e.target.value;
                                            })}>
                                              <option value="">Scène</option>
                                              {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                                            </select>
                                          ) : null}
                                          {(condition.type || 'has_item') === 'completed_hotspot' ? (
                                            <select value={condition.hotspotId || ''} onChange={(e) => patchProject((draft) => {
                                              const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                              const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                              if (targetCondition) targetCondition.hotspotId = e.target.value;
                                            })}>
                                              <option value="">Zone</option>
                                              {project.scenes.flatMap((scene) => (scene.hotspots || []).map((spot) => (
                                                <option key={spot.id} value={spot.id}>{getSceneLabel(scene.id)} - {spot.name}</option>
                                              )))}
                                            </select>
                                          ) : null}
                                          {(condition.type || 'has_item') === 'solved_enigma' ? (
                                            <select value={condition.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                                              const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                              const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                              if (targetCondition) targetCondition.enigmaId = e.target.value;
                                            })}>
                                              <option value="">Énigme</option>
                                              {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                                            </select>
                                          ) : null}
                                          {(condition.type || 'has_item') === 'chose_reply' ? (
                                            <select value={condition.replyId || ''} onChange={(e) => patchProject((draft) => {
                                              const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                              const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                              if (targetCondition) targetCondition.replyId = e.target.value;
                                            })}>
                                              <option value="">Choix précédent</option>
                                              {(selectedHotspot.conversation?.nodes || []).flatMap((conditionNode) => (conditionNode.replies || []).filter((conditionReply) => conditionReply.id !== reply.id).map((conditionReply) => (
                                                <option key={conditionReply.id} value={conditionReply.id}>{conditionReply.label || 'Réponse'} - {(conditionNode.text || 'Question').slice(0, 32)}</option>
                                              )))}
                                            </select>
                                          ) : null}
                                          {(condition.type || 'has_item') === 'story_variable' ? (
                                            <>
                                              <input value={condition.variableKey || ''} list="story-variable-keys" placeholder="confiance_du_guide" onChange={(e) => patchProject((draft) => {
                                                const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                                const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                                if (targetCondition) targetCondition.variableKey = e.target.value;
                                              })} />
                                              <select value={condition.operator || 'equals'} onChange={(e) => patchProject((draft) => {
                                                const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                                const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                                if (targetCondition) targetCondition.operator = e.target.value;
                                              })}>
                                                <option value="equals">=</option>
                                                <option value="not_equals">!=</option>
                                                <option value="greater_or_equal">&gt;=</option>
                                                <option value="less_or_equal">&lt;=</option>
                                                <option value="truthy">vrai / rempli</option>
                                                <option value="falsy">faux / vide</option>
                                              </select>
                                              {!['truthy', 'falsy'].includes(condition.operator || 'equals') ? (
                                                <input value={condition.value ?? ''} placeholder="2, true..." onChange={(e) => patchProject((draft) => {
                                                  const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                                  const targetCondition = targetReply?.advancedConditions?.[conditionIndex];
                                                  if (targetCondition) targetCondition.value = e.target.value;
                                                })} />
                                              ) : null}
                                            </>
                                          ) : null}
                                          <button type="button" className="secondary-action compact danger-action" onClick={() => patchProject((draft) => {
                                            const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                            if (targetReply) targetReply.advancedConditions = (targetReply.advancedConditions || []).filter((_, index) => index !== conditionIndex);
                                          })}>Retirer</button>
                                        </div>
                                      ))}
                                      <button type="button" className="secondary-action compact" onClick={() => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) {
                                          if (!Array.isArray(targetReply.advancedConditions)) targetReply.advancedConditions = [];
                                          targetReply.advancedConditions.push(makeAdvancedCondition());
                                        }
                                      })}>+ Condition</button>
                                    </div>
                                  ) : null}
                                  {(reply.conditionType || 'none') !== 'none' ? (
                                    <>
                                      <label className="adventure-inline-check">
                                        <input type="checkbox" checked={Boolean(reply.showWhenLocked)} onChange={(e) => patchProject((draft) => {
                                          const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                          if (targetReply) targetReply.showWhenLocked = e.target.checked;
                                        })} />
                                        Afficher verrouillée dans le player
                                      </label>
                                      {reply.showWhenLocked ? (
                                        <>
                                          <HelpLabel help="Texte affiché sous la réponse grisee. Laisse vide pour utiliser la raison automatique : objet manquant, variable trop faible, scène non visitée...">Raison affichée si verrouillée</HelpLabel>
                                          <input value={reply.lockedLabel || ''} placeholder="Nécessite le jeton du guide" onChange={(e) => patchProject((draft) => {
                                            const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                            if (targetReply) targetReply.lockedLabel = e.target.value;
                                          })} />
                                        </>
                                      ) : null}
                                    </>
                                  ) : null}
                                  <div className="conversation-effects-editor">
                                    <div className="conversation-effects-head">
                                      <HelpLabel help="Liste d'effets executes dans l'ordre quand le joueur choisit cette réponse. Tu peux cumuler message, objet, variable, journal puis navigation sans toucher au JSON.">Effets narratifs</HelpLabel>
                                      <div className="conversation-effect-buttons">
                                        {CONVERSATION_EFFECT_BUTTONS.map(([effectType, label]) => (
                                          <button key={effectType} type="button" className="secondary-action compact" onClick={() => patchProject((draft) => {
                                            const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                            if (targetReply) {
                                              if (!Array.isArray(targetReply.effects)) targetReply.effects = [];
                                              targetReply.effects.push(makeConversationEffect(effectType));
                                            }
                                          })}>{label}</button>
                                        ))}
                                      </div>
                                    </div>
                                    {(reply.effects || []).length ? (
                                      <div className="conversation-effects-list">
                                        {(reply.effects || []).map((effect, effectIndex) => (
                                          <div key={effect.id || effectIndex} className="conversation-effect-row">
                                            <div className="conversation-effect-row-head">
                                              <strong>{CONVERSATION_EFFECT_LABELS[effect.type] || 'Effet'} {effectIndex + 1}</strong>
                                              <div className="conversation-reply-actions">
                                                <button type="button" className="secondary-action compact" disabled={effectIndex === 0} onClick={() => patchProject((draft) => {
                                                  const effects = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects;
                                                  if (effects && effectIndex > 0) [effects[effectIndex - 1], effects[effectIndex]] = [effects[effectIndex], effects[effectIndex - 1]];
                                                })}>Monter</button>
                                                <button type="button" className="secondary-action compact" disabled={effectIndex >= (reply.effects || []).length - 1} onClick={() => patchProject((draft) => {
                                                  const effects = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects;
                                                  if (effects && effectIndex < effects.length - 1) [effects[effectIndex], effects[effectIndex + 1]] = [effects[effectIndex + 1], effects[effectIndex]];
                                                })}>Descendre</button>
                                                <button type="button" className="secondary-action compact danger-action" onClick={() => patchProject((draft) => {
                                                  const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                                  if (targetReply) targetReply.effects = (targetReply.effects || []).filter((_, index) => index !== effectIndex);
                                                })}>Retirer</button>
                                              </div>
                                            </div>
                                            <HelpLabel help="Type d'effet execute par cette ligne. Les effets de navigation comme Scène, Cinématique, Énigme, Fin ou Question suivante terminent naturellement la suite.">Type</HelpLabel>
                                            <select value={effect.type || 'message'} onChange={(e) => patchProject((draft) => {
                                              const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                              if (targetEffect) targetEffect.type = e.target.value;
                                            })}>
                                              {Object.entries(CONVERSATION_EFFECT_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                              ))}
                                            </select>
                                            {['message', 'ending'].includes(effect.type || 'message') ? (
                                              <>
                                                <HelpLabel help="Texte ajouté au message après ce choix.">Message</HelpLabel>
                                                <textarea value={effect.message || ''} placeholder="Le garde hesite et baisse sa lance." onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.message = e.target.value;
                                                })} />
                                              </>
                                            ) : null}
                                            {['add_item', 'remove_item'].includes(effect.type || 'message') ? (
                                              <>
                                                <HelpLabel help={effect.type === 'remove_item' ? "Objet retiré de l'inventaire." : "Objet ajouté à l'inventaire."}>Objet</HelpLabel>
                                                <select value={effect.itemId || ''} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.itemId = e.target.value;
                                                })}>
                                                  <option value="">Choisir un objet</option>
                                                  {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                                                </select>
                                              </>
                                            ) : null}
                                            {['set_variable', 'increment_variable', 'decrement_variable'].includes(effect.type || 'message') ? (
                                              <>
                                                <HelpLabel help="Nom exact de la variable d'histoire a modifier.">Variable</HelpLabel>
                                                <input value={effect.variableKey || ''} list="story-variable-keys" placeholder="confiance_du_guide" onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.variableKey = e.target.value;
                                                })} />
                                                <HelpLabel help={effect.type === 'set_variable' ? 'Valeur à enregistrer : true, false, texte ou nombre.' : 'Nombre à ajouter ou retirer.'}>Valeur</HelpLabel>
                                                <input value={effect.value ?? ''} placeholder={effect.type === 'set_variable' ? 'true, false, accuse...' : '1'} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.value = e.target.value;
                                                })} />
                                              </>
                                            ) : null}
                                            {['heal_health', 'heal_mana'].includes(effect.type || 'message') ? (
                                              <>
                                                <HelpLabel help={effect.type === 'heal_health' ? 'PV rendus au héros, limités aux PV max.' : 'Mana rendue au héros, limitée à la mana max.'}>Quantité</HelpLabel>
                                                <input value={effect.value ?? ''} placeholder={effect.type === 'heal_health' ? '4' : '3'} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.value = e.target.value;
                                                })} />
                                              </>
                                            ) : null}
                                            {(effect.type || 'message') === 'journal' ? (
                                              <>
                                                <HelpLabel help="Titre ajouté au journal joueur.">Titre journal</HelpLabel>
                                                <input value={effect.journalTitle || ''} placeholder="Le garde doute" onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.journalTitle = e.target.value;
                                                })} />
                                                <HelpLabel help="Détail ajouté au journal joueur.">Détail journal</HelpLabel>
                                                <textarea value={effect.journalDetail || ''} placeholder="Il semble sensible aux preuves." onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.journalDetail = e.target.value;
                                                })} />
                                              </>
                                            ) : null}
                                            {(effect.type || 'message') === 'next_node' ? (
                                              <>
                                                <HelpLabel help="Question ouverte après cet effet.">Question cible</HelpLabel>
                                                <select value={effect.nextNodeId || ''} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.nextNodeId = e.target.value;
                                                })}>
                                                  <option value="">Fin conversation</option>
                                                  {(selectedHotspot.conversation?.nodes || []).map((targetNode) => <option key={targetNode.id} value={targetNode.id}>{targetNode.speaker || 'PNJ'} - {(targetNode.text || 'Question').slice(0, 40)}</option>)}
                                                </select>
                                              </>
                                            ) : null}
                                            {(effect.type || 'message') === 'scene' ? (
                                              <>
                                                <HelpLabel help="Scène ouverte après cette réponse.">Scène cible</HelpLabel>
                                                <select value={effect.targetSceneId || ''} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.targetSceneId = e.target.value;
                                                })}>
                                                  <option value="">Aucune scène</option>
                                                  {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                                                </select>
                                              </>
                                            ) : null}
                                            {(effect.type || 'message') === 'cinematic' ? (
                                              <>
                                                <HelpLabel help="Cinématique lancée après cette réponse.">Cinématique cible</HelpLabel>
                                                <select value={effect.targetCinematicId || ''} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.targetCinematicId = e.target.value;
                                                })}>
                                                  <option value="">Aucune cinématique</option>
                                                  {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                                                </select>
                                              </>
                                            ) : null}
                                            {(effect.type || 'message') === 'enigma' ? (
                                              <>
                                                <HelpLabel help="Énigme ouverte après cette réponse.">Énigme cible</HelpLabel>
                                                <select value={effect.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.enigmaId = e.target.value;
                                                })}>
                                                  <option value="">Aucune énigme</option>
                                                  {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                                                </select>
                                              </>
                                            ) : null}
                                            {(effect.type || 'message') === 'ending' ? (
                                              <>
                                                <HelpLabel help="Type de fin affiche au joueur.">Type de fin</HelpLabel>
                                                <select value={effect.endingType || 'neutral'} onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.endingType = e.target.value;
                                                })}>
                                                  <option value="good">Bonne fin</option>
                                                  <option value="bad">Mauvaise fin</option>
                                                  <option value="secret">Fin secrete</option>
                                                  <option value="neutral">Fin neutre</option>
                                                </select>
                                                <HelpLabel help="Titre affiche sur l'écran de fin.">Titre de fin</HelpLabel>
                                                <input value={effect.endingTitle || ''} placeholder="La paix du village" onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.endingTitle = e.target.value;
                                                })} />
                                                <HelpLabel help="Resume affiche sur l'écran de fin.">Résumé de fin</HelpLabel>
                                                <textarea value={effect.endingSummary || ''} placeholder="Tes choix ont convaincu le garde et sauve le village." onChange={(e) => patchProject((draft) => {
                                                  const targetEffect = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex]?.effects?.[effectIndex];
                                                  if (targetEffect) targetEffect.endingSummary = e.target.value;
                                                })} />
                                              </>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="small-note">Aucun effet narratif avance. Les anciens champs ci-dessous continuent de fonctionner.</p>
                                    )}
                                  </div>
                                  <HelpLabel help="Effet applique quand le joueur clique cette réponse. Sert à mémoriser une décision pour plus tard.">Variable modifiée</HelpLabel>
                                  <select value={reply.storyVariableOperation || 'none'} onChange={(e) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) {
                                      targetReply.storyVariableOperation = e.target.value;
                                      if (e.target.value === 'none') {
                                        targetReply.storyVariableKey = '';
                                        targetReply.storyVariableValue = '';
                                      }
                                    }
                                  })}>
                                    <option value="none">Aucune variable</option>
                                    <option value="set">Definir une valeur</option>
                                    <option value="increment">Ajouter un nombre</option>
                                    <option value="decrement">Retirer un nombre</option>
                                  </select>
                                  {(reply.storyVariableOperation || 'none') !== 'none' ? (
                                    <>
                                      <HelpLabel help="Nom de la variable à modifier, par exemple confiance_du_guide, alerte_tour ou aide_villageois.">Nom de variable</HelpLabel>
                                      <input value={reply.storyVariableKey || ''} placeholder="confiance_du_guide" onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.storyVariableKey = e.target.value;
                                      })} />
                                      <HelpLabel help={['increment', 'decrement'].includes(reply.storyVariableOperation || 'none') ? 'Nombre à ajouter ou retirer.' : 'Valeur à enregistrer. Utilise true ou false pour un interrupteur.'}>Valeur</HelpLabel>
                                      <input value={reply.storyVariableValue ?? ''} placeholder={['increment', 'decrement'].includes(reply.storyVariableOperation || 'none') ? '1' : 'true, false, aide...'} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.storyVariableValue = e.target.value;
                                      })} />
                                    </>
                                  ) : null}
                                  <HeroMalusFields
                                    entry={reply}
                                    updateEntry={(updater) => patchProject((draft) => {
                                      const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                      if (targetReply) updater(targetReply);
                                    })}
                                    isHeroAdventureProject={isHeroAdventureProject}
                                  />
                                  {['node', 'dialogue', 'item', 'multiple'].includes(reply.actionType || 'node') ? (
                                    <>
                                      <HelpLabel help="Question suivante à afficher. Choisis Fin si cette réponse doit fermer la conversation.">Question suivante</HelpLabel>
                                      <select value={reply.nextNodeId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.nextNodeId = e.target.value;
                                      })}>
                                        <option value="">Fin</option>
                                        {(selectedHotspot.conversation?.nodes || []).map((targetNode) => <option key={targetNode.id} value={targetNode.id}>{targetNode.speaker || 'PNJ'} - {(targetNode.text || 'Question').slice(0, 40)}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.actionType || 'node') === 'skill_check' ? (
                                    <SkillCheckFields
                                      entry={reply}
                                      updateEntry={(updater) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) updater(targetReply);
                                      })}
                                      conversationNodes={selectedHotspot.conversation?.nodes || []}
                                      project={project}
                                      heroSkills={heroSkills}
                                      getSceneLabel={getSceneLabel}
                                    />
                                  ) : null}
                                  {['item', 'multiple'].includes(reply.actionType || 'node') ? (
                                    <>
                                      <HelpLabel help="Objet ajouté à l'inventaire quand le joueur choisit cette réponse. En Actions multiples, l'objet peut être donné avant d'aller vers une autre question.">Objet donné</HelpLabel>
                                      <select value={reply.rewardItemId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.rewardItemId = e.target.value;
                                      })}>
                                        <option value="">Aucun objet</option>
                                        {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.actionType || 'node') === 'scene' ? (
                                    <>
                                      <HelpLabel help="Scène vers laquelle le joueur est envoyé après cette réponse.">Scène cible</HelpLabel>
                                      <select value={reply.targetSceneId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.targetSceneId = e.target.value;
                                      })}>
                                        <option value="">Aucune scène</option>
                                        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.actionType || 'node') === 'cinematic' ? (
                                    <>
                                      <HelpLabel help="Cinématique lancée après cette réponse. Pratique pour une révélation, une transition ou une fin.">Cinématique cible</HelpLabel>
                                      <select value={reply.targetCinematicId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.targetCinematicId = e.target.value;
                                      })}>
                                        <option value="">Aucune cinématique</option>
                                        {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.actionType || 'node') === 'enigma' ? (
                                    <>
                                      <HelpLabel help="Énigme ouverte après cette réponse. La conversation se ferme et l'énigme prend le relais.">Énigme liée</HelpLabel>
                                      <select value={reply.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.enigmaId = e.target.value;
                                      })}>
                                        <option value="">Aucune énigme</option>
                                        {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                                      </select>
                                    </>
                                  ) : null}
                                  {(reply.actionType || 'node') === 'ending' ? (
                                    <>
                                      <HelpLabel help="Catégorie de fin affichée au joueur dans l'écran de résumé.">Type de fin</HelpLabel>
                                      <select value={reply.endingType || 'neutral'} onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.endingType = e.target.value;
                                      })}>
                                        <option value="good">Bonne fin</option>
                                        <option value="bad">Mauvaise fin</option>
                                        <option value="secret">Fin secrete</option>
                                        <option value="neutral">Fin neutre</option>
                                      </select>
                                      <HelpLabel help="Titre affiche en grand dans le petit écran de fin.">Titre de fin</HelpLabel>
                                      <input value={reply.endingTitle || ''} placeholder="La tour s'ouvre enfin" onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.endingTitle = e.target.value;
                                      })} />
                                      <HelpLabel help="Resume court de ce que le joueur a provoque par ses choix.">Résumé de fin</HelpLabel>
                                      <textarea value={reply.endingSummary || ''} placeholder="Le guide te fait confiance, la tour baisse son alarme, et le village est sauve." onChange={(e) => patchProject((draft) => {
                                        const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                        if (targetReply) targetReply.endingSummary = e.target.value;
                                      })} />
                                    </>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            ))}
                        </ConversationEditorModal>
                      ) : null}
                      {displayedHotspotActionType !== 'conversation' ? (
                        <HotspotActionFields
                          entry={selectedHotspot}
                          updateEntry={(updater) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                            if (spot) updater(spot);
                          })}
                          actionType={selectedHotspot.actionType}
                          isBeginnerMode={isBeginnerMode}
                          isHeroAdventureProject={isHeroAdventureProject}
                          selectedSceneId={selectedSceneId}
                          project={project}
                          heroSkills={heroSkills}
                          getSceneLabel={getSceneLabel}
                        />
                      ) : null}
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={async () => {
                        const confirmed = await showConfirm({
                          title: 'Supprimer la zone',
                          message: `Supprimer la zone "${selectedHotspot.name}" ?`,
                          confirmLabel: 'Supprimer',
                          variant: 'danger',
                        });
                        if (!confirmed) return;
                        deleteHotspot(selectedSceneId, selectedHotspotId);
                      }}>Supprimer la zone</button>

    </>
  );
}
