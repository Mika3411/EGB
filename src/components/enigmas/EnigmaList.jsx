import { FIELD_HELP, TYPE_LABELS } from '../../data/enigmaConfig';
import HelpLabel from '../forms/HelpLabel';

export default function EnigmaList({
  enigmas,
  selectedEnigmaId,
  setSelectedEnigmaId,
  addEnigma,
}) {
  return (
    <section className="panel side">
      <div className="panel-head">
        <h2>Énigmes</h2>
        <div className="label-with-help">
          <button onClick={addEnigma}>+ Énigme</button>
          <span className="help-dot" data-help={FIELD_HELP.addEnigma} aria-label={FIELD_HELP.addEnigma} tabIndex={0}>?</span>
        </div>
      </div>
      <HelpLabel help={FIELD_HELP.list}>Énigme à configurer</HelpLabel>
      {enigmas.length ? enigmas.map((enigma) => (
        <button
          key={enigma.id}
          className={`list-card ${selectedEnigmaId === enigma.id ? 'selected' : ''}`}
          onClick={() => setSelectedEnigmaId(enigma.id)}
        >
          <strong>{enigma.name}</strong>
          <span>{TYPE_LABELS[enigma.type] || enigma.type}</span>
        </button>
      )) : <p>Aucune énigme pour l'instant.</p>}
    </section>
  );
}
