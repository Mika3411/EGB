import { useMemo, useState } from 'react';
import { AlertTriangle, Dices, Eye, Heart, Plus, ShieldCheck, Sparkles, Swords, Trash2, Trophy } from 'lucide-react';
import HelpLabel from './forms/HelpLabel.jsx';
import HeroCharacterSheetPreview from './HeroCharacterSheetPreview.jsx';
import {
  estimateCombatBalance,
  getCombatSimulationStats,
  resolveRollOutcome,
} from '../lib/combatEngine.js';
import {
  DEFAULT_EDITOR_EQUIPMENT_SLOT_LABELS as DEFAULT_EQUIPMENT_SLOT_LABELS,
  DEFAULT_HERO_EDITOR_ADVENTURE,
  DEFAULT_HERO_EDITOR_SKILLS as DEFAULT_SKILLS,
  HERO_DICE_SKIN_IDS,
  HERO_POWER_TYPE_IDS,
  HERO_STATUS_EFFECT_TYPE_IDS,
  clampEditorNumber as clampNumber,
  normalizeHeroAdventure as normalizeSharedHeroAdventure,
  normalizeHeroRules as normalizeSharedHeroRules,
  normalizeHeroSheet as normalizeSharedHeroSheet,
  normalizeSkillId,
} from '../lib/heroAdventureDefaults.js';
const DEFAULT_HERO_ADVENTURE = DEFAULT_HERO_EDITOR_ADVENTURE;
const HERO_DICE_SKINS = [
  { id: 'classic', label: 'Ivoire' },
  { id: 'bone', label: 'Os ancien' },
  { id: 'royal', label: 'Métal royal' },
  { id: 'ember', label: 'Sang et cendre' },
  { id: 'mana', label: 'Mana cristal' },
  { id: 'forest', label: 'Survie' },
  { id: 'shadow', label: 'Ruse' },
  { id: 'divine', label: 'Serment' },
  { id: 'cursed', label: 'Maudit' },
];
const DICE_PREVIEW_PIPS = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
const BUTTON_STYLE_PRESETS = [
  { id: 'modern', label: 'Moderne' },
  { id: 'parchment', label: 'Parchemin' },
  { id: 'arcane', label: 'Arcane' },
  { id: 'stone', label: 'Pierre' },
  { id: 'neon', label: 'Néon' },
  { id: 'blood', label: 'Sombre' },
];
const BUTTON_STYLE_IDS = new Set(BUTTON_STYLE_PRESETS.map((style) => style.id));
const FONT_STYLE_PRESETS = [
  { id: 'system', label: 'Simple' },
  { id: 'serif', label: 'Roman' },
  { id: 'story', label: 'Livre' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'medieval', label: 'Médiéval' },
  { id: 'gothic', label: 'Gothique' },
  { id: 'mono', label: 'Code' },
];
const FONT_STYLE_IDS = new Set(FONT_STYLE_PRESETS.map((style) => style.id));
const HERO_POWER_TYPES = [
  { id: 'water', label: 'Eau' },
  { id: 'earth', label: 'Terre' },
  { id: 'fire', label: 'Feu' },
  { id: 'lightning', label: 'Foudre' },
];
const HERO_STATUS_EFFECT_TYPES = [
  { id: '', label: 'Aucun' },
  { id: 'poison', label: 'Poison' },
  { id: 'burn', label: 'Brûlure' },
  { id: 'stun', label: 'Étourdissement' },
  { id: 'bleed', label: 'Saignement' },
  { id: 'shield', label: 'Bouclier' },
  { id: 'force_buff', label: 'Bonus force' },
  { id: 'force_debuff', label: 'Malus force' },
  { id: 'difficulty_buff', label: 'Bonus difficulté' },
  { id: 'difficulty_debuff', label: 'Malus difficulté' },
  { id: 'resistance_buff', label: 'Bonus résistance' },
  { id: 'resistance_debuff', label: 'Malus résistance' },
  { id: 'critical_buff', label: 'Bonus critique' },
  { id: 'critical_debuff', label: 'Malus critique' },
];
const HERO_RESISTANCE_FIELDS = [
  { id: 'water', label: 'Eau', field: 'resistanceWater' },
  { id: 'earth', label: 'Terre', field: 'resistanceEarth' },
  { id: 'fire', label: 'Feu', field: 'resistanceFire' },
  { id: 'lightning', label: 'Foudre', field: 'resistanceLightning' },
];
const NARRATION_BACKGROUND_PRESETS = [
  { id: 'midnight', label: 'Nuit', value: 'rgba(2, 6, 23, .62)' },
  { id: 'parchment', label: 'Parchemin', value: 'rgba(120, 83, 36, .74)' },
  { id: 'royal', label: 'Royal', value: 'rgba(30, 58, 138, .68)' },
  { id: 'forest', label: 'Forêt', value: 'rgba(20, 83, 45, .68)' },
  { id: 'blood', label: 'Sombre', value: 'rgba(69, 10, 10, .72)' },
  { id: 'violet', label: 'Arcane', value: 'rgba(76, 29, 149, .70)' },
];
const FIELD_HELP = {
  enabled: "Affiche les options Hero aventure dans le jeu : fiche personnage, PV, mana, compétences, équipements, tests et combats.",
  heroName: "Nom du personnage joué par le joueur. Il apparaît sur la fiche personnage et dans le panneau Hero.",
  heroDescription: "Texte affiché au joueur au début, pendant le choix du personnage.",
  dice: "Le dé lancé pendant l'aventure. Exemple : avec d20, le joueur tire un nombre entre 1 et 20 pour les tests et les combats.",
  diceSkin: "Apparence des dés vus par le joueur pendant la création du héros, les tests et les combats.",
  buttonStyle: "Apparence des boutons vus par le joueur : choix, énigmes, inventaire, cinématiques et actions Hero.",
  buttonFont: "Police utilisée sur les boutons du jeu joueur.",
  narrationFont: "Police utilisée pour les textes de narration, dialogues, cinématiques et messages joueur.",
  narrationBackground: "Couleur du fond derrière la narration en Preview et dans le jeu exporté.",
  health: "Points de vie du héros. À 0 PV, le joueur est en danger ou perd selon les règles de ton jeu.",
  mana: "Réserve magique ou énergie du héros. Certaines actions peuvent coûter de la mana.",
  initiative: "Valeur comparée à l'initiative ennemie au début d'un combat. La plus haute agit en premier.",
  armor: "Réduction plate appliquée aux dégâts subis après critique et résistance.",
  dodgeChance: "Chance en pourcentage d'annuler une attaque ennemie avant l'armure.",
  characterBackground: "Image derrière la fiche personnage : salle, carte, parchemin, décor de ton univers.",
  characterImage: "Image du héros au centre de la fiche personnage. Un PNG transparent marche très bien.",
  setupBackground: "Image affichée derrière l'écran où le joueur lance les dés et découvre ses compétences.",
  setupMusic: "Musique jouée en boucle pendant la création du héros. Elle s'arrête quand l'aventure commence.",
  defeatScene: "Scène affichée automatiquement quand le héros tombe à 0 PV. Si aucune scène n'est choisie, le jeu affiche la fenêtre Défaite standard.",
  equipmentSlotCount: "Nombre d'emplacements autour du héros. Exemple : 6 slots pour casque, bouclier, arme, armure, anneau, jambières.",
  equipmentSlots: "Nom des emplacements portés. Tu peux les renommer selon ton univers : arme, relique, cape, sac, etc.",
  skills: "Bonus ajouté aux jets. Exemple : Force +3 signifie que le joueur ajoute +3 quand il utilise Force.",
  manaCost: "Mana dépensée quand cette compétence est utilisée depuis le panneau Hero.",
  criticalSuccess: "Résultat naturel du dé qui compte comme coup parfait. Exemple : 20 sur un d20.",
  criticalFailure: "Résultat naturel du dé qui compte comme gros échec. Exemple : 1 sur un d20.",
  criticalChance: "Chance en pourcentage que l'attaque du héros devienne critique, même sans résultat naturel parfait.",
  criticalMultiplier: "Multiplicateur appliqué aux dégâts du héros quand le dé fait une réussite critique.",
  failForward: "Quand le joueur échoue, prévoyez une suite intéressante : blessure, perte de mana, autre chemin, indice incomplet.",
};
const DICE_PRESETS = [4, 6, 8, 10, 12, 20, 100];
const rollDie = (sides = 6) => Math.floor(Math.random() * sides) + 1;
const HERO_INTERNAL_TABS = [
  { id: 'sheet', label: 'Fiche' },
  { id: 'preview', label: 'Aperçu' },
  { id: 'powers', label: 'Pouvoirs' },
  { id: 'skills', label: 'Compétences' },
  { id: 'rules', label: 'Affichage' },
  { id: 'balance', label: 'Équilibrage' },
  { id: 'guide', label: 'Guide' },
];

const createHeroSheetId = () => `hero_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const heroNormalizerOptions = {
  defaults: DEFAULT_HERO_ADVENTURE,
  profile: 'editor',
};

const normalizeHeroRules = (rawRules = {}, diceSides = DEFAULT_HERO_ADVENTURE.dice.sides) => (
  normalizeSharedHeroRules(rawRules, diceSides, heroNormalizerOptions)
);

const normalizeHeroSheet = (rawHero = {}, index = 0, diceSides = DEFAULT_HERO_ADVENTURE.dice.sides, fallbackRules = {}) => (
  normalizeSharedHeroSheet(rawHero, index, diceSides, fallbackRules, heroNormalizerOptions)
);

const normalizeHeroAdventure = (project = {}) => (
  normalizeSharedHeroAdventure(project, heroNormalizerOptions)
);

const asList = (value) => (Array.isArray(value) ? value : []);

const numberValue = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const sumNumbers = (values) => values.reduce((total, value) => (
  Number.isFinite(value) ? total + value : total
), 0);

const averageNumbers = (values) => {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return null;
  return sumNumbers(finiteValues) / finiteValues.length;
};

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return '-';
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
};

const formatDecimal = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '-';
  const next = value.toFixed(digits);
  return next.endsWith('.0') ? next.slice(0, -2) : next;
};

const formatSignedNumber = (value) => {
  const next = numberValue(value, 0);
  return `${next >= 0 ? '+' : ''}${next}`;
};

const getRollSuccessProbability = (sides, modifier, difficulty, rules = {}) => {
  const dieSides = Math.max(2, Math.round(numberValue(sides, 20)));
  const criticalSuccess = clampNumber(Number(rules?.criticalSuccess) || dieSides, dieSides, 1, dieSides);
  const criticalFailure = clampNumber(Number(rules?.criticalFailure) || 1, 1, 1, dieSides);
  let successCount = 0;
  for (let raw = 1; raw <= dieSides; raw += 1) {
    const outcome = resolveRollOutcome({
      raw,
      modifier,
      difficulty,
      criticalSuccess,
      criticalFailure,
    });
    if (outcome.success) successCount += 1;
  }
  return successCount / dieSides;
};

const getProbabilityRating = (probability) => {
  if (!Number.isFinite(probability) || probability <= 0) return { key: 'impossible', label: 'Impossible' };
  if (probability < 0.35) return { key: 'punitive', label: 'Punitif' };
  if (probability < 0.55) return { key: 'hard', label: 'Dur' };
  if (probability > 0.95) return { key: 'trivial', label: 'Trop facile' };
  if (probability > 0.85) return { key: 'easy', label: 'Facile' };
  return { key: 'balanced', label: 'Équilibré' };
};

const getCombatRating = (winProbability, expectedDamage, heroHealth, hitProbability, minManaBlocked, survivalProbability = 1) => {
  const healthRatio = heroHealth > 0 && Number.isFinite(expectedDamage) ? expectedDamage / heroHealth : 0;
  if (minManaBlocked || hitProbability <= 0 || winProbability < 0.15 || survivalProbability < 0.25) return { key: 'impossible', label: 'Quasi impossible' };
  if (winProbability < 0.45 || survivalProbability < 0.55 || healthRatio >= 0.75) return { key: 'punitive', label: 'Très punitif' };
  if (winProbability < 0.7 || survivalProbability < 0.8 || healthRatio >= 0.45) return { key: 'hard', label: 'Tendu' };
  if (winProbability > 0.93 && healthRatio <= 0.15) return { key: 'easy', label: 'Très facile' };
  return { key: 'balanced', label: 'Équilibré' };
};

const getHeroItemLabel = (item, skills = []) => {
  if (!item) return 'Objet introuvable';
  const itemType = item.heroItemType || 'none';
  if (itemType === 'health_potion') return `Potion PV +${Math.max(1, numberValue(item.heroItemAmount, 4))}`;
  if (itemType === 'mana_potion') return `Potion mana +${Math.max(1, numberValue(item.heroItemAmount, 3))}`;
  if (itemType === 'equipment') {
    const target = item.heroItemBonusTarget || 'skill';
    const bonus = formatSignedNumber(item.heroItemBonus || 1);
    if (target === 'maxHealth') return `équipement PV max ${bonus}`;
    if (target === 'maxMana') return `équipement mana max ${bonus}`;
    const skill = skills.find((entry) => entry.id === item.heroItemSkillId);
    return `Équipement ${skill?.name || 'compétence'} ${bonus}`;
  }
  return 'Objet narratif';
};

const getSourceLabel = ({ scene, sceneIndex, hotspot, hotspotIndex, node, nodeIndex, reply, replyIndex }) => {
  const sceneLabel = scene?.name || `Scène ${sceneIndex + 1}`;
  const hotspotLabel = hotspot?.name || `Zone ${hotspotIndex + 1}`;
  if (reply) {
    const nodeLabel = node?.speaker || node?.text || `Question ${nodeIndex + 1}`;
    const replyLabel = reply.label || `Réponse ${replyIndex + 1}`;
    return `${sceneLabel} / ${hotspotLabel} / ${String(nodeLabel).slice(0, 32)} / ${String(replyLabel).slice(0, 36)}`;
  }
  return `${sceneLabel} / ${hotspotLabel}`;
};

export const buildHeroBalanceReport = (project = {}, heroAdventure = DEFAULT_HERO_ADVENTURE, options = {}) => {
  const hero = heroAdventure.hero || DEFAULT_HERO_ADVENTURE.hero;
  const skills = asList(hero.skills).length ? asList(hero.skills) : DEFAULT_SKILLS;
  const fallbackSkill = skills[0] || DEFAULT_SKILLS[0];
  const diceSides = Math.max(2, numberValue(heroAdventure.dice?.sides, 20));
  const balanceProject = {
    ...project,
    heroAdventure: {
      ...(project.heroAdventure || {}),
      ...heroAdventure,
      hero,
      rules: hero.rules || heroAdventure.rules || DEFAULT_HERO_ADVENTURE.rules,
      combat: heroAdventure.combat || DEFAULT_HERO_ADVENTURE.combat,
    },
  };
  const combatIterations = clampNumber(options.combatIterations, 240, 1, 5000);
  const combatMaxRounds = clampNumber(options.combatMaxRounds, 60, 1, 500);
  const items = asList(project.items);
  const checks = [];
  const combats = [];
  const maluses = [];
  const rewards = [];
  let sequence = 0;

  const getSkill = (skillId) => skills.find((skill) => skill.id === skillId) || fallbackSkill;
  const getItem = (itemId) => items.find((item) => item.id === itemId) || null;
  const pushReward = (itemId, sourceLabel, index, reason = 'Récompense') => {
    if (!itemId) return;
    const item = getItem(itemId);
    rewards.push({
      id: `${itemId}-${index}-${rewards.length}`,
      itemId,
      item,
      itemName: item?.name || 'Objet introuvable',
      sourceLabel,
      index,
      reason,
    });
  };
  const pushMalus = (entry, sourceLabel, index) => {
    const healthLoss = Math.max(0, numberValue(entry.heroMalusHealthLoss, 0));
    const manaLoss = Math.max(0, numberValue(entry.heroMalusManaLoss, 0));
    if (!healthLoss && !manaLoss) return;
    maluses.push({
      id: `${entry.id || sourceLabel}-${index}-malus`,
      sourceLabel,
      index,
      healthLoss,
      manaLoss,
      message: entry.heroMalusMessage || '',
    });
  };
  const pushGenericRewards = (entry, sourceLabel, index) => {
    pushReward(entry.rewardItemId, sourceLabel, index, 'Objet donné');
    pushReward(entry.secondRewardItemId, sourceLabel, index, 'Second’objet');
    asList(entry.logicRules).forEach((rule, ruleIndex) => {
      pushReward(rule.rewardItemId, `${sourceLabel} / Règle ${rule.name || ruleIndex + 1}`, index, 'Récompense conditionnelle');
    });
    asList(entry.effects).forEach((effect, effectIndex) => {
      if ((effect.type || '') === 'add_item') {
        pushReward(effect.itemId, `${sourceLabel} / Effet ${effectIndex + 1}`, index, 'Effet objet');
      }
    });
  };
  const pushSkillCheck = (entry, sourceLabel, index) => {
    const skill = getSkill(entry.skillCheckSkillId);
    const difficulty = Math.max(1, numberValue(entry.skillCheckDifficulty, 12));
    const manaCost = Math.max(0, numberValue(entry.skillCheckManaCost, 0));
    const failureHealthLoss = Math.max(0, numberValue(entry.skillCheckFailureHealthLoss, 0));
    const successProbability = getRollSuccessProbability(diceSides, skill?.value || 0, difficulty, heroAdventure.rules);
    const expectedDamage = (1 - successProbability) * failureHealthLoss;
    const rating = getProbabilityRating(successProbability);
    const check = {
      id: `${entry.id || sourceLabel}-${index}-check`,
      sourceLabel,
      index,
      skillId: skill?.id || '',
      skillName: skill?.name || 'Compétence',
      skillBonus: numberValue(skill?.value, 0),
      difficulty,
      manaCost,
      failureHealthLoss,
      successProbability,
      expectedDamage,
      rating,
      rewardItemId: entry.skillCheckSuccessRewardItemId || '',
    };
    checks.push(check);
    pushReward(entry.skillCheckSuccessRewardItemId, sourceLabel, index, 'Récompense de test');
  };
  const pushCombat = (entry, sourceLabel, index) => {
    const skill = getSkill(entry.combatSkillId);
    const combatSettings = heroAdventure.combat || DEFAULT_HERO_ADVENTURE.combat;
    const stats = getCombatSimulationStats(balanceProject, entry, combatSettings);
    const estimate = estimateCombatBalance(balanceProject, entry, combatSettings, {
      iterations: combatIterations,
      maxRounds: combatMaxRounds,
      seed: `${entry.id || sourceLabel}-${index}`,
    });
    const enemyName = stats.enemyName;
    const enemyHealth = stats.enemyHealth;
    const difficulty = stats.difficulty;
    const manaCost = stats.combatManaCost;
    const hitProbability = getRollSuccessProbability(stats.diceSides, stats.skillBonus, stats.difficulty, balanceProject.heroAdventure.rules);
    const winProbability = Math.max(0, Math.min(1, numberValue(estimate.winChance, 0) / 100));
    const survivalProbability = Math.max(0, Math.min(1, numberValue(estimate.survivalChance, 0) / 100));
    const blockedProbability = Math.max(0, Math.min(1, numberValue(estimate.blockedCount, 0) / Math.max(1, estimate.iterations || combatIterations)));
    const timeoutProbability = Math.max(0, Math.min(1, numberValue(estimate.timeoutCount, 0) / Math.max(1, estimate.iterations || combatIterations)));
    const defeatProbability = Math.max(0, Math.min(1, numberValue(estimate.defeatCount, 0) / Math.max(1, estimate.iterations || combatIterations)));
    const expectedAttempts = numberValue(estimate.averageRounds, 0);
    const expectedDamage = numberValue(estimate.averageEnemyDamage, 0);
    const expectedMana = numberValue(estimate.averageHeroManaSpent, 0);
    const heroDamage = numberValue(estimate.averageHeroDamagePerRound, Math.max(0, stats.heroForce));
    const enemyDamage = numberValue(estimate.averageEnemyDamagePerRound, Math.max(0, stats.enemyStats?.strength || 0));
    const hitsNeeded = heroDamage > 0 ? Math.max(1, Math.ceil(enemyHealth / heroDamage)) : Infinity;
    const minManaBlocked = blockedProbability >= 0.5 || (manaCost > 0 && stats.heroMana < manaCost);
    const rating = getCombatRating(winProbability, expectedDamage, stats.heroHealth, hitProbability, minManaBlocked, survivalProbability);
    const enemyResistance = stats.enemyStats?.resistances?.[stats.heroAttackType] || 0;
    const mitigationDetails = [
      stats.heroDieDamagePercent > 0 ? `dé +${stats.heroDieDamagePercent}% dégâts` : null,
      stats.enemyStats?.armor > 0 ? `armure ${stats.enemyStats.armor}` : null,
      enemyResistance > 0 ? `résistance ${stats.heroAttackType} ${enemyResistance}%` : null,
      stats.enemyStats?.dodgeChance > 0 ? `esquive ${stats.enemyStats.dodgeChance}%` : null,
      stats.heroCriticalChance > 0 ? `critique ${stats.heroCriticalChance}%` : null,
      stats.enemyStats?.powerUsageChance > 0 && stats.enemyStats?.powerDamage > 0 ? `pouvoir ennemi ${stats.enemyStats.powerDamage} dégâts (${stats.enemyStats.powerUsageChance}%)` : null,
      asList(stats.heroPowers).some((power) => power.statusType) ? 'statuts héros simulés' : null,
    ].filter(Boolean);
    const combat = {
      id: `${entry.id || sourceLabel}-${index}-combat`,
      sourceLabel,
      index,
      enemyName,
      skillId: skill?.id || '',
      skillName: stats.skillName || skill?.name || 'Compétence',
      skillBonus: stats.skillBonus,
      forceDamage: stats.heroForce,
      powerDamage: Math.max(0, ...asList(stats.heroPowers).map((power) => numberValue(power.force, 0))),
      difficulty,
      enemyHealth,
      heroDamage,
      enemyDamage,
      manaCost,
      hitsNeeded,
      hitProbability,
      winProbability,
      survivalProbability,
      defeatProbability,
      blockedProbability,
      timeoutProbability,
      expectedAttempts,
      expectedDamage,
      expectedMana,
      averageHeroHealthRemaining: numberValue(estimate.averageHeroHealthRemaining, 0),
      averageHeroManaRemaining: numberValue(estimate.averageHeroManaRemaining, 0),
      engineEstimate: estimate,
      mitigationDetails,
      rating,
      rewardItemId: entry.combatRewardItemId || '',
    };
    combats.push(combat);
    pushReward(entry.combatRewardItemId, sourceLabel, index, 'Butin de combat');
  };

  asList(project.scenes).forEach((scene, sceneIndex) => {
    asList(scene.hotspots).forEach((hotspot, hotspotIndex) => {
      const index = sequence;
      sequence += 1;
      const sourceLabel = getSourceLabel({ scene, sceneIndex, hotspot, hotspotIndex });
      const actionType = hotspot.actionType || '';
      if (actionType === 'skill_check') pushSkillCheck(hotspot, sourceLabel, index);
      if (actionType === 'hero_combat') pushCombat(hotspot, sourceLabel, index);
      pushMalus(hotspot, sourceLabel, index);
      pushGenericRewards(hotspot, sourceLabel, index);

      asList(hotspot.conversation?.nodes).forEach((node, nodeIndex) => {
        asList(node.replies).forEach((reply, replyIndex) => {
          const replyIndexInStory = sequence;
          sequence += 1;
          const replySource = getSourceLabel({ scene, sceneIndex, hotspot, hotspotIndex, node, nodeIndex, reply, replyIndex });
          const replyActionType = reply.actionType || 'node';
          if (replyActionType === 'skill_check') pushSkillCheck(reply, replySource, replyIndexInStory);
          if (replyActionType === 'hero_combat') pushCombat(reply, replySource, replyIndexInStory);
          pushMalus(reply, replySource, replyIndexInStory);
          pushGenericRewards(reply, replySource, replyIndexInStory);
        });
      });
    });
  });

  asList(project.cinematics).forEach((cinematic, cinematicIndex) => {
    if (!cinematic.rewardItemId) return;
    const index = sequence + cinematicIndex;
    pushReward(cinematic.rewardItemId, `Cinématique / ${cinematic.name || `Cinématique ${cinematicIndex + 1}`}`, index, 'Récompense cinématique');
  });

  const skillPressure = [
    ...checks.map((check) => ({ index: check.index, skillId: check.skillId, label: check.sourceLabel })),
    ...combats.map((combat) => ({ index: combat.index, skillId: combat.skillId, label: combat.sourceLabel })),
  ];
  const healthPressure = [
    ...checks.filter((check) => check.failureHealthLoss > 0).map((check) => ({ index: check.index, amount: check.expectedDamage })),
    ...combats.filter((combat) => combat.enemyDamage > 0).map((combat) => ({ index: combat.index, amount: combat.expectedDamage })),
    ...maluses.filter((malus) => malus.healthLoss > 0).map((malus) => ({ index: malus.index, amount: malus.healthLoss })),
  ];
  const manaPressure = [
    ...checks.filter((check) => check.manaCost > 0).map((check) => ({ index: check.index, amount: check.manaCost })),
    ...combats.filter((combat) => combat.manaCost > 0).map((combat) => ({ index: combat.index, amount: combat.expectedMana })),
    ...maluses.filter((malus) => malus.manaLoss > 0).map((malus) => ({ index: malus.index, amount: malus.manaLoss })),
  ];

  const rewardsByItem = rewards.reduce((map, reward) => {
    if (!reward.itemId) return map;
    if (!map.has(reward.itemId)) map.set(reward.itemId, []);
    map.get(reward.itemId).push(reward);
    return map;
  }, new Map());

  const rewardAnalyses = Array.from(rewardsByItem.entries()).map(([itemId, sources]) => {
    const item = getItem(itemId);
    const firstIndex = Math.min(...sources.map((source) => source.index));
    const itemType = item?.heroItemType || 'none';
    const base = {
      itemId,
      item,
      itemName: item?.name || 'Objet introuvable',
      typeLabel: getHeroItemLabel(item, skills),
      sources,
      status: 'neutral',
      statusLabel: 'Narratif',
      reason: "Pas d'effet Héros configuré.",
    };
    if (!item) {
      return { ...base, status: 'missing', statusLabel: 'Introuvable', reason: 'La récompense pointe vers un objet absent.' };
    }
    if (itemType === 'health_potion') {
      const laterPressure = sumNumbers(healthPressure.filter((entry) => entry.index >= firstIndex).map((entry) => entry.amount));
      if (laterPressure <= 0) {
        return { ...base, status: 'weak', statusLabel: 'Peu utile', reason: 'Aucune perte de PV détectée après cette récompense.' };
      }
      return {
        ...base,
        status: 'useful',
        statusLabel: 'Utile',
        reason: `Couvre ${Math.max(1, numberValue(item.heroItemAmount, 4))} PV pour ${formatDecimal(laterPressure)} PV de pression restante.`,
      };
    }
    if (itemType === 'mana_potion') {
      const laterPressure = sumNumbers(manaPressure.filter((entry) => entry.index >= firstIndex).map((entry) => entry.amount));
      if (laterPressure <= 0) {
        return { ...base, status: 'weak', statusLabel: 'Peu utile', reason: 'Aucune dépense de mana détectée après cette récompense.' };
      }
      return {
        ...base,
        status: 'useful',
        statusLabel: 'Utile',
        reason: `Rend ${Math.max(1, numberValue(item.heroItemAmount, 3))} mana pour ${formatDecimal(laterPressure)} mana de pression restante.`,
      };
    }
    if (itemType === 'equipment') {
      const target = item.heroItemBonusTarget || 'skill';
      if (target === 'skill') {
        const skillId = item.heroItemSkillId || fallbackSkill.id;
        const laterUses = skillPressure.filter((entry) => entry.skillId === skillId && entry.index >= firstIndex);
        const earlierUses = skillPressure.filter((entry) => entry.skillId === skillId && entry.index < firstIndex);
        if (!laterUses.length) {
          return {
            ...base,
            status: 'weak',
            statusLabel: earlierUses.length ? 'Trop tard' : 'Sans usage',
            reason: earlierUses.length ? 'Cette compétence sert avant obtention, mais plus après.' : 'Aucun test ou combat ne dépend de cette compétence.',
          };
        }
        return {
          ...base,
          status: 'useful',
          statusLabel: 'Utile',
          reason: `${laterUses.length} test(s) ou combat(s) utilisent cette compétence après obtention.`,
        };
      }
      if (target === 'maxHealth') {
        const laterPressure = sumNumbers(healthPressure.filter((entry) => entry.index >= firstIndex).map((entry) => entry.amount));
        return laterPressure > 0
          ? { ...base, status: 'useful', statusLabel: 'Utile', reason: `Protège contre ${formatDecimal(laterPressure)} PV de pression restante.` }
          : { ...base, status: 'weak', statusLabel: 'Peu utile', reason: 'Aucune menace PV détectée après obtention.' };
      }
      if (target === 'maxMana') {
        const laterPressure = sumNumbers(manaPressure.filter((entry) => entry.index >= firstIndex).map((entry) => entry.amount));
        return laterPressure > 0
          ? { ...base, status: 'useful', statusLabel: 'Utile', reason: `Soutient ${formatDecimal(laterPressure)} mana de pression restante.` }
          : { ...base, status: 'weak', statusLabel: 'Peu utile', reason: 'Aucune dépense de mana détectée après obtention.' };
      }
    }
    return base;
  });

  const rewardedItemIds = new Set(rewards.map((reward) => reward.itemId).filter(Boolean));
  const unusedHeroItems = items.filter((item) => (item.heroItemType || 'none') !== 'none' && !rewardedItemIds.has(item.id));
  const uniqueRewardedItems = Array.from(rewardsByItem.keys()).map((itemId) => getItem(itemId)).filter(Boolean);
  const healthRestores = sumNumbers(uniqueRewardedItems
    .filter((item) => item.heroItemType === 'health_potion')
    .map((item) => Math.max(1, numberValue(item.heroItemAmount, 4))));
  const manaRestores = sumNumbers(uniqueRewardedItems
    .filter((item) => item.heroItemType === 'mana_potion')
    .map((item) => Math.max(1, numberValue(item.heroItemAmount, 3))));
  const maxHealthBonus = sumNumbers(uniqueRewardedItems
    .filter((item) => item.heroItemType === 'equipment' && (item.heroItemBonusTarget || 'skill') === 'maxHealth')
    .map((item) => Math.max(0, numberValue(item.heroItemBonus, 1))));
  const maxManaBonus = sumNumbers(uniqueRewardedItems
    .filter((item) => item.heroItemType === 'equipment' && (item.heroItemBonusTarget || 'skill') === 'maxMana')
    .map((item) => Math.max(0, numberValue(item.heroItemBonus, 1))));
  const expectedHealthLoss = sumNumbers([
    ...checks.map((check) => check.expectedDamage),
    ...combats.map((combat) => combat.expectedDamage),
    ...maluses.map((malus) => malus.healthLoss),
  ]);
  const expectedManaCost = sumNumbers([
    ...checks.map((check) => check.manaCost),
    ...combats.map((combat) => combat.expectedMana),
    ...maluses.map((malus) => malus.manaLoss),
  ]);
  const healthBudget = Math.max(0, numberValue(hero.health, hero.maxHealth || 0)) + healthRestores + maxHealthBonus;
  const manaBudget = Math.max(0, numberValue(hero.mana, hero.maxMana || 0)) + manaRestores + maxManaBonus;
  const healthRatio = healthBudget > 0 ? expectedHealthLoss / healthBudget : Infinity;
  const manaRatio = manaBudget > 0 ? expectedManaCost / manaBudget : (expectedManaCost > 0 ? Infinity : 0);

  const skillSummaries = skills.map((skill) => {
    const skillChecks = checks.filter((check) => check.skillId === skill.id);
    const skillCombats = combats.filter((combat) => combat.skillId === skill.id);
    const averageCheckSuccess = averageNumbers(skillChecks.map((check) => check.successProbability));
    const averageHit = averageNumbers(skillCombats.map((combat) => combat.hitProbability));
    const averageWin = averageNumbers(skillCombats.map((combat) => combat.winProbability));
    const useCount = skillChecks.length + skillCombats.length;
    return {
      skill,
      useCount,
      averageCheckSuccess,
      averageHit,
      averageWin,
      rating: getProbabilityRating(averageNumbers([
        ...(Number.isFinite(averageCheckSuccess) ? [averageCheckSuccess] : []),
        ...(Number.isFinite(averageWin) ? [averageWin] : []),
      ]) ?? 0.75),
    };
  });

  const alerts = [];
  const pushAlert = (severity, title, detail, sourceLabel = '') => {
    alerts.push({ id: `${severity}-${alerts.length}`, severity, title, detail, sourceLabel });
  };

  checks.forEach((check) => {
    if (check.successProbability <= 0) pushAlert('danger', 'Test impossible', `${check.skillName} ${formatSignedNumber(check.skillBonus)} contre difficulté ${check.difficulty}.`, check.sourceLabel);
    else if (check.successProbability < 0.35) pushAlert('warning', 'Test très dur', `${formatPercent(check.successProbability)} de réussite; risque de blocage si l'échec n'ouvre rien.`, check.sourceLabel);
    else if (check.successProbability > 0.95) pushAlert('info', 'Test automatique', `${formatPercent(check.successProbability)} de réussite; la difficulté ne met presque aucune tension.`, check.sourceLabel);
    if (check.manaCost > numberValue(hero.maxMana, 0)) pushAlert('danger', 'Coût mana impossible', `${check.manaCost} mana demandée pour ${numberValue(hero.maxMana, 0)} mana max.`, check.sourceLabel);
  });

  combats.forEach((combat) => {
    if (['impossible', 'punitive'].includes(combat.rating.key)) {
      pushAlert('danger', 'Combat trop punitif', `${combat.enemyName}: ${formatPercent(combat.winProbability)} de victoire, ${formatPercent(combat.survivalProbability)} de survie, ${formatDecimal(combat.expectedDamage)} PV attendus.`, combat.sourceLabel);
    } else if (combat.rating.key === 'easy') {
      pushAlert('info', 'Combat très facile', `${combat.enemyName}: ${formatPercent(combat.winProbability)} de victoire et peu de pression PV.`, combat.sourceLabel);
    }
    if (combat.blockedProbability >= 0.25) {
      pushAlert('danger', 'Combat bloqué par mana', `${combat.enemyName}: ${formatPercent(combat.blockedProbability)} des simulations se bloquent faute de mana.`, combat.sourceLabel);
    }
    if (combat.timeoutProbability >= 0.25) {
      pushAlert('warning', 'Combat très long', `${combat.enemyName}: ${formatPercent(combat.timeoutProbability)} des simulations dépassent la limite de tours.`, combat.sourceLabel);
    }
  });

  rewardAnalyses.forEach((reward) => {
    if (reward.status === 'weak') pushAlert('warning', 'Récompense peu utile', `${reward.itemName}: ${reward.reason}`, reward.sources[0]?.sourceLabel || '');
    if (reward.status === 'missing') pushAlert('danger', 'Récompense introuvable', `${reward.itemName}: ${reward.reason}`, reward.sources[0]?.sourceLabel || '');
  });
  unusedHeroItems.forEach((item) => {
    pushAlert('info', 'Objet Hero jamais donné', `${item.name || 'Objet'} a un effet Hero mais aucune récompense détectée.`);
  });
  if (healthRatio > 1) pushAlert('danger', 'Progression PV trop punitive', `${formatDecimal(expectedHealthLoss)} PV attendus pour ${formatDecimal(healthBudget)} PV disponibles avec soins détectés.`);
  else if (healthRatio > 0.7) pushAlert('warning', 'Progression PV tendue', `${formatDecimal(expectedHealthLoss)} PV attendus pour ${formatDecimal(healthBudget)} PV disponibles.`);
  if (manaRatio > 1) pushAlert('danger', 'Progression mana insuffisante', `${formatDecimal(expectedManaCost)} mana attendue pour ${formatDecimal(manaBudget)} mana disponible avec potions détectées.`);
  else if (manaRatio > 0.75) pushAlert('warning', 'Progression mana tendue', `${formatDecimal(expectedManaCost)} mana attendue pour ${formatDecimal(manaBudget)} mana disponible.`);

  return {
    diceLabel: heroAdventure.dice?.label || `d${diceSides}`,
    hero,
    skills: skillSummaries,
    checks,
    combats,
    maluses,
    rewards: rewardAnalyses,
    unusedHeroItems,
    alerts,
    progression: {
      expectedHealthLoss,
      expectedManaCost,
      healthRestores,
      manaRestores,
      maxHealthBonus,
      maxManaBonus,
      healthBudget,
      manaBudget,
      healthRatio,
      manaRatio,
      healthMeter: Number.isFinite(healthRatio) ? Math.min(100, Math.round(healthRatio * 100)) : 100,
      manaMeter: Number.isFinite(manaRatio) ? Math.min(100, Math.round(manaRatio * 100)) : 100,
    },
    summary: {
      averageCombatWin: averageNumbers(combats.map((combat) => combat.winProbability)),
      averageCheckSuccess: averageNumbers(checks.map((check) => check.successProbability)),
      hardCombats: combats.filter((combat) => ['impossible', 'punitive', 'hard'].includes(combat.rating.key)).length,
      easyCombats: combats.filter((combat) => combat.rating.key === 'easy').length,
      weakRewards: rewardAnalyses.filter((reward) => reward.status === 'weak').length,
    },
  };
};

export default function HeroTab({ project, patchProject, onPreviewHeroCharacter, setTab }) {
  const heroAdventure = useMemo(() => normalizeHeroAdventure(project), [project]);
  const [activeHeroTab, setActiveHeroTab] = useState('sheet');
  const hero = heroAdventure.hero;
  const rules = heroAdventure.rules || DEFAULT_HERO_ADVENTURE.rules;
  const heroRoster = Array.isArray(heroAdventure.heroes) && heroAdventure.heroes.length
    ? heroAdventure.heroes
    : [hero];
  const playerButtonStyle = BUTTON_STYLE_IDS.has(project?.ui?.buttonStyle)
    ? project.ui.buttonStyle
    : 'modern';
  const playerButtonFont = FONT_STYLE_IDS.has(project?.ui?.buttonFont)
    ? project.ui.buttonFont
    : 'system';
  const playerNarrationFont = FONT_STYLE_IDS.has(project?.ui?.narrationFont)
    ? project.ui.narrationFont
    : 'system';
  const playerNarrationBackground = project?.ui?.narrationBackground || NARRATION_BACKGROUND_PRESETS[0].value;
  const heroBalance = useMemo(() => buildHeroBalanceReport(project, heroAdventure), [project, heroAdventure]);

  const updateHeroAdventure = (updater) => {
    patchProject((draft) => {
      const next = normalizeHeroAdventure(draft);
      updater(next);
      const activeHeroId = next.selectedHeroId || next.hero?.id || 'hero_1';
      next.hero = { ...(next.hero || DEFAULT_HERO_ADVENTURE.hero), id: activeHeroId, rules: next.rules };
      next.heroes = (Array.isArray(next.heroes) && next.heroes.length ? next.heroes : [next.hero]).map((entry) => (
        entry.id === activeHeroId ? { ...next.hero, rules: next.rules } : entry
      ));
      next.selectedHeroId = activeHeroId;
      draft.heroAdventure = next;
      if (next.enabled) draft.creationMode = 'hero_adventure';
    });
  };

  const selectHeroSheet = (heroId) => updateHeroAdventure((draft) => {
    const selected = (draft.heroes || []).find((entry) => entry.id === heroId);
    if (!selected) return;
    draft.selectedHeroId = selected.id;
    draft.hero = { ...selected };
    draft.rules = normalizeHeroRules(selected.rules || draft.rules, draft.dice.sides);
  });

  const addHeroSheet = () => updateHeroAdventure((draft) => {
    const index = (draft.heroes || []).length + 1;
    const nextHero = normalizeHeroSheet(
      {
        ...DEFAULT_HERO_ADVENTURE.hero,
        id: createHeroSheetId(),
        name: `Nouveau heros ${index}`,
        rules: draft.rules,
      },
      index,
      draft.dice.sides,
      draft.rules,
    );
    draft.heroes = [...(draft.heroes || []), nextHero];
    draft.selectedHeroId = nextHero.id;
    draft.hero = { ...nextHero };
    draft.rules = nextHero.rules;
  });

  const duplicateHeroSheet = () => updateHeroAdventure((draft) => {
    const index = (draft.heroes || []).length + 1;
    const nextHero = normalizeHeroSheet(
      {
        ...draft.hero,
        id: createHeroSheetId(),
        name: `${draft.hero.name || 'Heros'} ${index}`,
        rules: draft.rules,
      },
      index,
      draft.dice.sides,
      draft.rules,
    );
    draft.heroes = [...(draft.heroes || []), nextHero];
    draft.selectedHeroId = nextHero.id;
    draft.hero = { ...nextHero };
    draft.rules = nextHero.rules;
  });

  const removeHeroSheet = (heroId) => updateHeroAdventure((draft) => {
    if ((draft.heroes || []).length <= 1) return;
    const nextHeroes = (draft.heroes || []).filter((entry) => entry.id !== heroId);
    const nextHero = nextHeroes[0];
    draft.heroes = nextHeroes;
    draft.selectedHeroId = nextHero.id;
    draft.hero = { ...nextHero };
    draft.rules = normalizeHeroRules(nextHero.rules || draft.rules, draft.dice.sides);
  });

  const updateHero = (changes) => updateHeroAdventure((draft) => {
    const previousHealth = Number(draft.hero.health) || 0;
    const previousMaxHealth = Math.max(1, Number(draft.hero.maxHealth) || 1);
    const previousMana = Number(draft.hero.mana) || 0;
    const previousMaxMana = Math.max(0, Number(draft.hero.maxMana) || 0);
    draft.hero = { ...draft.hero, ...changes };
    if ('maxHealth' in changes) {
      draft.hero.health = previousHealth >= previousMaxHealth
        ? draft.hero.maxHealth
        : Math.min(draft.hero.health, draft.hero.maxHealth);
    }
    if ('maxMana' in changes) {
      draft.hero.mana = previousMana >= previousMaxMana
        ? draft.hero.maxMana
        : Math.min(draft.hero.mana, draft.hero.maxMana);
    }
  });

  const updateEquipmentSlotLabel = (index, value) => updateHeroAdventure((draft) => {
    draft.hero.equipmentSlotLabels = DEFAULT_EQUIPMENT_SLOT_LABELS.map((label, slotIndex) => (
      slotIndex === index ? value : (draft.hero.equipmentSlotLabels?.[slotIndex] ?? label)
    ));
  });

  const updateSkill = (skillId, changes) => updateHeroAdventure((draft) => {
    draft.hero.skills = draft.hero.skills.map((skill) => (
      skill.id === skillId
        ? {
            ...skill,
            ...changes,
            id: changes.name ? normalizeSkillId(changes.name) : skill.id,
          }
        : skill
    ));
  });

  const updatePower = (powerId, changes) => updateHeroAdventure((draft) => {
    draft.hero.powers = (draft.hero.powers || []).map((power) => (
      power.id === powerId
        ? {
            ...power,
            ...changes,
            id: changes.name ? normalizeSkillId(changes.name) : power.id,
            type: HERO_POWER_TYPE_IDS.has(changes.type) ? changes.type : (HERO_POWER_TYPE_IDS.has(power.type) ? power.type : 'fire'),
          }
        : power
    ));
  });

  const addPower = () => updateHeroAdventure((draft) => {
    const index = (draft.hero.powers || []).length + 1;
    draft.hero.powers = [
      ...(draft.hero.powers || []),
      {
        id: `pouvoir_${Date.now()}`,
        name: `Pouvoir ${index}`,
        type: 'fire',
        manaCost: 2,
        force: 4,
        healHealth: 0,
        healMana: 0,
        statusType: '',
        statusAmount: 0,
        statusDuration: 1,
      },
    ];
  });

  const removePower = (powerId) => updateHeroAdventure((draft) => {
    draft.hero.powers = (draft.hero.powers || []).filter((power) => power.id !== powerId);
  });

  const rollHeroSkills = () => updateHeroAdventure((draft) => {
    draft.hero.skills = draft.hero.skills.map((skill) => {
      const rawRoll = rollDie(6);
      const previousRoll = Number(skill.rolledValue) || 0;
      const baseValue = Number.isFinite(Number(skill.baseValue))
        ? Number(skill.baseValue)
        : (Number(skill.value) || 0) - previousRoll;
      return {
        ...skill,
        baseValue,
        value: baseValue + rawRoll,
        rolledValue: rawRoll,
        rollFormula: `${baseValue} + 1d6`,
      };
    });
  });

  const setDiceSides = (sides) => updateHeroAdventure((draft) => {
    draft.dice.sides = sides;
    draft.dice.label = `d${sides}`;
    draft.rules.criticalSuccess = Math.min(clampNumber(draft.rules.criticalSuccess, sides, 1, sides), sides);
    draft.rules.criticalFailure = Math.min(clampNumber(draft.rules.criticalFailure, 1, 1, sides), sides);
  });

  const setDiceSkin = (skinId) => updateHeroAdventure((draft) => {
    draft.dice.skin = HERO_DICE_SKIN_IDS.has(skinId) ? skinId : DEFAULT_HERO_ADVENTURE.dice.skin;
  });

  const setButtonStyle = (styleId) => {
    patchProject((draft) => {
      draft.ui = {
        ...(draft.ui && typeof draft.ui === 'object' ? draft.ui : {}),
        buttonStyle: BUTTON_STYLE_IDS.has(styleId) ? styleId : 'modern',
      };
    });
  };

  const updateUiStyle = (changes) => {
    patchProject((draft) => {
      draft.ui = {
        ...(draft.ui && typeof draft.ui === 'object' ? draft.ui : {}),
        ...changes,
      };
    });
  };

  const readImageFile = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const readAudioFile = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result || ''), file.name || 'Musique intro');
    reader.readAsDataURL(file);
  };

  const previewHeroPage = () => {
    if (onPreviewHeroCharacter) {
      onPreviewHeroCharacter();
      return;
    }
    if (setTab) setTab('preview');
  };

  const healthProgressionClass = heroBalance.progression.healthRatio > 1
    ? 'danger'
    : heroBalance.progression.healthRatio > 0.7
      ? 'warning'
      : 'safe';
  const manaProgressionClass = heroBalance.progression.manaRatio > 1
    ? 'danger'
    : heroBalance.progression.manaRatio > 0.75
      ? 'warning'
      : 'safe';

  return (
    <div className="layout two-cols-wide hero-editor-layout">
      <section className="panel side hero-editor-summary" data-tour="hero-summary-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <h2>Héros</h2>
            <p>Règles de base pour un mode livre-aventure avec dé, jauges et compétences.</p>
          </div>
        </div>

        <div className="hero-stat-preview">
          <strong>{hero.name}</strong>
          <span>{heroAdventure.dice.label} principal</span>
          <div className="hero-preview-meter">
            <Heart size={16} aria-hidden="true" />
            <span>{hero.health}/{hero.maxHealth} PV</span>
          </div>
          <div className="hero-preview-meter">
            <Sparkles size={16} aria-hidden="true" />
            <span>{hero.mana}/{hero.maxMana} Mana</span>
          </div>
        </div>

        <label className="checkbox-row" data-tour="hero-enable-toggle">
          <input
            type="checkbox"
            checked={Boolean(heroAdventure.enabled)}
            onChange={(event) => updateHeroAdventure((draft) => {
              draft.enabled = event.target.checked;
            })}
          />
          <span>Activer Hero aventure</span>
          <span className="help-dot" data-help={FIELD_HELP.enabled} aria-label={FIELD_HELP.enabled} tabIndex={0}>?</span>
        </label>

        <div className="subpanel">
          <div className="subpanel-head">
            <h3>Mode Hero actif</h3>
          </div>
          <p>
            La fiche personnage utilise tes PV, mana, compétences, images et emplacements portés.
            En Preview, les tests de compétence, objets, équipements, combats et malus utilisent ces réglages.
          </p>
        </div>
      </section>

      <section className="panel main hero-editor-main" data-tour="hero-editor-panel">
        <div className="panel-head">
          <h2>Configuration Hero aventure</h2>
        </div>

        <div className="hero-internal-tabs" role="tablist" aria-label="Sections de configuration du héros" data-tour="hero-internal-tabs">
          {HERO_INTERNAL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeHeroTab === tab.id}
              className={activeHeroTab === tab.id ? 'active' : ''}
              data-tour={`hero-tab-${tab.id}`}
              onClick={() => setActiveHeroTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="subpanel hero-roster-panel">
          <div className="subpanel-head">
            <div>
              <h3>Personnages jouables</h3>
              <p>Chaque fiche garde ses PV, mana, competences, pouvoirs, resistances et critiques. Le joueur choisira son personnage au debut de la Preview.</p>
            </div>
            <div className="toolbar">
              <button type="button" className="secondary-action" onClick={duplicateHeroSheet}>
                Dupliquer
              </button>
              <button type="button" onClick={addHeroSheet}>
                <Plus size={16} aria-hidden="true" />
                Ajouter une fiche
              </button>
            </div>
          </div>
          <div className="hero-roster-grid">
            {heroRoster.map((sheet) => {
              const isActive = sheet.id === heroAdventure.selectedHeroId;
              const forceSkill = (sheet.skills || []).find((skill) => normalizeSkillId(skill.name || skill.id).includes('force')) || sheet.skills?.[0];
              return (
                <button
                  key={sheet.id}
                  type="button"
                  className={`hero-roster-card ${isActive ? 'active' : ''}`}
                  onClick={() => selectHeroSheet(sheet.id)}
                  aria-pressed={isActive}
                >
                  <strong>{sheet.name || 'Heros'}</strong>
                  {sheet.description ? <p className="hero-roster-description">{sheet.description}</p> : null}
                  <span>{sheet.health}/{sheet.maxHealth} PV - {sheet.mana}/{sheet.maxMana} Mana</span>
                  <small>Force {forceSkill?.value ?? 0} - Crit {sheet.rules?.criticalChance ?? 0}%</small>
                  {heroRoster.length > 1 ? (
                    <em
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeHeroSheet(sheet.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          removeHeroSheet(sheet.id);
                        }
                      }}
                    >
                      Supprimer
                    </em>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="subpanel-grid">
          {activeHeroTab === 'preview' ? <HeroCharacterSheetPreview hero={hero} heroAdventure={heroAdventure} onOpenPlayerPreview={previewHeroPage} /> : null}
          {activeHeroTab === 'sheet' ? (
          <div className="subpanel" data-tour="hero-sheet-panel">
            <div className="subpanel-head">
              <h3>Fiche du héros</h3>
              <button type="button" className="secondary-action compact" data-tour="hero-preview-button" onClick={previewHeroPage}>
                <Eye size={16} aria-hidden="true" />
                Apercu
              </button>
            </div>
            <div className="grid-two">
              <div>
                <HelpLabel help={FIELD_HELP.heroName}>Nom du héros</HelpLabel>
                <input
                  value={hero.name}
                  onChange={(event) => updateHero({ name: event.target.value })}
                  placeholder="Aventurier"
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.dice}>Dé principal</HelpLabel>
                <select
                  value={heroAdventure.dice.sides}
                  onChange={(event) => setDiceSides(Number(event.target.value))}
                >
                  {DICE_PRESETS.map((sides) => (
                    <option key={sides} value={sides}>d{sides}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hero-description-field">
              <HelpLabel help={FIELD_HELP.heroDescription}>Descriptif de choix</HelpLabel>
              <textarea
                value={hero.description || ''}
                onChange={(event) => updateHero({ description: event.target.value })}
                placeholder="Ex. Rapide et rusée, elle trouve les passages cachés mais encaisse mal les coups."
                rows={3}
              />
            </div>

            <div className="grid-two hero-gauge-grid">
              <div>
                <HelpLabel help={FIELD_HELP.health}>PV de départ</HelpLabel>
                <input
                  type="number"
                  min="0"
                  max={hero.maxHealth}
                  value={hero.health}
                  onChange={(event) => updateHero({ health: clampNumber(event.target.value, hero.health, 0, hero.maxHealth) })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.health}>PV maximum</HelpLabel>
                <input
                  type="number"
                  min="1"
                  value={hero.maxHealth}
                  onChange={(event) => updateHero({ maxHealth: clampNumber(event.target.value, hero.maxHealth, 1, 999) })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.mana}>Mana de départ</HelpLabel>
                <input
                  type="number"
                  min="0"
                  max={hero.maxMana}
                  value={hero.mana}
                  onChange={(event) => updateHero({ mana: clampNumber(event.target.value, hero.mana, 0, hero.maxMana) })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.mana}>Mana maximum</HelpLabel>
                <input
                  type="number"
                  min="0"
                  value={hero.maxMana}
                  onChange={(event) => updateHero({ maxMana: clampNumber(event.target.value, hero.maxMana, 0, 999) })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.armor}>Armure</HelpLabel>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={hero.armor || 0}
                  onChange={(event) => updateHero({ armor: clampNumber(event.target.value, hero.armor || 0, 0, 999) })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.initiative}>Initiative</HelpLabel>
                <input
                  type="number"
                  min="-999"
                  max="999"
                  value={hero.initiative || 0}
                  onChange={(event) => updateHero({ initiative: clampNumber(event.target.value, hero.initiative || 0, -999, 999) })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.dodgeChance}>Esquive (%)</HelpLabel>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={hero.dodgeChance || 0}
                  onChange={(event) => updateHero({ dodgeChance: clampNumber(event.target.value, hero.dodgeChance || 0, 0, 100) })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.criticalChance}>Critique (%)</HelpLabel>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rules.criticalChance}
                  onChange={(event) => updateHeroAdventure((draft) => {
                    draft.rules.criticalChance = clampNumber(event.target.value, rules.criticalChance, 0, 100);
                  })}
                />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.criticalMultiplier}>Multiplicateur critique</HelpLabel>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={rules.criticalMultiplier}
                  onChange={(event) => updateHeroAdventure((draft) => {
                    draft.rules.criticalMultiplier = clampNumber(event.target.value, rules.criticalMultiplier, 1, 20);
                  })}
                />
              </div>
            </div>

            <div className="subpanel compact-subpanel">
              <HelpLabel help={FIELD_HELP.defeatScene}>Scène de défaite à 0 PV</HelpLabel>
              <select
                value={hero.defeatSceneId || ''}
                onChange={(event) => updateHero({ defeatSceneId: event.target.value })}
              >
                <option value="">Fenêtre Défaite standard</option>
                {(project.scenes || []).map((scene) => (
                  <option key={scene.id} value={scene.id}>{scene.name || `Scène ${scene.id}`}</option>
                ))}
              </select>
            </div>

            <div className="grid-two hero-character-image-grid">
              <div>
                <HelpLabel help={FIELD_HELP.characterBackground}>Fond page personnage</HelpLabel>
                <label className="button like secondary-action full">
                  Choisir un fond
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => readImageFile(event.target.files?.[0], (imageData) => updateHero({ backgroundImageData: imageData }))}
                  />
                </label>
                {hero.backgroundImageData ? (
                  <button type="button" className="secondary-action full" onClick={() => updateHero({ backgroundImageData: '' })}>Retirer le fond</button>
                ) : null}
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.characterImage}>Image personnage</HelpLabel>
                <label className="button like secondary-action full">
                  Choisir le personnage
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => readImageFile(event.target.files?.[0], (imageData) => updateHero({ characterImageData: imageData }))}
                  />
                </label>
                {hero.characterImageData ? (
                  <button type="button" className="secondary-action full" onClick={() => updateHero({ characterImageData: '' })}>Retirer le personnage</button>
                ) : null}
              </div>
            </div>

            <div className="grid-two hero-character-image-grid">
              <div>
                <HelpLabel help={FIELD_HELP.setupBackground}>Fond création du héros</HelpLabel>
                <label className="button like secondary-action full">
                  Choisir un fond d'intro
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => readImageFile(event.target.files?.[0], (imageData) => updateHero({ setupBackgroundImageData: imageData }))}
                  />
                </label>
                {hero.setupBackgroundImageData ? (
                  <button type="button" className="secondary-action full" onClick={() => updateHero({ setupBackgroundImageData: '' })}>Retirer le fond d'intro</button>
                ) : null}
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.setupMusic}>Musique de début</HelpLabel>
                <label className="button like secondary-action full">
                  Choisir une musique
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={(event) => readAudioFile(event.target.files?.[0], (audioData, audioName) => updateHero({ setupMusicData: audioData, setupMusicName: audioName }))}
                  />
                </label>
                {hero.setupMusicData ? (
                  <button type="button" className="secondary-action full" onClick={() => updateHero({ setupMusicData: '', setupMusicName: '' })}>
                    Retirer la musique{hero.setupMusicName ? ` (${hero.setupMusicName})` : ''}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="hero-equipment-slot-editor-card">
              <div className="hero-equipment-slot-editor-head">
                <HelpLabel help={FIELD_HELP.equipmentSlots}>Emplacements portes</HelpLabel>
                <label>
                  <span>Nombre de slots</span>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={hero.equipmentSlotCount || 6}
                    onChange={(event) => updateHero({
                      equipmentSlotCount: clampNumber(event.target.value, hero.equipmentSlotCount || 6, 1, 8),
                    })}
                  />
                </label>
              </div>
              <div className="hero-equipment-slot-editor-grid">
                {DEFAULT_EQUIPMENT_SLOT_LABELS.slice(0, hero.equipmentSlotCount || 6).map((defaultLabel, index) => (
                  <label key={defaultLabel}>
                    <span>Slot {index + 1}</span>
                    <input
                      value={hero.equipmentSlotLabels?.[index] ?? defaultLabel}
                      onChange={(event) => updateEquipmentSlotLabel(index, event.target.value)}
                      placeholder={defaultLabel}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
          ) : null}

          {activeHeroTab === 'skills' ? (
          <div className="subpanel" data-tour="hero-skills-panel">
            <div className="subpanel-head">
              <div>
                <h3>Compétences</h3>
                <p>Comme dans un livre-jeu, tu peux tirer les valeurs au dé avant de jouer.</p>
              </div>
              <div className="toolbar">
                <button type="button" className="secondary-action" onClick={rollHeroSkills}>
                  <Dices size={16} aria-hidden="true" />
                  Tirer les compétences
                </button>
              </div>
            </div>

            <div className="hero-skill-roll-note">
              <Dices size={18} aria-hidden="true" />
              <span>Règle actuelle : chaque compétence garde sa base, puis ajoute 1d6 au début du jeu.</span>
            </div>

            <div className="hero-skill-list">
              {hero.skills.map((skill) => (
                <div className="hero-skill-editor" key={skill.id}>
                  <div>
                    <HelpLabel help={FIELD_HELP.skills}>Nom</HelpLabel>
                    <input
                      value={skill.name}
                      onChange={(event) => updateSkill(skill.id, { name: event.target.value })}
                    />
                  </div>
                  <div>
                    <HelpLabel help={FIELD_HELP.skills}>Bonus</HelpLabel>
                    <input
                      type="number"
                      value={skill.value}
                      onChange={(event) => {
                        const value = clampNumber(event.target.value, skill.value, -20, 50);
                        updateSkill(skill.id, { value, baseValue: value, rolledValue: 0, rollFormula: '' });
                      }}
                    />
                    {skill.rolledValue ? <small className="hero-roll-source">Base {skill.baseValue ?? (Number(skill.value) - Number(skill.rolledValue))} + 1d6 ({skill.rolledValue}) = {skill.value}</small> : null}
                  </div>
                  <div>
                    <HelpLabel help={FIELD_HELP.manaCost}>Coût mana</HelpLabel>
                    <input
                      type="number"
                      min="0"
                      value={skill.manaCost}
                      onChange={(event) => updateSkill(skill.id, { manaCost: clampNumber(event.target.value, skill.manaCost, 0, 99) })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          ) : null}

          {activeHeroTab === 'powers' ? (
          <div className="hero-powers-grid" data-tour="hero-powers-panel">
            <section className="subpanel">
              <div className="subpanel-head">
                <div>
              <h3>Pouvoirs du héros</h3>
                  <p>Chaque pouvoir peut etre utilise en combat avec son cout mana et sa force.</p>
                </div>
                <button type="button" onClick={addPower}>
                  <Plus size={16} aria-hidden="true" />
                  Ajouter
                </button>
              </div>

              <div className="hero-power-list">
                {(hero.powers || []).map((power) => (
                  <div className="hero-power-editor" key={power.id}>
                    <div>
                      <HelpLabel help="Nom visible dans le combat.">Nom</HelpLabel>
                      <input
                        value={power.name}
                        onChange={(event) => updatePower(power.id, { name: event.target.value })}
                      />
                    </div>
                    <div>
                <HelpLabel help="Élément du pouvoir. Les résistances ennemies peuvent réduire ces dégâts.">Type</HelpLabel>
                      <select value={power.type} onChange={(event) => updatePower(power.id, { type: event.target.value })}>
                        {HERO_POWER_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <HelpLabel help="Mana depensee quand le joueur lance ce pouvoir.">Cout mana</HelpLabel>
                      <input
                        type="number"
                        min="0"
                        value={power.manaCost}
                        onChange={(event) => updatePower(power.id, { manaCost: clampNumber(event.target.value, power.manaCost, 0, 999) })}
                      />
                    </div>
                    <div>
                <HelpLabel help="Dégâts du pouvoir avant résistance ennemie.">Force</HelpLabel>
                      <input
                        type="number"
                        min="0"
                        value={power.force}
                        onChange={(event) => updatePower(power.id, { force: clampNumber(event.target.value, power.force, 0, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="PV rendus au héros quand ce pouvoir est lancé. Le soin est limité aux PV max.">Soin PV</HelpLabel>
                      <input
                        type="number"
                        min="0"
                        value={power.healHealth || 0}
                        onChange={(event) => updatePower(power.id, { healHealth: clampNumber(event.target.value, power.healHealth || 0, 0, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Mana rendue au héros après paiement du coût. La récupération est limitée à la mana max.">Soin mana</HelpLabel>
                      <input
                        type="number"
                        min="0"
                        value={power.healMana || 0}
                        onChange={(event) => updatePower(power.id, { healMana: clampNumber(event.target.value, power.healMana || 0, 0, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Altération appliquée par ce pouvoir. Le bouclier protège le héros, les autres ciblent l'ennemi.">État</HelpLabel>
                      <select value={power.statusType || ''} onChange={(event) => updatePower(power.id, { statusType: event.target.value })}>
                        {HERO_STATUS_EFFECT_TYPES.map((type) => (
                          <option key={type.id || 'none'} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <HelpLabel help="Dégâts par tour pour poison, brûlure et saignement. Points absorbés pour bouclier.">Valeur</HelpLabel>
                      <input
                        type="number"
                        min="0"
                        value={power.statusAmount || 0}
                        onChange={(event) => updatePower(power.id, { statusAmount: clampNumber(event.target.value, power.statusAmount || 0, 0, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Nombre de tours pendant lesquels l'altération reste active.">Tours</HelpLabel>
                      <input
                        type="number"
                        min="1"
                        value={power.statusDuration || 1}
                        onChange={(event) => updatePower(power.id, { statusDuration: clampNumber(event.target.value, power.statusDuration || 1, 1, 99) })}
                      />
                    </div>
                    <button
                      type="button"
                      className="danger-button hero-skill-delete"
                      onClick={() => removePower(power.id)}
                      disabled={(hero.powers || []).length <= 1}
                      title="Supprimer le pouvoir"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="subpanel">
              <div className="subpanel-head">
                <div>
              <h3>Résistances du héros</h3>
              <p>Réduit les dégâts des pouvoirs ennemis selon leur type.</p>
                </div>
              </div>
              <div className="hero-resistance-grid">
                {HERO_RESISTANCE_FIELDS.map((resistance) => (
                  <label key={resistance.id} className="hero-resistance-row">
                    <span>{resistance.label}</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={hero[resistance.field] || 0}
                      onChange={(event) => updateHero({ [resistance.field]: clampNumber(event.target.value, hero[resistance.field] || 0, 0, 100) })}
                    />
                    <em>%</em>
                  </label>
                ))}
              </div>
            </section>
          </div>
          ) : null}

          {activeHeroTab === 'rules' ? (
          <div className="subpanel" data-tour="hero-rules-panel">
            <div className="subpanel-head">
              <div>
                <h3>Affichage</h3>
                <p>Réglages d'interface et de confort visibles pendant la Preview et dans le player.</p>
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(rules.allowManualAdjustments)}
                onChange={(event) => updateHeroAdventure((draft) => {
                  draft.rules.allowManualAdjustments = event.target.checked;
                })}
              />
              <span>Autoriser les ajustements manuels PV/Mana dans l'aperçu</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(rules.failForward)}
                onChange={(event) => updateHeroAdventure((draft) => {
                  draft.rules.failForward = event.target.checked;
                })}
              />
              <span>Prévoir une branche intéressante en cas d'échec</span>
              <span className="help-dot" data-help={FIELD_HELP.failForward} aria-label={FIELD_HELP.failForward} tabIndex={0}>?</span>
            </label>
            <div className="hero-dice-skin-card">
              <div className="subpanel-head">
                <div>
                  <HelpLabel help={FIELD_HELP.diceSkin}>Style dés des</HelpLabel>
                  <p>Le joueur retrouvera ce rendu pendant la création du héros, les tests et les combats.</p>
                </div>
              </div>
              <div className="hero-dice-skin-grid">
                {HERO_DICE_SKINS.map((skin) => (
                  <button
                    key={skin.id}
                    type="button"
                    className={`hero-dice-skin-option ${heroAdventure.dice.skin === skin.id ? 'active' : ''}`}
                    onClick={() => setDiceSkin(skin.id)}
                    aria-pressed={heroAdventure.dice.skin === skin.id}
                  >
                    <span className={`hero-die-face hero-die-face--${skin.id}`}>
                      {DICE_PREVIEW_PIPS.map((position) => <i key={position} className={`pip pip-${position}`} />)}
                    </span>
                    <strong>{skin.label}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-dice-skin-card">
              <div className="subpanel-head">
                <div>
                  <HelpLabel help={FIELD_HELP.buttonStyle}>Style dés boutons joueur</HelpLabel>
                  <p>Ce style suit le joueur dans les choix, cinématiques, énigmes, inventaire et actions Hero.</p>
                </div>
              </div>
              <div className="hero-button-style-grid">
                {BUTTON_STYLE_PRESETS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={`hero-button-style-option player-button-style-${style.id} ${playerButtonStyle === style.id ? 'active' : ''}`}
                    onClick={() => setButtonStyle(style.id)}
                    aria-pressed={playerButtonStyle === style.id}
                  >
                    <span>{style.label}</span>
                    {playerButtonStyle === style.id ? <small>Actif</small> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-dice-skin-card">
              <div className="subpanel-head">
                <div>
                  <HelpLabel help={FIELD_HELP.buttonFont}>Police des boutons</HelpLabel>
                  <p>La police choisie s'applique aux boutons du player et de l'export.</p>
                </div>
              </div>
              <div className="hero-font-style-grid">
                {FONT_STYLE_PRESETS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={`hero-font-style-option player-font-style-${style.id} ${playerButtonFont === style.id ? 'active' : ''}`}
                    onClick={() => updateUiStyle({ buttonFont: style.id })}
                    aria-pressed={playerButtonFont === style.id}
                  >
                    {style.label}
                    {playerButtonFont === style.id ? <small>Actif</small> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-dice-skin-card">
              <div className="subpanel-head">
                <div>
                  <HelpLabel help={FIELD_HELP.narrationFont}>Police de narration</HelpLabel>
                  <p>Elle sert aux textes affichés au joueur : narration, dialogues, cinématiques et messages.</p>
                </div>
              </div>
              <div className="hero-font-style-grid">
                {FONT_STYLE_PRESETS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={`hero-font-style-option player-font-style-${style.id} ${playerNarrationFont === style.id ? 'active' : ''}`}
                    onClick={() => updateUiStyle({ narrationFont: style.id })}
                    aria-pressed={playerNarrationFont === style.id}
                  >
                    {style.label}
                    {playerNarrationFont === style.id ? <small>Actif</small> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-dice-skin-card">
              <div className="subpanel-head">
                <div>
                  <HelpLabel help={FIELD_HELP.narrationBackground}>Fond de narration</HelpLabel>
                  <p>Choisis la couleur du panneau dé texte visible en bas du player.</p>
                </div>
              </div>
              <div className="hero-narration-bg-grid">
                {NARRATION_BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`hero-narration-bg-option ${playerNarrationBackground === preset.value ? 'active' : ''}`}
                    style={{ background: preset.value }}
                    onClick={() => updateUiStyle({ narrationBackground: preset.value })}
                    aria-pressed={playerNarrationBackground === preset.value}
                  >
                    <span>{preset.label}</span>
                    {playerNarrationBackground === preset.value ? <small>Actif</small> : null}
                  </button>
                ))}
                <label className="hero-narration-color-custom">
                  <span>Personnalise</span>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(playerNarrationBackground) ? playerNarrationBackground : '#020617'}
                    onChange={(event) => updateUiStyle({ narrationBackground: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
          ) : null}

          {activeHeroTab === 'balance' ? (
          <div className="hero-balance-dashboard" data-tour="hero-balance-panel">
            <div className="hero-balance-summary">
              <div className="hero-balance-stat">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Victoire moyenne</span>
                <strong>{formatPercent(heroBalance.summary.averageCombatWin)}</strong>
              </div>
              <div className="hero-balance-stat">
                <Dices size={18} aria-hidden="true" />
                <span>Tests moyens</span>
                <strong>{formatPercent(heroBalance.summary.averageCheckSuccess)}</strong>
              </div>
              <div className="hero-balance-stat">
                <Swords size={18} aria-hidden="true" />
                <span>Combats tendus</span>
                <strong>{heroBalance.summary.hardCombats}</strong>
              </div>
              <div className="hero-balance-stat">
                <Trophy size={18} aria-hidden="true" />
                <span>Récompenses faibles</span>
                <strong>{heroBalance.summary.weakRewards}</strong>
              </div>
              <div className={`hero-balance-stat ${heroBalance.alerts.length ? 'warning' : 'safe'}`}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>Alertes</span>
                <strong>{heroBalance.alerts.length}</strong>
              </div>
            </div>

            <div className="hero-balance-grid">
              <section className="hero-balance-panel hero-balance-panel--wide">
                <div className="subpanel-head">
                  <h3>Probabilités par compétence</h3>
                  <small>{heroBalance.diceLabel} + bonus contre les difficultés détectées</small>
                </div>
                <div className="hero-balance-skill-grid">
                  {heroBalance.skills.map((entry) => (
                    <article className={`hero-balance-skill-card ${entry.rating.key}`} key={entry.skill.id}>
                      <header>
                        <div>
                          <strong>{entry.skill.name}</strong>
                          <small>Bonus {formatSignedNumber(entry.skill.value)} - {entry.useCount || 0} usage(s)</small>
                        </div>
                        <span>{entry.rating.label}</span>
                      </header>
                      <div className="hero-balance-mini-metrics">
                        <span>
                          <strong>{formatPercent(entry.averageCheckSuccess)}</strong>
                          <small>tests</small>
                        </span>
                        <span>
                          <strong>{formatPercent(entry.averageHit)}</strong>
                          <small>toucher</small>
                        </span>
                        <span>
                          <strong>{formatPercent(entry.averageWin)}</strong>
                          <small>victoire</small>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="hero-balance-panel">
                <div className="subpanel-head">
                  <h3>Progression PV / Mana</h3>
                </div>
                <div className="hero-balance-resource-list">
                  <div className="hero-balance-resource">
                    <header>
                      <span>PV</span>
                      <strong>{formatDecimal(heroBalance.progression.expectedHealthLoss)} / {formatDecimal(heroBalance.progression.healthBudget)}</strong>
                    </header>
                    <div className={`hero-balance-meter ${healthProgressionClass}`}>
                      <span style={{ '--meter-value': `${heroBalance.progression.healthMeter}%` }} />
                    </div>
                    <small>Soins +{formatDecimal(heroBalance.progression.healthRestores)} - PV max +{formatDecimal(heroBalance.progression.maxHealthBonus)}</small>
                  </div>
                  <div className="hero-balance-resource">
                    <header>
                      <span>Mana</span>
                      <strong>{formatDecimal(heroBalance.progression.expectedManaCost)} / {formatDecimal(heroBalance.progression.manaBudget)}</strong>
                    </header>
                    <div className={`hero-balance-meter ${manaProgressionClass}`}>
                      <span style={{ '--meter-value': `${heroBalance.progression.manaMeter}%` }} />
                    </div>
                    <small>Potions +{formatDecimal(heroBalance.progression.manaRestores)} - mana max +{formatDecimal(heroBalance.progression.maxManaBonus)}</small>
                  </div>
                </div>
              </section>

              <section className="hero-balance-panel">
                <div className="subpanel-head">
                  <h3>Alertes</h3>
                </div>
                <div className="hero-balance-alert-list">
                  {heroBalance.alerts.length ? heroBalance.alerts.map((alert) => (
                    <article className={`hero-balance-alert ${alert.severity}`} key={alert.id}>
                      <AlertTriangle size={15} aria-hidden="true" />
                      <div>
                        <strong>{alert.title}</strong>
                        <span>{alert.detail}</span>
                        {alert.sourceLabel ? <small>{alert.sourceLabel}</small> : null}
                      </div>
                    </article>
                  )) : (
                    <div className="hero-balance-empty">Aucune alerte d'Équilibrage détectée.</div>
                  )}
                </div>
              </section>

              <section className="hero-balance-panel hero-balance-panel--wide">
                <div className="subpanel-head">
                  <h3>Difficulté des combats</h3>
                  <small>{heroBalance.combats.length} combat(s) Hero détecté(s)</small>
                </div>
                <div className="hero-balance-list">
                  {heroBalance.combats.length ? heroBalance.combats.map((combat) => (
                    <article className={`hero-balance-row ${combat.rating.key}`} key={combat.id}>
                      <header>
                        <div>
                          <strong>{combat.enemyName}</strong>
                          <small>{combat.sourceLabel}</small>
                        </div>
                        <span>{combat.rating.label}</span>
                      </header>
                      <div className="hero-balance-metrics">
                        <span><strong>{formatPercent(combat.hitProbability)}</strong><small>toucher</small></span>
                        <span><strong>{formatPercent(combat.winProbability)}</strong><small>victoire</small></span>
                        <span><strong>{formatPercent(combat.survivalProbability)}</strong><small>survie</small></span>
                        <span><strong>{formatDecimal(combat.expectedAttempts)}</strong><small>tours</small></span>
                        <span><strong>{formatDecimal(combat.expectedDamage)}</strong><small>PV perdus</small></span>
                        <span><strong>{formatDecimal(combat.expectedMana)}</strong><small>mana</small></span>
                      </div>
                      <p>
                        {combat.skillName} {formatSignedNumber(combat.skillBonus)} contre {combat.difficulty};
                        {' '}simulation moteur sur {combat.engineEstimate?.iterations || 0} combat(s), {formatDecimal(combat.heroDamage)} dégâts héros/tour pour {combat.enemyHealth} PV ennemis.
                        {combat.mitigationDetails?.length ? ` ${combat.mitigationDetails.join(' - ')}.` : ''}
                      </p>
                    </article>
                  )) : (
                    <div className="hero-balance-empty">Aucun combat Hero détecté.</div>
                  )}
                </div>
              </section>

              <section className="hero-balance-panel hero-balance-panel--wide">
                <div className="subpanel-head">
                  <h3>Tests de compétence</h3>
                  <small>{heroBalance.checks.length} test(s) détecté(s)</small>
                </div>
                <div className="hero-balance-list">
                  {heroBalance.checks.length ? heroBalance.checks.map((check) => (
                    <article className={`hero-balance-row ${check.rating.key}`} key={check.id}>
                      <header>
                        <div>
                          <strong>{check.skillName} contre {check.difficulty}</strong>
                          <small>{check.sourceLabel}</small>
                        </div>
                        <span>{check.rating.label}</span>
                      </header>
                      <div className="hero-balance-metrics">
                        <span><strong>{formatPercent(check.successProbability)}</strong><small>réussite</small></span>
                        <span><strong>{check.manaCost}</strong><small>mana</small></span>
                        <span><strong>{check.failureHealthLoss}</strong><small>PV échec</small></span>
                        <span><strong>{formatDecimal(check.expectedDamage)}</strong><small>PV attendus</small></span>
                      </div>
                    </article>
                  )) : (
                    <div className="hero-balance-empty">Aucun test Hero détecté.</div>
                  )}
                </div>
              </section>

              <section className="hero-balance-panel hero-balance-panel--wide">
                <div className="subpanel-head">
                  <h3>Utilité des récompenses</h3>
                  <small>{heroBalance.rewards.length} objet(s) récompense(s)</small>
                </div>
                <div className="hero-balance-reward-grid">
                  {heroBalance.rewards.length ? heroBalance.rewards.map((reward) => (
                    <article className={`hero-balance-reward ${reward.status}`} key={reward.itemId}>
                      <header>
                        <div>
                          <strong>{reward.itemName}</strong>
                          <small>{reward.typeLabel}</small>
                        </div>
                        <span>{reward.statusLabel}</span>
                      </header>
                      <p>{reward.reason}</p>
                      <small>{reward.sources.slice(0, 2).map((source) => source.sourceLabel).join(' - ')}</small>
                    </article>
                  )) : (
                    <div className="hero-balance-empty">Aucune récompense Hero détectée.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
          ) : null}

          {activeHeroTab === 'guide' ? (
          <div className="hero-guide-grid" data-tour="hero-guide-panel">
            <div className="subpanel hero-check-preview">
              <Dices size={22} aria-hidden="true" />
              <div>
                <h3>Test de compétence</h3>
                <p>
                  Dans une zone, un hotspot ou une réponse de dialogue, choisis l'action Test de compétence.
                  Sélectionne la compétence, la difficulté, le coût mana, puis une conséquence de réussite et une conséquence d'échec.
                </p>
              </div>
            </div>

            <div className="hero-guide-card">
              <strong>Jet automatique en Preview</strong>
              <p>
                Le joueur clique, le jeu lance le dé principal, ajoute le bonus de compétence et compare le total à la difficulté.
                Exemple: d20 + Force contre difficulté 12.
              </p>
            </div>

            <div className="hero-guide-card">
              <strong>Equipements et objets</strong>
              <p>
                Crée des objets de type équipement pour donner un bonus de compétence, PV max ou mana max.
                Les potions restent dans l'inventaire; les équipements se glissent sur la fiche personnage.
              </p>
            </div>

            <div className="hero-guide-card">
              <strong>Combats simples</strong>
              <p>
                Ajoute un ennemi avec PV, attaque, dégâts et récompense. Le combat peut retirer des PV au héros et donner un objet ou ouvrir une route.
              </p>
            </div>

            <div className="hero-guide-card">
              <strong>Mauvais chemin et malus</strong>
              <p>
                Pour un mauvais choix, utilise une conséquence: perte de PV, perte de mana, objet retiré, variable modifiée ou route vers une scène dangereuse.
              </p>
            </div>

            <div className="hero-guide-card">
              <strong>Conditions Hero</strong>
              <p>
                Dans la logique, filtre les routes avec PV inférieur à X, mana suffisante, dernier jet réussi ou compétence utilisée.
              </p>
            </div>

            <div className="hero-guide-card hero-guide-card--wide">
              <strong>Checklist avant export</strong>
              <ul>
                <li>Chaque test a une compétence et une difficulté.</li>
                <li>Chaque échec a une vraie conséquence ou une branche alternative.</li>
                <li>Les coûts de mana ne dépassent pas la mana maximum du héros.</li>
                <li>Les objets portes ont un bonus utile et les consommables restent dans l'inventaire.</li>
              </ul>
            </div>
          </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
