# Mécanique de combat

Cette page documente le combat Hero Adventure côté développeur. La règle d'or : les calculs purs restent dans `src/lib/combatEngine.js`. La Preview, la simulation éditeur et l'export standalone doivent appeler ce moteur au lieu de recalculer les règles.

## Fichiers de référence

- `src/lib/combatEngine.js` : règles pures, jets, mana, dégâts, critiques, résistances, victoire/défaite, récompense, simulation et équilibrage.
- `src/lib/combatDefaults.js` : valeurs par défaut globales du combat et defaults des médias d'impact.
- `src/hooks/usePreviewPlayer.js` : branchement runtime React, état courant du héros et de l'ennemi, messages et effets visuels.
- `src/components/CombatTab.jsx` : éditeur, simulation ponctuelle et mode équilibrage.
- `src/utils/standaloneHtml.js` : sérialisation des helpers nécessaires pour que l'export standalone joue les mêmes règles.

## Stats disponibles

### Héros

Les stats viennent de `project.heroAdventure.hero`.

- `health`, `maxHealth` : PV courants et maximum.
- `mana`, `maxMana` : mana courant et maximum.
- `skills[]` : compétences disponibles. Chaque entrée utilise surtout `id`, `name`, `value` et `manaCost`.
- `powers[]` : pouvoirs du héros. Chaque pouvoir utilise `id`, `name`, `type`, `force` et `manaCost`.
- `resistanceWater`, `resistanceEarth`, `resistanceFire`, `resistanceLightning` : résistances élémentaires du héros, de 0 à 100.

Les règles globales du héros viennent de `project.heroAdventure.rules`.

- `criticalSuccess` : face du dé qui réussit toujours.
- `criticalFailure` : face du dé qui échoue toujours.
- `criticalChance` : chance de critique aléatoire du héros, en pourcentage.
- `criticalMultiplier` : multiplicateur appliqué aux dégâts critiques du héros.

### Dé et compétence

Le dé vient de `project.heroAdventure.dice`.

- `sides` : nombre de faces.
- `label` : libellé affiché, par exemple `d20`.

La compétence d'attaque est choisie par `entry.combatSkillId`. Si elle n'existe pas, le moteur prend la première compétence du héros. La force de base du héros vient de la compétence `Force` si elle existe, sinon de la compétence sélectionnée ou de la première compétence.

### Ennemi et combat

Les defaults globaux sont dans `DEFAULT_COMBAT_SETTINGS`.

- `turnMode` : combat en tour par tour ou résolution directe.
- `showDice` : affichage du dé central.
- `enemyAutoTurn` : riposte ennemie automatique ou déclenchée par le joueur.
- `heroAttackType` : type des dégâts du héros sans pouvoir (`physical`, `water`, `earth`, `fire`, `lightning`).
- `enemyStrength` : dégâts de base de la riposte normale.
- `enemyMaxMana` : mana maximum de l'ennemi.
- `enemyPowerName`, `enemyPowerType`, `enemyPowerManaCost`, `enemyPowerDamage`, `enemyPowerUsageChance` : pouvoir ennemi.
- `enemyCriticalChance`, `enemyCriticalMultiplier` : critique ennemi.
- `enemyResistanceWater`, `enemyResistanceEarth`, `enemyResistanceFire`, `enemyResistanceLightning` : résistances ennemies.

Chaque zone ou réponse `hero_combat` peut surcharger les defaults avec les champs `combat...` :

- `combatEnemyName`, `combatEnemyMaxHealth`.
- `combatAttackDifficulty`.
- `combatSkillId`, `combatManaCost`.
- `combatHeroAttackType`.
- `combatEnemyStrength`, `combatEnemyMaxMana`.
- `combatEnemyPowerName`, `combatEnemyPowerType`, `combatEnemyPowerManaCost`, `combatEnemyPowerDamage`, `combatEnemyPowerUsageChance`.
- `combatEnemyCriticalChance`, `combatEnemyCriticalMultiplier`.
- `combatEnemyResistanceWater`, `combatEnemyResistanceEarth`, `combatEnemyResistanceFire`, `combatEnemyResistanceLightning`.
- `combatRewardItemId`, `combatVictoryDialogue`, `combatDefeatDialogue`, `combatVictoryTargetSceneId`, `combatDefeatTargetSceneId`.

`getCombatEnemyStats()` fusionne les valeurs d'entrée et les defaults. `getCombatSimulationStats()` ajoute le héros, le dé et les règles critiques.

## Calcul des dégâts

### Attaque du héros

La fonction centrale est `resolveHeroCombatAttack()`.

1. Le coût de mana vaut `combatManaCost + power.manaCost`.
2. Si le héros n'a pas assez de mana, l'attaque renvoie `ok: false` avec `reason: 'not_enough_mana'`.
3. Le jet utilise `rollDie()`, puis `resolveRollOutcome()`.
4. Le total vaut `raw + skillBonus`.
5. Le jet réussit si `raw === criticalSuccess`, ou si `raw !== criticalFailure` et `total >= difficulty`.
6. Si le jet réussit, les dégâts de base valent `heroForce + power.force`. Sinon ils valent `0`.
7. Le critique se déclenche sur réussite critique naturelle ou selon `criticalChance`. Il multiplie les dégâts par `criticalMultiplier`.
8. Le type d'attaque vaut `power.type` si un pouvoir est utilisé, sinon `heroAttackType`.
9. Si le type n'est pas `physical`, la résistance ennemie correspondante réduit les dégâts.
10. Les PV ennemis deviennent `max(0, enemyHealth - damage)`.

La résistance est calculée par `applyResistance(damage, resistance)` :

```js
Math.round(damage * (100 - resistance) / 100)
```

La valeur est bornée à 0 minimum. Une résistance de 100 annule donc les dégâts.

### Attaque ennemie

La fonction centrale est `resolveEnemyCombatAttack()`.

1. L'ennemi utilise son pouvoir si `enemyMaxMana > 0`, si le coût est disponible et si le tirage aléatoire passe `enemyPowerUsageChance`.
2. Les dégâts de base valent `enemyPowerDamage` si le pouvoir est utilisé, sinon `enemyStrength`.
3. Le critique ennemi utilise `enemyCriticalChance` et `enemyCriticalMultiplier`.
4. Les résistances du héros ne s'appliquent qu'aux pouvoirs élémentaires ennemis. Une riposte normale n'a pas de type élémentaire.
5. Les PV du héros deviennent `max(0, heroHealth - damage)`.

### Issue du combat

- Victoire : l'ennemi tombe à 0 PV après l'attaque du héros.
- Défaite : le héros tombe à 0 PV après la riposte ennemie.
- Blocage : mana insuffisante pour attaquer.
- Timeout : `simulateCombat()` atteint `maxRounds`.

`resolveCombatVictoryReward()` renvoie l'objet gagné et le message de récompense. L'ajout réel à l'inventaire reste côté runtime (`usePreviewPlayer.js` ou standalone).

## Simulation et équilibrage

`simulateCombat(project, entry, combat, options)` exécute le même échange que la Preview avec `resolveCombatExchange()`. Elle renvoie notamment :

- `status`
- `rounds`
- `heroDamageTotal`, `enemyDamageTotal`, `totalDamage`
- `heroDamagePerRound`, `enemyDamagePerRound`, `totalDamagePerRound`
- `logs`

`estimateCombatBalance()` lance plusieurs simulations avec un générateur pseudo-aléatoire seedé. Le mode équilibrage de `CombatTab.jsx` utilise 300 itérations et affiche :

- chance de victoire estimée
- durée moyenne
- dégâts moyens du héros par tour
- dégâts moyens de l'ennemi par tour
- compte des victoires, défaites, blocages et timeouts

## Brancher un nouveau type d'effet

Il existe deux notions d'effet.

### Effet visuel d'impact

Les effets configurables actuels sont les médias d'impact `hit` et `death` pour `hero` et `enemy`.

Pour ajouter un nouvel outcome configurable, par exemple `shield` :

1. Ajouter le slot dans `COMBAT_EFFECT_SLOTS` dans `src/lib/combatDefaults.js`.
2. Ajouter son libellé dans `COMBAT_EFFECT_EDITOR_SLOTS` dans `src/components/CombatTab.jsx`.
3. Déclencher l'effet dans `src/hooks/usePreviewPlayer.js`, idéalement via `makeCombatVisualEffect()` ou une variante de `makeCombatOutcomeEffect()`.
4. Vérifier que `src/components/PreviewTab.jsx` rend bien le nouveau `effect.type` avec une classe CSS adaptée.
5. Si l'effet doit exister en export standalone, ajouter le rendu équivalent dans `src/utils/standaloneHtml.js`.
6. Ajouter ou adapter un test si l'effet dépend d'une règle de calcul.

Les champs de média sont générés par `getCombatEffectFieldBase(actor, outcome)` :

```text
heroHitEffectMediaType
heroHitEffectImageData
heroHitEffectAnime2dSpec
heroHitEffectVideoData
heroHitEffectAudioData
```

Un nouvel outcome suit le même schéma.

### Effet de gameplay

Pour un effet qui change les règles, par exemple poison, bouclier ou vol de vie :

1. Ajouter les champs de données dans les entrées de combat et/ou `DEFAULT_COMBAT_SETTINGS`.
2. Normaliser ces champs dans `getCombatEnemyStats()` ou `getCombatSimulationStats()`.
3. Appliquer la règle dans `resolveHeroCombatAttack()`, `resolveEnemyCombatAttack()` ou `resolveCombatExchange()`.
4. Exposer le réglage dans `CombatTab.jsx`.
5. Mettre à jour `usePreviewPlayer.js` pour les messages, l'état persistant et les effets visuels.
6. Mettre à jour `standaloneHtml.js` si la règle doit fonctionner dans les jeux exportés.
7. Ajouter des tests unitaires dans `src/__tests__/combatEngine.test.js`.

Ne branche pas une règle de gameplay uniquement dans l'UI : la simulation, la Preview et l'export doivent rester alignés en passant par le moteur.
