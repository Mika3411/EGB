import { useEffect, useMemo, useState } from 'react';
import { Clapperboard, Image as ImageIcon, Swords, Upload, Volume2 } from 'lucide-react';
import Anime2DPreview, { normalizeAnime2dSpec, readAnime2dJsonFile } from './Anime2DPreview.jsx';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import HelpLabel from './forms/HelpLabel.jsx';
import NumberInput from './forms/NumberInput.jsx';
import {
  clampDecimal,
  clampNumber,
  estimateCombatBalance,
  getCombatSimulationStats,
  getEntryValue,
  normalizeHeroAttackType,
  normalizePowerType,
} from '../lib/combatEngine.js';
import {
  COMBAT_EFFECT_MEDIA_TYPES,
  COMBAT_EFFECT_SLOTS,
  COMBAT_VISUAL_EFFECT_OPTIONS,
  COMBAT_VISUAL_EFFECT_TYPES,
  COMBAT_MEDIA_TYPES,
  DEFAULT_COMBAT_SETTINGS,
  getCombatEffectFieldBase,
} from '../lib/combatDefaults.js';

const COMBAT_EFFECT_EDITOR_SLOTS = [
  { actor: 'hero', outcome: 'hit', title: 'Héros touché', help: "Effet joué sur le héros quand il reçoit des dégâts et reste en vie." },
  { actor: 'hero', outcome: 'death', title: 'Héros vaincu', help: "Effet joué sur le héros quand il tombe à 0 PV." },
  { actor: 'enemy', outcome: 'hit', title: 'Ennemi touché', help: "Effet joué sur l'ennemi quand il reçoit des dégâts et reste en vie." },
  { actor: 'enemy', outcome: 'death', title: 'Ennemi vaincu', help: "Effet joué sur l'ennemi quand il tombe à 0 PV." },
];
const HERO_ATTACK_TYPES = [
  { id: 'physical', label: 'Physique' },
  { id: 'water', label: 'Eau' },
  { id: 'earth', label: 'Terre' },
  { id: 'fire', label: 'Feu' },
  { id: 'lightning', label: 'Foudre' },
];
const POWER_TYPES = HERO_ATTACK_TYPES.filter((type) => type.id !== 'physical');
const ENEMY_AI_MODES = [
  { id: 'tactical', label: 'Tactique' },
  { id: 'random', label: 'Aléatoire' },
];
const ENTRY_BOOLEAN_DEFAULT = 'default';
const RESISTANCE_FIELDS = [
  { id: 'water', label: 'Eau', field: 'combatEnemyResistanceWater' },
  { id: 'earth', label: 'Terre', field: 'combatEnemyResistanceEarth' },
  { id: 'fire', label: 'Feu', field: 'combatEnemyResistanceFire' },
  { id: 'lightning', label: 'Foudre', field: 'combatEnemyResistanceLightning' },
];
const BALANCE_SIMULATION_ITERATIONS = 300;

const formatBalanceNumber = (value, maximumFractionDigits = 1) => (
  Number.isFinite(value)
    ? value.toLocaleString('fr-FR', { maximumFractionDigits })
    : '0'
);

const formatBalancePercent = (value) => (
  `${formatBalanceNumber(value, 0)}%`
);

const getBalanceTone = (balance) => {
  if (!balance || balance.blockedCount > 0) return 'blocked';
  if (balance.winChance < 35) return 'danger';
  if (balance.winChance > 75) return 'easy';
  return 'balanced';
};

const getBalanceVerdict = (balance) => {
  const tone = getBalanceTone(balance);
  if (tone === 'blocked') return 'Risque de blocage';
  if (tone === 'danger') return 'Très difficile';
  if (tone === 'easy') return 'Très favorable';
  return 'Équilibré';
};

const normalizeMediaType = (value) => (COMBAT_MEDIA_TYPES.has(value) ? value : 'image');
const normalizeEffectMediaType = (value) => (COMBAT_EFFECT_MEDIA_TYPES.has(value) ? value : 'none');
const normalizeCombatVisualEffect = (value) => (COMBAT_VISUAL_EFFECT_TYPES.has(value) ? value : 'none');
const normalizeEnemyAiMode = (value) => (
  ENEMY_AI_MODES.some((mode) => mode.id === value) ? value : DEFAULT_COMBAT_SETTINGS.enemyAiMode
);
const getEnemyAiModeLabel = (value) => (
  ENEMY_AI_MODES.find((mode) => mode.id === normalizeEnemyAiMode(value))?.label || 'Tactique'
);
const hasOwnEntryValue = (entry, field) => (
  Object.prototype.hasOwnProperty.call(entry || {}, field)
  && entry?.[field] !== undefined
  && entry?.[field] !== null
);
const getEntryBooleanOverrideValue = (entry, field) => {
  if (!hasOwnEntryValue(entry, field) || entry[field] === '') return ENTRY_BOOLEAN_DEFAULT;
  return entry[field] === false ? 'false' : 'true';
};
const getActorEntryPrefix = (actor) => (actor === 'hero' ? 'combatHero' : 'combatEnemy');
const getActorMediaOverrideFields = (actor) => {
  const prefix = getActorEntryPrefix(actor);
  return [
    `${prefix}MediaType`,
    `${prefix}ImageData`,
    `${prefix}ImageName`,
    `${prefix}Anime2dSpec`,
    `${prefix}Anime2dName`,
  ];
};
const hasActorMediaOverride = (entry, actor) => (
  getActorMediaOverrideFields(actor).some((field) => hasOwnEntryValue(entry, field) && entry[field] !== '')
);
const normalizeEffectMediaSettings = (combat = {}, actor, outcome) => {
  const base = getCombatEffectFieldBase(actor, outcome);
  return {
    [`${base}MediaType`]: normalizeEffectMediaType(combat?.[`${base}MediaType`]),
    [`${base}ImageData`]: combat?.[`${base}ImageData`] || '',
    [`${base}ImageName`]: combat?.[`${base}ImageName`] || '',
    [`${base}Anime2dSpec`]: combat?.[`${base}Anime2dSpec`] && typeof combat[`${base}Anime2dSpec`] === 'object'
      ? combat[`${base}Anime2dSpec`]
      : null,
    [`${base}Anime2dName`]: combat?.[`${base}Anime2dName`] || '',
    [`${base}VideoData`]: combat?.[`${base}VideoData`] || '',
    [`${base}VideoName`]: combat?.[`${base}VideoName`] || '',
    [`${base}VisualEffect`]: normalizeCombatVisualEffect(combat?.[`${base}VisualEffect`]),
    [`${base}AudioData`]: combat?.[`${base}AudioData`] || '',
    [`${base}AudioName`]: combat?.[`${base}AudioName`] || '',
  };
};

const normalizeCombatSettings = (combat = {}) => ({
  ...DEFAULT_COMBAT_SETTINGS,
  ...(combat && typeof combat === 'object' ? combat : {}),
  turnMode: combat?.turnMode !== false,
  showDice: combat?.showDice !== false,
  enemyAutoTurn: false,
  backgroundImageData: combat?.backgroundImageData || '',
  backgroundImageName: combat?.backgroundImageName || '',
  heroMediaType: normalizeMediaType(combat?.heroMediaType),
  heroImageData: combat?.heroImageData || '',
  heroImageName: combat?.heroImageName || '',
  heroAnime2dSpec: combat?.heroAnime2dSpec && typeof combat.heroAnime2dSpec === 'object' ? combat.heroAnime2dSpec : null,
  heroAnime2dName: combat?.heroAnime2dName || '',
  enemyMediaType: normalizeMediaType(combat?.enemyMediaType),
  enemyImageData: combat?.enemyImageData || '',
  enemyImageName: combat?.enemyImageName || '',
  enemyAnime2dSpec: combat?.enemyAnime2dSpec && typeof combat.enemyAnime2dSpec === 'object' ? combat.enemyAnime2dSpec : null,
  enemyAnime2dName: combat?.enemyAnime2dName || '',
  enemyName: combat?.enemyName || DEFAULT_COMBAT_SETTINGS.enemyName,
  heroAttackType: normalizeHeroAttackType(combat?.heroAttackType),
  heroDieDamagePercent: clampNumber(combat?.heroDieDamagePercent, DEFAULT_COMBAT_SETTINGS.heroDieDamagePercent, 0, 999),
  enemyInitiative: clampNumber(combat?.enemyInitiative, DEFAULT_COMBAT_SETTINGS.enemyInitiative, -999, 999),
  enemyStrength: clampNumber(combat?.enemyStrength, DEFAULT_COMBAT_SETTINGS.enemyStrength, 0, 999),
  enemyDieDamagePercent: clampNumber(combat?.enemyDieDamagePercent, DEFAULT_COMBAT_SETTINGS.enemyDieDamagePercent, 0, 999),
  enemyCunning: clampNumber(combat?.enemyCunning, DEFAULT_COMBAT_SETTINGS.enemyCunning, 1, 999),
  enemyChaos: clampNumber(combat?.enemyChaos, DEFAULT_COMBAT_SETTINGS.enemyChaos, 1, 999),
  enemyArmor: clampNumber(combat?.enemyArmor, DEFAULT_COMBAT_SETTINGS.enemyArmor, 0, 999),
  enemyDodgeChance: clampNumber(combat?.enemyDodgeChance, DEFAULT_COMBAT_SETTINGS.enemyDodgeChance, 0, 100),
  enemyMaxMana: clampNumber(combat?.enemyMaxMana, DEFAULT_COMBAT_SETTINGS.enemyMaxMana, 0, 999),
  enemyPowerName: combat?.enemyPowerName || DEFAULT_COMBAT_SETTINGS.enemyPowerName,
  enemyPowerType: normalizePowerType(combat?.enemyPowerType),
  enemyPowerManaCost: clampNumber(combat?.enemyPowerManaCost, DEFAULT_COMBAT_SETTINGS.enemyPowerManaCost, 0, 999),
  enemyPowerDamage: clampNumber(combat?.enemyPowerDamage, DEFAULT_COMBAT_SETTINGS.enemyPowerDamage, 0, 999),
  enemyPowerUsageChance: clampNumber(combat?.enemyPowerUsageChance, DEFAULT_COMBAT_SETTINGS.enemyPowerUsageChance, 0, 100),
  enemyAiMode: normalizeEnemyAiMode(combat?.enemyAiMode),
  enemyCriticalChance: clampNumber(combat?.enemyCriticalChance, DEFAULT_COMBAT_SETTINGS.enemyCriticalChance, 0, 100),
  enemyCriticalMultiplier: clampDecimal(combat?.enemyCriticalMultiplier, DEFAULT_COMBAT_SETTINGS.enemyCriticalMultiplier, 1, 20),
  enemyResistanceWater: clampNumber(combat?.enemyResistanceWater, 0, 0, 100),
  enemyResistanceEarth: clampNumber(combat?.enemyResistanceEarth, 0, 0, 100),
  enemyResistanceFire: clampNumber(combat?.enemyResistanceFire, 0, 0, 100),
  enemyResistanceLightning: clampNumber(combat?.enemyResistanceLightning, 0, 0, 100),
  ...COMBAT_EFFECT_SLOTS.reduce((settings, slot) => ({
    ...settings,
    ...normalizeEffectMediaSettings(combat, slot.actor, slot.outcome),
  }), {}),
});

const getSourceId = (type, sceneId, hotspotId, nodeId = '', replyId = '') => (
  [type, sceneId, hotspotId, nodeId, replyId].filter(Boolean).join(':')
);

const collectCombatSources = (project = {}) => {
  const sources = [];
  (project.scenes || []).forEach((scene) => {
    (scene.hotspots || []).forEach((hotspot) => {
      if ((hotspot.actionType || '') === 'hero_combat') {
        sources.push({
          id: getSourceId('hotspot', scene.id, hotspot.id),
          type: 'hotspot',
          sceneId: scene.id,
          hotspotId: hotspot.id,
          entry: hotspot,
        });
      }

      (hotspot.conversation?.nodes || []).forEach((node) => {
        (node.replies || []).forEach((reply) => {
          if ((reply.actionType || '') !== 'hero_combat') return;
          sources.push({
            id: getSourceId('reply', scene.id, hotspot.id, node.id, reply.id),
            type: 'reply',
            sceneId: scene.id,
            hotspotId: hotspot.id,
            nodeId: node.id,
            replyId: reply.id,
            node,
            entry: reply,
          });
        });
      });
    });
  });
  return sources;
};

const getCombatTarget = (draft, source) => {
  const scene = (draft.scenes || []).find((entry) => entry.id === source?.sceneId);
  const hotspot = scene?.hotspots?.find((entry) => entry.id === source?.hotspotId);
  if (!hotspot) return null;
  if (source.type === 'hotspot') return hotspot;
  const node = (hotspot.conversation?.nodes || []).find((entry) => entry.id === source.nodeId);
  return node?.replies?.find((entry) => entry.id === source.replyId) || null;
};

const getCombatBackground = (entry, combat) => (
  entry?.combatBackgroundImageData || combat.backgroundImageData || ''
);

const getActorMedia = (entry, combat, actor, fallbackImage = '') => {
  const entryPrefix = actor === 'hero' ? 'combatHero' : 'combatEnemy';
  const globalPrefix = actor;
  const mediaType = normalizeMediaType(getEntryValue(entry, `${entryPrefix}MediaType`, combat[`${globalPrefix}MediaType`]));
  return {
    mediaType,
    imageData: entry?.[`${entryPrefix}ImageData`] || combat[`${globalPrefix}ImageData`] || fallbackImage || '',
    imageName: entry?.[`${entryPrefix}ImageName`] || combat[`${globalPrefix}ImageName`] || '',
    anime2dSpec: entry?.[`${entryPrefix}Anime2dSpec`] || combat[`${globalPrefix}Anime2dSpec`] || null,
    anime2dName: entry?.[`${entryPrefix}Anime2dName`] || combat[`${globalPrefix}Anime2dName`] || '',
  };
};

const getEntryActorMedia = (entry, actor, inheritedMedia = {}) => {
  const entryPrefix = getActorEntryPrefix(actor);
  return {
    mediaType: normalizeMediaType(getEntryValue(entry, `${entryPrefix}MediaType`, inheritedMedia.mediaType)),
    imageData: entry?.[`${entryPrefix}ImageData`] || '',
    imageName: entry?.[`${entryPrefix}ImageName`] || '',
    anime2dSpec: entry?.[`${entryPrefix}Anime2dSpec`] || null,
    anime2dName: entry?.[`${entryPrefix}Anime2dName`] || '',
  };
};

const getEffectMedia = (combat, actor, outcome) => {
  const base = getCombatEffectFieldBase(actor, outcome);
  return {
    mediaType: normalizeEffectMediaType(combat?.[`${base}MediaType`]),
    imageData: combat?.[`${base}ImageData`] || '',
    imageName: combat?.[`${base}ImageName`] || '',
    anime2dSpec: combat?.[`${base}Anime2dSpec`] || null,
    anime2dName: combat?.[`${base}Anime2dName`] || '',
    videoData: combat?.[`${base}VideoData`] || '',
    videoName: combat?.[`${base}VideoName`] || '',
    visualEffect: normalizeCombatVisualEffect(combat?.[`${base}VisualEffect`]),
    audioData: combat?.[`${base}AudioData`] || '',
    audioName: combat?.[`${base}AudioName`] || '',
  };
};

function CombatActorPreview({ media, label, project, vitals = null }) {
  const hasAnime = media.mediaType === 'anime2d' && media.anime2dSpec;
  const hasImage = media.mediaType === 'image' && media.imageData;
  const maxHealth = Math.max(1, Number(vitals?.maxHealth) || 1);
  const health = Math.max(0, Math.min(maxHealth, Number(vitals?.health) || 0));
  const maxMana = Math.max(0, Number(vitals?.maxMana) || 0);
  const mana = Math.max(0, Math.min(maxMana, Number(vitals?.mana) || 0));
  const healthPercent = (health / maxHealth) * 100;
  const manaPercent = maxMana > 0 ? (mana / maxMana) * 100 : 0;

  return (
    <div className={`combat-actor-preview ${hasAnime ? 'has-anime' : hasImage ? 'has-image' : 'is-empty'}`}>
      {vitals ? (
        <div className="combat-actor-bars" aria-label={`Jauges ${label}`}>
          <div className="combat-actor-bar combat-actor-bar--health">
            <span>PV</span>
            <strong>{health}/{maxHealth}</strong>
            <i style={{ width: `${healthPercent}%` }} />
          </div>
          <div className="combat-actor-bar combat-actor-bar--mana">
            <span>Mana</span>
            <strong>{mana}/{maxMana}</strong>
            <i style={{ width: `${manaPercent}%` }} />
          </div>
        </div>
      ) : null}
      {hasAnime ? (
        <Anime2DPreview spec={media.anime2dSpec} project={project} />
      ) : hasImage ? (
        <img src={media.imageData} alt={label} />
      ) : (
        <span>{label.slice(0, 1).toUpperCase()}</span>
      )}
      <strong>{label}</strong>
    </div>
  );
}

function MediaSlotEditor({
  title,
  help,
  mediaType,
  imageData,
  imageName,
  anime2dSpec,
  anime2dName,
  handleUpload,
  mediaLibrary,
  project,
  currentAnimeSpec,
  currentAnimeName,
  onMediaTypeChange,
  onImageSelect,
  onImageClear,
  onAnimeSelect,
  onAnimeClear,
  onJsonError,
}) {
  const readJson = async (file) => {
    if (!file) return;
    try {
      const spec = await readAnime2dJsonFile(file);
      onJsonError('');
      onAnimeSelect(spec, file.name || 'animation-2d.json');
    } catch (error) {
      onJsonError(error?.message || 'JSON 2D Anime invalide.');
    }
  };

  return (
    <div className="combat-media-slot">
      <div className="combat-media-head">
        <HelpLabel help={help}>{title}</HelpLabel>
        <select value={mediaType} onChange={(event) => onMediaTypeChange(event.target.value)}>
          <option value="image">Image</option>
          <option value="anime2d">Animation 2D Anime</option>
        </select>
      </div>
      <div className="combat-media-preview">
        {mediaType === 'anime2d' && anime2dSpec ? (
          <Anime2DPreview spec={anime2dSpec} project={project} />
        ) : mediaType === 'image' && imageData ? (
          <img src={imageData} alt={title} />
        ) : (
          <span>{mediaType === 'anime2d' ? 'JSON 2D' : 'Image'}</span>
        )}
      </div>
      {mediaType === 'image' ? (
        <div className="inline-actions">
          <MediaSourcePicker
            accept="image/*"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={onImageSelect}
          >
            <ImageIcon size={15} aria-hidden="true" /> Choisir
          </MediaSourcePicker>
          {imageData ? (
            <button type="button" className="secondary-action" onClick={onImageClear}>
              Retirer
            </button>
          ) : null}
        </div>
      ) : (
        <div className="inline-actions">
          <label className="button like secondary-action">
            <Upload size={15} aria-hidden="true" /> Importer JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                readJson(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {currentAnimeSpec ? (
            <button
              type="button"
              className="secondary-action"
              onClick={() => onAnimeSelect(currentAnimeSpec, currentAnimeName || 'Animation 2D courante')}
            >
              <Clapperboard size={15} aria-hidden="true" /> Utiliser courante
            </button>
          ) : null}
          {anime2dSpec ? (
            <button type="button" className="secondary-action" onClick={onAnimeClear}>
              Retirer
            </button>
          ) : null}
        </div>
      )}
      <small>{mediaType === 'anime2d' ? (anime2dName || 'Aucune animation JSON') : (imageName || 'Aucune image')}</small>
    </div>
  );
}

function CombatBooleanOverrideSelect({
  label,
  help,
  value,
  fallbackLabel,
  trueLabel,
  falseLabel,
  onChange,
}) {
  return (
    <div>
      <HelpLabel help={help}>{label}</HelpLabel>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={ENTRY_BOOLEAN_DEFAULT}>Défaut ({fallbackLabel})</option>
        <option value="true">{trueLabel}</option>
        <option value="false">{falseLabel}</option>
      </select>
    </div>
  );
}

function CombatEntryMediaSlotEditor({
  title,
  help,
  media,
  inheritedMedia,
  hasOverride,
  inheritedLabel,
  handleUpload,
  mediaLibrary,
  project,
  currentAnimeSpec,
  currentAnimeName,
  onMediaTypeChange,
  onImageSelect,
  onImageClear,
  onAnimeSelect,
  onAnimeClear,
  onClearOverride,
  onJsonError,
}) {
  const readJson = async (file) => {
    if (!file) return;
    try {
      const spec = await readAnime2dJsonFile(file);
      onJsonError('');
      onAnimeSelect(spec, file.name || 'animation-2d.json');
    } catch (error) {
      onJsonError(error?.message || 'JSON 2D Anime invalide.');
    }
  };

  const previewMedia = hasOverride ? media : inheritedMedia;
  const hasAnime = previewMedia.mediaType === 'anime2d' && previewMedia.anime2dSpec;
  const hasImage = previewMedia.mediaType === 'image' && previewMedia.imageData;
  const customName = media.mediaType === 'anime2d' ? media.anime2dName : media.imageName;
  const inheritedName = inheritedMedia.mediaType === 'anime2d' ? inheritedMedia.anime2dName : inheritedMedia.imageName;
  const currentName = hasOverride ? customName : inheritedName;
  const clearOverrideButton = hasOverride ? (
    <button type="button" className="secondary-action" onClick={onClearOverride}>
      Revenir au défaut
    </button>
  ) : null;

  return (
    <div className={`combat-media-slot ${hasOverride ? 'has-override' : 'is-inherited'}`}>
      <div className="combat-media-head">
        <HelpLabel help={help}>{title}</HelpLabel>
        <select value={media.mediaType} onChange={(event) => onMediaTypeChange(event.target.value)}>
          <option value="image">Image</option>
          <option value="anime2d">Animation 2D Anime</option>
        </select>
      </div>
      <div className="combat-media-preview">
        {hasAnime ? (
          <Anime2DPreview spec={previewMedia.anime2dSpec} project={project} />
        ) : hasImage ? (
          <img src={previewMedia.imageData} alt={title} />
        ) : (
          <span>{previewMedia.mediaType === 'anime2d' ? 'JSON 2D' : 'Image'}</span>
        )}
        {!hasOverride && (hasAnime || hasImage) ? <em className="combat-media-inherited-badge">Défaut</em> : null}
      </div>
      {media.mediaType === 'image' ? (
        <div className="inline-actions">
          <MediaSourcePicker
            accept="image/*"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={onImageSelect}
          >
            <ImageIcon size={15} aria-hidden="true" /> Choisir
          </MediaSourcePicker>
          {media.imageData ? (
            <button type="button" className="secondary-action" onClick={onImageClear}>
              Retirer
            </button>
          ) : null}
          {clearOverrideButton}
        </div>
      ) : (
        <div className="inline-actions">
          <label className="button like secondary-action">
            <Upload size={15} aria-hidden="true" /> Importer JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                readJson(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {currentAnimeSpec ? (
            <button
              type="button"
              className="secondary-action"
              onClick={() => onAnimeSelect(currentAnimeSpec, currentAnimeName || 'Animation 2D courante')}
            >
              <Clapperboard size={15} aria-hidden="true" /> Utiliser courante
            </button>
          ) : null}
          {media.anime2dSpec ? (
            <button type="button" className="secondary-action" onClick={onAnimeClear}>
              Retirer
            </button>
          ) : null}
          {clearOverrideButton}
        </div>
      )}
      <small>
        {hasOverride
          ? (currentName || 'Aucun média personnalisé')
          : `${inheritedLabel}: ${currentName || 'aucun média'}`}
      </small>
    </div>
  );
}

function EffectMediaSlotEditor({
  title,
  help,
  media,
  handleUpload,
  mediaLibrary,
  project,
  currentAnimeSpec,
  currentAnimeName,
  onMediaTypeChange,
  onImageSelect,
  onImageClear,
  onAnimeSelect,
  onAnimeClear,
  onVideoSelect,
  onVideoClear,
  onVisualEffectChange,
  onAudioSelect,
  onAudioClear,
  onJsonError,
}) {
  const readJson = async (file) => {
    if (!file) return;
    try {
      const spec = await readAnime2dJsonFile(file);
      onJsonError('');
      onAnimeSelect(spec, file.name || 'animation-impact.json');
    } catch (error) {
      onJsonError(error?.message || 'JSON 2D Anime invalide.');
    }
  };

  const visualMediaName = media.mediaType === 'image'
    ? media.imageName
    : media.mediaType === 'anime2d'
      ? media.anime2dName
      : media.mediaType === 'video'
        ? media.videoName
        : media.mediaType === 'visual'
          ? COMBAT_VISUAL_EFFECT_OPTIONS.find((option) => option.id === media.visualEffect)?.label
          : '';
  const mediaName = [
    visualMediaName,
    media.audioName ? `Son: ${media.audioName}` : '',
  ].filter(Boolean).join(' - ');

  return (
    <div className="combat-effect-media-slot">
      <div className="combat-media-head">
        <HelpLabel help={help}>{title}</HelpLabel>
        <select value={media.mediaType} onChange={(event) => onMediaTypeChange(event.target.value)}>
          <option value="none">Aucun</option>
          <option value="visual">Animation visuelle</option>
          <option value="image">Image</option>
          <option value="anime2d">Animation 2D Anime</option>
          <option value="video">Video courte</option>
        </select>
      </div>
      <div className={`combat-media-preview combat-media-preview--effect ${media.mediaType === 'none' ? 'is-empty' : ''}`}>
        {media.mediaType === 'anime2d' && media.anime2dSpec ? (
          <Anime2DPreview spec={media.anime2dSpec} project={project} />
        ) : media.mediaType === 'image' && media.imageData ? (
          <img src={media.imageData} alt={title} />
        ) : media.mediaType === 'video' && media.videoData ? (
          <video src={media.videoData} muted playsInline autoPlay loop />
        ) : media.mediaType === 'visual' ? (
          <span className={`combat-visual-effect-preview combat-visual-effect-preview--${media.visualEffect || 'none'}`}>
            {COMBAT_VISUAL_EFFECT_OPTIONS.find((option) => option.id === media.visualEffect)?.label || 'Aucune'}
          </span>
        ) : (
        <span>{media.mediaType === 'none' ? (media.audioData ? 'Son configuré' : 'Aucun média') : 'À choisir'}</span>
        )}
      </div>

      {media.mediaType === 'visual' ? (
        <div>
          <HelpLabel help="Animation visuelle jouée directement sur le personnage touché. Elle ne nécessite pas d'image ou de vidéo.">Animation</HelpLabel>
          <select value={media.visualEffect || 'none'} onChange={(event) => onVisualEffectChange(event.target.value)}>
            {COMBAT_VISUAL_EFFECT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {media.mediaType === 'image' ? (
        <div className="inline-actions">
          <MediaSourcePicker
            accept="image/*"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={onImageSelect}
          >
            <ImageIcon size={15} aria-hidden="true" /> Choisir
          </MediaSourcePicker>
          {media.imageData ? <button type="button" className="secondary-action" onClick={onImageClear}>Retirer</button> : null}
        </div>
      ) : null}

      {media.mediaType === 'anime2d' ? (
        <div className="inline-actions">
          <label className="button like secondary-action">
            <Upload size={15} aria-hidden="true" /> Importer JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                readJson(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {currentAnimeSpec ? (
            <button
              type="button"
              className="secondary-action"
              onClick={() => onAnimeSelect(currentAnimeSpec, currentAnimeName || 'Animation 2D courante')}
            >
              <Clapperboard size={15} aria-hidden="true" /> Utiliser courante
            </button>
          ) : null}
          {media.anime2dSpec ? <button type="button" className="secondary-action" onClick={onAnimeClear}>Retirer</button> : null}
        </div>
      ) : null}

      {media.mediaType === 'video' ? (
        <div className="inline-actions">
          <MediaSourcePicker
            accept="video/mp4,video/webm,video/ogg"
            handleUpload={handleUpload}
            mediaLibrary={mediaLibrary}
            onSelect={onVideoSelect}
          >
            <Clapperboard size={15} aria-hidden="true" /> Choisir
          </MediaSourcePicker>
          {media.videoData ? <button type="button" className="secondary-action" onClick={onVideoClear}>Retirer</button> : null}
        </div>
      ) : null}

      <div className="inline-actions">
        <MediaSourcePicker
          accept="audio/*"
          handleUpload={handleUpload}
          mediaLibrary={mediaLibrary}
          onSelect={onAudioSelect}
        >
          <Volume2 size={15} aria-hidden="true" /> Choisir un son
        </MediaSourcePicker>
        {media.audioData ? <button type="button" className="secondary-action" onClick={onAudioClear}>Retirer le son</button> : null}
      </div>

        <small>{mediaName || (media.mediaType === 'none' ? 'Effet texte uniquement' : 'Aucun média choisi')}</small>
    </div>
  );
}

export default function CombatTab({
  project,
  patchProject,
  handleUpload,
  mediaLibrary = [],
  getSceneLabel,
  setSelectedSceneId,
  setSelectedHotspotId,
  setTab,
  previewHeroCombat,
}) {
  const combat = useMemo(() => normalizeCombatSettings(project.heroAdventure?.combat), [project.heroAdventure?.combat]);
  const combatSources = useMemo(() => collectCombatSources(project), [project]);
  const [selectedCombatId, setSelectedCombatId] = useState('');
  const [activeCombatPanel, setActiveCombatPanel] = useState('arena');
  const [jsonError, setJsonError] = useState('');
  const selectedSource = combatSources.find((source) => source.id === selectedCombatId) || combatSources[0] || null;
  const selectedEntry = selectedSource?.entry || null;
  const currentAnimeSpec = useMemo(() => normalizeAnime2dSpec(project.anime2dDraft), [project.anime2dDraft]);
  const heroFallbackImage = project.heroAdventure?.hero?.characterImageData || '';
  const previewBackground = getCombatBackground(selectedEntry, combat);
  const previewHeroMedia = getActorMedia(selectedEntry, combat, 'hero', heroFallbackImage);
  const previewEnemyMedia = getActorMedia(selectedEntry, combat, 'enemy');
  const previewEnemyName = selectedEntry?.combatEnemyName || combat.enemyName || 'Adversaire';
  const selectedBackgroundName = selectedEntry?.combatBackgroundImageData
    ? selectedEntry.combatBackgroundImageName || 'Fond personnalisé'
    : combat.backgroundImageName || '';
  const selectedHeroEntryMedia = getEntryActorMedia(selectedEntry, 'hero', previewHeroMedia);
  const selectedEnemyEntryMedia = getEntryActorMedia(selectedEntry, 'enemy', previewEnemyMedia);
  const hasHeroMediaOverride = hasActorMediaOverride(selectedEntry, 'hero');
  const hasEnemyMediaOverride = hasActorMediaOverride(selectedEntry, 'enemy');
  const heroName = project.heroAdventure?.hero?.name || 'Héros';
  const selectedHeroInitiative = clampNumber(project.heroAdventure?.hero?.initiative, 0, -999, 999);
  const diceLabel = project.heroAdventure?.dice?.label || 'd20';
  const selectedTurnMode = getEntryValue(selectedEntry, 'combatTurnMode', combat.turnMode) !== false;
  const selectedShowDice = getEntryValue(selectedEntry, 'combatShowDice', combat.showDice) !== false;
  const selectedHeroAttackType = normalizeHeroAttackType(getEntryValue(selectedEntry, 'combatHeroAttackType', combat.heroAttackType));
  const selectedHeroDieDamagePercent = clampNumber(getEntryValue(selectedEntry, 'combatHeroDieDamagePercent', combat.heroDieDamagePercent), combat.heroDieDamagePercent, 0, 999);
  const selectedEnemyInitiative = clampNumber(getEntryValue(selectedEntry, 'combatEnemyInitiative', combat.enemyInitiative), combat.enemyInitiative, -999, 999);
  const selectedFirstActorLabel = selectedEnemyInitiative > selectedHeroInitiative ? 'Ennemi commence' : 'Héros commence';
  const selectedEnemyStrength = clampNumber(getEntryValue(selectedEntry, 'combatEnemyStrength', getEntryValue(selectedEntry, 'combatEnemyDamage', combat.enemyStrength)), combat.enemyStrength, 0, 999);
  const selectedEnemyDieDamagePercent = clampNumber(getEntryValue(selectedEntry, 'combatEnemyDieDamagePercent', combat.enemyDieDamagePercent), combat.enemyDieDamagePercent, 0, 999);
  const selectedEnemyCunning = clampNumber(getEntryValue(selectedEntry, 'combatEnemyCunning', combat.enemyCunning), combat.enemyCunning, 1, 999);
  const selectedEnemyChaos = clampNumber(getEntryValue(selectedEntry, 'combatEnemyChaos', combat.enemyChaos), combat.enemyChaos, 1, 999);
  const selectedEnemyArmor = clampNumber(getEntryValue(selectedEntry, 'combatEnemyArmor', combat.enemyArmor), combat.enemyArmor, 0, 999);
  const selectedEnemyDodgeChance = clampNumber(getEntryValue(selectedEntry, 'combatEnemyDodgeChance', combat.enemyDodgeChance), combat.enemyDodgeChance, 0, 100);
  const selectedEnemyMaxMana = clampNumber(getEntryValue(selectedEntry, 'combatEnemyMaxMana', combat.enemyMaxMana), combat.enemyMaxMana, 0, 999);
  const selectedEnemyPowerName = getEntryValue(selectedEntry, 'combatEnemyPowerName', combat.enemyPowerName) || DEFAULT_COMBAT_SETTINGS.enemyPowerName;
  const selectedEnemyPowerType = normalizePowerType(getEntryValue(selectedEntry, 'combatEnemyPowerType', combat.enemyPowerType));
  const selectedEnemyPowerManaCost = clampNumber(getEntryValue(selectedEntry, 'combatEnemyPowerManaCost', combat.enemyPowerManaCost), combat.enemyPowerManaCost, 0, 999);
  const selectedEnemyPowerDamage = clampNumber(getEntryValue(selectedEntry, 'combatEnemyPowerDamage', combat.enemyPowerDamage), combat.enemyPowerDamage, 0, 999);
  const selectedEnemyPowerUsageChance = clampNumber(getEntryValue(selectedEntry, 'combatEnemyPowerUsageChance', combat.enemyPowerUsageChance), combat.enemyPowerUsageChance, 0, 100);
  const selectedEnemyAiMode = normalizeEnemyAiMode(getEntryValue(selectedEntry, 'combatEnemyAiMode', combat.enemyAiMode));
  const selectedEnemyCriticalChance = clampNumber(getEntryValue(selectedEntry, 'combatEnemyCriticalChance', combat.enemyCriticalChance), combat.enemyCriticalChance, 0, 100);
  const selectedEnemyCriticalMultiplier = clampDecimal(getEntryValue(selectedEntry, 'combatEnemyCriticalMultiplier', combat.enemyCriticalMultiplier), combat.enemyCriticalMultiplier, 1, 20);
  const combatBalance = useMemo(() => (
    selectedEntry
      ? estimateCombatBalance(project, selectedEntry, combat, {
        iterations: BALANCE_SIMULATION_ITERATIONS,
        seed: selectedSource?.id || selectedEntry.id || selectedEntry.combatEnemyName || 'combat',
      })
      : null
  ), [combat, project, selectedEntry, selectedSource?.id]);
  const combatBalanceStats = useMemo(() => (
    selectedEntry ? getCombatSimulationStats(project, selectedEntry, combat) : null
  ), [combat, project, selectedEntry]);
  const combatBalanceTone = getBalanceTone(combatBalance);
  const heroSkills = Array.isArray(project.heroAdventure?.hero?.skills) ? project.heroAdventure.hero.skills : [];
  const getSelectedResistance = (field, combatField) => clampNumber(getEntryValue(selectedEntry, field, combat[combatField]), 0, 0, 100);

  useEffect(() => {
    if (!combatSources.length) {
      if (selectedCombatId) setSelectedCombatId('');
      return;
    }
    if (!combatSources.some((source) => source.id === selectedCombatId)) {
      setSelectedCombatId(combatSources[0].id);
    }
  }, [combatSources, selectedCombatId]);

  const ensureHeroAdventure = (draft) => {
    if (!draft.heroAdventure || typeof draft.heroAdventure !== 'object') draft.heroAdventure = {};
    draft.heroAdventure.enabled = draft.heroAdventure.enabled ?? true;
    draft.creationMode = 'hero_adventure';
  };

  const patchDefaultCombat = (updater) => {
    patchProject((draft) => {
      ensureHeroAdventure(draft);
      const nextCombat = normalizeCombatSettings(draft.heroAdventure.combat);
      updater(nextCombat);
      draft.heroAdventure.combat = nextCombat;
    });
  };

  const updateDefaultCombat = (changes) => patchDefaultCombat((draft) => Object.assign(draft, changes));

  const patchCombatEntry = (updater) => {
    if (!selectedSource) return;
    patchProject((draft) => {
      const target = getCombatTarget(draft, selectedSource);
      if (target) updater(target);
    });
  };

  const updateCombatEntry = (changes) => patchCombatEntry((target) => Object.assign(target, changes));

  const clearCombatEntryFields = (fields) => patchCombatEntry((target) => {
    fields.forEach((field) => {
      delete target[field];
    });
  });

  const updateCombatEntryBooleanOverride = (field, value) => {
    if (value === ENTRY_BOOLEAN_DEFAULT) {
      clearCombatEntryFields([field]);
      return;
    }
    updateCombatEntry({ [field]: value === 'true' });
  };

  const openSelectedSource = () => {
    if (!selectedSource) return;
    setSelectedSceneId?.(selectedSource.sceneId);
    setSelectedHotspotId?.(selectedSource.hotspotId);
    setTab?.('scenes');
  };

  const previewSelectedCombat = () => {
    if (!selectedEntry) return;
    const didStart = previewHeroCombat?.(selectedEntry, { sceneId: selectedSource?.sceneId });
    if (didStart !== false) setTab?.('preview');
  };

  const patchHeroSkills = (updater) => {
    patchProject((draft) => {
      ensureHeroAdventure(draft);
      if (!draft.heroAdventure.hero || typeof draft.heroAdventure.hero !== 'object') draft.heroAdventure.hero = {};
      const nextSkills = Array.isArray(draft.heroAdventure.hero.skills)
        ? [...draft.heroAdventure.hero.skills]
        : [];
      updater(nextSkills);
      draft.heroAdventure.hero.skills = nextSkills;
    });
  };

  const updateHeroSkill = (index, changes) => {
    patchHeroSkills((skills) => {
      if (!skills[index]) return;
      skills[index] = { ...skills[index], ...changes };
    });
  };

  const makeDefaultActorHandlers = (actor) => ({
    onMediaTypeChange: (mediaType) => updateDefaultCombat({ [`${actor}MediaType`]: normalizeMediaType(mediaType) }),
    onImageSelect: (imageData, imageName = '') => updateDefaultCombat({
      [`${actor}ImageData`]: imageData,
      [`${actor}ImageName`]: imageName,
      [`${actor}MediaType`]: 'image',
    }),
    onImageClear: () => updateDefaultCombat({ [`${actor}ImageData`]: '', [`${actor}ImageName`]: '' }),
    onAnimeSelect: (spec, name = '') => updateDefaultCombat({
      [`${actor}Anime2dSpec`]: spec,
      [`${actor}Anime2dName`]: name,
      [`${actor}MediaType`]: 'anime2d',
    }),
    onAnimeClear: () => updateDefaultCombat({ [`${actor}Anime2dSpec`]: null, [`${actor}Anime2dName`]: '' }),
  });

  const defaultHeroHandlers = makeDefaultActorHandlers('hero');
  const defaultEnemyHandlers = makeDefaultActorHandlers('enemy');

  const makeEntryActorHandlers = (actor) => {
    const entryPrefix = getActorEntryPrefix(actor);
    return {
      onMediaTypeChange: (mediaType) => updateCombatEntry({ [`${entryPrefix}MediaType`]: normalizeMediaType(mediaType) }),
      onImageSelect: (imageData, imageName = '') => updateCombatEntry({
        [`${entryPrefix}ImageData`]: imageData,
        [`${entryPrefix}ImageName`]: imageName,
        [`${entryPrefix}MediaType`]: 'image',
      }),
      onImageClear: () => clearCombatEntryFields([`${entryPrefix}ImageData`, `${entryPrefix}ImageName`]),
      onAnimeSelect: (spec, name = '') => updateCombatEntry({
        [`${entryPrefix}Anime2dSpec`]: spec,
        [`${entryPrefix}Anime2dName`]: name,
        [`${entryPrefix}MediaType`]: 'anime2d',
      }),
      onAnimeClear: () => clearCombatEntryFields([`${entryPrefix}Anime2dSpec`, `${entryPrefix}Anime2dName`]),
      onClearOverride: () => clearCombatEntryFields(getActorMediaOverrideFields(actor)),
    };
  };

  const entryHeroHandlers = makeEntryActorHandlers('hero');
  const entryEnemyHandlers = makeEntryActorHandlers('enemy');

  const makeDefaultEffectHandlers = (actor, outcome) => {
    const base = getCombatEffectFieldBase(actor, outcome);
    return {
      onMediaTypeChange: (mediaType) => updateDefaultCombat({ [`${base}MediaType`]: normalizeEffectMediaType(mediaType) }),
      onImageSelect: (imageData, imageName = '') => updateDefaultCombat({
        [`${base}ImageData`]: imageData,
        [`${base}ImageName`]: imageName,
        [`${base}MediaType`]: 'image',
      }),
      onImageClear: () => updateDefaultCombat({ [`${base}ImageData`]: '', [`${base}ImageName`]: '' }),
      onAnimeSelect: (spec, name = '') => updateDefaultCombat({
        [`${base}Anime2dSpec`]: spec,
        [`${base}Anime2dName`]: name,
        [`${base}MediaType`]: 'anime2d',
      }),
      onAnimeClear: () => updateDefaultCombat({ [`${base}Anime2dSpec`]: null, [`${base}Anime2dName`]: '' }),
      onVideoSelect: (videoData, videoName = '') => updateDefaultCombat({
        [`${base}VideoData`]: videoData,
        [`${base}VideoName`]: videoName,
        [`${base}MediaType`]: 'video',
      }),
      onVideoClear: () => updateDefaultCombat({ [`${base}VideoData`]: '', [`${base}VideoName`]: '' }),
      onVisualEffectChange: (visualEffect) => updateDefaultCombat({
        [`${base}VisualEffect`]: normalizeCombatVisualEffect(visualEffect),
        [`${base}MediaType`]: 'visual',
      }),
      onAudioSelect: (audioData, audioName = '') => updateDefaultCombat({
        [`${base}AudioData`]: audioData,
        [`${base}AudioName`]: audioName,
      }),
      onAudioClear: () => updateDefaultCombat({ [`${base}AudioData`]: '', [`${base}AudioName`]: '' }),
    };
  };

  const arenaStyle = previewBackground
    ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.22), rgba(2,6,23,.74)), url(${previewBackground})` }
    : undefined;

  return (
    <div className="layout two-cols-wide combat-editor-layout">
      <section className="panel side combat-editor-summary" data-tour="combat-summary-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <h2>Combat</h2>
            <p>Décor, héros, ennemi et rythme des combats Hero aventure.</p>
          </div>
        </div>

        <div className="combat-summary-stats">
          <span><strong>{combatSources.length}</strong> combat(s)</span>
          <span><strong>{diceLabel}</strong> dé principal</span>
          <span><strong>{combat.turnMode ? 'Tour par tour' : 'Instantané'}</strong> mode par défaut</span>
          <span><strong>Dé ennemi manuel</strong> riposte</span>
          <span><strong>{getEnemyAiModeLabel(combat.enemyAiMode)}</strong> IA ennemie</span>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={combat.turnMode}
            onChange={(event) => updateDefaultCombat({ turnMode: event.target.checked })}
          />
          <span>Combats en tour par tour</span>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={combat.showDice}
            onChange={(event) => updateDefaultCombat({ showDice: event.target.checked })}
          />
          <span>Dé mis en évidence</span>
        </label>

        <div className="combat-source-list">
          {combatSources.length ? combatSources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={source.id === selectedSource?.id ? 'active' : ''}
              onClick={() => setSelectedCombatId(source.id)}
            >
              <Swords size={15} aria-hidden="true" />
              <span>
                <strong>{source.entry.combatEnemyName || source.entry.name || source.entry.label || 'Combat'}</strong>
                <small>{getSceneLabel?.(source.sceneId) || 'Scène'} - {source.type === 'reply' ? 'Réponse' : 'Zone'}</small>
              </span>
            </button>
          )) : (
            <div className="empty-state-inline">Aucun combat simple détecté.</div>
          )}
        </div>

        {!combatSources.length ? (
          <button type="button" className="secondary-action full" onClick={() => setTab?.('scenes')}>
            <Swords size={15} aria-hidden="true" /> Créer un combat dans Scènes
          </button>
        ) : null}
      </section>

      <section className="panel main combat-editor-main" data-tour="combat-editor-panel">
        <div className="panel-head">
          <div>
            <h2>Atelier de combat</h2>
            <p>Choisis les visuels puis teste le rendu dans Preview.</p>
          </div>
          <div className="inline-actions">
            <button type="button" className="secondary-action" onClick={previewSelectedCombat} disabled={!selectedEntry}>
              <Swords size={16} aria-hidden="true" /> Preview
            </button>
          </div>
        </div>

        <div className="combat-arena-preview" style={arenaStyle}>
          <CombatActorPreview
            media={previewHeroMedia}
            label={heroName}
            project={project}
          />
          {selectedShowDice ? (
            <div className="combat-dice-preview">
              <span className={`hero-die-face hero-die-face--${project.heroAdventure?.dice?.skin || 'classic'}`}>
                <span className="hero-roll-die-value">{diceLabel.replace(/^d/i, '')}</span>
              </span>
              <strong>{selectedTurnMode ? selectedFirstActorLabel : 'Jet direct'}</strong>
            </div>
          ) : null}
          <CombatActorPreview
            media={previewEnemyMedia}
            label={previewEnemyName}
            project={project}
          />
        </div>

        {jsonError ? <div className="combat-json-error">{jsonError}</div> : null}

        <div className="combat-editor-tabs" role="tablist" aria-label="Sections de combat">
          <button
            type="button"
            className={activeCombatPanel === 'arena' ? 'active' : ''}
            onClick={() => setActiveCombatPanel('arena')}
          >
            Arène
          </button>
          <button
            type="button"
            className={activeCombatPanel === 'enemy' ? 'active' : ''}
            onClick={() => setActiveCombatPanel('enemy')}
          >
            Ennemi
          </button>
          <button
            type="button"
            className={activeCombatPanel === 'balance' ? 'active' : ''}
            onClick={() => setActiveCombatPanel('balance')}
          >
            Équilibrage
          </button>
          <button
            type="button"
            className={activeCombatPanel === 'hero' ? 'active' : ''}
            onClick={() => setActiveCombatPanel('hero')}
          >
            Compétences
          </button>
        </div>

        {activeCombatPanel === 'arena' ? (
        <div className="combat-config-grid combat-config-grid--single">
          {selectedEntry ? (
            <section className="subpanel combat-config-card combat-entry-media-section">
              <div className="subpanel-head">
                <div>
                  <h3>Combat sélectionné</h3>
                  <p>Overrides propres à {previewEnemyName}, avec les réglages par défaut en secours.</p>
                </div>
                {selectedSource ? (
                  <button type="button" className="secondary-action compact" onClick={openSelectedSource}>
                    Ouvrir
                  </button>
                ) : null}
              </div>

              <div className="combat-entry-settings-grid">
                <CombatBooleanOverrideSelect
                  label="Résolution"
                  help="Permet de forcer ce combat en tour par tour ou en résolution directe, sans toucher au défaut global."
                  value={getEntryBooleanOverrideValue(selectedEntry, 'combatTurnMode')}
                  fallbackLabel={combat.turnMode ? 'tour par tour' : 'instantané'}
                  trueLabel="Tour par tour"
                  falseLabel="Instantané"
                  onChange={(value) => updateCombatEntryBooleanOverride('combatTurnMode', value)}
                />
                <CombatBooleanOverrideSelect
                  label="Dé central"
                  help="Affiche ou masque le dé central uniquement pour ce combat."
                  value={getEntryBooleanOverrideValue(selectedEntry, 'combatShowDice')}
                  fallbackLabel={combat.showDice ? 'affiché' : 'masqué'}
                  trueLabel="Afficher"
                  falseLabel="Masquer"
                  onChange={(value) => updateCombatEntryBooleanOverride('combatShowDice', value)}
                />
              </div>

              <div className="combat-background-picker combat-entry-background-picker">
                <HelpLabel help="Fond utilisé uniquement pour ce combat. Sans choix personnalisé, le fond par défaut reste utilisé.">Fond de ce combat</HelpLabel>
                <div className="inline-actions">
                  <MediaSourcePicker
                    accept="image/*"
                    handleUpload={handleUpload}
                    mediaLibrary={mediaLibrary}
                    onSelect={(imageData, imageName = '') => updateCombatEntry({
                      combatBackgroundImageData: imageData,
                      combatBackgroundImageName: imageName,
                    })}
                  >
                    <ImageIcon size={15} aria-hidden="true" /> Choisir le fond
                  </MediaSourcePicker>
                  {selectedEntry.combatBackgroundImageData ? (
                    <button type="button" className="secondary-action" onClick={() => clearCombatEntryFields(['combatBackgroundImageData', 'combatBackgroundImageName'])}>
                      Revenir au défaut
                    </button>
                  ) : null}
                </div>
                <small>{selectedEntry.combatBackgroundImageData ? selectedBackgroundName : `Défaut: ${selectedBackgroundName || 'aucun fond'}`}</small>
              </div>

              <div className="combat-entry-media-grid">
                <CombatEntryMediaSlotEditor
                  title="Héros de ce combat"
                  help="Visuel du héros uniquement pour ce combat. Sans override, le héros par défaut est utilisé."
                  media={selectedHeroEntryMedia}
                  inheritedMedia={getActorMedia(null, combat, 'hero', heroFallbackImage)}
                  hasOverride={hasHeroMediaOverride}
                  inheritedLabel="Défaut héros"
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  project={project}
                  currentAnimeSpec={currentAnimeSpec}
                  currentAnimeName={project.anime2dDraft?.sceneName}
                  onJsonError={setJsonError}
                  {...entryHeroHandlers}
                />
                <CombatEntryMediaSlotEditor
                  title="Ennemi de ce combat"
                  help="Visuel de l'ennemi uniquement pour ce combat. Sans override, l'ennemi par défaut est utilisé."
                  media={selectedEnemyEntryMedia}
                  inheritedMedia={getActorMedia(null, combat, 'enemy')}
                  hasOverride={hasEnemyMediaOverride}
                  inheritedLabel="Défaut ennemi"
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  project={project}
                  currentAnimeSpec={currentAnimeSpec}
                  currentAnimeName={project.anime2dDraft?.sceneName}
                  onJsonError={setJsonError}
                  {...entryEnemyHandlers}
                />
              </div>
            </section>
          ) : null}

          <section className="subpanel combat-config-card combat-default-media-section">
            <div className="subpanel-head">
              <div>
                <h3>Rendu par défaut</h3>
                <p>Utilisé quand un combat n'a pas son propre visuel.</p>
              </div>
            </div>

            <div className="combat-background-picker">
              <HelpLabel help="Image affichée derrière les personnages et le dé pendant un combat.">Fond d'écran combat</HelpLabel>
              <div className="inline-actions">
                <MediaSourcePicker
                  accept="image/*"
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  onSelect={(imageData, imageName = '') => updateDefaultCombat({
                    backgroundImageData: imageData,
                    backgroundImageName: imageName,
                  })}
                >
                  <ImageIcon size={15} aria-hidden="true" /> Choisir le fond
                </MediaSourcePicker>
                {combat.backgroundImageData ? (
                  <button type="button" className="secondary-action" onClick={() => updateDefaultCombat({ backgroundImageData: '', backgroundImageName: '' })}>
                    Retirer
                  </button>
                ) : null}
              </div>
              <small>{combat.backgroundImageName || 'Aucun fond par défaut'}</small>
            </div>

            <div className="combat-turn-mode-picker">
              <HelpLabel help="Mode de décision par défaut pour les pouvoirs ennemis. Tactique ajuste la probabilité selon la situation; aléatoire utilise seulement le pourcentage configuré.">IA ennemie par défaut</HelpLabel>
              <div className="combat-mode-switch" role="group" aria-label="Mode IA ennemi par défaut">
                {ENEMY_AI_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={combat.enemyAiMode === mode.id ? 'active' : ''}
                    onClick={() => updateDefaultCombat({ enemyAiMode: mode.id })}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <small>
                {combat.enemyAiMode === 'tactical'
                  ? "L'ennemi adapte sa dépense de mana à l'état du combat."
                  : "L'ennemi suit uniquement sa tendance pouvoir en pourcentage."}
              </small>
            </div>

            <div className="combat-turn-mode-picker">
              <HelpLabel help="Nom utilisé pour le pouvoir ennemi quand le combat sélectionné n'a pas son propre nom.">Nom du pouvoir par défaut</HelpLabel>
              <input
                value={combat.enemyPowerName}
                placeholder={DEFAULT_COMBAT_SETTINGS.enemyPowerName}
                onChange={(event) => updateDefaultCombat({ enemyPowerName: event.target.value || DEFAULT_COMBAT_SETTINGS.enemyPowerName })}
              />
              <small>Les combats peuvent le remplacer dans l'onglet Ennemi.</small>
            </div>

            <MediaSlotEditor
              title="Héros par défaut"
              help="Visuel utilisé pour représenter le héros pendant le combat."
              mediaType={combat.heroMediaType}
              imageData={combat.heroImageData}
              imageName={combat.heroImageName}
              anime2dSpec={combat.heroAnime2dSpec}
              anime2dName={combat.heroAnime2dName}
              handleUpload={handleUpload}
              mediaLibrary={mediaLibrary}
              project={project}
              currentAnimeSpec={currentAnimeSpec}
              currentAnimeName={project.anime2dDraft?.sceneName}
              onJsonError={setJsonError}
              {...defaultHeroHandlers}
            />

            <MediaSlotEditor
              title="Ennemi par défaut"
              help="Visuel utilisé pour les ennemis qui n'ont pas de visuel personnalisé."
              mediaType={combat.enemyMediaType}
              imageData={combat.enemyImageData}
              imageName={combat.enemyImageName}
              anime2dSpec={combat.enemyAnime2dSpec}
              anime2dName={combat.enemyAnime2dName}
              handleUpload={handleUpload}
              mediaLibrary={mediaLibrary}
              project={project}
              currentAnimeSpec={currentAnimeSpec}
              currentAnimeName={project.anime2dDraft?.sceneName}
              onJsonError={setJsonError}
              {...defaultEnemyHandlers}
            />
          </section>

          <section className="subpanel combat-effect-media-section">
            <div className="subpanel-head compact">
              <div>
                <h4>Médias d'impact</h4>
                <p>Image, animation, vidéo courte ou son joué quand un acteur est touché ou tombe à 0 PV.</p>
              </div>
            </div>
            <div className="combat-effect-media-grid">
              {COMBAT_EFFECT_EDITOR_SLOTS.map((slot) => (
                <EffectMediaSlotEditor
                  key={`${slot.actor}-${slot.outcome}`}
                  title={slot.title}
                  help={slot.help}
                  media={getEffectMedia(combat, slot.actor, slot.outcome)}
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  project={project}
                  currentAnimeSpec={currentAnimeSpec}
                  currentAnimeName={project.anime2dDraft?.sceneName}
                  onJsonError={setJsonError}
                  {...makeDefaultEffectHandlers(slot.actor, slot.outcome)}
                />
              ))}
            </div>
          </section>
        </div>
        ) : activeCombatPanel === 'enemy' ? (
          <div className="combat-enemy-panel">
            <section className="subpanel combat-config-card combat-enemy-card">
              <div className="subpanel-head">
                <div>
                  <h3>Ennemi</h3>
                  <p>{selectedEntry ? `Règle les stats de ${previewEnemyName}.` : 'Sélectionne un combat pour régler son ennemi.'}</p>
                </div>
                {selectedSource ? (
                  <button type="button" className="secondary-action compact" onClick={openSelectedSource}>
                    Ouvrir
                  </button>
                ) : null}
              </div>

              {selectedEntry ? (
                <>
                  <div className="combat-enemy-stat-strip">
                    <span><strong>{selectedEnemyStrength}</strong> force</span>
                    <span><strong>{selectedEnemyDieDamagePercent}%</strong> dé</span>
                    <span><strong>{selectedEntry.combatEnemyMaxHealth || 8}</strong> PV</span>
                    <span><strong>{selectedEnemyCunning}</strong> ruse</span>
                    <span><strong>{selectedEnemyChaos}</strong> chaos</span>
                    <span><strong>{selectedEnemyInitiative}</strong> init.</span>
                    <span><strong>{selectedEnemyArmor}</strong> armure</span>
                    <span><strong>{selectedEnemyDodgeChance}%</strong> esquive</span>
                    <span><strong>{selectedEnemyMaxMana}</strong> mana</span>
                    <span><strong>Manuel</strong> riposte</span>
                    <span><strong>{getEnemyAiModeLabel(selectedEnemyAiMode)}</strong> IA</span>
                    <span><strong>{selectedEnemyPowerName}</strong> nom pouvoir</span>
                    <span><strong>{selectedEnemyPowerUsageChance}%</strong> pouvoir</span>
                    <span><strong>{selectedEnemyCriticalChance}%</strong> critique</span>
                  </div>

                  <div className="combat-enemy-section">
                    <div className="subpanel-head compact">
                      <div>
                        <h4>Narration</h4>
                        <p>Textes affichés au lancement et au dénouement du combat.</p>
                      </div>
                    </div>
                    <div className="combat-narration-grid">
                      <div>
                        <HelpLabel help="Texte affiché au joueur au moment où ce combat commence.">Phrase de début</HelpLabel>
                        <textarea
                          value={selectedEntry.combatStartDialogue || ''}
                          placeholder={`Combat contre ${previewEnemyName}. À toi de jouer.`}
                          onChange={(event) => updateCombatEntry({ combatStartDialogue: event.target.value })}
                        />
                      </div>
                      <div>
                        <HelpLabel help="Texte affiché quand le combat se termine, juste avant le résultat final.">Phrase de fin</HelpLabel>
                        <textarea
                          value={selectedEntry.combatEndDialogue || ''}
                          placeholder="Le silence retombe sur l'arène."
                          onChange={(event) => updateCombatEntry({ combatEndDialogue: event.target.value })}
                        />
                      </div>
                      <div>
                        <HelpLabel help="Scène vers laquelle le joueur est envoyé après une victoire.">Cible victoire</HelpLabel>
                        <select
                          value={selectedEntry.combatVictoryTargetSceneId || ''}
                          onChange={(event) => updateCombatEntry({ combatVictoryTargetSceneId: event.target.value })}
                        >
                          <option value="">Rester sur place</option>
                          {(project.scenes || []).map((scene) => (
                            <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name || scene.id}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <HelpLabel help="Scène vers laquelle le joueur est envoyé après une défaite.">Cible défaite</HelpLabel>
                        <select
                          value={selectedEntry.combatDefeatTargetSceneId || ''}
                          onChange={(event) => updateCombatEntry({ combatDefeatTargetSceneId: event.target.value })}
                        >
                          <option value="">Rester sur place</option>
                          {(project.scenes || []).map((scene) => (
                            <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name || scene.id}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="combat-enemy-grid">
                    <div>
                      <HelpLabel help="Nom de l'ennemi affiché au joueur pendant le combat.">Nom ennemi</HelpLabel>
                      <input value={selectedEntry.combatEnemyName || ''} placeholder={combat.enemyName} onChange={(event) => updateCombatEntry({ combatEnemyName: event.target.value })} />
                    </div>
                    <div>
                      <HelpLabel help="Dégâts de base ajoutés à chaque attaque normale de l'ennemi.">Force</HelpLabel>
                      <NumberInput
                        min="0"
                        max="999"
                        value={selectedEnemyStrength}
                        onValueChange={(nextValue) => {
                          const strength = clampNumber(nextValue, 2, 0, 999);
                          updateCombatEntry({ combatEnemyStrength: strength, combatEnemyDamage: strength });
                        }}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Part du résultat du dé ajoutée aux dégâts ennemis. 100% ajoute tout le résultat du dé; 50% en ajoute la moitié; 0% utilise seulement la force.">% du dé</HelpLabel>
                      <NumberInput
                        min="0"
                        max="999"
                        step="1"
                        value={selectedEnemyDieDamagePercent}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyDieDamagePercent: clampNumber(nextValue, DEFAULT_COMBAT_SETTINGS.enemyDieDamagePercent, 0, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Nombre de points de vie de l'ennemi au début du combat.">PV</HelpLabel>
                      <NumberInput
                        min="1"
                        max="999"
                        value={selectedEntry.combatEnemyMaxHealth || 8}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyMaxHealth: clampNumber(nextValue, 8, 1, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Difficulté à battre pour fuir. Le héros lance le dé avec sa Ruse; s'il échoue, il reste au combat et perd son tour.">Ruse</HelpLabel>
                      <NumberInput
                        min="1"
                        max="999"
                        value={selectedEnemyCunning}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyCunning: clampNumber(nextValue, 10, 1, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Difficulté à battre quand le héros tombe à 0 PV. S'il réussit son jet de Survie, il reste en vie avec 1 PV.">Chaos</HelpLabel>
                      <NumberInput
                        min="1"
                        max="999"
                        value={selectedEnemyChaos}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyChaos: clampNumber(nextValue, 10, 1, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Réserve de mana de l'ennemi. Son pouvoir ne peut être utilisé que s'il a assez de mana.">Mana</HelpLabel>
                      <NumberInput
                        min="0"
                        max="999"
                        value={selectedEnemyMaxMana}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyMaxMana: clampNumber(nextValue, 0, 0, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Valeur comparée à l'initiative du héros au début du combat. Le plus haut résultat commence.">Initiative</HelpLabel>
                      <NumberInput
                        min="-999"
                        max="999"
                        value={selectedEnemyInitiative}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyInitiative: clampNumber(nextValue, 0, -999, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Nombre de points retirés aux dégâts reçus par l'ennemi.">Armure</HelpLabel>
                      <NumberInput
                        min="0"
                        max="999"
                        value={selectedEnemyArmor}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyArmor: clampNumber(nextValue, 0, 0, 999) })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Chance que l'ennemi évite complètement une attaque du héros.">Esquive (%)</HelpLabel>
                      <NumberInput
                        min="0"
                        max="100"
                        value={selectedEnemyDodgeChance}
                        onValueChange={(nextValue) => updateCombatEntry({ combatEnemyDodgeChance: clampNumber(nextValue, 0, 0, 100) })}
                      />
                    </div>
                  </div>

                  <div className="combat-enemy-section">
                    <div className="subpanel-head compact">
                      <div>
                        <h4>Pouvoir</h4>
                        <p>Le pouvoir peut remplacer la riposte normale quand l'ennemi a assez de mana.</p>
                      </div>
                    </div>
                    <div className="combat-enemy-grid">
                      <div>
                        <HelpLabel help="Nom affiché dans les messages et les logs quand l'ennemi utilise son pouvoir.">Nom du pouvoir</HelpLabel>
                        <input
                          value={selectedEntry.combatEnemyPowerName || ''}
                          placeholder={combat.enemyPowerName}
                          onChange={(event) => updateCombatEntry({ combatEnemyPowerName: event.target.value })}
                        />
                      </div>
                      <div>
                        <HelpLabel help="Mode de décision de cet ennemi. Tactique ajuste la tendance selon les PV, la mana, les résistances et les états; aléatoire suit le pourcentage brut.">IA ennemie</HelpLabel>
                        <select value={selectedEnemyAiMode} onChange={(event) => updateCombatEntry({ combatEnemyAiMode: normalizeEnemyAiMode(event.target.value) })}>
                          {ENEMY_AI_MODES.map((mode) => (
                            <option key={mode.id} value={mode.id}>{mode.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <HelpLabel help="Élément du pouvoir ennemi. Les résistances du héros peuvent réduire ses dégâts.">Type</HelpLabel>
                        <select value={selectedEnemyPowerType} onChange={(event) => updateCombatEntry({ combatEnemyPowerType: normalizePowerType(event.target.value) })}>
                          {POWER_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <HelpLabel help="Quantité de mana dépensée par l'ennemi à chaque utilisation du pouvoir.">Coût mana</HelpLabel>
                        <NumberInput
                          min="0"
                          max="999"
                          value={selectedEnemyPowerManaCost}
                          onValueChange={(nextValue) => updateCombatEntry({ combatEnemyPowerManaCost: clampNumber(nextValue, 3, 0, 999) })}
                        />
                      </div>
                      <div>
                        <HelpLabel help="Dégâts de base du pouvoir avant les critiques, résistances et armures. Mets 0 si le pouvoir ne doit pas blesser.">Puissance</HelpLabel>
                        <NumberInput
                          min="0"
                          max="999"
                          value={selectedEnemyPowerDamage}
                          onValueChange={(nextValue) => updateCombatEntry({ combatEnemyPowerDamage: clampNumber(nextValue, 4, 0, 999) })}
                        />
                      </div>
                      <div>
                        <HelpLabel help="Probabilité de base que l'ennemi choisisse son pouvoir au lieu d'une attaque normale.">Tendance pouvoir (%)</HelpLabel>
                        <NumberInput
                          min="0"
                          max="100"
                          value={selectedEnemyPowerUsageChance}
                          onValueChange={(nextValue) => updateCombatEntry({ combatEnemyPowerUsageChance: clampNumber(nextValue, 25, 0, 100) })}
                        />
                      </div>
                      <div>
                        <HelpLabel help="Type des dégâts infligés par le héros. Les résistances de l'ennemi réduisent les dégâts élémentaires.">Type subi par l'ennemi</HelpLabel>
                        <select value={selectedHeroAttackType} onChange={(event) => updateCombatEntry({ combatHeroAttackType: normalizeHeroAttackType(event.target.value) })}>
                          {HERO_ATTACK_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="combat-enemy-section">
                    <div className="subpanel-head compact">
                      <div>
                        <h4>Coup critique</h4>
                        <p>Quand il se déclenche, les dégâts ennemis sont multipliés par la valeur choisie.</p>
                      </div>
                    </div>
                    <div className="combat-enemy-grid">
                      <div>
                        <HelpLabel help="Chance que l'attaque de l'ennemi fasse un coup critique.">Apparition (%)</HelpLabel>
                        <NumberInput
                          min="0"
                          max="100"
                          value={selectedEnemyCriticalChance}
                          onValueChange={(nextValue) => updateCombatEntry({ combatEnemyCriticalChance: clampNumber(nextValue, 5, 0, 100) })}
                        />
                      </div>
                      <div>
                        <HelpLabel help="Multiplicateur appliqué aux dégâts en cas de coup critique. Exemple: 2 double les dégâts.">Multiplication de force</HelpLabel>
                        <NumberInput
                          min="1"
                          max="20"
                          step="0.1"
                          value={selectedEnemyCriticalMultiplier}
                          onValueChange={(nextValue) => updateCombatEntry({ combatEnemyCriticalMultiplier: clampDecimal(nextValue, 2, 1, 20) })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="combat-enemy-section">
                    <div className="subpanel-head compact">
                      <div>
                        <h4>Résistances</h4>
                        <p>Réduction en pourcentage appliquée aux dégâts du héros selon leur type.</p>
                      </div>
                    </div>
                    <div className="combat-resistance-grid">
                      {RESISTANCE_FIELDS.map((resistance) => (
                        <label key={resistance.id} className="combat-resistance-row">
                          <span>{resistance.label}</span>
                          <NumberInput
                            min="0"
                            max="100"
                            value={getSelectedResistance(resistance.field, `enemyResistance${resistance.id.slice(0, 1).toUpperCase()}${resistance.id.slice(1)}`)}
                            onValueChange={(nextValue) => updateCombatEntry({ [resistance.field]: clampNumber(nextValue, 0, 0, 100) })}
                          />
                          <em>%</em>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state-inline">Passe une zone ou une réponse en action ?Combat simple? pour créer un ennemi réglable ici.</div>
              )}
            </section>
          </div>
        ) : activeCombatPanel === 'balance' ? (
          <div className="combat-enemy-panel">
            <section className={`subpanel combat-config-card combat-balance-panel combat-balance-panel--${combatBalanceTone}`}>
              <div className="subpanel-head">
                <div>
                  <h3>Mode Équilibrage</h3>
                  <p>{selectedEntry ? `Lecture statistique de ${previewEnemyName}.` : 'Sélectionne un combat pour estimer son équilibre.'}</p>
                </div>
                {combatBalance ? (
                  <span className="combat-balance-badge">{getBalanceVerdict(combatBalance)}</span>
                ) : null}
              </div>

              {combatBalance ? (
                <>
                  <div className="combat-balance-summary">
                    {combatBalanceStats ? (
                      <>
                        <span>
                          <strong>{combatBalanceStats.heroHealth}/{combatBalanceStats.heroMaxHealth}</strong>
                          <small>PV héros pris en compte</small>
                        </span>
                        <span>
                          <strong>{combatBalanceStats.heroForce}</strong>
                          <small>force héros prise en compte</small>
                        </span>
                        <span>
                          <strong>{combatBalanceStats.heroDieDamagePercent}%</strong>
                          <small>dé héros pris en compte</small>
                        </span>
                        <span>
                          <strong>{combatBalanceStats.enemyStats.dieDamagePercent}%</strong>
                          <small>dé ennemi pris en compte</small>
                        </span>
                      </>
                    ) : null}
                    <span>
                      <strong>{formatBalancePercent(combatBalance.winChance)}</strong>
                      <small>chance de victoire</small>
                    </span>
                    <span>
                      <strong>{formatBalanceNumber(combatBalance.averageRounds)} tour(s)</strong>
                      <small>durée moyenne</small>
                    </span>
                    <span>
                      <strong>{formatBalanceNumber(combatBalance.averageHeroDamagePerRound)}</strong>
                      <small>dégâts héros / tour</small>
                    </span>
                    <span>
                      <strong>{formatBalanceNumber(combatBalance.averageEnemyDamagePerRound)}</strong>
                      <small>dégâts ennemi / tour</small>
                    </span>
                  </div>

                  <div className="combat-balance-meter" aria-label={`Chance de victoire ${formatBalancePercent(combatBalance.winChance)}`}>
                    <i style={{ width: `${Math.max(0, Math.min(100, combatBalance.winChance))}%` }} />
                  </div>

                  <div className="combat-balance-outcomes">
                    <span><strong>{combatBalance.victoryCount}</strong><small>victoires</small></span>
                    <span><strong>{combatBalance.defeatCount}</strong><small>défaites</small></span>
                    <span><strong>{combatBalance.blockedCount}</strong><small>blocages</small></span>
                    <span><strong>{combatBalance.timeoutCount}</strong><small>combats longs</small></span>
                  </div>

                  <p className="combat-balance-note">
                    Estimation sur {combatBalance.iterations} simulations, limite {combatBalance.maxRounds} tours.
                    Dégâts moyens cumulés : {formatBalanceNumber(combatBalance.averageTotalDamagePerRound)} par tour.
                  </p>
                </>
              ) : (
                <div className="empty-state-inline">Ajoute un combat simple pour activer le mode Équilibrage.</div>
              )}
            </section>
          </div>
        ) : (
          <div className="combat-enemy-panel">
            <section className="subpanel combat-config-card combat-hero-skill-card">
              <div className="subpanel-head">
                <div>
                  <h3>Compétences du héros</h3>
                  <p>Valeurs de base utilisées par les tests et les combats.</p>
                </div>
              </div>

              <div className="combat-hero-skill-grid">
                <div className="combat-hero-skill-row">
                  <div>
                    <HelpLabel help="Part du résultat du dé ajoutée aux dégâts du héros. 100% ajoute tout le résultat du dé; 50% en ajoute la moitié; 0% utilise seulement la force.">% du dé héros</HelpLabel>
                    <NumberInput
                      min="0"
                      max="999"
                      step="1"
                      value={selectedHeroDieDamagePercent}
                      onValueChange={(nextValue) => updateCombatEntry({ combatHeroDieDamagePercent: clampNumber(nextValue, DEFAULT_COMBAT_SETTINGS.heroDieDamagePercent, 0, 999) })}
                      disabled={!selectedEntry}
                    />
                  </div>
                </div>
                {heroSkills.length ? heroSkills.map((skill, index) => (
                  <div className="combat-hero-skill-row" key={skill.id || index}>
                    <div>
                      <HelpLabel help="Nom de la compétence du héros affiché pendant les jets de dé.">Nom</HelpLabel>
                      <input
                        value={skill.name || ''}
                        placeholder={`Compétence ${index + 1}`}
                        onChange={(event) => updateHeroSkill(index, { name: event.target.value })}
                      />
                    </div>
                    <div>
                      <HelpLabel help="Valeur ajoutée au résultat du dé quand le héros utilise cette compétence.">Bonus</HelpLabel>
                      <NumberInput
                        min="0"
                        max="999"
                        value={Number(skill.value) || 0}
                        onValueChange={(nextValue) => {
                          const value = clampNumber(nextValue, 0, 0, 999);
                          updateHeroSkill(index, { value, baseValue: value, rolledValue: 0, rollFormula: '' });
                        }}
                      />
                      {skill.rolledValue ? <small>Base {skill.baseValue ?? (Number(skill.value) - Number(skill.rolledValue))} + 1d6 ({skill.rolledValue}) = {skill.value}</small> : null}
                    </div>
                    <div>
                      <HelpLabel help="Mana dépensée par le héros quand il utilise cette compétence.">Mana</HelpLabel>
                      <NumberInput
                        min="0"
                        max="999"
                        value={Number(skill.manaCost) || 0}
                        onValueChange={(nextValue) => updateHeroSkill(index, { manaCost: clampNumber(nextValue, 0, 0, 999) })}
                      />
                    </div>
                  </div>
                )) : (
                  <div className="empty-state-inline">Aucune compétence configurée.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
