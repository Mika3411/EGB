import { gameActions } from '../../../../shared/services/gameEngine';
import { DEFAULT_COLOR_SEQUENCE } from './previewPlayerDefaults.js';

export function createPreviewEnigmaActions({
  project,
  activeEnigma,
  enigmaCodeInput,
  enigmaColorAttempt,
  enigmaPuzzleOrder,
  enigmaPuzzleSelectedIndex,
  enigmaDragSlots,
  enigmaRotationAngles,
  simonTimeoutsRef,
  dispatchPreview,
  blockDefeatedHeroAction,
  captureLastChoiceSnapshot,
  setters,
}) {
  const getEnigmaById = (enigmaId) => (
    (project.enigmas || []).find((entry) => entry.id === enigmaId) || null
  );

  const clearSimonPlayback = () => {
    simonTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    simonTimeoutsRef.current = [];
    setters.setSimonPlaybackIndex(-1);
  };

  const closeEnigma = () => {
    clearSimonPlayback();
    setters.setActiveEnigma(null);
    setters.setEnigmaCodeInput('');
    setters.setEnigmaColorAttempt(DEFAULT_COLOR_SEQUENCE);
    setters.setEnigmaPuzzleOrder([]);
    setters.setEnigmaPuzzleSelectedIndex(null);
    setters.setEnigmaDragBank([]);
    setters.setEnigmaDragSlots([]);
    setters.setEnigmaDraggedPiece(null);
    setters.setEnigmaRotationAngles([]);
    setters.setSimonPlayerTurn(false);
  };

  const solveActiveEnigma = () => {
    if (!activeEnigma?.enigma) return;
    const { enigma } = activeEnigma;
    dispatchPreview(gameActions.solveEnigma(enigma.id, {
      codeInput: enigma.solutionText || '',
      colorAttempt: enigma.solutionColors || [],
      puzzleOrder: enigmaPuzzleOrder,
      dragSlots: enigmaDragSlots,
      rotationAngles: enigmaRotationAngles,
    }));
  };

  const failActiveEnigma = () => {
    if (!activeEnigma?.enigma) return;
    setters.setDialogue(activeEnigma.enigma.failMessage || 'Ce n’est pas la bonne réponse.');
  };

  const startSimonPlayback = (enigma) => {
    clearSimonPlayback();
    setters.setSimonPlayerTurn(false);
    setters.setEnigmaColorAttempt([]);
    const sequence = enigma.solutionColors || [];
    sequence.forEach((color, index) => {
      const showId = window.setTimeout(() => setters.setSimonPlaybackIndex(index), index * 800 + 250);
      const hideId = window.setTimeout(() => setters.setSimonPlaybackIndex(-1), index * 800 + 700);
      simonTimeoutsRef.current.push(showId, hideId);
    });
    const endId = window.setTimeout(() => {
      setters.setSimonPlaybackIndex(-1);
      setters.setSimonPlayerTurn(true);
    }, sequence.length * 800 + 750);
    simonTimeoutsRef.current.push(endId);
  };

  const openEnigma = (enigma, hotspot = null) => {
    const result = dispatchPreview(gameActions.startEnigma(enigma.id, { enigma, hotspot }));
    if (!result?.ok) return;
    setters.setEnigmaCodeInput('');
    setters.setEnigmaColorAttempt([]);
    setters.setEnigmaPuzzleSelectedIndex(null);
    setters.setEnigmaDraggedPiece(null);
    setters.setSimonPlayerTurn(enigma.type !== 'simon');

    if (enigma.type === 'simon') {
      startSimonPlayback(enigma);
    } else {
      clearSimonPlayback();
    }
  };

  const submitEnigma = () => {
    if (blockDefeatedHeroAction()) return false;
    if (!activeEnigma?.enigma) return false;
    captureLastChoiceSnapshot(activeEnigma.enigma.name || 'Avant énigme');

    const { enigma } = activeEnigma;
    const result = dispatchPreview(gameActions.solveEnigma(enigma.id, {
      codeInput: enigmaCodeInput,
      colorAttempt: enigmaColorAttempt,
      puzzleOrder: enigmaPuzzleOrder,
      dragSlots: enigmaDragSlots,
      rotationAngles: enigmaRotationAngles,
    }));

    if (!result?.ok) {
      if (enigma.type === 'colors') setters.setEnigmaColorAttempt(DEFAULT_COLOR_SEQUENCE);
      return false;
    }

    return true;
  };

  const pushEnigmaColor = (colorValue) => {
    if (!activeEnigma?.enigma) return;
    const expectedLength = activeEnigma.enigma.solutionColors?.length || 0;
    const next = [...enigmaColorAttempt, colorValue].slice(0, expectedLength || enigmaColorAttempt.length + 1);
    setters.setEnigmaColorAttempt(next);

    if (activeEnigma.enigma.type === 'simon') {
      const solution = activeEnigma.enigma.solutionColors || [];
      const failed = next.some((color, index) => color !== solution[index]);
      if (failed) {
        setters.setEnigmaColorAttempt([]);
        failActiveEnigma();
        startSimonPlayback(activeEnigma.enigma);
        return;
      }
      if (next.length === solution.length) {
        solveActiveEnigma();
      }
    }
  };

  const clickPuzzlePiece = (index) => {
    if (enigmaPuzzleSelectedIndex === null) {
      setters.setEnigmaPuzzleSelectedIndex(index);
      return;
    }
    setters.setEnigmaPuzzleOrder((prev) => {
      const next = [...prev];
      [next[enigmaPuzzleSelectedIndex], next[index]] = [next[index], next[enigmaPuzzleSelectedIndex]];
      if (next.every((value, pieceIndex) => value === pieceIndex)) {
        window.setTimeout(() => solveActiveEnigma(), 120);
      }
      return next;
    });
    setters.setEnigmaPuzzleSelectedIndex(null);
  };

  const rotatePuzzlePiece = (index) => {
    setters.setEnigmaRotationAngles((prev) => {
      const next = [...prev];
      next[index] = (((next[index] || 0) + 90) % 360);
      if (next.every((value) => value % 360 === 0)) {
        window.setTimeout(() => solveActiveEnigma(), 120);
      }
      return next;
    });
  };

  const moveDragPieceToSlot = (piece, slotIndex) => {
    if (piece === null || piece === undefined) return;
    setters.setEnigmaDragBank((prevBank) => {
      const bankWithoutPiece = prevBank.filter((entry) => entry !== piece);
      setters.setEnigmaDragSlots((prevSlots) => {
        const nextSlots = [...prevSlots];
        const previousSlotIndex = nextSlots.findIndex((entry) => entry === piece);
        if (previousSlotIndex >= 0) nextSlots[previousSlotIndex] = null;
        const displacedPiece = nextSlots[slotIndex];
        nextSlots[slotIndex] = piece;
        const nextBank = displacedPiece === null || displacedPiece === undefined ?
           bankWithoutPiece
          : [...bankWithoutPiece, displacedPiece];
        window.setTimeout(() => {
          setters.setEnigmaDragBank(nextBank);
          if (nextSlots.every((entry, index) => entry === index)) solveActiveEnigma();
        }, 0);
        return nextSlots;
      });
      return bankWithoutPiece;
    });
  };

  const returnDragPieceToBank = (slotIndex) => {
    setters.setEnigmaDragSlots((prevSlots) => {
      const nextSlots = [...prevSlots];
      const piece = nextSlots[slotIndex];
      if (piece !== null && piece !== undefined) {
        nextSlots[slotIndex] = null;
        setters.setEnigmaDragBank((prevBank) => [...prevBank, piece]);
      }
      return nextSlots;
    });
  };

  return {
    getEnigmaById,
    clearSimonPlayback,
    closeEnigma,
    solveActiveEnigma,
    failActiveEnigma,
    startSimonPlayback,
    openEnigma,
    submitEnigma,
    pushEnigmaColor,
    clickPuzzlePiece,
    rotatePuzzlePiece,
    moveDragPieceToSlot,
    returnDragPieceToBank,
  };
}
