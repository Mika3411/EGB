import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  Cuboid,
  Footprints,
  HardHat,
  HeartPulse,
  Plus,
  Shield,
  Sword,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_ARCADE_CONFIG,
  MATERIAL_BRIGHTNESS_MAX,
  MATERIAL_BRIGHTNESS_MIN,
  MODEL_SCALE_MAX,
  MODEL_SCALE_MIN,
  clamp,
  getCharacterMaterialBrightness,
  getCharacterModelScale,
} from '../../../shared/utils/rpg3dDomain.js';
import Rpg3DHelpLabel from './Rpg3DHelpLabel.jsx';
import {
  RPG3D_FIELD_HELP,
  getCharacterPreset,
  PLAYER_CHARACTER_OPTIONS,
  CHARACTER_RENDER_OPTIONS,
  HERO_PROFILE_SECTION_TABS,
  HERO_INVENTORY_TYPE_OPTIONS,
  HERO_INVENTORY_TYPE_LABELS,
  createId,
  getCharacterRenderMode,
  getCharacterRenderLabel,
  HERO_PROFILE_PLAYER_ID,
  HERO_WEAPON_MODEL_SCALE_MIN,
  HERO_WEAPON_MODEL_SCALE_MAX,
  HERO_WEAPON_OFFSET_MIN,
  HERO_WEAPON_OFFSET_MAX,
  EQUIPMENT_MODEL_TYPES,
  getEquipmentModelReferenceScale,
  normalizeHeroInventoryItem,
  getHeroProfileInventory,
  createDefaultHeroPlayerConfig,
  getHeroProfileNumber,
  getHeroProfileSkill,
  ensureHeroProfileSkill,
  getHeroProfilePower,
  ensureHeroProfilePower,
  applyCharacterModelToActor,
  applyWeaponModelToInventoryItem,
  guessCharacterRenderMode,
  readArcadeImageFile,
} from './rpg3dModeShared.js';

function ArcadeHeroPanel({
  config,
  selected,
  mediaError,
  studioHeroModels = [],
  studioWeaponModels = [],
  onPatchConfig,
  onSetMediaError,
}) {
  const selectedHeroId = selected?.type === 'hero' ? selected.id : '';
  const [heroProfileId, setHeroProfileId] = useState(selectedHeroId || HERO_PROFILE_PLAYER_ID);
  const [activeHeroSectionId, setActiveHeroSectionId] = useState('profile');
  const basePlayer = config.player || DEFAULT_ARCADE_CONFIG.player;
  const heroProfiles = useMemo(() => [
    {
      id: HERO_PROFILE_PLAYER_ID,
      type: 'player',
      label: basePlayer.name || 'Héros principal',
      item: basePlayer,
    },
    ...(config.heroes || []).map((hero, index) => ({
      id: hero.id,
      type: 'hero',
      label: hero.name || `Héros ${index + 1}`,
      item: hero,
      index,
    })),
  ], [basePlayer, config.heroes]);

  useEffect(() => {
    if (!heroProfiles.some((profile) => profile.id === heroProfileId)) {
      setHeroProfileId(HERO_PROFILE_PLAYER_ID);
    }
  }, [heroProfileId, heroProfiles]);

  const activeProfile = heroProfiles.find((profile) => profile.id === heroProfileId) || heroProfiles[0];
  const activeSource = activeProfile?.item || basePlayer;
  const isPlayerProfile = activeProfile?.type !== 'hero';
  const activeDisplayName = isPlayerProfile
    ? activeSource.name || 'Héros principal'
    : activeSource.name || `Héros ${(activeProfile?.index || 0) + 1}`;
  const playerCharacterPreset = getCharacterPreset(activeSource.character || 'runner', 'runner');
  const activeMaxHealth = Math.max(1, getHeroProfileNumber(activeSource, basePlayer, 'maxHealth', DEFAULT_ARCADE_CONFIG.player.maxHealth));
  const activeHealth = clamp(getHeroProfileNumber(activeSource, basePlayer, 'health', activeMaxHealth), 0, activeMaxHealth);
  const activeMaxMana = Math.max(0, getHeroProfileNumber(activeSource, basePlayer, 'maxMana', DEFAULT_ARCADE_CONFIG.player.maxMana));
  const activeMana = clamp(getHeroProfileNumber(activeSource, basePlayer, 'mana', activeMaxMana), 0, activeMaxMana);
  const activeSpeed = Math.round(getHeroProfileNumber(activeSource, basePlayer, 'speed', DEFAULT_ARCADE_CONFIG.player.speed));
  const activeDashSpeed = Math.round(getHeroProfileNumber(activeSource, basePlayer, 'dashSpeed', DEFAULT_ARCADE_CONFIG.player.dashSpeed));
  const activeDashCooldown = getHeroProfileNumber(activeSource, basePlayer, 'dashCooldown', DEFAULT_ARCADE_CONFIG.player.dashCooldown);
  const activeBulletSpeed = Math.round(getHeroProfileNumber(activeSource, basePlayer, 'bulletSpeed', DEFAULT_ARCADE_CONFIG.player.bulletSpeed));
  const activeFireRate = getHeroProfileNumber(activeSource, basePlayer, 'fireRate', DEFAULT_ARCADE_CONFIG.player.fireRate);
  const activeInventory = getHeroProfileInventory(activeSource, basePlayer);
  const forceSkill = getHeroProfileSkill(activeSource, basePlayer, 0);
  const ruseSkill = getHeroProfileSkill(activeSource, basePlayer, 1);
  const magicSkill = getHeroProfileSkill(activeSource, basePlayer, 2);
  const mainPower = getHeroProfilePower(activeSource, basePlayer, 0);
  const visualLabel = activeSource.characterModelName
    || (activeSource.characterImageData
      ? `${activeSource.characterImageName || 'Image personnalisee'} - ${getCharacterRenderLabel(activeSource)}`
      : getCharacterRenderLabel(activeSource));

  const patchActiveHero = useCallback((recipe, recordHistory = true) => {
    const targetProfileId = heroProfileId;
    onPatchConfig((next) => {
      if (!next.player) next.player = createDefaultHeroPlayerConfig();
      const fallbackPlayer = next.player;
      const target = targetProfileId === HERO_PROFILE_PLAYER_ID
        ? fallbackPlayer
        : (next.heroes || []).find((hero) => hero.id === targetProfileId);
      if (!target) return;
      recipe(target, fallbackPlayer, next);
    }, recordHistory);
  }, [heroProfileId, onPatchConfig]);

  const updateField = (field, value, recordHistory = true) => {
    patchActiveHero((target) => {
      target[field] = value;
    }, recordHistory);
  };

  const updateNumber = (field, value, min, max, recordHistory = true) => {
    patchActiveHero((target) => {
      const numberValue = Number(value);
      const parsedValue = Number.isFinite(numberValue) ? numberValue : min;
      target[field] = Number.isFinite(Number(max))
        ? clamp(parsedValue, min, max)
        : Math.max(min, parsedValue);
    }, recordHistory);
  };

  const updateSkill = (index, field, value, options = {}) => {
    patchActiveHero((target, fallback) => {
      const skill = ensureHeroProfileSkill(target, fallback, index);
      if (options.numeric) {
        const min = Number.isFinite(Number(options.min)) ? Number(options.min) : -999;
        const max = Number.isFinite(Number(options.max)) ? Number(options.max) : 999;
        const numberValue = Number(value);
        skill[field] = clamp(Number.isFinite(numberValue) ? numberValue : min, min, max);
      } else {
        skill[field] = value;
      }
    });
  };

  const updatePower = (index, field, value, options = {}) => {
    patchActiveHero((target, fallback) => {
      const power = ensureHeroProfilePower(target, fallback, index);
      if (options.numeric) {
        const min = Number.isFinite(Number(options.min)) ? Number(options.min) : 0;
        const max = Number.isFinite(Number(options.max)) ? Number(options.max) : 999;
        const numberValue = Number(value);
        power[field] = clamp(Number.isFinite(numberValue) ? numberValue : min, min, max);
      } else {
        power[field] = value;
      }
    });
  };

  const addInventoryItem = (type = 'item') => {
    patchActiveHero((target, fallback) => {
      const inventory = getHeroProfileInventory(target, fallback);
      const itemType = HERO_INVENTORY_TYPE_LABELS[type] ? type : 'item';
      target.inventory = [
        ...inventory,
        {
          id: createId('hero-item'),
          name: itemType === 'weapon'
            ? `Arme ${inventory.length + 1}`
            : itemType === 'shield'
              ? `Bouclier ${inventory.length + 1}`
              : itemType === 'armor'
                ? `Armure ${inventory.length + 1}`
                : itemType === 'helmet'
                  ? `Casque ${inventory.length + 1}`
                : `Objet ${inventory.length + 1}`,
          type: itemType,
          quantity: 1,
          effect: '',
        },
      ];
    });
  };

  const updateInventoryItem = (itemId, field, value, options = {}) => {
    patchActiveHero((target, fallback) => {
      const inventory = getHeroProfileInventory(target, fallback);
      target.inventory = inventory.map((item) => {
        if (item.id !== itemId) return item;
        if (options.numeric) {
          const min = Number.isFinite(Number(options.min)) ? Number(options.min) : 1;
          const max = Number.isFinite(Number(options.max)) ? Number(options.max) : 99;
          const numberValue = Number(value);
          const nextItem = {
            ...item,
            [field]: clamp(Number.isFinite(numberValue) ? numberValue : min, min, max),
          };
          if (field === 'weaponModelScale') {
            const model = studioWeaponModels.find((entry) => entry.id === item.weaponModel3dId);
            if (model) nextItem.weaponModelSourceScale = getEquipmentModelReferenceScale(model);
          }
          return {
            ...nextItem,
          };
        }
        return { ...item, [field]: value };
      });
    });
  };

  const updateInventoryWeaponModel = (itemId, modelId) => {
    patchActiveHero((target, fallback) => {
      const inventory = getHeroProfileInventory(target, fallback);
      const model = studioWeaponModels.find((entry) => entry.id === modelId);
      target.inventory = inventory.map((item) => {
        if (item.id !== itemId) return item;
        const next = { ...item, type: EQUIPMENT_MODEL_TYPES.has(item.type) ? item.type : 'weapon' };
        applyWeaponModelToInventoryItem(next, model);
        return normalizeHeroInventoryItem(next);
      });
    }, false);
  };

  const setInventoryWeaponEquipped = (itemId, equipped) => {
    patchActiveHero((target, fallback) => {
      const inventory = getHeroProfileInventory(target, fallback);
      const targetType = inventory.find((item) => item.id === itemId)?.type;
      if (!EQUIPMENT_MODEL_TYPES.has(targetType)) return;
      target.inventory = inventory.map((item) => (
        item.type === targetType
          ? { ...item, equipped: equipped && item.id === itemId }
          : item
      ));
    });
  };

  const removeInventoryItem = (itemId) => {
    patchActiveHero((target, fallback) => {
      target.inventory = getHeroProfileInventory(target, fallback).filter((item) => item.id !== itemId);
    });
  };

  const updateMaxHealth = (value) => {
    patchActiveHero((target, fallback) => {
      const nextMaxHealth = Math.max(1, Number(value) || 1);
      target.maxHealth = nextMaxHealth;
      target.health = clamp(getHeroProfileNumber(target, fallback, 'health', nextMaxHealth), 0, nextMaxHealth);
    });
  };

  const updateMaxMana = (value) => {
    patchActiveHero((target, fallback) => {
      const nextMaxMana = Math.max(0, Number(value) || 0);
      target.maxMana = nextMaxMana;
      target.mana = clamp(getHeroProfileNumber(target, fallback, 'mana', nextMaxMana), 0, nextMaxMana);
    });
  };

  const handleCharacterImageUpload = useCallback(async (file) => {
    if (!file) return;
    const targetProfileId = heroProfileId;
    try {
      const imageData = await readArcadeImageFile(file);
      onSetMediaError?.('');
      onPatchConfig((next) => {
        if (!next.player) next.player = createDefaultHeroPlayerConfig();
        const target = targetProfileId === HERO_PROFILE_PLAYER_ID
          ? next.player
          : (next.heroes || []).find((hero) => hero.id === targetProfileId);
        if (!target) return;
        const guessedRenderMode = guessCharacterRenderMode(file.name || '');
        target.characterImageData = imageData;
        target.characterImageName = file.name || 'heros';
        target.characterModel3dId = '';
        target.characterModelUrl = '';
        target.characterModelName = '';
        target.characterModelFormat = '';
        target.characterModelFileSize = 0;
        target.characterModelResources = [];
        target.characterModelAnimations = {};
        target.characterLocalModelFileId = '';
        target.characterRenderMode = guessedRenderMode === 'capsule' ? 'sprite' : guessedRenderMode;
        if (!target.characterModelScale) target.characterModelScale = 1;
        if (!target.characterModelScaleX) target.characterModelScaleX = target.characterModelScale;
        if (!target.characterModelScaleY) target.characterModelScaleY = target.characterModelScale;
        if (!target.characterModelScaleZ) target.characterModelScaleZ = target.characterModelScale;
        target.characterModelScaleProportional = target.characterModelScaleProportional !== false;
        target.characterMaterialBrightness = getCharacterMaterialBrightness(target);
      });
    } catch (error) {
      onSetMediaError?.(error?.message || "Impossible de charger l'image.");
    }
  }, [heroProfileId, onPatchConfig, onSetMediaError]);

  return (
    <section className="arcade-management-tab arcade-hero-tab" aria-label="Gestion du héros">
      <section className="panel arcade-management-summary arcade-hero-summary">
        <div>
          <span className="section-kicker"><HeartPulse aria-hidden="true" size={14} /> Héros</span>
          <h2>{activeDisplayName}</h2>
        </div>
        <div className="arcade-canvas-summary-stats arcade-hero-summary-stats">
          <span>
            <strong>{Math.round(activeHealth)} / {Math.round(activeMaxHealth)}</strong>
            <small>Points de vie</small>
          </span>
          <span>
            <strong>{Math.round(activeMana)} / {Math.round(activeMaxMana)}</strong>
            <small>Mana</small>
          </span>
          <span>
            <strong>{Number(forceSkill.value) || 0}</strong>
            <small>Force</small>
          </span>
          <span>
            <strong>{mainPower.name || 'Pouvoir'}</strong>
            <small>Pouvoir</small>
          </span>
        </div>
      </section>

      <div className="arcade-hero-workspace">
        <aside className="panel arcade-hero-sidebar" aria-label="Navigation héros">
          <label className="arcade-hero-profile-picker">
            <span>Profil</span>
            <select value={activeProfile?.id || HERO_PROFILE_PLAYER_ID} onChange={(event) => setHeroProfileId(event.target.value)}>
              {heroProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.label}</option>
              ))}
            </select>
          </label>
          <div className="arcade-hero-section-tabs" role="tablist" aria-label="Sections du héros">
            {HERO_PROFILE_SECTION_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeHeroSectionId === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`arcade-hero-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-label={tab.meta ? `${tab.label} ${tab.meta}` : tab.label}
                  aria-selected={active}
                  aria-controls={`arcade-hero-panel-${tab.id}`}
                  className={active ? 'active' : ''}
                  onClick={() => setActiveHeroSectionId(tab.id)}
                >
                  <Icon aria-hidden="true" size={16} />
                  <span className="arcade-hero-section-text">
                    <span>{tab.label}</span>
                    {tab.meta ? <small>{tab.meta}</small> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="arcade-hero-content">
          {activeHeroSectionId === 'profile' ? (
      <section
        id="arcade-hero-panel-profile"
        className="panel arcade-management-panel arcade-hero-appearance-panel"
        role="tabpanel"
        aria-labelledby="arcade-hero-tab-profile"
      >
        <div className="panel-head">
          <div>
            <span className="section-kicker"><Shield aria-hidden="true" size={14} /> Profil</span>
            <h2>Identite & apparence</h2>
          </div>
        </div>
        <div className="arcade-hero-form-grid">
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.heroName}>Nom</Rpg3DHelpLabel>
            <input
              value={activeSource.name || ''}
              placeholder={activeDisplayName}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.playerCharacter}>Personnage principal</Rpg3DHelpLabel>
            <select value={activeSource.character || 'runner'} onChange={(event) => updateField('character', event.target.value)}>
              {PLAYER_CHARACTER_OPTIONS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <div className="arcade-character-summary arcade-hero-character-summary">
            <span
              className="arcade-character-token"
              style={{ '--arcade-character-body': playerCharacterPreset.body, '--arcade-character-accent': playerCharacterPreset.accent }}
            >
              {activeSource.characterImageData ? <img src={activeSource.characterImageData} alt="" /> : null}
            </span>
            <div>
              <strong>{playerCharacterPreset.label}</strong>
              <small>{visualLabel}</small>
            </div>
          </div>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterRenderMode}>Rendu personnage 3D</Rpg3DHelpLabel>
            <select value={getCharacterRenderMode(activeSource)} onChange={(event) => updateField('characterRenderMode', event.target.value, false)}>
              {CHARACTER_RENDER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterModel}>Modèle 3D</Rpg3DHelpLabel>
            <select value={activeSource.characterModel3dId || ''} onChange={(event) => patchActiveHero((target) => {
              const model = studioHeroModels.find((entry) => entry.id === event.target.value);
              applyCharacterModelToActor(target, model, studioWeaponModels);
            }, false)}>
              <option value="">Aucun</option>
              {studioHeroModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name || model.modelName || 'Modèle 3D'}</option>
              ))}
            </select>
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterScale}>Taille 3D ({getCharacterModelScale(activeSource).toFixed(2)})</Rpg3DHelpLabel>
            <input
              type="range"
              min={MODEL_SCALE_MIN}
              max={MODEL_SCALE_MAX}
              step="0.1"
              value={getCharacterModelScale(activeSource)}
              onChange={(event) => patchActiveHero((target) => {
                const scale = clamp(Number(event.target.value), MODEL_SCALE_MIN, MODEL_SCALE_MAX);
                target.characterModelScale = scale;
                target.characterModelScaleY = scale;
                if (target.characterModelScaleProportional !== false) {
                  target.characterModelScaleX = scale;
                  target.characterModelScaleZ = scale;
                }
              }, false)}
            />
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.characterMaterialBrightness}>Lumiere carte {Math.round(getCharacterMaterialBrightness(activeSource) * 100)}%</Rpg3DHelpLabel>
            <input
              type="range"
              min={MATERIAL_BRIGHTNESS_MIN}
              max={MATERIAL_BRIGHTNESS_MAX}
              step="0.05"
              value={getCharacterMaterialBrightness(activeSource)}
              onChange={(event) => updateNumber('characterMaterialBrightness', event.target.value, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX, false)}
            />
          </label>
        </div>
        <div className="arcade-hero-media-actions">
          <label className="button like secondary-action arcade-file-button">
            Importer image héros
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                handleCharacterImageUpload(file);
              }}
            />
          </label>
          {activeSource.characterImageData ? (
            <button type="button" className="secondary-action" onClick={() => {
              onSetMediaError?.('');
              patchActiveHero((target) => {
                target.characterImageData = '';
                target.characterImageName = '';
              });
            }}>Retirer image</button>
          ) : null}
          {activeSource.characterModelUrl ? (
            <button type="button" className="secondary-action" onClick={() => {
              onSetMediaError?.('');
              patchActiveHero((target) => {
                applyCharacterModelToActor(target, null, studioWeaponModels);
              }, false);
            }}>Retirer modèle 3D</button>
          ) : null}
        </div>
        {mediaError ? <p className="arcade-empty-state">{mediaError}</p> : null}
      </section>
          ) : null}

          {activeHeroSectionId === 'stats' ? (
      <section
        id="arcade-hero-panel-stats"
        className="panel arcade-management-panel arcade-hero-stats-panel"
        role="tabpanel"
        aria-labelledby="arcade-hero-tab-stats"
      >
        <div className="panel-head">
          <div>
            <span className="section-kicker"><HeartPulse aria-hidden="true" size={14} /> Stats</span>
            <h2>Points & ressources</h2>
          </div>
        </div>
        <div className="arcade-hero-form-grid">
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.currentHealth}>PV actuels</Rpg3DHelpLabel>
            <input type="number" min="0" max={activeMaxHealth} value={activeHealth} onChange={(event) => updateNumber('health', event.target.value, 0, activeMaxHealth)} />
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.maxHealth}>PV max</Rpg3DHelpLabel>
            <input type="number" min="1" max="999" value={activeMaxHealth} onChange={(event) => updateMaxHealth(event.target.value)} />
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.currentMana}>Mana actuelle</Rpg3DHelpLabel>
            <input type="number" min="0" max={activeMaxMana} value={activeMana} onChange={(event) => updateNumber('mana', event.target.value, 0, activeMaxMana)} />
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.maxMana}>Mana max</Rpg3DHelpLabel>
            <input type="number" min="0" max="999" value={activeMaxMana} onChange={(event) => updateMaxMana(event.target.value)} />
          </label>
          <label>
            <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.playerSpeed}>Vitesse joueur ({activeSpeed})</Rpg3DHelpLabel>
            <input type="range" min="120" max="520" step="10" value={activeSpeed} onChange={(event) => updateNumber('speed', event.target.value, 120, 520, false)} />
          </label>
          <label>
            <span>Vitesse dash ({activeDashSpeed})</span>
            <input type="range" min="300" max="1100" step="10" value={activeDashSpeed} onChange={(event) => updateNumber('dashSpeed', event.target.value, 300, 1100, false)} />
          </label>
          <label>
            <span>Recharge dash ({activeDashCooldown.toFixed(2)}s)</span>
            <input type="range" min="0.2" max="3" step="0.05" value={activeDashCooldown} onChange={(event) => updateNumber('dashCooldown', event.target.value, 0.2, 3, false)} />
          </label>
        </div>
      </section>
          ) : null}

      {activeHeroSectionId === 'skills' ? (
      <section
        id="arcade-hero-panel-skills"
        className="panel arcade-management-panel arcade-hero-combat-panel"
        role="tabpanel"
        aria-labelledby="arcade-hero-tab-skills"
      >
        <div className="panel-head">
          <div>
            <span className="section-kicker"><Sword aria-hidden="true" size={14} /> Competences</span>
            <h2>Force & pouvoirs</h2>
          </div>
        </div>
        <div className="arcade-hero-combat-grid">
          <div className="arcade-hero-subsection">
            <h3>Caracteristiques</h3>
            <div className="arcade-hero-form-grid">
              <label>
                <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.attackBonus}>Force</Rpg3DHelpLabel>
                <input type="number" min="-20" max="999" value={Number(forceSkill.value) || 0} onChange={(event) => updateSkill(0, 'value', event.target.value, { numeric: true, min: -20, max: 999 })} />
              </label>
              <label>
                <span>Ruse</span>
                <input type="number" min="-20" max="999" value={Number(ruseSkill.value) || 0} onChange={(event) => updateSkill(1, 'value', event.target.value, { numeric: true, min: -20, max: 999 })} />
              </label>
              <label>
                <span>Magie</span>
                <input type="number" min="-20" max="999" value={Number(magicSkill.value) || 0} onChange={(event) => updateSkill(2, 'value', event.target.value, { numeric: true, min: -20, max: 999 })} />
              </label>
              <label>
                <span>Cout mana magie</span>
                <input type="number" min="0" max="99" value={Number(magicSkill.manaCost) || 0} onChange={(event) => updateSkill(2, 'manaCost', event.target.value, { numeric: true, min: 0, max: 99 })} />
              </label>
            </div>
          </div>
          <div className="arcade-hero-subsection">
            <h3>Attaque principale</h3>
            <div className="arcade-hero-form-grid">
              <label>
                <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.attackSkill}>Nom attaque</Rpg3DHelpLabel>
                <input value={forceSkill.name || ''} onChange={(event) => updateSkill(0, 'name', event.target.value)} />
              </label>
              <label>
                <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.attackManaCost}>Cout mana attaque</Rpg3DHelpLabel>
                <input type="number" min="0" max="99" value={Number(forceSkill.manaCost) || 0} onChange={(event) => updateSkill(0, 'manaCost', event.target.value, { numeric: true, min: 0, max: 99 })} />
              </label>
              <label>
                <span>Vitesse projectile ({activeBulletSpeed})</span>
                <input type="range" min="260" max="1200" step="10" value={activeBulletSpeed} onChange={(event) => updateNumber('bulletSpeed', event.target.value, 260, 1200, false)} />
              </label>
              <label>
                <span>Cadence ({activeFireRate.toFixed(2)}s)</span>
                <input type="range" min="0.05" max="0.8" step="0.01" value={activeFireRate} onChange={(event) => updateNumber('fireRate', event.target.value, 0.05, 0.8, false)} />
              </label>
            </div>
          </div>
          <div className="arcade-hero-subsection">
            <h3>Pouvoir</h3>
            <div className="arcade-hero-form-grid">
              <label>
                <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerName}>Nom pouvoir</Rpg3DHelpLabel>
                <input value={mainPower.name || ''} onChange={(event) => updatePower(0, 'name', event.target.value)} />
              </label>
              <label>
                <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerForce}>Force pouvoir</Rpg3DHelpLabel>
                <input type="number" min="0" max="999" value={Number(mainPower.force) || 0} onChange={(event) => updatePower(0, 'force', event.target.value, { numeric: true, min: 0, max: 999 })} />
              </label>
              <label>
                <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerManaCost}>Cout mana pouvoir</Rpg3DHelpLabel>
                <input type="number" min="0" max="999" value={Number(mainPower.manaCost) || 0} onChange={(event) => updatePower(0, 'manaCost', event.target.value, { numeric: true, min: 0, max: 999 })} />
              </label>
              <label>
                <Rpg3DHelpLabel help={RPG3D_FIELD_HELP.powerElement}>Element pouvoir</Rpg3DHelpLabel>
                <select value={mainPower.type || 'fire'} onChange={(event) => updatePower(0, 'type', event.target.value)}>
                  <option value="fire">Feu</option>
                  <option value="water">Eau</option>
                  <option value="earth">Terre</option>
                  <option value="lightning">Foudre</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {activeHeroSectionId === 'inventory' ? (
      <section
        id="arcade-hero-panel-inventory"
        className="panel arcade-management-panel arcade-hero-inventory-panel"
        role="tabpanel"
        aria-labelledby="arcade-hero-tab-inventory"
      >
        <div className="panel-head">
          <div>
            <span className="section-kicker"><Box aria-hidden="true" size={14} /> Inventaire</span>
            <h2>Objets du héros</h2>
          </div>
          <div className="arcade-hero-inventory-head-actions">
            <button type="button" onClick={() => addInventoryItem()}>
              <Plus aria-hidden="true" size={16} />
              Objet
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('weapon')}>
              <Sword aria-hidden="true" size={16} />
              Arme
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('helmet')}>
              <HardHat aria-hidden="true" size={16} />
              Casque
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('armor')}>
              <Cuboid aria-hidden="true" size={16} />
              Armure
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('shield')}>
              <Shield aria-hidden="true" size={16} />
              Bouclier
            </button>
          </div>
        </div>
        {activeInventory.length ? (
          <div className="arcade-hero-inventory-list">
            {activeInventory.map((item) => (
              <article className={`arcade-hero-inventory-row${EQUIPMENT_MODEL_TYPES.has(item.type) ? ' weapon' : ''}`} key={item.id}>
                <label>
                  <span>Nom</span>
                  <input
                    value={item.name}
                    placeholder="Objet"
                    onChange={(event) => updateInventoryItem(item.id, 'name', event.target.value)}
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select value={item.type} onChange={(event) => updateInventoryItem(item.id, 'type', event.target.value)}>
                    {HERO_INVENTORY_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Quantite</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={item.quantity}
                    onChange={(event) => updateInventoryItem(item.id, 'quantity', event.target.value, { numeric: true, min: 1, max: 99 })}
                  />
                </label>
                <label>
                  <span>Effet</span>
                  <input
                    value={item.effect}
                    placeholder="Bonus, cle, soin..."
                    onChange={(event) => updateInventoryItem(item.id, 'effect', event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="danger-button arcade-hero-inventory-delete"
                  title="Supprimer l'objet"
                  aria-label={`Supprimer ${item.name || 'cet objet'}`}
                  onClick={() => removeInventoryItem(item.id)}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
                {EQUIPMENT_MODEL_TYPES.has(item.type) ? (
                  <div className="arcade-hero-weapon-settings">
                    <label>
                      <span>Modèle {item.type === 'shield' ? 'bouclier' : (item.type === 'armor' ? 'armure' : (item.type === 'helmet' ? 'casque' : (item.type === 'leggings' ? 'jambières' : 'arme')))}</span>
                      <select value={item.weaponModel3dId || ''} onChange={(event) => updateInventoryWeaponModel(item.id, event.target.value)}>
                        <option value="">Aucun modèle</option>
                        {studioWeaponModels.map((model) => (
                          <option key={model.id} value={model.id}>{model.name || model.modelName || (item.type === 'shield' ? 'Bouclier 3D' : (item.type === 'armor' ? 'Armure 3D' : (item.type === 'helmet' ? 'Casque 3D' : (item.type === 'leggings' ? 'Jambieres 3D' : 'Arme 3D'))))}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className={item.equipped ? 'secondary-action active' : 'secondary-action'}
                      disabled={!item.weaponModelUrl}
                      onClick={() => setInventoryWeaponEquipped(item.id, !item.equipped)}
                    >
                      {item.type === 'shield'
                        ? <Shield aria-hidden="true" size={16} />
                        : item.type === 'armor'
                          ? <Cuboid aria-hidden="true" size={16} />
                          : item.type === 'helmet'
                            ? <HardHat aria-hidden="true" size={16} />
                            : item.type === 'leggings'
                              ? <Footprints aria-hidden="true" size={16} />
                          : <Sword aria-hidden="true" size={16} />}
                      {item.equipped ? 'Equipe' : 'Equiper'}
                    </button>
                    <label>
                      <span>Taille {Number(item.weaponModelScale || 1).toFixed(3)}</span>
                      <input
                        type="range"
                        min={HERO_WEAPON_MODEL_SCALE_MIN}
                        max={HERO_WEAPON_MODEL_SCALE_MAX}
                        step="0.001"
                        value={item.weaponModelScale || 1}
                        onChange={(event) => updateInventoryItem(item.id, 'weaponModelScale', event.target.value, {
                          numeric: true,
                          min: HERO_WEAPON_MODEL_SCALE_MIN,
                          max: HERO_WEAPON_MODEL_SCALE_MAX,
                        })}
                      />
                    </label>
                    <label>
                      <span>Offset X</span>
                      <input type="number" min={HERO_WEAPON_OFFSET_MIN} max={HERO_WEAPON_OFFSET_MAX} step="0.01" value={item.weaponOffsetX || 0} onChange={(event) => updateInventoryItem(item.id, 'weaponOffsetX', event.target.value, { numeric: true, min: HERO_WEAPON_OFFSET_MIN, max: HERO_WEAPON_OFFSET_MAX })} />
                    </label>
                    <label>
                      <span>Offset Y</span>
                      <input type="number" min={HERO_WEAPON_OFFSET_MIN} max={HERO_WEAPON_OFFSET_MAX} step="0.01" value={item.weaponOffsetY || 0} onChange={(event) => updateInventoryItem(item.id, 'weaponOffsetY', event.target.value, { numeric: true, min: HERO_WEAPON_OFFSET_MIN, max: HERO_WEAPON_OFFSET_MAX })} />
                    </label>
                    <label>
                      <span>Offset Z</span>
                      <input type="number" min={HERO_WEAPON_OFFSET_MIN} max={HERO_WEAPON_OFFSET_MAX} step="0.01" value={item.weaponOffsetZ || 0} onChange={(event) => updateInventoryItem(item.id, 'weaponOffsetZ', event.target.value, { numeric: true, min: HERO_WEAPON_OFFSET_MIN, max: HERO_WEAPON_OFFSET_MAX })} />
                    </label>
                    <label>
                      <span>Rot X</span>
                      <input type="number" min="-180" max="180" step="5" value={item.weaponRotationX || 0} onChange={(event) => updateInventoryItem(item.id, 'weaponRotationX', event.target.value, { numeric: true, min: -180, max: 180 })} />
                    </label>
                    <label>
                      <span>Rot Y</span>
                      <input type="number" min="-180" max="180" step="5" value={item.weaponRotationY || 0} onChange={(event) => updateInventoryItem(item.id, 'weaponRotationY', event.target.value, { numeric: true, min: -180, max: 180 })} />
                    </label>
                    <label>
                      <span>Rot Z</span>
                      <input type="number" min="-180" max="180" step="5" value={item.weaponRotationZ || 0} onChange={(event) => updateInventoryItem(item.id, 'weaponRotationZ', event.target.value, { numeric: true, min: -180, max: 180 })} />
                    </label>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="arcade-hero-inventory-empty">
            <Box aria-hidden="true" size={22} />
            <p>Aucun objet dans l'inventaire de depart.</p>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem()}>
              <Plus aria-hidden="true" size={16} />
              Ajouter un objet
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('weapon')}>
              <Sword aria-hidden="true" size={16} />
              Ajouter une arme
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('helmet')}>
              <HardHat aria-hidden="true" size={16} />
              Ajouter un casque
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('armor')}>
              <Cuboid aria-hidden="true" size={16} />
              Ajouter une armure
            </button>
            <button type="button" className="secondary-action" onClick={() => addInventoryItem('shield')}>
              <Shield aria-hidden="true" size={16} />
              Ajouter un bouclier
            </button>
          </div>
        )}
      </section>
      ) : null}
        </div>
      </div>
    </section>
  );
}

export default ArcadeHeroPanel;
