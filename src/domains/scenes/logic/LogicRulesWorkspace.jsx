import { useEffect, useMemo, useState } from 'react';
import { makeLogicRule } from '../../../shared/data/projectData';
import { buildLogicCompletionRefs, getLogicRuleCompletionIssues, getSceneTimerCompletionIssues } from '../../../shared/services/logicCompletion';
import { resolveAssetUrl } from '../../../shared/services/assetManager';
import { getSceneObjectBlockType, getSceneObjectClickMode } from '../../../shared/services/sceneObjectBlocks';
import MediaSourcePicker from '../../../shared/ui/media/MediaSourcePicker.jsx';
import { showConfirm } from '../../../shared/ui/AccessibleDialog';
import { useEditorPanelText } from '../../../shared/i18n';

const ACTION_LABELS = {
  default: 'Action normale de la zone',
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
  actionZones: "Zones cliquables de la scène sélectionnée, y compris les objets visibles réglés en Zone d'action. Une règle conditionnelle peut remplacer leur action normale selon l’état de la partie.",
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

const fallbackTx = (key, params = {}, fallback = '') => (
  fallback.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, paramKey) => (
    Object.prototype.hasOwnProperty.call(params || {}, paramKey) ? String(params[paramKey]) : ''
  ))
);

const mergeTranslatedLabels = (fallbacks, translations = {}) => Object.fromEntries(
  Object.entries(fallbacks).map(([key, fallback]) => [key, translations[key] || fallback]),
);

const getStoryVariableSummary = ({ key, operator = 'equals', value }, tx = fallbackTx, variableOperators = VARIABLE_OPERATORS) => {
  const operatorLabel = variableOperators[operator] || VARIABLE_OPERATORS[operator] || '=';
  const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${value ?? ''}`;
  return `${key || tx('common.variable', {}, 'variable')} ${operatorLabel}${valueLabel}`;
};

const getAdvancedConditionSummary = (condition = {}, project, getSceneLabel, tx, variableOperators) => {
  if (condition.type === 'has_item') {
    return tx('summary.item', { name: (project.items || []).find((item) => item.id === condition.itemId)?.name || tx('common.noChoiceMasc', {}, 'non choisi') }, 'Objet : {{name}}');
  }
  if (condition.type === 'visited_scene') {
    return tx('summary.scene', { name: getSceneLabel(condition.sceneId) || tx('common.noChoiceFem', {}, 'non choisie') }, 'Scène : {{name}}');
  }
  if (condition.type === 'completed_hotspot') {
    const testedHotspot = (project.scenes || []).flatMap((scene) => [
      ...(scene.hotspots || []),
      ...(scene.sceneObjects || []),
    ]).find((hotspot) => hotspot.id === condition.hotspotId);
    return tx('summary.zone', { name: testedHotspot?.name || tx('common.noChoiceFem', {}, 'non choisie') }, 'Zone : {{name}}');
  }
  if (condition.type === 'solved_enigma') {
    return tx('summary.enigma', { name: (project.enigmas || []).find((enigma) => enigma.id === condition.enigmaId)?.name || tx('common.noChoiceFem', {}, 'non choisie') }, 'Énigme : {{name}}');
  }
  if (condition.type === 'chose_reply') {
    const testedReply = getConversationReplies(project).find((entry) => entry.reply.id === condition.replyId);
    return tx('summary.reply', { name: testedReply?.reply.label || tx('common.noChoiceFem', {}, 'non choisie') }, 'Réponse : {{name}}');
  }
  if (condition.type === 'story_variable') {
    return getStoryVariableSummary({
      key: condition.variableKey,
      operator: condition.operator,
      value: condition.value,
    }, tx, variableOperators);
  }
  return tx('fields.condition', {}, 'Condition');
};

const getRuleSummary = (rule, project, text) => {
  const { tx, actionLabels, variableOperators } = text;
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
  const advancedMode = (rule.advancedConditionMode || 'all') === 'any'
    ? tx('common.or', {}, 'OU')
    : tx('common.and', {}, 'ET');
  const advancedLabels = (rule.advancedConditions || []).map((condition) => getAdvancedConditionSummary(
    condition,
    project,
    (sceneId) => project.scenes?.find((scene) => scene.id === sceneId)?.name || '',
    tx,
    variableOperators,
  ));
  let condition = {
    always: tx('summary.atUse', {}, 'À l’utilisation'),
    missing_item: tx('summary.withoutItem', { name: testedItem?.name || tx('common.item', {}, 'objet') }, 'Sans {{name}}'),
    visited_scene: tx('summary.sceneVisited', { name: testedScene?.name || tx('common.scene', {}, 'scène') }, 'Scène visitée : {{name}}'),
    completed_hotspot: tx('summary.zoneCompleted', { name: testedHotspot?.name || tx('common.zone', {}, 'zone') }, 'Zone franchie : {{name}}'),
    solved_enigma: tx('summary.enigmaSolved', { name: testedEnigma?.name || tx('common.enigma', {}, 'énigme') }, 'Énigme réussie : {{name}}'),
    launched_cinematic: tx('summary.cinematicLaunched', { name: testedCinematic?.name || tx('common.cinematic', {}, 'cinématique') }, 'Cinématique lancée : {{name}}'),
    completed_combination: tx('summary.combinationDone', { name: testedCombination?.message || tx('common.combination', {}, 'combinaison') }, 'Combinaison réalisée : {{name}}'),
    chose_reply: tx('summary.replyChosen', { name: testedReply?.reply.label || tx('common.reply', {}, 'réponse') }, 'Réponse choisie : {{name}}'),
    story_variable: getStoryVariableSummary({
      key: rule.conditionVariableKey || rule.variableKey,
      operator: rule.conditionVariableOperator || rule.operator,
      value: rule.conditionVariableValue ?? rule.value,
    }, tx, variableOperators),
    advanced: advancedLabels.length ? `${advancedMode}: ${advancedLabels.join(` ${advancedMode} `)}` : tx('summary.advancedConditions', {}, 'Conditions avancées'),
    second_click: tx('summary.secondClick', {}, 'Deuxième clic'),
    hero_health_below: tx('summary.heroHealthBelow', { value: rule.heroHealthThreshold ?? 5 }, 'PV héros < {{value}}'),
    hero_mana_at_least: tx('summary.heroManaAtLeast', { value: rule.heroManaThreshold ?? 1 }, 'Mana héros >= {{value}}'),
    hero_last_roll_success: tx('summary.heroLastRollSuccess', {}, 'Dernier jet héros réussi'),
    hero_skill_used: tx('summary.heroSkillUsed', { name: heroSkill?.name || tx('common.chooseSkill', {}, 'à choisir') }, 'Compétence : {{name}}'),
  }[rule.conditionType] || tx('summary.withItem', { name: testedItem?.name || tx('common.item', {}, 'objet') }, 'Avec {{name}}');
  if (rule.conditionType === 'launched_cinematic' && !rule.cinematicId) {
    condition = tx('summary.anyCinematicLaunched', {}, 'Une cinématique est lancée');
  }
  const action = rule.actionType === 'block'
    ? `${actionLabels.block}: ${testedBlock?.target.name || tx('common.block', {}, 'bloc')}`
    : actionLabels[rule.actionType] || tx('common.dialogue', {}, 'Dialogue');
  const reward = rewardItem ? tx('summary.givesItem', { name: rewardItem.name }, ' · donne {{name}}') : '';
  return `${condition} · ${action}${reward}`;
};

const HelpLabel = ({ children, help, className = '' }) => (
  <label className={`label-with-help${className ? ` ${className}` : ''}`}>
    <span>{children}</span>
    <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
  </label>
);

export default function LogicRulesWorkspace({
  project,
  patchProject,
  handleUpload,
  mediaLibrary = [],
  getSceneLabel,
  selectedSceneId: editorSelectedSceneId = '',
  collapsedSceneIds = new Set(),
  setSceneCollapsed,
}) {
  const { tx, txObject } = useEditorPanelText('logic');
  const actionTranslations = txObject('actions');
  const conditionTranslations = txObject('conditions');
  const advancedConditionTranslations = txObject('advancedConditions');
  const actionLabels = mergeTranslatedLabels(ACTION_LABELS, {
    ...actionTranslations,
    default: actionTranslations.defaultZone,
  });
  const conditionLabels = mergeTranslatedLabels(CONDITION_LABELS, {
    ...conditionTranslations,
    always: conditionTranslations.alwaysZone,
    completed_hotspot: conditionTranslations.completed_hotspot_zone,
    second_click: conditionTranslations.second_click_zone,
  });
  const advancedConditionLabels = mergeTranslatedLabels(ADVANCED_CONDITION_LABELS, {
    ...advancedConditionTranslations,
    completed_hotspot: advancedConditionTranslations.completed_hotspot_zone,
  });
  const variableOperators = mergeTranslatedLabels(VARIABLE_OPERATORS, txObject('operators'));
  const objectModes = mergeTranslatedLabels(OBJECT_MODES, txObject('objectModes'));
  const timerActions = SCENE_TIMER_ACTION_OPTIONS.map((option) => ({
    ...option,
    label: tx(`timerActions.${option.value}`, {}, option.label),
  }));
  const blockActionLabels = txObject('blockActions', {});
  const ruleText = { tx, actionLabels, variableOperators };

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
      title: tx('quick.deleteTitle', {}, 'Supprimer la règle'),
      message: tx('quick.deleteMessage', {}, 'Supprimer cette règle logique ?'),
      confirmLabel: tx('quick.delete', {}, 'Supprimer'),
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
    Object.entries(conditionLabels).filter(([value]) => (
      isHeroAdventureProject || !HERO_CONDITION_TYPES.has(value) || value === rule.conditionType
    ))
  );

  const renderStoryVariableFields = ({ variableKey, operator, value, onChange }) => (
    <div className="logic-story-variable-grid">
      <div>
        <HelpLabel help={tx('help.variableKey', {}, 'Clé de la variable narrative à tester. Les variables déclarées dans l’onglet Aventure sont proposées automatiquement.')}>
          {tx('fields.variable', {}, 'Variable')}
        </HelpLabel>
        <input
          value={variableKey || ''}
          list="logic-story-variable-keys"
          placeholder="confiance_du_guide"
          onChange={(event) => onChange({ variableKey: event.target.value })}
        />
      </div>
      <div>
        <HelpLabel help={tx('help.variableComparison', {}, 'Comparaison appliquée à la valeur actuelle de la variable.')}>
          {tx('fields.comparison', {}, 'Comparaison')}
        </HelpLabel>
        <select value={operator || 'equals'} onChange={(event) => onChange({ operator: event.target.value })}>
          {Object.entries(variableOperators).map(([operatorValue, label]) => (
            <option key={operatorValue} value={operatorValue}>{label}</option>
          ))}
        </select>
      </div>
      {!['truthy', 'falsy'].includes(operator || 'equals') ? (
        <div>
          <HelpLabel help={tx('help.variableValue', {}, 'Valeur attendue. Les comparaisons >= et <= convertissent en nombre.')}>
            {tx('fields.value', {}, 'Valeur')}
          </HelpLabel>
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
          {Object.entries(advancedConditionLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {conditionType === 'has_item' ? (
          <select value={condition.itemId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.itemId = event.target.value;
          })}>
            <option value="">{tx('common.item', {}, 'Objet')}</option>
            {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
        ) : null}

        {conditionType === 'visited_scene' ? (
          <select value={condition.sceneId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.sceneId = event.target.value;
          })}>
            <option value="">{tx('common.scene', {}, 'Scène')}</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
        ) : null}

        {conditionType === 'completed_hotspot' ? (
          <select value={condition.hotspotId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.hotspotId = event.target.value;
          })}>
            <option value="">{tx('common.zone', {}, 'Zone')}</option>
            {allActionTargets.map(({ scene, target: candidate, type: candidateType }) => (
              <option key={`${candidateType}-${candidate.id}`} value={candidate.id}>{getSceneLabel(scene.id)} - {candidateType === 'sceneObject' ? `${tx('common.object', {}, 'Objet')}: ` : ''}{candidate.name}</option>
            ))}
          </select>
        ) : null}

        {conditionType === 'solved_enigma' ? (
          <select value={condition.enigmaId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.enigmaId = event.target.value;
          })}>
            <option value="">{tx('common.enigma', {}, 'Énigme')}</option>
            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
          </select>
        ) : null}

        {conditionType === 'chose_reply' ? (
          <select value={condition.replyId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.replyId = event.target.value;
          })}>
            <option value="">{tx('common.reply', {}, 'Réponse')}</option>
            {conversationReplies.map(({ scene, hotspot, node, reply }) => (
              <option key={reply.id} value={reply.id}>{getSceneLabel(scene.id)} - {hotspot.name || tx('common.dialogue', {}, 'Dialogue')} - {reply.label || node.text || tx('common.reply', {}, 'Réponse')}</option>
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
        })}>{tx('quick.remove', {}, 'Retirer')}</button>
      </div>
    );
  };

  const renderConditionDetailFields = (rule, target, type) => {
    const conditionType = rule.conditionType || 'has_item';

    return (
      <>
        {['has_item', 'missing_item'].includes(conditionType) ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.testedItemWorkspace', {}, 'Objet vérifié dans l’inventaire du joueur pour savoir si la règle doit s’activer.')}>
              {tx('fields.testedItem', {}, 'Objet testé')}
            </HelpLabel>
            <select value={rule.itemId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.itemId = event.target.value;
            })}>
              <option value="">{tx('common.chooseItem', {}, 'Choisir un objet')}</option>
              {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'visited_scene' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.visitedScene', {}, 'Scène qui doit avoir déjà été visitée pendant la partie.')}>
              {tx('fields.visitedScene', {}, 'Scène visitée')}
            </HelpLabel>
            <select value={rule.conditionSceneId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.conditionSceneId = event.target.value;
            })}>
              <option value="">{tx('common.chooseScene', {}, 'Choisir une scène')}</option>
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'completed_hotspot' ? (
          <div className="logic-flow-field">
            <HelpLabel help="Zone qui doit avoir déjà terminé son action au moins une fois.">
              {tx('fields.crossedZone', {}, 'Zone d’action franchie')}
            </HelpLabel>
            <select value={rule.hotspotId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.hotspotId = event.target.value;
            })}>
              <option value="">{tx('common.chooseSelection', {}, 'Choisir une zone')}</option>
              {allActionTargets.map(({ scene, target: candidate, type: candidateType }) => (
                <option key={`${candidateType}-${candidate.id}`} value={candidate.id}>{getSceneLabel(scene.id)} - {candidateType === 'sceneObject' ? `${tx('common.object', {}, 'Objet')}: ` : ''}{candidate.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {conditionType === 'solved_enigma' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.solvedEnigma', {}, 'Énigme qui doit avoir été réussie pendant la partie.')}>
              {tx('fields.solvedEnigma', {}, 'Énigme réussie')}
            </HelpLabel>
            <select value={rule.conditionEnigmaId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.conditionEnigmaId = event.target.value;
            })}>
              <option value="">{tx('common.chooseEnigma', {}, 'Choisir une énigme')}</option>
              {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'launched_cinematic' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.launchedCinematic', {}, 'Cinématique qui doit avoir été lancée au moins une fois pendant la partie.')}>
              {tx('fields.launchedCinematic', {}, 'Cinématique lancée')}
            </HelpLabel>
            <select value={rule.cinematicId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.cinematicId = event.target.value;
            })}>
              <option value="">{tx('common.anyCinematic', {}, 'N’importe quelle cinématique lancée')}</option>
              {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
            </select>
          </div>
        ) : null}

        {conditionType === 'completed_combination' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.completedCombination', {}, 'Combinaison d’objets qui doit avoir été réalisée dans l’inventaire.')}>
              {tx('fields.completedCombination', {}, 'Combinaison réalisée')}
            </HelpLabel>
            <select value={rule.combinationId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.combinationId = event.target.value;
            })}>
              <option value="">{tx('common.chooseCombination', {}, 'Choisir une combinaison')}</option>
              {(project.combinations || []).map((combo) => {
                const itemA = project.items.find((item) => item.id === combo.itemAId);
                const itemB = project.items.find((item) => item.id === combo.itemBId);
                const result = project.items.find((item) => item.id === combo.resultItemId);
                return <option key={combo.id} value={combo.id}>{itemA?.name || tx('common.item1', {}, 'Objet 1')} + {itemB?.name || tx('common.item2', {}, 'Objet 2')} → {result?.name || tx('common.result', {}, 'Résultat')}</option>;
              })}
            </select>
          </div>
        ) : null}

        {conditionType === 'chose_reply' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.chosenReply', {}, 'Réponse de conversation qui doit avoir déjà été choisie pendant la partie.')}>
              {tx('fields.chosenReply', {}, 'Réponse choisie')}
            </HelpLabel>
            <select value={rule.conditionReplyId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.conditionReplyId = event.target.value;
            })}>
              <option value="">{tx('common.chooseReply', {}, 'Choisir une réponse')}</option>
              {conversationReplies.map(({ scene, hotspot, node, reply }) => (
                <option key={reply.id} value={reply.id}>{getSceneLabel(scene.id)} - {hotspot.name || tx('common.dialogue', {}, 'Dialogue')} - {reply.label || node.text || tx('common.reply', {}, 'Réponse')}</option>
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
          <div className="logic-flow-field logic-flow-field-wide" data-tour="logic-advanced-conditions">
            <div className="conversation-advanced-condition-list">
              <div className="conversation-advanced-condition-head">
                <HelpLabel help={tx('help.combinationMode', {}, 'Choisis ET pour exiger toutes les conditions, ou OU pour accepter au moins une condition. Exemple: variable narrative >= 3 ET réponse choisie.')}>
                  {tx('fields.combinationMode', {}, 'Combinaison')}
                </HelpLabel>
                <select value={rule.advancedConditionMode || 'all'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                  draftRule.advancedConditionMode = event.target.value;
                })}>
                  <option value="all">{tx('options.allConditions', {}, 'Toutes les conditions (ET)')}</option>
                  <option value="any">{tx('options.anyCondition', {}, 'Au moins une condition (OU)')}</option>
                </select>
              </div>
              {(rule.advancedConditions || []).map((condition, conditionIndex) => renderAdvancedConditionFields(condition, conditionIndex, rule, target, type))}
              <button type="button" className="secondary-action compact" onClick={() => updateRule(target.id, type, rule.id, (draftRule) => {
                if (!Array.isArray(draftRule.advancedConditions)) draftRule.advancedConditions = [];
                draftRule.advancedConditions.push(makeAdvancedCondition());
              })}>{tx('quick.addCondition', {}, '+ Condition')}</button>
            </div>
          </div>
        ) : null}

        {conditionType === 'hero_health_below' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.heroHealth', {}, 'La règle s’active si les PV actuels du héros sont strictement inférieurs à ce seuil.')}>
              {tx('fields.healthThreshold', {}, 'Seuil de PV')}
            </HelpLabel>
            <input type="number" min="0" value={rule.heroHealthThreshold ?? 5} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.heroHealthThreshold = Number(event.target.value);
            })} />
          </div>
        ) : null}

        {conditionType === 'hero_mana_at_least' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.heroMana', {}, 'La règle s’active si la mana actuelle du héros atteint au moins ce seuil.')}>
              {tx('fields.requiredMana', {}, 'Mana requise')}
            </HelpLabel>
            <input type="number" min="0" value={rule.heroManaThreshold ?? 1} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.heroManaThreshold = Number(event.target.value);
            })} />
          </div>
        ) : null}

        {conditionType === 'hero_skill_used' ? (
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.heroSkill', {}, 'La règle s’active si le dernier jet héros utilisait cette compétence.')}>
              {tx('fields.lastRollSkill', {}, 'Compétence du dernier jet')}
            </HelpLabel>
            <select value={rule.heroSkillId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.heroSkillId = event.target.value;
            })}>
              <option value="">{tx('common.chooseSkill', {}, 'Choisir une compétence')}</option>
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
          <HelpLabel help={tx('help.targetSceneWorkspace', {}, 'Scène ouverte si l’action déclenchée est un changement de scène.')}>
            {tx('workspace.targetScene', {}, 'Scène cible')}
          </HelpLabel>
          <select data-tour="logic-target-scene" value={rule.targetSceneId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
            draftRule.targetSceneId = event.target.value;
          })}>
            <option value="">{tx('common.chooseScene', {}, 'Choisir une scène')}</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
        </div>
      ) : null}

      {rule.actionType === 'cinematic' ? (
        <div className="logic-flow-field">
          <HelpLabel help={tx('help.targetCinematicWorkspace', {}, 'Cinématique lancée si l’action déclenchée est une cinématique.')}>
            {tx('workspace.targetCinematic', {}, 'Cinématique cible')}
          </HelpLabel>
          <select data-tour="logic-target-cinematic" value={rule.targetCinematicId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
            draftRule.targetCinematicId = event.target.value;
          })}>
            <option value="">{tx('common.chooseCinematic', {}, 'Choisir une cinématique')}</option>
            {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
          </select>
        </div>
      ) : null}

      {rule.actionType === 'block' ? (
        <>
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.targetBlock', {}, 'Bloc affiché, masqué ou modifié quand cette règle réussit.')}>
              {tx('fields.targetBlock', {}, 'Bloc cible')}
            </HelpLabel>
            <select data-tour="logic-target-block" value={rule.targetBlockId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.targetBlockId = event.target.value;
            })}>
              <option value="">{tx('common.chooseBlock', {}, 'Choisir un bloc')}</option>
              {allBlockTargets.map(({ scene, target: block }) => (
                <option key={block.id} value={block.id}>{getSceneLabel(scene.id)} - {block.name || block.blockLabel || tx('common.block', {}, 'Bloc')}</option>
              ))}
            </select>
          </div>
          <div className="logic-flow-field">
            <HelpLabel help={tx('help.blockAction', {}, 'Action appliquée au bloc cible.')}>
              {tx('fields.blockAction', {}, 'Action bloc')}
            </HelpLabel>
            <select value={rule.blockActionType || 'show'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
              draftRule.blockActionType = event.target.value;
            })}>
              <option value="show">{blockActionLabels.show || 'Afficher le bloc'}</option>
              <option value="hide">{blockActionLabels.hide || 'Masquer le bloc'}</option>
              <option value="update_text">{blockActionLabels.update_text || 'Modifier le texte visible'}</option>
            </select>
          </div>
          {rule.blockActionType === 'update_text' ? (
            <div className="logic-flow-field logic-flow-field-wide">
              <HelpLabel help={tx('help.blockText', {}, 'Nouveau texte visible du bloc cible. Selon le type, cela met à jour le texte, le bouton, le placeholder ou le titre du code.')}>
                {tx('fields.visibleBlockText', {}, 'Texte visible du bloc')}
              </HelpLabel>
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
    <div className="layout two-cols-wide logic-workspace">
      <section className="panel side panel-nav-pro scene-left-nav logic-left-nav" data-tour="logic-scene-tree">
        <div className="panel-head">
          <h2>{tx('workspace.sceneTreeTitle', {}, 'Actes et scènes')}</h2>
          <span className="status-badge soft">
            {totalRules === 1
              ? tx('workspace.ruleCountOne', {}, '1 règle')
              : tx('workspace.ruleCountMany', { count: totalRules }, '{{count}} règles')}
          </span>
        </div>
        <HelpLabel help={tx('help.sceneTree', {}, FIELD_HELP.sceneTree)}>
          {tx('workspace.sceneToConfigure', {}, 'Scène à configurer')}
        </HelpLabel>

        {acts.map((act) => {
          const actScenes = scenes.filter((scene) => scene.actId === act.id);
          return (
            <div className="act-group" key={act.id}>
              <div className="act-heading">
                <strong>{act.name}</strong>
                <span>
                  {actScenes.length === 1
                    ? tx('workspace.sceneCountOne', {}, '1 scène')
                    : tx('workspace.sceneCountMany', { count: actScenes.length }, '{{count}} scènes')}
                </span>
              </div>
              {renderSceneTree(actScenes.filter((scene) => !scene.parentSceneId))}
            </div>
          );
        })}
      </section>

      <section className="panel main logic-main-panel">
        <datalist id="logic-story-variable-keys">
          {storyVariableKeys.map((key) => <option key={key} value={key} />)}
        </datalist>
        <div className="panel-head">
          <div>
            <span className="section-kicker">{tx('workspace.kicker', {}, 'Logique')}</span>
            <h2>{selectedScene?.name || tx('workspace.noScene', {}, 'Aucune scène')}</h2>
          </div>
        </div>

        {selectedScene ? (
          <div className="editor-stack logic-editor-stack">
            <section className="combo-card logic-scene-rules-card logic-mobile-card" data-tour="logic-scene-timer">
              <div className="panel-head">
                <div>
                  <HelpLabel className="compact-section-title" help={tx('help.sceneRules', {}, "Règles qui s'appliquent à toute la scène, avant les exceptions propres aux zones d'action.")}>
                    {tx('workspace.sceneRules', {}, 'Règles de scène')}
                  </HelpLabel>
                  <p className="small-note">{tx('workspace.timerDescription', {}, 'Compte à rebours local et conséquence automatique quand le temps arrive à zéro.')}</p>
                </div>
                <span className={`status-badge ${selectedTimerIssues.length ? 'warning' : selectedScene.timerEnabled ? '' : 'soft'}`}>
                  {selectedTimerIssues.length
                    ? tx('workspace.timerIncomplete', {}, 'Timer incomplet')
                    : selectedScene.timerEnabled
                      ? tx('workspace.timerActive', {}, 'Timer actif')
                      : tx('workspace.timerInactive', {}, 'Timer inactif')}
                </span>
              </div>
              {selectedTimerIssues.length ? (
                <p className="logic-incomplete-note" role="status">
                  {tx('workspace.incompleteSetting', {}, 'Réglage incomplet:')} {selectedTimerIssues.join(' · ')}
                </p>
              ) : null}
              <div className="compact-form-grid logic-scene-timer-grid">
                <label className="checkbox-row logic-timer-toggle" data-tour="logic-timer-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedScene.timerEnabled)}
                    onChange={(event) => updateScene((scene) => {
                      scene.timerEnabled = event.target.checked;
                    })}
                  />
                  {tx('workspace.enableCountdown', {}, 'Activer un compte a rebours')}
                </label>
                <div>
                  <HelpLabel help={tx('help.timerDuration', {}, "Durée disponible dans cette scène avant l'action automatique.")}>
                    {tx('workspace.duration', {}, 'Durée')}
                  </HelpLabel>
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
                  <HelpLabel help={tx('help.timerEnd', {}, 'Action déclenchée quand le temps arrive à zéro.')}>
                    {tx('workspace.timeEnd', {}, 'Fin du temps')}
                  </HelpLabel>
                  <select
                    data-tour="logic-timer-action"
                    value={selectedTimerAction}
                    disabled={!selectedScene.timerEnabled}
                    onChange={(event) => updateScene((scene) => {
                      scene.timerEndAction = event.target.value;
                    })}
                  >
                    {timerActions.map((action) => (
                      <option key={action.value} value={action.value}>{action.label}</option>
                    ))}
                  </select>
                </div>
                {selectedTimerAction === 'scene' || selectedTimerAction === 'damage-life' ? (
                  <div>
                    <HelpLabel help={tx('help.timerTargetScene', {}, 'Scène ouverte à la fin du temps, ou quand les vies tombent à zéro.')}>
                      {tx('workspace.targetScene', {}, 'Scène cible')}
                    </HelpLabel>
                    <select
                      value={selectedScene.timerTargetSceneId || ''}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => updateScene((scene) => {
                        scene.timerTargetSceneId = event.target.value;
                      })}
                    >
                      <option value="">{tx('common.none', {}, 'Aucune')}</option>
                      {scenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {selectedTimerAction === 'cinematic' ? (
                  <div>
                    <HelpLabel help={tx('help.timerTargetCinematic', {}, 'Cinématique lancée automatiquement quand le temps arrive à zéro.')}>
                      {tx('workspace.targetCinematic', {}, 'Cinématique cible')}
                    </HelpLabel>
                    <select
                      value={selectedScene.timerTargetCinematicId || ''}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => updateScene((scene) => {
                        scene.timerTargetCinematicId = event.target.value;
                      })}
                    >
                      <option value="">{tx('common.none', {}, 'Aucune')}</option>
                      {(project.cinematics || []).map((cinematic) => (
                        <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {selectedTimerAction === 'damage-life' ? (
                  <div>
                    <HelpLabel help={tx('help.livesLost', {}, "Nombre de vies perdues quand le temps expire. Le joueur commence avec 3 vies dans l'aperçu.")}>
                      {tx('workspace.livesLost', {}, 'Vies perdues')}
                    </HelpLabel>
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
                  <HelpLabel help={tx('help.endMessage', {}, "Texte affiché si l'action de fin a besoin d'un message.")}>
                    {tx('workspace.endMessage', {}, 'Message de fin')}
                  </HelpLabel>
                  <input
                    data-tour="logic-timer-message"
                    value={selectedScene.timerEndMessage || ''}
                    disabled={!selectedScene.timerEnabled}
                    onChange={(event) => updateScene((scene) => {
                      scene.timerEndMessage = event.target.value;
                    })}
                    placeholder={tx('options.timeExpired', {}, 'Le temps est écoulé.')}
                  />
                </div>
              </div>
            </section>

            <section className="combo-card logic-action-zones-card logic-mobile-card" data-tour="logic-zones">
              <div className="panel-head">
                <HelpLabel className="compact-section-title" help={tx('help.actionZones', {}, FIELD_HELP.actionZones)}>
                  {tx('workspace.actionZones', {}, 'Zones d’action')}
                </HelpLabel>
                <span className="status-badge soft">{selectedActionTargets.length}</span>
              </div>
              {selectedActionTargets.map(({ target, type }) => (
                <div className="combo-card logic-target-card" key={`${type}-${target.id}`}>
                  <div className="panel-head">
                    <div>
                      <h3>{target.name}</h3>
                      <p className="small-note">
                        {type === 'sceneObject' ? `${tx('common.object', {}, 'Image-zone')} · ` : ''}
                        {(target.logicRules || []).length === 1
                          ? tx('workspace.conditionalRuleCountOne', {}, '1 règle conditionnelle')
                          : tx('workspace.conditionalRuleCountMany', { count: (target.logicRules || []).length }, '{{count}} règles conditionnelles')}
                      </p>
                    </div>
                    <div className="label-with-help" data-tour="logic-add-rule">
                      <button type="button" onClick={() => addRule(target.id, type)}>{tx('quick.addRule', {}, '+ Règle')}</button>
                      <span className="help-dot" data-help={tx('help.addRule', {}, FIELD_HELP.addRule)} aria-label={tx('help.addRule', {}, FIELD_HELP.addRule)} tabIndex={0}>?</span>
                    </div>
                  </div>

                  {(target.logicRules || []).length ? (
                    <div className="logic-rule-list">
                      {target.logicRules.map((rule) => {
                        const ruleCompletionIssues = getLogicRuleCompletionIssues(rule, logicCompletionRefs);
                        return (
                    <details className={`logic-rule-card${ruleCompletionIssues.length ? ' incomplete' : ''}`} key={rule.id} open data-tour="logic-rule-card">
                      <summary>
                        <span>
                          <span className="logic-rule-name-line">
                            <strong>{rule.name || tx('common.rule', {}, 'Règle')}</strong>
                            {ruleCompletionIssues.length ? <em className="logic-incomplete-pill">{tx('quick.incompleteRule', {}, 'Règle incomplète')}</em> : null}
                          </span>
                          <small>{getRuleSummary(rule, project, ruleText)}</small>
                          {ruleCompletionIssues.length ? (
                            <small className="logic-incomplete-details">{ruleCompletionIssues.join(' · ')}</small>
                          ) : null}
                        </span>
                        <button type="button" className="danger-button" onClick={(event) => {
                          event.preventDefault();
                          deleteRule(target.id, type, rule.id);
                        }}>
                          {tx('quick.delete', {}, 'Supprimer')}
                        </button>
                      </summary>
                      <div className="logic-rule-body">
                        <div className="logic-rule-name-field" data-tour="logic-rule-name">
                          <HelpLabel help={tx('help.ruleNameWorkspace', {}, 'Nom interne pour reconnaître rapidement cette règle dans la liste compacte.')}>
                            {tx('fields.ruleName', {}, 'Nom de la règle')}
                          </HelpLabel>
                          <input value={rule.name || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.name = event.target.value;
                          })} />
                        </div>

                        <section className="logic-flow-step logic-flow-step-condition" data-tour="logic-condition-step">
                          <div className="logic-flow-step-head">
                            <span className="logic-flow-keyword">{tx('workspace.ifKeyword', {}, 'Si')}</span>
                            <HelpLabel className="logic-flow-title" help={tx('help.conditionFlow', {}, 'Détermine quand cette règle remplace l’action normale de la zone. La première règle qui correspond est utilisée.')}>
                              {tx('workspace.whenCondition', {}, 'cette condition est respectée')}
                            </HelpLabel>
                          </div>
                          <div className="logic-flow-grid">
                            <div className="logic-flow-field">
                              <HelpLabel help={tx('help.conditionToCheck', {}, 'Type de condition à vérifier pendant la partie.')}>
                                {tx('fields.conditionToCheck', {}, 'Condition à vérifier')}
                              </HelpLabel>
                              <select data-tour="logic-condition" value={rule.conditionType || 'has_item'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.conditionType = event.target.value;
                              })}>
                                {getConditionOptions(rule).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </div>
                            {renderConditionDetailFields(rule, target, type)}
                          </div>
                        </section>

                        <section className="logic-flow-step logic-flow-step-action" data-tour="logic-action-step">
                          <div className="logic-flow-step-head">
                            <span className="logic-flow-keyword">{tx('workspace.thenKeyword', {}, 'Alors')}</span>
                            <HelpLabel className="logic-flow-title" help={tx('help.actionFlow', {}, 'Action exécutée à la place de l’action normale de la zone quand la condition est vraie.')}>
                              {tx('workspace.thenAction', {}, 'cette action est déclenchée')}
                            </HelpLabel>
                          </div>
                          <div className="logic-flow-grid">
                            <div className="logic-flow-field">
                              <HelpLabel help={tx('help.actionFlow', {}, 'Action exécutée à la place de l’action normale de la zone quand la condition est vraie.')}>
                                {tx('fields.triggeredAction', {}, 'Action déclenchée')}
                              </HelpLabel>
                              <select data-tour="logic-action" value={rule.actionType || 'dialogue'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.actionType = event.target.value;
                              })}>
                                {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </div>
                            <div className="logic-flow-field">
                              <HelpLabel help={tx('help.rewardItemWorkspace', {}, 'Objet ajouté à l’inventaire quand cette règle s’active. Laisse Aucun si la règle ne donne rien.')}>
                                {tx('fields.rewardItem', {}, 'Objet donné')}
                              </HelpLabel>
                              <select data-tour="logic-reward-item" value={rule.rewardItemId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.rewardItemId = event.target.value;
                              })}>
                                <option value="">{tx('common.none', {}, 'Aucun')}</option>
                                {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                              </select>
                            </div>
                            {renderActionTargetFields(rule, target, type)}
                            <div className="logic-flow-field">
                              <HelpLabel help={tx('help.successDialogue', {}, 'Message affiché au joueur quand cette règle s’active. Il remplace le dialogue normal de la zone.')}>
                                {tx('fields.displayedDialogue', {}, 'Dialogue affiché')}
                              </HelpLabel>
                              <textarea data-tour="logic-dialogue" value={rule.dialogue || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.dialogue = event.target.value;
                              })} />
                            </div>
                            <div className="logic-sound-field" data-tour="logic-success-sound">
                              <HelpLabel help={tx('help.successSound', {}, 'Son joué quand la condition est remplie et que l’action de cette règle se lance.')}>
                                {tx('fields.successSound', {}, 'Son si condition réussie')}
                              </HelpLabel>
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
                                {rule.successSoundName || tx('options.importSuccessSound', {}, 'Importer un son de réussite')}
                              </MediaSourcePicker>
                              {getRuleSoundUrl(rule, 'success') ? (
                                <div className="logic-sound-preview">
                                  <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'success')} />
                                  <button type="button" className="danger-button" onClick={() => clearRuleSound(target.id, type, rule.id, 'success')}>{tx('quick.delete', {}, 'Supprimer')}</button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </section>

                        <details className="logic-flow-step logic-flow-step-failure" open={Boolean(rule.failureDialogue || getRuleSoundUrl(rule, 'failure'))} data-tour="logic-failure-step">
                          <summary className="logic-flow-step-head">
                            <span className="logic-flow-keyword">{tx('workspace.elseKeyword', {}, 'Sinon')}</span>
                            <HelpLabel className="logic-flow-title" help={tx('help.failureFlow', {}, 'Réponse utilisée quand cette règle est configurée mais que sa condition n’est pas remplie.')}>
                              {tx('workspace.ifConditionFails', {}, 'si la condition n’est pas remplie')}
                            </HelpLabel>
                          </summary>
                          <div className="logic-flow-grid">
                            <div className="logic-flow-field">
                              <HelpLabel help={tx('help.failureDialogueLong', {}, 'Message affiché si cette règle ne peut pas s’activer parce que sa condition n’est pas remplie. Exemple : il manque une clé, une énigme n’est pas encore réussie, ou une cinématique n’a pas encore été lancée.')}>
                                {tx('fields.dialogueIfFailed', {}, 'Dialogue si condition non remplie')}
                              </HelpLabel>
                              <textarea data-tour="logic-failure-dialogue" value={rule.failureDialogue || ''} placeholder={tx('options.lockedDoorExample', {}, 'Exemple : La porte reste verrouillée. Il te manque la clé.')} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.failureDialogue = event.target.value;
                              })} />
                            </div>
                            <div className="logic-sound-field">
                              <HelpLabel help={tx('help.failureSound', {}, 'Son joué quand cette règle est configurée mais que sa condition n’est pas remplie.')}>
                                {tx('fields.failureSound', {}, 'Son si condition échouée')}
                              </HelpLabel>
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
                                {rule.failureSoundName || tx('options.importFailureSound', {}, "Importer un son d'échec")}
                              </MediaSourcePicker>
                              {getRuleSoundUrl(rule, 'failure') ? (
                                <div className="logic-sound-preview">
                                  <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'failure')} />
                                  <button type="button" className="danger-button" onClick={() => clearRuleSound(target.id, type, rule.id, 'failure')}>{tx('quick.delete', {}, 'Supprimer')}</button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </details>

                        <details className="logic-flow-step logic-flow-step-options" open={Boolean(rule.consumeRequiredItemOnUse || rule.disableAfterUse)} data-tour="logic-options-step">
                          <summary className="logic-flow-step-head">
                            <span className="logic-flow-keyword">{tx('workspace.optionsKeyword', {}, 'Options')}</span>
                            <HelpLabel className="logic-flow-title" help={tx('help.ruleSettings', {}, 'Réglages complémentaires appliqués après l’activation de la règle.')}>
                              {tx('workspace.ruleSettings', {}, 'réglages de la règle')}
                            </HelpLabel>
                          </summary>
                          <div className="logic-flow-options">
                            {rule.conditionType === 'has_item' ? (
                              <label className="checkbox-row">
                                <input type="checkbox" checked={Boolean(rule.consumeRequiredItemOnUse)} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                  draftRule.consumeRequiredItemOnUse = event.target.checked;
                                })} />
                                <span>{tx('workspace.consumeTestedItemLong', {}, 'Consommer l’objet testé quand la règle s’active')}</span>
                                <span className="help-dot" data-help={tx('help.consumeRequiredItem', {}, FIELD_HELP.consumeRequiredItem)} aria-label={tx('help.consumeRequiredItem', {}, FIELD_HELP.consumeRequiredItem)} tabIndex={0}>?</span>
                              </label>
                            ) : null}
                            <label className="checkbox-row">
                              <input type="checkbox" checked={Boolean(rule.disableAfterUse)} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.disableAfterUse = event.target.checked;
                              })} />
                              <span>{tx('workspace.disableRuleAfterUseLong', {}, 'Cette règle ne s’applique qu’une fois, puis s’annule')}</span>
                              <span className="help-dot" data-help={tx('help.disableRuleAfterUse', {}, FIELD_HELP.disableRuleAfterUse)} aria-label={tx('help.disableRuleAfterUse', {}, FIELD_HELP.disableRuleAfterUse)} tabIndex={0}>?</span>
                            </label>
                          </div>
                        </details>
                      </div>
                    </details>
                        );
                      })}
                    </div>
                  ) : <p className="small-note">{tx('workspace.normalZoneLogic', {}, 'Cette zone utilise sa logique normale.')}</p>}
                </div>
              ))}
            </section>

            <section className="combo-card logic-visible-objects-card logic-mobile-card" data-tour="logic-visible-objects">
              <div className="panel-head">
                <HelpLabel className="compact-section-title" help={tx('help.visibleObjects', {}, FIELD_HELP.visibleObjects)}>
                  {tx('workspace.visibleObjectReactions', {}, 'Réactions des objets visibles')}
                </HelpLabel>
                <span className="status-badge soft">{selectedClickableObjects.length}</span>
              </div>
              {selectedClickableObjects.length ? selectedClickableObjects.map((object) => (
                <div className="combo-card logic-visible-object-card" key={object.id}>
                  <div className="logic-visible-object-head" data-tour="logic-visible-object-card">
                    <strong>{object.name || tx('common.visibleObject', {}, 'Objet visible')}</strong>
                    <span>{objectModes[object.interactionMode || 'popup'] || tx('fields.interactionMode', {}, 'Interaction')}</span>
                  </div>
                  <div className="grid-two">
                    <div>
                      <HelpLabel help={tx('help.interactionMode', {}, 'Choisis si l’objet ouvre une image pop-up, rejoint l’inventaire, ou fait les deux au clic.')}>
                        {tx('fields.interactionMode', {}, 'Mode d’interaction')}
                      </HelpLabel>
                      <select value={object.interactionMode || 'popup'} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                        draftObject.interactionMode = event.target.value;
                      })}>
                        {Object.entries(objectModes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <div>
                      <HelpLabel help={tx('help.linkedInventoryItem', {}, 'Objet ajouté à l’inventaire quand le mode d’interaction inclut l’inventaire.')}>
                        {tx('fields.linkedInventoryItem', {}, 'Objet d’inventaire lié')}
                      </HelpLabel>
                      <select value={object.linkedItemId || ''} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                        draftObject.linkedItemId = event.target.value;
                      })}>
                        <option value="">{tx('common.none', {}, 'Aucun')}</option>
                        {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <HelpLabel help={tx('help.visibleObjectDialogue', {}, 'Message affiché quand le joueur clique sur cet objet visible.')}>
                    {tx('common.dialogue', {}, 'Dialogue')}
                  </HelpLabel>
                  <textarea value={object.dialogue || ''} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                    draftObject.dialogue = event.target.value;
                  })} />
                  <label className="checkbox-row">
                    <input type="checkbox" checked={Boolean(object.removeAfterUse)} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                      draftObject.removeAfterUse = event.target.checked;
                    })} />
                    <span>{tx('workspace.removeVisibleObjectAfterUse', {}, 'Retirer l’objet visible après interaction')}</span>
                    <span className="help-dot" data-help={tx('help.removeVisibleObject', {}, FIELD_HELP.removeVisibleObject)} aria-label={tx('help.removeVisibleObject', {}, FIELD_HELP.removeVisibleObject)} tabIndex={0}>?</span>
                  </label>
                </div>
              )) : <p className="small-note">{tx('workspace.noClickableVisibleObject', {}, 'Aucun objet visible cliquable dans cette scène.')}</p>}
            </section>
          </div>
        ) : (
          <div className="empty-state-inline">{tx('workspace.createSceneFirst', {}, 'Crée d’abord une scène pour gérer sa logique.')}</div>
        )}
      </section>
    </div>
  );
}
