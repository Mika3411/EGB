import { makeLogicRule } from '../../data/projectData';
import { resolveAssetUrl } from '../../lib/assetManager';
import MediaSourcePicker from '../MediaSourcePicker.jsx';
import { HelpLabel } from './SceneEditorChrome.jsx';
import { getSceneObjectBlockType } from './SceneObjectInspector.jsx';

const ACTION_LABELS = {
  default: 'Action normale',
  dialogue: 'Dialogue',
  dialogue_item: 'Dialogue + objet',
  scene: 'Changer de scene',
  cinematic: 'Lancer une cinematic',
  block: 'Agir sur un bloc',
};

const CONDITION_LABELS = {
  always: 'Quand cette selection est utilisée',
  has_item: "Si le joueur possède l'objet",
  missing_item: "Si le joueur ne possède pas l'objet",
  completed_hotspot: "Si une zone ou un bloc a déjà été utilisé",
  solved_enigma: 'Si une enigme est réussie',
  launched_cinematic: 'Si une cinematic est lancée',
  completed_combination: 'Si une combinaison est réalisée',
  second_click: 'Au deuxième clic',
};

const getTargetList = (project) => (project.scenes || []).flatMap((scene) => [
  ...(scene.hotspots || []).map((target) => ({ scene, target, type: 'hotspot' })),
  ...(scene.sceneObjects || []).map((target) => ({ scene, target, type: 'sceneObject' })),
]);

const getBlockList = (project) => (project.scenes || []).flatMap((scene) => (
  (scene.sceneObjects || [])
    .filter((target) => getSceneObjectBlockType(target) !== 'object')
    .map((target) => ({ scene, target }))
));

const getRuleSummary = (rule, project, getSceneLabel) => {
  const item = (project.items || []).find((entry) => entry.id === rule.itemId);
  const target = getTargetList(project).find((entry) => entry.target.id === rule.hotspotId);
  const enigma = (project.enigmas || []).find((entry) => entry.id === rule.conditionEnigmaId);
  const cinematic = (project.cinematics || []).find((entry) => entry.id === rule.cinematicId);
  const block = getBlockList(project).find((entry) => entry.target.id === rule.targetBlockId);
  const condition = {
    always: "À l'utilisation",
    missing_item: `Sans ${item?.name || 'objet'}`,
    completed_hotspot: `${getSceneLabel?.(target?.scene.id) || 'Scene'} - ${target?.target.name || 'zone'}`,
    solved_enigma: `Enigme : ${enigma?.name || 'à choisir'}`,
    launched_cinematic: `Cinematic : ${cinematic?.name || "n'importe laquelle"}`,
    completed_combination: 'Combinaison réalisée',
    second_click: 'Deuxième clic',
  }[rule.conditionType] || `Avec ${item?.name || 'objet'}`;
  const action = rule.actionType === 'block'
    ? `${ACTION_LABELS.block}: ${block?.target.name || 'bloc'}`
    : ACTION_LABELS[rule.actionType] || 'Dialogue';
  return `${condition} -> ${action}`;
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
  const rules = target.logicRules || [];
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
  const deleteRule = (ruleId) => {
    if (!window.confirm('Supprimer cette règle logique ?')) return;
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

  return (
    <div className="quick-logic-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section className="quick-logic-modal overlay-card wide" onMouseDown={(event) => event.stopPropagation()}>
        <header className="quick-logic-head">
          <div>
            <span className="section-kicker">Logique rapide</span>
            <h2>{target.name || 'Selection'}</h2>
            <p className="small-note">{rules.length} règle{rules.length > 1 ? 's' : ''} sur cette selection.</p>
          </div>
          <div className="quick-logic-actions">
            <button type="button" className="secondary-action" onClick={addRule}>+ Règle</button>
            <button type="button" onClick={onClose}>Fermer</button>
          </div>
        </header>

        {rules.length ? rules.map((rule) => (
          <details className="logic-rule-card quick-logic-rule" key={rule.id} open>
            <summary>
              <span>
                <strong>{rule.name || 'Règle'}</strong>
                <small>{getRuleSummary(rule, project, getSceneLabel)}</small>
              </span>
              <button type="button" className="danger-button" onClick={(event) => {
                event.preventDefault();
                deleteRule(rule.id);
              }}>
                Supprimer
              </button>
            </summary>
            <div className="logic-rule-body">
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
                    {Object.entries(CONDITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                  <HelpLabel help="Selection que le joueur doit avoir déjà utilisée.">Selection déjà utilisée</HelpLabel>
                  <select value={rule.hotspotId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.hotspotId = event.target.value;
                  })}>
                    <option value="">Choisir une selection</option>
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
                  <HelpLabel help="Enigme qui doit être réussie avant d'activer cette règle.">Enigme réussie</HelpLabel>
                  <select value={rule.conditionEnigmaId || ''} onChange={(event) => updateRule(rule.id, (draftRule) => {
                    draftRule.conditionEnigmaId = event.target.value;
                  })}>
                    <option value="">Choisir une enigme</option>
                    {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                  </select>
                </>
              ) : null}

              {rule.conditionType === 'launched_cinematic' ? (
                <>
                  <HelpLabel help="Cinematic qui doit avoir été lancée.">Cinematic lancée</HelpLabel>
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
                      return <option key={combo.id} value={combo.id}>{itemA?.name || 'Objet 1'} + {itemB?.name || 'Objet 2'} {'->'} {result?.name || 'Result'}</option>;
                    })}
                  </select>
                </>
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
                  <HelpLabel help="Scene ouverte quand la règle réussit.">Scene cible</HelpLabel>
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
                  <HelpLabel help="Cinematic lancée quand la règle réussit.">Cinematic cible</HelpLabel>
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
                      <option value="update_text">Modifier son texte</option>
                    </select>
                  </div>
                  {rule.blockActionType === 'update_text' ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <HelpLabel help="Nouveau texte affiché dans le bloc cible.">Nouveau texte du bloc</HelpLabel>
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
        )) : (
          <div className="placeholder small">Aucune règle pour cette selection. Ajoute une règle pour poser une condition sans quitter l'éditeur.</div>
        )}
      </section>
    </div>
  );
}
