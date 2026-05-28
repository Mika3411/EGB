import { useEffect, useRef, useState } from 'react';
import { DoorOpen, Dices, Package, Shield, Sparkles, Swords } from 'lucide-react';
import { getHeroForceValue, getStatusEffectLabel } from '../../lib/combatEngine.js';
import CombatD20Canvas from './PreviewCombatD20Canvas.jsx';

const getStatusBadgeClass = (type = '') => (
  String(type || 'status').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
);

const getStatusEffectParts = (effect = {}) => {
  const type = effect.type || effect.statusType || '';
  const label = getStatusEffectLabel(type) || 'Statut';
  const amount = Math.max(0, Number(effect.amount) || 0);
  const duration = Math.max(0, Number(effect.duration) || 0);
  const details = [
    type && type !== 'stun' && amount ? String(amount) : '',
    duration ? `${duration}t` : '',
  ].filter(Boolean);

  return {
    type,
    label,
    meta: details.join(' · '),
  };
};

const formatStatusEffectBadge = (effect = {}) => {
  const { label, meta } = getStatusEffectParts(effect);
  return meta ? `${label} ${meta}` : label;
};

const normalizeCombatJournalText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const splitCombatJournalText = (value = '') => (
  normalizeCombatJournalText(value).match(/[^.!?]+[.!?]?/g) || []
).map((entry) => entry.trim()).filter(Boolean);

const COMBAT_D20_CHARGE_MAX_MS = 1400;

const clampCombatHeadline = (value = '') => {
  const text = normalizeCombatJournalText(value);
  if (text.length <= 72) return text;
  return `${text.slice(0, 69).replace(/\s+\S*$/, '')}...`;
};

export default function PreviewCombatOverlay({
  activeHeroCombat = null,
  heroCombatStates = {},
  isHeroAdventure = false,
  heroAdventure = {},
  heroState = {},
  playSceneBackgroundUrl = '',
  lastDiceRoll = null,
  inventory = [],
  selectedHeroCombatPowerId = '',
  setSelectedHeroCombatPowerId = () => {},
  heroCombatEffectLocked = false,
  isHeroDefeated = false,
  heroCombatRolling = false,
  heroCombatDieFace = 1,
  heroDiceSkin = 'classic',
  heroCombatRollIntervalRef,
  heroCombatAutoStopTimeoutRef,
  heroCombatDieFaceRef,
  setHeroCombatDieFace,
  setHeroCombatRolling,
  attemptSurvivalHeroCombat,
  rollActiveEnemyCombat,
  attackActiveHeroCombat,
  attemptEscapeHeroCombat,
  closeHeroCombat,
  openInventoryItem,
  project,
  Anime2DPreviewComponent,
  getCombatEntryValue,
  getCombatActorMedia,
}) {
  const [heroCombatCharging, setHeroCombatCharging] = useState(false);
  const [heroCombatCharge, setHeroCombatCharge] = useState(0);
  const [heroCombatLaunchForce, setHeroCombatLaunchForce] = useState(.35);
  const [heroCombatLaunchId, setHeroCombatLaunchId] = useState(0);
  const heroCombatChargeFrameRef = useRef(0);
  const heroCombatChargeStartRef = useRef(0);
  const heroCombatChargingRef = useRef(false);
  const heroCombatRollSettledRef = useRef(false);
  const heroCombatPendingRollRef = useRef(null);

  useEffect(() => () => {
    if (heroCombatChargeFrameRef.current) {
      window.cancelAnimationFrame(heroCombatChargeFrameRef.current);
    }
  }, []);

  if (!activeHeroCombat || !isHeroAdventure) return null;

  const renderHeroCombatEffectMedia = (effect) => {
    const media = effect?.media;
    if (!media) return null;
    const audioNode = media.audioData ? (
      <audio src={media.audioData} autoPlay preload="auto" style={{ display: 'none' }} />
    ) : null;
    if (media.mediaType === 'anime2d' && media.anime2dSpec) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--anime">
            <Anime2DPreviewComponent spec={media.anime2dSpec} project={project} />
          </span>
        </>
      );
    }
    if (media.mediaType === 'video' && media.videoData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--video">
            <video src={media.videoData} autoPlay muted playsInline />
          </span>
        </>
      );
    }
    if (media.mediaType === 'image' && media.imageData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--image">
            <img src={media.imageData} alt="" />
          </span>
        </>
      );
    }
    if (media.mediaType === 'visual' && media.visualEffect && media.visualEffect !== 'none') {
      return (
        <>
          {audioNode}
          <span className={`hero-combat-fx-visual hero-combat-fx-visual--${media.visualEffect}`} aria-hidden="true" />
        </>
      );
    }
    return audioNode;
  };

  const renderHeroCombatActor = (media, label, side, vitals = {}, visualEffects = [], actorMeta = {}) => {
    const maxHealth = Math.max(1, Number(vitals.maxHealth) || 1);
    const health = Math.max(0, Math.min(maxHealth, Number(vitals.health) || 0));
    const maxMana = Math.max(0, Number(vitals.maxMana) || 0);
    const mana = Math.max(0, Math.min(maxMana, Number(vitals.mana) || 0));
    const healthPercent = (health / maxHealth) * 100;
    const manaPercent = maxMana > 0 ? (mana / maxMana) * 100 : 0;
    const statusEffects = Array.isArray(actorMeta.statusEffects) ? actorMeta.statusEffects : [];
    const initiative = Number.isFinite(Number(actorMeta.initiative)) ? Number(actorMeta.initiative) : 0;
    const isActiveActor = Boolean(actorMeta.isActive);
    const actorEffects = visualEffects.filter((effect) => effect.target === side);
    const actorVisualEffect = actorEffects.find((effect) => (
      effect?.media?.mediaType === 'visual'
      && effect.media.visualEffect
      && effect.media.visualEffect !== 'none'
    ))?.media?.visualEffect || '';
    const actorVisualEffectClass = actorVisualEffect ? `hero-combat-actor--visual-${actorVisualEffect}` : '';
    const actorEffectLabel = actorEffects.find((effect) => ['damage', 'death', 'heal'].includes(effect.type || ''))?.text
      || actorEffects.find((effect) => effect.type === 'critical')?.text
      || actorEffects.find((effect) => effect.text)?.text
      || (actorVisualEffect ? 'Effet actif' : '');

    return (
      <div className={`hero-combat-actor hero-combat-actor--${side} ${actorVisualEffectClass} ${media.mediaType === 'anime2d' && media.anime2dSpec ? 'has-anime' : media.imageData ? 'has-image' : 'is-empty'}`}>
        <div className="hero-combat-actor-head">
          <span>
            <small>{side === 'hero' ? 'Héros' : 'Adversaire'}</small>
            <strong>{label}</strong>
          </span>
          <em className={isActiveActor ? 'is-active' : ''}>{isActiveActor ? 'À jouer' : `Init ${initiative}`}</em>
        </div>
        <div className="hero-combat-actor-bars" aria-label={`Jauges ${label}`}>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--health">
            <span>PV</span>
            <strong>{health}/{maxHealth}</strong>
            <i style={{ width: `${healthPercent}%` }} />
          </div>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--mana">
            <span>Mana</span>
            <strong>{mana}/{maxMana}</strong>
            <i style={{ width: `${manaPercent}%` }} />
          </div>
        </div>
        <div className="hero-combat-actor-status-row" aria-label={`Statuts ${label}`}>
          {statusEffects.length ? statusEffects.map((effect, index) => {
            const status = getStatusEffectParts(effect);
            const statusClass = getStatusBadgeClass(status.type);
            return (
              <span
                key={`${status.type || 'status'}-${index}`}
                className={`hero-combat-status-badge hero-combat-status-badge--${statusClass}`}
                title={formatStatusEffectBadge(effect)}
              >
                <span className={`hero-combat-status-icon hero-combat-status-icon--${statusClass}`} aria-hidden="true" />
                <span className="hero-combat-status-copy">
                  <strong>{status.label}</strong>
                  {status.meta ? <small>{status.meta}</small> : null}
                </span>
              </span>
            );
          }) : (
            <span className="hero-combat-status-badge is-empty">Aucun statut</span>
          )}
          {actorEffectLabel ? <span className="hero-combat-status-badge hero-combat-status-badge--effect">{actorEffectLabel}</span> : null}
        </div>
        <div className={`hero-combat-actor-media ${actorVisualEffect ? `hero-combat-actor-media--visual-${actorVisualEffect}` : ''}`}>
          {media.mediaType === 'anime2d' && media.anime2dSpec ? (
            <Anime2DPreviewComponent spec={media.anime2dSpec} project={project} />
          ) : media.imageData ? (
            <img src={media.imageData} alt={label} />
          ) : (
            <span>{label.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        {actorEffects.length ? (
          <div className="hero-combat-actor-fx" aria-live="polite">
            {actorEffects.map((effect, index) => (
              <span
                key={effect.id}
                className={`hero-combat-fx hero-combat-fx--${effect.type || 'damage'} ${effect.media ? 'hero-combat-fx--has-media' : ''}`}
                style={{ '--fx-delay': `${index * 90}ms`, '--fx-offset': `${index * 12}px` }}
              >
                {renderHeroCombatEffectMedia(effect)}
                <span className="hero-combat-fx-text">{effect.text}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const entry = activeHeroCombat.entry || {};
  const combatSettings = heroAdventure.combat || {};
  const backgroundImageData = entry.combatBackgroundImageData || combatSettings.backgroundImageData || playSceneBackgroundUrl || '';
  const heroMedia = getCombatActorMedia(entry, combatSettings, 'hero', heroState?.characterImageData || '');
  const enemyMedia = getCombatActorMedia(entry, combatSettings, 'enemy');
  const heroLabel = heroState?.name || 'Heros';
  const enemyLabel = activeHeroCombat.enemyName || entry.combatEnemyName || combatSettings.enemyName || 'Ennemi';
  const enemyMaxHealth = Math.max(1, Number(activeHeroCombat.enemyMaxHealth) || Number(entry.combatEnemyMaxHealth) || 1);
  const enemyHealth = Math.max(0, Math.min(enemyMaxHealth, Number(activeHeroCombat.enemyHealth) || 0));
  const enemyMaxMana = Math.max(0, Number(activeHeroCombat.enemyMaxMana) || Number(entry.combatEnemyMaxMana) || Number(combatSettings.enemyMaxMana) || 0);
  const enemyMana = Math.max(0, Math.min(enemyMaxMana, Number(activeHeroCombat.enemyMana) || 0));
  const heroMaxHealth = Math.max(1, Number(heroState?.maxHealth) || 1);
  const heroHealth = Math.max(0, Math.min(heroMaxHealth, Number(heroState?.health) || 0));
  const heroMaxMana = Math.max(0, Number(heroState?.maxMana) || 0);
  const heroMana = Math.max(0, Math.min(heroMaxMana, Number(heroState?.mana) || 0));
  const heroPowers = Array.isArray(heroState?.powers) ? heroState.powers : [];
  const combatManaCost = Math.max(0, Number(entry.combatManaCost) || 0);
  const diceSides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
  const selectedCombatSkill = (Array.isArray(heroState?.skills) ? heroState.skills : []).find((skill) => skill.id === entry.combatSkillId)
    || (Array.isArray(heroState?.skills) ? heroState.skills[0] : null);
  const heroForce = getHeroForceValue(heroState, selectedCombatSkill?.id || '');
  const heroDieDamagePercent = Math.max(0, Number(getCombatEntryValue(entry, 'combatHeroDieDamagePercent', combatSettings.heroDieDamagePercent || 0)) || 0);
  const estimatedDieDamage = Math.max(0, Math.round(((diceSides + 1) / 2) * (heroDieDamagePercent / 100)));
  const estimatePowerDamage = (power = null) => Math.max(0, heroForce + estimatedDieDamage + Math.max(0, Number(power?.force) || 0));
  const formatManaCost = (value) => `${Math.max(0, Number(value) || 0)} mana`;
  const formatDamageEstimate = (value) => `~${Math.max(0, Number(value) || 0)} dégâts`;
  const describePowerEffect = (power = {}) => {
    if (power.statusType === 'shield') return `Bouclier ${Math.max(0, Number(power.statusAmount) || Number(power.force) || 0)}`;
    if (Number(power.healHealth) > 0 || Number(power.healMana) > 0) {
      return [
        Number(power.healHealth) > 0 ? `PV +${Math.max(0, Number(power.healHealth) || 0)}` : '',
        Number(power.healMana) > 0 ? `Mana +${Math.max(0, Number(power.healMana) || 0)}` : '',
      ].filter(Boolean).join(' · ');
    }
    if (power.statusType) return `${getStatusEffectLabel(power.statusType)} ${Math.max(0, Number(power.statusAmount) || 0)}`;
    return formatDamageEstimate(estimatePowerDamage(power));
  };
  const currentCombatState = heroCombatStates?.[activeHeroCombat.id] || {};
  const heroStatusEffects = Array.isArray(currentCombatState.heroStatusEffects)
    ? currentCombatState.heroStatusEffects
    : Array.isArray(activeHeroCombat.heroStatusEffects)
    ? activeHeroCombat.heroStatusEffects
    : [];
  const enemyStatusEffects = Array.isArray(currentCombatState.enemyStatusEffects)
    ? currentCombatState.enemyStatusEffects
    : Array.isArray(activeHeroCombat.enemyStatusEffects)
    ? activeHeroCombat.enemyStatusEffects
    : [];
  const heroInitiative = Number.isFinite(Number(activeHeroCombat.heroInitiative))
    ? Number(activeHeroCombat.heroInitiative)
    : Math.max(-999, Math.min(999, Number(heroState?.initiative) || 0));
  const enemyInitiativeFallback = getCombatEntryValue(entry, 'combatEnemyInitiative', combatSettings.enemyInitiative || 0);
  const enemyInitiative = Number.isFinite(Number(activeHeroCombat.enemyInitiative))
    ? Number(activeHeroCombat.enemyInitiative)
    : Math.max(-999, Math.min(999, Number(enemyInitiativeFallback) || 0));
  const selectedHeroCombatPower = heroPowers.find((power) => power.id === selectedHeroCombatPowerId) || null;
  const selectedHeroCombatPowerMissing = Boolean(selectedHeroCombatPowerId && !selectedHeroCombatPower);
  const selectedHeroCombatPowerManaCost = selectedHeroCombatPower ? Math.max(0, Number(selectedHeroCombatPower.manaCost) || 0) : 0;
  const selectedHeroCombatManaCost = combatManaCost + selectedHeroCombatPowerManaCost;
  const selectedHeroCombatManaUnavailable = selectedHeroCombatManaCost > heroMana;
  const selectedHeroCombatActionLabel = selectedHeroCombatPower
    ? `Utiliser ${selectedHeroCombatPower.name || 'Pouvoir'}`
    : 'Attaque normale';
  const showDice = getCombatEntryValue(entry, 'combatShowDice', combatSettings.showDice !== false) !== false;
  const lastCombatRoll = activeHeroCombat.lastEnemyRoll
    || activeHeroCombat.lastRoll
    || (['hero_combat', 'enemy_combat', 'hero_combat_escape', 'hero_combat_survival'].includes(lastDiceRoll?.actionType) ? lastDiceRoll : null);
  const overlayStyle = backgroundImageData
    ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.18), rgba(2,6,23,.82)), url(${backgroundImageData})` }
    : undefined;
  const isEnded = ['victory', 'defeat'].includes(activeHeroCombat.status);
  const isEnemyTurn = activeHeroCombat.phase === 'enemy';
  const isSurvivalTurn = activeHeroCombat.phase === 'survival';
  const enemyCunning = Math.max(1, Number(getCombatEntryValue(entry, 'combatEnemyCunning', combatSettings.enemyCunning || 10)) || 10);
  const attackPowers = heroPowers.filter((power) => power.statusType !== 'shield');
  const defensePowers = heroPowers.filter((power) => power.statusType === 'shield');
  const firstAvailablePower = attackPowers.find((power) => combatManaCost + Math.max(0, Number(power.manaCost) || 0) <= heroMana) || null;
  const firstDefensePower = defensePowers.find((power) => combatManaCost + Math.max(0, Number(power.manaCost) || 0) <= heroMana) || null;
  const isSelectedDefensePower = selectedHeroCombatPower?.statusType === 'shield';
  const inventoryItems = Array.isArray(inventory)
    ? inventory.map((itemId) => project?.items?.find((item) => item.id === itemId)).filter(Boolean)
    : [];
  const usableCombatItems = inventoryItems.filter((item) => (
    (item.heroItemType === 'health_potion' && heroHealth < heroMaxHealth)
    || (item.heroItemType === 'mana_potion' && heroMana < heroMaxMana)
  ));
  const firstUsableCombatItem = usableCombatItems[0] || null;
  const describeCombatItem = (item = {}) => {
    if (item.heroItemType === 'health_potion') return `PV +${Math.max(1, Number(item.heroItemAmount) || 4)}`;
    if (item.heroItemType === 'mana_potion') return `Mana +${Math.max(1, Number(item.heroItemAmount) || 3)}`;
    return 'Objet';
  };
  const combatVisualEffects = Array.isArray(activeHeroCombat.visualEffects) ? activeHeroCombat.visualEffects : [];
  const isCombatEffectLocked = heroCombatEffectLocked && combatVisualEffects.length > 0;
  const combatPrimaryActionLabel = isEnded
    ? 'Combat terminé'
    : isCombatEffectLocked
    ? 'Impact...'
    : heroCombatCharging
    ? 'Charge...'
    : heroCombatRolling && isEnemyTurn
    ? 'La riposte roule...'
    : isEnemyTurn
    ? 'Maintenir la riposte'
    : heroCombatRolling
    ? 'Le dé roule...'
    : isSurvivalTurn
    ? 'Maintenir Survie'
    : `Maintenir ${selectedHeroCombatActionLabel}`;
  const CombatPrimaryIcon = isEnemyTurn || isSurvivalTurn || heroCombatRolling || heroCombatCharging ? Dices : Swords;
  const combatPrimaryActionClass = [
    'hero-combat-main-action',
    isEnemyTurn ? 'is-enemy' : '',
    isSurvivalTurn ? 'is-survival' : '',
    heroCombatCharging ? 'is-charging' : '',
    heroCombatRolling ? 'is-rolling' : '',
    isCombatEffectLocked ? 'is-impact' : '',
  ].filter(Boolean).join(' ');
  const combatRollActionType = heroCombatRolling || heroCombatCharging
    ? (isEnemyTurn ? 'enemy_combat' : isSurvivalTurn ? 'hero_combat_survival' : 'hero_combat')
    : lastCombatRoll?.actionType || '';
  const combatRollActor = combatRollActionType === 'enemy_combat' ? 'enemy' : 'hero';
  const combatRollTarget = combatRollActionType === 'enemy_combat'
    ? 'hero'
    : combatRollActionType === 'hero_combat_survival'
    ? 'hero'
    : 'enemy';
  const combatRollImpactDamageEffect = !heroCombatRolling && !heroCombatCharging && lastCombatRoll
    ? combatVisualEffects.find((effect) => (
      effect?.target === combatRollTarget
      && ['damage', 'death', 'heal'].includes(effect.type || '')
      && effect.text
    ))
    : null;
  const combatRollImpactSpecialEffect = !heroCombatRolling && !heroCombatCharging && lastCombatRoll
    ? combatVisualEffects.find((effect) => (
      effect?.target === combatRollTarget
      && effect.type === 'critical'
      && effect.text
    ))
    : null;
  const combatRollImpactEffect = combatRollImpactDamageEffect || combatRollImpactSpecialEffect;
  const combatRollRawValue = lastCombatRoll
    ? Math.max(1, Math.min(20, Number(lastCombatRoll.raw) || Number(lastCombatRoll.total) || 20))
    : '';
  const combatRollRawNumber = Number(combatRollRawValue);
  const combatRollTotalNumber = Number(lastCombatRoll?.total);
  const combatRollResultValue = lastCombatRoll
    ? (Number.isFinite(combatRollTotalNumber) ? Math.round(combatRollTotalNumber) : combatRollRawValue)
    : '';
  const combatRollModifier = Number(lastCombatRoll?.modifier);
  const combatRollIsAdditive = lastCombatRoll
    && Number.isFinite(combatRollRawNumber)
    && Number.isFinite(combatRollModifier)
    && Number.isFinite(combatRollTotalNumber)
    && Math.round(combatRollRawNumber + combatRollModifier) === Math.round(combatRollTotalNumber);
  const combatRollFormula = lastCombatRoll && Number(combatRollResultValue) !== Number(combatRollRawValue)
    ? combatRollIsAdditive
      ? `De ${combatRollRawValue}${combatRollModifier >= 0 ? ' +' : ' '}${combatRollModifier}`
      : `De ${combatRollRawValue} -> ${combatRollResultValue}`
    : '';
  const combatRollResultFace = combatRollRawValue || Math.max(1, Math.min(20, Number(combatRollResultValue) || 20));
  const showCombatRollResult = Boolean(lastCombatRoll && !heroCombatRolling && !heroCombatCharging);
  const combatRollResultKey = lastCombatRoll
    ? `${lastCombatRoll.id || 'roll'}-${lastCombatRoll.actionType || 'combat'}-${lastCombatRoll.raw}-${lastCombatRoll.total}-${activeHeroCombat.message || ''}`
    : 'combat-roll-empty';
  const combatRollHasCritical = showCombatRollResult && Boolean(
    lastCombatRoll?.isCriticalSuccess
    || lastCombatRoll?.heroCritical
    || combatVisualEffects.some((effect) => effect.type === 'critical')
  );
  const combatRollHasFailure = Boolean(showCombatRollResult && (lastCombatRoll?.isCriticalFailure || lastCombatRoll?.success === false));
  const combatRollDamage = Number(lastCombatRoll?.damage);
  const combatRollHasDamageValue = showCombatRollResult && Number.isFinite(combatRollDamage);
  const combatRollHasNoDamage = Boolean(combatRollHasDamageValue && combatRollDamage <= 0 && combatRollActionType !== 'hero_combat_survival');
  const combatRollNoDamageText = lastCombatRoll?.dodged
    ? 'Esquivé'
    : Number(lastCombatRoll?.damageBlocked) > 0
    ? 'Bloqué'
    : combatRollActionType === 'enemy_combat'
    ? 'Héros indemne'
    : 'Aucun dégât';
  const combatRollImpactText = combatRollImpactEffect?.text
    || (combatRollHasFailure ? 'Raté' : combatRollHasNoDamage ? combatRollNoDamageText : combatRollHasCritical ? 'Critique' : '');
  const combatRollKickerLabel = showCombatRollResult
    ? combatRollActionType === 'enemy_combat'
      ? 'Riposte'
      : combatRollActionType === 'hero_combat_survival'
      ? 'Survie'
      : 'Jet du héros'
    : heroAdventure.dice?.label || 'Dé';
  const combatDiceSpotlightClass = [
    'hero-combat-dice-spotlight',
    heroCombatCharging ? 'is-charging' : '',
    heroCombatRolling ? 'is-rolling' : '',
    showCombatRollResult ? 'has-result' : '',
    combatRollHasCritical ? 'is-critical' : '',
    combatRollHasFailure || combatRollHasNoDamage ? 'is-failure' : '',
    `hero-combat-dice-spotlight--${combatRollActor}`,
    `hero-combat-dice-spotlight--target-${combatRollTarget}`,
  ].filter(Boolean).join(' ');
  const combatJournalMessage = normalizeCombatJournalText(activeHeroCombat.message || 'Le combat commence.');
  const combatJournalHistory = (
    Array.isArray(activeHeroCombat.history) && activeHeroCombat.history.length
      ? activeHeroCombat.history
      : [combatJournalMessage]
  ).map(normalizeCombatJournalText).filter(Boolean).slice(-8);
  const combatJournalSentences = splitCombatJournalText(combatJournalMessage);
  const combatJournalDetail = combatJournalSentences.length > 1
    ? combatJournalSentences.slice(1).join(' ')
    : combatJournalMessage;
  const combatJournalHeadline = clampCombatHeadline(
    isEnded
      ? activeHeroCombat.status === 'victory'
        ? 'Victoire remportée.'
        : 'Le héros tombe.'
      : combatRollImpactText
      || (isCombatEffectLocked
        ? 'Impact en cours...'
        : isEnemyTurn
        ? 'La riposte se prépare.'
        : isSurvivalTurn
        ? 'Dernier souffle.'
        : selectedHeroCombatPower
        ? `${selectedHeroCombatPower.name || 'Pouvoir'} est prêt.`
        : 'À toi de jouer.')
  );
  const canChooseHeroAction = !isEnded && !isEnemyTurn && !isSurvivalTurn && !isHeroDefeated && !isCombatEffectLocked;
  const handleCombatExit = () => {
    if (isEnded) {
      closeHeroCombat?.();
      return;
    }
    if (!isEnemyTurn && !isSurvivalTurn && !heroCombatRolling && !heroCombatCharging && !isCombatEffectLocked && attemptEscapeHeroCombat) {
      attemptEscapeHeroCombat();
    }
  };
  const combatActionHandler = (rawRoll) => (
    isSurvivalTurn
      ? attemptSurvivalHeroCombat?.({ rawRoll })
      : isEnemyTurn
      ? rollActiveEnemyCombat?.({ rawRoll })
      : attackActiveHeroCombat?.(selectedHeroCombatPower?.id || '', { rawRoll })
  );
  const combatActionDisabled = isEnded
    || (!isSurvivalTurn && isHeroDefeated)
    || isCombatEffectLocked
    || (isSurvivalTurn ? !attemptSurvivalHeroCombat : isEnemyTurn ? !rollActiveEnemyCombat : !attackActiveHeroCombat)
    || (!isEnemyTurn && !isSurvivalTurn && (selectedHeroCombatPowerMissing || selectedHeroCombatManaUnavailable));
  const clearHeroCombatChargeFrame = () => {
    if (heroCombatChargeFrameRef.current) {
      window.cancelAnimationFrame(heroCombatChargeFrameRef.current);
      heroCombatChargeFrameRef.current = 0;
    }
  };
  const updateHeroCombatCharge = () => {
    if (!heroCombatChargingRef.current) return;
    const elapsed = window.performance.now() - heroCombatChargeStartRef.current;
    const nextCharge = Math.max(0, Math.min(1, elapsed / COMBAT_D20_CHARGE_MAX_MS));
    setHeroCombatCharge(nextCharge);
    heroCombatChargeFrameRef.current = window.requestAnimationFrame(updateHeroCombatCharge);
  };
  const finishHeroCombatRoll = () => {
    if (heroCombatRollSettledRef.current) return;
    heroCombatRollSettledRef.current = true;
    if (heroCombatRollIntervalRef.current) {
      window.clearInterval(heroCombatRollIntervalRef.current);
      heroCombatRollIntervalRef.current = null;
    }
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
      heroCombatAutoStopTimeoutRef.current = null;
    }
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const finalRaw = Math.max(1, Math.min(sides, Number(heroCombatPendingRollRef.current || heroCombatDieFaceRef.current) || 1));
    heroCombatPendingRollRef.current = null;
    setHeroCombatRolling(false);
    setHeroCombatCharging(false);
    setHeroCombatCharge(0);
    combatActionHandler(finalRaw);
  };
  const cancelHeroCombatCharge = () => {
    heroCombatChargingRef.current = false;
    heroCombatPendingRollRef.current = null;
    clearHeroCombatChargeFrame();
    setHeroCombatCharging(false);
    setHeroCombatCharge(0);
  };
  const startHeroCombatCharge = () => {
    if (combatActionDisabled || heroCombatRolling || heroCombatCharging || isCombatEffectLocked) return;
    if (heroCombatRollIntervalRef.current) {
      window.clearInterval(heroCombatRollIntervalRef.current);
      heroCombatRollIntervalRef.current = null;
    }
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
      heroCombatAutoStopTimeoutRef.current = null;
    }
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const initialFace = Number(lastCombatRoll?.raw) || Math.floor(Math.random() * sides) + 1;
    heroCombatPendingRollRef.current = null;
    heroCombatDieFaceRef.current = Math.max(1, Math.min(sides, initialFace));
    setHeroCombatDieFace(heroCombatDieFaceRef.current);
    setHeroCombatCharge(0);
    setHeroCombatLaunchForce(.35);
    setHeroCombatCharging(true);
    heroCombatChargingRef.current = true;
    heroCombatChargeStartRef.current = window.performance.now();
    clearHeroCombatChargeFrame();
    heroCombatChargeFrameRef.current = window.requestAnimationFrame(updateHeroCombatCharge);
  };
  const launchHeroCombatRoll = () => {
    if (!heroCombatChargingRef.current || heroCombatRolling) return;
    const elapsed = window.performance.now() - heroCombatChargeStartRef.current;
    const force = Math.max(.18, Math.min(1, elapsed / COMBAT_D20_CHARGE_MAX_MS));
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const finalFace = Math.floor(Math.random() * sides) + 1;
    heroCombatChargingRef.current = false;
    clearHeroCombatChargeFrame();
    setHeroCombatCharging(false);
    setHeroCombatCharge(force);
    setHeroCombatLaunchForce(force);
    setHeroCombatLaunchId((current) => current + 1);
    heroCombatRollSettledRef.current = false;
    heroCombatPendingRollRef.current = finalFace;
    heroCombatDieFaceRef.current = finalFace;
    setHeroCombatDieFace(finalFace);
    setHeroCombatRolling(true);
    if (heroCombatRollIntervalRef.current) window.clearInterval(heroCombatRollIntervalRef.current);
    heroCombatRollIntervalRef.current = null;
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
    }
    heroCombatAutoStopTimeoutRef.current = window.setTimeout(() => {
      finishHeroCombatRoll();
    }, Math.round(7600 + (force * 3200)));
  };
  const handleHeroCombatPressStart = (event) => {
    if (event?.button != null && event.button !== 0) return;
    event?.preventDefault?.();
    try {
      if (event?.pointerId != null) event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is only an interaction enhancement.
    }
    startHeroCombatCharge();
  };
  const handleHeroCombatPressEnd = (event) => {
    event?.preventDefault?.();
    try {
      if (event?.pointerId != null) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore browsers that already released capture.
    }
    launchHeroCombatRoll();
  };
  const handleHeroCombatPressCancel = () => {
    cancelHeroCombatCharge();
  };
  const handleHeroCombatKeyDown = (event) => {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
    event.preventDefault();
    startHeroCombatCharge();
  };
  const handleHeroCombatKeyUp = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    launchHeroCombatRoll();
  };
  const displayedCombatDieFace = heroCombatRolling || heroCombatCharging ? heroCombatDieFace : combatRollRawValue || '?';
  const displayedCombatDieResultFace = heroCombatRolling || heroCombatCharging ? heroCombatDieFace : combatRollResultFace;

  return (
    <div className={`hero-combat-overlay hero-combat-overlay--${activeHeroCombat.status || 'active'}${isEnemyTurn ? ' hero-combat-overlay--enemy-turn' : ''}`} style={overlayStyle}>
      <div className="hero-combat-topline">
        <span>{isSurvivalTurn ? 'Survie' : isEnemyTurn ? 'Tour ennemi' : `Tour ${activeHeroCombat.round || 1}`}</span>
        <strong>{enemyLabel}</strong>
        {isEnded ? (
          <button type="button" className="secondary-action compact" onClick={handleCombatExit}>
            {activeHeroCombat.pendingSceneId ? 'Continuer' : 'Revenir a la scene'}
          </button>
        ) : null}
      </div>

      <div className="hero-combat-stage">
        {renderHeroCombatActor(heroMedia, heroLabel, 'hero', {
          health: heroHealth,
          maxHealth: heroMaxHealth,
          mana: heroMana,
          maxMana: heroMaxMana,
        }, combatVisualEffects, {
          initiative: heroInitiative,
          isActive: !isEnemyTurn && !isSurvivalTurn && !isEnded,
          statusEffects: heroStatusEffects,
        })}

        {showDice ? (
          <div className={combatDiceSpotlightClass}>
            <span className="hero-combat-dice-aura" aria-hidden="true" />
            <button
              type="button"
              className={`hero-combat-die-button ${heroCombatCharging ? 'is-charging' : ''} ${heroCombatRolling ? 'is-rolling' : ''} ${showCombatRollResult ? 'has-result' : ''}`}
              onPointerDown={handleHeroCombatPressStart}
              onPointerUp={handleHeroCombatPressEnd}
              onPointerCancel={handleHeroCombatPressCancel}
              onKeyDown={handleHeroCombatKeyDown}
              onKeyUp={handleHeroCombatKeyUp}
              onClick={(event) => event.preventDefault()}
              disabled={combatActionDisabled || heroCombatRolling}
            >
              <span className={`hero-combat-die hero-d20 hero-die-face hero-die-face--${heroDiceSkin} ${heroCombatCharging ? 'is-charging' : ''} ${heroCombatRolling ? 'is-rolling' : ''} ${showCombatRollResult ? 'has-result' : ''}`}>
                <CombatD20Canvas
                  value={displayedCombatDieFace}
                  faceNumber={displayedCombatDieResultFace}
                  rolling={heroCombatRolling}
                  launchForce={heroCombatLaunchForce}
                  launchId={heroCombatLaunchId}
                  onSettle={finishHeroCombatRoll}
                />
                <span className="hero-roll-die-value">{displayedCombatDieFace}</span>
              </span>
            </button>
            {showCombatRollResult ? (
              <>
                <span key={`${combatRollResultKey}-burst`} className="hero-combat-dice-result-burst" aria-hidden="true">
                  {combatRollResultValue}
                </span>
                <span key={`${combatRollResultKey}-trail`} className="hero-combat-dice-impact-trail" aria-hidden="true">
                  {combatRollImpactText ? <span>{combatRollImpactText}</span> : null}
                </span>
              </>
            ) : null}
            <strong>
              <span className="hero-combat-dice-kicker">{heroCombatCharging ? 'Force' : heroCombatRolling ? 'Lancer...' : combatRollKickerLabel}</span>
              {heroCombatCharging ? `${Math.round(heroCombatCharge * 100)}%` : heroCombatRolling ? '...' : showCombatRollResult ? `${combatRollResultValue} total` : heroAdventure.dice?.label || 'De'}
              {showCombatRollResult && combatRollFormula ? <em>{combatRollFormula}</em> : null}
            </strong>
            <small>{isEnded ? 'Combat termine' : isCombatEffectLocked ? 'Impact...' : heroCombatCharging ? 'Relache pour lancer' : heroCombatRolling ? 'Le de roule...' : isEnemyTurn ? 'Maintiens pour la riposte' : isSurvivalTurn ? 'Maintiens Survie' : 'Maintiens pour charger'}</small>
            <span className={`hero-combat-force-meter ${heroCombatCharging ? 'is-charging' : ''} ${heroCombatRolling ? 'is-launched' : ''}`} aria-hidden="true">
              <span style={{ width: `${Math.round((heroCombatCharging ? heroCombatCharge : heroCombatRolling ? heroCombatLaunchForce : 0) * 100)}%` }} />
            </span>
          </div>
        ) : null}

        {renderHeroCombatActor(enemyMedia, enemyLabel, 'enemy', {
          health: enemyHealth,
          maxHealth: enemyMaxHealth,
          mana: enemyMana,
          maxMana: enemyMaxMana,
        }, combatVisualEffects, {
          initiative: enemyInitiative,
          isActive: isEnemyTurn && !isEnded,
          statusEffects: enemyStatusEffects,
        })}
      </div>

      <div className="hero-combat-log">
        <div className="hero-combat-journal" role="status" aria-live="polite">
          <span className="hero-combat-journal-kicker">Journal</span>
          <strong className="hero-combat-journal-headline">{combatJournalHeadline}</strong>
          {combatJournalDetail ? <p>{combatJournalDetail}</p> : null}
          {combatJournalHistory.length ? (
            <details className="hero-combat-journal-history">
              <summary>Historique ({combatJournalHistory.length})</summary>
              <ol>
                {[...combatJournalHistory].reverse().map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
        {isSurvivalTurn && !isEnded ? (
          <div className="hero-combat-survival-card" role="status" aria-live="polite">
            <strong>Survie</strong>
            <span>Lance le de pour tenter de rester a 1 PV.</span>
          </div>
        ) : null}
        {!isEnemyTurn && !isSurvivalTurn && !isEnded ? (
          <div className="hero-combat-action-panel">
            <div className="hero-combat-action-bar" aria-label="Barre d'action du heros">
              <button
                type="button"
                className={`hero-combat-action-button ${!selectedHeroCombatPower ? 'active' : ''}`}
                onClick={() => setSelectedHeroCombatPowerId('')}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || combatManaCost > heroMana}
                title={combatManaCost > heroMana ? 'Mana insuffisante' : 'Attaque normale'}
              >
                <Swords size={17} aria-hidden="true" />
                <strong>Attaque</strong>
                <span>{formatManaCost(combatManaCost)} · {formatDamageEstimate(estimatePowerDamage(null))}</span>
              </button>
              <button
                type="button"
                className={`hero-combat-action-button ${selectedHeroCombatPower && !isSelectedDefensePower ? 'active' : ''}`}
                onClick={() => firstAvailablePower && setSelectedHeroCombatPowerId(firstAvailablePower.id)}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || !attackPowers.length || !firstAvailablePower}
                title={!attackPowers.length ? 'Aucun pouvoir offensif' : !firstAvailablePower ? 'Mana insuffisante' : 'Choisir un pouvoir'}
              >
                <Sparkles size={17} aria-hidden="true" />
                <strong>Pouvoir</strong>
                <span>{attackPowers.length ? (firstAvailablePower ? `${formatManaCost(combatManaCost + Math.max(0, Number(firstAvailablePower.manaCost) || 0))} · ${describePowerEffect(firstAvailablePower)}` : 'Mana insuffisante') : 'Aucun pouvoir'}</span>
              </button>
              <button
                type="button"
                className="hero-combat-action-button"
                onClick={() => firstUsableCombatItem && openInventoryItem?.(firstUsableCombatItem.id)}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || !firstUsableCombatItem}
                title={!firstUsableCombatItem ? 'Aucun objet utile maintenant' : `Utiliser ${firstUsableCombatItem.name || 'objet'}`}
              >
                <Package size={17} aria-hidden="true" />
                <strong>Objet</strong>
                <span>{firstUsableCombatItem ? `${firstUsableCombatItem.name || 'Objet'} · ${describeCombatItem(firstUsableCombatItem)}` : 'Aucun objet'}</span>
              </button>
              <button
                type="button"
                className={`hero-combat-action-button ${isSelectedDefensePower ? 'active' : ''}`}
                onClick={() => firstDefensePower && setSelectedHeroCombatPowerId(firstDefensePower.id)}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging || !defensePowers.length || !firstDefensePower}
                title={!defensePowers.length ? 'Aucun pouvoir de bouclier' : !firstDefensePower ? 'Mana insuffisante' : 'Choisir une défense'}
              >
                <Shield size={17} aria-hidden="true" />
                <strong>Défense</strong>
                <span>{defensePowers.length ? (firstDefensePower ? `${formatManaCost(combatManaCost + Math.max(0, Number(firstDefensePower.manaCost) || 0))} · ${describePowerEffect(firstDefensePower)}` : 'Mana insuffisante') : 'Aucun bouclier'}</span>
              </button>
              <button
                type="button"
                className="hero-combat-action-button is-danger"
                onClick={handleCombatExit}
                disabled={!canChooseHeroAction || heroCombatRolling || heroCombatCharging}
                title="Tenter de fuir"
              >
                <DoorOpen size={17} aria-hidden="true" />
                <strong>Fuir</strong>
                <span>Ruse vs {enemyCunning}</span>
              </button>
            </div>
            {heroPowers.length ? (
              <div className="hero-combat-power-strip" aria-label="Pouvoirs du heros">
                {heroPowers.map((power) => {
                  const manaCost = Math.max(0, Number(power.manaCost) || 0);
                  const totalManaCost = combatManaCost + manaCost;
                  const disabled = !canChooseHeroAction || totalManaCost > heroMana;
                  return (
                    <button
                      key={power.id}
                      type="button"
                      className={`hero-combat-power-chip ${selectedHeroCombatPowerId === power.id ? 'active' : ''} ${power.statusType === 'shield' ? 'is-defense' : ''}`}
                      onClick={() => setSelectedHeroCombatPowerId(power.id)}
                      disabled={disabled || heroCombatRolling || heroCombatCharging || isCombatEffectLocked}
                      title={disabled && totalManaCost > heroMana ? 'Mana insuffisante' : describePowerEffect(power)}
                    >
                      <strong>{power.name || 'Pouvoir'}</strong>
                      <span>{formatManaCost(totalManaCost)} · {describePowerEffect(power)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="inline-actions">
          <button
            type="button"
            className={combatPrimaryActionClass}
            onPointerDown={showDice ? handleHeroCombatPressStart : undefined}
            onPointerUp={showDice ? handleHeroCombatPressEnd : undefined}
            onPointerCancel={showDice ? handleHeroCombatPressCancel : undefined}
            onKeyDown={showDice ? handleHeroCombatKeyDown : undefined}
            onKeyUp={showDice ? handleHeroCombatKeyUp : undefined}
            onClick={showDice ? (event) => event.preventDefault() : () => combatActionHandler()}
            disabled={combatActionDisabled || heroCombatRolling}
          >
            <CombatPrimaryIcon size={18} aria-hidden="true" />
            <span>{combatPrimaryActionLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
