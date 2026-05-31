import { Clapperboard, Image as ImageIcon, Upload, Volume2 } from 'lucide-react';
import Anime2DPreview, { normalizeAnime2dSpec, readAnime2dJsonFile } from '../Anime2DPreview.jsx';
import MediaSourcePicker from '../MediaSourcePicker.jsx';
import HelpLabel from '../forms/HelpLabel.jsx';
import {
  clampDecimal,
  clampNumber,
  getEntryValue,
  normalizeHeroAttackType,
  normalizePowerType,
} from '../../lib/combatEngine.js';
import {
  COMBAT_EFFECT_MEDIA_TYPES,
  COMBAT_EFFECT_SLOTS,
  COMBAT_VISUAL_EFFECT_OPTIONS,
  COMBAT_VISUAL_EFFECT_TYPES,
  COMBAT_MEDIA_TYPES,
  DEFAULT_COMBAT_SETTINGS,
  getCombatEffectFieldBase,
} from '../../lib/combatDefaults.js';

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

export {
  COMBAT_EFFECT_EDITOR_SLOTS,
  HERO_ATTACK_TYPES,
  POWER_TYPES,
  ENEMY_AI_MODES,
  ENTRY_BOOLEAN_DEFAULT,
  RESISTANCE_FIELDS,
  BALANCE_SIMULATION_ITERATIONS,
  formatBalanceNumber,
  formatBalancePercent,
  getBalanceTone,
  getBalanceVerdict,
  normalizeMediaType,
  normalizeEffectMediaType,
  normalizeCombatVisualEffect,
  normalizeEnemyAiMode,
  getEnemyAiModeLabel,
  getEntryBooleanOverrideValue,
  getActorEntryPrefix,
  getActorMediaOverrideFields,
  hasActorMediaOverride,
  normalizeCombatSettings,
  collectCombatSources,
  getCombatTarget,
  getCombatBackground,
  getActorMedia,
  getEntryActorMedia,
  getEffectMedia,
  CombatActorPreview,
  MediaSlotEditor,
  CombatBooleanOverrideSelect,
  CombatEntryMediaSlotEditor,
  EffectMediaSlotEditor,
};
