import { makeLogicRule } from '../../../../shared/data/projectData';
import { buildLogicCompletionRefs, getLogicRuleCompletionIssues } from '../../../../shared/services/logicCompletion';
import { resolveAssetUrl } from '../../../../shared/services/assetManager';
import MediaSourcePicker from '../../../../shared/ui/media/MediaSourcePicker.jsx';
import { showConfirm } from '../../../../shared/ui/AccessibleDialog';
import { useEditorPanelText } from '../../../../shared/i18n';
import { HelpLabel } from './SceneEditorChrome.jsx';
import { getSceneObjectBlockType } from '../../../../shared/services/sceneObjectBlocks';

const ACTION_LABELS = {
  default: 'Action normale',
  dialogue: 'Dialogue',
  dialogue_item: 'Dialogue + objet',
  scene: 'Changer de scène',
  cinematic: 'Lancer une cinématique',
  block: 'Agir sur un bloc',
};

const CONDITION_LABELS = {
  always: 'Quand cette sélection est utilisée',
  has_item: "Si le joueur possède l'objet",
  missing_item: "Si le joueur ne possède pas l'objet",
  visited_scene: 'Si une scène a été visitée',
  completed_hotspot: "Si une zone ou un bloc a déjà été utilisé",
  solved_enigma: 'Si une énigme est réussie',
  launched_cinematic: 'Si une cinématique est lancée',
  completed_combination: 'Si une combinaison est réalisée',
  chose_reply: 'Si une réponse a été choisie',
  story_variable: 'Si une variable narrative correspond',
  advanced: 'Conditions avancées combinées',
  second_click: 'Au deuxième clic',
};

Object.assign(CONDITION_LABELS, {
  hero_health_below: 'Si les PV du héros sont inférieurs à',
  hero_mana_at_least: 'Si le héros a assez de mana',
  hero_last_roll_success: 'Si le dernier jet héros est réussi',
  hero_skill_used: 'Si la dernière compétence utilisée est',
});

const HERO_CONDITION_TYPES = new Set([
  'hero_health_below',
  'hero_mana_at_least',
  'hero_last_roll_success',
  'hero_skill_used',
]);

const ADVANCED_CONDITION_LABELS = {
  has_item: 'Objet possédé',
  visited_scene: 'Scène visitée',
  completed_hotspot: 'Sélection utilisée',
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

const getTargetList = (project) => (project.scenes || []).flatMap((scene) => [
  ...(scene.hotspots || []).map((target) => ({ scene, target, type: 'hotspot' })),
  ...(scene.sceneObjects || []).map((target) => ({ scene, target, type: 'sceneObject' })),
]);

const getBlockList = (project) => (project.scenes || []).flatMap((scene) => (
  (scene.sceneObjects || [])
    .filter((target) => getSceneObjectBlockType(target) !== 'object')
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
  const operatorLabel = VARIABLE_OPERATORS[operator] || '=';
  const localizedOperatorLabel = variableOperators[operator] || operatorLabel;
  const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${value ?? ''}`;
  return `${key || tx('common.variable', {}, 'variable')} ${localizedOperatorLabel}${valueLabel}`;
};

const getAdvancedConditionSummary = (condition = {}, project, getSceneLabel, tx, variableOperators) => {
  if (condition.type === 'has_item') {
    return tx('summary.item', { name: (project.items || []).find((item) => item.id === condition.itemId)?.name || tx('common.noChoiceMasc', {}, 'non choisi') }, 'Objet : {{name}}');
  }
  if (condition.type === 'visited_scene') {
    return tx('summary.scene', { name: getSceneLabel?.(condition.sceneId) || tx('common.noChoiceFem', {}, 'non choisie') }, 'Scène : {{name}}');
  }
  if (condition.type === 'completed_hotspot') {
    const testedTarget = getTargetList(project).find((entry) => entry.target.id === condition.hotspotId);
    return tx('summary.selection', { name: testedTarget?.target.name || tx('common.noChoiceFem', {}, 'non choisie') }, 'Sélection : {{name}}');
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

const getRuleSummary = (rule, project, getSceneLabel, text) => {
  const { tx, actionLabels, variableOperators } = text;
  const item = (project.items || []).find((entry) => entry.id === rule.itemId);
  const testedScene = (project.scenes || []).find((entry) => entry.id === (rule.conditionSceneId || rule.sceneId));
  const target = getTargetList(project).find((entry) => entry.target.id === rule.hotspotId);
  const enigma = (project.enigmas || []).find((entry) => entry.id === rule.conditionEnigmaId);
  const cinematic = (project.cinematics || []).find((entry) => entry.id === rule.cinematicId);
  const testedReply = getConversationReplies(project).find((entry) => entry.reply.id === (rule.conditionReplyId || rule.replyId));
  const block = getBlockList(project).find((entry) => entry.target.id === rule.targetBlockId);
  const heroSkill = project.heroAdventure?.hero?.skills?.find((skill) => skill.id === rule.heroSkillId);
  const advancedMode = (rule.advancedConditionMode || 'all') === 'any'
    ? tx('common.or', {}, 'OU')
    : tx('common.and', {}, 'ET');
  const advancedLabels = (rule.advancedConditions || []).map((condition) => (
    getAdvancedConditionSummary(condition, project, getSceneLabel, tx, variableOperators)
  ));
  const condition = {
    always: tx('summary.atUse', {}, "À l'utilisation"),
    missing_item: tx('summary.withoutItem', { name: item?.name || tx('common.item', {}, 'objet') }, 'Sans {{name}}'),
    visited_scene: tx('summary.sceneVisited', { name: testedScene?.name || tx('common.scene', {}, 'scène') }, 'Scène visitée : {{name}}'),
    completed_hotspot: `${getSceneLabel?.(target?.scene.id) || tx('common.scene', {}, 'Scène')} - ${target?.target.name || tx('common.zone', {}, 'zone')}`,
    solved_enigma: tx('summary.enigmaSolved', { name: enigma?.name || tx('common.chooseEnigma', {}, 'à choisir') }, 'Énigme réussie : {{name}}'),
    launched_cinematic: tx('summary.cinematicLaunched', { name: cinematic?.name || tx('common.anyCinematic', {}, "n'importe laquelle") }, 'Cinématique lancée : {{name}}'),
    completed_combination: tx('summary.combinationDone', { name: tx('common.combination', {}, 'Combinaison') }, 'Combinaison réalisée'),
    chose_reply: tx('summary.replyChosen', { name: testedReply?.reply.label || tx('common.reply', {}, 'réponse') }, 'Réponse choisie : {{name}}'),
    story_variable: getStoryVariableSummary({
      key: rule.conditionVariableKey || rule.variableKey,
      operator: rule.conditionVariableOperator || rule.operator,
      value: rule.conditionVariableValue ?? rule.value,
    }, tx, variableOperators),
    advanced: advancedLabels.length ? `${advancedMode}: ${advancedLabels.join(` ${advancedMode} `)}` : tx('summary.advancedConditions', {}, 'Conditions avancées'),
    second_click: tx('summary.secondClick', {}, 'Deuxième clic'),
  }[rule.conditionType] || tx('summary.withItem', { name: item?.name || tx('common.item', {}, 'objet') }, 'Avec {{name}}');
  const action = rule.actionType === 'block'
    ? `${actionLabels.block}: ${block?.target.name || tx('common.block', {}, 'bloc')}`
    : actionLabels[rule.actionType] || tx('common.dialogue', {}, 'Dialogue');
  const heroCondition = {
    hero_health_below: tx('summary.heroHealthBelow', { value: rule.heroHealthThreshold ?? 5 }, 'PV héros < {{value}}'),
    hero_mana_at_least: tx('summary.heroManaAtLeast', { value: rule.heroManaThreshold ?? 1 }, 'Mana héros >= {{value}}'),
    hero_last_roll_success: tx('summary.heroLastRollSuccess', {}, 'Dernier jet héros réussi'),
    hero_skill_used: tx('summary.heroSkillUsed', { name: heroSkill?.name || tx('common.chooseSkill', {}, 'à choisir') }, 'Compétence : {{name}}'),
  }[rule.conditionType];
  return `${heroCondition || condition} -> ${action}`;
};

export default function QuickLogicModal({
  project,
  selectedSceneId,
  targetRef,
  patchProject,
  handleUpload,
  mediaLibrary = [],
  onClose,
  getSceneLabel,
}) {
  const { tx, txObject } = useEditorPanelText('logic');
  const actionLabels = mergeTranslatedLabels(ACTION_LABELS, txObject('actions'));
  const conditionLabels = mergeTranslatedLabels(CONDITION_LABELS, txObject('conditions'));
  const advancedConditionLabels = mergeTranslatedLabels(ADVANCED_CONDITION_LABELS, txObject('advancedConditions'));
  const variableOperators = mergeTranslatedLabels(VARIABLE_OPERATORS, txObject('operators'));
  const blockActionLabels = txObject('blockActions', {});
  const ruleText = { tx, actionLabels, variableOperators };

  if (!targetRef) return null;
  const selectedScene = (project.scenes || []).find((scene) => scene.id === selectedSceneId);
  const target = targetRef.type === 'sceneObject'
    ? selectedScene?.sceneObjects?.find((entry) => entry.id === targetRef.id)
    : selectedScene?.hotspots?.find((entry) => entry.id === targetRef.id);

  if (!selectedScene || !target) return null;

  const allTargets = getTargetList(project);
  const allBlocks = getBlockList(project);
  const conversationReplies = getConversationReplies(project);
  const storyVariableKeys = [...new Set((project.storyVariables || []).map((variable) => variable.key).filter(Boolean))];
  const logicCompletionRefs = buildLogicCompletionRefs(project);
  const isHeroAdventureProject = Boolean(project.creationMode === 'hero_adventure' || project.heroAdventure?.enabled);
  const heroSkills = project.heroAdventure?.hero?.skills || [];
  const rules = target.logicRules || [];
  const getConditionOptions = (rule) => (
    Object.entries(conditionLabels).filter(([value]) => (
      isHeroAdventureProject || !HERO_CONDITION_TYPES.has(value) || value === rule.conditionType
    ))
  );
  const patchTarget = (updater) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      const draftTarget = targetRef.type === 'sceneObject'
        ? scene?.sceneObjects?.find((entry) => entry.id === targetRef.id)
        : scene?.hotspots?.find((entry) => entry.id === targetRef.id);
      if (draftTarget) updater(draftTarget);
    });
  };
  const addRule = () => {
    patchTarget((draftTarget) => {
      if (!Array.isArray(draftTarget.logicRules)) draftTarget.logicRules = [];
      draftTarget.logicRules.push(makeLogicRule());
    });
  };
  const updateRule = (ruleId, updater) => {
    patchTarget((draftTarget) => {
      const rule = draftTarget.logicRules?.find((entry) => entry.id === ruleId);
      if (rule) updater(rule);
    });
  };
  const deleteRule = async (ruleId) => {
    const confirmed = await showConfirm({
      title: tx('quick.deleteTitle', {}, 'Supprimer la règle'),
      message: tx('quick.deleteMessage', {}, 'Supprimer cette règle logique ?'),
      confirmLabel: tx('quick.delete', {}, 'Supprimer'),
      variant: 'danger',
    });
    if (!confirmed) return;
    patchTarget((draftTarget) => {
      draftTarget.logicRules = (draftTarget.logicRules || []).filter((rule) => rule.id !== ruleId);
    });
  };
  const clearRuleSound = (ruleId, kind) => {
    updateRule(ruleId, (draftRule) => {
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

  const renderStoryVariableFields = ({ variableKey, operator, value, onChange }) => (
    <div className="logic-story-variable-grid">
      <div>
        <HelpLabel help={tx('help.variableKey', {}, "Clé de la variable narrative à tester. Les variables déclarées dans l'onglet Aventure sont proposées automatiquement.")}>
          {tx('fields.variable', {}, 'Variable')}
        </HelpLabel>
        <input
          value={variableKey || ''}
          list="quick-logic-story-variable-keys"
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

  const renderAdvancedConditionFields = (condition, conditionIndex, rule) => {
    const conditionType = condition.type || 'has_item';
    const updateAdvancedCondition = (updater) => updateRule(rule.id, (draftRule) => {
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
            {(project.scenes || []).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>)}
          </select>
        ) : null}

        {conditionType === 'completed_hotspot' ? (
          <select value={condition.hotspotId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.hotspotId = event.target.value;
          })}>
            <option value="">{tx('common.selection', {}, 'Sélection')}</option>
            {allTargets.map(({ scene, target: candidate, type }) => (
              <option key={`${type}-${candidate.id}`} value={candidate.id}>
                {getSceneLabel?.(scene.id) || scene.name} - {candidate.name || (type === 'sceneObject' ? tx('common.object', {}, 'Objet') : tx('common.zone', {}, 'Zone'))}
              </option>
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
              <option key={reply.id} value={reply.id}>{getSceneLabel?.(scene.id) || scene.name} - {hotspot.name || tx('common.dialogue', {}, 'Dialogue')} - {reply.label || node.text || tx('common.reply', {}, 'Réponse')}</option>
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

        <button type="button" className="secondary-action compact danger-action" onClick={() => updateRule(rule.id, (draftRule) => {
          draftRule.advancedConditions = (draftRule.advancedConditions || []).filter((_, index) => index !== conditionIndex);
        })}>{tx('quick.remove', {}, 'Retirer')}</button>
      </div>
    );
  };

  return (
    <div className="quick-logic-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section className="quick-logic-modal overlay-card wide" onMouseDown={(event) => event.stopPropagation()}>
        <datalist id="quick-logic-story-variable-keys">
          {storyVariableKeys.map((key) => <option key={key} value={key} />)}
        </datalist>
        <header className="quick-logic-head">
          <div>
            <span className="section-kicker">{tx('quick.kicker', {}, 'Logique rapide')}</span>
            <h2>{target.name || tx('common.selection', {}, 'Sélection')}</h2>
            <p className="small-note">
              {rules.length === 1
                ? tx('quick.oneRuleOnSelection', {}, '1 règle sur cette sélection.')
                : tx('quick.manyRulesOnSelection', { count: rules.length }, '{{count}} règles sur cette sélection.')}
            </p>
          </div>
          <div className="quick-logic-actions">
            <button type="button" className="secondary-action" onClick={addRule}>{tx('quick.addRule', {}, '+ Règle')}</button>
            <button type="button" onClick={onClose}>{tx('quick.close', {}, 'Fermer')}</button>
          </div>
        </header>

        {rules.length ? rules.map((rule) => {
          const ruleCompletionIssues = getLogicRuleCompletionIssues(rule, logicCompletionRefs);
          return (
          <details className={`logic-rule-card quick-logic-rule${ruleCompletionIssues.length ? ' incomplete' : ''}`} key={rule.id} open>
            <summary>
              <span>
                <span className="logic-rule-name-line">
                  <strong>{rule.name || tx('common.rule', {}, 'Règle')}</strong>
                  {ruleCompletionIssues.length ? <em className="logic-incomplete-pill">{tx('quick.incompleteRule', {}, 'Règle incomplète')}</em> : null}
                </span>
                <small>{getRuleSummary(rule, project, getSceneLabel, ruleText)}</small>
                {ruleCompletionIssues.length ? (
                  <small className="logic-incomplete-details">{ruleCompletionIssues.join(' · ')}</small>
                ) : null}
              </span>
              <button type="button" className="danger-button" onClick={(event) => {
                event.preventDefault();
                deleteRule(rule.id);
              }}>
                {tx('quick.delete', {}, 'Supprimer')}
              </button>
            </summary>
            <div className="logic-rule-body">
              {rule.conditionType === 'hero_health_below' ? (
                <>
                  <HelpLabel help={tx('help.heroHealth', {}, "La règle s'active si les PV actuels du héros sont strictement inférieurs à ce seuil.")}>
                    {tx('fields.healthThreshold', {}, 'Seuil de PV')}
                  </HelpLabel>
                  <input type="number" min="0" value={rule.heroHealthThreshold ?? 5} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.heroHealthThreshold = Number(event.target.value);
                  })} />
                </>
              ) : null}

              {rule.conditionType === 'hero_mana_at_least' ? (
                <>
                  <HelpLabel help={tx('help.heroMana', {}, "La règle s'active si la mana actuelle du héros atteint au moins ce seuil.")}>
                    {tx('fields.requiredMana', {}, 'Mana requise')}
                  </HelpLabel>
                  <input type="number" min="0" value={rule.heroManaThreshold ?? 1} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.heroManaThreshold = Number(event.target.value);
                  })} />
                </>
              ) : null}

              {rule.conditionType === 'hero_skill_used' ? (
                <>
                  <HelpLabel help={tx('help.heroSkill', {}, "La règle s'active si le dernier jet héros utilisait cette compétence.")}>
                    {tx('fields.lastRollSkill', {}, 'Compétence du dernier jet')}
                  </HelpLabel>
                  <select value={rule.heroSkillId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.heroSkillId = event.target.value;
                  })}>
                    <option value="">{tx('common.chooseSkill', {}, 'Choisir une compétence')}</option>
                    {heroSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                  </select>
                </>
              ) : null}

              <div className="quick-logic-grid">
                <div>
                  <HelpLabel help={tx('help.ruleName', {}, "Nom court pour retrouver cette règle plus tard dans l'onglet Logique.")}>
                    {tx('fields.ruleName', {}, 'Nom de la règle')}
                  </HelpLabel>
                  <input value={rule.name || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.name = event.target.value;
                  })} />
                </div>
                <div>
                  <HelpLabel help={tx('help.condition', {}, 'Condition qui doit être vraie pour déclencher cette règle.')}>
                    {tx('fields.condition', {}, 'Condition')}
                  </HelpLabel>
                  <select value={rule.conditionType || 'has_item'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionType = event.target.value;
                  })}>
                    {getConditionOptions(rule).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </div>

              {['has_item', 'missing_item'].includes(rule.conditionType || 'has_item') ? (
                <>
                  <HelpLabel help={tx('help.testedItem', {}, "Objet vérifié dans l'inventaire du joueur.")}>
                    {tx('fields.testedItem', {}, 'Objet testé')}
                  </HelpLabel>
                  <select value={rule.itemId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.itemId = event.target.value;
                  })}>
                    <option value="">{tx('common.chooseItem', {}, 'Choisir un objet')}</option>
                    {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'completed_hotspot' ? (
                <>
                  <HelpLabel help={tx('help.usedSelection', {}, 'Sélection que le joueur doit avoir déjà utilisée.')}>
                    {tx('fields.usedSelection', {}, 'Sélection déjà utilisée')}
                  </HelpLabel>
                  <select value={rule.hotspotId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.hotspotId = event.target.value;
                  })}>
                    <option value="">{tx('common.chooseSelection', {}, 'Choisir une sélection')}</option>
                    {allTargets.map(({ scene, target: candidate, type }) => (
                      <option key={`${type}-${candidate.id}`} value={candidate.id}>
                        {getSceneLabel?.(scene.id) || scene.name} - {candidate.name || (type === 'sceneObject' ? tx('common.object', {}, 'Objet') : tx('common.zone', {}, 'Zone'))}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'solved_enigma' ? (
                <>
                  <HelpLabel help={tx('help.solvedEnigma', {}, "Énigme qui doit être réussie avant d'activer cette règle.")}>
                    {tx('fields.solvedEnigma', {}, 'Énigme réussie')}
                  </HelpLabel>
                  <select value={rule.conditionEnigmaId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionEnigmaId = event.target.value;
                  })}>
                    <option value="">{tx('common.chooseEnigma', {}, 'Choisir une énigme')}</option>
                    {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'launched_cinematic' ? (
                <>
                  <HelpLabel help={tx('help.launchedCinematic', {}, 'Cinématique qui doit avoir été lancée.')}>
                    {tx('fields.launchedCinematic', {}, 'Cinématique lancée')}
                  </HelpLabel>
                  <select value={rule.cinematicId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.cinematicId = event.target.value;
                  })}>
                    <option value="">{tx('common.anyCinematic', {}, "N'importe quelle cinématique")}</option>
                    {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'completed_combination' ? (
                <>
                  <HelpLabel help={tx('help.completedCombination', {}, "Combinaison d'objets qui doit avoir été réalisée.")}>
                    {tx('fields.completedCombination', {}, 'Combinaison réalisée')}
                  </HelpLabel>
                  <select value={rule.combinationId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.combinationId = event.target.value;
                  })}>
                    <option value="">{tx('common.chooseCombination', {}, 'Choisir une combinaison')}</option>
                    {(project.combinations || []).map((combo) => {
                      const itemA = project.items.find((item) => item.id === combo.itemAId);
                      const itemB = project.items.find((item) => item.id === combo.itemBId);
                      const result = project.items.find((item) => item.id === combo.resultItemId);
                      return <option key={combo.id} value={combo.id}>{itemA?.name || tx('common.item1', {}, 'Objet 1')} + {itemB?.name || tx('common.item2', {}, 'Objet 2')} {'->'} {result?.name || tx('common.result', {}, 'Résultat')}</option>;
                    })}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'visited_scene' ? (
                <>
                  <HelpLabel help={tx('help.visitedScene', {}, 'Scène qui doit avoir déjà été visitée pendant la partie.')}>
                    {tx('fields.visitedScene', {}, 'Scène visitée')}
                  </HelpLabel>
                  <select value={rule.conditionSceneId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionSceneId = event.target.value;
                  })}>
                    <option value="">{tx('common.chooseScene', {}, 'Choisir une scène')}</option>
                    {(project.scenes || []).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'chose_reply' ? (
                <>
                  <HelpLabel help={tx('help.chosenReply', {}, 'Réponse de conversation qui doit avoir déjà été choisie pendant la partie.')}>
                    {tx('fields.chosenReply', {}, 'Réponse choisie')}
                  </HelpLabel>
                  <select value={rule.conditionReplyId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionReplyId = event.target.value;
                  })}>
                    <option value="">{tx('common.chooseReply', {}, 'Choisir une réponse')}</option>
                    {conversationReplies.map(({ scene, hotspot, node, reply }) => (
                      <option key={reply.id} value={reply.id}>{getSceneLabel?.(scene.id) || scene.name} - {hotspot.name || tx('common.dialogue', {}, 'Dialogue')} - {reply.label || node.text || tx('common.reply', {}, 'Réponse')}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'story_variable' ? renderStoryVariableFields({
                variableKey: rule.conditionVariableKey,
                operator: rule.conditionVariableOperator,
                value: rule.conditionVariableValue,
                onChange: (patch) => updateRule(rule.id, (draftRule) => {
                  if (Object.prototype.hasOwnProperty.call(patch, 'variableKey')) draftRule.conditionVariableKey = patch.variableKey;
                  if (Object.prototype.hasOwnProperty.call(patch, 'operator')) draftRule.conditionVariableOperator = patch.operator;
                  if (Object.prototype.hasOwnProperty.call(patch, 'value')) draftRule.conditionVariableValue = patch.value;
                }),
              }) : null}

              {rule.conditionType === 'advanced' ? (
                <div className="conversation-advanced-condition-list">
                  <div className="conversation-advanced-condition-head">
                    <HelpLabel help={tx('help.combinationMode', {}, 'Choisis ET pour exiger toutes les conditions, ou OU pour accepter au moins une condition.')}>
                      {tx('fields.combinationMode', {}, 'Combinaison')}
                    </HelpLabel>
                    <select value={rule.advancedConditionMode || 'all'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                      draftRule.advancedConditionMode = event.target.value;
                    })}>
                      <option value="all">{tx('options.allConditions', {}, 'Toutes les conditions (ET)')}</option>
                      <option value="any">{tx('options.anyCondition', {}, 'Au moins une condition (OU)')}</option>
                    </select>
                  </div>
                  {(rule.advancedConditions || []).map((condition, conditionIndex) => renderAdvancedConditionFields(condition, conditionIndex, rule))}
                  <button type="button" className="secondary-action compact" onClick={() => updateRule(rule.id, (draftRule) => {
                    if (!Array.isArray(draftRule.advancedConditions)) draftRule.advancedConditions = [];
                    draftRule.advancedConditions.push(makeAdvancedCondition());
                  })}>{tx('quick.addCondition', {}, '+ Condition')}</button>
                </div>
              ) : null}

              <div className="quick-logic-grid">
                <div>
                  <HelpLabel help={tx('help.action', {}, 'Action déclenchée quand la condition est remplie.')}>
                    {tx('fields.action', {}, 'Action')}
                  </HelpLabel>
                  <select value={rule.actionType || 'dialogue'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.actionType = event.target.value;
                  })}>
                    {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <HelpLabel help={tx('help.rewardItem', {}, "Objet ajouté à l'inventaire quand la règle réussit.")}>
                    {tx('fields.rewardItem', {}, 'Objet donné')}
                  </HelpLabel>
                  <select value={rule.rewardItemId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.rewardItemId = event.target.value;
                  })}>
                    <option value="">{tx('common.none', {}, 'Aucun')}</option>
                    {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                  </select>
                </div>
              </div>

              {rule.actionType === 'scene' ? (
                <>
                  <HelpLabel help={tx('help.targetScene', {}, 'Scène ouverte quand la règle réussit.')}>
                    {tx('workspace.targetScene', {}, 'Scène cible')}
                  </HelpLabel>
                  <select value={rule.targetSceneId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.targetSceneId = event.target.value;
                  })}>
                    <option value="">{tx('common.none', {}, 'Aucune')}</option>
                    {(project.scenes || []).filter((scene) => scene.id !== selectedSceneId).map((scene) => (
                      <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {rule.actionType === 'cinematic' ? (
                <>
                  <HelpLabel help={tx('help.targetCinematic', {}, 'Cinématique lancée quand la règle réussit.')}>
                    {tx('workspace.targetCinematic', {}, 'Cinématique cible')}
                  </HelpLabel>
                  <select value={rule.targetCinematicId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.targetCinematicId = event.target.value;
                  })}>
                    <option value="">{tx('common.none', {}, 'Aucune')}</option>
                    {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.actionType === 'block' ? (
                <div className="quick-logic-grid">
                  <div>
                    <HelpLabel help={tx('help.targetBlock', {}, 'Bloc modifié quand cette règle réussit.')}>
                      {tx('fields.targetBlock', {}, 'Bloc cible')}
                    </HelpLabel>
                    <select value={rule.targetBlockId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                      draftRule.targetBlockId = event.target.value;
                    })}>
                      <option value="">{tx('common.chooseBlock', {}, 'Choisir un bloc')}</option>
                      {allBlocks.map(({ scene, target: block }) => (
                        <option key={block.id} value={block.id}>
                          {getSceneLabel?.(scene.id) || scene.name} - {block.name || block.blockLabel || tx('common.block', {}, 'Bloc')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help={tx('help.blockAction', {}, 'Action appliquée au bloc cible.')}>
                      {tx('fields.blockAction', {}, 'Action bloc')}
                    </HelpLabel>
                    <select value={rule.blockActionType || 'show'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                      draftRule.blockActionType = event.target.value;
                    })}>
                      <option value="show">{blockActionLabels.show || 'Afficher le bloc'}</option>
                      <option value="hide">{blockActionLabels.hide || 'Masquer le bloc'}</option>
                      <option value="update_text">{blockActionLabels.update_text || 'Modifier le texte visible'}</option>
                    </select>
                  </div>
                  {rule.blockActionType === 'update_text' ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <HelpLabel help={tx('help.blockText', {}, 'Nouveau texte visible du bloc cible. Selon le type, cela met à jour le texte, le bouton, le placeholder ou le titre du code.')}>
                        {tx('fields.visibleBlockText', {}, 'Texte visible du bloc')}
                      </HelpLabel>
                      <textarea value={rule.targetBlockText || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                        draftRule.targetBlockText = event.target.value;
                      })} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="quick-logic-grid">
                <div>
                  <HelpLabel help={tx('help.successDialogue', {}, "Message affiché quand cette règle s'active.")}>
                    {tx('fields.successDialogue', {}, 'Dialogue réussi')}
                  </HelpLabel>
                  <textarea value={rule.dialogue || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.dialogue = event.target.value;
                  })} />
                </div>
                <div>
                  <HelpLabel help={tx('help.failureDialogue', {}, 'Message affiché si la condition est configurée mais pas remplie.')}>
                    {tx('fields.failureDialogue', {}, 'Dialogue refusé')}
                  </HelpLabel>
                  <textarea value={rule.failureDialogue || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.failureDialogue = event.target.value;
                  })} />
                </div>
              </div>

              <div className="quick-logic-grid">
                <label className="checkbox-row">
                  <input type="checkbox" checked={Boolean(rule.consumeRequiredItemOnUse)} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.consumeRequiredItemOnUse = event.target.checked;
                  })} />
                  {tx('fields.consumeItem', {}, "Consommer l'objet testé")}
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={Boolean(rule.disableAfterUse)} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.disableAfterUse = event.target.checked;
                  })} />
                  {tx('fields.disableAfterSuccess', {}, 'Désactiver après réussite')}
                </label>
              </div>

              <div className="quick-logic-grid">
                <div className="logic-sound-field">
                  <HelpLabel help={tx('help.successSound', {}, "Son joué quand la condition est remplie et que l'action de cette règle se lance.")}>
                    {tx('fields.successSound', {}, 'Son si condition réussie')}
                  </HelpLabel>
                  <MediaSourcePicker
                    className="button like full secondary-action"
                    accept="audio/*"
                    assetScope="logic-sound"
                    handleUpload={handleUpload}
                    mediaLibrary={mediaLibrary}
                    onSelect={(data, name) => updateRule(rule.id, (draftRule) => {
                      draftRule.successSoundData = data;
                      draftRule.successSoundName = name;
                    })}
                  >
                    {rule.successSoundName || tx('options.importSuccessSound', {}, 'Importer un son de réussite')}
                  </MediaSourcePicker>
                  {getRuleSoundUrl(rule, 'success') ? (
                    <div className="logic-sound-preview">
                      <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'success')} />
                      <button type="button" className="danger-button" onClick={() => clearRuleSound(rule.id, 'success')}>{tx('quick.delete', {}, 'Supprimer')}</button>
                    </div>
                  ) : null}
                </div>
                <div className="logic-sound-field">
                  <HelpLabel help={tx('help.failureSound', {}, "Son joué quand cette règle est configurée mais que la condition n'est pas remplie.")}>
                    {tx('fields.failureSound', {}, 'Son si condition échouée')}
                  </HelpLabel>
                  <MediaSourcePicker
                    className="button like full secondary-action"
                    accept="audio/*"
                    assetScope="logic-sound"
                    handleUpload={handleUpload}
                    mediaLibrary={mediaLibrary}
                    onSelect={(data, name) => updateRule(rule.id, (draftRule) => {
                      draftRule.failureSoundData = data;
                      draftRule.failureSoundName = name;
                    })}
                  >
                    {rule.failureSoundName || tx('options.importFailureSound', {}, "Importer un son d'échec")}
                  </MediaSourcePicker>
                  {getRuleSoundUrl(rule, 'failure') ? (
                    <div className="logic-sound-preview">
                      <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'failure')} />
                      <button type="button" className="danger-button" onClick={() => clearRuleSound(rule.id, 'failure')}>{tx('quick.delete', {}, 'Supprimer')}</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </details>
          );
        }) : (
          <div className="placeholder small">{tx('quick.empty', {}, "Aucune règle pour cette sélection. Ajoute une règle pour poser une condition sans quitter l'éditeur.")}</div>
        )}
      </section>
    </div>
  );
}
