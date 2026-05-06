import { useEffect, useMemo, useState } from 'react';
import { makeLogicRule } from '../data/projectData';
import { getSceneObjectClickMode } from './scenes/SceneObjectInspector.jsx';

const ACTION_LABELS = {
  default: 'Action normale de la zone',
  dialogue: 'Dialogue',
  dialogue_item: 'Dialogue + objet',
  scene: 'Changer de scène',
  cinematic: 'Lancer une cinématique',
};

const OBJECT_MODES = {
  popup: 'Pop-up uniquement',
  inventory: 'Inventaire uniquement',
  both: 'Pop-up + inventaire',
};

const CONDITION_LABELS = {
  has_item: 'Si le joueur possède l’objet',
  missing_item: 'Si le joueur ne possède pas l’objet',
  completed_hotspot: 'Si une zone d’action ou image-zone est franchie entièrement',
  solved_enigma: 'Si une énigme est réussie',
  launched_cinematic: 'Si une cinématique est lancée',
  completed_combination: 'Si une combinaison est réalisée',
  second_click: 'En cas de deuxième clic sur cette zone',
};

const FIELD_HELP = {
  sceneTree: "Choisis la scène dont tu veux régler les conditions. Les règles affichées à droite ne concernent que cette scène.",
  actionZones: "Zones cliquables de la scène sélectionnée, y compris les objets visibles réglés en Zone d'action. Une règle conditionnelle peut remplacer leur action normale selon l’état de la partie.",
  addRule: "Ajoute une condition spéciale sur cette zone. La règle s’active seulement si sa condition est vraie pendant la partie.",
  visibleObjects: "Objets placés directement dans l’image de la scène. Leur comportement peut être réglé ici sans passer par les zones d’action.",
  consumeRequiredItem: "Retire l’objet testé de l’inventaire après activation. Utile pour une clé utilisée une seule fois, un ticket donné, une pile consommée.",
  disableRuleAfterUse: "Désactive cette règle après sa première activation. Utile pour ouvrir une porte une fois, puis laisser la zone suivre sa logique normale même si l’objet a été consommé.",
  removeVisibleObject: "Cache l’objet dans la scène après son utilisation. Pratique pour un objet ramassé ou un élément qui disparaît.",
};

const getRuleSummary = (rule, project) => {
  const testedItem = project.items?.find((item) => item.id === rule.itemId);
  const testedHotspot = (project.scenes || []).flatMap((scene) => [
    ...(scene.hotspots || []),
    ...(scene.sceneObjects || []).filter((object) => getSceneObjectClickMode(object) === 'action'),
  ]).find((hotspot) => hotspot.id === rule.hotspotId);
  const testedEnigma = project.enigmas?.find((enigma) => enigma.id === rule.conditionEnigmaId);
  const testedCinematic = project.cinematics?.find((cinematic) => cinematic.id === rule.cinematicId);
  const testedCombination = project.combinations?.find((combo) => combo.id === rule.combinationId);
  const rewardItem = project.items?.find((item) => item.id === rule.rewardItemId);
  let condition = {
    missing_item: `Sans ${testedItem?.name || 'objet'}`,
    completed_hotspot: `Zone franchie: ${testedHotspot?.name || 'zone'}`,
    solved_enigma: `Énigme réussie: ${testedEnigma?.name || 'énigme'}`,
    launched_cinematic: `Cinématique lancée: ${testedCinematic?.name || 'cinématique'}`,
    completed_combination: `Combinaison réalisée: ${testedCombination?.message || 'combinaison'}`,
    second_click: 'Deuxième clic',
  }[rule.conditionType] || `Avec ${testedItem?.name || 'objet'}`;
  if (rule.conditionType === 'launched_cinematic' && !rule.cinematicId) {
    condition = 'Une cinématique est lancée';
  }
  const action = ACTION_LABELS[rule.actionType] || 'Dialogue';
  const reward = rewardItem ? ` · donne ${rewardItem.name}` : '';
  return `${condition} · ${action}${reward}`;
};

const HelpLabel = ({ children, help, className = '' }) => (
  <label className={`label-with-help${className ? ` ${className}` : ''}`}>
    <span>{children}</span>
    <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
  </label>
);

export default function LogicTab({ project, patchProject, handleUpload, getSceneLabel, selectedSceneId: editorSelectedSceneId = '' }) {
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
  const getSceneActionTargets = (scene) => [
    ...(scene.hotspots || []).map((hotspot) => ({ scene, target: hotspot, type: 'hotspot' })),
    ...(scene.sceneObjects || [])
      .filter((object) => getSceneObjectClickMode(object) === 'action')
      .map((object) => ({ scene, target: object, type: 'sceneObject' })),
  ];
  const allActionTargets = useMemo(() => scenes.flatMap((scene) => getSceneActionTargets(scene)), [scenes]);

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

  const deleteRule = (targetId, targetType, ruleId) => {
    if (!window.confirm('Supprimer cette règle logique ?')) return;
    updateActionTarget(targetId, targetType, (target) => {
      target.logicRules = (target.logicRules || []).filter((rule) => rule.id !== ruleId);
    });
  };

  const clearRuleSound = (targetId, targetType, ruleId, kind) => {
    updateRule(targetId, targetType, ruleId, (draftRule) => {
      draftRule[`${kind}SoundData`] = '';
      draftRule[`${kind}SoundName`] = '';
    });
  };

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
        return (
          <details key={scene.id} className={`scene-tree-node ${hasChildren ? 'has-children' : ''}`} open>
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
      <section className="panel side" data-tour="logic-scene-tree">
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
        <div className="panel-head">
          <div>
            <span className="section-kicker">Logique</span>
            <h2>{selectedScene?.name || 'Aucune scène'}</h2>
          </div>
        </div>

        {selectedScene ? (
          <div className="editor-stack">
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

                  {(target.logicRules || []).length ? target.logicRules.map((rule) => (
                    <details className="logic-rule-card" key={rule.id} open>
                      <summary>
                        <span>
                          <strong>{rule.name || 'Règle'}</strong>
                          <small>{getRuleSummary(rule, project)}</small>
                        </span>
                        <button type="button" className="danger-button" onClick={(event) => {
                          event.preventDefault();
                          deleteRule(target.id, type, rule.id);
                        }}>
                          Supprimer
                        </button>
                      </summary>
                      <div className="logic-rule-body">

                      <div className="grid-two">
                        <div>
                          <HelpLabel help="Nom interne pour reconnaître rapidement cette règle dans la liste compacte.">Nom de la règle</HelpLabel>
                          <input value={rule.name || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.name = event.target.value;
                          })} />
                        </div>
                        <div>
                          <HelpLabel help="Détermine quand cette règle remplace l’action normale de la zone. La première règle qui correspond est utilisée.">Condition</HelpLabel>
                          <select data-tour="logic-condition" value={rule.conditionType || 'has_item'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.conditionType = event.target.value;
                          })}>
                            {Object.entries(CONDITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                      </div>

                      {['has_item', 'missing_item'].includes(rule.conditionType || 'has_item') ? (
                        <>
                          <HelpLabel help="Objet vérifié dans l’inventaire du joueur pour savoir si la règle doit s’activer.">Objet testé</HelpLabel>
                          <select value={rule.itemId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.itemId = event.target.value;
                          })}>
                            <option value="">Choisir un objet</option>
                            {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                          </select>
                        </>
                      ) : null}

                      {rule.conditionType === 'completed_hotspot' ? (
                        <>
                          <HelpLabel help="Zone qui doit avoir déjà terminé son action au moins une fois.">Zone d’action franchie</HelpLabel>
                          <select value={rule.hotspotId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.hotspotId = event.target.value;
                          })}>
                            <option value="">Choisir une zone</option>
                            {allActionTargets.map(({ scene, target: candidate, type: candidateType }) => (
                              <option key={`${candidateType}-${candidate.id}`} value={candidate.id}>{getSceneLabel(scene.id)} - {candidateType === 'sceneObject' ? 'Image-zone: ' : ''}{candidate.name}</option>
                            ))}
                          </select>
                        </>
                      ) : null}

                      {rule.conditionType === 'solved_enigma' ? (
                        <>
                          <HelpLabel help="Énigme qui doit avoir été réussie pendant la partie.">Énigme réussie</HelpLabel>
                          <select value={rule.conditionEnigmaId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.conditionEnigmaId = event.target.value;
                          })}>
                            <option value="">Choisir une énigme</option>
                            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                          </select>
                        </>
                      ) : null}

                      {rule.conditionType === 'launched_cinematic' ? (
                        <>
                          <HelpLabel help="Cinématique qui doit avoir été lancée au moins une fois pendant la partie.">Cinématique lancée</HelpLabel>
                          <select value={rule.cinematicId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.cinematicId = event.target.value;
                          })}>
                            <option value="">N’importe quelle cinématique lancée</option>
                            {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                          </select>
                        </>
                      ) : null}

                      {rule.conditionType === 'completed_combination' ? (
                        <>
                          <HelpLabel help="Combinaison d’objets qui doit avoir été réalisée dans l’inventaire.">Combinaison réalisée</HelpLabel>
                          <select value={rule.combinationId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.combinationId = event.target.value;
                          })}>
                            <option value="">Choisir une combinaison</option>
                            {(project.combinations || []).map((combo) => {
                              const itemA = project.items.find((item) => item.id === combo.itemAId);
                              const itemB = project.items.find((item) => item.id === combo.itemBId);
                              const result = project.items.find((item) => item.id === combo.resultItemId);
                              return <option key={combo.id} value={combo.id}>{itemA?.name || 'Objet 1'} + {itemB?.name || 'Objet 2'} → {result?.name || 'Résultat'}</option>;
                            })}
                          </select>
                        </>
                      ) : null}

                      <div className="grid-two">
                        <div>
                          <HelpLabel help="Action exécutée à la place de l’action normale de la zone quand la condition est vraie.">Action déclenchée</HelpLabel>
                          <select data-tour="logic-action" value={rule.actionType || 'dialogue'} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.actionType = event.target.value;
                          })}>
                            {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                        <div>
                          <HelpLabel help="Objet ajouté à l’inventaire quand cette règle s’active. Laisse Aucun si la règle ne donne rien.">Objet donné</HelpLabel>
                          <select data-tour="logic-reward-item" value={rule.rewardItemId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.rewardItemId = event.target.value;
                          })}>
                            <option value="">Aucun</option>
                            {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid-two">
                        <div>
                          {rule.conditionType === 'has_item' ? (
                            <label className="checkbox-row">
                              <input type="checkbox" checked={Boolean(rule.consumeRequiredItemOnUse)} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                                draftRule.consumeRequiredItemOnUse = event.target.checked;
                              })} />
                              <span>Consommer l’objet testé quand la règle s’active</span>
                              <span className="help-dot" data-help={FIELD_HELP.consumeRequiredItem} aria-label={FIELD_HELP.consumeRequiredItem} tabIndex={0}>?</span>
                            </label>
                          ) : null}
                        </div>
                        <label className="checkbox-row">
                          <input type="checkbox" checked={Boolean(rule.disableAfterUse)} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.disableAfterUse = event.target.checked;
                          })} />
                          <span>Cette règle ne s’applique qu’une fois, puis s’annule</span>
                          <span className="help-dot" data-help={FIELD_HELP.disableRuleAfterUse} aria-label={FIELD_HELP.disableRuleAfterUse} tabIndex={0}>?</span>
                        </label>
                      </div>

                      <div className="grid-two">
                        <div>
                          <HelpLabel help="Message affiché au joueur quand cette règle s’active. Il remplace le dialogue normal de la zone.">Dialogue affiché</HelpLabel>
                          <textarea data-tour="logic-dialogue" value={rule.dialogue || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.dialogue = event.target.value;
                          })} />
                        </div>
                        <div>
                          <HelpLabel help="Message affiché si cette règle ne peut pas s’activer parce que sa condition n’est pas remplie. Exemple : il manque une clé, une énigme n’est pas encore réussie, ou une cinématique n’a pas encore été lancée.">Dialogue si condition non remplie</HelpLabel>
                          <textarea value={rule.failureDialogue || ''} placeholder="Exemple : La porte reste verrouillée. Il te manque la clé." onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.failureDialogue = event.target.value;
                          })} />
                        </div>
                      </div>

                      <div className="grid-two">
                        <div className="logic-sound-field">
                          <HelpLabel help="Son joué quand la condition est remplie et que l’action de cette règle se lance.">Son si condition réussie</HelpLabel>
                          <label className="button like full secondary-action">
                            {rule.successSoundName || 'Importer un son de réussite'}
                            <input type="file" accept="audio/*" hidden onChange={(event) => handleUpload?.(event, (data, name) => updateRule(target.id, type, rule.id, (draftRule) => {
                              draftRule.successSoundData = data;
                              draftRule.successSoundName = name;
                            }))} />
                          </label>
                          {rule.successSoundData ? (
                            <div className="logic-sound-preview">
                              <audio controls preload="metadata" src={rule.successSoundData} />
                              <button type="button" className="danger-button" onClick={() => clearRuleSound(target.id, type, rule.id, 'success')}>Supprimer</button>
                            </div>
                          ) : null}
                        </div>
                        <div className="logic-sound-field">
                          <HelpLabel help="Son joué quand cette règle est configurée mais que sa condition n’est pas remplie.">Son si condition échouée</HelpLabel>
                          <label className="button like full secondary-action">
                            {rule.failureSoundName || "Importer un son d'échec"}
                            <input type="file" accept="audio/*" hidden onChange={(event) => handleUpload?.(event, (data, name) => updateRule(target.id, type, rule.id, (draftRule) => {
                              draftRule.failureSoundData = data;
                              draftRule.failureSoundName = name;
                            }))} />
                          </label>
                          {rule.failureSoundData ? (
                            <div className="logic-sound-preview">
                              <audio controls preload="metadata" src={rule.failureSoundData} />
                              <button type="button" className="danger-button" onClick={() => clearRuleSound(target.id, type, rule.id, 'failure')}>Supprimer</button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {rule.actionType === 'scene' ? (
                        <>
                          <HelpLabel help="Scène ouverte si l’action déclenchée est un changement de scène.">Scène cible</HelpLabel>
                          <select data-tour="logic-target-scene" value={rule.targetSceneId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.targetSceneId = event.target.value;
                          })}>
                            <option value="">Choisir une scène</option>
                            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                          </select>
                        </>
                      ) : null}

                      {rule.actionType === 'cinematic' ? (
                        <>
                          <HelpLabel help="Cinématique lancée si l’action déclenchée est une cinématique.">Cinématique cible</HelpLabel>
                          <select data-tour="logic-target-cinematic" value={rule.targetCinematicId || ''} onChange={(event) => updateRule(target.id, type, rule.id, (draftRule) => {
                            draftRule.targetCinematicId = event.target.value;
                          })}>
                            <option value="">Choisir une cinématique</option>
                            {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                          </select>
                        </>
                      ) : null}
                      </div>
                    </details>
                  )) : <p className="small-note">Cette zone utilise sa logique normale.</p>}
                </div>
              ))}
            </section>

            <section className="combo-card" data-tour="logic-visible-objects">
              <div className="panel-head">
                <HelpLabel className="compact-section-title" help={FIELD_HELP.visibleObjects}>Objets visibles cliquables</HelpLabel>
                <span className="status-badge soft">{selectedClickableObjects.length}</span>
              </div>
              {selectedClickableObjects.length ? selectedClickableObjects.map((object) => (
                <div className="combo-card" key={object.id}>
                  <div className="grid-two">
                    <div>
                      <HelpLabel help="Nom de l’objet visible dans cette scène. Il sert à l’identifier dans l’éditeur et peut apparaître dans certains messages.">Nom</HelpLabel>
                      <input value={object.name || ''} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                        draftObject.name = event.target.value;
                      })} />
                    </div>
                    <div>
                      <HelpLabel help="Choisis si l’objet ouvre une image pop-up, rejoint l’inventaire, ou fait les deux au clic.">Mode d’interaction</HelpLabel>
                      <select value={object.interactionMode || 'popup'} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                        draftObject.interactionMode = event.target.value;
                      })}>
                        {Object.entries(OBJECT_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  </div>
                  <HelpLabel help="Objet ajouté à l’inventaire quand le mode d’interaction inclut l’inventaire.">Objet d’inventaire lié</HelpLabel>
                  <select value={object.linkedItemId || ''} onChange={(event) => updateSceneObject(object.id, (draftObject) => {
                    draftObject.linkedItemId = event.target.value;
                  })}>
                    <option value="">Aucun</option>
                    {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                  </select>
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
          <div className="empty-state-inline">Crée d’abord une scène pour gérer sa logique.</div>
        )}
      </section>
    </div>
  );
}
