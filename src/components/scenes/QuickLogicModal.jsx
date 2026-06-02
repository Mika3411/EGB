import { makeLogicRule } from '../../data/projectData';
import { buildLogicCompletionRefs, getLogicRuleCompletionIssues } from '../../lib/logicCompletion';
import { resolveAssetUrl } from '../../lib/assetManager';
import MediaSourcePicker from '../MediaSourcePicker.jsx';
import { showConfirm } from '../AccessibleDialog';
import { HelpLabel } from './SceneEditorChrome.jsx';
import { getSceneObjectBlockType } from './SceneObjectInspector.jsx';

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

const getStoryVariableSummary = ({ key, operator = 'equals', value }) => {
  const operatorLabel = VARIABLE_OPERATORS[operator] || '=';
  const valueLabel = ['truthy', 'falsy'].includes(operator) ? '' : ` ${value ?? ''}`;
  return `${key || 'variable'} ${operatorLabel}${valueLabel}`;
};

const getAdvancedConditionSummary = (condition = {}, project, getSceneLabel) => {
  if (condition.type === 'has_item') return `Objet: ${(project.items || []).find((item) => item.id === condition.itemId)?.name || 'non choisi'}`;
  if (condition.type === 'visited_scene') return `Scène: ${getSceneLabel?.(condition.sceneId) || 'non choisie'}`;
  if (condition.type === 'completed_hotspot') {
    const testedTarget = getTargetList(project).find((entry) => entry.target.id === condition.hotspotId);
    return `Sélection: ${testedTarget?.target.name || 'non choisie'}`;
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

const getRuleSummary = (rule, project, getSceneLabel) => {
  const item = (project.items || []).find((entry) => entry.id === rule.itemId);
  const testedScene = (project.scenes || []).find((entry) => entry.id === (rule.conditionSceneId || rule.sceneId));
  const target = getTargetList(project).find((entry) => entry.target.id === rule.hotspotId);
  const enigma = (project.enigmas || []).find((entry) => entry.id === rule.conditionEnigmaId);
  const cinematic = (project.cinematics || []).find((entry) => entry.id === rule.cinematicId);
  const testedReply = getConversationReplies(project).find((entry) => entry.reply.id === (rule.conditionReplyId || rule.replyId));
  const block = getBlockList(project).find((entry) => entry.target.id === rule.targetBlockId);
  const heroSkill = project.heroAdventure?.hero?.skills?.find((skill) => skill.id === rule.heroSkillId);
  const advancedMode = (rule.advancedConditionMode || 'all') === 'any' ? 'OU' : 'ET';
  const advancedLabels = (rule.advancedConditions || []).map((condition) => (
    getAdvancedConditionSummary(condition, project, getSceneLabel)
  ));
  const condition = {
    always: "À l'utilisation",
    missing_item: `Sans ${item?.name || 'objet'}`,
    visited_scene: `Scène visitée: ${testedScene?.name || 'scène'}`,
    completed_hotspot: `${getSceneLabel?.(target?.scene.id) || 'Scène'} - ${target?.target.name || 'zone'}`,
    solved_enigma: `Énigme : ${enigma?.name || 'à choisir'}`,
    launched_cinematic: `Cinématique : ${cinematic?.name || "n'importe laquelle"}`,
    completed_combination: 'Combinaison réalisée',
    chose_reply: `Réponse choisie: ${testedReply?.reply.label || 'réponse'}`,
    story_variable: getStoryVariableSummary({
      key: rule.conditionVariableKey || rule.variableKey,
      operator: rule.conditionVariableOperator || rule.operator,
      value: rule.conditionVariableValue ?? rule.value,
    }),
    advanced: advancedLabels.length ? `${advancedMode}: ${advancedLabels.join(` ${advancedMode} `)}` : 'Conditions avancées',
    second_click: 'Deuxième clic',
  }[rule.conditionType] || `Avec ${item?.name || 'objet'}`;
  const action = rule.actionType === 'block'
    ? `${ACTION_LABELS.block}: ${block?.target.name || 'bloc'}`
    : ACTION_LABELS[rule.actionType] || 'Dialogue';
  const heroCondition = {
    hero_health_below: `PV héros < ${rule.heroHealthThreshold ?? 5}`,
    hero_mana_at_least: `Mana héros >= ${rule.heroManaThreshold ?? 1}`,
    hero_last_roll_success: 'Dernier jet héros réussi',
    hero_skill_used: `Compétence: ${heroSkill?.name || 'à choisir'}`,
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
    Object.entries(CONDITION_LABELS).filter(([value]) => (
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
      title: 'Supprimer la règle',
      message: 'Supprimer cette règle logique ?',
      confirmLabel: 'Supprimer',
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
        <HelpLabel help="Clé de la variable narrative à tester. Les variables déclarées dans l'onglet Aventure sont proposées automatiquement.">Variable</HelpLabel>
        <input
          value={variableKey || ''}
          list="quick-logic-story-variable-keys"
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
            {(project.scenes || []).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>)}
          </select>
        ) : null}

        {conditionType === 'completed_hotspot' ? (
          <select value={condition.hotspotId || ''} onChange={(event) => updateAdvancedCondition((targetCondition) => {
            targetCondition.hotspotId = event.target.value;
          })}>
            <option value="">Sélection</option>
            {allTargets.map(({ scene, target: candidate, type }) => (
              <option key={`${type}-${candidate.id}`} value={candidate.id}>
                {getSceneLabel?.(scene.id) || scene.name} - {candidate.name || (type === 'sceneObject' ? 'Objet' : 'Zone')}
              </option>
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
              <option key={reply.id} value={reply.id}>{getSceneLabel?.(scene.id) || scene.name} - {hotspot.name || 'Dialogue'} - {reply.label || node.text || 'Réponse'}</option>
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
        })}>Retirer</button>
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
            <span className="section-kicker">Logique rapide</span>
            <h2>{target.name || 'Sélection'}</h2>
            <p className="small-note">{rules.length} règle{rules.length > 1 ? 's' : ''} sur cette sélection.</p>
          </div>
          <div className="quick-logic-actions">
            <button type="button" className="secondary-action" onClick={addRule}>+ Règle</button>
            <button type="button" onClick={onClose}>Fermer</button>
          </div>
        </header>

        {rules.length ? rules.map((rule) => {
          const ruleCompletionIssues = getLogicRuleCompletionIssues(rule, logicCompletionRefs);
          return (
          <details className={`logic-rule-card quick-logic-rule${ruleCompletionIssues.length ? ' incomplete' : ''}`} key={rule.id} open>
            <summary>
              <span>
                <span className="logic-rule-name-line">
                  <strong>{rule.name || 'Règle'}</strong>
                  {ruleCompletionIssues.length ? <em className="logic-incomplete-pill">Règle incomplète</em> : null}
                </span>
                <small>{getRuleSummary(rule, project, getSceneLabel)}</small>
                {ruleCompletionIssues.length ? (
                  <small className="logic-incomplete-details">{ruleCompletionIssues.join(' · ')}</small>
                ) : null}
              </span>
              <button type="button" className="danger-button" onClick={(event) => {
                event.preventDefault();
                deleteRule(rule.id);
              }}>
                Supprimer
              </button>
            </summary>
            <div className="logic-rule-body">
              {rule.conditionType === 'hero_health_below' ? (
                <>
                  <HelpLabel help="La règle s'active si les PV actuels du héros sont strictement inférieurs à ce seuil.">Seuil de PV</HelpLabel>
                  <input type="number" min="0" value={rule.heroHealthThreshold ?? 5} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.heroHealthThreshold = Number(event.target.value);
                  })} />
                </>
              ) : null}

              {rule.conditionType === 'hero_mana_at_least' ? (
                <>
                  <HelpLabel help="La règle s'active si la mana actuelle du héros atteint au moins ce seuil.">Mana requise</HelpLabel>
                  <input type="number" min="0" value={rule.heroManaThreshold ?? 1} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.heroManaThreshold = Number(event.target.value);
                  })} />
                </>
              ) : null}

              {rule.conditionType === 'hero_skill_used' ? (
                <>
                  <HelpLabel help="La règle s'active si le dernier jet héros utilisait cette compétence.">Compétence du dernier jet</HelpLabel>
                  <select value={rule.heroSkillId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.heroSkillId = event.target.value;
                  })}>
                    <option value="">Choisir une compétence</option>
                    {heroSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                  </select>
                </>
              ) : null}

              <div className="quick-logic-grid">
                <div>
                  <HelpLabel help="Nom court pour retrouver cette règle plus tard dans l'onglet Logique.">Nom de la règle</HelpLabel>
                  <input value={rule.name || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.name = event.target.value;
                  })} />
                </div>
                <div>
                  <HelpLabel help="Condition qui doit être vraie pour décléncher cette règle.">Condition</HelpLabel>
                  <select value={rule.conditionType || 'has_item'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionType = event.target.value;
                  })}>
                    {getConditionOptions(rule).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </div>

              {['has_item', 'missing_item'].includes(rule.conditionType || 'has_item') ? (
                <>
                  <HelpLabel help="Objet vérifié dans l'inventaire du joueur.">Objet testé</HelpLabel>
                  <select value={rule.itemId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.itemId = event.target.value;
                  })}>
                    <option value="">Choisir un objet</option>
                    {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'completed_hotspot' ? (
                <>
                  <HelpLabel help="Sélection que le joueur doit avoir déjà utilisée.">Sélection déjà utilisée</HelpLabel>
                  <select value={rule.hotspotId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.hotspotId = event.target.value;
                  })}>
                    <option value="">Choisir une sélection</option>
                    {allTargets.map(({ scene, target: candidate, type }) => (
                      <option key={`${type}-${candidate.id}`} value={candidate.id}>
                        {getSceneLabel?.(scene.id) || scene.name} - {candidate.name || (type === 'sceneObject' ? 'Objet' : 'Zone')}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'solved_enigma' ? (
                <>
                  <HelpLabel help="Énigme qui doit être réussie avant d'activer cette règle.">Énigme réussie</HelpLabel>
                  <select value={rule.conditionEnigmaId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionEnigmaId = event.target.value;
                  })}>
                    <option value="">Choisir une énigme</option>
                    {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'launched_cinematic' ? (
                <>
                  <HelpLabel help="Cinématique qui doit avoir été lancée.">Cinématique lancée</HelpLabel>
                  <select value={rule.cinematicId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.cinematicId = event.target.value;
                  })}>
                    <option value="">N'importe quelle cinematic</option>
                    {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'completed_combination' ? (
                <>
                  <HelpLabel help="Combinaison d'objets qui doit avoir été réalisée.">Combinaison réalisée</HelpLabel>
                  <select value={rule.combinationId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.combinationId = event.target.value;
                  })}>
                    <option value="">Choisir une combinaison</option>
                    {(project.combinations || []).map((combo) => {
                      const itemA = project.items.find((item) => item.id === combo.itemAId);
                      const itemB = project.items.find((item) => item.id === combo.itemBId);
                      const result = project.items.find((item) => item.id === combo.resultItemId);
                      return <option key={combo.id} value={combo.id}>{itemA?.name || 'Objet 1'} + {itemB?.name || 'Objet 2'} {'->'} {result?.name || 'Résultat'}</option>;
                    })}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'visited_scene' ? (
                <>
                  <HelpLabel help="Scène qui doit avoir déjà été visitée pendant la partie.">Scène visitée</HelpLabel>
                  <select value={rule.conditionSceneId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionSceneId = event.target.value;
                  })}>
                    <option value="">Choisir une scène</option>
                    {(project.scenes || []).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'chose_reply' ? (
                <>
                  <HelpLabel help="Réponse de conversation qui doit avoir déjà été choisie pendant la partie.">Réponse choisie</HelpLabel>
                  <select value={rule.conditionReplyId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionReplyId = event.target.value;
                  })}>
                    <option value="">Choisir une réponse</option>
                    {conversationReplies.map(({ scene, hotspot, node, reply }) => (
                      <option key={reply.id} value={reply.id}>{getSceneLabel?.(scene.id) || scene.name} - {hotspot.name || 'Dialogue'} - {reply.label || node.text || 'Réponse'}</option>
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
                    <HelpLabel help="Choisis ET pour exiger toutes les conditions, ou OU pour accepter au moins une condition.">Combinaison</HelpLabel>
                    <select value={rule.advancedConditionMode || 'all'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                      draftRule.advancedConditionMode = event.target.value;
                    })}>
                      <option value="all">Toutes les conditions (ET)</option>
                      <option value="any">Au moins une condition (OU)</option>
                    </select>
                  </div>
                  {(rule.advancedConditions || []).map((condition, conditionIndex) => renderAdvancedConditionFields(condition, conditionIndex, rule))}
                  <button type="button" className="secondary-action compact" onClick={() => updateRule(rule.id, (draftRule) => {
                    if (!Array.isArray(draftRule.advancedConditions)) draftRule.advancedConditions = [];
                    draftRule.advancedConditions.push(makeAdvancedCondition());
                  })}>+ Condition</button>
                </div>
              ) : null}

              <div className="quick-logic-grid">
                <div>
                  <HelpLabel help="Action déclénchée quand la condition est remplie.">Action</HelpLabel>
                  <select value={rule.actionType || 'dialogue'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.actionType = event.target.value;
                  })}>
                    {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <HelpLabel help="Objet ajouté à l'inventaire quand la règle réussit.">Objet donné</HelpLabel>
                  <select value={rule.rewardItemId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.rewardItemId = event.target.value;
                  })}>
                    <option value="">Aucun</option>
                    {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                  </select>
                </div>
              </div>

              {rule.actionType === 'scene' ? (
                <>
                  <HelpLabel help="Scène ouverte quand la règle réussit.">Scène cible</HelpLabel>
                  <select value={rule.targetSceneId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.targetSceneId = event.target.value;
                  })}>
                    <option value="">Aucune</option>
                    {(project.scenes || []).filter((scene) => scene.id !== selectedSceneId).map((scene) => (
                      <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>
                    ))}
                  </select>
                </>
              ) : null}

              {rule.actionType === 'cinematic' ? (
                <>
                  <HelpLabel help="Cinématique lancée quand la règle réussit.">Cinématique cible</HelpLabel>
                  <select value={rule.targetCinematicId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.targetCinematicId = event.target.value;
                  })}>
                    <option value="">Aucune</option>
                    {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.actionType === 'block' ? (
                <div className="quick-logic-grid">
                  <div>
                    <HelpLabel help="Bloc modifié quand cette règle réussit.">Bloc cible</HelpLabel>
                    <select value={rule.targetBlockId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                      draftRule.targetBlockId = event.target.value;
                    })}>
                      <option value="">Choisir un bloc</option>
                      {allBlocks.map(({ scene, target: block }) => (
                        <option key={block.id} value={block.id}>
                          {getSceneLabel?.(scene.id) || scene.name} - {block.name || block.blockLabel || 'Bloc'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help="Action appliquée au bloc cible.">Action bloc</HelpLabel>
                    <select value={rule.blockActionType || 'show'} onChange={(event) => updateRule(rule.id, (draftRule) => {
                      draftRule.blockActionType = event.target.value;
                    })}>
                      <option value="show">Afficher le bloc</option>
                      <option value="hide">Masquer le bloc</option>
                      <option value="update_text">Modifier le texte visible</option>
                    </select>
                  </div>
                  {rule.blockActionType === 'update_text' ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <HelpLabel help="Nouveau texte visible du bloc cible. Selon le type, cela met à jour le texte, le bouton, le placeholder ou le titre du code.">Texte visible du bloc</HelpLabel>
                      <textarea value={rule.targetBlockText || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                        draftRule.targetBlockText = event.target.value;
                      })} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="quick-logic-grid">
                <div>
                  <HelpLabel help="Message affiché quand cette règle s'active.">Dialogue réussi</HelpLabel>
                  <textarea value={rule.dialogue || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.dialogue = event.target.value;
                  })} />
                </div>
                <div>
                  <HelpLabel help="Message affiché si la condition est configurée mais pas remplie.">Dialogue refusé</HelpLabel>
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
                  Consommer l'objet testé
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={Boolean(rule.disableAfterUse)} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.disableAfterUse = event.target.checked;
                  })} />
                  Désactiver après réussite
                </label>
              </div>

              <div className="quick-logic-grid">
                <div className="logic-sound-field">
                  <HelpLabel help="Son joué quand la condition est remplie et que l'action de cette règle se lance.">Son si condition réussie</HelpLabel>
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
                    {rule.successSoundName || 'Importer un son de réussite'}
                  </MediaSourcePicker>
                  {getRuleSoundUrl(rule, 'success') ? (
                    <div className="logic-sound-preview">
                      <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'success')} />
                      <button type="button" className="danger-button" onClick={() => clearRuleSound(rule.id, 'success')}>Supprimer</button>
                    </div>
                  ) : null}
                </div>
                <div className="logic-sound-field">
                  <HelpLabel help="Son joué quand cette règle est configurée mais que la condition n'est pas remplie.">Son si condition échouée</HelpLabel>
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
                    {rule.failureSoundName || "Importer un son d'échec"}
                  </MediaSourcePicker>
                  {getRuleSoundUrl(rule, 'failure') ? (
                    <div className="logic-sound-preview">
                      <audio controls preload="metadata" src={getRuleSoundUrl(rule, 'failure')} />
                      <button type="button" className="danger-button" onClick={() => clearRuleSound(rule.id, 'failure')}>Supprimer</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </details>
          );
        }) : (
          <div className="placeholder small">Aucune règle pour cette sélection. Ajoute une règle pour poser une condition sans quitter l'éditeur.</div>
        )}
      </section>
    </div>
  );
}
