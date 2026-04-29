const FIELD_HELP = {
  addCombination: "Crée une nouvelle recette d’inventaire. Le joueur devra combiner deux objets pour obtenir un résultat.",
  itemA: "Premier objet nécessaire à la combinaison. L’ordre avec l’objet 2 sert surtout à organiser la recette dans l’éditeur.",
  itemB: "Deuxième objet nécessaire à la combinaison. Choisis un objet différent si tu veux éviter les recettes ambiguës.",
  result: "Objet obtenu quand la combinaison réussit. Il peut ensuite servir dans une zone, une énigme ou une autre combinaison.",
  message: "Texte affiché au joueur après une combinaison réussie. Il confirme le résultat ou donne un indice sur la suite.",
};

const HelpLabel = ({ children, help, className = '' }) => (
  <label className={`label-with-help${className ? ` ${className}` : ''}`}>
    <span>{children}</span>
    <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
  </label>
);

export default function CombinationsTab({ project, addCombination, getItemById, patchProject }) {
  return (
    <div className="layout two-cols-wide">
      <section className="panel side">
        <div className="panel-head">
          <h2>Recettes</h2>
          <div className="label-with-help" data-tour="combination-add">
            <button onClick={addCombination}>+ Combinaison</button>
            <span className="help-dot" data-help={FIELD_HELP.addCombination} aria-label={FIELD_HELP.addCombination} tabIndex={0}>?</span>
          </div>
        </div>
        {(project.combinations || []).length ? (project.combinations || []).map((combo) => {
          const itemA = getItemById(combo.itemAId);
          const itemB = getItemById(combo.itemBId);
          const result = getItemById(combo.resultItemId);
          return (
            <div className="list-card" key={combo.id}>
              <strong>{itemA?.name || 'Objet 1'} + {itemB?.name || 'Objet 2'}</strong>
              <span>→ {result?.name || 'Résultat'}</span>
            </div>
          );
        }) : <p>Aucune combinaison pour l'instant.</p>}
      </section>

      <section className="panel main">
        <div className="panel-head"><h2>Éditeur de combinaisons</h2></div>
        {(project.combinations || []).map((combo) => (
          <div className="combo-card" key={combo.id}>
            <div className="grid-two" data-tour="combination-items">
              <div>
                <HelpLabel help={FIELD_HELP.itemA}>Objet 1</HelpLabel>
                <select value={combo.itemAId} onChange={(e) => patchProject((draft) => {
                  const target = (draft.combinations || []).find((c) => c.id === combo.id); if (target) target.itemAId = e.target.value;
                })}>
                  <option value="">Choisir</option>
                  {project.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.itemB}>Objet 2</HelpLabel>
                <select value={combo.itemBId} onChange={(e) => patchProject((draft) => {
                  const target = (draft.combinations || []).find((c) => c.id === combo.id); if (target) target.itemBId = e.target.value;
                })}>
                  <option value="">Choisir</option>
                  {project.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            </div>
            <HelpLabel help={FIELD_HELP.result}>Résultat</HelpLabel>
            <select data-tour="combination-result" value={combo.resultItemId} onChange={(e) => patchProject((draft) => {
              const target = (draft.combinations || []).find((c) => c.id === combo.id); if (target) target.resultItemId = e.target.value;
            })}>
              <option value="">Choisir</option>
              {project.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <HelpLabel help={FIELD_HELP.message}>Message affiché</HelpLabel>
            <textarea data-tour="combination-message" value={combo.message} onChange={(e) => patchProject((draft) => {
              const target = (draft.combinations || []).find((c) => c.id === combo.id); if (target) target.message = e.target.value;
            })} />
          </div>
        ))}
      </section>
    </div>
  );
}
