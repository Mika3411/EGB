import { useEffect, useRef, useState } from 'react';
import {
  EditorToolbarMenus,
  HelpLabel,
  LayersPanel,
} from './scenes/SceneEditorChrome.jsx';
import Anime2DPreview from './Anime2DPreview.jsx';
import NumberInput from './forms/NumberInput.jsx';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import { showConfirm } from './AccessibleDialog';
import SceneSidebar from './scenes/SceneSidebar.jsx';
import SceneFullscreenEditor from './scenes/SceneFullscreenEditor.jsx';
import HotspotAssetsPanel from './scenes/HotspotAssetsPanel.jsx';
import SceneObjectInspector, { SceneObjectBlockContent, getSceneObjectClickMode } from './scenes/SceneObjectInspector.jsx';
import QuickLogicModal from './scenes/QuickLogicModal.jsx';
import SceneVisualEffect, { VISUAL_EFFECT_INTENSITY_OPTIONS, getVisualEffectZoneZIndex } from './SceneVisualEffect.jsx';
import VisualEffectCascadeMenu from './VisualEffectCascadeMenu.jsx';
import { useSceneEditorCreation } from './scenes/useSceneEditorCreation.js';
import { useSceneEditorSceneState } from './scenes/useSceneEditorSceneState.js';
import { useSceneEditorShapes } from './scenes/useSceneEditorShapes.js';
import { useSceneFullscreenEditor } from './scenes/useSceneFullscreenEditor.js';
import { useSceneEditorSelection } from './scenes/useSceneEditorSelection.js';
import {
  clampFullscreenZoom,
  clampPercent,
  getElementShapeCorners,
  getElementShapePoints,
  getElementShapeStyle,
  getElementShapeType,
  getLayerZIndex,
  getSceneObjectStyle,
  gridOverlayStyle,
  shouldIgnoreEditorShortcut,
} from './scenes/sceneEditorUtils.js';

const FALLBACK_HERO_SKILLS = [
  { id: 'force', name: 'Force', value: 3, manaCost: 0 },
  { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
  { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
];

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
  ['set_variable', '+ Variable'],
  ['journal', '+ Journal'],
  ['next_node', '+ Aller vers...'],
];

const CONVERSATION_EFFECT_LABELS = {
  message: 'Message',
  add_item: 'Donner objet',
  remove_item: 'Retirer objet',
  set_variable: 'Definir variable',
  increment_variable: 'Ajouter variable',
  decrement_variable: 'Retirer variable',
  journal: 'Journal',
  next_node: 'Question suivante',
  scene: 'Scène',
  cinematic: 'Cinématique',
  enigma: 'Énigme',
  ending: 'Fin',
};

const BEGINNER_HOTSPOT_ACTION_TYPES = new Set(['dialogue', 'dialogue_item', 'scene']);

const parseBranchTags = (value = '') => (
  String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean)
);

function ConversationGraph({ conversation, project, getSceneLabel }) {
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

function useSceneEditorDragResize({
  canvasRef,
  fullscreenCanvasRef,
  dragMovedRef,
  selectedScene,
  selectedSceneId,
  selectedHotspotIds,
  selectedSceneObjectIds,
  multiSelectEnabled,
  patchProject,
  rememberProjectState,
  snapValue,
  setSelectedHotspotId,
  setSelectedSceneObjectId,
  setSelectedVisualEffectZoneId,
  setSelectedItemId,
  setSelectedHotspotIds,
  setSelectedSceneObjectIds,
  getEditorElementByType,
  getAbsoluteShapeCorners,
  getAbsoluteShapePoints,
  applyShapePoints,
  getResizeHandleStyle,
}) {
  const draggingHotspotIdRef = useRef('');
  const draggingSceneObjectIdRef = useRef('');
  const draggingVisualEffectZoneIdRef = useRef('');
  const resizingElementRef = useRef(null);
  const dragSourceRef = useRef('main');
  const dragFrameRef = useRef(0);
  const pendingDragUpdateRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const [draggingHotspotId, setDraggingHotspotId] = useState('');
  const [draggingSceneObjectId, setDraggingSceneObjectId] = useState('');
  const [draggingVisualEffectZoneId, setDraggingVisualEffectZoneId] = useState('');
  const [resizingElement, setResizingElement] = useState(null);
  const [isDragLocked, setIsDragLocked] = useState(false);

  const getCanvasPointerPosition = (clientX, clientY, source = 'main') => {
    const activeRef = source === 'fullscreen' ? fullscreenCanvasRef : canvasRef;
    if (!activeRef.current) return null;

    const rect = activeRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: clampPercent(snapValue(((clientX - rect.left) / rect.width) * 100)),
      y: clampPercent(snapValue(((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const startDragPreview = (event, type, id, source, entry) => {
    dragPreviewRef.current = {
      type,
      id,
      source,
      element: event.currentTarget,
      latest: {
        x: Number(entry?.x) || 0,
        y: Number(entry?.y) || 0,
      },
    };
  };

  const previewDragPosition = (clientX, clientY, source = 'main') => {
    const preview = dragPreviewRef.current;
    if (!preview) return;
    const position = getCanvasPointerPosition(clientX, clientY, source);
    if (!position) return;
    dragMovedRef.current = true;
    preview.latest = position;
    if (preview.element?.style) {
      preview.element.style.left = `${Number(position.x.toFixed(2))}%`;
      preview.element.style.top = `${Number(position.y.toFixed(2))}%`;
    }
  };

  const commitDragPreview = () => {
    const preview = dragPreviewRef.current;
    dragPreviewRef.current = null;
    if (!preview?.latest || !selectedSceneId) return;
    const x = Number(preview.latest.x.toFixed(2));
    const y = Number(preview.latest.y.toFixed(2));

    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      if (!scene) return;

      if (preview.type === 'hotspot') {
        const spot = scene.hotspots?.find((h) => h.id === preview.id);
        if (!spot) return;
        const deltaX = x - spot.x;
        const deltaY = y - spot.y;
        const movedIds = multiSelectEnabled && selectedHotspotIds.includes(spot.id) ? selectedHotspotIds : [spot.id];
        scene.hotspots
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === spot.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === spot.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
        return;
      }

      if (preview.type === 'sceneObject') {
        const sceneObject = scene.sceneObjects?.find((obj) => obj.id === preview.id);
        if (!sceneObject) return;
        const deltaX = x - sceneObject.x;
        const deltaY = y - sceneObject.y;
        const movedIds = multiSelectEnabled && selectedSceneObjectIds.includes(sceneObject.id) ? selectedSceneObjectIds : [sceneObject.id];
        scene.sceneObjects
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === sceneObject.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === sceneObject.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
        return;
      }

      if (preview.type === 'visualEffectZone') {
        const visualZone = scene.visualEffectZones?.find((zone) => zone.id === preview.id);
        if (visualZone) {
          visualZone.x = x;
          visualZone.y = y;
        }
      }
    }, { rememberHistory: false });
  };

  const flushPendingDragUpdate = () => {
    if (dragFrameRef.current) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
    }
    const pending = pendingDragUpdateRef.current;
    pendingDragUpdateRef.current = null;
    if (!pending) return;
    if (pending.isResize) {
      updateElementSize(pending.clientX, pending.clientY);
      return;
    }
    previewDragPosition(pending.clientX, pending.clientY, pending.source);
  };

  const scheduleDragUpdate = (pending) => {
    pendingDragUpdateRef.current = pending;
    if (dragFrameRef.current) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = 0;
      const nextPending = pendingDragUpdateRef.current;
      pendingDragUpdateRef.current = null;
      if (!nextPending) return;
      if (nextPending.isResize) {
        updateElementSize(nextPending.clientX, nextPending.clientY);
        return;
      }
      previewDragPosition(nextPending.clientX, nextPending.clientY, nextPending.source);
    });
  };

  const stopDragging = () => {
    flushPendingDragUpdate();
    commitDragPreview();
    draggingHotspotIdRef.current = '';
    draggingSceneObjectIdRef.current = '';
    draggingVisualEffectZoneIdRef.current = '';
    setDraggingHotspotId('');
    setDraggingSceneObjectId('');
    setDraggingVisualEffectZoneId('');
    setIsDragLocked(false);
  };

  const stopResizing = () => {
    flushPendingDragUpdate();
    resizingElementRef.current = null;
    setResizingElement(null);
    setIsDragLocked(false);
  };

  const updateHotspotPosition = (clientX, clientY, source = 'main') => {
    const activeHotspotId = draggingHotspotIdRef.current || draggingHotspotId;
    const activeSceneObjectId = draggingSceneObjectIdRef.current || draggingSceneObjectId;
    const activeVisualEffectZoneId = draggingVisualEffectZoneIdRef.current || draggingVisualEffectZoneId;
    if ((!activeHotspotId && !activeSceneObjectId && !activeVisualEffectZoneId) || !selectedSceneId) return;
    dragMovedRef.current = true;

    const activeRef = source === 'fullscreen' ? fullscreenCanvasRef : canvasRef;
    if (!activeRef.current) return;

    const rect = activeRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = clampPercent(snapValue(((clientX - rect.left) / rect.width) * 100));
    const y = clampPercent(snapValue(((clientY - rect.top) / rect.height) * 100));

    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      const spot = scene?.hotspots?.find((h) => h.id === activeHotspotId);
      if (spot) {
        const deltaX = x - spot.x;
        const deltaY = y - spot.y;
        const movedIds = multiSelectEnabled && selectedHotspotIds.includes(spot.id) ? selectedHotspotIds : [spot.id];
        scene.hotspots
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === spot.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === spot.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
      }
      const sceneObject = scene?.sceneObjects?.find((obj) => obj.id === activeSceneObjectId);
      if (sceneObject) {
        const deltaX = x - sceneObject.x;
        const deltaY = y - sceneObject.y;
        const movedIds = multiSelectEnabled && selectedSceneObjectIds.includes(sceneObject.id) ? selectedSceneObjectIds : [sceneObject.id];
        scene.sceneObjects
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === sceneObject.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === sceneObject.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
      }
      const visualZone = scene?.visualEffectZones?.find((zone) => zone.id === activeVisualEffectZoneId);
      if (visualZone) {
        visualZone.x = Number(x.toFixed(2));
        visualZone.y = Number(y.toFixed(2));
      }
    }, { rememberHistory: false });
  };

  const updateElementSize = (clientX, clientY) => {
    const resizing = resizingElementRef.current;
    if (!resizing || !selectedSceneId) return;
    dragMovedRef.current = true;

    const activeRef = resizing.source === 'fullscreen' ? fullscreenCanvasRef : canvasRef;
    if (!activeRef.current) return;

    const rect = activeRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pointerX = clampPercent(snapValue(((clientX - rect.left) / rect.width) * 100));
    const pointerY = clampPercent(snapValue(((clientY - rect.top) / rect.height) * 100));
    const minSize = 2;

    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      const entry = getEditorElementByType(scene, resizing.type, resizing.id);
      if (!entry) return;

      if (resizing.handle.startsWith('point-')) {
        const pointIndex = Number(resizing.handle.replace('point-', ''));
        const absolutePoints = resizing.start.absolutePoints.map((point) => ({ ...point }));
        if (absolutePoints[pointIndex]) {
          absolutePoints[pointIndex] = { x: pointerX, y: pointerY };
          applyShapePoints(entry, absolutePoints);
        }
        return;
      }

      if (getElementShapeType(entry) === 'free') {
        const absolutePoints = resizing.start.absolutePoints.map((point) => ({ ...point }));
        if (resizing.handle.length === 1) {
          const xs = resizing.start.absolutePoints.map((point) => point.x);
          const ys = resizing.start.absolutePoints.map((point) => point.y);
          const left = Math.min(...xs);
          const right = Math.max(...xs);
          const top = Math.min(...ys);
          const bottom = Math.max(...ys);
          absolutePoints.forEach((point) => {
            if (resizing.handle === 'e' && Math.abs(point.x - right) < 0.01) point.x = pointerX;
            if (resizing.handle === 'w' && Math.abs(point.x - left) < 0.01) point.x = pointerX;
            if (resizing.handle === 'n' && Math.abs(point.y - top) < 0.01) point.y = pointerY;
            if (resizing.handle === 's' && Math.abs(point.y - bottom) < 0.01) point.y = pointerY;
          });
        }
        applyShapePoints(entry, absolutePoints);
        return;
      }

      let left = resizing.start.x - resizing.start.width / 2;
      let right = resizing.start.x + resizing.start.width / 2;
      let top = resizing.start.y - resizing.start.height / 2;
      let bottom = resizing.start.y + resizing.start.height / 2;

      if (resizing.handle.includes('e')) right = Math.max(left + minSize, pointerX);
      if (resizing.handle.includes('w')) left = Math.min(right - minSize, pointerX);
      if (resizing.handle.includes('s')) bottom = Math.max(top + minSize, pointerY);
      if (resizing.handle.includes('n')) top = Math.min(bottom - minSize, pointerY);

      left = clampPercent(left);
      right = clampPercent(right);
      top = clampPercent(top);
      bottom = clampPercent(bottom);

      if (right - left < minSize) {
        if (resizing.handle.includes('w')) left = Math.max(0, right - minSize);
        else right = Math.min(100, left + minSize);
      }
      if (bottom - top < minSize) {
        if (resizing.handle.includes('n')) top = Math.max(0, bottom - minSize);
        else bottom = Math.min(100, top + minSize);
      }

      entry.x = Number(((left + right) / 2).toFixed(2));
      entry.y = Number(((top + bottom) / 2).toFixed(2));
      entry.width = Number((right - left).toFixed(2));
      entry.height = Number((bottom - top).toFixed(2));
      delete entry.shapeCorners;
      delete entry.shapePoints;
    }, { rememberHistory: false });
  };

  const beginResize = (event, type, id, handle, source = 'main') => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry || entry.isLocked) return;

    rememberProjectState?.();
    dragMovedRef.current = false;
    resizingElementRef.current = {
      type,
      id,
      handle,
      source,
      start: {
        x: Number(entry.x) || 0,
        y: Number(entry.y) || 0,
        width: Number(entry.width) || 2,
        height: Number(entry.height) || 2,
        shapeCorners: getElementShapeCorners(entry),
        absoluteCorners: getAbsoluteShapeCorners(entry),
        absolutePoints: getAbsoluteShapePoints(entry),
      },
    };
    setResizingElement({ type, id, handle });
    setIsDragLocked(true);
  };

  const renderResizeHandles = (type, id, isSelected, source = 'main') => {
    if (!isSelected) return null;
    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry) return null;
    return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
      <span
        key={handle}
        className={`editor-resize-handle editor-resize-handle-${handle}`}
        style={getResizeHandleStyle(entry, handle)}
        aria-hidden="true"
        onPointerDown={(event) => beginResize(event, type, id, handle, source)}
      />
    ));
  };

  const renderShapePointHandles = (type, id, isSelected, source = 'main') => {
    if (!isSelected) return null;
    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry || getElementShapeType(entry) !== 'free') return null;
    return getElementShapePoints(entry).map((point, index) => (
      <span
        key={`point-${index}`}
        className="editor-resize-handle editor-shape-point-handle"
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
        aria-hidden="true"
        onPointerDown={(event) => beginResize(event, type, id, `point-${index}`, source)}
      />
    ));
  };

  const beginObjectDrag = (event, objectId, source = 'main') => {
    const object = selectedScene?.sceneObjects?.find((entry) => entry.id === objectId);
    if (object?.isLocked) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    rememberProjectState?.();
    dragMovedRef.current = false;
    draggingSceneObjectIdRef.current = objectId;
    draggingHotspotIdRef.current = '';
    draggingVisualEffectZoneIdRef.current = '';
    dragSourceRef.current = source;
    setDraggingSceneObjectId(objectId);
    setDraggingHotspotId('');
    setDraggingVisualEffectZoneId('');
    setIsDragLocked(true);
    setSelectedSceneObjectId(objectId);
    setSelectedHotspotId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
    startDragPreview(event, 'sceneObject', objectId, source, object);
  };

  const beginVisualEffectZoneDrag = (event, zoneId, source = 'main') => {
    const zone = selectedScene?.visualEffectZones?.find((entry) => entry.id === zoneId);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    rememberProjectState?.();
    dragMovedRef.current = false;
    draggingVisualEffectZoneIdRef.current = zoneId;
    draggingHotspotIdRef.current = '';
    draggingSceneObjectIdRef.current = '';
    dragSourceRef.current = source;
    setDraggingVisualEffectZoneId(zoneId);
    setDraggingHotspotId('');
    setDraggingSceneObjectId('');
    setIsDragLocked(true);
    setSelectedVisualEffectZoneId(zoneId);
    setSelectedSceneObjectId('');
    setSelectedHotspotId('');
    setSelectedItemId('');
    setSelectedHotspotIds([]);
    setSelectedSceneObjectIds([]);
    startDragPreview(event, 'visualEffectZone', zoneId, source, zone);
  };

  const beginDrag = (event, spotId, source = 'main') => {
    const spot = selectedScene?.hotspots?.find((entry) => entry.id === spotId);
    if (spot?.isLocked) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    rememberProjectState?.();
    dragMovedRef.current = false;
    draggingHotspotIdRef.current = spotId;
    draggingSceneObjectIdRef.current = '';
    draggingVisualEffectZoneIdRef.current = '';
    dragSourceRef.current = source;
    setDraggingHotspotId(spotId);
    setDraggingSceneObjectId('');
    setDraggingVisualEffectZoneId('');
    setIsDragLocked(true);
    setSelectedHotspotId(spotId);
    setSelectedSceneObjectId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
    startDragPreview(event, 'hotspot', spotId, source, spot);
  };

  useEffect(() => {
    if (!draggingHotspotId && !draggingSceneObjectId && !draggingVisualEffectZoneId && !resizingElement) return undefined;

    const handlePointerMove = (event) => {
      event.preventDefault();
      scheduleDragUpdate({
        clientX: event.clientX,
        clientY: event.clientY,
        source: dragSourceRef.current,
        isResize: Boolean(resizingElementRef.current),
      });
    };

    const handlePointerEnd = () => {
      flushPendingDragUpdate();
      if (resizingElementRef.current) stopResizing();
      else stopDragging();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      flushPendingDragUpdate();
    };
  }, [draggingHotspotId, draggingSceneObjectId, draggingVisualEffectZoneId, resizingElement]);

  return {
    draggingHotspotId,
    draggingSceneObjectId,
    draggingVisualEffectZoneId,
    isDragLocked,
    beginDrag,
    beginObjectDrag,
    beginVisualEffectZoneDrag,
    stopDragging,
    beginResize,
    stopResizing,
    updateHotspotPosition,
    updateElementSize,
    renderResizeHandles,
    renderShapePointHandles,
  };
}

function useSceneEditorCommands({
  selectedSceneId,
  activeSelectionCount,
  selectedEditorType,
  activeHotspotIds,
  activeSceneObjectIds,
  selectedVisualEffectZoneId,
  setSelectedHotspotId,
  setSelectedHotspotIds,
  setSelectedSceneObjectId,
  setSelectedSceneObjectIds,
  setSelectedVisualEffectZoneId,
  patchProject,
  snapValue,
  isEditorFullscreen,
  closeEditorFullscreen,
  setClampedFullscreenZoom,
  setSnapGridEnabled,
  setMultiSelectEnabled,
  undoProjectChange,
  redoProjectChange,
}) {
  const getActiveEditorSelection = (scene) => {
    if (!scene) return { type: '', ids: [], items: [] };
    const sceneObjects = scene.sceneObjects || [];
    const objectIds = activeSceneObjectIds.filter((id) => sceneObjects.some((entry) => entry.id === id));
    if (objectIds.length) {
      return {
        type: 'sceneObject',
        ids: objectIds,
        items: sceneObjects.filter((entry) => objectIds.includes(entry.id)),
      };
    }
    const hotspotIds = activeHotspotIds.filter((id) => (scene.hotspots || []).some((entry) => entry.id === id));
    if (hotspotIds.length) {
      return {
        type: 'hotspot',
        ids: hotspotIds,
        items: (scene.hotspots || []).filter((entry) => hotspotIds.includes(entry.id)),
      };
    }
    return { type: '', ids: [], items: [] };
  };

  const duplicateSelectedEditorItems = () => {
    if (!selectedSceneId || !activeSelectionCount) return;
    const nextIds = [];
    const selectionType = selectedEditorType;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      const sourceItems = getActiveEditorSelection(scene).items;
      if (!sourceItems.length) return;
      sourceItems.forEach((entry) => {
        const nextId = `${selectionType === 'hotspot' ? 'hotspot' : 'scene-object'}-${Math.random().toString(36).slice(2, 10)}`;
        nextIds.push(nextId);
        const duplicate = {
          ...entry,
          id: nextId,
          name: `${entry.name || (selectionType === 'hotspot' ? 'Zone' : 'Objet')} copie`,
          x: Number(clampPercent((entry.x || 50) + 3).toFixed(2)),
          y: Number(clampPercent((entry.y || 50) + 3).toFixed(2)),
          isHidden: false,
          isLocked: false,
          zIndex: getLayerZIndex(entry, selectionType) + 1,
        };
        if (selectionType === 'hotspot') scene.hotspots.push(duplicate);
        else {
          if (!Array.isArray(scene.sceneObjects)) scene.sceneObjects = [];
          scene.sceneObjects.push(duplicate);
        }
      });
    });
    if (!nextIds.length) return;
    if (selectionType === 'hotspot') {
      setSelectedHotspotId(nextIds[0]);
      setSelectedHotspotIds(nextIds);
      setSelectedSceneObjectId('');
      setSelectedSceneObjectIds([]);
      return;
    }
    setSelectedSceneObjectId(nextIds[0]);
    setSelectedSceneObjectIds(nextIds);
    setSelectedHotspotId('');
    setSelectedHotspotIds([]);
  };

  const deleteSelectedEditorItems = async () => {
    if (!selectedSceneId || !activeSelectionCount) return;
    const selectionType = selectedEditorType;
    const labels = {
      sceneObject: activeSceneObjectIds.length > 1 ? `${activeSceneObjectIds.length} objets visibles` : 'cet objet visible',
      visualEffectZone: 'cette zone visuelle',
      hotspot: activeHotspotIds.length > 1 ? `${activeHotspotIds.length} zones d'action` : "cette zone d'action",
    };
    const confirmed = await showConfirm({
      title: 'Supprimer la sélection',
      message: `Supprimer ${labels[selectionType] || 'la sélection'} ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      if (selectionType === 'sceneObject') {
        scene.sceneObjects = (scene.sceneObjects || []).filter((entry) => !activeSceneObjectIds.includes(entry.id));
        return;
      }
      if (selectionType === 'visualEffectZone') {
        scene.visualEffectZones = (scene.visualEffectZones || []).filter((entry) => entry.id !== selectedVisualEffectZoneId);
        return;
      }
      if (selectionType === 'hotspot') {
        scene.hotspots = (scene.hotspots || []).filter((entry) => !activeHotspotIds.includes(entry.id));
      }
    });
    if (selectionType === 'sceneObject') {
      setSelectedSceneObjectId('');
      setSelectedSceneObjectIds([]);
      return;
    }
    if (selectionType === 'visualEffectZone') {
      setSelectedVisualEffectZoneId('');
      return;
    }
    if (selectionType === 'hotspot') {
      setSelectedHotspotId('');
      setSelectedHotspotIds([]);
    }
  };

  const patchLayerItem = (type, id, updater) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      const list = type === 'hotspot' ? scene.hotspots : (scene.sceneObjects || []);
      const item = list.find((entry) => entry.id === id);
      if (item) updater(item);
    });
  };

  const nudgeLayerZIndex = (type, id, direction) => {
    patchLayerItem(type, id, (item) => {
      item.zIndex = getLayerZIndex(item, type) + direction;
    });
  };

  const sendLayerToEdge = (type, id, edge) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      const allLayers = [
        ...(scene.sceneObjects || []).map((entry) => ({ entry, type: 'sceneObject' })),
        ...(scene.hotspots || []).map((entry) => ({ entry, type: 'hotspot' })),
      ];
      const target = allLayers.find((layer) => layer.type === type && layer.entry.id === id)?.entry;
      if (!target) return;
      const zValues = allLayers.map((layer) => getLayerZIndex(layer.entry, layer.type));
      target.zIndex = edge === 'front' ? Math.max(...zValues, 0) + 1 : Math.min(...zValues, 0) - 1;
    });
  };

  const alignSelectedEditorItems = (command) => {
    if (!selectedSceneId) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      const selection = getActiveEditorSelection(scene);
      if (selection.items.length < 2) return;

      if (command === 'same-size') {
        const reference = selection.items[0];
        selection.items.slice(1).forEach((entry) => {
          entry.width = reference.width;
          entry.height = reference.height;
        });
        return;
      }

      if (command === 'distribute-horizontal') {
        if (selection.items.length < 3) return;
        const sorted = [...selection.items].sort((a, b) => a.x - b.x);
        const firstX = sorted[0].x;
        const lastX = sorted[sorted.length - 1].x;
        const step = (lastX - firstX) / (sorted.length - 1);
        sorted.forEach((entry, index) => {
          entry.x = Number(clampPercent(snapValue(firstX + step * index)).toFixed(2));
        });
        return;
      }

      if (command === 'left') {
        const left = Math.min(...selection.items.map((entry) => entry.x - entry.width / 2));
        selection.items.forEach((entry) => {
          entry.x = Number(clampPercent(snapValue(left + entry.width / 2)).toFixed(2));
        });
        return;
      }

      if (command === 'center') {
        const center = selection.items.reduce((sum, entry) => sum + entry.x, 0) / selection.items.length;
        selection.items.forEach((entry) => {
          entry.x = Number(clampPercent(snapValue(center)).toFixed(2));
        });
        return;
      }

      if (command === 'right') {
        const right = Math.max(...selection.items.map((entry) => entry.x + entry.width / 2));
        selection.items.forEach((entry) => {
          entry.x = Number(clampPercent(snapValue(right - entry.width / 2)).toFixed(2));
        });
      }
    });
  };

  useEffect(() => {
    if (!selectedSceneId) return undefined;

    const handleEditorKeyDown = (event) => {
      if (shouldIgnoreEditorShortcut(event)) return;
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (key === 'd') {
          event.preventDefault();
          duplicateSelectedEditorItems();
          return;
        }
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) redoProjectChange?.();
          else undoProjectChange?.();
          return;
        }
        if (key === 'y') {
          event.preventDefault();
          redoProjectChange?.();
          return;
        }
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (key === 'escape') {
        if (isEditorFullscreen) {
          event.preventDefault();
          closeEditorFullscreen();
        }
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        if (!activeSelectionCount) return;
        event.preventDefault();
        deleteSelectedEditorItems();
        return;
      }

      if (key === 'g') {
        event.preventDefault();
        setSnapGridEnabled((value) => !value);
        return;
      }

      if (key === 'm') {
        event.preventDefault();
        setMultiSelectEnabled((value) => !value);
        return;
      }

      if ((event.key === '+' || event.key === '=' || event.key === '-') && isEditorFullscreen) {
        event.preventDefault();
        setClampedFullscreenZoom((value) => value + (event.key === '-' ? -0.1 : 0.1));
      }
    };

    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, [
    selectedSceneId,
    isEditorFullscreen,
    activeSelectionCount,
    selectedEditorType,
    activeHotspotIds,
    activeSceneObjectIds,
    undoProjectChange,
    redoProjectChange,
    patchProject,
  ]);

  return {
    duplicateSelectedEditorItems,
    deleteSelectedEditorItems,
    alignSelectedEditorItems,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  };
}

export default function ScenesTab(props) {
  const {
    project,
    actsWithScenes,
    addAct,
    deleteAct,
    addScene,
    addItem,
    selectedItemId,
    setSelectedItemId,
    selectedItem,
    selectedScene,
    selectedSceneId,
    setSelectedSceneId,
    setTab,
    deleteScene,
    previewScene,
    patchProject,
    rememberProjectState,
    undoProjectChange,
    redoProjectChange,
    canUndoProjectChange,
    canRedoProjectChange,
    selectedHotspotId,
    setSelectedHotspotId,
    handleUpload,
    mediaLibrary = [],
    getActById,
    getSceneById,
    getSceneDepth,
    addSubsceneToSelectedScene,
    childScenes,
    addHotspot,
    selectedHotspot,
    deleteItem,
    deleteHotspot,
    getSceneLabel,
    collapsedNavigationActIds,
    setNavigationActCollapsed,
    collapsedNavigationSceneIds,
    toggleNavigationSceneCollapsed,
  } = props;

  const canvasRef = useRef(null);
  const fullscreenViewportRef = useRef(null);
  const fullscreenCanvasRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [snapGridEnabled, setSnapGridEnabled] = useState(false);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [isMiniMapCollapsed, setIsMiniMapCollapsed] = useState(false);
  const [conversationEditorOpen, setConversationEditorOpen] = useState(false);
  useEffect(() => {
    const rawFocus = window.sessionStorage.getItem('adventureConversationFocus');
    if (!rawFocus || !selectedHotspotId) return;
    try {
      const focus = JSON.parse(rawFocus);
      if (focus?.hotspotId === selectedHotspotId) {
        setConversationEditorOpen(true);
      }
    } catch {
      window.sessionStorage.removeItem('adventureConversationFocus');
    }
  }, [selectedHotspotId]);

  useEffect(() => {
    if (!conversationEditorOpen) return;
    const rawFocus = window.sessionStorage.getItem('adventureConversationFocus');
    if (!rawFocus) return;
    let focus = null;
    try {
      focus = JSON.parse(rawFocus);
    } catch {
      window.sessionStorage.removeItem('adventureConversationFocus');
      return;
    }
    if (focus?.hotspotId !== selectedHotspotId || !focus.replyId) return;
    window.setTimeout(() => {
      document.querySelector(`[data-conversation-reply-id="${focus.replyId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.sessionStorage.removeItem('adventureConversationFocus');
    }, 80);
  }, [conversationEditorOpen, selectedHotspotId]);
  const {
    isEditorFullscreen,
    fullscreenZoom,
    fullscreenPan,
    minimapViewport,
    isPanningFullscreen,
    setClampedFullscreenZoom,
    enterEditorFullscreen,
    closeEditorFullscreen,
    resetFullscreenView,
    handleFullscreenWheel,
    beginFullscreenPan,
    moveFullscreenPan,
    stopFullscreenPan,
  } = useSceneFullscreenEditor({
    fullscreenViewportRef,
    fullscreenCanvasRef,
  });
  const {
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    selectedVisualEffectZoneId,
    setSelectedVisualEffectZoneId,
    selectedHotspotIds,
    setSelectedHotspotIds,
    selectedSceneObjectIds,
    setSelectedSceneObjectIds,
    activeHotspotIds,
    activeSceneObjectIds,
    activeVisualEffectZoneIds,
    activeSelectionCount,
    selectHotspot,
    selectSceneObject,
    selectVisualEffectZone,
  } = useSceneEditorSelection({
    dragMovedRef,
    multiSelectEnabled,
    selectedHotspotId,
    setSelectedHotspotId,
    setSelectedItemId,
  });

  const selectedEditorType = activeVisualEffectZoneIds.length ? 'visualEffectZone' : (activeSceneObjectIds.length ? 'sceneObject' : (activeHotspotIds.length ? 'hotspot' : ''));
  const snapValue = (value) => (snapGridEnabled ? Math.round(value / 5) * 5 : value);
  const isBeginnerMode = project.creationMode === 'beginner';
  const isIntermediateMode = project.creationMode === 'intermediate';
  const canUseQuickLogic = !isBeginnerMode && !isIntermediateMode;
  const selectedHotspotActionType = selectedHotspot?.actionType || 'dialogue';
  const displayedHotspotActionType = isBeginnerMode && !BEGINNER_HOTSPOT_ACTION_TYPES.has(selectedHotspotActionType)
    ? 'dialogue'
    : selectedHotspotActionType;
  const isHeroAdventureProject = project.creationMode === 'hero_adventure' || Boolean(project.heroAdventure?.enabled);
  const heroSkills = project.heroAdventure?.hero.skills?.length ? project.heroAdventure.hero.skills : FALLBACK_HERO_SKILLS;
  const renderSkillCheckFields = (entry, updateEntry, { conversationNodes = [] } = {}) => (
    <div className="nested-editor-card hero-skill-check-editor">
      <HelpLabel help="Compétence utilisée par le jet automatique en Preview. Le joueur clique la zone ou la réponse, puis le jeu lance le dé et ajoute ce bonus.">Compétence testée</HelpLabel>
      <select value={entry.skillCheckSkillId || heroSkills[0]?.id || ''} onChange={(event) => updateEntry((target) => {
        target.skillCheckSkillId = event.target.value;
      })}>
        {heroSkills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.name} {Number(skill.value) >= 0 ? '+' : ''}{Number(skill.value) || 0}
            {skill.manaCost ? ` - ${skill.manaCost} mana` : ''}
          </option>
        ))}
      </select>

      <HelpLabel help="Seuil à atteindre avec dé + bonus. Exemple : difficulté 12, Force +3, jet 9 donne 12 et réussit.">Difficulté</HelpLabel>
      <NumberInput
        min="1"
        max="99"
        value={entry.skillCheckDifficulty || 12}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.skillCheckDifficulty = nextValue;
        })}
      />

                  <HelpLabel help="Mana retirée avant le jet. Si le héros n'a pas assez de mana, le test ne se lance pas et affiche Mana insuffisante.">Coût mana du test</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.skillCheckManaCost ?? heroSkills.find((skill) => skill.id === (entry.skillCheckSkillId || heroSkills[0]?.id || ''))?.manaCost ?? 0}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.skillCheckManaCost = nextValue;
        })}
      />

                  <HelpLabel help="Texte ajouté au résultat du jet quand le total atteint ou dépasse la difficulté. Exemple : Tu franchis le pont.">Message de réussite</HelpLabel>
      <textarea value={entry.skillCheckSuccessDialogue || ''} placeholder="Tu reussis le test." onChange={(event) => updateEntry((target) => {
        target.skillCheckSuccessDialogue = event.target.value;
      })} />

      {conversationNodes.length ? (
        <>
          <HelpLabel help="Dans une conversation, question ouverte après une réussite. Laisse Fin si le test doit fermer la conversation.">Question après réussite</HelpLabel>
          <select value={entry.skillCheckSuccessNextNodeId || ''} onChange={(event) => updateEntry((target) => {
            target.skillCheckSuccessNextNodeId = event.target.value;
          })}>
            <option value="">Fin</option>
            {conversationNodes.map((node) => (
              <option key={node.id} value={node.id}>{node.speaker || 'PNJ'} - {(node.text || 'Question').slice(0, 40)}</option>
            ))}
          </select>
        </>
      ) : null}

      <HelpLabel help="Scène ouverte si le test réussit. Laisse vide pour rester dans la scène actuelle ou seulement afficher le message.">Scène de réussite</HelpLabel>
      <select value={entry.skillCheckSuccessTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.skillCheckSuccessTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scène</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>

      <HelpLabel help="Texte ajouté au résultat du jet quand le total est inférieur à la difficulté. Indique clairement la conséquence.">Message d'échec</HelpLabel>
      <textarea value={entry.skillCheckFailureDialogue || ''} placeholder="Tu rates le test." onChange={(event) => updateEntry((target) => {
        target.skillCheckFailureDialogue = event.target.value;
      })} />

      {conversationNodes.length ? (
        <>
          <HelpLabel help="Dans une conversation, question ouverte après un échec. Utile pour proposer payer un coût, rebrousser chemin ou demander de l'aide.">Question après échec</HelpLabel>
          <select value={entry.skillCheckFailureNextNodeId || ''} onChange={(event) => updateEntry((target) => {
            target.skillCheckFailureNextNodeId = event.target.value;
          })}>
            <option value="">Fin</option>
            {conversationNodes.map((node) => (
              <option key={node.id} value={node.id}>{node.speaker || 'PNJ'} - {(node.text || 'Question').slice(0, 40)}</option>
            ))}
          </select>
        </>
      ) : null}

      <HelpLabel help="Scène ouverte si le test échoue. Laisse vide si l'échec doit seulement afficher un message ou retirer des PV.">Scène d'échec</HelpLabel>
      <select value={entry.skillCheckFailureTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.skillCheckFailureTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scène</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>

                    <HelpLabel help="PV retirés au héros en cas d'échec. Évite une valeur égale ou supérieure aux PV max sauf si tu veux une défaite immédiate.">Perte de PV en échec</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.skillCheckFailureHealthLoss || 0}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.skillCheckFailureHealthLoss = nextValue;
        })}
      />

      <HelpLabel help="Objet ajouté à l'inventaire uniquement si le test réussit. Peut être un indice, une clé ou un objet héros comme une potion.">Objet gagne en réussite</HelpLabel>
      <select value={entry.skillCheckSuccessRewardItemId || ''} onChange={(event) => updateEntry((target) => {
        target.skillCheckSuccessRewardItemId = event.target.value;
      })}>
        <option value="">Aucun objet</option>
        {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
      </select>
    </div>
  );
  const renderHeroCombatFields = (entry, updateEntry) => (
    <div className="nested-editor-card hero-skill-check-editor">
      <HelpLabel help="Nom utilise dans les messages de combat en Preview. Exemple : Garde spectral ou Araignee geante.">Ennemi</HelpLabel>
      <input value={entry.combatEnemyName || ''} placeholder="Garde spectral" onChange={(event) => updateEntry((target) => {
        target.combatEnemyName = event.target.value;
      })} />

      <HelpLabel help="PV de départ de cet ennemi. Chaque clic de combat garde les PV restants jusqu'a victoire, reset Preview ou chargement.">PV ennemi</HelpLabel>
      <NumberInput
        min="1"
        max="999"
        value={entry.combatEnemyMaxHealth || 8}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatEnemyMaxHealth = nextValue;
        })}
      />

      <HelpLabel help="Compétence ajoutée au jet d'attaque. Le combat lance automatiquement le dé quand le joueur clique cette zone.">Compétence d'attaque</HelpLabel>
      <select value={entry.combatSkillId || heroSkills[0]?.id || ''} onChange={(event) => updateEntry((target) => {
        target.combatSkillId = event.target.value;
      })}>
        {heroSkills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.name} {Number(skill.value) >= 0 ? '+' : ''}{Number(skill.value) || 0}
          </option>
        ))}
      </select>

                <HelpLabel help="Seuil à atteindre avec dé + bonus pour toucher. Si le total est plus bas, l'attaque rate et l'ennemi peut riposter.">Difficulté pour toucher</HelpLabel>
      <NumberInput
        min="1"
        max="99"
        value={entry.combatAttackDifficulty || 10}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatAttackDifficulty = nextValue;
        })}
      />

                <HelpLabel help="PV retirés au héros si l'ennemi survit après l'attaque. Mets 0 pour un obstacle sans riposte.">Dégâts ennemis</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.combatEnemyStrength ?? entry.combatEnemyDamage ?? 2}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatEnemyStrength = nextValue;
          target.combatEnemyDamage = nextValue;
        })}
      />

                <HelpLabel help="Mana retirée à chaque tentative d'attaque. Si le héros n'a pas assez de mana, le combat ne lance pas le jet.">Coût mana par attaque</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.combatManaCost || 0}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatManaCost = nextValue;
        })}
      />

      <HelpLabel help="Texte ajouté quand l'ennemi tombe à 0 PV, avant de donner la récompense ou changer de scène.">Message de victoire</HelpLabel>
      <textarea value={entry.combatVictoryDialogue || ''} placeholder="L'ennemi s'effondre." onChange={(event) => updateEntry((target) => {
        target.combatVictoryDialogue = event.target.value;
      })} />

      <HelpLabel help="Texte ajouté si la riposte fait tomber le héros à 0 PV. Tu peux aussi envoyer vers une scène de défaite.">Message de défaite</HelpLabel>
      <textarea value={entry.combatDefeatDialogue || ''} placeholder="Tu n'as plus la force de continuer." onChange={(event) => updateEntry((target) => {
        target.combatDefeatDialogue = event.target.value;
      })} />

      <HelpLabel help="Objet ajouté à l'inventaire quand l'ennemi est vaincu. Optionnel : laisse Aucun si la victoire ouvre seulement une scène.">Récompense</HelpLabel>
      <select value={entry.combatRewardItemId || ''} onChange={(event) => updateEntry((target) => {
        target.combatRewardItemId = event.target.value;
      })}>
        <option value="">Aucun objet</option>
        {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
      </select>

      <HelpLabel help="Scène ouverte après la victoire. Laisse vide pour rester sur place avec l'ennemi marqué comme vaincu.">Scène de victoire</HelpLabel>
      <select value={entry.combatVictoryTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.combatVictoryTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scène</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>

      <HelpLabel help="Scène ouverte si le héros tombe à 0 PV pendant ce combat. Laisse vide pour afficher seulement le message de défaite.">Scène de défaite</HelpLabel>
      <select value={entry.combatDefeatTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.combatDefeatTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scène</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>
    </div>
  );
  const renderHeroMalusFields = (entry, updateEntry) => {
    if (!isHeroAdventureProject) return null;
    return (
      <div className="nested-editor-card hero-skill-check-editor">
        <HelpLabel help="Conséquences appliquées dès que le joueur prend ce choix ou cette zone. À utiliser pour un mauvais chemin, un piège, une erreur de confiance ou une route dangereuse. Mets 0 partout pour aucun malus.">Malus mauvais chemin</HelpLabel>
        <div className="form-grid compact-grid">
          <label>
            <span>PV perdus</span>
            <NumberInput
              min="0"
              max="99"
              value={entry.heroMalusHealthLoss || 0}
              onValueChange={(nextValue) => updateEntry((target) => {
                target.heroMalusHealthLoss = nextValue;
              })}
            />
          </label>
          <label>
            <span>Mana perdue</span>
            <NumberInput
              min="0"
              max="99"
              value={entry.heroMalusManaLoss || 0}
              onValueChange={(nextValue) => updateEntry((target) => {
                target.heroMalusManaLoss = nextValue;
              })}
            />
          </label>
        </div>
        <HelpLabel help="Texte affiché avec la perte de PV ou de mana. Exemple : Le sentier s'effondre sous tes pas.">Message du malus</HelpLabel>
        <textarea
          value={entry.heroMalusMessage || ''}
          placeholder="Le mauvais chemin te coute de l'energie."
          onChange={(event) => updateEntry((target) => {
            target.heroMalusMessage = event.target.value;
          })}
        />
      </div>
    );
  };
  const openMediaTab = () => setTab?.('media');
  const handleSceneImagePlaceholderKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openMediaTab();
  };
  const {
    quickLogicTarget,
    setQuickLogicTarget,
    selectedSceneObject,
    selectedVisualEffectZone,
    sceneAspectRatio,
    getLinkedItem,
    getSceneObjectDisplayImage,
    openQuickLogicForTarget,
    importSceneObjectAnime2d,
    toggleSceneChildren,
    selectSceneFromTree,
    selectSceneInFullscreen,
    selectActInFullscreen,
    rememberSceneBackgroundAspectRatio,
    updateSceneBackground,
  } = useSceneEditorSceneState({
    project,
    selectedScene,
    selectedSceneId,
    selectedSceneObjectId,
    selectedVisualEffectZoneId,
    selectedHotspotId,
    setSelectedSceneId,
    setSelectedHotspotId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    setSelectedItemId,
    patchProject,
    toggleNavigationSceneCollapsed,
  });

  const {
    getEditorElementByType,
    getAbsoluteShapeCorners,
    getAbsoluteShapePoints,
    applyShapePoints,
    renderShapeOutline,
    getShapeClassName,
    getResizeHandleStyle,
    renderShapeControls,
  } = useSceneEditorShapes({
    selectedScene,
    selectedSceneId,
    patchProject,
    isBeginnerMode,
  });

  const {
    draggingHotspotId,
    draggingSceneObjectId,
    draggingVisualEffectZoneId,
    isDragLocked,
    beginDrag,
    beginObjectDrag,
    beginVisualEffectZoneDrag,
    stopDragging,
    beginResize,
    stopResizing,
    updateHotspotPosition,
    updateElementSize,
    renderResizeHandles,
    renderShapePointHandles,
  } = useSceneEditorDragResize({
    canvasRef,
    fullscreenCanvasRef,
    dragMovedRef,
    selectedScene,
    selectedSceneId,
    selectedHotspotIds,
    selectedSceneObjectIds,
    multiSelectEnabled,
    patchProject,
    rememberProjectState,
    snapValue,
    setSelectedHotspotId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedItemId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    getEditorElementByType,
    getAbsoluteShapeCorners,
    getAbsoluteShapePoints,
    applyShapePoints,
    getResizeHandleStyle,
  });

  const {
    addSceneObject,
    addInvisibleSceneObject,
    addAnimationObject,
    addInteractiveBlock,
    addVisualEffectZone,
  } = useSceneEditorCreation({
    project,
    selectedSceneId,
    selectedItem,
    selectedItemId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedHotspotId,
    setSelectedItemId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    patchProject,
  });

  const {
    duplicateSelectedEditorItems,
    deleteSelectedEditorItems,
    alignSelectedEditorItems,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  } = useSceneEditorCommands({
    selectedSceneId,
    activeSelectionCount,
    selectedEditorType,
    activeHotspotIds,
    activeSceneObjectIds,
    selectedVisualEffectZoneId,
    setSelectedHotspotId,
    setSelectedHotspotIds,
    setSelectedSceneObjectId,
    setSelectedSceneObjectIds,
    setSelectedVisualEffectZoneId,
    patchProject,
    snapValue,
    isEditorFullscreen,
    closeEditorFullscreen,
    setClampedFullscreenZoom,
    setSnapGridEnabled,
    setMultiSelectEnabled,
    undoProjectChange,
    redoProjectChange,
  });

  const editorToolbarProps = {
    selectedSceneId,
    previewScene,
    deleteScene,
    closeEditorFullscreen,
    undoProjectChange,
    redoProjectChange,
    canUndoProjectChange,
    canRedoProjectChange,
    duplicateSelectedEditorItems,
    activeSelectionCount,
    multiSelectEnabled,
    setMultiSelectEnabled,
    deleteSelectedEditorItems,
    alignSelectedEditorItems,
    enterEditorFullscreen,
    setFullscreenZoom: setClampedFullscreenZoom,
    clampFullscreenZoom,
    resetFullscreenView,
    snapGridEnabled,
    setSnapGridEnabled,
    addHotspot,
    addSceneObject,
    addAnimationObject,
    addInvisibleSceneObject,
    addInteractiveBlock,
    addVisualEffectZone,
    isBeginnerMode,
    isIntermediateMode,
  };

  const layersPanelProps = {
    selectedScene,
    activeSceneObjectIds,
    activeHotspotIds,
    setSelectedSceneObjectId,
    setSelectedSceneObjectIds,
    setSelectedHotspotId,
    setSelectedHotspotIds,
    setSelectedItemId,
    getLayerZIndex,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  };

  const miniMapProps = {
    selectedScene,
    activeSceneObjectIds,
    activeHotspotIds,
    minimapViewport,
    clampPercent,
    isCollapsed: isMiniMapCollapsed,
    setIsCollapsed: setIsMiniMapCollapsed,
  };

  return (
    <div className="layout scenes-layout-pro ultra-editor">
      <SceneSidebar
        project={project}
        actsWithScenes={actsWithScenes}
        addAct={addAct}
        deleteAct={deleteAct}
        addScene={addScene}
        selectedSceneId={selectedSceneId}
        collapsedActIds={collapsedNavigationActIds}
        setActCollapsed={setNavigationActCollapsed}
        collapsedSceneIds={collapsedNavigationSceneIds}
        toggleSceneChildren={toggleSceneChildren}
        selectSceneFromTree={selectSceneFromTree}
      />

      <section className="panel main panel-main-pro">
        <div className="panel-head panel-main-header">
          <div>
            <span className="section-kicker">Édition</span>
            <h2>Éditeur de scène</h2>
          </div>
          {selectedScene ? <span className="status-badge soft">{getActById(selectedScene.actId)?.name || 'Sans acte'}</span> : null}
        </div>

        {selectedScene ? (
          <div className="editor-stack">
            <div className="subpanel scene-compact-card">
                <div className="subpanel-head">
                  <h3>Général & structure</h3>
                  <div className="inline-actions end">
                    <button type="button" className="secondary-action" data-tour="scene-preview-button" onClick={() => previewScene?.(selectedSceneId)}>
                      Prévisualiser
                    </button>
                    <button type="button" className="danger-button" onClick={() => deleteScene(selectedSceneId)}>
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="scene-compact-grid">
                  <div data-tour="scene-name">
                    <HelpLabel help="Nom affiché dans la navigation de l’éditeur et dans les listes de choix. Garde-le court si plusieurs scènes se ressemblent.">Nom de la scène</HelpLabel>
                    <input value={selectedScene.name} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.name = e.target.value;
                    })} />
                  </div>
                  <div data-tour="scene-act">
                    <HelpLabel help="Regroupe la scène dans un chapitre. Changer d’acte peut retirer une scène parente qui n’appartient plus au même acte.">Acte</HelpLabel>
                    <select value={selectedScene.actId} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                      if (scene) {
                        scene.actId = e.target.value;
                        if (scene.parentSceneId) {
                          const parent = draft.scenes.find((s) => s.id === scene.parentSceneId);
                          if (parent && parent.actId !== e.target.value) scene.parentSceneId = '';
                        }
                      }
                    })}>
                      {project.acts.map((act) => <option key={act.id} value={act.id}>{act.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help="Transforme cette scène en sous-scène d’une autre. Utile pour les gros plans, tiroirs, portes ou variantes d’une même pièce.">Scène parente</HelpLabel>
                    <select value={selectedScene.parentSceneId} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.parentSceneId = e.target.value;
                    })}>
                      <option value="">Scène principale</option>
                      {project.scenes.filter((scene) => scene.id !== selectedSceneId && scene.actId === selectedScene.actId).map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneDepth(scene) ? '— '.repeat(getSceneDepth(scene)) : ''}{scene.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="scene-intro-field" data-tour="scene-intro">
                    <HelpLabel help="Texte montré à l’entrée de la scène, avant que le joueur interagisse. Sert à poser l’ambiance ou l’objectif local.">Texte d’introduction</HelpLabel>
                    <input value={selectedScene.introText} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.introText = e.target.value;
                    })} />
                  </div>
                </div>
              </div>

            <div className="subpanel canvas-subpanel">
              <div className="subpanel-head">
                <div>
                  <h3>Plan de scène</h3>
                </div>
                <div className="editor-toolbar-wrap">
                  <EditorToolbarMenus {...editorToolbarProps} />
                </div>
              </div>

              <div className="preview-editor" data-tour="scene-canvas">
                <div className="scene-canvas-column">
                  <div
                    ref={canvasRef}
                    className="editor-canvas editor-canvas-pro"
                    style={{ aspectRatio: sceneAspectRatio }}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                  >
                  {selectedScene.backgroundData ? <img src={selectedScene.backgroundData} alt="fond" onLoad={(event) => rememberSceneBackgroundAspectRatio(event.currentTarget)} /> : (
                    <div
                      className="placeholder scene-media-link-placeholder"
                      role="button"
                      tabIndex={0}
                      onClick={openMediaTab}
                      onKeyDown={handleSceneImagePlaceholderKeyDown}
                    >
                      Ajoute une image de scène
                    </div>
                  )}
                  <SceneVisualEffect effect={selectedScene.visualEffect} intensity={selectedScene.visualEffectIntensity} />
                  {(selectedScene.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      data-tour={zone.tutorialCreated ? 'visual-zone-on-canvas' : undefined}
                      className={`editor-hotspot editor-visual-zone ${getShapeClassName(zone)} ${zone.id === selectedVisualEffectZoneId ? 'selected' : ''} ${zone.id === draggingVisualEffectZoneId ? 'dragging' : ''}`}
                      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, zIndex: getVisualEffectZoneZIndex(zone.layer), ...getElementShapeStyle(zone) }}
                      onPointerDown={(event) => beginVisualEffectZoneDrag(event, zone.id)}
                      onClick={() => selectVisualEffectZone(zone.id)}
                    >
                      <SceneVisualEffect effect={zone.effect} intensity={zone.intensity} />
                      <span>{zone.name}</span>
                      {renderShapeOutline(zone, zone.id === selectedVisualEffectZoneId)}
                      {renderResizeHandles('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId)}
                      {renderShapePointHandles('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId)}
                    </button>
                  ))}
                  {snapGridEnabled ? <div style={gridOverlayStyle} /> : null}
                  {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      data-tour={obj.tutorialCreated ? 'scene-object-on-canvas' : undefined}
                      className={`editor-hotspot editor-scene-object ${getShapeClassName(obj)} ${obj.isInvisible ? 'editor-scene-object-invisible' : ''} ${(obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id)) ? 'selected' : ''} ${obj.id === draggingSceneObjectId ? 'dragging' : ''}`}
                      style={getSceneObjectStyle(obj)}
                      onPointerDown={(event) => beginObjectDrag(event, obj.id)}
                      onClick={(event) => selectSceneObject(obj.id, event)}
                    >
                      {obj.anime2dSpec && !obj.isInvisible ? (
                        <Anime2DPreview spec={obj.anime2dSpec} />
                      ) : !obj.isInvisible ? (
                        <SceneObjectBlockContent object={obj} displayImage={getSceneObjectDisplayImage(obj)} linkedItem={getLinkedItem(obj.linkedItemId)} />
                      ) : <span>{`${obj.name || 'Objet'} (invisible)`}</span>}
                      {renderShapeOutline(obj, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id))}
                      {renderResizeHandles('sceneObject', obj.id, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id))}
                      {renderShapePointHandles('sceneObject', obj.id, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id))}
                    </button>
                  ))}
                  {selectedScene.hotspots.filter((spot) => !spot.isHidden).map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      data-tour={spot.tutorialCreated ? 'hotspot-on-canvas' : undefined}
                      className={`editor-hotspot ${getShapeClassName(spot)} ${(spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id)) ? 'selected' : ''} ${spot.id === draggingHotspotId ? 'dragging' : ''}`}
                      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot'), ...getElementShapeStyle(spot) }}
                      onPointerDown={(event) => beginDrag(event, spot.id)}
                      onClick={(event) => selectHotspot(spot.id, event)}
                    >
                      <span>{spot.name}</span>
                      {renderShapeOutline(spot, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id))}
                      {renderResizeHandles('hotspot', spot.id, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id))}
                      {renderShapePointHandles('hotspot', spot.id, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id))}
                    </button>
                  ))}
                  </div>
                  {selectedHotspot && selectedHotspot.actionType !== 'conversation' ? (
                    <HotspotAssetsPanel
                      selectedHotspot={selectedHotspot}
                      selectedSceneId={selectedSceneId}
                      selectedHotspotId={selectedHotspotId}
                      patchProject={patchProject}
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      className="hotspot-assets-below-canvas"
                    />
                  ) : null}
                </div>
                <section className="panel side panel-context-pro side-editor side-editor-pro" data-tour="selected-zone-panel" style={{ margin: 0, overflow: 'auto' }}>
                  <div className="panel-head panel-head-stack">
                    <div>
                      <span className="section-kicker">Contexte</span>
                      <h2>{selectedSceneObject ? ((selectedSceneObject.anime2dSpec || selectedSceneObject.anime2dName || selectedSceneObject.name === 'Animation') ? 'Animation selectionnée' : selectedSceneObject.isInvisible ? 'Objet invisible selectionné' : (getSceneObjectClickMode(selectedSceneObject) === 'action' ? "Zone d'action selectionnée" : 'Objet visible selectionné')) : selectedVisualEffectZone ? 'Zone visuelle selectionnée' : 'Zone selectionnée'}</h2>
                    </div>
                  </div>

                  {false ? (
                    <>
                      <div className="icon-preview inventory-object-preview">{selectedItem.imageData ? <img src={selectedItem.imageData} alt={selectedItem.name} /> : <span>{selectedItem.icon || '📦'}</span>}</div>
                      <HelpLabel help="Nom de l’objet dans l’inventaire. C’est le libellé que le joueur voit lorsqu’il obtient ou consulte cet objet.">Nom de l’objet</HelpLabel>
                      <input data-tour="object-name" value={selectedItem.name} onChange={(e) => patchProject((draft) => {
                        const item = draft.items.find((entry) => entry.id === selectedItemId);
                        if (item) item.name = e.target.value;
                      })} />
                      <HelpLabel help="Image utilisée comme miniature d’inventaire. Si elle est absente, l’emoji de secours est utilisé à la place.">Image de l’objet</HelpLabel>
                      <MediaSourcePicker
                        className="button like full secondary-action"
                        accept="image/*"
                        handleUpload={handleUpload}
                        mediaLibrary={mediaLibrary}
                        onSelect={(data, name) => patchProject((draft) => {
                          const item = draft.items.find((entry) => entry.id === selectedItemId);
                          if (item) {
                            item.imageData = data;
                            item.imageName = name;
                          }
                        })}
                        tourId="object-image"
                      >
                        {selectedItem.imageName || 'Importer une image objet'}
                      </MediaSourcePicker>
                      <HelpLabel help="Symbole affiché quand aucune image d’inventaire n’est fournie, ou comme repère visuel léger dans les listes.">Emoji de secours</HelpLabel>
                      <input value={selectedItem.icon} onChange={(e) => patchProject((draft) => {
                        const item = draft.items.find((entry) => entry.id === selectedItemId);
                        if (item) item.icon = e.target.value;
                      })} />
                      {isHeroAdventureProject ? (
                      <div className="nested-editor-card hero-skill-check-editor">
                        <HelpLabel help="Effet applique en Preview quand le joueur clique cet objet dans l'inventaire. Aucun effet garde l'objet comme indice classique.">Effet héros</HelpLabel>
                        <select value={selectedItem.heroItemType || 'none'} onChange={(event) => patchProject((draft) => {
                          const item = draft.items.find((entry) => entry.id === selectedItemId);
                          if (!item) return;
                          item.heroItemType = event.target.value;
                          if (event.target.value === 'health_potion') {
                            item.heroItemAmount = item.heroItemAmount || 4;
                            item.heroItemConsumeOnUse = item.heroItemConsumeOnUse ?? true;
                          }
                          if (event.target.value === 'mana_potion') {
                            item.heroItemAmount = item.heroItemAmount || 3;
                            item.heroItemConsumeOnUse = item.heroItemConsumeOnUse ?? true;
                          }
                          if (event.target.value === 'equipment') {
                            item.heroItemBonus = item.heroItemBonus || 1;
                            item.heroItemBonusTarget = item.heroItemBonusTarget || 'skill';
                            item.heroItemSkillId = item.heroItemSkillId || heroSkills[0]?.id || '';
                            item.heroItemConsumeOnUse = false;
                          }
                        })}>
                          <option value="none">Aucun effet</option>
                          <option value="health_potion">Potion de soin</option>
                          <option value="mana_potion">Potion de mana</option>
                          <option value="equipment">Equipement avec bonus</option>
                        </select>

                        {['health_potion', 'mana_potion'].includes(selectedItem.heroItemType || 'none') ? (
                          <>
              <HelpLabel help="Nombre de PV ou de mana rendus. La jauge ne dépasse jamais le maximum configuré dans l'onglet Héros.">Quantité restaurée</HelpLabel>
                            <NumberInput
                              min="1"
                              max="99"
                              value={selectedItem.heroItemAmount || 4}
                              onValueChange={(nextValue) => patchProject((draft) => {
                                const item = draft.items.find((entry) => entry.id === selectedItemId);
                                if (item) item.heroItemAmount = nextValue;
                              })}
                            />
                            <label className="checkbox-row">
                              <input
                                type="checkbox"
                                checked={selectedItem.heroItemConsumeOnUse ?? true}
                                onChange={(event) => patchProject((draft) => {
                                  const item = draft.items.find((entry) => entry.id === selectedItemId);
                                  if (item) item.heroItemConsumeOnUse = event.target.checked;
                                })}
                              />
                              Consommer après utilisation
                            </label>
                          </>
                        ) : null}

                        {(selectedItem.heroItemType || 'none') === 'equipment' ? (
                          <>
                            <HelpLabel help="Statistique augmentée quand le joueur équipe cet objet. Choisis une compétence pour les jets de dé, PV max pour rendre le héros plus résistant, ou mana max pour lancer plus de tests magiques.">Bonus appliqué à</HelpLabel>
                            <select value={selectedItem.heroItemBonusTarget || 'skill'} onChange={(event) => patchProject((draft) => {
                              const item = draft.items.find((entry) => entry.id === selectedItemId);
                              if (!item) return;
                              item.heroItemBonusTarget = event.target.value;
                              if (event.target.value === 'skill') item.heroItemSkillId = item.heroItemSkillId || heroSkills[0]?.id || '';
                            })}>
                              <option value="skill">Compétence</option>
                              <option value="maxHealth">Points de vie max</option>
                              <option value="maxMana">Mana max</option>
                            </select>
                            {(selectedItem.heroItemBonusTarget || 'skill') === 'skill' ? (
                              <>
                                <HelpLabel help="Compétence qui gagne le bonus quand le joueur équipe cet objet. L'équipement s'applique une seule fois par partie.">Compétence boostée</HelpLabel>
                                <select value={selectedItem.heroItemSkillId || heroSkills[0]?.id || ''} onChange={(event) => patchProject((draft) => {
                                  const item = draft.items.find((entry) => entry.id === selectedItemId);
                                  if (item) item.heroItemSkillId = event.target.value;
                                })}>
                                  {heroSkills.map((skill) => (
                                    <option key={skill.id} value={skill.id}>{skill.name}</option>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            <HelpLabel help="Valeur ajoutée à la statistique choisie, par exemple +1 Force, +3 PV max ou +2 mana max. Une valeur négative peut servir pour un objet maudit.">Bonus</HelpLabel>
                            <NumberInput
                              min="-20"
                              max="20"
                              value={selectedItem.heroItemBonus || 1}
                              onValueChange={(nextValue) => patchProject((draft) => {
                                const item = draft.items.find((entry) => entry.id === selectedItemId);
                                if (item) item.heroItemBonus = nextValue;
                              })}
                            />
                            <p className="small-note">En jeu, cet objet passe dans la zone <strong>Objets portes</strong> de la page personnage. Il ne reste pas affiche dans l'inventaire transporte.</p>
                          </>
                        ) : null}
                      </div>
                      ) : null}
                      <p className="small-note">Conseil : choisis une image lisible en petit format, avec un fond simple si possible.</p>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                        deleteItem(selectedItemId);
                        setSelectedItemId('');
                      }}>Supprimer l’objet</button>
                    </>
                  ) : selectedSceneObject ? (
                    <SceneObjectInspector
                      project={project}
                      selectedSceneId={selectedSceneId}
                      selectedSceneObject={selectedSceneObject}
                      selectedSceneObjectId={selectedSceneObjectId}
                      patchProject={patchProject}
                      renderShapeControls={renderShapeControls}
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      importSceneObjectAnime2d={importSceneObjectAnime2d}
                      getSceneLabel={getSceneLabel}
                      setSelectedSceneObjectId={setSelectedSceneObjectId}
                      onOpenLogic={() => openQuickLogicForTarget('sceneObject', selectedSceneObjectId)}
                    />
                  ) : selectedVisualEffectZone ? (
                    <>
                      <HelpLabel help="Nom interne de la zone visuelle. Il aide à la retrouver dans les calques et dans l'éditeur.">Nom</HelpLabel>
                      <input value={selectedVisualEffectZone.name} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.name = e.target.value;
                      })} />
                      <div className="grid-two small-gap">
                        <div><HelpLabel help="Position horizontale du centre de la zone, en pourcentage de la largeur de l'image.">X</HelpLabel><NumberInput value={selectedVisualEffectZone.x} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.x = nextValue; })} /></div>
                        <div><HelpLabel help="Position verticale du centre de la zone, en pourcentage de la hauteur de l'image.">Y</HelpLabel><NumberInput value={selectedVisualEffectZone.y} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.y = nextValue; })} /></div>
                        <div><HelpLabel help="Largeur de la zone d'effet, en pourcentage de la largeur de la scène.">Largeur</HelpLabel><NumberInput value={selectedVisualEffectZone.width} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.width = nextValue; })} /></div>
                        <div><HelpLabel help="Hauteur de la zone d'effet, en pourcentage de la hauteur de la scène.">Hauteur</HelpLabel><NumberInput value={selectedVisualEffectZone.height} onValueChange={(nextValue) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.height = nextValue; })} /></div>
                      </div>
                      {renderShapeControls('visualEffectZone', selectedVisualEffectZoneId)}
                      <HelpLabel help="Effet visuel applique uniquement dans cette zone. Ce menu reprend les mêmes familles que l'onglet Média.">Effet de zone</HelpLabel>
                      <div className="scene-zone-effect-picker" data-tour="visual-zone-effect">
                        <VisualEffectCascadeMenu
                          value={selectedVisualEffectZone.effect || 'sparkles'}
                          onChange={(nextEffect) => patchProject((draft) => {
                            const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                            if (zone) zone.effect = nextEffect;
                          })}
                        />
                      </div>
                      <HelpLabel help="Force de l'effet dans cette zone.">Intensite</HelpLabel>
                      <select value={selectedVisualEffectZone.intensity || 'normal'} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.intensity = e.target.value;
                      })}>
                        {VISUAL_EFFECT_INTENSITY_OPTIONS.map((intensity) => (
                          <option key={intensity.value} value={intensity.value}>{intensity.label}</option>
                        ))}
                      </select>
                      <HelpLabel help="Plan d'affichage de l'effet par rapport aux autres elements de la scène.">Calque</HelpLabel>
                      <select value={selectedVisualEffectZone.layer || 'behind'} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.layer = e.target.value;
                      })}>
                        <option value="behind">Arriere-plan</option>
                        <option value="between">Entre objets et zones</option>
                        <option value="front">Premier plan</option>
                      </select>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedVisualEffectZone.isHidden)}
                          onChange={(e) => patchProject((draft) => {
                            const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                            if (zone) zone.isHidden = e.target.checked;
                          })}
                        />
                        Masquer cette zone
                      </label>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={async () => {
                        const confirmed = await showConfirm({
                          title: 'Supprimer la zone visuelle',
                          message: `Supprimer la zone visuelle "${selectedVisualEffectZone.name}" ?`,
                          confirmLabel: 'Supprimer',
                          variant: 'danger',
                        });
                        if (!confirmed) return;
                        patchProject((draft) => {
                          const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                          if (!scene?.visualEffectZones) return;
                          scene.visualEffectZones = scene.visualEffectZones.filter((entry) => entry.id !== selectedVisualEffectZoneId);
                        });
                        setSelectedVisualEffectZoneId('');
                      }}>Supprimer la zone visuelle</button>
                    </>
                  ) : selectedHotspot ? (
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
                        <>
                          <div className="conversation-editor-backdrop" onClick={() => setConversationEditorOpen(false)} />
                          <div className="inspector-subpanel conversation-editor-modal">
                            <div className="panel-head">
                              <h3>Conversation</h3>
                              <div className="toolbar">
                              <button type="button" className="secondary-action" onClick={() => patchProject((draft) => {
                                const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                                if (!spot) return;
                                const nodeId = `node-${Math.random().toString(36).slice(2, 8)}`;
                                spot.conversation = spot.conversation || { startNodeId: nodeId, nodes: [] };
                                spot.conversation.nodes = [...(spot.conversation.nodes || []), { id: nodeId, speaker: 'PNJ', text: 'Nouvelle question.', replies: [] }];
                                spot.conversation.startNodeId = spot.conversation.startNodeId || nodeId;
                              })}>+ Question</button>
                              <button type="button" className="danger-button" onClick={() => setConversationEditorOpen(false)}>Fermer</button>
                              </div>
                            </div>
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
                                  {renderHeroMalusFields(reply, (updater) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) updater(targetReply);
                                  }))}
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
                                  {(reply.actionType || 'node') === 'skill_check' ? renderSkillCheckFields(reply, (updater) => patchProject((draft) => {
                                    const targetReply = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId)?.conversation?.nodes?.[nodeIndex]?.replies?.[replyIndex];
                                    if (targetReply) updater(targetReply);
                                  }), { conversationNodes: selectedHotspot.conversation?.nodes || [] }) : null}
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
                          </div>
                        </>
                      ) : null}
                      {displayedHotspotActionType !== 'conversation' ? (
                        <>
                          {!isBeginnerMode && selectedHotspot.actionType === 'skill_check' ? renderSkillCheckFields(selectedHotspot, (updater) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                            if (spot) updater(spot);
                          })) : null}
                          {!isBeginnerMode && selectedHotspot.actionType === 'hero_combat' ? renderHeroCombatFields(selectedHotspot, (updater) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                            if (spot) updater(spot);
                          })) : null}
                          {renderHeroMalusFields(selectedHotspot, (updater) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                            if (spot) updater(spot);
                          }))}
                          <HelpLabel help="Texte affiché lors de l’interaction principale. Il peut donner une réaction, un indice ou confirmer une action réussie.">Dialogue</HelpLabel>
                          <textarea data-tour="hotspot-dialogue" value={selectedHotspot.dialogue} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.dialogue = e.target.value;
                          })} />
                          <HelpLabel help="Destination utilisée si l’action est “Changer de scène”. Laisse vide si la zone doit seulement parler ou donner un objet.">Scène cible</HelpLabel>
                          <select data-tour="hotspot-target-scene" value={selectedHotspot.targetSceneId} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetSceneId = e.target.value;
                          })}>
                            <option value="">Aucune</option>
                            {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                          </select>
                          {!isBeginnerMode ? (
                            <>
                              <HelpLabel help="Cinématique lancée après l’interaction réussie. Elle peut servir de transition, révélation ou fin de séquence.">Cinématique cible</HelpLabel>
                              <select data-tour="hotspot-target-cinematic" value={selectedHotspot.targetCinematicId} onChange={(e) => patchProject((draft) => {
                                const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetCinematicId = e.target.value;
                              })}>
                                <option value="">Aucune</option>
                                {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                              </select>
                            </>
                          ) : null}
                          <HelpLabel help="Énigme à résoudre avant d’exécuter l’action de la zone. Si elle échoue ou reste ouverte, la suite ne se déclénche pas encore.">Énigme liée</HelpLabel>
                          <select data-tour="hotspot-linked-enigma" value={selectedHotspot.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.enigmaId = e.target.value;
                          })}>
                            <option value="">Aucune</option>
                            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                          </select>
                        </>
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
                  ) : (
                    <div className="placeholder small">Sélectionne une zone, un objet visible ou un objet d’inventaire.</div>
                  )}
                </section>
              </div>

              {isEditorFullscreen ? (
                <SceneFullscreenEditor
                  selectedScene={selectedScene}
                  selectedSceneId={selectedSceneId}
                  selectedItem={null}
                  selectedItemId=""
                  selectedSceneObject={selectedSceneObject}
                  selectedSceneObjectId={selectedSceneObjectId}
                  selectedHotspot={selectedHotspot}
                  selectedHotspotId={selectedHotspotId}
                  project={project}
                  fullscreenViewportRef={fullscreenViewportRef}
                  fullscreenCanvasRef={fullscreenCanvasRef}
                  selectActInFullscreen={selectActInFullscreen}
                  selectSceneInFullscreen={selectSceneInFullscreen}
                  getSceneDepth={getSceneDepth}
                  editorToolbarProps={editorToolbarProps}
                  fullscreenZoom={fullscreenZoom}
                  sceneAspectRatio={sceneAspectRatio}
                  isPanningFullscreen={isPanningFullscreen}
                  beginFullscreenPan={beginFullscreenPan}
                  moveFullscreenPan={moveFullscreenPan}
                  stopFullscreenPan={stopFullscreenPan}
                  handleFullscreenWheel={handleFullscreenWheel}
                  fullscreenPan={fullscreenPan}
                  isDragLocked={isDragLocked}
                  snapGridEnabled={snapGridEnabled}
                  updateHotspotPosition={updateHotspotPosition}
                  stopDragging={stopDragging}
                  selectedSceneObjectIds={selectedSceneObjectIds}
                  draggingSceneObjectId={draggingSceneObjectId}
                  beginObjectDrag={beginObjectDrag}
                  selectSceneObject={selectSceneObject}
                  selectedHotspotIds={selectedHotspotIds}
                  draggingHotspotId={draggingHotspotId}
                  beginDrag={beginDrag}
                  selectHotspot={selectHotspot}
                  selectedVisualEffectZoneId={selectedVisualEffectZoneId}
                  draggingVisualEffectZoneId={draggingVisualEffectZoneId}
                  beginVisualEffectZoneDrag={beginVisualEffectZoneDrag}
                  selectVisualEffectZone={selectVisualEffectZone}
                  renderResizeHandles={renderResizeHandles}
                  renderShapePointHandles={renderShapePointHandles}
                  renderShapeControls={renderShapeControls}
                  renderShapeOutline={renderShapeOutline}
                  getShapeClassName={getShapeClassName}
                  miniMapProps={miniMapProps}
                  setSelectedItemId={() => {}}
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  importSceneObjectAnime2d={importSceneObjectAnime2d}
                  patchProject={patchProject}
                  deleteItem={() => {}}
                  setSelectedSceneObjectId={setSelectedSceneObjectId}
                  getSceneLabel={getSceneLabel}
                  deleteHotspot={deleteHotspot}
                  setTab={setTab}
                  openQuickLogicForTarget={openQuickLogicForTarget}
                />
              ) : null}
              {canUseQuickLogic ? (
                <QuickLogicModal
                  project={project}
                  selectedSceneId={selectedSceneId}
                  targetRef={quickLogicTarget}
                  patchProject={patchProject}
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  onClose={() => setQuickLogicTarget(null)}
                  getSceneLabel={getSceneLabel}
                />
              ) : null}
            </div>
          </div>
        ) : <div className="empty-state-inline">Sélectionne une scène dans la colonne de gauche pour commencer.</div>}
      </section>

    </div>
  );
}
