import { MISC_MODES } from '../data/enigmaConfig';

export const usesColorSequence = (type) => type === 'colors';
export const usesEditorImageEnigma = (type) => type === 'puzzle';

export function ensureEnigmaTypeDefaults(enigma, type) {
  if (type === 'code' && !enigma.codeSkin) {
    enigma.codeSkin = 'safe-wheels';
  }
  if (type === 'misc') {
    enigma.miscMode = MISC_MODES.has(enigma.miscMode) ? enigma.miscMode : 'free-answer';
    enigma.miscChoices = Array.isArray(enigma.miscChoices) && enigma.miscChoices.length ? enigma.miscChoices : ['Réponse A', 'Réponse B', 'Réponse C'];
    enigma.miscCorrectChoices = Array.isArray(enigma.miscCorrectChoices) ? enigma.miscCorrectChoices : [];
    enigma.miscPairs = Array.isArray(enigma.miscPairs) && enigma.miscPairs.length ? enigma.miscPairs : [
      { left: 'Symbole', right: 'Signification' },
      { left: 'Clé', right: 'Serrure' },
    ];
    enigma.miscTargetItemId = enigma.miscTargetItemId || '';
  }
  if (usesColorSequence(type) && !Array.isArray(enigma.solutionColors)) {
    enigma.solutionColors = ['red', 'blue', 'green'];
  }
  if (type === 'colors' && !enigma.colorLogic) {
    enigma.colorLogic = 'sequence';
  }
  if (!usesColorSequence(type)) {
    enigma.solutionColors = Array.isArray(enigma.solutionColors) ? enigma.solutionColors : [];
  }
  if (usesEditorImageEnigma(type)) {
    enigma.gridRows = Number(enigma.gridRows) || 3;
    enigma.gridCols = Number(enigma.gridCols) || 3;
    if (!enigma.imagePuzzleLogic) {
      enigma.imagePuzzleLogic = 'classic-grid';
    }
    if (!enigma.imageCutStyle) {
      enigma.imageCutStyle = 'straight';
    }
  }
}
