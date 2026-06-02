import { useEffect, useMemo, useState } from 'react';
import { makeLogicRule } from '../data/projectData';
import { buildLogicCompletionRefs, getLogicRuleCompletionIssues, getSceneTimerCompletionIssues } from '../lib/logicCompletion';
import { resolveAssetUrl } from '../lib/assetManager';
import { getSceneObjectBlockType, getSceneObjectClickMode } from './scenes/SceneObjectInspector.jsx';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import { showConfirm } from './AccessibleDialog';

const ACTION_LABELS = {
  default: 'Action normale dé la zone',
  dialogue: 'Dialogue',
  dialogue_item: 'Dialogue + objet',
  scene: 'Changer de scène',
  cinematic: 'Lancer une cinématique',
  block: 'Agir sur un bloc',
};

const OBJECT_MODES = {
  popup: 'Pop-up uniquement',
  inventory: 'Inventaire uniquement',
  both: 'Pop-up + inventaire',
};

const CONDITION_LABELS = {
  always: 'Quand cette zone ou ce bloc est utilisé',
  has_item: 'Si le joueur possède l’objet',
  missing_item: 'Si le joueur ne possède pas l’objet',
  visited_scene: 'Si une scène a été visitée',
  completed_hotspot: 'Si une zone ou un bloc est franchi entièrement',
  solved_enigma: 'Si une énigme est réussie',
  launched_cinematic: 'Si une cinématique est lancée',
  completed_combination: 'Si une combinaison est réalisée',
  chose_reply: 'Si une réponse a été choisie',
  story_variable: 'Si une variable narrative correspond',
  advanced: 'Conditions avancées combinées',
  second_click: 'En cas de deuxième clic sur cette zone',
  hero_health_below: 'Si les PV du héros sont inférieurs à',
  hero_mana_at_least: 'Si le héros a assez de mana',
  hero_last_roll_success: 'Si le dernier jet héros est réussi',
  hero_skill_used: 'Si la dernière compétence utilisée est',
};

const HERO_CONDITION_TYPES = new Set([
  'hero_health_below',
  'hero_mana_at_least',
  'hero_last_roll_success',
  'hero_skill_used',
]);

const ADVANCED_CONDITION_LABELS = {
  has_item: 'Objet possédé',
  visited_scene: 'Scène visitée',
  completed_hotspot: 'Zone utilisée',
  solved_enigma: 'Énigme réussie',
  chose_reply: 'Réponse choisie',
  story_variable: 'Variable narrative',
};

const VARIABLE_OPERATORS = {
  equals: '=',
  not_equals: '!=',
  greater_or_equal: '>=',
  less_or_equal: '<=',
  truthy: 'vrai / rempli',
  falsy: 'faux / vide',
};

const SCENE_TIMER_ACTION_OPTIONS = [
  { value: 'none', label: 'Rien' },
  { value: 'scene', label: 'Aller à une scène' },
  { value: 'restart-scene', label: 'Relancer cette scène' },
  { value: 'restart-preview', label: 'Recommencer le jeu' },
  { value: 'damage-life', label: 'Perdre des vies' },
  { value: 'dialogue', label: 'Afficher un message' },
  { value: 'cinematic', label: 'Lancer une cinématique' },
];

const FIELD_HELP = {
  sceneTree: "Choisis la scène dont tu veux régler les conditions. Les règles affichées à droite ne concernent que cette scène.",
  actionZones: "Zones cliquables de la scène selectionnée, y compris les objets visibles réglés en Zone d'action. Une règle conditionnelle peut remplacer leur action normale selon l’état de la partie.",
  addRule: "Ajoute une condition spéciale sur cette zone. La règle s’active seulement si sa condition est vraie pendant la partie.",
  visibleObjects: "Réactions au clic des objets visibles placés dans la scène. Le nom, la position, la taille et l’image restent dans l’éditeur de scène.",
  consumeRequiredItem: "Retire l’objet testé de l’inventaire après activation. Utile pour une clé utilisée une seule fois, un ticket donné, une pile consommée.",
  disableRuleAfterUse: "Désactive cette règle après sa première activation. Utile pour ouvrir une porte une fois, puis laisser la zone suivre sa logique normale même si l’objet a été consommé.",
  removeVisibleObject: "Cache l’objet dans la scène après son utilisation. Pratique pour un objet ramassé ou un élément qui disparaît.",
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

const getBlockTargets = (project) => (project.scenes || []).flatMap((scene) => (
  (scene.sceneObjects || [])
    .filter((object) => getSceneObjectBlockType(object) !== 'object')
    .map((target) => ({ scene, target }))
));

const getConversationReplies = (project) => (
  (project.scenes || []).flatMap((scene) => (
    (scene.hotspots || [])
      .filter((hotspot) => hotspot.actionType === 'conversation')
      .flatMap((hotspot) => (
        (hotspot.conversation?.nodes || []).flatMap((node) => (
          (node.replies || []).map((reply) => ({ scene, hotspot, node, reply }))
        ))
      ))
  ))
);

const getStoryVariableSummary = ({ key, operator = 'equals', value }) => {
  const operatorLabel = VARIABLE_OPERATORS[operator] || '=';
  const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${value ?? ''}`;
  return `${key || 'variable'} ${operatorLabel}${valueLabel}`;
};

const getAdvancedConditionSummary = (condition = {}, project, getSceneLabel) => {
  if (condition.type === 'has_item') return `Objet: ${(project.items || []).find((item) => item.id === condition.itemId)?.name || 'non choisi'}`;
  if (condition.type === 'visited_scene') return `Scène: ${getSceneLabel(condition.sceneId) || 'non choisie'}`;
  if (condition.type === 'completed_hotspot') {
    const testedHotspot = (project.scenes || []).flatMap((scene) => [
      ...(scene.hotspots || []),
      ...(scene.sceneObjects || []),
    ]).find((hotspot) => hotspot.id === condition.hotspotId);
    return `Zone: ${testedHotspot?.name || 'non choisie'}`;
  }
  if (condition.type === 'solved_enigma') return `Énigme: ${(project.enigmas || []).find((enigma) => enigma.id === condition.enigmaId)?.name || 'non choisie'}`;
  if (condition.type === 'chose_reply') {
    const testedReply = getConversationReplies(project).find((entry) => entry.reply.id === condition.replyId);
    return `Réponse: ${testedReply?.reply.label || 'non choisie'}`;
  }
  if (condition.type === 'story_variable') {
    return getStoryVariableSummary({
      key: condition.variableKey,
      operator: condition.operator,
      value: condition.value,
    });
  }
  return 'Condition';
};

const getRuleSummary = (rule, project) => {
  const testedItem = project.items?.find((item) => item.id === rule.itemId);
  const testedScene = project.scenes?.find((scene) => scene.id === (rule.conditionSceneId || rule.sceneId));
  const testedHotspot = (project.scenes || []).flatMap((scene) => [
    ...(scene.hotspots || []),
    ...(scene.sceneObjects || []),
  ]).find((hotspot) => hotspot.id === rule.hotspotId);
  const testedBlock = getBlockTargets(project).find((entry) => entry.target.id === rule.targetBlockId);
  const testedEnigma = project.enigmas?.find((enigma) => enigma.id === rule.conditionEnigmaId);
  const testedCinematic = project.cinematics?.find((cinematic) => cinematic.id === rule.cinematicId);
  const testedCombination = project.combinations?.find((combo) => combo.id === rule.combinationId);
  const testedReply = getConversationReplies(project).find((entry) => entry.reply.id === (rule.conditionReplyId || rule.replyId));
  const rewardItem = project.items?.find((item) => item.id === rule.rewardItemId);
  const heroSkill = project.heroAdventure?.hero.skills?.find((skill) => skill.id === rule.heroSkillId);
  const advancedMode = (rule.advancedConditionMode || 'all') === 'any' ? 'OU' : 'ET';
  const advancedLabels = (rule.advancedConditions || []).map((condition) => getAdvancedConditionSummary(condition, project, (sceneId) => project.scenes?.find((scene) => scene.id === sceneId)?.name || ''));
  let condition = {
    always: 'À l’utilisation',
    missing_item: `Sans ${testedItem?.name || 'objet'}`,
    visited_scene: `Scène visitée: ${testedScene?.name || 'scène'}`,
    completed_hotspot: `Zone franchie: ${testedHotspot?.name || 'zone'}`,
    solved_enigma: `Énigme réussie: ${testedEnigma?.name || 'énigme'}`,
    launched_cinematic: `Cinématique lancée: ${testedCinematic?.name || 'cinematic'}`,
    completed_combination: `Combinaison réalisée: ${testedCombination?.message || 'combinaison'}`,
    chose_reply: `Réponse choisie: ${testedReply?.reply.label || 'réponse'}`,
    story_variable: getStoryVariableSummary({
      key: rule.conditionVariableKey || rule.variableKey,
      operator: rule.conditionVariableOperator || rule.operator,
      value: rule.conditionVariableValue ?? rule.value,
    }),
    advanced: advancedLabels.length ? `${advancedMode}: ${advancedLabels.join(` ${advancedMode} `)}` : 'Conditions avancées',
    second_click: 'Deuxième clic',
    hero_health_below: `PV héros < ${rule.heroHealthThreshold ?? 5}`,
    hero_mana_at_least: `Mana héros >= ${rule.heroManaThreshold ?? 1}`,
    hero_last_roll_success: 'Dernier jet héros réussi',
    hero_skill_used: `Compétence: ${heroSkill?.name || 'à choisir'}`,
  }[rule.conditionType] || `Avec ${testedItem?.name || 'objet'}`;
  if (rule.conditionType === 'launched_cinematic' && !rule.cinematicId) {
    condition = 'Une cinématique est lancée';
  }
  const action = rule.actionType === 'block'
    ? `${ACTION_LABELS.block}: ${testedBlock?.target.name || 'bloc'}`
    : ACTION_LABELS[rule.actionType] || 'Dialogue';
  const reward = rewardItem ? ` · donné ${rewardItem.name}` : '';
  return `${condition} · ${action}${reward}`;
};

const HelpLabel = ({ children, help, className = '' }) => (
  <label className={`label-with-help${className ? ` ${className}` : ''}`}>
    <span>{children}</span>
    <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
  </label>
);

export default function LogicTab({
  project,
  patchProject,
  handleUpload,
  mediaLibrary = [],
  getSceneLabel,
  selectedSceneId: editorSelectedSceneId = '',
  collapsedSceneIds = new Set(),
  setSceneCollapsed,
}) {
  const scenes = project.scenes || [];
  const acts = project.acts || [];
  const [selectedSceneId, setSelectedSceneId] = useState(editorSelectedSceneId || scenes[0]?.id || '');

  useEffect(() => {
    if (!selectedSceneId || !scenes.some((scene) => scene.id === selectedSceneId)) {
      setSelectedSceneId(editorSelectedSceneId || scenes[0]?.id || '');
    }
  }, [editorSelectedSceneId, scenes, selectedSceneId]);

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) || scenes[0] || null,
    [scenes, selectedSceneId],
  );
  const selectedTimerAction = selectedScene?.timerEndAction || 'none';
  const getSceneActionTargets = (scene) => [
    ...(scene.hotspots || []).map((hotspot) => ({ scene, target: hotspot, type: 'hotspot' })),
    ...(scene.sceneObjects || []).map((object) => ({ scene, target: object, type: 'sceneObject' })),
  ];
  const allActionTargets = useMemo(() => scenes.flatMap((scene) => getSceneActionTargets(scene)), [scenes]);
  const allBlockTargets = useMemo(() => getBlockTargets(project), [project]);
  const conversationReplies = useMemo(() => getConversationReplies(project), [project]);
  const logicCompletionRefs = useMemo(() => buildLogicCompletionRefs(project), [project]);
  const storyVariableKeys = useMemo(() => [
    ...new Set((project.storyVariables || []).map((variable) => variable.key).filter(Boolean)),
  ], [project.storyVariables]);
  const isHeroAdventureProject = Boolean(project.creationMode === 'hero_adventure' || project.heroAdventure?.enabled);
  const heroSkills = project.heroAdventure?.hero.skills || [];
  const selectedTimerIssues = selectedScene ? getSceneTimerCompletionIssues(selectedScene, logicCompletionRefs) : [];

  const totalRules = scenes.reduce((count, scene) => (
    count + getSceneActionTargets(scene).reduce((sceneCount, { target }) => sceneCount + (target.logicRules || []).length, 0)
  ), 0);

  const updateScene = (updater) => {
    if (!selectedScene) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedScene.id);
      if (scene) updater(scene);
    });
  };

  const updateActionTarget = (targetId, targetType, updater) => {
    if (!selectedScene) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedScene.id);
      const target = targetType === 'sceneObject'
        ? scene?.sceneObjects?.find((entry) => entry.id === targetId)
        : scene?.hotspots?.find((entry) => entry.id === targetId);
      if (target) updater(target);
    });
  };

  const updateRule = (targetId, targetType, ruleId, updater) => {
    updateActionTarget(targetId, targetType, (target) => {
      const rule = target.logicRules?.find((entry) => entry.id === ruleId);
      if (rule) updater(rule);
    });
  };

  const addRule = (targetId, targetType) => {
    updateActionTarget(targetId, targetType, (target) => {
      if (!Array.isArray(target.logicRules)) target.logicRules = [];
      target.logicRules.push(makeLogicRule());
    });
  };

  const deleteRule = async (targetId, targetType, ruleId) => {
    const confirmed = await showConfirm({
      title: 'Supprimer la règle',
      message: 'Supprimer cette règle logique ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    updateActionTarget(targetId, targetType, (target) => {
      target.logicRules = (target.logicRules || []).filter((rule) => rule.id !== ruleId);
    });
  };

  const clearRuleSound = (targetId, targetType, ruleId, kind) => {
    updateRule(targetId, targetType, ruleId, (draftRule) => {
      draftRule[`${kind}SoundData`] = '';
      draftRule[`${kind}SoundName`] = '';
      draftRule[`${kind}SoundId`] = '';
    });
  };

  const getRuleSoundUrl = (rule, kind) => resolveAssetUrl(
    project,
    rule?.[`${kind}SoundId`],
    rule?.[`${kind}SoundData`],
  );

  const getConditionOptions = (rule) => (
    Object.entries(CONDITION_LABELS).filter(([value]) => (
      isHeroAdventureProject || !HERO_CONDITION_TYPES.has(value) || value === rule.conditionType
    ))
  );

  const renderStoryVariableFields = ({ variableKey, operator, value, onChange }) => (
    <div className="logic-story-variable-grid">
      <div>
        <HelpLabel help="Clé de la variable narrative à tester. Les variables déclarées dans l’onglet Aventure sont proposées automatiquement.">Variable</HelpLabel>
        <input
          value={variableKey || ''}
          list="logic-story-variable-keys"
          placeholder="confiance_du_guide"
          onChange={(event) => onChange({ variableKey: event.target.value })}
        />
      </div>
      <div>
        <HelpLabel help="Comparaison appliquée à la valeur actuelle de la variable.">Comparaison</HelpLabel>
        <select value={operator || 'equals'} onChange={(event) => onChange({ operator: event.target.value })}>
          {Object.entries(VARIABLE_OPERATORS).map(([operatorValue, label]) => (
            <option key={operatorValue} value={operatorValue}>{label}</option>
          ))}
        </select>
      </div>
      {!['truthy', 'falsy'].includes(operator || 'equals') ? (
        <div>
          <HelpLabel help="Valeur attendue. Les comparaisons >= et <= convertissent en nombre.">Valeur</HelpLabel>
          <input
            value={value ?? ''}
            placeholder="3"
            onChange={(event) => onChange({ value: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );

  const renderAdvancedConditionFields = (condition, conditionIndex, rule, target, type) => {
    const conditionType = condition.type || 'has_item';
    const updateAdvancedCondition = (updater) => updateRule(target.id, type, rule.id, (draftRule) => {
      const targetCondition = draftRule.advancedConditions?.[conditionIndex];
      if (targetCondition) updater(targetCondition);
    });

    return (
      <div key={condition.id || conditionIndex} className="conversation-advanced-condition-row">
        <select value={conditionType} onChange={(event) => updateAdvancedCondition((targetCondition) => {
          targetCondition.type = event.target.value;
        })}>
          {Object.entries(ADVANCED_CONDITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {conditionType === 'has_item' ? (
          <select value={condition.itemId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.itemId = event.target.value;
          })}>
            <option value="">Objet</option>
            {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
        ) : null}

        {conditionType === 'visited_scene' ? (
          <select value={condition.sceneId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.sceneId = event.target.value;
          })}>
            <option value="">Scène</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
        ) : null}

        {conditionType === 'completed_hotspot' ? (
          <select value={condition.hotspotId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.hotspotId = event.target.value;
          })}>
            <option value="">Zone</option>
            {allActionTargets.map(({ scene, target: candidate, type: candidateType }) => (
              <option key={`${candidateType}-${candidate.id}`} value={candidate.id}>{getSceneLabel(scene.id)} - {candidateType === 'sceneObject' ? 'Image-zone: ' : ''}{candidate.name}</option>
            ))}
          </select>
        ) : null}

        {conditionType === 'solved_enigma' ? (
          <select value={condition.enigmaId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.enigmaId = event.target.value;
          })}>
            <option value="">Énigme</option>
            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
          </select>
        ) : null}

        {conditionType === 'chose_reply' ? (
          <select value={condition.replyId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.replyId = event.target.value;
          })}>
            <option value="">Réponse</option>
            {conversationReplies.map(({ scene, hotspot, node, reply }) => (
              <option key={reply.id} value={reply.id}>{getSceneLabel(scene.id)} - {hotspot.name || 'Dialogue'} - {reply.label || node.text || 'Réponse'}</option>
            ))}
          </select>
        ) : null}

        {conditionType === 'story_variable' ? renderStoryVariableFields({
          variableKey: condition.variableKey,
          operator: condition.operator,
          value: condition.value,
          onChange: (patch) => updateAdvancedCondition((targetCondition) => {
            if (Object.prototype.hasOwnProperty.call(patch, 'variableKey')) targetCondition.variableKey = patch.variableKey;
            if (Object.prototype.hasOwnProperty.call(patch, 'operator')) targetCondition.operator = patch.operator;
            if (Object.prototype.hasOwnProperty.call(patch, 'value')) targetCondition.value = patch.value;
          }),
        }) : null}

        <button type="button" className="secondary-action compact danger-action" onClick={() => updateRule(target.id, type, rule.id, (draftRule) => {
          draftRule.advancedConditions = (draftRule.advancedConditions || []).filter((_, index) => index !== conditionIndex);
        })}>Retirer</button>
      </div>
    );
  };

  const renderConditionDetailFields = (rule, target, type) => {
    const conditionType = rule.conditionType || 'has_item';

    return (
      <>
        {['has_item', 'missing_item'].includes(conditionType) ? (
          <div className="logic-flow-field">
            <HelpLabel help="Objet vérifié dans l’inventaire du joueur pour savoir si la règle doit s’activer.">Objet testé</HelpLabel>
            <select value={rule.itemId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.itemId = event.target.value;
            })}>
              <option value="">Choisir un objet</option>
              {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'visited_scene' ? (
          <div className="logic-flow-field">
            <HelpLabel help="Scène qui doit avoir déjà été visitée pendant la partie.">Scène visitée</HelpLabel>
            <select value={rule.conditionSceneId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.conditionSceneId = event.target.value;
            })}>
              <option value="">Choisir une scène</option>
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'completed_hotspot' ? (
          <div className="logic-flow-field">
            <HelpLabel help="Zone qui doit avoir déjà terminé son action au moins une fois.">Zone d’action franchie</HelpLabel>
            <select value={rule.hotspotId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.hotspotId = event.target.value;
            })}>
              <option value="">Choisir une zone</option>
              {allActionTargets.map(({ scene, target: candidate, type: candidateType }) => (
                <option key={`${candidateType}-${candidate.id}`} value={candidate.id}>{getSceneLabel(scene.id)} - {candidateType === 'sceneObject' ? 'Image-zone: ' : ''}{candidate.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {conditionType === 'solved_enigma' ? (
          <div className="logic-flow-field">
            <HelpLabel help="Énigme qui doit avoir été réussie pendant la partie.">Énigme réussie</HelpLabel>
            <select value={rule.conditionEnigmaId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.conditionEnigmaId = event.target.value;
            })}>
              <option value="">Choisir une énigme</option>
              {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'launched_cinematic' ? (
          <div className="logic-flow-field">
            <HelpLabel help="Cinématique qui doit avoir été lancée au moins une fois pendant la partie.">Cinématique lancée</HelpLabel>
            <select value={rule.cinematicId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.cinematicId = event.target.value;
            })}>
              <option value="">N’importe quelle cinematic lancée</option>
              {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'completed_combination' ? (
          <div className="logic-flow-field">
            <HelpLabel help="Combinaison d’objets qui doit avoir été réalisée dans l’inventaire.">Combinaison réalisée</HelpLabel>
            <select value={rule.combinationId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.combinationId = event.target.value;
            })}>
              <option value="">Choisir une combinaison</option>
              {(project.combinations || []).map((combo) => {
                const itemA = project.items.find((item) => item.id === combo.itemAId);
                const itemB = project.items.find((item) => item.id === combo.itemBId);
                const result = project.items.find((item) => item.id === combo.resultItemId);
                return <option key={combo.id} value={combo.id}>{itemA?.name || 'Objet 1'} + {itemB?.name || 'Objet 2'} → {result?.name || 'Result'}</option>;
              })}
            </select>
          </div>
        ) : null}

        {conditionType === 'chose_reply' ? (
          <div className="logic-flow-field">
            <HelpLabel help="Réponse de conversation qui doit avoir déjà été choisie pendant la partie.">Réponse choisie</HelpLabel>
            <select value={rule.conditionReplyId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.conditionReplyId = event.target.value;
            })}>
              <option value="">Choisir une réponse</option>
              {conversationReplies.map(({ scene, hotspot, node, reply }) => (
                <option key={reply.id} value={reply.id}>{getSceneLabel(scene.id)} - {hotspot.name || 'Dialogue'} - {reply.label || node.text || 'Réponse'}</option>
              ))}
            </select>
          </div>
        ) : null}

        {conditionType === 'story_variable' ? (
          <div className="logic-flow-field logic-flow-field-wide">
            {renderStoryVariableFields({
              variableKey: rule.conditionVariableKey,
              operator: rule.conditionVariableOperator,
              value: rule.conditionVariableValue,
              onChange: (patch) => updateRule(target.id, type, rule.id, (draftRule) => {
                if (Object.prototype.hasOwnProperty.call(patch, 'variableKey')) draftRule.conditionVariableKey = patch.variableKey;
                if (Object.prototype.hasOwnProperty.call(patch, 'operator')) draftRule.conditionVariableOperator = patch.operator;
                if (Object.prototype.hasOwnProperty.call(patch, 'value')) draftRule.conditionVariableValue = patch.value;
              }),
            })}
          </div>
        ) : null}

        {conditionType === 'advanced' ? (
          <div className="logic-flow-field logic-flow-field-wide">
            <div className="conversation-advanced-condition-list">
              <div className="conversation-advanced-condition-head">
                <HelpLabel help="Choisis ET pour exiger toutes les conditions, ou OU pour accepter au moins une condition. Exemple: variable narrative >= 3 ET réponse choisie.">Combinaison</HelpLabel>
                <select value={rule.advancedConditionMode || 'all'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                  draftRule.advancedConditionMode = event.target.value;
                })}>
                  <option value="all">Toutes les conditions (ET)</option>
                  <option value="any">Au moins une condition (OU)</option>
                </select>
              </div>
              {(rule.advancedConditions || []).map((condition, conditionIndex) => renderAdvancedConditionFields(condition, conditionIndex, rule, target, type))}
              <button type="button" className="secondary-action compact" onClick={() => updateRule(target.id, type, rule.id, (draftRule) => {
                if (!Array.isArray(draftRule.advancedConditions)) draftRule.advancedConditions = [];
                draftRule.advancedConditions.push(makeAdvancedCondition());
              })}>+ Condition</button>
            </div>
          </div>
        ) : null}

        {conditionType === 'hero_health_below' ? (
          <div className="logic-flow-field">
            <HelpLabel help="La règle s’active si les PV actuels du héros sont strictement inférieurs à ce seuil.">Seuil de PV</HelpLabel>
            <input type="number" min="0" value={rule.heroHealthThreshold ?? 5} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.heroHealthThreshold = Number(event.target.value);
            })} />
          </div>
        ) : null}

        {conditionType === 'hero_mana_at_least' ? (
          <div className="logic-flow-field">
            <HelpLabel help="La règle s’active si la mana actuelle du héros atteint au moins ce seuil.">Mana requise</HelpLabel>
            <input type="number" min="0" value={rule.heroManaThreshold ?? 1} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.heroManaThreshold = Number(event.target.value);
            })} />
          </div>
        ) : null}

        {conditionType === 'hero_skill_used' ? (
          <div className="logic-flow-field">
            <HelpLabel help="La règle s’active si le dernier jet héros utilisait cette compétence.">Compétence du dernier jet</HelpLabel>
            <select value={rule.heroSkillId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.heroSkillId = event.target.value;
            })}>
              <option value="">Choisir une compétence</option>
              {heroSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
            </select>
          </div>
        ) : null}
      </>
    );
  };

  const renderActionTargetFields = (rule, target, type) => (
      <>
        {rule.actionType === 'scene' ? (
        <div className="logic-flow-field">
          <HelpLabel help="Scène ouverte si l’action déclenchée est un changement de scène.">Scène cible</HelpLabel>
          <select data-tour="logic-target-scene" value={rule.targetSceneId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
            draftRule.targetSceneId = event.target.value;
          })}>
            <option value="">Choisir une scène</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
        </div>
      ) : null}

      {rule.actionType === 'cinematic' ? (
        <div className="logic-flow-field">
          <HelpLabel help="Cinématique lancée si l’action déclenchée est une cinématique.">Cinématique cible</HelpLabel>
          <select data-tour="logic-target-cinematic" value={rule.targetCinematicId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
            draftRule.targetCinematicId = event.target.value;
          })}>
            <option value="">Choisir une cinématique</option>
            {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
          </select>
        </div>
      ) : null}

      {rule.actionType === 'block' ? (
        <>
          <div className="logic-flow-field">
            <HelpLabel help="Bloc affiché, masque ou modifié quand cette règle réussit.">Bloc cible</HelpLabel>
            <select value={rule.targetBlockId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.targetBlockId = event.target.value;
            })}>
              <option value="">Choisir un bloc</option>
              {allBlockTargets.map(({ scene, target: block }) => (
                <option key={block.id} value={block.id}>{getSceneLabel(scene.id)} - {block.name || block.blockLabel || 'Bloc'}</option>
              ))}
            </select>
          </div>
          <div className="logic-flow-field">
            <HelpLabel help="Action appliquée au bloc cible.">Action bloc</HelpLabel>
            <select value={rule.blockActionType || 'show'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.blockActionType = event.target.value;
            })}>
              <option value="show">Afficher le bloc</option>
              <option value="hide">Masquer le bloc</option>
              <option value="update_text">Modifier le texte visible</option>
            </select>
          </div>
          {rule.blockActionType === 'update_text' ? (
            <div className="logic-flow-field logic-flow-field-wide">
              <HelpLabel help="Nouveau texte visible du bloc cible. Selon le type, cela met à jour le texte, le bouton, le placeholder ou le titre du code.">Texte visible du bloc</HelpLabel>
              <textarea value={rule.targetBlockText || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                draftRule.targetBlockText = event.target.value;
              })} />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );

  const updateSceneObject = (objectId, updater) => {
    updateScene((scene) => {
      const object = (scene.sceneObjects || []).find((entry) => entry.id === objectId);
      if (object) updater(object);
    });
  };
  const selectedActionTargets = selectedScene ? getSceneActionTargets(selectedScene) : [];
  const selectedClickableObjects = (selectedScene?.sceneObjects || []).filter((object) => getSceneObjectClickMode(object) === 'object');

  const renderSceneTree = (sceneList, depth = 0) => (
    <div className={depth ? 'scene-children-list' : ''}>
      {sceneList.map((scene) => {
        const children = scenes.filter((candidate) => candidate.parentSceneId === scene.id && candidate.actId === scene.actId);
        const hasChildren = children.length > 0;
        const collapsed = collapsedSceneIds.has(scene.id);
        return (
          <details
            key={scene.id}
            className={`scene-tree-node ${hasChildren ? 'has-children' : ''}`}
            open={!collapsed}
            onToggle={(event) => setSceneCollapsed?.(scene.id, !event.currentTarget.open)}
          >
            <summary className={`scene-summary ${scene.id === selectedScene?.id ? 'selected' : ''}`} style={{ '--scene-depth': depth }}>
              {hasChildren ? <span className="scene-collapse-button">▾</span> : <span className="scene-collapse-spacer" />}
              <button type="button" className="scene-select-button" onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSelectedSceneId(scene.id);
              }}>
                <span className="scene-title-line">
                  <strong>{scene.name}</strong>
                </span>
              </button>
            </summary>
            {hasChildren ? <div className="scene-children">{renderSceneTree(children, depth + 1)}</div> : null}
          </details>
        );
      })}
    </div>
  );

  return (
    <div className="layout two-cols-wide">
      <section className="panel side panel-nav-pro scene-left-nav logic-left-nav" data-tour="logic-scene-tree">
        <div className="panel-head">
          <h2>Actes et scènes</h2>
          <span className="status-badge soft">{totalRules} règle{totalRules > 1 ? 's' : ''}</span>
        </div>
        <HelpLabel help={FIELD_HELP.sceneTree}>Scène à configurer</HelpLabel>

        {acts.map((act) => {
          const actScenes = scenes.filter((scene) => scene.actId === act.id);
          return (
            <div className="act-group" key={act.id}>
              <div className="act-heading">
                <strong>{act.name}</strong>
                <span>{actScenes.length} scène{actScenes.length > 1 ? 's' : ''}</span>
              </div>
              {renderSceneTree(actScenes.filter((scene) => !scene.parentSceneId))}
            </div>
          );
        })}
      </section>

      <section className="panel main">
        <datalist id="logic-story-variable-keys">
          {storyVariableKeys.map((key) => <option key={key} value={key} />)}
        </datalist>
        <div className="panel-head">
          <div>
            <span className="section-kicker">Logique</span>
            <h2>{selectedScene?.name || 'Aucune scène'}</h2>
          </div>
        </div>

        {selectedScene ? (
          <div className="editor-stack">
            <section className="combo-card logic-scene-rules-card" data-tour="logic-scene-timer">
              <div className="panel-head">
                <div>
                  <HelpLabel className="compact-section-title" help="Règles qui s'appliquent ? toute la scène, avant les exceptions propres aux zones d'action.">Règles de scène</HelpLabel>
                  <p className="small-note">Compte a rebours local et conséquence automatique quand le temps arrive a zero.</p>
                </div>
                <span className={`status-badge ${selectedTimerIssues.length ? 'warning' : selectedScene.timerEnabled ? '' : 'soft'}`}>
                  {selectedTimerIssues.length ? 'Timer incomplet' : selectedScene.timerEnabled ? 'Timer actif' : 'Timer inactif'}
                </span>
              </div>
              {selectedTimerIssues.length ? (
                <p className="logic-incomplete-note" role="status">
                  Réglage incomplet: {selectedTimerIssues.join(' · ')}
                </p>
              ) : null}
              <div className="compact-form-grid logic-scene-timer-grid">
                <label className="checkbox-row logic-timer-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedScene.timerEnabled)}
                    onChange={(event) => updateScene((scene) => {
                      scene.timerEnabled = event.target.checked;
                    })}
                  />
                  Activer un compte a rebours
                </label>
                <div>
                  <HelpLabel help="Durée disponible dans cette scène avant l'action automatique.">Durée</HelpLabel>
                  <input
                    type="number"
                    min="5"
                    max="3600"
                    step="5"
                    value={selectedScene.timerSeconds || 60}
                    disabled={!selectedScene.timerEnabled}
                    onChange={(event) => updateScene((scene) => {
                      scene.timerSeconds = Math.max(5, Math.min(3600, Number(event.target.value) || 60));
                    })}
                  />
                </div>
                <div>
                  <HelpLabel help="Action déclenchée quand le temps arrive a zero.">Fin du temps</HelpLabel>
                  <select
                    value={selectedTimerAction}
                    disabled={!selectedScene.timerEnabled}
                    onChange={(event) => updateScene((scene) => {
                      scene.timerEndAction = event.target.value;
                    })}
                  >
                    {SCENE_TIMER_ACTION_OPTIONS.map((action) => (
                      <option key={action.value} value={action.value}>{action.label}</option>
                    ))}
                  </select>
                </div>
                {selectedTimerAction === 'scene' || selectedTimerAction === 'damage-life' ? (
                  <div>
                    <HelpLabel help="Scène ouverte à la fin du temps, ou quand les vies tombent à zéro.">Scène cible</HelpLabel>
                    <select
                      value={selectedScene.timerTargetSceneId || ''}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => updateScene((scene) => {
                        scene.timerTargetSceneId = event.target.value;
                      })}
                    >
                      <option value="">Aucune</option>
                      {scenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {selectedTimerAction === 'cinematic' ? (
                  <div>
                    <HelpLabel help="Cinématique lancée automatiquement quand le temps arrive à zéro.">Cinématique cible</HelpLabel>
                    <select
                      value={selectedScene.timerTargetCinematicId || ''}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => updateScene((scene) => {
                        scene.timerTargetCinematicId = event.target.value;
                      })}
                    >
                      <option value="">Aucune</option>
                      {(project.cinematics || []).map((cinematic) => (
                        <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {selectedTimerAction === 'damage-life' ? (
                  <div>
                    <HelpLabel help="Nombre de vies perdues quand le temps expire. Le joueur commence avec 3 vies dans l'apercu.">Vies perdues</HelpLabel>
                    <input
                      type="number"
                      min="1"
                      max="9"
                      value={selectedScene.timerLifeLoss || 1}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => updateScene((scene) => {
                        scene.timerLifeLoss = Math.max(1, Math.min(9, Number(event.target.value) || 1));
                      })}
                    />
                  </div>
                ) : null}
                <div className="logic-timer-message-field">
                  <HelpLabel help="Texte affiché si l'action de fin a besoin d'un message.">Message de fin</HelpLabel>
                  <input
                    value={selectedScene.timerEndMessage || ''}
                    disabled={!selectedScene.timerEnabled}
                    onChange={(event) => updateScene((scene) => {
                      scene.timerEndMessage = event.target.value;
                    })}
                    placeholder="Le temps est écoulé."
                  />
                </div>
              </div>
            </section>

            <section className="combo-card" data-tour="logic-zones">
              <div className="panel-head">
                <HelpLabel className="compact-section-title" help={FIELD_HELP.actionZones}>Zones d’action</HelpLabel>
                <span className="status-badge soft">{selectedActionTargets.length}</span>
              </div>
              {selectedActionTargets.map(({ target, type }) => (
                <div className="combo-card" key={`${type}-${target.id}`}>
                  <div className="panel-head">
                    <div>
                      <h3>{target.name}</h3>
                      <p className="small-note">{type === 'sceneObject' ? 'Image-zone · ' : ''}{(target.logicRules || []).length} règle{(target.logicRules || []).length > 1 ? 's' : ''} conditionnelle{(target.logicRules || []).length > 1 ? 's' : ''}</p>
                    </div>
                    <div className="label-with-help" data-tour="logic-add-rule">
                      <button type="button" onClick={() => addRule(target.id, type)}>+ Règle</button>
                      <span className="help-dot" data-help={FIELD_HELP.addRule} aria-label={FIELD_HELP.addRule} tabIndex={0}>?</span>
                    </div>
                  </div>

                  {(target.logicRules || []).length ? target.logicRules.map((rule) => {
                    const ruleCompletionIssues = getLogicRuleCompletionIssues(rule, logicCompletionRefs);
                    return (
                    <details className={`logic-rule-card${ruleCompletionIssues.length ? ' incomplete' : ''}`} key={rule.id} open>
                      <summary>
                        <span>
                          <span className="logic-rule-name-line">
                            <strong>{rule.name || 'Règle'}</strong>
                            {ruleCompletionIssues.length ? <em className="logic-incomplete-pill">Règle incomplète</em> : null}
                          </span>
                          <small>{getRuleSummary(rule, project)}</small>
                          {ruleCompletionIssues.length ? (
                            <small className="logic-incomplete-details">{ruleCompletionIssues.join(' · ')}</small>
                          ) : null}
                        </span>
                        <button type="button" className="danger-button" onClick={(event) => {
                          event.preventDefault();
                          deleteRule(target.id, type, rule.id);
                        }}>
                          Supprimer
                        </button>
                      </summary>
                      <div className="logic-rule-body">
                        <div className="logic-rule-name-field">
                          <HelpLabel help="Nom interne pour reconnaître rapidement cette règle dans la liste compacte.">Nom de la règle</HelpLabel>
                          <input value={rule.name || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.name = event.target.value;
                          })} />
                        </div>

                        <section className="logic-flow-step logic-flow-step-condition">
                          <div className="logic-flow-step-head">
                            <span className="logic-flow-keyword">Si</span>
                            <HelpLabel className="logic-flow-title" help="Détermine quand cette règle remplace l’action normale de la zone. La première règle qui correspond est utilisée.">cette condition est respectée</HelpLabel>
                          </div>
                          <div className="logic-flow-grid">
                            <div className="logic-flow-field">
                              <HelpLabel help="Type de condition à vérifier pendant la partie.">Condition à vérifier</HelpLabel>
                              <select data-tour="logic-condition" value={rule.conditionType || 'has_item'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.conditionType = event.target.value;
                              })}>
                                {getConditionOptions(rule).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </div>
                            {renderConditionDetailFields(rule, target, type)}
                          </div>
                        </section>

                        <section className="logic-flow-step logic-flow-step-action">
                          <div className="logic-flow-step-head">
                            <span className="logic-flow-keyword">Alors</span>
                            <HelpLabel className="logic-flow-title" help="Action exécutée à la place de l’action normale de la zone quand la condition est vraie.">cette action est déclenchée</HelpLabel>
                          </div>
                          <div className="logic-flow-grid">
                            <div className="logic-flow-field">
                              <HelpLabel help="Action exécutée à la place de l’action normale de la zone quand la condition est vraie.">Action déclenchée</HelpLabel>
                              <select data-tour="logic-action" value={rule.actionType || 'dialogue'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.actionType = event.target.value;
                              })}>
                                {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </div>
                            <div className="logic-flow-field">
                              <HelpLabel help="Objet ajouté à l’inventaire quand cette règle s’active. Laisse Aucun si la règle ne donne rien.">Objet donné</HelpLabel>
                              <select data-tour="logic-reward-item" value={rule.rewardItemId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.rewardItemId = event.target.value;
                              })}>
                                <option value="">Aucun</option>
                                {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                              </select>
                            </div>
                            {renderActionTargetFields(rule, target, type)}
                            <div className="logic-flow-field">
                              <HelpLabel help="Message affiché au joueur quand cette règle s’active. Il remplace le dialogue normal de la zone.">Dialogue affiché</HelpLabel>
                              <textarea data-tour="logic-dialogue" value={rule.dialogue || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.dialogue = event.target.value;
                              })} />
                            </div>
                            <div className="logic-sound-field">
                              <HelpLabel help="Son joué quand la condition est remplie et que l’action de cette règle se lance.">Son si condition réussie</HelpLabel>
                              <MediaSourcePicker
                                className="button like full secondary-action"
                                accept="audio/*"
                                assetScope="logic-sound"
                                handleUpload={handleUpload}
                                mediaLibrary={mediaLibrary}
                                onSelect={(data, name) => updateRule(target.id, type, rule.id, (draftRule) => {
                                  draftRule.successSoundData = data;
                                  draftRule.successSoundName = name;
                                })}
                              >
                                {rule.successSoundName || 'Importer un son de réussite'}
                              </MediaSourcePicker>
                              {getRuleSoundUrl(rule, 'success') ? (
                                <div className="logic-sound-preview">
                                  <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'success')} />
                                  <button type="button" className="danger-button" onClick={() => clearRuleSound(target.id, type, rule.id, 'success')}>Supprimer</button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </section>

                        <details className="logic-flow-step logic-flow-step-failure" open={Boolean(rule.failureDialogue || getRuleSoundUrl(rule, 'failure'))}>
                          <summary className="logic-flow-step-head">
                            <span className="logic-flow-keyword">Sinon</span>
                            <HelpLabel className="logic-flow-title" help="Réponse utilisée quand cette règle est configurée mais que sa condition n’est pas remplie.">si la condition n’est pas remplie</HelpLabel>
                          </summary>
                          <div className="logic-flow-grid">
                            <div className="logic-flow-field">
                              <HelpLabel help="Message affiché si cette règle ne peut pas s’activer parce que sa condition n’est pas remplie. Exemple : il manque une clé, une énigme n’est pas encore réussie, ou une cinématique n’a pas encore été lancée.">Dialogue si condition non remplie</HelpLabel>
                              <textarea value={rule.failureDialogue || ''} placeholder="Exemple : La porte reste verrouillée. Il te manque la clé." onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.failureDialogue = event.target.value;
                              })} />
                            </div>
                            <div className="logic-sound-field">
                              <HelpLabel help="Son joué quand cette règle est configurée mais que sa condition n’est pas remplie.">Son si condition échouée</HelpLabel>
                              <MediaSourcePicker
                                className="button like full secondary-action"
                                accept="audio/*"
                                assetScope="logic-sound"
                                handleUpload={handleUpload}
                                mediaLibrary={mediaLibrary}
                                onSelect={(data, name) => updateRule(target.id, type, rule.id, (draftRule) => {
                                  draftRule.failureSoundData = data;
                                  draftRule.failureSoundName = name;
                                })}
                              >
                                {rule.failureSoundName || "Importer un son d'échec"}
                              </MediaSourcePicker>
                              {getRuleSoundUrl(rule, 'failure') ? (
                                <div className="logic-sound-preview">
                                  <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'failure')} />
                                  <button type="button" className="danger-button" onClick={() => clearRuleSound(target.id, type, rule.id, 'failure')}>Supprimer</button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </details>

                        <details className="logic-flow-step logic-flow-step-options" open={Boolean(rule.consumeRequiredItemOnUse || rule.disableAfterUse)}>
                          <summary className="logic-flow-step-head">
                            <span className="logic-flow-keyword">Options</span>
                            <HelpLabel className="logic-flow-title" help="Réglages complémentaires appliqués après l’activation de la règle.">réglages de la règle</HelpLabel>
                          </summary>
                          <div className="logic-flow-options">
                            {rule.conditionType === 'has_item' ? (
                              <label className="checkbox-row">
                                <input type="checkbox" checked={Boolean(rule.consumeRequiredItemOnUse)} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                  draftRule.consumeRequiredItemOnUse = event.target.checked;
                                })} />
                                <span>Consommer l’objet testé quand la règle s’active</span>
                                <span className="help-dot" data-help={FIELD_HELP.consumeRequiredItem} aria-label={FIELD_HELP.consumeRequiredItem} tabIndex={0}>?</span>
                              </label>
                            ) : null}
                            <label className="checkbox-row">
                              <input type="checkbox" checked={Boolean(rule.disableAfterUse)} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.disableAfterUse = event.target.checked;
                              })} />
                              <span>Cette règle ne s’applique qu’une fois, puis s’annule</span>
                              <span className="help-dot" data-help={FIELD_HELP.disableRuleAfterUse} aria-label={FIELD_HELP.disableRuleAfterUse} tabIndex={0}>?</span>
                            </label>
                          </div>
                        </details>
                      </div>
                    </details>
                    );
                  }) : <p className="small-note">Cette zone utilise sa logique normale.</p>}
                </div>
              ))}
            </section>

            <section className="combo-card" data-tour="logic-visible-objects">
              <div className="panel-head">
                <HelpLabel className="compact-section-title" help={FIELD_HELP.visibleObjects}>Réactions des objets visibles</HelpLabel>
                <span className="status-badge soft">{selectedClickableObjects.length}</span>
              </div>
              {selectedClickableObjects.length ? selectedClickableObjects.map((object) => (
                <div className="combo-card" key={object.id}>
                  <div className="logic-visible-object-head">
                    <strong>{object.name || 'Objet visible'}</strong>
                    <span>{OBJECT_MODES[object.interactionMode || 'popup'] || 'Interaction'}</span>
                  </div>
                  <div className="grid-two">
                    <div>
                      <HelpLabel help="Choisis si l’objet ouvre une image pop-up, rejoint l’inventaire, ou fait les deux au clic.">Mode d’interaction</HelpLabel>
                      <select value={object.interactionMode || 'popup'} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                        draftObject.interactionMode = event.target.value;
                      })}>
                        {Object.entries(OBJECT_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <div>
                      <HelpLabel help="Objet ajouté à l’inventaire quand le mode d’interaction inclut l’inventaire.">Objet d’inventaire lié</HelpLabel>
                      <select value={object.linkedItemId || ''} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                        draftObject.linkedItemId = event.target.value;
                      })}>
                        <option value="">Aucun</option>
                        {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <HelpLabel help="Message affiché quand le joueur clique sur cet objet visible.">Dialogue</HelpLabel>
                  <textarea value={object.dialogue || ''} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                    draftObject.dialogue = event.target.value;
                  })} />
                  <label className="checkbox-row">
                    <input type="checkbox" checked={Boolean(object.removeAfterUse)} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                      draftObject.removeAfterUse = event.target.checked;
                    })} />
                    <span>Retirer l’objet visible après interaction</span>
                    <span className="help-dot" data-help={FIELD_HELP.removeVisibleObject} aria-label={FIELD_HELP.removeVisibleObject} tabIndex={0}>?</span>
                  </label>
                </div>
              )) : <p className="small-note">Aucun objet visible cliquable dans cette scène.</p>}
            </section>
          </div>
        ) : (
          <div className="empty-state-inline">Crée d’abord’une scène pour gérer sa logique.</div>
        )}
      </section>
    </div>
  );
}
