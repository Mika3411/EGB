import { useEffect } from 'react';
import { Image as ImageIcon, Package, Plus, Trash2 } from 'lucide-react';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import NumberInput from './forms/NumberInput.jsx';
import { HelpLabel } from './scenes/SceneEditorChrome.jsx';

const FALLBACK_HERO_SKILLS = [
  { id: 'force', name: 'Force', value: 3, manaCost: 0 },
  { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
  { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
];

export default function ObjectsTab({
  project,
  patchProject,
  addItem,
  deleteItem,
  selectedItemId,
  setSelectedItemId,
  selectedItem,
  handleUpload,
  mediaLibrary,
}) {
  const items = project.items || [];
  const isHeroAdventureProject = project.creationMode === 'hero_adventure' || Boolean(project.heroAdventure?.enabled);
  const heroSkills = project.heroAdventure?.hero.skills?.length ? project.heroAdventure.hero.skills : FALLBACK_HERO_SKILLS;

  useEffect(() => {
    if (!items.length && selectedItemId) {
      setSelectedItemId('');
      return;
    }
    if (items.length && !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId, setSelectedItemId]);

  const patchSelectedItem = (updater) => {
    if (!selectedItemId) return;
    patchProject((draft) => {
      const item = draft.items.find((entry) => entry.id === selectedItemId);
      if (item) updater(item);
    });
  };

  const handleDeleteSelectedItem = () => {
    if (!selectedItemId || !selectedItem) return;
    deleteItem(selectedItemId);
  };

  return (
    <main className="objects-tab">
      <section className="panel objects-list-panel" data-tour="inventory">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Créer</span>
            <h2>Objets</h2>
            <p className="small-note">{items.length} objet{items.length > 1 ? 's' : ''} d'inventaire</p>
          </div>
          <button type="button" className="primary-action" data-tour="object-create" onClick={addItem}>
            <Plus aria-hidden="true" size={16} />
            <span>Objet</span>
          </button>
        </div>

        <div className="object-nav-list objects-tab-list" aria-label="Objets d'inventaire">
          {items.length ? items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`object-nav-item ${item.id === selectedItemId ? 'selected' : ''} ${item.aiGenerated ? 'ai-editor-glow' : ''}`}
              onClick={() => setSelectedItemId(item.id)}
              aria-current={item.id === selectedItemId ? 'true' : undefined}
            >
              <span className="object-nav-thumb">
                {item.imageData ? <img src={item.imageData} alt="" /> : <span>{item.icon || '📦'}</span>}
              </span>
              <span className="object-nav-copy">
                <strong>{item.name || 'Objet sans nom'}{item.aiGenerated ? <em className="ai-editor-badge">IA</em> : null}</strong>
                <small>{item.imageName || 'Emoji de secours'}</small>
              </span>
            </button>
          )) : (
            <div className="empty-state-inline">
              Aucun objet pour l'instant.
            </div>
          )}
        </div>
      </section>

      <section className="panel objects-editor-panel">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Fiche objet</span>
            <h2>{selectedItem ? selectedItem.name || 'Objet sans nom' : 'Aucun objet sélectionné'}</h2>
          </div>
        </div>

        {selectedItem ? (
          <div className="objects-editor-form">
            <div className="object-editor-preview">
              <div className="icon-preview inventory-object-preview">
                {selectedItem.imageData ? <img src={selectedItem.imageData} alt={selectedItem.name} /> : <span>{selectedItem.icon || '📦'}</span>}
              </div>
              <div>
                <strong>{selectedItem.name || 'Objet sans nom'}</strong>
                <small>{selectedItem.imageName || 'Aucune image importée'}</small>
              </div>
            </div>

            <HelpLabel help="Nom de l'objet dans l'inventaire. C'est le libellé que le joueur voit lorsqu'il obtient ou consulte cet objet.">Nom de l'objet</HelpLabel>
            <input
              data-tour="object-name"
              value={selectedItem.name}
              onChange={(event) => patchSelectedItem((item) => {
                item.name = event.target.value;
              })}
            />

            <HelpLabel help="Image utilisée comme miniature d'inventaire. Si elle est absente, l'emoji de secours est utilisé à la place.">Image de l'objet</HelpLabel>
            <MediaSourcePicker
              className="button like full secondary-action"
              accept="image/*"
              handleUpload={handleUpload}
              mediaLibrary={mediaLibrary}
              onSelect={(data, name) => patchSelectedItem((item) => {
                item.imageData = data;
                item.imageName = name;
              })}
              tourId="object-image"
            >
              <ImageIcon aria-hidden="true" size={16} />
              <span>{selectedItem.imageName || 'Importer une image objet'}</span>
            </MediaSourcePicker>

            <HelpLabel help="Symbole affiché quand aucune image d'inventaire n'est fournie, ou comme repère visuel léger dans les listes.">Emoji de secours</HelpLabel>
            <input
              value={selectedItem.icon}
              onChange={(event) => patchSelectedItem((item) => {
                item.icon = event.target.value;
              })}
            />

            {isHeroAdventureProject ? (
              <div className="nested-editor-card hero-skill-check-editor">
                <HelpLabel help="Effet appliqué en Preview quand le joueur clique cet objet dans l'inventaire. Aucun effet garde l'objet comme indice classique.">Effet héros</HelpLabel>
                <select value={selectedItem.heroItemType || 'none'} onChange={(event) => patchSelectedItem((item) => {
                  item.heroItemType = event.target.value;
                  if (event.target.value === 'health_potion') {
                    item.heroItemAmount = item.heroItemAmount || 4;
                    item.heroItemConsumeOnUse = item.heroItemConsumeOnUse ?? true;
                  }
                  if (event.target.value === 'mana_potion') {
                    item.heroItemAmount = item.heroItemAmount || 3;
                    item.heroItemConsumeOnUse = item.heroItemConsumeOnUse ?? true;
                  }
                  if (event.target.value === 'equipment') {
                    item.heroItemBonus = item.heroItemBonus || 1;
                    item.heroItemBonusTarget = item.heroItemBonusTarget || 'skill';
                    item.heroItemSkillId = item.heroItemSkillId || heroSkills[0]?.id || '';
                    item.heroItemConsumeOnUse = false;
                  }
                })}>
                  <option value="none">Aucun effet</option>
                  <option value="health_potion">Potion de soin</option>
                  <option value="mana_potion">Potion de mana</option>
                  <option value="equipment">Équipement avec bonus</option>
                </select>

                {['health_potion', 'mana_potion'].includes(selectedItem.heroItemType || 'none') ? (
                  <>
                    <HelpLabel help="Nombre de PV ou de mana rendus. La jauge ne dépasse jamais le maximum configuré dans l'onglet Héros.">Quantité restaurée</HelpLabel>
                    <NumberInput
                      min="1"
                      max="99"
                      value={selectedItem.heroItemAmount || 4}
                      onValueChange={(nextValue) => patchSelectedItem((item) => {
                        item.heroItemAmount = nextValue;
                      })}
                    />
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedItem.heroItemConsumeOnUse ?? true}
                        onChange={(event) => patchSelectedItem((item) => {
                          item.heroItemConsumeOnUse = event.target.checked;
                        })}
                      />
                      Consommer après utilisation
                    </label>
                  </>
                ) : null}

                {(selectedItem.heroItemType || 'none') === 'equipment' ? (
                  <>
                    <HelpLabel help="Statistique augmentée quand le joueur équipe cet objet. Choisis une compétence pour les jets de dé, PV max pour rendre le héros plus résistant, ou mana max pour lancer plus de tests magiques.">Bonus appliqué à</HelpLabel>
                    <select value={selectedItem.heroItemBonusTarget || 'skill'} onChange={(event) => patchSelectedItem((item) => {
                      item.heroItemBonusTarget = event.target.value;
                      if (event.target.value === 'skill') item.heroItemSkillId = item.heroItemSkillId || heroSkills[0]?.id || '';
                    })}>
                      <option value="skill">Compétence</option>
                      <option value="maxHealth">Points de vie max</option>
                      <option value="maxMana">Mana max</option>
                    </select>

                    {(selectedItem.heroItemBonusTarget || 'skill') === 'skill' ? (
                      <>
                        <HelpLabel help="Compétence qui gagne le bonus quand le joueur équipe cet objet. L'équipement s'applique une seule fois par partie.">Compétence boostée</HelpLabel>
                        <select value={selectedItem.heroItemSkillId || heroSkills[0]?.id || ''} onChange={(event) => patchSelectedItem((item) => {
                          item.heroItemSkillId = event.target.value;
                        })}>
                          {heroSkills.map((skill) => (
                            <option key={skill.id} value={skill.id}>{skill.name}</option>
                          ))}
                        </select>
                      </>
                    ) : null}

                    <HelpLabel help="Valeur ajoutée à la statistique choisie, par exemple +1 Force, +3 PV max ou +2 mana max. Une valeur négative peut servir pour un objet maudit.">Bonus</HelpLabel>
                    <NumberInput
                      min="-20"
                      max="20"
                      value={selectedItem.heroItemBonus || 1}
                      onValueChange={(nextValue) => patchSelectedItem((item) => {
                        item.heroItemBonus = nextValue;
                      })}
                    />
                    <p className="small-note">En jeu, cet objet passe dans la zone <strong>Objets portés</strong> de la page personnage.</p>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="objects-editor-actions">
              <button type="button" className="danger-button" onClick={handleDeleteSelectedItem}>
                <Trash2 aria-hidden="true" size={16} />
                <span>Supprimer l'objet</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state-inline">
            <Package aria-hidden="true" size={22} />
            <span>Crée ou sélectionne un objet pour modifier sa fiche.</span>
          </div>
        )}
      </section>
    </main>
  );
}
