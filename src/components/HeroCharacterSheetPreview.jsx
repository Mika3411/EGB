import { Eye } from 'lucide-react';
import { DEFAULT_EDITOR_EQUIPMENT_SLOT_LABELS as DEFAULT_EQUIPMENT_SLOT_LABELS } from '../lib/heroAdventureDefaults.js';

const HERO_POWER_TYPE_LABELS = {
  water: 'Eau',
  earth: 'Terre',
  fire: 'Feu',
  lightning: 'Foudre',
};

const HERO_RESISTANCE_FIELDS = [
  { id: 'water', label: 'Eau', field: 'resistanceWater' },
  { id: 'earth', label: 'Terre', field: 'resistanceEarth' },
  { id: 'fire', label: 'Feu', field: 'resistanceFire' },
  { id: 'lightning', label: 'Foudre', field: 'resistanceLightning' },
];

const normalizeHeroStatKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const getHeroForceSkill = (skills = []) => (
  skills.find((skill) => (
    normalizeHeroStatKey(skill.id) === 'force'
    || normalizeHeroStatKey(skill.name) === 'force'
  )) || skills[0] || null
);

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const formatPowerRecovery = (power = {}) => (
  [
    Number(power.healHealth) ? `+${Math.max(0, Number(power.healHealth) || 0)} PV` : '',
    Number(power.healMana) ? `+${Math.max(0, Number(power.healMana) || 0)} mana` : '',
  ].filter(Boolean).join(' · ')
);

export default function HeroCharacterSheetPreview({
  hero = {},
  heroAdventure = {},
  onOpenPlayerPreview,
}) {
  const heroSkills = Array.isArray(hero.skills) ? hero.skills : [];
  const heroPowers = Array.isArray(hero.powers) ? hero.powers : [];
  const activeRules = hero.rules || heroAdventure.rules || {};
  const diceSides = Math.max(2, Number(heroAdventure.dice?.sides) || 20);
  const diceLabel = heroAdventure.dice?.label || `d${diceSides}`;
  const forceSkill = getHeroForceSkill(heroSkills);
  const heroForceDamage = Math.max(0, Number(forceSkill?.value) || 0);
  const criticalSuccess = Math.max(1, Number(activeRules.criticalSuccess) || diceSides);
  const criticalChance = clampPercent(activeRules.criticalChance);
  const criticalMultiplier = Math.max(1, Number(activeRules.criticalMultiplier) || 2);
  const strongestPower = heroPowers.reduce((best, power) => (
    Math.max(0, Number(power.force) || 0) > Math.max(0, Number(best?.force) || 0) ? power : best
  ), null);
  const strongestMagicDamage = strongestPower
    ? heroForceDamage + Math.max(0, Number(strongestPower.force) || 0)
    : heroForceDamage;
  const equipmentSlotCount = Math.max(1, Math.min(8, Number(hero.equipmentSlotCount) || 6));
  const equipmentSlotLabels = DEFAULT_EQUIPMENT_SLOT_LABELS.map((label, index) => (
    hero.equipmentSlotLabels?.[index] || label
  ));
  const heroBackgroundStyle = hero.backgroundImageData
    ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.28), rgba(2,6,23,.88)), url(${hero.backgroundImageData})` }
    : undefined;

  return (
    <div className="hero-preview-dashboard" data-tour="hero-preview-panel">
      <section className="subpanel hero-preview-panel-head">
        <div className="subpanel-head">
          <div>
            <h3>Fiche du personnage sélectionné</h3>
            <p>{hero.name || 'Héros'} est la fiche active utilisée par la Preview et les combats Hero.</p>
          </div>
          <button type="button" className="secondary-action compact" onClick={onOpenPlayerPreview}>
            <Eye size={16} aria-hidden="true" />
            Tester
          </button>
        </div>
      </section>

      <section className="hero-editor-character-preview" aria-label={`Fiche de ${hero.name || 'Héros'}`}>
        <div className="hero-character-page hero-character-page--editor" style={heroBackgroundStyle}>
          <div className="hero-paper-doll">
            <div className="hero-equipment-slot-grid" aria-label="Emplacements portés">
              {Array.from({ length: equipmentSlotCount }, (_, index) => (
                <span
                  key={`slot-${index}`}
                  className={`hero-equipment-slot slot-${index % 8} is-empty`}
                >
                  <span className="hero-equipment-slot-thumb">+</span>
                  <small>{equipmentSlotLabels[index] || `Slot ${index + 1}`}</small>
                </span>
              ))}
            </div>

            <div className="hero-character-core">
              <div className="hero-character-portrait">
                {hero.characterImageData ? (
                  <img src={hero.characterImageData} alt={hero.name || 'Héros'} />
                ) : (
                  <span>{hero.name?.slice(0, 1) || 'H'}</span>
                )}
              </div>
              <span className="eyebrow">Personnage</span>
              <h3>{hero.name || 'Héros'}</h3>
              <small>{diceLabel} principal</small>
              <div className="hero-character-core-stats">
                <span>{hero.health ?? 0}/{hero.maxHealth ?? 0} PV</span>
                <span>{hero.mana ?? 0}/{hero.maxMana ?? 0} Mana</span>
                <span>Crit {criticalChance}% x{criticalMultiplier}</span>
              </div>
            </div>
          </div>

          {hero.description ? <p className="hero-character-description">{hero.description}</p> : null}

          <div className="hero-character-skills">
            {heroSkills.map((skill) => (
              <span key={skill.id}><strong>{skill.name}</strong> +{skill.value}</span>
            ))}
          </div>

          <div className="hero-character-combat">
            <div className="hero-character-combat-stats">
              <span>
                <small>Attaque</small>
                <strong>{heroForceDamage}</strong>
                <em>force</em>
              </span>
              <span>
                <small>Critique</small>
                <strong>{criticalChance}%</strong>
                <em>sur {criticalSuccess}, x{criticalMultiplier}</em>
              </span>
              <span>
                <small>Magie max</small>
                <strong>{strongestMagicDamage}</strong>
                <em>{strongestPower?.name || 'sans pouvoir'}</em>
              </span>
              <span>
                <small>Armure</small>
                <strong>{Math.max(0, Number(hero.armor) || 0)}</strong>
                <em>réduction</em>
              </span>
              <span>
                <small>Initiative</small>
                <strong>{Math.max(-999, Math.min(999, Number(hero.initiative) || 0))}</strong>
                <em>ordre</em>
              </span>
              <span>
                <small>Esquive</small>
                <strong>{clampPercent(hero.dodgeChance)}%</strong>
                <em>annulation</em>
              </span>
            </div>

            {heroPowers.length ? (
              <div className="hero-character-power-list">
                {heroPowers.map((power) => {
                  const manaCost = Math.max(0, Number(power.manaCost) || 0);
                  const powerForce = Math.max(0, Number(power.force) || 0);
                  const recoveryText = formatPowerRecovery(power);
                  return (
                    <article className="hero-character-power" key={power.id}>
                      <strong>{power.name || 'Pouvoir'}</strong>
                      <span>{HERO_POWER_TYPE_LABELS[power.type] || power.type || 'Pouvoir'}</span>
                      <small>{manaCost} mana · +{powerForce} force · {heroForceDamage + powerForce} dégâts{recoveryText ? ` · ${recoveryText}` : ''}</small>
                    </article>
                  );
                })}
              </div>
            ) : null}

            <div className="hero-character-resistances">
              {HERO_RESISTANCE_FIELDS.map((resistance) => (
                <span key={resistance.id}>
                  <strong>{resistance.label}</strong>
                  <em>{clampPercent(hero[resistance.field])}%</em>
                </span>
              ))}
            </div>
          </div>

          <div className="hero-character-section">
            <h4>Objets portés <small>bonus actifs</small></h4>
            <div className="hero-equipped-list">
              <p className="hero-preview-empty">Les équipements portés pendant le jeu apparaîtront ici.</p>
            </div>
          </div>

          <div className="hero-character-section hero-inventory-dropzone is-empty">
            <h4>Inventaire <small>objets transportés</small></h4>
            <div className="inventory-grid">
              <p>Les objets obtenus en Preview apparaîtront ici.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
