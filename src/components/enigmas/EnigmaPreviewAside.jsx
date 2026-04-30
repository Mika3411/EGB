import {
  CODE_SKIN_LABELS,
  CODE_SKIN_OPTIONS,
  COLOR_LOGIC_LABELS,
  COLOR_LOGIC_OPTIONS,
  COLOR_OPTIONS,
  COLOR_SWATCHES,
  FIELD_HELP,
  IMAGE_CUT_STYLE_LABELS,
  IMAGE_CUT_STYLE_OPTIONS,
  IMAGE_PUZZLE_LOGIC_LABELS,
  IMAGE_PUZZLE_LOGIC_OPTIONS,
  MISC_MODE_OPTIONS,
} from '../../data/enigmaConfig';
import { usesEditorImageEnigma } from '../../lib/enigmaDefaults';
import HelpLabel from '../forms/HelpLabel';

const normalizePreviewText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export default function EnigmaPreviewAside({
  selectedEnigma,
  selectedCodeSkin,
  solutionPreview,
  selectedColorLogic,
  colorPreview,
  selectedMiscMode,
  project,
  selectedImagePuzzleLogic,
  selectedImageCutStyle,
  imagePreviewBackground,
  updateEnigma,
}) {
  return (
    <>
              {selectedEnigma.type === 'code' ? (
                <aside className="combo-card" data-tour="enigma-code-appearance" style={{ position: 'sticky', top: 12, background: 'rgba(15, 23, 42, 0.72)' }}>
                  <h3 style={{ marginTop: 0 }}>Apparence du code</h3>
                  <HelpLabel help={FIELD_HELP.codeSkin}>Forme côté joueur</HelpLabel>
                  <select data-tour="enigma-code-skin" value={selectedCodeSkin} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.codeSkin = e.target.value;
                  })}>
                    {CODE_SKIN_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <div data-tour="enigma-code-preview" style={{ marginTop: 14, padding: 16, border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 16, background: 'rgba(2, 6, 23, 0.45)' }}>
                    <p className="small-note" style={{ marginTop: 0 }}>Aperçu : {CODE_SKIN_LABELS[selectedCodeSkin]}</p>

                    {selectedCodeSkin === 'safe-wheels' ? (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        {solutionPreview.map((char, index) => (
                          <div key={`${char}-${index}`} style={{ width: 44, height: 72, borderRadius: 12, border: '1px solid rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800, background: 'linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.04))' }}>{char}</div>
                        ))}
                      </div>
                    ) : null}

                    {selectedCodeSkin === 'digicode' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gap: 8, justifyContent: 'center' }}>
                        {'123456789*0#'.split('').map((char) => (
                          <div key={char} style={{ height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{char}</div>
                        ))}
                      </div>
                    ) : null}

                    {selectedCodeSkin === 'boxes' ? (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {solutionPreview.map((char, index) => (
                          <div key={`${char}-${index}`} style={{ width: 42, height: 42, borderRadius: 8, border: '2px solid rgba(96, 165, 250, .75)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{char}</div>
                        ))}
                      </div>
                    ) : null}

                    {selectedCodeSkin === 'paper-strip' ? (
                      <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,255,255,.9)', color: '#0f172a', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, letterSpacing: 8 }}>
                        {solutionPreview.join('')}
                      </div>
                    ) : null}
                  </div>

                  <p className="small-note">Cette valeur est sauvegardée dans l’énigme via <code>codeSkin</code>. Le preview joueur pourra ensuite lire ce champ pour afficher la bonne interface.</p>
                </aside>
              ) : null}

              {selectedEnigma.type === 'colors' ? (
                <aside className="combo-card" style={{ position: 'sticky', top: 12, background: 'rgba(15, 23, 42, 0.72)' }}>
                  <h3 style={{ marginTop: 0 }}>Logique couleur</h3>
                  <HelpLabel help={FIELD_HELP.colorLogic}>Mode de jeu</HelpLabel>
                  <select value={selectedColorLogic} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.colorLogic = e.target.value;
                  })}>
                    {COLOR_LOGIC_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <div style={{ marginTop: 14, padding: 16, border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 16, background: 'rgba(2, 6, 23, 0.45)' }}>
                    <p className="small-note" style={{ marginTop: 0 }}>Aperçu : {COLOR_LOGIC_LABELS[selectedColorLogic]}</p>

                    {selectedColorLogic === 'sequence' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                          {['red', 'blue', 'yellow', 'green'].map((color, index) => (
                            <div
                              key={color}
                              style={{
                                height: 66,
                                borderRadius: 14,
                                border: colorPreview[index] === color ? '3px solid rgba(255,255,255,.8)' : '1px solid rgba(255,255,255,.18)',
                                boxShadow: colorPreview[index] === color ? `0 0 28px ${COLOR_SWATCHES[color]}99` : 'none',
                                background: COLOR_SWATCHES[color],
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 900,
                                fontSize: 20,
                              }}
                            >
                              {index + 1}
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : la suite s’allume, puis le joueur doit cliquer les couleurs dans le même ordre.</p>
                      </>
                    ) : null}

                    {selectedColorLogic === 'fixed-code' ? (
                      <>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {colorPreview.map((color, index) => (
                            <div key={`${color}-${index}`} style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,.22)', boxShadow: `0 0 22px ${COLOR_SWATCHES[color] || '#64748b'}55`, background: COLOR_SWATCHES[color] || '#64748b' }} />
                          ))}
                        </div>
                        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,.9)', color: '#0f172a', fontWeight: 800, textAlign: 'center' }}>
                          Affiche / objet : suivre exactement cet ordre ?
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur trouve le code complet ailleurs et le recopie tel quel.</p>
                      </>
                    ) : null}

                    {selectedColorLogic === 'position-color' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(colorPreview.length, 1)}, minmax(0, 1fr))`, gap: 8 }}>
                          {colorPreview.map((color, index) => (
                            <div key={`${color}-${index}`} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                              <strong style={{ fontSize: 12 }}>{index + 1}</strong>
                              <span style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid rgba(255,255,255,.22)', background: COLOR_SWATCHES[color] || '#64748b' }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                          <span className="small-note">Indice : le 2e est {COLOR_OPTIONS.find(([value]) => value === colorPreview[1])?.[1] || 'bleu'}.</span>
                          <span className="small-note">Indice : le dernier est {COLOR_OPTIONS.find(([value]) => value === colorPreview[colorPreview.length - 1])?.[1] || 'rouge'}.</span>
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur déduit chaque position grâce aux indices.</p>
                      </>
                    ) : null}

                    {selectedColorLogic === 'mastermind' ? (
                      <>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          {colorPreview.map((color, index) => (
                            <span key={`${color}-${index}`} style={{ width: 34, height: 34, borderRadius: 999, background: COLOR_SWATCHES[color] || '#64748b', border: '1px solid rgba(255,255,255,.22)' }} />
                          ))}
                        </div>
                        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                            <strong style={{ display: 'block', fontSize: 13 }}>✓ Bonne place</strong>
                            <span className="small-note">couleur + position</span>
                          </div>
                          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                            <strong style={{ display: 'block', fontSize: 13 }}>~ Mal placée</strong>
                            <span className="small-note">couleur correcte</span>
                          </div>
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : chaque essai donne un retour, jusqu’à trouver la combinaison exacte.</p>
                      </>
                    ) : null}

                    {selectedColorLogic === 'hidden-clues' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                          {colorPreview.slice(0, 4).map((color, index) => (
                            <div key={`${color}-${index}`} style={{ minHeight: 62, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.22)', background: 'rgba(15,23,42,.72)', display: 'grid', placeItems: 'center', gap: 4 }}>
                              <span style={{ width: 24, height: 34, borderRadius: 6, background: COLOR_SWATCHES[color] || '#64748b', boxShadow: `0 0 18px ${COLOR_SWATCHES[color] || '#64748b'}66` }} />
                              <span className="small-note">Objet {index + 1}</span>
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : les objets colorés de la scène donnent l’ordre du code.</p>
                      </>
                    ) : null}

                    {selectedColorLogic === 'color-map' ? (
                      <>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {colorPreview.slice(0, 6).map((color, index) => (
                            <div key={`${color}-${index}`} style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 10, alignItems: 'center', padding: 8, borderRadius: 10, background: 'rgba(15,23,42,.68)', border: '1px solid rgba(148, 163, 184, 0.18)' }}>
                              <span style={{ width: 28, height: 28, borderRadius: 999, background: COLOR_SWATCHES[color] || '#64748b', border: '1px solid rgba(255,255,255,.22)' }} />
                              <strong>{COLOR_OPTIONS.find(([value]) => value === color)?.[1] || color}</strong>
                              <span style={{ fontWeight: 900 }}>{index + 1}</span>
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : chaque couleur correspond à un chiffre ou une lettre, pour mixer avec un code classique.</p>
                      </>
                    ) : null}

                    {selectedColorLogic === 'timing' ? (
                      <>
                        <div style={{ display: 'grid', gap: 12 }}>
                          {colorPreview.slice(0, 4).map((color, index) => (
                            <div key={`${color}-${index}`} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'center' }}>
                              <span style={{ width: 30, height: 30, borderRadius: 999, background: COLOR_SWATCHES[color] || '#64748b', border: '1px solid rgba(255,255,255,.22)' }} />
                              <div style={{ height: 18, borderRadius: 999, border: '1px solid rgba(148, 163, 184, 0.24)', background: 'rgba(15,23,42,.72)', position: 'relative', overflow: 'hidden' }}>
                                <span style={{ position: 'absolute', left: `${18 + index * 18}%`, top: 0, bottom: 0, width: 34, background: 'rgba(34,197,94,.72)', boxShadow: '0 0 18px rgba(34,197,94,.45)' }} />
                                <span style={{ position: 'absolute', left: `${10 + index * 16}%`, top: -4, width: 8, height: 26, borderRadius: 999, background: '#f8fafc' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur doit appuyer sur chaque couleur quand le curseur passe dans la zone verte, façon rythme.</p>
                      </>
                    ) : null}

                    {selectedColorLogic === 'mixing' ? (
                      <>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {[
                            ['red', 'blue', 'purple'],
                            ['red', 'yellow', 'orange'],
                            ['blue', 'yellow', 'green'],
                          ].map(([first, second, result]) => (
                            <div key={`${first}-${second}`} style={{ display: 'grid', gridTemplateColumns: '34px auto 34px auto 34px', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ width: 30, height: 30, borderRadius: 999, background: COLOR_SWATCHES[first], border: '1px solid rgba(255,255,255,.22)' }} />
                              <strong>+</strong>
                              <span style={{ width: 30, height: 30, borderRadius: 999, background: COLOR_SWATCHES[second], border: '1px solid rgba(255,255,255,.22)' }} />
                              <strong>=</strong>
                              <span style={{ width: 30, height: 30, borderRadius: 999, background: COLOR_SWATCHES[result], border: '1px solid rgba(255,255,255,.22)', boxShadow: `0 0 18px ${COLOR_SWATCHES[result]}66` }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {colorPreview.map((color, index) => (
                            <span key={`${color}-${index}`} style={{ width: 32, height: 32, borderRadius: 10, background: COLOR_SWATCHES[color] || '#64748b', border: '1px solid rgba(255,255,255,.22)' }} />
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur combine deux couleurs pour produire la couleur attendue, par exemple Rouge + Bleu = Violet.</p>
                      </>
                    ) : null}
                  </div>

                  <p className="small-note">Sauvegardé dans l’énigme via <code>colorLogic</code>. La combinaison reste dans <code>solutionColors</code>.</p>
                </aside>
              ) : null}

              {selectedEnigma.type === 'misc' ? (
                <aside className="combo-card" style={{ position: 'sticky', top: 12, background: 'rgba(15, 23, 42, 0.72)' }}>
                  <h3 style={{ marginTop: 0 }}>Logique Divers</h3>
                  <p className="small-note">Aperçu : {MISC_MODE_OPTIONS.find(([value]) => value === selectedMiscMode)?.[1] || 'Question / réponse'}</p>

                  <div style={{ marginTop: 14, padding: 16, border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 16, background: 'rgba(2, 6, 23, 0.45)' }}>
                    {['free-answer', 'fill-blank', 'accepted-answers'].includes(selectedMiscMode) ? (
                      <>
                        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(147,197,253,.22)' }}>
                          <strong>{selectedMiscMode === 'fill-blank' ? 'Mot manquant' : 'Réponse libre'}</strong>
                          <div style={{ marginTop: 10, height: 42, borderRadius: 10, border: '1px solid rgba(148,163,184,.24)', background: 'rgba(12,21,39,.95)', display: 'flex', alignItems: 'center', padding: '0 12px', color: '#94a3b8' }}>
                            {selectedMiscMode === 'accepted-answers' ? 'une réponse alternative...' : 'écris ta réponse...'}
                          </div>
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : validation souple, insensible aux majuscules et aux accents.</p>
                      </>
                    ) : null}

                    {selectedMiscMode === 'multiple-choice' ? (
                      <>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(selectedEnigma.miscChoices || []).slice(0, 4).map((choice) => (
                            <div key={choice} style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(147,197,253,.22)', background: choice === selectedEnigma.solutionText ? 'rgba(59,130,246,.28)' : 'rgba(15,23,42,.72)' }}>
                              {choice}
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : un seul choix correspond à la solution attendue.</p>
                      </>
                    ) : null}

                    {selectedMiscMode === 'true-false' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {['Vrai', 'Faux'].map((choice) => (
                            <div key={choice} style={{ height: 70, borderRadius: 12, border: '1px solid rgba(147,197,253,.26)', background: normalizePreviewText(selectedEnigma.solutionText) === normalizePreviewText(choice) ? 'rgba(59,130,246,.32)' : 'rgba(15,23,42,.72)', display: 'grid', placeItems: 'center', fontWeight: 900 }}>
                              {choice}
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur tranche entre deux affirmations.</p>
                      </>
                    ) : null}

                    {selectedMiscMode === 'ordering' ? (
                      <>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(selectedEnigma.miscChoices || []).slice(0, 5).map((choice, index) => (
                            <div key={`${choice}-${index}`} style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 8, alignItems: 'center', padding: 9, borderRadius: 10, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.2)' }}>
                              <strong>{index + 1}</strong>
                              <span>{choice}</span>
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur clique les éléments dans le bon ordre.</p>
                      </>
                    ) : null}

                    {selectedMiscMode === 'matching' ? (
                      <>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(selectedEnigma.miscPairs || []).slice(0, 4).map((pair) => (
                            <div key={`${pair.left}-${pair.right}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', padding: 9, borderRadius: 10, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.2)' }}>
                              <span>{pair.left}</span>
                              <strong>→</strong>
                              <span>{pair.right}</span>
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : associer chaque élément à la bonne réponse.</p>
                      </>
                    ) : null}

                    {['numeric-range', 'exact-number'].includes(selectedMiscMode) ? (
                      <>
                        <div style={{ height: 82, borderRadius: 14, border: '1px solid rgba(147,197,253,.24)', background: 'rgba(15,23,42,.72)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: selectedMiscMode === 'exact-number' ? '48%' : '24%', right: selectedMiscMode === 'exact-number' ? '48%' : '24%', top: 28, height: 12, borderRadius: 999, background: 'rgba(34,197,94,.75)', boxShadow: '0 0 18px rgba(34,197,94,.45)' }} />
                          <span style={{ position: 'absolute', left: 14, bottom: 10 }} className="small-note">{selectedMiscMode === 'exact-number' ? '0' : selectedEnigma.miscMin || 'min'}</span>
                          <strong style={{ position: 'absolute', left: '50%', top: 48, transform: 'translateX(-50%)' }}>{selectedMiscMode === 'exact-number' ? selectedEnigma.solutionText || '42' : 'OK'}</strong>
                          <span style={{ position: 'absolute', right: 14, bottom: 10 }} className="small-note">{selectedMiscMode === 'exact-number' ? '100' : selectedEnigma.miscMax || 'max'}</span>
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>{selectedMiscMode === 'exact-number' ? 'Logique : le nombre doit être exactement celui attendu.' : 'Logique : le nombre doit tomber dans la plage acceptée.'}</p>
                      </>
                    ) : null}

                    {selectedMiscMode === 'multi-select' ? (
                      <>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(selectedEnigma.miscChoices || []).slice(0, 5).map((choice) => (
                            <div key={choice} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 8, alignItems: 'center', padding: 9, borderRadius: 10, background: (selectedEnigma.miscCorrectChoices || []).includes(choice) ? 'rgba(59,130,246,.28)' : 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.2)' }}>
                              <span>{(selectedEnigma.miscCorrectChoices || []).includes(choice) ? '✓' : '□'}</span>
                              <span>{choice}</span>
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : plusieurs réponses doivent être cochées.</p>
                      </>
                    ) : null}

                    {selectedMiscMode === 'item-select' ? (
                      <>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(project.items || []).slice(0, 5).map((item) => (
                            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 8, alignItems: 'center', padding: 9, borderRadius: 10, background: item.id === selectedEnigma.miscTargetItemId ? 'rgba(59,130,246,.28)' : 'rgba(15,23,42,.72)', border: '1px solid rgba(148,163,184,.2)' }}>
                              <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center' }}>{item.icon || '□'}</span>
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur choisit le bon objet.</p>
                      </>
                    ) : null}
                  </div>

                  <p className="small-note">Sauvegardé dans l’énigme via <code>miscMode</code> et les champs Divers associés.</p>
                </aside>
              ) : null}

              {usesEditorImageEnigma(selectedEnigma.type) ? (
                <aside className="combo-card" style={{ position: 'sticky', top: 12, background: 'rgba(15, 23, 42, 0.72)' }}>
                  <h3 style={{ marginTop: 0 }}>Logique du puzzle</h3>
                  <HelpLabel help={FIELD_HELP.imagePuzzleLogic}>Mode image</HelpLabel>
                  <select value={selectedImagePuzzleLogic} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.imagePuzzleLogic = e.target.value;
                  })}>
                    {IMAGE_PUZZLE_LOGIC_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <HelpLabel help={FIELD_HELP.imageCutStyle}>Format de découpe</HelpLabel>
                  <select value={selectedImageCutStyle} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.imageCutStyle = e.target.value;
                  })}>
                    {IMAGE_CUT_STYLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>

                  <div style={{ marginTop: 14, padding: 16, border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 16, background: 'rgba(2, 6, 23, 0.45)' }}>
                    <p className="small-note" style={{ marginTop: 0 }}>Aperçu : {IMAGE_PUZZLE_LOGIC_LABELS[selectedImagePuzzleLogic]}</p>

                    {selectedImagePuzzleLogic === 'click-zones' ? (
                      <>
                        <div style={{ height: 150, borderRadius: 14, border: '1px solid rgba(255,255,255,.18)', background: 'linear-gradient(135deg, #243b55, #141e30)', position: 'relative', overflow: 'hidden', ...imagePreviewBackground }}>
                          {[
                            ['18%', '34%'],
                            ['58%', '28%'],
                            ['76%', '66%'],
                            ['34%', '72%'],
                          ].map(([left, top], index) => (
                            <span key={`${left}-${top}`} style={{ position: 'absolute', left, top, width: 28, height: 28, borderRadius: 999, border: '3px solid #22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,.22), 0 0 18px rgba(34,197,94,.55)', transform: 'translate(-50%, -50%)', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 12 }}>{index + 1}</span>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : le joueur clique sur des zones précises de l’image, par exemple 4 symboles cachés.</p>
                      </>
                    ) : null}

                    {selectedImagePuzzleLogic === 'progressive-reveal' ? (
                      <>
                        <div style={{ height: 150, borderRadius: 14, border: '1px solid rgba(255,255,255,.18)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', overflow: 'hidden', background: '#0f172a' }}>
                          {[0, 1, 2, 3, 4, 5].map((tile) => (
                            <div key={tile} style={{ display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.16)', background: tile < 3 ? `linear-gradient(135deg, rgba(96,165,250,.28), rgba(34,197,94,.22)), ${selectedEnigma.imageData ? 'transparent' : '#172554'}` : ['#facc15', '#16a34a', '#dc2626'][tile - 3], color: '#fff', fontWeight: 900, fontSize: 22, ...imagePreviewBackground, filter: tile < 3 && selectedEnigma.imageData ? 'none' : undefined }}>
                              {tile < 3 ? '' : tile + 1}
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : l’image commence floutée ou cachée, puis chaque action révèle une partie jusqu’à rendre l’indice lisible.</p>
                      </>
                    ) : null}

                    {selectedImagePuzzleLogic === 'classic-grid' ? (
                      <>
                        <div style={{ height: 150, borderRadius: 14, border: '1px solid rgba(255,255,255,.18)', display: 'grid', gridTemplateColumns: `repeat(${selectedEnigma.gridCols || 3}, 1fr)`, gridTemplateRows: `repeat(${selectedEnigma.gridRows || 3}, 1fr)`, overflow: 'hidden', background: '#0f172a' }}>
                          {Array.from({ length: Math.min((selectedEnigma.gridRows || 3) * (selectedEnigma.gridCols || 3), 16) }).map((_, index) => (
                            <div key={index} style={{ border: '1px solid rgba(255,255,255,.16)', background: selectedEnigma.imageData ? 'transparent' : `hsl(${(index * 42) % 360}, 72%, 48%)`, display: 'grid', placeItems: 'center', fontWeight: 900, ...imagePreviewBackground }}>
                              {!selectedEnigma.imageData ? index + 1 : ''}
                            </div>
                          ))}
                        </div>
                        <p className="small-note" style={{ marginBottom: 0 }}>Logique : l’image est découpée en grille. Le joueur remet les pièces dans le bon ordre, en drag & drop ou avec une case vide.</p>
                      </>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 14, padding: 16, border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: 16, background: 'rgba(2, 6, 23, 0.45)' }}>
                    <p className="small-note" style={{ marginTop: 0 }}>Découpe : {IMAGE_CUT_STYLE_LABELS[selectedImageCutStyle]}</p>
                    <div style={{ height: 118, borderRadius: 14, border: '1px solid rgba(255,255,255,.18)', background: '#0f172a', overflow: 'hidden', display: selectedImageCutStyle === 'strips' ? 'grid' : 'flex', flexWrap: 'wrap', gridTemplateColumns: 'repeat(5, 1fr)', gap: selectedImageCutStyle === 'shards' ? 8 : 0, padding: selectedImageCutStyle === 'shards' ? 10 : 0 }}>
                      {selectedImageCutStyle === 'straight' ? Array.from({ length: 9 }).map((_, index) => (
                        <span key={index} style={{ flex: '1 0 33.33%', height: '33.33%', border: '1px solid rgba(255,255,255,.18)', background: selectedEnigma.imageData ? 'transparent' : `hsl(${index * 34}, 70%, 46%)`, ...imagePreviewBackground }} />
                      )) : null}

                      {selectedImageCutStyle === 'jigsaw' ? Array.from({ length: 6 }).map((_, index) => (
                        <span key={index} style={{ flex: '1 0 33.33%', height: '50%', border: '1px solid rgba(255,255,255,.16)', background: selectedEnigma.imageData ? 'transparent' : `hsl(${index * 45}, 78%, 48%)`, borderRadius: index % 2 ? '26px 8px 26px 8px' : '8px 26px 8px 26px', clipPath: index % 2 ? 'polygon(0 0, 78% 0, 100% 28%, 100% 100%, 22% 100%, 0 72%)' : 'polygon(20% 0, 100% 0, 100% 72%, 78% 100%, 0 100%, 0 28%)', ...imagePreviewBackground }} />
                      )) : null}

                      {selectedImageCutStyle === 'torn' ? Array.from({ length: 5 }).map((_, index) => (
                        <span key={index} style={{ flex: '1 0 20%', height: '100%', border: '1px solid rgba(255,255,255,.14)', background: selectedEnigma.imageData ? 'transparent' : `hsl(${index * 55}, 72%, 50%)`, clipPath: index % 2 ? 'polygon(0 0, 100% 8%, 92% 25%, 100% 45%, 88% 66%, 100% 100%, 0 92%, 10% 68%, 0 48%, 12% 25%)' : 'polygon(0 10%, 100% 0, 88% 24%, 100% 50%, 90% 72%, 100% 94%, 0 100%, 12% 75%, 0 52%, 10% 28%)', ...imagePreviewBackground }} />
                      )) : null}

                      {selectedImageCutStyle === 'crumpled' ? Array.from({ length: 9 }).map((_, index) => (
                        <span key={index} style={{ flex: '1 0 33.33%', height: '33.33%', border: '1px solid rgba(255,255,255,.12)', background: selectedEnigma.imageData ? 'transparent' : `linear-gradient(135deg, hsla(${index * 36}, 70%, 48%, .95), rgba(255,255,255,.18), hsla(${index * 36 + 30}, 70%, 38%, .95))`, transform: `rotate(${[-3, 2, -1, 4, 0, -4, 2, -2, 3][index]}deg)`, boxShadow: 'inset 10px 0 18px rgba(255,255,255,.08), inset -10px 0 18px rgba(0,0,0,.2)', ...imagePreviewBackground }} />
                      )) : null}

                      {selectedImageCutStyle === 'shards' ? Array.from({ length: 7 }).map((_, index) => (
                        <span key={index} style={{ flex: '1 0 28%', minHeight: 42, border: '1px solid rgba(255,255,255,.16)', background: selectedEnigma.imageData ? 'transparent' : `hsl(${index * 48}, 74%, 48%)`, clipPath: ['polygon(10% 0, 100% 18%, 76% 100%, 0 70%)', 'polygon(0 20%, 70% 0, 100% 80%, 24% 100%)', 'polygon(30% 0, 100% 40%, 82% 100%, 0 84%, 12% 18%)'][index % 3], ...imagePreviewBackground }} />
                      )) : null}

                      {selectedImageCutStyle === 'strips' ? Array.from({ length: 5 }).map((_, index) => (
                        <span key={index} style={{ borderLeft: '1px solid rgba(255,255,255,.16)', borderRight: '1px solid rgba(255,255,255,.16)', background: selectedEnigma.imageData ? 'transparent' : `hsl(${index * 52}, 76%, 48%)`, transform: `translateY(${index % 2 ? 8 : -6}px)`, ...imagePreviewBackground }} />
                      )) : null}
                    </div>
                    <p className="small-note" style={{ marginBottom: 0 }}>
                      Ce style pourra être utilisé par le rendu joueur pour afficher les pièces avec la bonne forme.
                    </p>
                  </div>

                  <p className="small-note">Sauvegardé dans l’énigme via <code>imagePuzzleLogic</code> et <code>imageCutStyle</code>. L’image et la grille restent configurées plus bas.</p>
                </aside>
              ) : null}
    </>
  );
}
