import NumberInput from '../forms/NumberInput.jsx';
import { HelpLabel } from './SceneEditorChrome.jsx';

export function SkillCheckFields({
  entry,
  updateEntry,
  conversationNodes = [],
  project,
  heroSkills,
  getSceneLabel,
}) {
  return (
    <div className="nested-editor-card hero-skill-check-editor">
      <HelpLabel help="Competence utilisee par le jet automatique en Preview. Le joueur clique la zone ou la reponse, puis le jeu lance le de et ajoute ce bonus.">Competence testee</HelpLabel>
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

      <HelpLabel help="Seuil a atteindre avec de + bonus. Exemple : difficulte 12, Force +3, jet 9 donne 12 et reussit.">Difficulte</HelpLabel>
      <NumberInput
        min="1"
        max="99"
        value={entry.skillCheckDifficulty || 12}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.skillCheckDifficulty = nextValue;
        })}
      />

      <HelpLabel help="Mana retiree avant le jet. Si le heros n'a pas assez de mana, le test ne se lance pas et affiche Mana insuffisante.">Cout mana du test</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.skillCheckManaCost ?? heroSkills.find((skill) => skill.id === (entry.skillCheckSkillId || heroSkills[0]?.id || ''))?.manaCost ?? 0}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.skillCheckManaCost = nextValue;
        })}
      />

      <HelpLabel help="Texte ajoute au resultat du jet quand le total atteint ou depasse la difficulte. Exemple : Tu franchis le pont.">Message de reussite</HelpLabel>
      <textarea value={entry.skillCheckSuccessDialogue || ''} placeholder="Tu reussis le test." onChange={(event) => updateEntry((target) => {
        target.skillCheckSuccessDialogue = event.target.value;
      })} />

      {conversationNodes.length ? (
        <>
          <HelpLabel help="Dans une conversation, question ouverte apres une reussite. Laisse Fin si le test doit fermer la conversation.">Question apres reussite</HelpLabel>
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

      <HelpLabel help="Scene ouverte si le test reussit. Laisse vide pour rester dans la scene actuelle ou seulement afficher le message.">Scene de reussite</HelpLabel>
      <select value={entry.skillCheckSuccessTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.skillCheckSuccessTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scene</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>

      <HelpLabel help="Texte ajoute au resultat du jet quand le total est inferieur a la difficulte. Indique clairement la consequence.">Message d'echec</HelpLabel>
      <textarea value={entry.skillCheckFailureDialogue || ''} placeholder="Tu rates le test." onChange={(event) => updateEntry((target) => {
        target.skillCheckFailureDialogue = event.target.value;
      })} />

      {conversationNodes.length ? (
        <>
          <HelpLabel help="Dans une conversation, question ouverte apres un echec. Utile pour proposer payer un cout, rebrousser chemin ou demander de l'aide.">Question apres echec</HelpLabel>
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

      <HelpLabel help="Scene ouverte si le test echoue. Laisse vide si l'echec doit seulement afficher un message ou retirer des PV.">Scene d'echec</HelpLabel>
      <select value={entry.skillCheckFailureTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.skillCheckFailureTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scene</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>

      <HelpLabel help="PV retires au heros en cas d'echec. Evite une valeur egale ou superieure aux PV max sauf si tu veux une defaite immediate.">Perte de PV en echec</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.skillCheckFailureHealthLoss || 0}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.skillCheckFailureHealthLoss = nextValue;
        })}
      />

      <HelpLabel help="Objet ajoute a l'inventaire uniquement si le test reussit. Peut etre un indice, une cle ou un objet heros comme une potion.">Objet gagne en reussite</HelpLabel>
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
  return (
    <div className="nested-editor-card hero-skill-check-editor">
      <HelpLabel help="Nom utilise dans les messages de combat en Preview. Exemple : Garde spectral ou Araignee geante.">Ennemi</HelpLabel>
      <input value={entry.combatEnemyName || ''} placeholder="Garde spectral" onChange={(event) => updateEntry((target) => {
        target.combatEnemyName = event.target.value;
      })} />

      <HelpLabel help="PV de depart de cet ennemi. Chaque clic de combat garde les PV restants jusqu'a victoire, reset Preview ou chargement.">PV ennemi</HelpLabel>
      <NumberInput
        min="1"
        max="999"
        value={entry.combatEnemyMaxHealth || 8}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatEnemyMaxHealth = nextValue;
        })}
      />

      <HelpLabel help="Competence ajoutee au jet d'attaque. Le combat lance automatiquement le de quand le joueur clique cette zone.">Competence d'attaque</HelpLabel>
      <select value={entry.combatSkillId || heroSkills[0]?.id || ''} onChange={(event) => updateEntry((target) => {
        target.combatSkillId = event.target.value;
      })}>
        {heroSkills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.name} {Number(skill.value) >= 0 ? '+' : ''}{Number(skill.value) || 0}
          </option>
        ))}
      </select>

      <HelpLabel help="Seuil a atteindre avec de + bonus pour toucher. Si le total est plus bas, l'attaque rate et l'ennemi peut riposter.">Difficulte pour toucher</HelpLabel>
      <NumberInput
        min="1"
        max="99"
        value={entry.combatAttackDifficulty || 10}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatAttackDifficulty = nextValue;
        })}
      />

      <HelpLabel help="PV retires au heros si l'ennemi survit apres l'attaque. Mets 0 pour un obstacle sans riposte.">Degats ennemis</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.combatEnemyStrength ?? entry.combatEnemyDamage ?? 2}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatEnemyStrength = nextValue;
          target.combatEnemyDamage = nextValue;
        })}
      />

      <HelpLabel help="Mana retiree a chaque tentative d'attaque. Si le heros n'a pas assez de mana, le combat ne lance pas le jet.">Cout mana par attaque</HelpLabel>
      <NumberInput
        min="0"
        max="99"
        value={entry.combatManaCost || 0}
        onValueChange={(nextValue) => updateEntry((target) => {
          target.combatManaCost = nextValue;
        })}
      />

      <HelpLabel help="Texte ajoute quand l'ennemi tombe a 0 PV, avant de donner la recompense ou changer de scene.">Message de victoire</HelpLabel>
      <textarea value={entry.combatVictoryDialogue || ''} placeholder="L'ennemi s'effondre." onChange={(event) => updateEntry((target) => {
        target.combatVictoryDialogue = event.target.value;
      })} />

      <HelpLabel help="Texte ajoute si la riposte fait tomber le heros a 0 PV. Tu peux aussi envoyer vers une scene de defaite.">Message de defaite</HelpLabel>
      <textarea value={entry.combatDefeatDialogue || ''} placeholder="Tu n'as plus la force de continuer." onChange={(event) => updateEntry((target) => {
        target.combatDefeatDialogue = event.target.value;
      })} />

      <HelpLabel help="Objet ajoute a l'inventaire quand l'ennemi est vaincu. Optionnel : laisse Aucun si la victoire ouvre seulement une scene.">Recompense</HelpLabel>
      <select value={entry.combatRewardItemId || ''} onChange={(event) => updateEntry((target) => {
        target.combatRewardItemId = event.target.value;
      })}>
        <option value="">Aucun objet</option>
        {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
      </select>

      <HelpLabel help="Scene ouverte apres la victoire. Laisse vide pour rester sur place avec l'ennemi marque comme vaincu.">Scene de victoire</HelpLabel>
      <select value={entry.combatVictoryTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.combatVictoryTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scene</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>

      <HelpLabel help="Scene ouverte si le heros tombe a 0 PV pendant ce combat. Laisse vide pour afficher seulement le message de defaite.">Scene de defaite</HelpLabel>
      <select value={entry.combatDefeatTargetSceneId || ''} onChange={(event) => updateEntry((target) => {
        target.combatDefeatTargetSceneId = event.target.value;
      })}>
        <option value="">Aucune scene</option>
        {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>
    </div>
  );
}

export function HeroMalusFields({ entry, updateEntry, isHeroAdventureProject }) {
  if (!isHeroAdventureProject) return null;

  return (
    <div className="nested-editor-card hero-skill-check-editor">
      <HelpLabel help="Consequences appliquees des que le joueur prend ce choix ou cette zone. A utiliser pour un mauvais chemin, un piege, une erreur de confiance ou une route dangereuse. Mets 0 partout pour aucun malus.">Malus mauvais chemin</HelpLabel>
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
      <HelpLabel help="Texte affiche avec la perte de PV ou de mana. Exemple : Le sentier s'effondre sous tes pas.">Message du malus</HelpLabel>
      <textarea
        value={entry.heroMalusMessage || ''}
        placeholder="Le mauvais chemin te coute de l'energie."
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
  heroSkills = [],
  getSceneLabel = (id) => id,
}) {
  if (children) return <div className="hotspot-action-fields">{children}</div>;
  if (!entry || !updateEntry) return null;

  return (
    <div className="hotspot-action-fields">
      {!isBeginnerMode && actionType === 'skill_check' ? (
        <SkillCheckFields entry={entry} updateEntry={updateEntry} project={project} heroSkills={heroSkills} getSceneLabel={getSceneLabel} />
      ) : null}
      {!isBeginnerMode && actionType === 'hero_combat' ? (
        <HeroCombatFields entry={entry} updateEntry={updateEntry} project={project} heroSkills={heroSkills} getSceneLabel={getSceneLabel} />
      ) : null}
      <HeroMalusFields entry={entry} updateEntry={updateEntry} isHeroAdventureProject={isHeroAdventureProject} />

      <HelpLabel help="Texte affiche lors de l'interaction principale. Il peut donner une reaction, un indice ou confirmer une action reussie.">Dialogue</HelpLabel>
      <textarea data-tour="hotspot-dialogue" value={entry.dialogue} onChange={(event) => updateEntry((target) => {
        target.dialogue = event.target.value;
      })} />

      <HelpLabel help="Destination utilisee si l'action est Changer de scene. Laisse vide si la zone doit seulement parler ou donner un objet.">Scene cible</HelpLabel>
      <select data-tour="hotspot-target-scene" value={entry.targetSceneId} onChange={(event) => updateEntry((target) => {
        target.targetSceneId = event.target.value;
      })}>
        <option value="">Aucune</option>
        {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
      </select>

      {!isBeginnerMode ? (
        <>
          <HelpLabel help="Cinematique lancee apres l'interaction reussie. Elle peut servir de transition, revelation ou fin de sequence.">Cinematique cible</HelpLabel>
          <select data-tour="hotspot-target-cinematic" value={entry.targetCinematicId} onChange={(event) => updateEntry((target) => {
            target.targetCinematicId = event.target.value;
          })}>
            <option value="">Aucune</option>
            {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
          </select>
        </>
      ) : null}

      <HelpLabel help="Enigme a resoudre avant d'executer l'action de la zone. Si elle echoue ou reste ouverte, la suite ne se declenche pas encore.">Enigme liee</HelpLabel>
      <select data-tour="hotspot-linked-enigma" value={entry.enigmaId || ''} onChange={(event) => updateEntry((target) => {
        target.enigmaId = event.target.value;
      })}>
        <option value="">Aucune</option>
        {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
      </select>
    </div>
  );
}
