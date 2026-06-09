import NumberInput from '../../../../shared/ui/forms/NumberInput.jsx';
import { isProPromotionProject } from '../../../../shared/services/proPromotion';
import { isProfessionalAccount } from '../../../../shared/services/accountPlans';
import { HelpLabel } from './SceneEditorChrome.jsx';

const getProjectRecordId = (record = {}) => (
  record.id
  || record.projectId
  || record.project_id
  || record.data?.id
  || record.data?.projectId
  || record.data?.project_id
  || ''
);
const getProjectRecordUserId = (record = {}, fallbackUser = null) => (
  record.userId
  || record.user_id
  || record.ownerId
  || record.owner_id
  || record.authorId
  || record.author_id
  || record.data?.userId
  || record.data?.user_id
  || record.data?.ownerId
  || record.data?.owner_id
  || record.data?.authorId
  || record.data?.author_id
  || fallbackUser?.id
  || ''
);
const getProjectRecordTitle = (record = {}) => (
  record.name
  || record.data?.title
  || record.title
  || record.data?.name
  || 'Projet sans titre'
);

export const getProjectLinkOptions = (projectLibrary = [], activeProjectId = '', user = null, options = {}) => {
  const seenIds = new Set();
  const proOnly = Boolean(options.proOnly);
  return (Array.isArray(projectLibrary) ? projectLibrary : [])
    .filter((record) => !proOnly || isProPromotionProject(record))
    .map((record) => ({
      id: getProjectRecordId(record),
      userId: getProjectRecordUserId(record, user),
      title: getProjectRecordTitle(record),
    }))
    .filter((option) => {
      if (!option.id || option.id === activeProjectId || seenIds.has(option.id)) return false;
      seenIds.add(option.id);
      return true;
    });
};

export function SkillCheckFields({
  entry,
  updateEntry,
  conversationNodes = [],
  project,
  heroSkills,
  getSceneLabel,
}) {
  const isProPromotionMode = isProPromotionProject(project);

  return (
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
      <textarea value={entry.skillCheckSuccessDialogue || ''} placeholder="Tu réussis le test." onChange={(event) => updateEntry((target) => {
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

      {!isProPromotionMode ? (
        <>
          <HelpLabel help="Scène ouverte si le test réussit. Laisse vide pour rester dans la scène actuelle ou seulement afficher le message.">Scène de réussite</HelpLabel>
          <select value={entry.skillCheckSuccessTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
            target.skillCheckSuccessTargetSceneId = event.target.value;
          })}>
            <option value="">Aucune scène</option>
            {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
        </>
      ) : null}

      <HelpLabel help="Texte ajouté au résultat du jet quand le total est inférieur à la difficulté. Indique clairement la conséquence.">Message d'échec</HelpLabel>
      <textarea value={entry.skillCheckFailureDialogue || ''} placeholder="Tu rates le test." onChange={(event) => updateEntry((target) => {
        target.skillCheckFailureDialogue = event.target.value;
      })} />

      {conversationNodes.length ? (
        <>
          <HelpLabel help="Dans une conversation, question ouverte après un échec. Utile pour proposer de payer un coût, rebrousser chemin ou demander de l'aide.">Question après échec</HelpLabel>
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

      {!isProPromotionMode ? (
        <>
          <HelpLabel help="Scène ouverte si le test échoue. Laisse vide si l'échec doit seulement afficher un message ou retirer des PV.">Scène d'échec</HelpLabel>
          <select value={entry.skillCheckFailureTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
            target.skillCheckFailureTargetSceneId = event.target.value;
          })}>
            <option value="">Aucune scène</option>
            {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
        </>
      ) : null}

      <HelpLabel help="PV retirés au héros en cas d'échec. Évite une valeur égale ou supérieure aux PV max sauf si tu veux une défaite immédiate.">Perte de PV en échec</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.skillCheckFailureHealthLoss || 0}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.skillCheckFailureHealthLoss = nextValue;
        })}
      />

      <HelpLabel help="Objet ajouté à l'inventaire uniquement si le test réussit. Peut être un indice, une clé ou un objet héros comme une potion.">Objet gagné en réussite</HelpLabel>
      <select value={entry.skillCheckSuccessRewardItemId || ''} onChange={(event) => updateEntry((target) => {
        target.skillCheckSuccessRewardItemId = event.target.value;
      })}>
        <option value="">Aucun objet</option>
        {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
      </select>
    </div>
  );
}

export function HeroCombatFields({
  entry,
  updateEntry,
  project,
  heroSkills,
  getSceneLabel,
}) {
  const isProPromotionMode = isProPromotionProject(project);

  return (
    <div className="nested-editor-card hero-skill-check-editor">
      <HelpLabel help="Nom utilisé dans les messages de combat en Preview. Exemple : Garde spectral ou Araignée géante.">Ennemi</HelpLabel>
      <input value={entry.combatEnemyName || ''} placeholder="Garde spectral" onChange={(event) => updateEntry((target) => {
        target.combatEnemyName = event.target.value;
      })} />

      <HelpLabel help="PV de départ de cet ennemi. Chaque clic de combat garde les PV restants jusqu'à victoire, reset Preview ou chargement.">PV ennemi</HelpLabel>
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

      {!isProPromotionMode ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}

export function HeroMalusFields({ entry, updateEntry, isHeroAdventureProject }) {
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
        placeholder="Le mauvais chemin te coûte de l'énergie."
        onChange={(event) => updateEntry((target) => {
          target.heroMalusMessage = event.target.value;
        })}
      />
    </div>
  );
}

export default function HotspotActionFields({
  children,
  entry,
  updateEntry,
  actionType = 'dialogue',
  isBeginnerMode = false,
  isHeroAdventureProject = false,
  selectedSceneId = '',
  project = { scenes: [], items: [], cinematics: [], enigmas: [] },
  user = null,
  projectLibrary = [],
  activeProjectId = '',
  heroSkills = [],
  getSceneLabel = (id) => id,
}) {
  if (children) return <div className="hotspot-action-fields">{children}</div>;
  if (!entry || !updateEntry) return null;

  const currentActionType = actionType || entry.actionType || 'dialogue';
  const isProPromotionMode = isProPromotionProject(project);
  const canUseProPages = isProfessionalAccount(user) || isProPromotionMode;
  const showDialogue = !['none', 'skill_check', 'hero_combat', 'project_link'].includes(currentActionType);
  const showRewardItem = !isProPromotionMode && (currentActionType === 'dialogue_item' || Boolean(entry.rewardItemId));
  const showSceneTarget = !isProPromotionMode && currentActionType === 'scene';
  const showCinematicTarget = currentActionType === 'cinematic';
  const showExternalLink = currentActionType === 'external_link';
  const showProjectLink = currentActionType === 'project_link' && canUseProPages;
  const showEnigmaLink = !isProPromotionMode && !['none', 'conversation', 'skill_check', 'hero_combat'].includes(currentActionType);
  const projectLinkOptions = getProjectLinkOptions(projectLibrary, activeProjectId, user);
  const selectedProjectOption = entry.targetProjectId && !projectLinkOptions.some((option) => option.id === entry.targetProjectId)
    ? [{
      id: entry.targetProjectId,
      userId: entry.targetProjectUserId || user?.id || '',
      title: 'Projet sélectionné',
    }]
    : [];
  const displayedProjectLinkOptions = [...selectedProjectOption, ...projectLinkOptions];

  return (
    <div className="hotspot-action-fields">
      {!isBeginnerMode && currentActionType === 'skill_check' ? (
        <SkillCheckFields entry={entry} updateEntry={updateEntry} project={project} heroSkills={heroSkills} getSceneLabel={getSceneLabel} />
      ) : null}
      {!isBeginnerMode && currentActionType === 'hero_combat' ? (
        <HeroCombatFields entry={entry} updateEntry={updateEntry} project={project} heroSkills={heroSkills} getSceneLabel={getSceneLabel} />
      ) : null}
      {currentActionType !== 'none' ? (
        <HeroMalusFields entry={entry} updateEntry={updateEntry} isHeroAdventureProject={isHeroAdventureProject} />
      ) : null}

      {showDialogue ? (
        <>
          <HelpLabel help="Texte affiché lors de l'interaction principale. Il peut donner une réaction, un indice ou confirmer une action réussie.">Dialogue</HelpLabel>
          <textarea data-tour="hotspot-dialogue" value={entry.dialogue || ''} onChange={(event) => updateEntry((target) => {
            target.dialogue = event.target.value;
          })} />
        </>
      ) : null}

      {showRewardItem ? (
        <>
          <HelpLabel help="Objet ajouté à l'inventaire quand cette zone réussit.">Objet donné</HelpLabel>
          <select data-tour="hotspot-reward-item" value={entry.rewardItemId || ''} onChange={(event) => updateEntry((target) => {
            target.rewardItemId = event.target.value;
          })}>
            <option value="">Aucun</option>
            {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
          </select>
        </>
      ) : null}

      {showExternalLink ? (
        <>
          <HelpLabel help="URL ouverte dans un nouvel onglet quand le joueur clique cette zone. Tu peux saisir une adresse complète ou un domaine.">Lien externe</HelpLabel>
          <input
            data-tour="hotspot-external-url"
            type="url"
            value={entry.externalUrl || ''}
            placeholder="https://ton-site.fr/page"
            onChange={(event) => updateEntry((target) => {
              target.externalUrl = event.target.value;
            })}
          />
        </>
      ) : null}

      {showProjectLink ? (
        <>
          <HelpLabel help="Projet ouvert dans un nouvel onglet quand cette zone est cliquée.">Projet cible</HelpLabel>
          <select data-tour="hotspot-target-project" value={entry.targetProjectId || ''} onChange={(event) => updateEntry((target) => {
            const nextProject = displayedProjectLinkOptions.find((option) => option.id === event.target.value);
            target.targetProjectId = nextProject?.id || '';
            target.targetProjectUserId = nextProject?.userId || '';
          })}>
            <option value="">Aucun projet</option>
            {displayedProjectLinkOptions.map((option) => (
              <option key={`${option.userId || 'user'}-${option.id}`} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
          {!displayedProjectLinkOptions.length ? (
            <p className="small-note">Aucun autre projet disponible pour ce compte.</p>
          ) : null}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(entry.accessCodeEnabled)}
              onChange={(event) => updateEntry((target) => {
                target.accessCodeEnabled = event.target.checked;
              })}
            />
            Bloquer l'accès par code
          </label>
          {entry.accessCodeEnabled ? (
            <>
              <HelpLabel help="Code demandé au joueur avant d'ouvrir le projet cible.">Code d'accès</HelpLabel>
              <input
                data-tour="hotspot-access-code"
                type="password"
                value={entry.accessCode || ''}
                placeholder="Mot de passe"
                onChange={(event) => updateEntry((target) => {
                  target.accessCode = event.target.value;
                })}
              />
            </>
          ) : null}
        </>
      ) : null}

      {showSceneTarget ? (
        <>
          <HelpLabel help="Destination utilisée si l'action est Changer de scène.">Scène cible</HelpLabel>
          <select data-tour="hotspot-target-scene" value={entry.targetSceneId || ''} onChange={(event) => updateEntry((target) => {
            target.targetSceneId = event.target.value;
          })}>
            <option value="">Aucune</option>
            {(project.scenes || []).filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
          </select>
        </>
      ) : null}

      {!isBeginnerMode && showCinematicTarget ? (
        <>
          <HelpLabel help="Cinématique lancée après l'interaction réussie. Elle peut servir de transition, révélation ou fin de séquence.">Cinématique cible</HelpLabel>
          <select data-tour="hotspot-target-cinematic" value={entry.targetCinematicId || ''} onChange={(event) => updateEntry((target) => {
            target.targetCinematicId = event.target.value;
          })}>
            <option value="">Aucune</option>
            {(project.cinematics || []).map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
          </select>
        </>
      ) : null}

      {showEnigmaLink ? (
        <>
          <HelpLabel help="Énigme à résoudre avant d'exécuter l'action de la zone. Si elle échoue ou reste ouverte, la suite ne se déclenche pas encore.">Énigme liée</HelpLabel>
          <select data-tour="hotspot-linked-enigma" value={entry.enigmaId || ''} onChange={(event) => updateEntry((target) => {
            target.enigmaId = event.target.value;
          })}>
            <option value="">Aucune</option>
            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
          </select>
        </>
      ) : null}
    </div>
  );
}
